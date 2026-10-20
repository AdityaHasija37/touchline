# Phase 5 evidence: Publish, present and share (M3, second half)

Date: 20 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium.

## Requirement IDs
PRES-01, PRES-02, PLAN-01 (immutable snapshot), SEC-01. QA-06, QA-07, QA-09, QA-10. J03 end to end. QA-05 now asserted on the real Publish action.

## User-facing behaviour
- **S08 Preview & publish:**
  - Exact 1280×720 miniatures of every slide players will see, a list of excluded sections ("private notes are never included"), and a full-screen draft preview.
  - Required items block publishing; it's a server-side check, and the button is disabled too.
  - **Publish** shows the share link once, with Copy and the UX-002 share warning. The live state shows the publish time.
  - "Your draft has changes players can't see yet" appears whenever the content fingerprint differs. **Republish** updates the same link. "Up to date" when nothing has changed.
  - **Get a new link** rotates the token (the old link dies). **Revoke** asks for confirmation, then the link shows "Briefing unavailable" while the draft stays private.
- **S09 Matchday viewer** (owner `/app/plans/:id/present`, and the public page):
  - Dark chrome; match label top-left, slide number top-right; previous/next buttons; a jump list.
  - Keyboard (←/→, PageUp/PageDown, Space, Home/End), touch swipe, full screen, polite live-region announcements, reduced-motion respected.
  - Slides: title (team, opponent, kickoff, venue, objective), starting lineup with positions and bench, tactic boards with phase and notes, notes, and final reminders as bullets.
- **S10 Public share** `/p#<token>`: read-only, no app links, no squad directory, no private or excluded content. Bad, empty, stale and revoked tokens all get the same generic page; a rate-limited client gets "too many attempts".

## Implementation
- **`20261019230000_publications.sql`:**
  - `published_plans`: token hash only; one live link per plan; one-way revocation guard; column grants mean even the owner can't read the hash.
  - `audit_events`: insert-only from the owner.
  - `share_lookup_counters` (no grants), and `get_published_snapshot(token, client_hash)` (SECURITY DEFINER), with a 60/minute per-client limit. Only `service_role` can execute it (DEC-40).
- **`lib/domain/snapshot.ts`:** allowlisted, strict Zod snapshot v1. It strips player ids, private notes and excluded sections, resolves names and numbers, and provides a fingerprint for change detection.
- **`lib/domain/slides.ts`:** the canonical `SlideSpec[]` that the presenter, public page and (next) PDF all consume.
- **`app/api/briefing`:** POST-only lookup. It hashes the client IP with a server-only salt and never logs the body.
- **`lib/supabase/admin.ts`:** service-role client used **only** by that route.
- **`components/slides/*`:** `SlideView` (container-query sizing), `SlideThumb` (scaled 1280×720), `Viewer`.

## Security and privacy controls (new)
- Raw tokens: 32 random bytes, base64url. Shown once; only SHA-256 stored; never in a URL path, query string, server log or `Referer`. Verified: the dev server log shows only `GET /p` and `POST /api/briefing`.
- Revoked and unknown tokens are indistinguishable. Revocation is irreversible in the database.
- Rate limit can't be bypassed: anon and authenticated users have no execute right on the lookup.
- `/api/briefing` is `no-store`. `/p` and the API are `noindex` and `Referrer-Policy: no-referrer`. `X-Frame-Options: DENY` and `nosniff` site-wide; `X-Powered-By` off.
- New env var names: `SHARE_RATE_SALT` (server-only; required in production).

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |
| `npx vitest run` | exit 0, 80/80 (adds snapshot privacy, ordering, immutability, fingerprint, SlideSpec) |
| `npx supabase test db` | exit 0, 99 assertions across 6 files (24 new: grants, isolation, lookup, rate limit at the 61st call, revocation, cascade) |
| `npx playwright test` | exit 0, 41/41, zero hydration errors |
| `npx playwright test tests/e2e/publish.spec.ts --repeat-each=3` | exit 0, 21/21 (after the fixes below) |
| `npm run build` | exit 0 |

## Defects found and fixed during the phase
1. **Rate-limit bypass, caught in self-review before any test ran.** The first draft let anon call the lookup RPC directly with its own client hash and limit. It's now service-role-only via one server route, with a fixed limit (DEC-40, revising DEC-10).
2. Desktop slides collapsed to zero width (aspect ratio with `width: auto`). Fixed with size-container units.
3. Publish-screen thumbnails used the phone layout and clipped content. They now render the real 1280×720 slide, scaled.
4. "Republish" was enabled with no changes. It's now disabled ("Up to date") unless the fingerprint differs.
5. **Test infrastructure:**
   - pgTAP count assertions run as the table owner counted rows left by earlier E2E runs; now scoped to the test's ids.
   - Two E2E races: reading the link before rotation finished, and clicking Publish before hydration after a full page load.
   - A response-interception race in J03, replaced by querying the API from the player's own context.
6. **Environment:** the Mac ran out of memory (0.1 GB free, 8 GB compressed), so long E2E flows hung for 10+ minutes. Fixes: disabled the Supabase services Touchline doesn't use (Studio, analytics, realtime, storage, edge functions; 12 → 5 containers), and capped Playwright at 2 workers. I didn't touch any of the owner's other apps.

## Manual verification
Screenshots in `docs/evidence/phase-5/` from the production build: publish blocked, published with the link (token masked), all four public slides at 1280×720, phone title and lineup, revoked page. Reviewed by eye. A scan confirmed no token is present anywhere in `docs/` or `scripts/`.
Not yet checked: real phones and touch swipe (the swipe handler exists, but Playwright can't simulate a true swipe), Safari, Firefox, a screen reader pass, and rate limiting behind Vercel's real proxy headers.

## Known limitations
- PDF export (EXP-01) is Phase 6. The SlideSpec and SVG renderer are ready for it.
- The share link can't be re-displayed by design (DEC-39), only rotated.
- Rate-limit IP trust depends on the hosting platform's headers. This must be re-verified on the real deployment.
- Audit events are recorded but not shown in the UI yet.
- Analytics (Q-05) is still open.

## Next
Phase 6: PDF export from the same SlideSpec (Q-03: choose the engine), analytics decision (Q-05), 5v5/7v7/11v11 demo data, the full J01→J03 E2E, a traceability matrix against every P0, and the release gap assessment. Then deploy to Vercel + Supabase cloud, with your go-ahead.
