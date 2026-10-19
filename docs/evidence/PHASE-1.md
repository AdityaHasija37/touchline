# Phase 1 evidence: Auth, teams, squad (M1)

Date: 19 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, Chromium.

## Requirement IDs
AUTH-01, TEAM-01, TEAM-02, SEC-01 (QA-01, QA-02). Part of NFR-01: the 375 px no-overflow check on the screens built so far.

## User-facing behaviour
- Register with email confirmation (Mailpit locally). Sign in, sign out, and password reset by email link.
- Visiting `/app/*` signed out redirects to `/login?next=…` and resumes there after sign-in.
- S01 dashboard: team cards with format, colour and active player count. First-run empty state.
- S02 team setup: name (2–60), format 5/7/11, and named colour swatches, with inline validation.
- Team overview: edit details, squad summary, and delete behind a typed-name confirmation.
- S03 squad: add, edit (dialog), archive and restore players. Archived players are hidden from the active list but kept.

## Routes / components added
`proxy.ts`, `app/(auth)/{login,register,reset-password,reset-password/update}`, `app/auth/confirm`, `app/(app)/app/teams/{(list),new,[teamId],[teamId]/squad}`, plus placeholder tactics and matches tabs. Components: `components/{brand,forms,app,teams}`. Libraries: `lib/{supabase,auth,db,validation}`.

## Schema migration
`supabase/migrations/20261019191305_foundation_teams_players.sql`: profiles (with sign-up trigger), teams, players, `is_team_owner()`, triggers that block owner and team changes, CHECK constraints, indexes, RLS, and least-privilege grants (anon gets none; players can't be deleted).

## Security controls
RLS on every table. Server actions re-verify the session and validate with Zod. A foreign or invalid id returns a generic 404 (no existence disclosure). `next` redirects are restricted to same-site paths. Sign-up and reset give the same response whether or not an account exists (no enumeration). `/app/*` responses are `private, no-store`. The service-role key appears only in local test and seed helpers, which refuse non-local URLs.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx vitest run` | exit 0, 14/14 tests |
| `npx supabase test db` | exit 0, 26/26 assertions (24 RLS/constraint + 2 smoke) |
| `npx playwright test` | exit 0, 10/10 tests |
| `npx playwright test tests/e2e/responsive.spec.ts --repeat-each=8` | 8/8 after fixing the overflow |
| `npm run build` | exit 0 |

## Defects found by tests and fixed
1. Foreign team URLs rendered "Page not found" with HTTP **200**, because `loading.tsx` streamed the response before `notFound()` ran. Moved the loading boundary into a `(list)` route group; the status is now 404.
2. At 375 px, long team names overflowed: grid items lacked `min-w-0`, and the delete button's nowrap label included the team name. Fixed both.

## Manual verification
Screenshots in `docs/evidence/phase-1/` (taken from the production build, desktop 1280 px and phone 375 px), reviewed by eye. Not yet checked by hand: Safari and Firefox, a real phone, screen reader.

## Known limitations
- Tactics and Matches tabs are placeholders.
- No audit events or analytics yet (planned for Phase 5/6).
- No rate limiting on auth beyond Supabase defaults.
- Changing team format only shows a note; real draft conversion arrives when tactics and lineups exist (DEC-13).

## Risks / next
Phase 2 (tactics editor core) is the highest-risk slice: pointer and touch geometry on Konva. Recommend a small feasibility spike on drag plus 0–100 mapping first.
