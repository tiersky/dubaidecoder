# Design

Country Decoders uses a light glass material world modelled on macOS and visionOS. The glass is the chrome around the numbers, never decoration on them. Tokens live in `app/globals.css`, and the canvas/SVG equivalents in `lib/ui/theme.ts`; keep the two in step.

## Scene
Client meetings on laptops and projectors in bright offices, and clients' own laptops afterwards. That scene sets a light ground with high-contrast ink and type that reads at a distance.

## Colour
- Ground: static soft colour fields (blue, teal, peach, a trace of violet) over `#f3f5f9 → #e9edf3`. They exist only so the glass has something to refract. They never move.
- Ink: `#1d1d1f` primary, `#5f5f66` secondary (5.9:1), `#86868b` tertiary (large or decorative text only).
- Accent: system blue `#0071e3`, used for selection, primary actions, links and focus rings.
- Switch on: `#34c759`. Error: `#ff3b30` tint with `#c4261d` text.
- **Budget magnitude uses one sequential blue ramp** (`RAMP` in theme.ts, steps 150→650). It is shared by the map choropleth, treemap and share bars. Darker means a larger share. Colour positions are min→max across funded markets (`toneScale`). Bar lengths stay proportional to share (`relativeShare`). Never use a categorical rainbow for budget.

## Materials
- `.glass`: panels and chrome (sidebar, toolbar, sign-in card). blur 30 / saturate 180, white 62%, specular top edge, 0.5px hairline, deep soft shadow.
- `.glass-card`: content cards. blur 24, white 58%, lighter shadow.
- `.glass-solid`: modifier for surfaces floating over working content (the mobile sheet).
- `.well`: recessed area inside a card. **Never nest glass inside glass.**
- Write only the standard `backdrop-filter`. Lightning CSS adds the `-webkit-` prefix itself; a hand-written prefix makes it drop the standard property, which kills the blur in Chrome.
- `prefers-reduced-transparency` makes surfaces solid; `prefers-contrast: more` adds solid fills and strong borders.

## Type
Platform system stack (SF Pro on Apple devices), with Inter via `next/font` as the stand-in elsewhere. `.display` sets −0.024em tracking with tight leading for headings; body sits near 0. Figures always use `.num` (tabular numerals). Scale: page title 28–32, card title 15, body 13–14, captions 11.5–12.

## Shape
Panel radius 22, card 20, control 12, segmented thumb 9, pills 999.

## Components
SegmentedControl (sliding thumb), Switch (knob stretches while pressed), ShareBar, AnimatedNumber, Flag (hairline ring), SearchInput, SelectDropdown, `.btn-primary` / `.btn-secondary`, `.press`.

## Motion
- Easing: `--ease-out` cubic-bezier(0.23,1,0.32,1) for entering surfaces and feedback; `--ease-drawer` for the sheet; `--ease-glide` for the segmented thumb.
- View change: `.materialize` (fade + 8px rise + scale .985 + blur 6px → 0, 460ms). Lists stagger 45ms via `--i`, capped. `backwards` fill keeps content visible by default.
- **Signature: live reallocation.** Budget, % split and score tween from the on-screen value (`AnimatedNumber`, expo-out, 480ms, interruptible). Share bars glide with scaleX, and the map and treemap re-tint together.
- Press feedback: scale .97 at 120–140ms. Hover effects only under `(hover: hover) and (pointer: fine)`.
- Reduced motion: every movement becomes a 200ms cross-fade; tweens jump to the final value.
