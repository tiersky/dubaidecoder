# Decoder Platform: Allocation Model v2 + Market Recommender (Plan 6)

> **Status:** planned, not started. Waiting on the GWI API key (Aviationstack key already available).
> **For agentic workers:** work phase by phase. Each phase ends in a verified commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
1. Replace the score-proportional split with an **optimised media plan**: maximise quality-weighted reach under diminishing returns, with human market priorities ("media expertise"), hard controls, and outputs that prove the allocation (marginal returns, efficiency curve, benchmarks, uncertainty).
2. Build a market recommender that proposes new source countries by benchmarking them against the decoder's current markets. This is a planner-style flow: suggest, refine, add to plan, fill gaps, preview budget, save as draft.
3. Fill audience metrics from the **GWI Platform API** (composing and scaling audiences directly) and flight metrics from **Aviationstack** (average daily flights from source country to destination). **Every other custom metric is entered by the user.**

**Why this order:** the allocation is the client's core pain point, and the recommender feeds into it. A new market should take its budget from wherever the next dirham returns least, which only the optimiser can say. So the model comes first.

**Tech stack:**
- Next 16 App Router (`proxy.ts`), React 19, Tailwind v4, Supabase, vitest and fast-check.
- Claude API via `lib/ai/generate.ts` (Sonnet 5.5 default, Interact fallback).

---

## 1. Analysis of the current allocation model

### How it works today

The code lives in `lib/model/score.ts`, `stats.ts`, `normal.ts`, `allocate.ts` and `lib/dashboard/derive.ts`. It is a 1:1 port of the Excel workbook; parity is tested against the Egypt week-6 fixture.

1. **Cohort statistics.** For each metric, take `AVERAGE` and `STDEV.S` over the *enabled* markets, ignoring nulls.
2. **Metric index.** For each market and metric, `index = NORM.DIST(x, avg, stdev)`, or `1 − that` when lower is better. Here `x = value ?? 0`.
3. **Score.** `score = Σ weight × index`.
4. **Split.** `split = score / Σ score` over enabled markets, then `budget = split × total`.
5. **Optional override (`allocation`).** Fixed amounts come off the top first, and the remainder is shared pro rata. Markets not listed in the override get **0**.

### What's wrong with it

All measurements below come from the Egypt fixture: 15 markets, 9 metrics, weights summing to 85. The diagnostic script is `scratchpad/alloc-diag.mts`; it should be turned into a test in Phase 1.

| # | Problem | Evidence | Why it matters |
|---|---|---|---|
| 1 | **A missing value is rewarded on lower-is-better metrics.** A null becomes `x = 0`, which reads as "cheapest media" on CPM. | Czech Republic, Jordan and Kazakhstan have no CPM and each gets a CPM index of **0.986**, the best possible. Czech gets 6.85% of budget with a blank CPM vs 6.49% with a median CPM. On higher-is-better metrics the same null is a harsh penalty. | Budget depends on what is *blank*, not on the market. The workbook has the same flaw, which is why the parity test passes. |
| 2 | **Removing a market moves the yardstick, not just the money.** Reallocating the removed market's budget is correct, but every index is relative to the cohort mean and stdev, so the *quality* of the other markets changes too. | Removing Germany changes the Italy-to-Kuwait budget ratio from **1.56 to 2.73 (+75%)**. Removing Germany or China flips the rank of 2 of the 14 remaining markets. Adding one large 9M-visitor market drops Russia's visitor index from 0.988 to 0.669 and its split from 7.91% to 6.92%. | The recommender can't propose a market without silently re-ranking the existing ones. Users would see budgets move for markets they never touched. |
| 3 | **Heavy-tailed metrics are fitted with a normal curve.** Visitors, outbound spend and flight seats are right-skewed. | One giant market inflates the stdev, which squashes everyone else towards the middle (the Russia example above). | The index measures the outlier more than the market. |
| 4 | **Judgment scores saturate.** Market Tier (weight **50 of 85**) is run through `NORM.DIST` like a measurement. | Germany's tier index is ≈1.0: a contribution of 50.0 out of a 74.2 score. | The single biggest input is a 0/1 switch in practice, and a tier of 50 vs 15 vs 10 isn't treated proportionally. |
| 5 | **Splits are compressed, and how much depends on cohort size.** The largest possible \|z\| is (n−1)/√n: 2.04 at n = 6, 3.61 at n = 15, 5.10 at n = 28. Indices never reach 0 or 1. | The best market gets 12.5% and the worst 3.8%, a ratio of 3.3 against an equal share of 6.7%. | The same underlying data would give flatter or steeper budgets just because a decoder has 6 or 28 markets. |
| 6 | **Correlated metrics are counted twice.** Visitors, outbound spend, departures and GDP per head move together. | — | The effective weight of "big rich market" is higher than the weights say. |
| 7 | **Override mode gives new markets 0.** | `applyFixedAllocation` | A recommended market would be added with no budget. |
| 8 | **No uncertainty is shown.** | Many inputs are estimates; regional Hofstede values are proxies. | A 6.85% vs 6.49% difference is shown as if it were precise. |

The normal CDF approximation itself is fine (Abramowitz–Stegun 7.1.26, error < 1.5e-7).

---

## 2. Allocation Model v2: an optimised media plan

### The question the client is really asking

"I have X. Where does each next dirham do the most good, and can you prove it?"

A split proportional to score can't answer that. It says Germany is 2× as attractive as Spain, so Germany gets 2× the money. It never asks whether Germany has already been reached enough that the next 100k is wasted, or whether Spain's cheap media and large unreached audience would return more.

The model below replaces "proportional to score" with **maximise total quality-weighted reach for the budget, under diminishing returns**. It is the standard logic of reach planning and media-mix optimisation, and every step can be shown on screen.

### The allocation universe (decided 2026-11-19)

Each version has an explicit **allocation universe**: the list of countries the plan is benchmarked and allocated across. By default it is every market in the workbook. All statistics (medians, spreads, scales) are pegged to that list.

- **Changing the universe recalculates everything from scratch.** Removing the USA rebuilds the statistics and re-solves the budget as if the USA had never been in the list. Adding a recommended country does the same with it included. Every recalculation shows a "what changed" diff: each market's quality score and budget, before and after.
- **The user can see and edit the universe.** A client can be told plainly: "this plan benchmarks these 15 markets".
- **Universe membership and funding are separate switches.** A market can stay in the universe as a benchmark without receiving budget: a *benchmark-only* market, e.g. when sanctions or client policy rule it out. Turning funding off re-solves the budget without moving the statistics. Taking a market out of the universe does both. (Assumption A11.)
- **Minimum size:** warn below 8 markets, where medians and spreads get noisy.
- **In optimised mode, only quality depends on the universe.** Audience size and CPM are each market's own figures, so a universe change moves the budget mainly through quality and through freed or added money.

**Evidence that this is safe: judgment scores must use a fixed scale.** I removed each Egypt market in turn, recalculated from scratch, and measured how much the budget ratio between every other pair of markets changed:

| Setup | Median | 95th percentile | Worst |
|---|---|---|---|
| Today (mean and stdev, Market Tier fitted to a normal curve) | 0.7% | 9.4% | **74.9%** (removing Germany: Italy vs Kuwait) |
| Robust stats, Market Tier scaled to the universe's min–max | 1.1% | 7.9% | **79.6%** |
| Robust stats, **Market Tier on a declared 0–50 scale** | 0.9% | 3.3% | **6.1%** |
| Today, Market Tier removed as a factor | 0.8% | 3.1% | 6.6% |

Almost all of the wild swing comes from **one judgment metric (Market Tier, weight 50) being measured against the group**: Germany is the only market scored 50, so removing it rescaled everyone's tier score. Measured metrics barely drift: worst ≈6–8%, typically about 1%.

So the universe recalculation works **provided judgment scores sit on a declared, fixed scale** (Market Tier itself moves into market priority, A8). That becomes a hard rule: `kind: 'score'` metrics need a declared scale, and the upload wizard asks for it.

Robust statistics did not reduce drift on this data. They are kept because they stop one giant market from squashing everyone else when it joins the universe (§1, problem 3), not to reduce drift.

### The model

For each enabled market *i*:

1. **Quality per person reached, qᵢ** (0–1). This is the factor score: the workbook metrics and their weights, computed robustly against the allocation universe.
   - Median and MAD instead of mean and stdev, plus a log scale for lopsided figures.
   - Judgment scores are mapped on their own scale rather than fitted to a curve.
   - Blanks lower confidence and never add points (see "Missing values" below).
   - It answers: how valuable is a person reached in this market?
2. **Addressable audience, Aᵢ** (people).
   - GWI audience size when connected (Phase 4).
   - Until then, population × the workbook's audience ratio, using World Bank population.
3. **Cost to reach, CPMᵢ.** The workbook's media cost per thousand impressions, which the user enters.
4. **Human priority, hᵢ ("media expertise", formerly Market Tier).** A per-market multiplier set by the planner: a slider from 0.5× (deprioritise) to 2× (favour), default 1×. Existing decoders start from their migrated tiers (see below). It needs a one-line reason, e.g. "Existing sales office in Riyadh", which is stored and shown.
5. **Response curve with diminishing returns.**
   - Reach from spend *s*: `Rᵢ(s) = Aᵢ · (1 − e^(−s / cᵢ))`, where `cᵢ = κ · Aᵢ · CPMᵢ / 1000`.
   - κ is the effective frequency: how many impressions it takes to really reach a person. It defaults to 3 and is set by the admin, per market if needed.
   - The first dirhams reach new people cheaply. Later ones mostly re-hit people already reached.
6. **Objective:** maximise `Σ qᵢ · hᵢ · Rᵢ(sᵢ)` subject to `Σ sᵢ = budget` and `minᵢ ≤ sᵢ ≤ maxᵢ`, with locked fixed amounts taken off first.
   - The objective is concave, so there is **one exact optimum**.
   - At the optimum, every funded market has the same marginal return per dirham. That is the provable statement: "moving any money from one market to another would reduce total quality-weighted reach".
   - Solve: the marginal value is `qᵢhᵢ · (1000 / (κ·CPMᵢ)) · e^(−s/cᵢ)`. For a candidate λ, `sᵢ = clamp(cᵢ · ln(qᵢhᵢ·1000 / (κ·CPMᵢ·λ)), minᵢ, maxᵢ)`. Bisect on λ until the budget is met. This is exact, deterministic and fast (< 1 ms for 28 markets).

**What it does intuitively:**
- High quality and cheap media get the first money.
- Big audiences can absorb more money before saturating.
- Small markets are capped naturally by saturation, not by an arbitrary rule.

**Three model modes** (per version, admin toggle, always with a side-by-side diff before switching):

| Mode | Use | Needs |
|---|---|---|
| `optimised` (new default for new decoders) | The effective-allocation model above | Audience size (GWI, or population × audience ratio) and CPM per market |
| `score` | Robust score-proportional split, for decoders without audience or CPM data | Factor metrics only |
| `workbook` | Exact Excel parity for existing decoders | Today's inputs |

### Human input: two layers, both adjustable and auditable

1. **Factor weights** (exist today): how much each metric matters, such as audience ratio, visitors or GDP.
2. **Market priority hᵢ** (new): the planner's judgement per country, plus hard controls per market:
   - **Lock** a fixed amount.
   - **Minimum** (keep presence, e.g. "never below 50k").
   - **Maximum** (e.g. a capacity or legal limit).
   - **Exclude**.

**Showing the cost of expertise.** The plan shows the model-only allocation next to the expertise-adjusted one, and states the trade-off in plain words: "Your priorities move AED 240k to Saudi Arabia and Germany; modelled effective reach changes by −3.1%". The client then sees human judgement as a deliberate, quantified choice, not an unexplained override.

**Market Tier is the media expertise (confirmed by the user, 2026-11-19).** In the old build, Market Tier was the planners' way of prioritising a market. In v2 it stops being a factor and becomes hᵢ directly, so data-driven quality (q) and human judgement (h) are kept apart and each can be shown separately.

**What tier actually did in the old build.** I fitted the old Egypt budgets with `share ∝ q_data × (tier / median tier)^γ`, where q_data is today's maths with tier removed as a factor.
- The best fit is **γ = 0.12**, with an RMS error of **0.51 points** of split. Leaving tier out entirely gives 1.13 points.
- So despite weight 50 of 85, the old expertise behaved like a priority of only **0.70× (Kuwait, tier 0.3) to 1.29× (Germany, tier 50)**. The normal curve squashed it.
- A tier of 50 vs 0.3 reads as a 166× difference, but it moved the budget by about 1.8×. Germany got 12.5% instead of a data-only 9.4%; Kuwait got 5.0% instead of 6.9%.

**Migration rule.**
- Existing tiers are converted once into explicit priorities `hᵢ = (tierᵢ / median tier)^γ`, with γ fitted per decoder against its old budgets. Existing plans therefore stay within about 0.5 points of their current splits.
- The planner then sees the real strength of their expertise on the priority slider, and can make it stronger knowingly.
- A uniform scaling of h cancels out in both score and optimised modes, so the median in the formula doesn't reintroduce drift. After migration h is stored as a plain number per market anyway.

### The "proof" outputs (what the client sees)

- **Allocation table:** budget, share, reach, % of audience reached (saturation), cost per reached person, and marginal return at the chosen spend, per market.
- **"Where the next 100k goes":** the market with the highest marginal return right now.
- **Efficiency curve:** total quality-weighted reach vs total budget (0.25×–2× of X). It shows the point where extra money stops paying off.
- **Benchmarks:** the optimised plan vs an equal split, vs the workbook (score) split, and vs any saved plan, e.g. "+18% quality-weighted reach vs equal split for the same budget".
- **Uncertainty:** a Monte Carlo run of 2,000 draws, perturbing inputs by source confidence (GWI by its sample error or ±10%, user estimates ±20%, regional proxies ±25%), κ by ±1 and weights by ±10%. Output: a P10–P90 budget band per market and rank stability, e.g. "Germany is a top-3 market in 94% of draws".
- **Sensitivity:** which input moves each market's budget most, e.g. "Saudi Arabia's budget is most sensitive to CPM".
- **Scenarios:** save, name and compare plans ("Base", "Push GCC", "No China"), with exportable comparisons for client decks.

### Missing values

- The metric is excluded for that market and its weight is redistributed. The quality score is then shrunk towards neutral by coverage: `q = c·q_obs + (1−c)·0.5`, where c is the share of the total weight that has data.
- The UI shows the coverage %.
- In `optimised` mode a market without an audience size or CPM can't be optimised. It is flagged and asks for the value, or the admin locks it at a fixed amount.
- The recommender's add flow blocks until every required input is filled.

### Honest note on accuracy

The maths is exact given the inputs. The response-curve *shape* (exponential reach with frequency κ) is a standard planning assumption, not a fit to this client's results. When campaign delivery or outcome data exists, a later phase can fit cᵢ and κ per market (Bayesian, shrunk towards these priors) and backtest. Until then the model is a defensible, transparent planning tool, and the uncertainty bands say how firm each number is.

### Phase 1 tasks: Allocation Model v2

- [ ] **1.1 Characterisation tests** (`lib/model/legacy.test.ts`): freeze today's workbook behaviour, including the missing-CPM reward, so `workbook` mode stays bit-for-bit compatible.
- [ ] **1.2 Config schema** (`lib/config/types.ts`, `validate.ts`). All fields are optional, so existing versions stay valid.
  - `VersionConfig.model?: 'workbook' | 'score' | 'optimised'` (default `'workbook'`).
  - `MetricDef.kind?: 'measure' | 'ratio' | 'score'`, `transform?: 'none' | 'log' | 'logit'`, `scale?: { min, max }`.
  - `MetricDef.role?: 'audienceRatio' | 'audienceSize' | 'cpm' | 'priority'` marks which metrics feed the response curve, and which column is the media-expertise tier. The upload wizard proposes this mapping and auto-detects "Market Tier".
  - A `priority` column is excluded from q and converted to `marketControls[name].priority` (see 1.9b).
  - `universe?: string[]` (market names; default: all workbook markets). The existing `enabled` flag becomes the funding switch, so a market that is in the universe but not enabled is benchmark-only.
  - `MetricDef.scale` is **required** when `kind: 'score'`.
  - `planning?: { frequency: number; perMarketFrequency?: Record<name, number> }`.
  - `marketControls?: Record<name, { priority?: number; reason?: string; min?: number; max?: number; lock?: number; exclude?: boolean; setBy?: string; setAt?: string }>`.
- [ ] **1.3 Quality engine** (`lib/model/quality.ts`): transforms, universe statistics, declared scales for judgment scores, robust index, coverage shrinkage.
- [ ] **1.4 Optimiser** (`lib/model/optimise.ts`): response curves, KKT bisection on λ with clamps and locks, an infeasibility error with a reason, and largest-remainder rounding so the total is exact.
- [ ] **1.5 Score mode** (`lib/model/score-split.ts`): robust quality × priority, proportional, with min, max and locks via capped water-filling.
- [ ] **1.6 Dispatcher** (`lib/model/index.ts`): `computeAllocation(config, controls, budget)` returns one result shape (budget, share, reach, saturation, marginal return, q, coverage) for every mode. `derive.ts` calls only this.
- [ ] **1.7 Property tests (fast-check):**
  - **Optimality:** no random transfer of money between two funded, unclamped markets increases the objective.
  - **Equal marginal returns:** at the optimum, unclamped funded markets have marginal returns within 1e-9 of each other.
  - **From-scratch removal:** removing a market gives exactly the same result as building the config without it.
  - **Universe change equals rebuild:** removing a country from the universe gives exactly the result of a config built without it; adding one gives the result of a config built with it.
  - **Funding off doesn't move the stats:** disabling funding for a universe market leaves every other market's q unchanged.
  - **Judgment scores are absolute:** a `score` metric's index depends only on its own value and declared scale.
  - **Drift regression check** (fixture test, not a property): Egypt leave-one-out pairwise-ratio drift stays at a p95 of 5% or less and a worst case of 10% or less in score and optimised modes.
  - **Monotonicity:** raising qᵢ, hᵢ or Aᵢ, or lowering CPMᵢ, never lowers sᵢ; raising the budget never lowers any sᵢ.
  - **Constraints:** locks, minimums and maximums are honoured; the total equals the budget after rounding.
  - **Missing ≤ observed**; unit invariance; permutation invariance.
  - `workbook` mode equals the Egypt fixture to the existing tolerances.
- [ ] **1.8 Uncertainty and sensitivity** (`lib/model/uncertainty.ts`): seeded PRNG, Web Worker, under 200 ms for 28 markets × 2,000 draws.
- [ ] **1.9b Tier migration** (`lib/model/migrate-tier.ts`): fit γ per decoder against the old budgets, write the priorities, record γ and the fit error in the spec. Test: Egypt γ ≈ 0.12, RMS ≤ 0.6 points.
- [ ] **1.9 Worked comparison:** a script runs Egypt and Palm Jebel Ali in all three modes. The results go into the spec so the change is reviewed on real decoders before any default flips.
- [ ] **1.10 Admin UI:**
  - The upload wizard maps metrics (kind, role, transform).
  - Version settings: mode toggle with diff, and frequency κ.
  - A universe editor: add or remove countries, and a benchmark-only switch. Every change shows the recalculation diff before saving.
- [ ] **1.11 Budget Allocation tab (viewers and admins):**
  - The allocation table with saturation and marginal-return columns, and the "next 100k" callout.
  - The efficiency curve, benchmarks, P10–P90 bands and rank stability.
  - Priority sliders with a required reason, lock, min, max and exclude.
  - A model-only vs expertise toggle with the stated trade-off.
  - Viewers' changes are a live simulation. Admins can save them as a draft scenario.
- [ ] **1.12 Scenarios:** save, compare and export (CSV, plus a print-friendly view).
- [ ] **1.13 Verify and commit:** tsc, lint, vitest, build, then Chrome on a **draft** of Egypt. Commit `feat(model): optimised allocation with response curves and market priorities` with a `Verified:` line.

---

## 3. Data sources and metric providers

Each metric gets a **provider**. Only GWI and Aviationstack fill values automatically. Everything else is entered by the user, as requested. Public data is used to **rank** recommender candidates; it is never written into metric values without the user clicking "Use this value".

| Provider | Fills | How |
|---|---|---|
| `gwi` | Audience size, and audience ratio (audience ÷ population or online population) | A saved GWI audience queried per country for the latest wave (Phase 4) |
| `aviationstack` | Average daily flights (and seats if obtainable), source country → destination airports | Arrival schedules at the destination airports over a sample week, mapped to source country (Phase 3) |
| `manual` | Everything else: visitors, CPM, Statista spend, brief metrics. Market Tier (media expertise) becomes the priority slider rather than a metric. | A gap-fill form showing context hints (decoder median, closest peer) |
| `public` (ranking only) | Recommender ranking features | IMF WEO, World Bank (`ST.INT.DPRT` outbound departures, `ST.INT.XPND.CD` tourism spend, plus the existing indicators), Our World in Data, Hofstede, and haversine distance from the destination |

**Provenance.** `MarketRow.valueSources?: Record<metricKey, { provider, fetchedAt?, ref?, note?, enteredBy? }>`. It drives the source badges, the uncertainty bands in §2 and the audit trail.

**Secrets.**
- `GWI_API_KEY` and `AVIATIONSTACK_API_KEY` go in `.env.local` and in the Vercel `country-decoders` project. They are server-only.
- They are never logged, and values are never printed in scripts (read with grep and cut, as with the Claude key).

---

## 4. Phases

### Phase 0: Prerequisites and API probes

- [ ] **0.1 Commit the current uncommitted work** (Culture tab, indicator strip, market context, culture reading) after the full verify skill run. It is on `main`'s working tree now.
- [ ] **0.2 Add the keys to `.env.local`.** The user does this; Claude never types or prints keys.
- [ ] **0.3 Aviationstack probe** (`scripts/probe-aviationstack.ts`, GET only):
  - Confirm the plan tier: `/v1/flight_schedules`, `/v1/flightsFuture` and `/v1/routes` need **Basic or above**; a `403 function_access_restricted` means the plan lacks them.
  - Confirm the exact parameters (arrival schedules by airport and date), the pagination limit, HTTPS support, the monthly quota, and whether the codeshare and aircraft fields are present.
  - Record the findings in the spec.
- [ ] **0.4 GWI probe** (`scripts/probe-gwi.ts`). GWI's docs moved to `developer.globalwebindex.com`, so this confirms:
  - The auth header and base URL.
  - Taxonomy search (questions and datapoints).
  - `GET/POST /v2/saved/audiences` and the audience expression syntax.
  - The v2 stats query request (question, audience expression, locations, waves) and the response metrics: weighted universe or audience size, percentage, index, and sample size.
  - Location coverage (GWI covers about 50+ markets, not all ~190), the wave cadence and the rate limits.
  - **Read-only calls first.** Creating a test audience writes to the team's GWI account, so do it only after the user OKs it.
- [ ] **0.5 Spec.** Write `docs/superpowers/specs/2026-11-xx-market-recommender-design.md` with the confirmed API contracts and the decisions in §5.

### Phase 1: Allocation Model v2 (optimised plan)

See §2 above. It can ship before GWI: the audience size starts as World Bank population × the workbook's audience ratio.

### Phase 2: Data foundation

- [ ] **2.1 Country universe loader** (`lib/insights/universe.ts`):
  - All countries in one pass per source; the World Bank `country/all` form already works.
  - Add `ST.INT.DPRT` and `ST.INT.XPND.CD`, and **check their freshness first**: some tourism series stop around 2020. Show the data year on every value.
  - Haversine flight distance and an estimated flight time to the destination.
  - Aggregates and income groups are excluded.
- [ ] **2.2 Supabase cache.** A `country_signals` table holding (iso2, key, value, year, source, fetched_at), with RLS read for signed-in users and writes by the service role only. It avoids the 2 MB fetch-cache limit and repeated paid API calls.
  - Migration written via the supabase-postgres-best-practices skill.
  - Applied **only with the user's go-ahead** (production DB).
- [ ] **2.3 Refresh jobs** (Vercel cron, protected by `CRON_SECRET`): public data weekly, flights monthly, GWI per wave or on demand. Every job is idempotent and logs counts, never values.
- [ ] **2.4 Tests:** parsers, aggregate exclusion, freshness flags.

### Phase 3: Aviationstack integration

- [ ] **3.1 Destination airports.** Add `VersionContext.destinationAirports?: string[]` (IATA codes, e.g. DXB plus DWC for Palm Jebel Ali; AUH for Abu Dhabi). Admins edit it in version settings.
- [ ] **3.2 Average daily flights**, computed **from the destination side** for efficiency:
  - For each destination airport, pull arrivals for a sample of 7 consecutive days (future schedules, so it's repeatable).
  - Map each departure airport to its country via the cached `/v1/airports` catalogue.
  - **Deduplicate codeshares** by operating flight, then count per source country and divide by 7.
  - This costs one pass per airport per refresh, whatever the number of candidates: about 7 days × pages × airports. Estimate the quota use in 0.3.
- [ ] **3.3 Seats (optional).** If the aircraft type is present, estimate seats from a typical-seats-by-type table and label them as estimates. Otherwise flights only.
- [ ] **3.4 Provider binding.** An admin maps a metric (e.g. "Daily Flight Seating Capacity") to `aviationstack: dailyFlights | dailySeats`. The values fill existing and candidate markets.
  - Existing workbook values are **never overwritten silently**. Show a diff (workbook vs Aviationstack) and let the admin accept per market.
- [ ] **3.5 Tests:** codeshare dedupe, airport-to-country mapping, seven-day averaging, quota guard (stop below a configurable floor).

### Phase 4: GWI integration

- [ ] **4.1 Server client** (`lib/providers/gwi.ts`): auth, taxonomy search, audiences (list, create, get), stats query. Typed against the contract confirmed in 0.4. Retries with backoff and respects the rate limits.
- [ ] **4.2 Audience composer (admin only, because it writes to the GWI account):**
  - Search the GWI taxonomy and build an expression with AND and OR groups, e.g. "Luxury travellers AND HNW AND plan to buy property abroad".
  - Preview the audience size across the decoder's markets for the latest wave, then save it to GWI.
  - Store the `audienceId` and expression on the version: `VersionContext.gwiAudiences: [{ id, name, expression }]`.
- [ ] **4.3 Scaling.**
  - One stats query per audience across all candidate and current locations gives audience size, % of population and index per country.
  - Store the sample size so §2 can derive the uncertainty band.
  - Countries GWI doesn't cover are marked "Not in GWI" and fall back to manual entry.
- [ ] **4.4 Provider binding:** map "Audience Ratio / Pop." to `gwi: { audienceId, measure: 'ratio' | 'size' | 'index' }`, with the same diff-and-accept rule as 3.4.
- [ ] **4.5 Tests:** expression builder (serialisation round-trip property test), response parsing, coverage fallback. Mock the API in tests; the probe script hits the real one.

### Phase 5: Recommender engine (pure library, tested)

- [ ] **5.1 Features per country:** GDP per head (PPP), household spend per head, population (log), outbound departures (log), tourism spend (log), internet use, urban share, over-65 share, HDI, life satisfaction, growth outlook, Hofstede ×6 (where available), flight time, daily flights (when computed), and GWI audience ratio (when the country is covered).
- [ ] **5.2 Benchmark profile:** a **budget-share-weighted** centroid of the current enabled markets (assumption A3). Each feature is standardised against the universe with median and MAD.
- [ ] **5.3 Lookalike score.**
  - Weighted similarity to the profile: feature weights come from how strongly each public feature tracks the decoder score across current markets (Spearman, shrunk towards equal weights because n is small), and users can adjust them with sliders.
  - Missing features are handled with the coverage rule from §2.
- [ ] **5.4 Projected budget range.** Run the candidate through the optimiser using its public and auto-filled values plus a P10–P90 band for the not-yet-entered manual metrics (drawn from the cohort). Present it as "If entered like a typical market: 4–7% of budget", clearly labelled as a projection.
- [ ] **5.5 Reasons:** the top three contributing features vs the closest current peer, e.g. "Close to the UK on spend per head and individualism; 6.5 h flight; 18 daily flights".
- [ ] **5.6 Filters:** region, maximum flight time, minimum daily flights, minimum spend per head, "culturally like [market]" (reuses `fitScore`), excluded countries, GWI-covered only.
- [ ] **5.7 Property tests:** existing markets are never recommended, deterministic order for the same input, permutation invariance, monotonicity (moving a candidate closer to the profile never lowers its match), filters strictly respected.

### Phase 6: Discover tab (read-only UI; impeccable and emil-design-eng, Operate mode)

- [ ] **6.1 Layout:**
  - A new "Discover" tab.
  - Left: constraint chips and weight sliders.
  - Main: a ranked card grid with match %, mini fingerprint, three reasons, data year and coverage, plus "Add to plan".
  - A map preview with candidate pins in a neutral style (the blue ramp stays reserved for budget).
- [ ] **6.2 Interaction:** live re-rank with the FLIP animation, a "Compare with current markets" radar (reuses `RadarChart`), pagination or virtual scroll for about 190 countries, and keyboard access.
- [ ] **6.3 Viewers** can explore and simulate here (assumption A2).

### Phase 7: Plan tray, gap-fill and allocation preview (client-only, nothing saved)

- [ ] **7.1 Plan tray:** a sticky tray of picked candidates. It persists in `sessionStorage` per slug.
- [ ] **7.2 Gap-fill form** per candidate, one row per weighted metric:
  - GWI and Aviationstack values are prefilled, each with a source badge.
  - Manual metrics are entered by the user, with hints ("UK: 82 · decoder median: 64 · closest peer Germany: 71").
  - Public suggestions appear only as an optional "Use IMF value" button, never prefilled.
  - Media-expertise priority is always set by a human: it defaults to 1×, needs a reason, and shows the closest peers' priorities.
  - Validation: units, range sanity (warn beyond 3 MAD from the reference), and a required field for every weighted metric.
  - In override mode, the user also chooses a fixed amount or a share.
- [ ] **7.3 Allocation preview:**
  - A before/after table and bars for **every** market, with the change in amount and percentage, P10–P90 bands and rank stability.
  - In optimised mode, the panel explains where the money came from: "Vietnam takes AED 310k, mostly from Germany and the UK, where the last dirhams returned least". Joining the universe shifts the statistics slightly, so the diff also lists each existing market's quality change (typically about 1%).
  - In workbook mode, warn that Market Tier is fitted to the group there, so existing markets can re-rank sharply (§2 evidence table).

### Phase 8: Persistence and re-upload merge (admin)

- [ ] **8.1 "Save plan as draft"** server action, re-checked as admin on the server:
  - Writes a draft with the new markets: `origin: 'platform'`, `valueSources`, and allocation entries.
  - Publishing goes through the existing flow. There is no direct-to-live path.
  - Revision history records who added what.
- [ ] **8.2 Re-upload merge rule (assumption A1):**
  - Platform-added markets survive a workbook re-upload as an overlay.
  - If the new workbook contains the same market (by ISO2 or name), **the workbook wins**, and the confirm step lists every overlay market as kept, replaced or dropped.
- [ ] **8.3 Remove a platform-added market:** a draft change with the budget diff shown.
- [ ] **8.4 Tests:** merge rule table tests, plus an end-to-end flow (discover → add → fill → preview → draft → publish) driven in Chrome against a **draft** only.

### Phase 9: AI rationale (on demand, cached)

- [ ] **9.1 Route:** `POST /[slug]/recommend-insight`, following the `culture-insight` pattern.
  - Scores are looked up on the server, so the client can't inject values.
  - Cached per (slug, candidate set, data version).
  - Claude writes a case for each shortlisted country, using the decoder's industry and brief.
- [ ] **9.2 Prompt rules:**
  - It cites numbers only from DATA.
  - Qualitative factors (visa rules, sanctions, travel advisories, direct-flight launches) are flagged "verify". No invented figures.
  - Prompt and parser tests mirror `lib/ai/culture.test.ts`.

---

## 5. Decisions (defaults assumed, to confirm)

| ID | Decision | Default assumed |
|---|---|---|
| A1 | Workbook re-upload vs platform-added markets | Keep them as an overlay; the workbook wins on conflict, with a listed diff in the confirm step |
| A2 | Who can add markets | Admins save drafts; viewers explore and simulate only |
| A3 | Benchmark profile | Weighted by budget share |
| A4 | Missing weighted metrics on add | Block until filled (coverage shrinkage only covers legacy gaps) |
| A5 | Model default | `workbook` for existing versions; `optimised` for new and recommender-edited ones, after the worked comparison (1.9) is reviewed |
| A8 | Market Tier vs market priority | **Decided:** Market Tier is the media expertise. It becomes the per-market priority hᵢ, migrated with a fitted γ (Egypt: 0.12) so current budgets hold; it is no longer a factor. |
| A9 | Default effective frequency κ | 3, editable per version and per market |
| A11 | Allocation universe | Explicit list, defaulting to all workbook markets. Any change recalculates from scratch with a diff. Benchmark-only (in the universe, not funded) is allowed. Warn below 8 markets. |
| A10 | Who sets market priorities | Admins save them; viewers can simulate. Every priority needs a reason, which is recorded with who set it and when. |
| A6 | Public data in metric values | Never automatic; a one-click "Use this value" only |
| A7 | GWI writes | Audience creation needs the admin's action each time; probes are read-only |

## 6. Risks

- **GWI contract unknown until probed.** Phases 4 and 5's GWI features are gated on 0.4. The rest of the plan doesn't depend on GWI.
- **Aviationstack plan limits.** Schedules need Basic or above. If the quota is tight, refresh monthly and only for the destination airports.
- **Stale World Bank tourism data.** Show the data year; drop a feature from ranking if its median year is more than 4 years old.
- **Response-curve assumption.** κ and the exponential shape are planning priors, not fitted to results. Mitigation: sensitivity on κ is shown, and calibration is a later phase once delivery or outcome data exists.
- **CPM and audience coverage.** Optimised mode needs both per market. Markets missing either are flagged and must be filled or locked, and the `score` mode stays available.
- **Small n.** Reference snapshots from 6–15 markets are noisy, so the Monte Carlo bands and the shrunk feature weights carry that honestly.
- **Workbook expectations.** Clients comparing against their Excel would see different numbers in score or optimised mode. That is why it is a per-version toggle with a diff, and the bug in §1 #1 is explained in the admin UI.

## 7. Verification standard (every phase)

1. tsc, lint, vitest (including the new property tests) and `next build`.
2. The decoder-platform verify skill: signed-out smoke, then the affected pages driven in Chrome.
3. Anything that writes to production Supabase, GWI or Vercel needs the user's go-ahead.
4. One commit per phase with a `Verified:` line. The user pushes.
