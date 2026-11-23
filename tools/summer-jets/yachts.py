"""
Yacht presence around summer destinations, from EMODnet Human Activities'
vessel density maps (pleasure craft, ship type 05; CC-BY 4.0).

The data is hours spent by AIS-tracked pleasure craft per km² per month,
on a 1 km grid. For each yachting hub we request a small box around it
through EMODnet's WCS service (no bulk download), sum the hours, and
compare summer (Jun–Sep) with the rest of the year. Year: 2023, the last
full year (2024 lost satellite AIS from June). All pleasure craft with AIS
are counted, not only superyachts, and EMODnet covers EU waters plus some
neighbours, so check non-EU sites (Bodrum) for empty boxes.

Usage: python3 -I tools/summer-jets/yachts.py
Writes raw/yachts/*.json (cache) and out/yachts.csv.
"""
import csv
import json
import math
import pathlib
import struct
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
CACHE = HERE / 'raw' / 'yachts'
OUT = HERE / 'out'
WCS = 'https://ows.emodnet-humanactivities.eu/wcs?'
YEAR = 2023
HALF_BOX_M = 10_000  # 20 x 20 km box (Web Mercator metres)

SITES = {
    'Monaco': (43.735, 7.425), 'Cannes': (43.548, 7.020), 'Antibes': (43.585, 7.128), 'Nice': (43.693, 7.285),
    'Saint-Tropez': (43.250, 6.660),
    'Porto Cervo (Costa Smeralda)': (41.135, 9.540), 'Portofino': (44.300, 9.210),
    'Capri': (40.550, 14.240), 'Amalfi Coast': (40.630, 14.490), 'Venice': (45.430, 12.350),
    'Marbella (Puerto Banús)': (36.485, -4.952), 'Ibiza': (38.910, 1.440), 'Palma (Mallorca)': (39.560, 2.630),
    'Mykonos': (37.445, 25.330), 'Santorini': (36.420, 25.430), 'Athens Riviera': (37.810, 23.770),
    'Bodrum': (37.030, 27.430), 'Yalıkavak (Bodrum)': (37.105, 27.290),
    'Dubrovnik': (42.645, 18.090), 'Hvar': (43.172, 16.442), 'Split': (43.505, 16.440),
}


def merc(lat, lng):
    return lng * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi


def read_tiff_sum(data):
    """Sum of valid cells in an uncompressed, tiled float32 GeoTIFF (what this WCS returns)."""
    e = '>' if data[:2] == b'MM' else '<'
    ifd = struct.unpack(e + 'I', data[4:8])[0]
    tags = {}
    for i in range(struct.unpack(e + 'H', data[ifd:ifd + 2])[0]):
        tag, typ, cnt, raw = struct.unpack(e + 'HHI4s', data[ifd + 2 + 12 * i: ifd + 14 + 12 * i])
        size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 12: 8}.get(typ, 4) * cnt
        blob = raw[:size] if size <= 4 else data[struct.unpack(e + 'I', raw)[0]:][:size]
        if typ == 3:
            tags[tag] = struct.unpack(e + f'{cnt}H', blob)
        elif typ == 4:
            tags[tag] = struct.unpack(e + f'{cnt}I', blob)
        elif typ == 2:
            tags[tag] = blob.rstrip(b'\0').decode()
        else:
            tags[tag] = blob
    if tags.get(259, (1,))[0] != 1 or tags.get(258, (32,))[0] != 32 or tags.get(339, (3,))[0] != 3:
        raise ValueError(f'unexpected TIFF layout: {tags.get(259)}, {tags.get(258)}, {tags.get(339)}')
    width, height = tags[256][0], tags[257][0]
    nodata = float(tags[42113]) if 42113 in tags and tags[42113] not in ('', 'nan') else None
    if 322 in tags:  # tiled
        tw, th = tags[322][0], tags[323][0]
        offsets, counts = tags[324], tags[325]
        across = math.ceil(width / tw)
        cells = []
        for t, (o, c) in enumerate(zip(offsets, counts)):
            vals = struct.unpack(e + f'{c // 4}f', data[o:o + c])
            tx, ty = (t % across) * tw, (t // across) * th
            for j in range(th):
                for i in range(tw):
                    if tx + i < width and ty + j < height:
                        cells.append(vals[j * tw + i])
    else:  # stripped
        cells = []
        for o, c in zip(tags[273], tags[279]):
            cells.extend(struct.unpack(e + f'{c // 4}f', data[o:o + c]))
    good = [v for v in cells if not math.isnan(v) and (nodata is None or v != nodata) and v > 0]
    return sum(good), len(cells)


def fetch(lat, lng, month):
    x, y = merc(lat, lng)
    q = [
        ('service', 'WCS'), ('version', '2.0.1'), ('request', 'GetCoverage'),
        ('coverageId', 'emodnet__vesseldensity_05'), ('format', 'image/tiff'),
        ('subset', f'X({x - HALF_BOX_M:.0f},{x + HALF_BOX_M:.0f})'),
        ('subset', f'Y({y - HALF_BOX_M:.0f},{y + HALF_BOX_M:.0f})'),
        ('subset', f'time("{YEAR}-{month:02d}-01T00:00:00.000Z")'),
    ]
    for attempt in range(5):
        try:
            return urllib.request.urlopen(WCS + urllib.parse.urlencode(q), timeout=120).read()
        except (urllib.error.URLError, TimeoutError) as err:
            print(f'  retry {attempt + 1}: {err}', flush=True)
            time.sleep(10 * (attempt + 1))
    raise SystemExit('EMODnet WCS unavailable')


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    rows = []
    for name, (lat, lng) in SITES.items():
        path = CACHE / f'{name.replace("/", "-")}_{YEAR}.json'
        if path.exists():
            months = json.loads(path.read_text())
        else:
            months = {}
            for m in range(1, 13):
                total, cells = read_tiff_sum(fetch(lat, lng, m))
                months[str(m)] = round(total, 1)
            path.write_text(json.dumps(months))
        summer = [months[str(m)] for m in (6, 7, 8, 9)]
        rest = [months[str(m)] for m in (1, 2, 3, 4, 5, 10, 11, 12)]
        s_mean, r_mean = sum(summer) / 4, sum(rest) / 8
        peak = max(range(1, 13), key=lambda m: months[str(m)])
        rows.append({
            'site': name, 'lat': lat, 'lng': lng,
            'summer_yacht_hours_per_month': round(s_mean),
            'off_season_yacht_hours_per_month': round(r_mean),
            'summer_uplift': round(s_mean / r_mean, 2) if r_mean else '',
            'peak_month': peak,
            **{f'm{m:02d}': months[str(m)] for m in range(1, 13)},
        })
        print(f"{name}: summer {s_mean:,.0f} h/month, uplift {rows[-1]['summer_uplift']}, peak month {peak}", flush=True)
    rows.sort(key=lambda r: -r['summer_yacht_hours_per_month'])
    with open(OUT / 'yachts.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == '__main__':
    main()
