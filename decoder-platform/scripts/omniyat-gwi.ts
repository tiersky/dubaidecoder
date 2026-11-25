import type { GwiConfig } from '../lib/gwi/types';

// GWI audience for the Omniyat summer decoder. GWI doesn't identify
// ultra-high-net-worth individuals (its HNW flag ended in 2019), so the
// closest survey proxy is used and named plainly: people in the top global
// purchasing-power segment who also hold high savings and investments.

const AFFLUENT = { question: 'i7', datapoints: ['i7_1'] };
const HIGH_SAVINGS = { question: 'i5', datapoints: ['i5_3'] };
const PROPERTY = { question: 'q3d', datapoints: ['q3d_3'] };

export const OMNIYAT_GWI: GwiConfig = {
  waves: ['q4_2025', 'q1_2026', 'q2_2026', 'q3_2026'],
  audiences: [
    {
      key: 'affluent-investors',
      name: 'Affluent investors',
      description: 'People in the top global purchasing-power segment with high savings and investments, GWI’s closest proxy for high-net-worth audiences.',
      expression: { and: [AFFLUENT, HIGH_SAVINGS] },
    },
    {
      key: 'property-investors',
      name: 'Affluent property investors',
      description: 'Affluent investors who hold real estate beyond their own home.',
      expression: { and: [AFFLUENT, HIGH_SAVINGS, PROPERTY] },
    },
  ],
  primaryAudience: 'affluent-investors',
  // Source markets for Dubai luxury property, shown for comparison.
  reference: ['ae', 'sa'],
  panels: [
    {
      key: 'vacation-types',
      title: 'Holidays they enjoy',
      question: 'q32203',
      audience: 'affluent-investors',
      datapoints: [
        { code: 'q32203_4', label: 'Beach / resort' },
        { code: 'q32203_42330', label: 'City break' },
        { code: 'q32203_5', label: 'Cruise' },
        { code: 'q32203_7', label: 'Spa / retreat' },
        { code: 'q32203_10', label: 'Winter sports' },
        { code: 'q32203_1', label: 'Action / adventure' },
      ],
    },
    {
      key: 'investments',
      title: 'What they invest in',
      question: 'q3d',
      audience: 'affluent-investors',
      datapoints: [
        { code: 'q3d_3', label: 'Investment property' },
        { code: 'q3d_2', label: 'Stocks / shares' },
        { code: 'q3d_11', label: 'Managed funds' },
        { code: 'q3d_5', label: 'Gold' },
        { code: 'q3d_4', label: 'Art / antiques' },
        { code: 'q3d_12', label: 'Cryptocurrency' },
      ],
    },
    {
      key: 'interests',
      title: 'What they’re into',
      question: 'q3181',
      audience: 'affluent-investors',
      datapoints: [
        { code: 'q3181_35', label: 'Travel' },
        { code: 'q3181_24', label: 'Eating out' },
        { code: 'q3181_19', label: 'Fashion' },
        { code: 'q3181_50', label: 'Investments' },
        { code: 'q3181_10', label: 'Fine art' },
        { code: 'q3181_7', label: 'Cars / motoring' },
      ],
    },
    {
      key: 'travel-drivers',
      title: 'What decides where they holiday',
      question: 'q1206',
      audience: 'affluent-investors',
      datapoints: [
        { code: 'q1206_12', label: 'Relaxing experience' },
        { code: 'q1206_21', label: 'Weather / season' },
        { code: 'q1206_17', label: 'Cultural experience' },
        { code: 'q1206_423102', label: 'Local food & drink' },
        { code: 'q1206_1', label: 'Once-in-a-lifetime' },
        { code: 'q1206_4', label: 'Knowing the place' },
      ],
    },
    {
      key: 'considering',
      title: 'Considering for a holiday (next 12 months)',
      question: 'gwi-travel.q4425',
      audience: 'affluent-investors',
      datapoints: [
        { code: 'q4425_40', label: 'Dubai / UAE', home: 'ae' },
        { code: 'q4425_1235', label: 'Maldives' },
        { code: 'q4425_20', label: 'Italy', home: 'it' },
        { code: 'q4425_18', label: 'Greece', home: 'gr' },
        { code: 'q4425_16', label: 'France', home: 'fr' },
        { code: 'q4425_24', label: 'Spain', home: 'es' },
      ],
    },
  ],
};
