# Decoder Platform: Guided Decoder Builder + AI Market Recommender (Plan 7)

> Builds on Plan 6 (`2026-11-19-decoder-platform-market-recommender.md`), whose allocation engine is done (`bef8195`).
> This plan **supersedes Plan 6 phases 5–9**: the recommender now lives inside a guided admin builder.
> GWI and Aviationstack (Plan 6 phases 3–4) stay for later. Until then, their metrics are entered by hand.

## What the user asked for (2026-11-19)

1. **Admin creates a decoder in a guided flow:**
   - Enter the countries they already have in mind.
   - Write the brief: industry, objective, what is being marketed.
   - **Claude Opus 5.5** suggests more countries that fit, using all the public metrics, and explains why.
   - The admin includes or excludes each suggestion.
2. **The admin chooses which metrics drive the allocation** and enters the ones no API provides yet: GWI audience, CPM, visitors, flights, custom fields.
3. **The live app shows the suggested countries:** included ones as normal markets marked "Suggested by AI", and the rest as suggestions with their reasons.
4. **The allocation section explains itself:** tooltips say what each number is and how accurate it is.
5. **Existing decoders are experimental,** so they move to the new model too; Excel parity isn't required.

## Decisions taken

| # | Decision | Why |
|---|---|---|
| D1 | Recommendation is **two-stage**. A deterministic lookalike ranking over ~190 countries shortlists 40 candidates with their data. Opus then picks and explains, **only from that shortlist**. | Opus can't invent a country or a number: every figure it cites is in the table it was given, and its picks are checked against the shortlist. |
| D2 | Opus 5.5 (`claude-opus-5-5`) for recommendations only, with streaming, structured JSON output and `effort: high`. Everything else stays on Sonnet 5.5. | The user asked for Opus here, and earlier asked for a cheaper model elsewhere. |
| D3 | If Opus fails, the wizard still shows the lookalike shortlist, labelled "AI unavailable". | The builder never dead-ends. |
| D4 | Wizard state lives in the browser (localStorage) until **Save draft**. Then a normal `version_drafts` row is written with `workbook_path = ''`. | No database migration. Publishing reuses the existing flow, which skips the workbook copy when there is no workbook. |
| D5 | Public metrics the admin selects are auto-filled with source and year, and stay editable. GWI, Aviationstack and custom metrics are typed in. | "Ask users to input those fields" for what the APIs don't cover yet. |
| D6 | The model is **optimised** when audience (GWI ratio or size) and CPM are selected; otherwise **score**. Existing decoders without a model setting run **score**, with metric settings proposed automatically and Market Tier converted to priority with a fitted γ. | Item 5 above. |
| D7 | Population for audience = ratio × population is **snapshotted into the config** at save (`planning.population`), with its year. | The live dashboard needs no extra fetch, and the numbers stay reproducible. |
| D8 | Tourism spend and departures (World Bank) are **dropped**: for 138 of 237 countries the latest value is 2020. | Stale and COVID-distorted. |
| D9 | IMF all-countries data is 2.96 MB, over the 2 MB fetch cache, and its time filter doesn't work. The processed universe is cached in server memory for 24 h instead. | Measured on 2026-11-19. |

## Architecture

```
lib/recommend/universe.ts   server: every country (name, iso2, centroid from world-atlas geometry),
                            public facts (IMF, World Bank, OWID), Hofstede, distance to destination. Cached 24 h.
lib/recommend/lookalike.ts  pure: robust-z features, profile of the seed countries, fit 0–100,
                            closest seed, matching features and gaps. Tested with property tests.
lib/ai/recommend.ts         pure prompt and parser for Opus; shortlist-only validation.
lib/ai/claude.ts            + callClaudeStructured(): Opus, streaming, json_schema output.
app/admin/api/universe      GET  (admin): countries and facts for the picker and prefill.
app/admin/api/recommend     POST (admin): lookalike shortlist, then Opus picks. maxDuration 300.
lib/builder/catalog.ts      metric catalogue: public auto metrics, manual (GWI, CPM, visitors, flights), custom.
lib/builder/build.ts        pure: wizard state → VersionConfig (and back, for editing). Tested.
app/admin/new, app/admin/[slug]/build   six-step wizard (client), shared component.
app/admin/actions.ts        + saveGuidedDraftAction, publishGuidedDraftAction.
Live app                    Suggested markets card on the overview; AI badge on suggested markets;
                            Budget tab: model explainer, column tooltips, likely ranges (Monte Carlo),
                            and "where the next 100k goes".
```

**Config additions** (all optional):
- `MetricDef.provider`: `'public:<factKey>' | 'distance' | 'manual'`.
- `MarketRow.origin`: `'seed' | 'recommended'`.
- `VersionContext`: `objective` and `destination` (`{ iso2, name, lat, lng }`).
- `VersionConfig.recommendations`: `{ generatedAt, model, summary, items: [{ iso2, name, fit, headline, reasons[], risks[], status }] }`.
- `planning.population`: `{ values, year }`.

## Wizard steps

1. **Basics and countries:** name, slug, currency, budget, and the starting countries (searchable picker over about 190 countries).
2. **Brief:** destination, industry, objective (awareness, consideration, bookings, investment leads, or other), and the brief text.
3. **Suggestions:**
   - "Suggest countries" runs the lookalike shortlist, then Opus.
   - Results appear as cards: fit, headline, reasons, risks and key data.
   - Include or exclude each on demand.
   - Also shows notes on the starting countries.
4. **Metrics:**
   - Pick from the catalogue, set a weight (0–10) and a direction.
   - Requirements are shown: optimised mode needs audience and CPM.
   - Admins can add custom metrics.
5. **Data:**
   - A grid of markets × metrics. Public values are prefilled with source and year, and can be overridden.
   - Manual values are required.
   - Each market gets a media-expertise priority (0.5×–2×) with a reason.
6. **Review:** a live allocation preview using the same engine and tooltips as the dashboard, any warnings, then **Save draft** or **Publish**.

Edit mode (`/admin/[slug]/build`) opens a guided draft or any published version in the same wizard, including Excel-based ones. That is how suggestions get added to existing decoders.

## Tooltip copy (what each number is and how accurate it is)

- **Budget:** the model's recommended spend. Exact for the inputs given; the likely range shows how much it moves when inputs are uncertain.
- **Likely range:** the 10th–90th percentile over 400 simulated draws. Each draw varies inputs by their source's reliability (public data ±5%, typed estimates ±15%, regional proxies ±25%), weights by ±10% and effective frequency between 2 and 4.
- **Quality:** how the market compares with the other markets in the list on the selected metrics, from 0 to 1. Robust to outliers; a blank lowers confidence and never adds points.
- **Coverage:** the share of the metric weight that has data.
- **Priority:** the media-expertise multiplier set by a person.
- **Reach and saturation** (optimised mode): people reached at this spend, and the share of the addressable audience. Assumes about 3 impressions to really reach someone, which is a planning assumption, not fitted to results.
- **Next-dirham return:** quality-weighted people per extra unit of spend. In optimised mode it is equal across funded markets, which is the proof the split is efficient.

## Tasks (each ends green: tsc, lint, vitest, build)

- [ ] T1 Universe loader, centroids, facts, Hofstede, distance; parser tests.
- [ ] T2 Lookalike engine with property tests (seeds are never recommended, permutation invariance, closer is never ranked lower, deterministic).
- [ ] T3 Opus structured call, prompt and parser, admin routes. One live Opus run on a real brief, read-only.
- [ ] T4 Config additions, catalogue, `build.ts` round-trip tests, store support for drafts without a workbook, server actions.
- [ ] T5 Wizard UI (six steps) and admin links (New guided decoder; Resume and Build).
- [ ] T6 Live app: score-model default for existing decoders, Budget tab explainer and tooltips, likely ranges, Suggested markets card, AI badge.
- [ ] T7 Verify: full checks, signed-out smoke, wizard driven locally up to Save. **Saving a test draft writes to production Supabase, so ask the user first.** Commit with a `Verified:` line.

## Later (not in this build)

- GWI provider (Plan 6 phase 4) replaces the manual audience fields.
- Aviationstack provider (Plan 6 phase 3) replaces manual daily flights.
- Scenario saving and comparison (Plan 6 task 1.12), and viewer-side priority simulation.
