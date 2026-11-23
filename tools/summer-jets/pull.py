"""
Pull OpenSky arrivals for the Omniyat summer-destination study.

Fortnightly Fri–Sat samples across summer 2025 (Jun–Sep) plus three
off-season Fri–Sat samples, for 23 destination airports. Each request is
one airport x one 2-day window (OpenSky's maximum; it costs 30 of the
4,000 daily credits whatever the length), cached to raw/ so the run can
stop and resume. When credits run out it sleeps until OpenSky says to
retry, then carries on.

Credentials: the OpenSky API client JSON line ({"clientId": ..., "clientSecret": ...})
in the repo-root .env.local.

Usage: python3 -I tools/summer-jets/pull.py
"""
import calendar
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ENV = HERE.parent.parent / '.env.local'
RAW = HERE / 'raw'
TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
API = 'https://opensky-network.org/api/flights/arrival'

AIRPORTS = {
    # Côte d'Azur & Monaco
    'LFMN': 'Nice', 'LFMD': 'Cannes-Mandelieu', 'LFTH': 'Toulon-Hyères (Saint-Tropez)', 'LFTZ': 'La Môle (Saint-Tropez)',
    # Italy
    'LIEO': 'Olbia (Costa Smeralda)', 'LIML': 'Milan Linate (Lake Como)', 'LIRN': 'Naples (Capri/Amalfi)', 'LIPZ': 'Venice',
    # Spain
    'LEMG': 'Málaga (Marbella)', 'LEIB': 'Ibiza', 'LEPA': 'Palma (Mallorca)',
    # Greece & Turkey
    'LGMK': 'Mykonos', 'LGSR': 'Santorini', 'LGAV': 'Athens', 'LTFE': 'Bodrum-Milas',
    # Adriatic
    'LDDU': 'Dubrovnik', 'LDSP': 'Split',
    # Switzerland & UK
    'LSGG': 'Geneva', 'EGLF': 'London Farnborough', 'EGGW': 'London Luton',
    # US
    'KHTO': 'East Hampton (Hamptons)', 'KACK': 'Nantucket', 'KOPF': 'Miami Opa-locka',
}

SUMMER = [dt.date(2025, 6, 6) + dt.timedelta(days=14 * i) for i in range(9)]  # Fridays, 6 Jun → 26 Sep
OFF = [dt.date(2024, 11, 15), dt.date(2025, 2, 14), dt.date(2025, 4, 11)]      # Fridays
WINDOWS = [('summer', d) for d in SUMMER] + [('off', d) for d in OFF]
assert all(d.weekday() == 4 for _, d in WINDOWS), 'every sample must start on a Friday'


def credentials():
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if line.startswith('{') and 'clientId' in line:
            return json.loads(line)
    raise SystemExit(f'No OpenSky client JSON line in {ENV}')


class Client:
    def __init__(self):
        self.creds = credentials()
        self.token, self.expires = None, 0.0

    def _refresh(self):
        body = urllib.parse.urlencode({
            'grant_type': 'client_credentials',
            'client_id': self.creds['clientId'],
            'client_secret': self.creds['clientSecret'],
        }).encode()
        tok = json.load(urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body), timeout=30))
        self.token, self.expires = tok['access_token'], time.time() + tok.get('expires_in', 1800) - 120

    def arrivals(self, icao, day):
        """Returns (flights, credits_left). Sleeps through rate limits; retries transient errors."""
        begin = calendar.timegm(day.timetuple())
        end = begin + 2 * 86400 - 1  # Fri 00:00 → Sat 23:59:59 UTC, exactly two partitions
        url = f'{API}?airport={icao}&begin={begin}&end={end}'
        for attempt in range(8):
            if time.time() > self.expires:
                self._refresh()
            req = urllib.request.Request(url, headers={'Authorization': f'Bearer {self.token}'})
            try:
                r = urllib.request.urlopen(req, timeout=120)
                return json.load(r), r.headers.get('X-Rate-Limit-Remaining')
            except urllib.error.HTTPError as e:
                if e.code == 404:  # OpenSky answers 404 when there are no flights
                    return [], e.headers.get('X-Rate-Limit-Remaining')
                if e.code == 401:
                    self.expires = 0
                    continue
                if e.code == 429:
                    wait = int(e.headers.get('X-Rate-Limit-Retry-After-Seconds') or 3600)
                    print(f'  credits exhausted; sleeping {wait // 60} min until reset', flush=True)
                    time.sleep(wait + 30)
                    continue
                print(f'  HTTP {e.code} on {icao} {day}; retry {attempt + 1}', flush=True)
            except (urllib.error.URLError, TimeoutError) as e:
                print(f'  network error on {icao} {day}: {e}; retry {attempt + 1}', flush=True)
            time.sleep(min(300, 15 * 2 ** attempt))
        raise SystemExit(f'Giving up on {icao} {day}')


def main():
    RAW.mkdir(exist_ok=True)
    client = Client()
    todo = [(icao, kind, day) for kind, day in WINDOWS for icao in AIRPORTS]
    done = 0
    for icao, kind, day in todo:
        out = RAW / f'{icao}_{day.isoformat()}.json'
        if out.exists():
            done += 1
            continue
        flights, left = client.arrivals(icao, day)
        out.write_text(json.dumps({'airport': icao, 'kind': kind, 'start': day.isoformat(), 'flights': flights}))
        done += 1
        print(f'{done}/{len(todo)} {icao} {day} {kind}: {len(flights)} arrivals (credits left {left})', flush=True)
    print('ALL DONE', flush=True)


if __name__ == '__main__':
    main()
