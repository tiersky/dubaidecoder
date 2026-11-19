/**
 * Hofstede's six cultural dimensions, from the public dimension data matrix
 * (geerthofstede.com, "6-dimensions-for-website-2015-08-16"). Internal test
 * use only: the publisher allows research use without asking, but commercial
 * use needs their permission.
 *
 * Scores are 0–100ish relative positions, static since 2015. Rows whose
 * source code had no ISO country (sub-national splits such as "Belgium
 * French", and the "Africa East/West" regions) are left out.
 */

export const DIMENSIONS = [
  {
    key: 'pdi',
    label: 'Power distance',
    short: 'Power',
    low: 'Flat, egalitarian',
    high: 'Hierarchical',
    about: 'How far people accept that power is distributed unequally.',
  },
  {
    key: 'idv',
    label: 'Individualism',
    short: 'Individual',
    low: 'Group-first',
    high: 'Self-first',
    about: 'Whether people define themselves as "I" or as part of a "we".',
  },
  {
    key: 'mas',
    label: 'Achievement drive',
    short: 'Achieve',
    low: 'Consensus, caring',
    high: 'Competitive, success-led',
    about: 'Hofstede’s masculinity index: competition and success versus caring and quality of life.',
  },
  {
    key: 'uai',
    label: 'Uncertainty avoidance',
    short: 'Certainty',
    low: 'Comfortable with ambiguity',
    high: 'Needs rules and reassurance',
    about: 'How threatened people feel by ambiguous or unknown situations.',
  },
  {
    key: 'lto',
    label: 'Long-term orientation',
    short: 'Long-term',
    low: 'Tradition, quick results',
    high: 'Pragmatic, future-focused',
    about: 'Focus on future rewards and adaptation versus tradition and the present.',
  },
  {
    key: 'ivr',
    label: 'Indulgence',
    short: 'Indulgence',
    low: 'Restrained',
    high: 'Free to enjoy life',
    about: 'How freely people act on desires for leisure, fun and spending.',
  },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];
export type Scores = Record<DimensionKey, number>;

type Row = { name: string; values: Array<number | null> };

/** The source's regional row, used where an Arab market has no own score. */
const ARAB_REGION: Array<number | null> = [80, 38, 53, 68, 23, 34];
const ARAB_MARKETS = new Set(['ae', 'sa', 'kw', 'qa', 'bh', 'om', 'eg', 'jo', 'iq', 'lb', 'ly', 'sy', 'ye']);

const ROWS: Record<string, Row> = {
  al: { name: "Albania", values: [null, null, null, null, 61, 15] },
  dz: { name: "Algeria", values: [null, null, null, null, 26, 32] },
  ad: { name: "Andorra", values: [null, null, null, null, null, 65] },
  ar: { name: "Argentina", values: [49, 46, 56, 86, 20, 62] },
  am: { name: "Armenia", values: [null, null, null, null, 61, null] },
  au: { name: "Australia", values: [38, 90, 61, 51, 21, 71] },
  at: { name: "Austria", values: [11, 55, 79, 70, 60, 63] },
  az: { name: "Azerbaijan", values: [null, null, null, null, 61, 22] },
  bd: { name: "Bangladesh", values: [80, 20, 55, 60, 47, 20] },
  by: { name: "Belarus", values: [null, null, null, null, 81, 15] },
  be: { name: "Belgium", values: [65, 75, 54, 94, 82, 57] },
  ba: { name: "Bosnia and Herzegovina", values: [null, null, null, null, 70, 44] },
  br: { name: "Brazil", values: [69, 38, 49, 76, 44, 59] },
  bg: { name: "Bulgaria", values: [70, 30, 40, 85, 69, 16] },
  bf: { name: "Burkina Faso", values: [null, null, null, null, 27, 18] },
  ca: { name: "Canada", values: [39, 80, 52, 48, 36, 68] },
  cl: { name: "Chile", values: [63, 23, 28, 86, 31, 68] },
  cn: { name: "China", values: [80, 20, 66, 30, 87, 24] },
  co: { name: "Colombia", values: [67, 13, 64, 80, 13, 83] },
  cr: { name: "Costa Rica", values: [35, 15, 21, 86, null, null] },
  hr: { name: "Croatia", values: [73, 33, 40, 80, 58, 33] },
  cy: { name: "Cyprus", values: [null, null, null, null, null, 70] },
  cz: { name: "Czechia", values: [57, 58, 57, 74, 70, 29] },
  dk: { name: "Denmark", values: [18, 74, 16, 23, 35, 70] },
  do: { name: "Dominican Republic", values: [null, null, null, null, 13, 54] },
  ec: { name: "Ecuador", values: [78, 8, 63, 67, null, null] },
  eg: { name: "Egypt", values: [null, null, null, null, 7, 4] },
  et: { name: "Ethiopia", values: [null, null, null, null, null, 46] },
  sv: { name: "El Salvador", values: [66, 19, 40, 94, 20, 89] },
  ee: { name: "Estonia", values: [40, 60, 30, 60, 82, 16] },
  fi: { name: "Finland", values: [33, 63, 26, 59, 38, 57] },
  fr: { name: "France", values: [68, 71, 43, 86, 63, 48] },
  ge: { name: "Georgia", values: [null, null, null, null, 38, 32] },
  de: { name: "Germany", values: [35, 67, 66, 65, 83, 40] },
  gh: { name: "Ghana", values: [null, null, null, null, 4, 72] },
  gb: { name: "United Kingdom", values: [35, 89, 66, 35, 51, 69] },
  gr: { name: "Greece", values: [60, 35, 57, 112, 45, 50] },
  gt: { name: "Guatemala", values: [95, 6, 37, 101, null, null] },
  hk: { name: "Hong Kong", values: [68, 25, 57, 29, 61, 17] },
  hu: { name: "Hungary", values: [46, 80, 88, 82, 58, 31] },
  is: { name: "Iceland", values: [null, null, null, null, 28, 67] },
  in: { name: "India", values: [77, 48, 56, 40, 51, 26] },
  id: { name: "Indonesia", values: [78, 14, 46, 48, 62, 38] },
  ir: { name: "Iran", values: [58, 41, 43, 59, 14, 40] },
  iq: { name: "Iraq", values: [null, null, null, null, 25, 17] },
  ie: { name: "Ireland", values: [28, 70, 68, 35, 24, 65] },
  il: { name: "Israel", values: [13, 54, 47, 81, 38, null] },
  it: { name: "Italy", values: [50, 76, 70, 75, 61, 30] },
  jm: { name: "Jamaica", values: [45, 39, 68, 13, null, null] },
  jp: { name: "Japan", values: [54, 46, 95, 92, 88, 42] },
  jo: { name: "Jordan", values: [null, null, null, null, 16, 43] },
  kr: { name: "South Korea", values: [60, 18, 39, 85, 100, 29] },
  kg: { name: "Kyrgyzstan", values: [null, null, null, null, 66, 39] },
  lv: { name: "Latvia", values: [44, 70, 9, 63, 69, 13] },
  lt: { name: "Lithuania", values: [42, 60, 19, 65, 82, 16] },
  lu: { name: "Luxembourg", values: [40, 60, 50, 70, 64, 56] },
  mk: { name: "North Macedonia", values: [null, null, null, null, 62, 35] },
  my: { name: "Malaysia", values: [104, 26, 50, 36, 41, 57] },
  ml: { name: "Mali", values: [null, null, null, null, 20, 43] },
  mt: { name: "Malta", values: [56, 59, 47, 96, 47, 66] },
  mx: { name: "Mexico", values: [81, 30, 69, 82, 24, 97] },
  md: { name: "Moldova", values: [null, null, null, null, 71, 19] },
  me: { name: "Montenegro", values: [null, null, null, null, 75, 20] },
  ma: { name: "Morocco", values: [70, 46, 53, 68, 14, 25] },
  nl: { name: "Netherlands", values: [38, 80, 14, 53, 67, 68] },
  nz: { name: "New Zealand", values: [22, 79, 58, 49, 33, 75] },
  ng: { name: "Nigeria", values: [null, null, null, null, 13, 84] },
  no: { name: "Norway", values: [31, 69, 8, 50, 35, 55] },
  pk: { name: "Pakistan", values: [55, 14, 50, 70, 50, 0] },
  pa: { name: "Panama", values: [95, 11, 44, 86, null, null] },
  pe: { name: "Peru", values: [64, 16, 42, 87, 25, 46] },
  ph: { name: "Philippines", values: [94, 32, 64, 44, 27, 42] },
  pl: { name: "Poland", values: [68, 60, 64, 93, 38, 29] },
  pt: { name: "Portugal", values: [63, 27, 31, 104, 28, 33] },
  pr: { name: "Puerto Rico", values: [null, null, null, null, 0, 90] },
  ro: { name: "Romania", values: [90, 30, 42, 90, 52, 20] },
  ru: { name: "Russia", values: [93, 39, 36, 95, 81, 20] },
  rw: { name: "Rwanda", values: [null, null, null, null, 18, 37] },
  sa: { name: "Saudi Arabia", values: [null, null, null, null, 36, 52] },
  rs: { name: "Serbia", values: [86, 25, 43, 92, 52, 28] },
  sg: { name: "Singapore", values: [74, 20, 48, 8, 72, 46] },
  sk: { name: "Slovakia", values: [104, 52, 110, 51, 77, 28] },
  si: { name: "Slovenia", values: [71, 27, 19, 88, 49, 48] },
  za: { name: "South Africa", values: [null, null, null, null, 34, 63] },
  es: { name: "Spain", values: [57, 51, 42, 86, 48, 44] },
  sr: { name: "Suriname", values: [85, 47, 37, 92, null, null] },
  se: { name: "Sweden", values: [31, 71, 5, 29, 53, 78] },
  ch: { name: "Switzerland", values: [34, 68, 70, 58, 74, 66] },
  tw: { name: "Taiwan", values: [58, 17, 45, 69, 93, 49] },
  tz: { name: "Tanzania", values: [null, null, null, null, 34, 38] },
  th: { name: "Thailand", values: [64, 20, 34, 64, 32, 45] },
  tt: { name: "Trinidad and Tobago", values: [47, 16, 58, 55, 13, 80] },
  tr: { name: "Turkey", values: [66, 37, 45, 85, 46, 49] },
  us: { name: "United States", values: [40, 91, 62, 46, 26, 68] },
  ug: { name: "Uganda", values: [null, null, null, null, 24, 52] },
  ua: { name: "Ukraine", values: [null, null, null, null, 86, 14] },
  uy: { name: "Uruguay", values: [61, 36, 38, 100, 26, 53] },
  ve: { name: "Venezuela", values: [81, 12, 73, 76, 16, 100] },
  vn: { name: "Vietnam", values: [70, 20, 40, 30, 57, 35] },
  zm: { name: "Zambia", values: [null, null, null, null, 30, 42] },
  zw: { name: "Zimbabwe", values: [null, null, null, null, 15, 28] },
};

export interface CultureProfile {
  iso2: string;
  name: string;
  scores: Scores;
  /** Dimensions whose value comes from the "Arab countries" regional row. */
  regional: DimensionKey[];
}

/**
 * The six-dimension profile for a market, or null when Hofstede has fewer
 * than six scores for it even after the regional fallback.
 */
export function cultureProfile(iso2: string | null | undefined): CultureProfile | null {
  if (!iso2) return null;
  const key = iso2.toLowerCase();
  const row = ROWS[key];
  const fallback = ARAB_MARKETS.has(key) ? ARAB_REGION : null;
  if (!row && !fallback) return null;

  const scores = {} as Scores;
  const regional: DimensionKey[] = [];
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const own = row?.values[i] ?? null;
    const value = own ?? fallback?.[i] ?? null;
    if (value === null) return null;
    if (own === null) regional.push(DIMENSIONS[i].key);
    scores[DIMENSIONS[i].key] = value;
  }
  return { iso2: key, name: row?.name ?? key.toUpperCase(), scores, regional };
}

/** Every country with a full six-dimension profile (own scores only). */
export function allProfiles(): CultureProfile[] {
  return Object.keys(ROWS)
    .map((iso2) => cultureProfile(iso2))
    .filter((p): p is CultureProfile => p !== null && p.regional.length === 0);
}

/**
 * Weighted Euclidean distance between a profile and a target, mapped to a
 * 0–100 fit (100 = identical). Weights of 0 drop a dimension; all-zero
 * weights give no ranking signal, so every fit is 100.
 */
export function fitScore(scores: Scores, target: Scores, weights: Record<DimensionKey, number>): number {
  let sum = 0;
  let total = 0;
  for (const { key } of DIMENSIONS) {
    const w = Math.max(0, weights[key] ?? 0);
    const d = (scores[key] - target[key]) / 100;
    sum += w * d * d;
    total += w;
  }
  if (total === 0) return 100;
  return Math.max(0, 100 * (1 - Math.sqrt(sum / total)));
}
