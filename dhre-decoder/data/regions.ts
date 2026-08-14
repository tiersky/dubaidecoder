import { Region } from '@/types';

export const regions: Region[] = [
  {
    name: 'Europe',
    countries: ['gb', 'fr', 'de', 'ch', 'it', 'nl', 'se', 'no', 'lu', 'dk', 'ie'],
    insight: 'Wealth density + low GDP growth = strong outbound investment. Mature economies dominate the opportunity map due to slower GDP growth and higher capital flight potential.',
  },
  {
    name: 'Asia Pacific',
    countries: ['cn', 'in', 'jp', 'sg', 'id', 'au', 'nz'],
    insight: 'Sustained volume + UHNW migration. India remains top-5 because of sheer volume of millionaires and diaspora, despite high GDP growth.',
  },
  {
    name: 'MENA',
    countries: ['kz', 'qa', 'om', 'jo', 'kw', 'sa'],
    insight: 'Proximity and regional affinity remain strong. Emerging markets like Kazakhstan stay in play but at smaller budget weights.',
  },
  {
    name: 'CIS',
    countries: ['ru'],
    insight: 'Capital seeks stability and mobility options; Dubai remains a key offshore destination.',
  },
  {
    name: 'North America',
    countries: ['us', 'ca'],
    insight: 'Moderate outbound flows due to high interest rates. Structural tax complexity reduces net investor yield for US-based buyers.',
  },
  {
    name: 'Africa',
    countries: ['za'],
    insight: 'FX uncertainty and wealth preservation drives outward flows; Dubai fits the hard-asset + lifestyle mix.',
  },
];
