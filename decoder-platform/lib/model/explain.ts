import type { AllocationModel } from '@/lib/config/types';

/** Plain-language explanations shown as tooltips wherever an allocation appears. */
export const EXPLAIN = {
  budget: {
    label: 'Budget',
    description:
      'What the model recommends spending in this market. It is exact for the inputs given; the likely range shows how much it moves when those inputs are uncertain.',
  },
  share: {
    label: 'Share',
    description: 'This market’s part of the total budget.',
  },
  range: {
    label: 'Likely range',
    description:
      'The middle 80% of outcomes (10th to 90th percentile) over 400 simulated plans. Each varies the inputs by how reliable their source is (public data ±5%, typed estimates ±15%), the metric weights by ±10% and the reach assumption between 2 and 4 impressions. A narrow range means the recommendation is robust.',
  },
  stability: {
    label: 'Rank stability',
    description: 'How often the market keeps its rank (±1 place) across the simulated plans.',
  },
  quality: {
    label: 'Quality',
    description:
      'How this market compares with the other markets in the list on the selected metrics, from 0 to 1. Uses medians, so one extreme market can’t distort the rest; a blank lowers coverage and never adds points.',
  },
  coverage: {
    label: 'Coverage',
    description: 'The share of the metric weight that has data for this market. Below 100%, the quality score is pulled towards neutral.',
  },
  priority: {
    label: 'Priority',
    description:
      'Media expertise: a person’s judgement of this market, from 0.5× (deprioritise) to 2× (favour). It multiplies the market’s value; the data-only split is shown for comparison.',
  },
  reach: {
    label: 'People reached',
    description:
      'Estimated people in the target audience reached at this spend: audience × (1 − e^(−impressions ÷ (3 × audience))). Assumes about 3 impressions to really reach someone, a planning assumption that is not yet fitted to campaign results.',
  },
  saturation: {
    label: 'Saturation',
    description: 'Share of the market’s addressable audience reached at this spend. Past about 80%, extra money mostly re-reaches the same people.',
  },
  marginal: {
    label: 'Next-unit return',
    description:
      'Quality-weighted people reached per extra unit of spend in this market. In the optimised plan it is equal across funded markets: moving money between any two of them would reach fewer valuable people.',
  },
} as const;

export function modelSummary(model: AllocationModel): { title: string; body: string; accuracy: string } {
  switch (model) {
    case 'optimised':
      return {
        title: 'Optimised for reach',
        body: 'Splits the budget to reach the most valuable people. Each market’s value per person comes from the selected metrics and its priority; its reach follows diminishing returns from its audience size and media cost. Money goes where the next unit reaches the most, until every funded market returns the same.',
        accuracy:
          'The maths is exact for the inputs. Accuracy depends on the audience and CPM figures and on the reach assumption (about 3 impressions per person), which is a planning standard, not yet fitted to this client’s results. Likely ranges show how firm each number is.',
      };
    case 'score':
      return {
        title: 'Score-weighted split',
        body: 'Gives each market a share in proportion to its quality score times its priority. Used when audience size or media cost isn’t available.',
        accuracy:
          'Shares follow the scores exactly; they don’t model diminishing returns, so very strong markets may be over-funded. Add audience and CPM to switch to the optimised plan.',
      };
    default:
      return {
        title: 'Workbook model',
        body: 'Reproduces the client workbook’s formula exactly (normal-distribution scores, weighted and split pro rata).',
        accuracy: 'Matches the spreadsheet to the cent. Known limits: blanks in “lower is better” metrics score as best, and adding or removing a market can reshuffle the others.',
      };
  }
}
