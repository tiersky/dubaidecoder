---
version: 1
slug: "app-slug-dashboard-client-tsx"
primary_target: "app/[slug]/dashboard-client.tsx"
related_targets: ["app/login/page.tsx","app/select/page.tsx","app/page.tsx"]
---

# Surface: viewer dashboard + entry flow

Mode: Operate. Scope: `/`, `/login`, `/select`, `/[slug]` (Global Overview, Country Detail, Budget Allocation). Admin inherits shared tokens only.

Audience/job: client marketing teams and the agency presenting to them. They need to read the recommended budget split per source market, and to defend or explore it live (budget, market toggles, weights). Constraints: config-driven metrics and 1 to 28 markets, untrusted label text, projector legibility.

Pinned by user (2026-11-10): Apple-style glass, minimal, more animation.

## Direction contract

THESIS: The split is the hero, and glass is only the chrome around it. This refuses the category default of a slate admin template with a grid of identical icon cards and a rainbow treemap.

OWN-WORLD: macOS/visionOS light material. Soft blue/teal/peach colour fields behind the chrome only. A floating inset glass sidebar and toolbar with specular top edges. Ink #1d1d1f / #6e6e73. One accent, system blue. Budget magnitude is a single blue sequential ramp shared by the map, treemap and share bars. Type is the platform system stack with size-specific tracking.

STORY: The visitor sees where the money goes in the first viewport, clicks a market to see why (KPIs ranked against peers), and on the budget tab changes inputs and watches every figure re-flow.

FIRST VIEWPORT: Floating sidebar on the left (search plus markets). A glass toolbar on top (logo, version name, segmented control). The map shaded by share on the left, and a ranked allocation list on the right with flags, bars, % and amount.

FORM: user-pinned direction (no roll). Signature move: live reallocation. Numbers tween from their current value, and share bars, map and treemap re-tint together. The segmented control uses a sliding glass thumb; surfaces materialize (blur+scale+fade). seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
