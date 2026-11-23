"""
Combine the private-jet (out/airports.csv) and yacht (out/yachts.csv)
results into one record per candidate city, ready for the decoder seed
script (decoder-platform/scripts/seed-omniyat.ts).

A city sums its airports (e.g. London = Farnborough + Luton) and its yacht
hubs. Yacht hubs whose 20 km boxes overlap are not summed (that would count
the same water twice): each such city uses one primary hub.

Usage: python3 -I tools/summer-jets/analyze.py && python3 -I tools/summer-jets/yachts.py
       python3 -I tools/summer-jets/cities.py
Writes out/cities.json.
"""
import csv
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'out'

# name, country, iso2, lat, lng, airports (ICAO), yacht hubs (names in yachts.py), extra notes
CITIES = [
    ('Monaco & Nice', 'Monaco', 'mc', 43.735, 7.425, ['LFMN'], ['Monaco'], []),
    ('Cannes & Antibes', 'France', 'fr', 43.551, 7.017, ['LFMD'], ['Cannes'], []),
    ('Saint-Tropez', 'France', 'fr', 43.270, 6.640, ['LFTH', 'LFTZ'], ['Saint-Tropez'], []),
    ('Costa Smeralda', 'Italy', 'it', 41.135, 9.540, ['LIEO'], ['Porto Cervo (Costa Smeralda)'], []),
    ('Capri & Amalfi Coast', 'Italy', 'it', 40.600, 14.400, ['LIRN'], ['Capri', 'Amalfi Coast'], []),
    ('Lake Como', 'Italy', 'it', 45.985, 9.258, ['LIML'], [], ['Lake Como has no sea yacht data; it is counted from Milan Linate arrivals.']),
    ('Venice', 'Italy', 'it', 45.440, 12.330, ['LIPZ'], ['Venice'], []),
    ('Marbella', 'Spain', 'es', 36.510, -4.885, ['LEMG'], ['Marbella (Puerto Banús)'], []),
    ('Ibiza', 'Spain', 'es', 38.910, 1.440, ['LEIB'], ['Ibiza'], []),
    ('Mallorca', 'Spain', 'es', 39.570, 2.650, ['LEPA'], ['Palma (Mallorca)'], []),
    ('Mykonos', 'Greece', 'gr', 37.445, 25.330, ['LGMK'], ['Mykonos'], []),
    ('Santorini', 'Greece', 'gr', 36.420, 25.430, ['LGSR'], ['Santorini'], []),
    ('Athens Riviera', 'Greece', 'gr', 37.810, 23.770, ['LGAV'], ['Athens Riviera'], []),
    ('Bodrum', 'Turkey', 'tr', 37.035, 27.430, ['LTFE'], ['Bodrum'], []),
    ('Dubrovnik', 'Croatia', 'hr', 42.650, 18.094, ['LDDU'], ['Dubrovnik'], []),
    ('Split & Hvar', 'Croatia', 'hr', 43.300, 16.440, ['LDSP'], ['Split', 'Hvar'], []),
    ('Geneva', 'Switzerland', 'ch', 46.204, 6.143, ['LSGG'], [], []),
    ('London', 'United Kingdom', 'gb', 51.507, -0.128, ['EGLF', 'EGGW'], [], []),
    ('The Hamptons', 'United States', 'us', 40.963, -72.185, ['KHTO'], [],
     ['EMODnet covers European waters only, so US yachting is not measured here; it scores as zero on the yacht metrics.']),
    ('Nantucket', 'United States', 'us', 41.283, -70.099, ['KACK'], [],
     ['EMODnet covers European waters only, so US yachting is not measured here; it scores as zero on the yacht metrics.']),
    ('Miami', 'United States', 'us', 25.762, -80.192, ['KOPF'], [],
     ['Miami is a winter destination; it is included as a contrast. US yachting is not measured (EMODnet is European).']),
]


def num(v):
    return float(v) if v not in ('', None) else None


def load(path, key):
    with open(path, newline='') as f:
        return {r[key]: r for r in csv.DictReader(f)}


def main():
    airports = load(OUT / 'airports.csv', 'icao')
    yachts = load(OUT / 'yachts.csv', 'site')
    fortnights = [c for c in next(iter(airports.values())).keys() if c[:4].isdigit()]
    out = []
    for name, country, iso2, lat, lng, aps, hubs, notes in CITIES:
        notes = list(notes)
        rows = [airports[a] for a in aps if a in airports]
        missing = [a for a in aps if a not in airports]
        if missing:
            notes.append(f'No jet data yet for {", ".join(missing)}.')
        jets = None
        if rows:
            series = []
            for f in fortnights:
                vals = [num(r[f]) for r in rows if num(r[f]) is not None]
                if vals:
                    series.append({'label': f, 'value': round(sum(vals), 1)})
            summer = sum(num(r['private_jets_per_2days_summer']) for r in rows)
            offs = [num(r['private_jets_per_2days_off']) for r in rows]
            off = sum(offs) if all(o is not None for o in offs) else None
            caps = [num(r['mean_capture_rate']) for r in rows if num(r['mean_capture_rate']) is not None]
            if caps and len(caps) < len(rows):
                notes.append('Jet counts are corrected for OpenSky coverage at some of these airports only.')
            gcc_n = sum(num(r['gcc_registered_share']) * num(r['raw_private_jets_per_2days_summer']) for r in rows)
            raw_n = sum(num(r['raw_private_jets_per_2days_summer']) for r in rows)
            peak = max(series, key=lambda p: p['value'])['label'] if series else ''
            jets = {
                'airports': [f"{r['icao']} {r['destination']}" for r in rows],
                'summerPer2Days': round(summer, 1),
                'offPer2Days': round(off, 1) if off is not None else None,
                'uplift': round(summer / off, 2) if off else None,
                'seasonArrivals': round(sum(num(r['est_private_arrivals_jun_sep']) for r in rows)),
                'series': series,
                'peak': peak,
                'captureRate': round(sum(caps) / len(caps), 2) if caps else None,
                'gccShare': round(gcc_n / raw_n, 3) if raw_n else None,
            }
        ys = [yachts[h] for h in hubs if h in yachts]
        boats = None
        if ys:
            months = [sum(num(y[f'm{m:02d}']) for y in ys) for m in range(1, 13)]
            s_mean = sum(months[5:9]) / 4
            r_mean = (sum(months[:5]) + sum(months[9:])) / 8
            boats = {
                'sites': [y['site'] for y in ys],
                'summerHoursPerMonth': round(s_mean),
                'offHoursPerMonth': round(r_mean),
                'uplift': round(s_mean / r_mean, 2) if r_mean else None,
                'series': [{'label': str(m + 1), 'value': round(v)} for m, v in enumerate(months)],
                'peakMonth': max(range(12), key=lambda m: months[m]) + 1,
                'year': 2023,
            }
        out.append({
            'name': name,
            'country': country,
            'iso2': iso2,
            'lat': lat,
            'lng': lng,
            'values': {
                'jets_summer': jets['summerPer2Days'] if jets else None,
                'jets_uplift': jets['uplift'] if jets else None,
                'yacht_summer': boats['summerHoursPerMonth'] if boats else None,
                'yacht_uplift': boats['uplift'] if boats else None,
                'gcc_share': round(jets['gccShare'] * 100, 2) if jets and jets['gccShare'] is not None else None,
            },
            'summer': {k: v for k, v in (('jets', jets), ('yachts', boats), ('notes', notes or None)) if v},
        })
    (OUT / 'cities.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
    for c in out:
        v = c['values']
        print(f"{c['name']:<22} jets {v['jets_summer']!s:>6}  uplift {v['jets_uplift']!s:>5}  yachts {v['yacht_summer']!s:>7}  y-uplift {v['yacht_uplift']!s:>5}")


if __name__ == '__main__':
    main()
