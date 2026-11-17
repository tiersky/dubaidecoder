# Review guide: decoder-platform

What a reviewer of this app should focus on. Each item has a trigger you can read from the diff, the check, and where it came from. Check only the items whose trigger matches the diff. Tag every finding Important, Nit or Pre-existing.

Context: Next.js 16 (`proxy.ts` replaces `middleware.ts`, and APIs differ from older versions, so check `node_modules/next/dist/docs/` before calling Next usage wrong), Supabase for auth and storage, roles in `app_metadata`. Viewers are client-facing; admins are internal.

## Items

1. **Access boundary.**
   - Trigger: `proxy.ts`, `lib/auth/`, a new page or route, or a new public path.
   - Check: the route is covered by `authorize()`. Role and slugs come from `app_metadata` via `parseAccess()`, never `user_metadata`. The proxy uses `getClaims()`, not `getSession()`. Proxy redirects copy the refreshed session cookies.
   - Source: comments in `proxy.ts` and `lib/auth/access.ts`.

2. **Post-login redirect.**
   - Trigger: `lib/auth/post-login.ts`, or code that reads the `next` parameter.
   - Check: only same-origin paths pass, with backslashes and control characters rejected, and `post-login.test.ts` covers the case.
   - Source: open redirect, 6d55307.

3. **Admin server actions.**
   - Trigger: a new or changed export in `app/admin/actions.ts`.
   - Check: it calls `requireAdmin()` first. An action that targets a user by id runs `assertViewerTarget()` on the server rather than trusting hidden fields or what the UI renders.
   - Source: 8cfc058.

4. **Errors sent to the browser.**
   - Trigger: an action or route that returns error text.
   - Check: raw Supabase, storage, parse or upstream errors never reach the client; it returns a generic message. Detail is added only for admins, as in `app/[slug]/insights/route.ts`.
   - Source: 82a23db, 04147b9.

5. **Numbers from forms.**
   - Trigger: a numeric value read from `FormData`.
   - Check: an empty field means unchanged or absent, not `Number('') === 0`.
   - Source: cleared weights silently became zero, 86302ef.

6. **Version writes.**
   - Trigger: `lib/versions/store.ts`, or anything that writes `versions`.
   - Check: the `config` jsonb stays the source of truth, `slug`, `name`, `currency` and `default_budget` are re-derived on every write, and publish stays race-safe.
   - Source: `supabase/README.md`, de5e1b2.

7. **Secret comparisons.**
   - Trigger: comparing a secret or token, such as `CRON_SECRET`.
   - Check: it uses `safeEqual` from `lib/auth/safe-equal.ts`, not `===`.
   - Source: b9a285b.

8. **Server-only keys.**
   - Trigger: `SUPABASE_SERVICE_ROLE_KEY` or `INTERACT_*` usage, a new `NEXT_PUBLIC_` variable, or a client component that imports server code.
   - Check: service-role and Interact credentials are used only on the server, and nothing secret sits behind `NEXT_PUBLIC_`.

9. **Diagnostics and logging.**
   - Trigger: new logging, a debug endpoint, or a "temporary" diagnostic.
   - Check: it is admin-only or removed before merge, and logs hold no user data, workbook contents or secrets.
   - Source: 2190482, 038ea68.

10. **Glass surfaces.**
    - Trigger: CSS that sets `backdrop-filter`.
    - Check: only the standard property is written. A hand-written `-webkit-backdrop-filter` beside it makes Lightning CSS drop the standard one, so glass stops blurring in Chrome.
    - Source: 6402c18 and the Apple-glass redesign.

11. **SheetJS dependency.**
    - Trigger: the `xlsx` line in `package.json`.
    - Check: it stays on the pinned SheetJS CDN tarball. It was moved off the npm `xlsx` package on purpose.
    - Source: 468af69.

12. **Tests for logic changes.**
    - Trigger: a behaviour change in `lib/`.
    - Check: a test beside it under `lib/**/*.test.ts`, the only place vitest looks. Changes users can see are verified in the browser with the `verify` skill.

## Not worth flagging

Style that eslint already enforces, and formatting.

## Keeping this file useful

Add an item only when a miss has happened more than once and can be spotted from a diff, and give its source. Remove items that no longer catch anything.
