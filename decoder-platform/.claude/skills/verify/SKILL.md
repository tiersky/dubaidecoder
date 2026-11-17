---
name: verify
description: Smoke-test a decoder-platform change end to end before committing it — type-check, lint, unit tests and build, then run the app and drive the affected pages in Chrome. Use after changing anything under decoder-platform/ and before every commit there.
---

# Verify a decoder-platform change

Run everything from `decoder-platform/`. Steps 1–3 take well under a minute.

## 1. Cheap checks

All four must pass:

```bash
npx tsc --noEmit
npm run lint
npm test          # vitest; only picks up lib/**/*.test.ts
npm run build
```

A logic change in `lib/` comes with a test beside it. vitest only collects `lib/**/*.test.ts`, so a test anywhere else never runs.

## 2. Start the app

```bash
npm run dev -- -p 3100        # run in the background
until curl -s -o /dev/null http://localhost:3100/; do sleep 1; done
```

Port 3100 keeps clear of a dev server the user may have on 3000. Stop it when you're done: `kill $(lsof -tiTCP:3100 -sTCP:LISTEN)`.

The local app uses the hosted Supabase project and the live Interact AI service configured in `.env.local`, which is the same data production uses. So keep verification read-only:

- Don't publish or delete drafts, save draft edits, apply quick tweaks, create, reset or deactivate users, run `scripts/seed-*` or `scripts/create-user.ts`, or apply migrations. If one of those flows is what the change touches, ask the user before exercising it.
- Opening a market's AI insight generates and stores one if none is cached, and admin "regenerate" always does (up to three agent calls of 10–25 s each). Do that only when the change is in the insight path.
- Never print or paste values from `.env.local`.

## 3. Signed-out smoke test

Run it for every change. These are the expected results:

```bash
for p in / /login /select /api/keepalive /egypt /admin; do
  printf '%-16s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://localhost:3100$p"
done
```

| Route | Expected |
|---|---|
| `/`, `/login` | 200 |
| `/select` | 307 → `/login` |
| `/egypt`, `/admin` | 307 → `/login?next=…` |
| `/api/keepalive` | 401 (no cron secret) |

A different result on a route the change wasn't meant to affect is a regression. Also scan the dev-server output for errors.

## 4. Drive the affected pages in Chrome

For anything a signed-in user sees, open `http://localhost:3100` with Claude in Chrome and walk through the changed flow as that user would.

- If it lands on `/login`, ask the user to sign in in that tab. Never type credentials. Viewers see only their own slugs; `/admin` needs an admin account.
- On a dashboard (`/[slug]`), check that the map, treemap and charts render and the console has no errors.
- On glass surfaces, check that the blur actually shows.
- Take a screenshot of the changed screen to show the user.

If the Chrome extension isn't available, finish steps 1–3 and say plainly that the signed-in flow wasn't checked.

## 5. Report

Put what you ran in the commit's `Verified:` line, e.g. `Verified: tsc, lint, vitest, build, signed-out smoke, /egypt dashboard in Chrome`. Name any step you skipped and why.
