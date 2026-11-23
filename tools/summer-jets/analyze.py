"""
Turn the cached OpenSky arrivals (raw/*.json) into per-airport summer
private-jet metrics. Runs on whatever has been pulled so far.

Classification, per arrival, from OpenSky's aircraft database:
  bizjet     business-jet type code (Gulfstream, Global, Falcon, Citation, ...)
  vip        airliner type (A319, B737, ...) flying under a registration-style
             call sign rather than an airline flight number: ACJ / BBJ
  turboprop  fixed-wing turboprop (PC-12, King Air, ...), reported separately
  heli       helicopters, excluded
  airline    everything else with a type, excluded
  unknown    aircraft missing from the database; counted as "likely private"
             only when it flies under a registration-style call sign

Usage: python3 -I tools/summer-jets/analyze.py
Writes out/airports.csv and out/summary.md.
"""
import collections
import csv
import datetime as dt
import json
import pathlib
import re
import statistics

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / 'raw'
OUT = HERE / 'out'

import sys  # noqa: E402

sys.path.insert(0, str(HERE))  # python -I drops the script folder from the path
from pull import AIRPORTS, SUMMER, OFF  # noqa: E402

# A summer sample whose total arrivals (all aircraft) fall below this share of
# the airport's summer median is treated as an OpenSky receiver outage and
# dropped. Off-season samples are never dropped: they are low by design.
OUTAGE_SHARE = 0.25

BIZJET_TYPES = set('''
GLF2 GLF3 GLF4 GLF5 GLF6 GA5C GA6C GA7C GA8C G150 G280 GALX ASTR
GLEX GL5T GL7T GL8T CL30 CL35 CL60
LJ23 LJ24 LJ25 LJ28 LJ31 LJ35 LJ36 LJ40 LJ45 LJ55 LJ60 LJ70 LJ75
FA10 FA20 FA50 F900 FA7X FA8X FA6X F2TH F2TS
E50P E55P E35L E545 E550
C500 C501 C510 C525 C25A C25B C25C C25M C526 C550 C551 C560 C56X C650 C680 C68A C700 C750
H25A H25B H25C HA4T BE40 PRM1 PC24 HDJT SF50 EA50 WW24
'''.split())

AIRLINE_CALLSIGN = re.compile(r'^[A-Z]{3}\d')
# Registration prefixes of GCC states (registration column, e.g. "A6-ABC").
GCC_REG = ('A6-', 'A7-', 'A9C-', 'HZ-', '9K-', 'A4O-')


def load_db():
    db = {}
    with open(RAW / 'aircraftDatabase.csv', newline='', encoding='utf-8', errors='replace') as f:
        for r in csv.DictReader(f):
            if r['icao24']:
                db[r['icao24'].lower()] = (r['typecode'].upper(), r['icaoaircrafttype'].upper(), r['registration'].upper())
    return db


def classify(flight, db):
    callsign = (flight.get('callsign') or '').strip().upper()
    private_callsign = bool(callsign) and not AIRLINE_CALLSIGN.match(callsign)
    typecode, desc, reg = db.get((flight.get('icao24') or '').lower(), ('', '', ''))
    if desc.startswith('H') or desc.startswith('G'):  # helicopters, gyrocopters
        return 'heli', reg
    if typecode in BIZJET_TYPES:
        return 'bizjet', reg
    if desc.startswith('L') and desc.endswith('T'):
        return 'turboprop', reg
    if desc.startswith('L') and desc.endswith('J'):
        return ('vip' if private_callsign else 'airline'), reg
    if not typecode and not desc:
        return ('unknown_private' if private_callsign else 'unknown'), reg
    return 'other', reg  # pistons and the rest


IFR_CLASSES = ('airline', 'bizjet', 'vip', 'turboprop', 'unknown', 'unknown_private')
# Below this capture rate a sample is too thin to scale up, so it is dropped.
MIN_COVERAGE = 0.15


def load_eurocontrol():
    """(airport, 'YYYY-MM-DD') -> IFR arrivals, from EUROCONTROL's airport traffic CSVs."""
    arr = {}
    for path in sorted(RAW.glob('airport_traffic_*.csv')):
        with open(path, newline='', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                if r['APT_ICAO'] in AIRPORTS and r['FLT_ARR_1']:
                    arr[(r['APT_ICAO'], r['FLT_DATE'][:10])] = int(r['FLT_ARR_1'])
    return arr


def sample_coverage(icao, start, counts, ec):
    """OpenSky's capture rate for one 2-day sample, or None when EUROCONTROL has no data."""
    days = [start, (dt.date.fromisoformat(start) + dt.timedelta(days=1)).isoformat()]
    if not all((icao, d) in ec for d in days):
        return None
    expected = sum(ec[(icao, d)] for d in days)
    seen = sum(counts[c] for c in IFR_CLASSES)
    return min(1.0, seen / expected) if expected else None


def main():
    db = load_db()
    ec = load_eurocontrol()
    OUT.mkdir(exist_ok=True)
    # icao -> kind -> start -> {'counts', 'private': [(icao24, reg)], 'cov'}
    per = collections.defaultdict(lambda: collections.defaultdict(dict))
    for path in sorted(RAW.glob('*_*.json')):
        d = json.loads(path.read_text())
        counts, private = collections.Counter(), []
        for f in d['flights']:
            cls, reg = classify(f, db)
            counts[cls] += 1
            if cls in ('bizjet', 'vip'):
                private.append((f['icao24'], reg))
        per[d['airport']][d['kind']][d['start']] = {
            'counts': counts,
            'private': private,
            'cov': sample_coverage(d['airport'], d['start'], counts, ec),
        }

    # Drop samples too thin to trust: by capture rate where EUROCONTROL covers the
    # airport, otherwise (summer only) by total arrivals against the summer median.
    dropped = []
    for icao, kinds in per.items():
        for kind, samples in kinds.items():
            totals = [sum(x['counts'].values()) for x in samples.values()]
            med = statistics.median(totals) if totals else 0
            for st, x in list(samples.items()):
                if x['cov'] is not None and x['cov'] < MIN_COVERAGE:
                    dropped.append(f"{icao} {st} (capture rate {x['cov']:.0%})")
                    del samples[st]
                elif x['cov'] is None and kind == 'summer' and sum(x['counts'].values()) < OUTAGE_SHARE * med:
                    dropped.append(f"{icao} {st} ({sum(x['counts'].values())} arrivals vs summer median {med:.0f})")
                    del samples[st]

    def value(x):
        """Private-jet arrivals in a sample, scaled up by the capture rate when known."""
        raw = len(x['private'])
        return raw / x['cov'] if x['cov'] else raw

    rows = []
    for icao, name in AIRPORTS.items():
        s, o = per[icao]['summer'], per[icao]['off']
        if not s:
            continue
        s_vals = [value(x) for x in s.values()]
        o_vals = [value(x) for x in o.values()]
        covs = [x['cov'] for x in list(s.values()) + list(o.values()) if x['cov'] is not None]
        s_mean = statistics.mean(s_vals)
        o_mean = statistics.mean(o_vals) if o_vals else None
        peak_start, peak = max(s.items(), key=lambda kv: value(kv[1]))
        priv = [p for x in s.values() for p in x['private']]
        s_tot = collections.Counter()
        for x in s.values():
            s_tot.update(x['counts'])
        rows.append({
            'icao': icao,
            'destination': name,
            'corrected': bool(covs),
            'mean_capture_rate': round(statistics.mean(covs), 2) if covs else '',
            'summer_samples': len(s_vals),
            'off_samples': len(o_vals),
            'private_jets_per_2days_summer': round(s_mean, 1),
            'private_jets_per_2days_off': round(o_mean, 1) if o_mean is not None else '',
            'summer_uplift': round(s_mean / o_mean, 2) if o_mean else '',
            'est_private_arrivals_jun_sep': round(s_mean / 2 * 122),
            'raw_private_jets_per_2days_summer': round(len(priv) / len(s_vals), 1),
            'distinct_private_jets_sampled': len({p[0] for p in priv}),
            'gcc_registered_share': round(sum(1 for p in priv if p[1].startswith(GCC_REG)) / max(1, len(priv)), 3),
            'peak_fortnight_start': peak_start,
            'peak_2day_private_jets': round(value(peak), 1),
            'summer_turboprops_per_2days': round(s_tot['turboprop'] / len(s_vals), 1),
            'by_sample': {k: round(value(v), 1) for k, v in sorted(s.items())},
        })
    rows.sort(key=lambda r: -r['private_jets_per_2days_summer'])

    cols = [k for k in rows[0] if k != 'by_sample'] if rows else []
    with open(OUT / 'airports.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols + [d.isoformat() for d in SUMMER])
        w.writeheader()
        for r in rows:
            w.writerow({**{k: r[k] for k in cols}, **{k: r['by_sample'].get(k, '') for k in (d.isoformat() for d in SUMMER)}})

    dash = lambda v, fmt='{}': fmt.format(v) if v != '' else '—'  # noqa: E731
    lines = [
        '# Summer private-jet arrivals by destination (OpenSky, summer 2025)',
        '',
        'Private = business jets + VIP airliners on registration call signs. Samples are Fri–Sat (2 days),',
        'fortnightly 6 Jun – 27 Sep 2025; off-season = Fri–Sat in mid Nov 2024, Feb 2025, Apr 2025.',
        "Counts are scaled up by OpenSky's capture rate (its instrument-flight arrivals ÷ EUROCONTROL's for",
        'the same days) where EUROCONTROL covers the airport; rows marked * are raw, uncorrected counts.',
        'Season estimate = mean per 2 days × 61 (122 days); Fri–Sat sampling may run higher than midweek.',
        '',
        '| # | Destination | Jets / 2 days (summer) | Off-season | Uplift | Est. Jun–Sep arrivals | Capture rate | Distinct jets seen | GCC-reg. share | Peak fortnight |',
        '|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ]
    for i, r in enumerate(rows, 1):
        star = '' if r['corrected'] else ' *'
        lines.append(
            f"| {i} | {r['destination']} ({r['icao']}){star} | {r['private_jets_per_2days_summer']} | {dash(r['private_jets_per_2days_off'])} | "
            f"{dash(r['summer_uplift'], '{}×')} | {r['est_private_arrivals_jun_sep']:,} | {dash(r['mean_capture_rate'], '{:.0%}')} | "
            f"{r['distinct_private_jets_sampled']} | {r['gcc_registered_share']:.1%} | {r['peak_fortnight_start']} |"
        )
    if dropped:
        lines += ['', 'Samples dropped as too thin to trust: ' + '; '.join(dropped) + '.']
    (OUT / 'summary.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    pulled = len(list(RAW.glob('*_*.json')))
    print(f'\n{pulled}/{len(AIRPORTS) * (len(SUMMER) + len(OFF))} samples pulled so far')


if __name__ == '__main__':
    main()
