import type { FactKey } from '@/lib/insights/facts';
import type { MetricDef, MetricKind, MetricRole } from '@/lib/model/score';

export type CatalogGroup = 'Audience' | 'Media' | 'Travel' | 'Economy' | 'Society';

export interface CatalogMetric {
  id: string;
  label: string;
  group: CatalogGroup;
  about: string;
  direction: 'higher' | 'lower';
  defaultWeight: number;
  /** On by default in a new decoder. */
  recommended: boolean;
  /** 'public:<fact>' and 'distance' are filled automatically; 'manual' is typed in. */
  provider: `public:${FactKey}` | 'distance' | 'manual';
  kind: MetricKind;
  transform: 'none' | 'log';
  role?: MetricRole;
  unit: string;
  source: string;
  /** Entry is shown ×100 (e.g. 12 for 0.12) when the unit is '%' of a 0–1 ratio. */
  percentInput?: boolean;
  /** Shown under manual fields: where the number should come from. */
  entryHint?: string;
}

export const CATALOG: CatalogMetric[] = [
  {
    id: 'audienceRatio',
    label: 'Target audience share',
    group: 'Audience',
    about: 'Share of the population that is in the target audience. Comes from GWI once the integration is connected; enter it for now.',
    direction: 'higher',
    defaultWeight: 5,
    recommended: true,
    provider: 'manual',
    kind: 'ratio',
    transform: 'none',
    role: 'audienceRatio',
    unit: '%',
    source: 'GWI',
    percentInput: true,
    entryHint: 'GWI audience as % of population',
  },
  {
    id: 'audienceSize',
    label: 'Target audience size',
    group: 'Audience',
    about: 'People in the target audience. Use instead of the share when you have an absolute GWI audience size.',
    direction: 'higher',
    defaultWeight: 5,
    recommended: false,
    provider: 'manual',
    kind: 'measure',
    transform: 'log',
    role: 'audienceSize',
    unit: 'people',
    source: 'GWI',
    entryHint: 'GWI weighted audience (people)',
  },
  {
    id: 'cpm',
    label: 'Media cost (CPM)',
    group: 'Media',
    about: 'Cost per thousand impressions in this market, in the budget currency. Lower is better.',
    direction: 'lower',
    defaultWeight: 5,
    recommended: true,
    provider: 'manual',
    kind: 'measure',
    transform: 'none',
    role: 'cpm',
    unit: 'per 1,000',
    source: 'Media benchmark',
    entryHint: 'Blended CPM in the budget currency',
  },
  {
    id: 'visitors',
    label: 'Visitors to the destination',
    group: 'Travel',
    about: 'Visitors from this market to the destination in the last full year.',
    direction: 'higher',
    defaultWeight: 5,
    recommended: true,
    provider: 'manual',
    kind: 'measure',
    transform: 'log',
    unit: 'people',
    source: 'Brief',
    entryHint: 'From the client brief or tourism board',
  },
  {
    id: 'dailyFlights',
    label: 'Daily flights to the destination',
    group: 'Travel',
    about: 'Average direct flights per day from this market. Comes from Aviationstack once connected; enter it for now.',
    direction: 'higher',
    defaultWeight: 3,
    recommended: false,
    provider: 'manual',
    kind: 'measure',
    transform: 'log',
    unit: 'flights',
    source: 'Aviationstack',
    entryHint: 'Direct flights per day',
  },
  {
    id: 'distance',
    label: 'Distance to the destination',
    group: 'Travel',
    about: 'Great-circle distance from the country centre to the destination. Calculated automatically. Lower is better.',
    direction: 'lower',
    defaultWeight: 2,
    recommended: true,
    provider: 'distance',
    kind: 'measure',
    transform: 'log',
    unit: 'km',
    source: 'Calculated',
  },
  {
    id: 'gdpPppPerHead',
    label: 'GDP per head (PPP)',
    group: 'Economy',
    about: 'Income per person at purchasing-power parity (IMF). Filled automatically.',
    direction: 'higher',
    defaultWeight: 3,
    recommended: true,
    provider: 'public:gdpPppPerHead',
    kind: 'measure',
    transform: 'log',
    unit: 'intl $',
    source: 'IMF',
  },
  {
    id: 'spendPerHead',
    label: 'Household spend per head',
    group: 'Economy',
    about: 'Household consumption per person (World Bank). Filled automatically.',
    direction: 'higher',
    defaultWeight: 3,
    recommended: false,
    provider: 'public:spendPerHead',
    kind: 'measure',
    transform: 'log',
    unit: 'USD',
    source: 'World Bank',
  },
  {
    id: 'gdpGrowth',
    label: 'Real GDP growth',
    group: 'Economy',
    about: 'This year’s projected real GDP growth (IMF). Filled automatically.',
    direction: 'higher',
    defaultWeight: 1,
    recommended: false,
    provider: 'public:gdpGrowth',
    kind: 'measure',
    transform: 'none',
    unit: '%',
    source: 'IMF',
  },
  {
    id: 'population',
    label: 'Population',
    group: 'Society',
    about: 'Total population (World Bank). Filled automatically.',
    direction: 'higher',
    defaultWeight: 1,
    recommended: false,
    provider: 'public:population',
    kind: 'measure',
    transform: 'log',
    unit: 'people',
    source: 'World Bank',
  },
  {
    id: 'internet',
    label: 'Online population',
    group: 'Society',
    about: 'Share of people using the internet (World Bank). Filled automatically.',
    direction: 'higher',
    defaultWeight: 1,
    recommended: false,
    provider: 'public:internet',
    kind: 'measure',
    transform: 'none',
    unit: '%',
    source: 'World Bank',
  },
  {
    id: 'hdi',
    label: 'Human Development Index',
    group: 'Society',
    about: 'UNDP index of health, education and income, 0–1 (Our World in Data). Filled automatically.',
    direction: 'higher',
    defaultWeight: 1,
    recommended: false,
    provider: 'public:hdi',
    kind: 'ratio',
    transform: 'none',
    unit: 'index',
    source: 'UNDP',
  },
];

export const catalogById = new Map(CATALOG.map((c) => [c.id, c]));

/** A metric definition from a catalogue entry. */
export function metricFromCatalog(c: CatalogMetric, weight = c.defaultWeight): MetricDef {
  return {
    key: c.id,
    label: c.label,
    weight,
    direction: c.direction,
    source: c.source,
    description: c.about,
    kind: c.kind,
    transform: c.transform,
    provider: c.provider,
    unit: c.unit,
    ...(c.role && { role: c.role }),
  };
}

/** Optimised mode needs an audience (share or size) and a CPM metric. */
export function canOptimise(metrics: Pick<MetricDef, 'role'>[]): boolean {
  const roles = new Set(metrics.map((m) => m.role));
  return (roles.has('audienceRatio') || roles.has('audienceSize')) && roles.has('cpm');
}
