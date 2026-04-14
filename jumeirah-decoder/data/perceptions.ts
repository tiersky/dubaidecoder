import { PerceptionScore } from '@/types';

// Perception scores carried over from previous study for matching countries.
// New countries (UAE, US, Netherlands, Kazakhstan, Belgium, Australia, Austria,
// India, Turkey, Romania, South Africa, Czechia, Hungary) have no score yet.
export const perceptionScores: Record<string, PerceptionScore> = {
  'United Kingdom': { score: 77, explanation: 'Mature market seeking premium experiences and winter sun' },
  'Russia': { score: 69, explanation: 'Price-sensitive but growing interest in year-round destinations' },
  'Germany': { score: 74, explanation: 'Quality-conscious travelers seeking authentic experiences' },
  'Switzerland': { score: 79, explanation: 'Affluent market with strong luxury travel preferences' },
  'Saudi Arabia': { score: 88, explanation: 'Regional market with cultural alignment and high spending' },
  'France': { score: 75, explanation: 'Cultural affinity and established travel patterns to Middle East' },
  'Italy': { score: 71, explanation: 'Growing interest in Middle Eastern culture and hospitality' },
  'Spain': { score: 70, explanation: 'Mediterranean market interested in cultural diversity' },
  'Poland': { score: 64, explanation: 'Growing EU economy with increasing outbound travel' },
};
