// Country geo dictionary: name + ISO2 + lat/lng, merged from the five sibling
// decoder apps' data/countries.ts files. Deduped by ISO2 — first occurrence
// wins, with the apps read in this order: egypt-decoder, alula-decoder,
// country-decoder, jumeirah-decoder, dhre-decoder. No coordinates were
// invented; every entry traces back to one of those five files.
export interface CountryGeo {
  name: string;
  iso2: string;
  lat: number;
  lng: number;
}

export const countries: CountryGeo[] = [
  // --- from egypt-decoder/data/countries.ts (25) ---
  { name: 'Russia', iso2: 'ru', lat: 61.524, lng: 105.3188 },
  { name: 'Germany', iso2: 'de', lat: 51.1657, lng: 10.4515 },
  { name: 'Saudi Arabia', iso2: 'sa', lat: 23.8859, lng: 45.0792 },
  { name: 'Poland', iso2: 'pl', lat: 51.9194, lng: 19.1451 },
  { name: 'Italy', iso2: 'it', lat: 41.8719, lng: 12.5674 },
  { name: 'UK', iso2: 'gb', lat: 55.3781, lng: -3.436 },
  { name: 'USA', iso2: 'us', lat: 37.0902, lng: -95.7129 },
  { name: 'France', iso2: 'fr', lat: 46.2276, lng: 2.2137 },
  { name: 'Czech Republic', iso2: 'cz', lat: 49.8175, lng: 15.473 },
  { name: 'China', iso2: 'cn', lat: 35.8617, lng: 104.1954 },
  { name: 'Netherlands', iso2: 'nl', lat: 52.1326, lng: 5.2913 },
  { name: 'Turkey', iso2: 'tr', lat: 38.9637, lng: 35.2433 },
  { name: 'Romania', iso2: 'ro', lat: 45.9432, lng: 24.9668 },
  { name: 'Jordan', iso2: 'jo', lat: 30.5852, lng: 36.2384 },
  { name: 'Kazakhstan', iso2: 'kz', lat: 48.0196, lng: 66.9237 },
  { name: 'Kuwait', iso2: 'kw', lat: 29.3117, lng: 47.4818 },
  { name: 'Spain', iso2: 'es', lat: 40.4637, lng: -3.7492 },
  { name: 'Austria', iso2: 'at', lat: 47.5162, lng: 14.5501 },
  { name: 'Belgium', iso2: 'be', lat: 50.5039, lng: 4.4699 },
  { name: 'Switzerland', iso2: 'ch', lat: 46.8182, lng: 8.2275 },
  { name: 'India', iso2: 'in', lat: 20.5937, lng: 78.9629 },
  { name: 'Slovakia', iso2: 'sk', lat: 48.669, lng: 19.699 },
  { name: 'Belarus', iso2: 'by', lat: 53.7098, lng: 27.9534 },
  { name: 'Canada', iso2: 'ca', lat: 56.1304, lng: -106.3468 },
  { name: 'Japan', iso2: 'jp', lat: 36.2048, lng: 138.2529 },

  // --- new from alula-decoder/data/countries.ts (GCC) ---
  { name: 'UAE', iso2: 'ae', lat: 23.4241, lng: 53.8478 },
  { name: 'Bahrain', iso2: 'bh', lat: 26.0667, lng: 50.5577 },
  { name: 'Oman', iso2: 'om', lat: 21.4735, lng: 55.9754 },
  { name: 'Qatar', iso2: 'qa', lat: 25.3548, lng: 51.1839 },

  // --- country-decoder/data/countries.ts contributed no new ISO2s ---

  // --- new from jumeirah-decoder/data/countries.ts ---
  { name: 'Australia', iso2: 'au', lat: -25.2744, lng: 133.7751 },
  { name: 'South Africa', iso2: 'za', lat: -30.5595, lng: 22.9375 },
  { name: 'Hungary', iso2: 'hu', lat: 47.1625, lng: 19.5033 },
  { name: 'Egypt', iso2: 'eg', lat: 26.8206, lng: 30.8025 },

  // --- new from dhre-decoder/data/countries.ts ---
  { name: 'Sweden', iso2: 'se', lat: 60.1282, lng: 18.6435 },
  { name: 'Singapore', iso2: 'sg', lat: 1.3521, lng: 103.8198 },
  { name: 'New Zealand', iso2: 'nz', lat: -40.9006, lng: 174.886 },
  { name: 'Norway', iso2: 'no', lat: 60.472, lng: 8.4689 },
  { name: 'Indonesia', iso2: 'id', lat: -0.7893, lng: 113.9213 },
  { name: 'Luxembourg', iso2: 'lu', lat: 49.8153, lng: 6.1296 },
  { name: 'Ireland', iso2: 'ie', lat: 53.1424, lng: -7.6921 },
  { name: 'Denmark', iso2: 'dk', lat: 56.2639, lng: 9.5018 },
];

// Alias map for spellings seen in real workbooks. Keys are normalized:
// trimmed, lowercased, internal whitespace collapsed.
export const aliases: Record<string, string> = {
  'uk': 'gb', 'united kingdom': 'gb', 'great britain': 'gb',
  'usa': 'us', 'united states': 'us', 'united states of america': 'us',
  'uae': 'ae', 'united arab emirates': 'ae',
  'khazakhstan': 'kz', // spelling used in the Egypt/AlUla workbooks
  'türkiye': 'tr', 'turkiye': 'tr', 'turkey': 'tr',
  'czechia': 'cz', 'czech republic': 'cz',
  'south korea': 'kr', 'korea': 'kr', 'republic of korea': 'kr',
  'russia': 'ru', 'russian federation': 'ru',
  'ksa': 'sa', 'saudi': 'sa', 'saudi arabia': 'sa',
};
