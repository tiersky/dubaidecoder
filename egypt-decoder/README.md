# Egypt Decoder

Market-intelligence dashboard for the Egypt Tourism Agency: 25 source markets
scored on a 9-metric weighted model that allocates an AED 10M budget.

Built from `egypt/Egypt_decoder.xlsx` (sheet "Model") and
`egypt/egypt_flights.xlsx` (Aviationstack daily flight seating capacity).
With default weights the app reproduces the workbook's Weighted Score,
% Split, and Budget Split exactly.

## Model

Each metric is normalised to a 0–1 index via `NORM.DIST(raw, avg, stdev, TRUE)`
across the 25 markets (media cost inverted — cheaper media scores higher).
Weighted score = Σ(weight × index); budget share = score ÷ total score.

| Metric | Default weight | Source |
| --- | --- | --- |
| Audience Ratio / Pop. | 10 | GWI |
| 2025 Visitors | 10 | Brief |
| YoY Visitor Growth | 0 | Brief |
| Departures to 2025 Visitors Ratio | 5 | Statbase |
| Outbound Trip Spends (USD B) | 5 | Statista |
| Media Cost Benchmark CPM | 5 | Magna Global |
| GDP per Capita | 5 | IMF |
| Daily Flight Seating Capacity | 0 | Aviationstack |
| Market Tier | 20 | Brief |

YoY growth and flight seats are indexed but unweighted by default; both can be
dialled up in the Model Weights panel.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
