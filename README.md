# Country Decoder — monorepo

Five independent Next.js "decoder" dashboards, one per client, living as sibling
folders on `main`. Each folder is a complete standalone app with its own data
model, budget-allocation logic, and Vercel project — isolation is **by folder,
not by branch**. Every push to `main` deploys each changed app to its own URL.

## Registry

| App | Client | Folder | Vercel project | URL | Markets |
|---|---|---|---|---|---|
| Country Decoder | Dubai Tourism Agency | `country-decoder/` | `country-decoder` | country-decoder.vercel.app | 14 |
| Jumeirah Decoder | Jumeirah | `jumeirah-decoder/` | — (not deployed yet) | — | 23 |
| AlUla Decoder | AlUla | `alula-decoder/` | `alula-decoder` | alula-decoder.vercel.app | 15 |
| Egypt Decoder | Egypt Tourism | `egypt-decoder/` | `egypt-decoder` | egypt-decoder.vercel.app | 25 (15 active) |
| DHRE Prioritization | Dubai Holding Real Estate | `dhre-decoder/` | `dhre-decoder` | dhre-decoder.vercel.app | 28 |

Every app keeps the Excel/CSV workbook its numbers came from in its own
`source/` folder — when the model changes, update the workbook there too.

Also in the repo: `tools/` (chart scripts + outputs), `misc/` (orphan data and
diagrams), `visual.py`.

## Conventions

- **One long-lived branch: `main`.** Feature branches are short-lived and merge
  within days. Vercel gives every branch push a preview URL per project — use
  that for client-facing staging, not permanent branches.
- **Four names always agree** per app: folder = `package.json` name =
  Vercel project = `<name>.vercel.app`.
- **Vercel settings** per project: *Root Directory* = the app's folder;
  *Ignored Build Step* = `git diff --quiet HEAD^ HEAD -- .` so only the app
  whose folder changed gets rebuilt.

## Forking a new decoder ("another version for client X")

1. Copy the closest existing app: `cp -R alula-decoder x-decoder`
   (drop `node_modules`, `.next`, `.vercel`).
2. Rename its identity: `package.json` name and `app/layout.tsx` title
   → `x-decoder`.
3. Replace the model: `data/countries.ts` (markets, raw inputs, NORM.DIST
   indices), `types/index.ts` (`DEFAULT_MODEL_WEIGHTS`), default budget in
   `components/templates/BudgetAllocation.tsx`. Drop the workbook into
   `x-decoder/source/`.
4. Create the Vercel project: `cd x-decoder && vercel link` (new project named
   `x-decoder`), then in the dashboard set Root Directory to `x-decoder` and
   the Ignored Build Step above.
5. Commit to `main`, push, and add a row to the registry table in this README.
