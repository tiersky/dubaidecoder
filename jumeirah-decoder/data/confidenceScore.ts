// MENA-wide weekly confidence scores (Confidence Score data tables, week 6).
// Source sheet: "Overall". Same series shown for every country until per-country
// data is available.

export interface ConfidenceWeek {
  weekIndex: number;
  weekLabel: string; // e.g. "Mar 02 – Mar 08"
  social: number;
  recordedSearch: number;
  media: number;
  consolidated: number;
}

export const confidenceWeeks: ConfidenceWeek[] = [
  { weekIndex: 1, weekLabel: 'Mar 02 – Mar 08', social: 46.81, recordedSearch: 47.33, media: 45.74, consolidated: 42.45 },
  { weekIndex: 2, weekLabel: 'Mar 09 – Mar 15', social: 44.38, recordedSearch: 53.50, media: 51.76, consolidated: 45.67 },
  { weekIndex: 3, weekLabel: 'Mar 16 – Mar 22', social: 43.70, recordedSearch: 65.34, media: 66.83, consolidated: 51.57 },
  { weekIndex: 4, weekLabel: 'Mar 23 – Mar 29', social: 44.04, recordedSearch: 59.61, media: 59.26, consolidated: 49.98 },
  { weekIndex: 5, weekLabel: 'Mar 30 – Apr 05', social: 43.62, recordedSearch: 59.71, media: 47.58, consolidated: 45.41 },
  { weekIndex: 6, weekLabel: 'Apr 06 – Apr 12', social: 44.09, recordedSearch: 57.84, media: 31.05, consolidated: 40.88 },
];

export const LATEST_CONFIDENCE_SCORE =
  confidenceWeeks[confidenceWeeks.length - 1].consolidated;
