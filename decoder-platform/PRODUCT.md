# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Client marketing and tourism teams (destination and real-estate brands such as Egypt Tourism, Palm Jebel Ali and Arada) who review how a marketing budget splits across source markets. They browse their own decoder, and the agency team also presents it to them on a shared screen or projector in meetings. A smaller group of agency admins publish and tweak versions.

## Product Purpose
Country Decoders turn a client's market model workbook into an interactive dashboard. It scores source markets on weighted indices (visitors, spend, media cost, GDP and so on), shows them on a world map with per-country KPIs, and allocates a total budget across the active markets. Viewers can change the budget, toggle markets and adjust the model weights live. Success means a client understands and trusts the recommended split, and the agency can defend it in the room.

## Positioning
Each decoder is generated from the client's own workbook, so every score and split traces back to their model. The numbers on screen reproduce the spreadsheet exactly, but they are explorable live instead of sitting in a static deck.

## Operating Context
- Shown in client meetings on laptops and projectors, and opened afterwards by clients on their own laptops.
- Access is per project slug: a viewer sees only their assigned decoders; admins see every published version.
- Content is config-driven: metric names, market counts (roughly 5 to 28), currency, budget and an optional fixed allocation all vary per version.

## Capabilities and Constraints
- Next.js 16 (App Router, proxy.ts auth), React 19, Tailwind v4, Supabase auth and data.
- Charts use Chart.js (bubble, treemap) and react-simple-maps (world map). Flags come from flagcdn.com.
- Routes: `/` landing, `/login`, `/select` project picker, `/[slug]` dashboard (Global Overview, Country Detail, Budget Allocation), `/admin/*` publishing tools.
- Metric labels and descriptions come from uploaded workbooks and must be treated as untrusted text.

## Brand Commitments
- Product name "Country Decoder(s)"; logo at `public/Country Decoder Logo.png`; tagline "Strategic Travel Intelligence".
- User-stated direction (2026-11-10): Apple-style glass, minimal, with more motion.

## Evidence on Hand
Live published versions: egypt, isa-decoder, palmjebelali-decoder, palmjebelali-decoder-v2, arada-decoder. There are no testimonials, customer logos or performance claims; do not invent them.

## Product Principles
- The model's numbers are the product. Every visual choice must make the split easier to read and trust, never harder.
- It must hold up when presented to a room: legible at a distance, calm, and with nothing that looks unfinished.
- It must stay correct for any config: arbitrary metric counts, long market names, and from 1 to 28 markets.
- Live exploration should feel immediate. Changing a weight or toggling a market should give instant, visible feedback.
