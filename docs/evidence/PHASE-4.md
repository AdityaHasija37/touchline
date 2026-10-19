# Phase 4 evidence: Fixtures, lineups and match plans (M3, first half)

Date: 19 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium (Europe/London timezone in tests).

## Requirement IDs
MATCH-01, MATCH-02, PLAN-01, SEC-01. QA-05 (6 of 7 starters means publish is disabled and the draft is kept). Publishing, snapshots and sharing (PRES-01/02) are Phase 5.

## User-facing behaviour
- **S06 match list:**
  - Upcoming fixtures in date order (until 3 hours after kickoff) and past fixtures newest first.
  - Each card shows lineup status ("6/7 starters" or "Lineup complete").
  - Empty state, plus an "Add fixture" dialog with inline validation and a note naming the timezone in use.
- **S01 dashboard:** each team card shows its next fixture.
- **S07 match plan:**
  - *Header:* opponent, kickoff in the fixture's own timezone, venue, Edit fixture (keeps the original zone), Delete (the dialog lists exactly what's removed), and a "Draft · private to you" label.
  - *Lineup:* squad picker with Start and Bench. The starter count is capped at the format and Start disables at the limit. Starters get editable position labels that default from preferred positions; you can move starters to the bench and back, or remove them. Archived players aren't offered but stay where already picked (flagged). Saves are atomic with a Saving…/Saved status and a Retry banner on failure.
  - *Briefing sections:* match objective (≤280 characters); sections for tactic boards (picked from the library, with thumbnail), notes or final reminders, each with title, phase, player notes, a **private note that's never shared**, and an "include in briefing" toggle; reorder up/down; remove.
  - *Readiness checklist:* blocking items and warnings with icons and text (not colour alone); "Preview & publish" stays disabled while anything blocks; a privacy notice.
- 375 px: every Phase 4 screen stacks into one readable column with no horizontal overflow.

## Schema migrations
- `20261019210000_matches_plans.sql`:
  - Tables: `matches` (timezone, own format), `match_plans` (one per match, version bump), `lineup_assignments` (PK plan+player, unique slots, starter-only slots), `plan_sections` (type, phase/notes/private notes in JSON, tactic `on delete set null`, inclusion, order).
  - Helpers: `is_match_owner`, `is_plan_owner`, `plan_context`.
  - Triggers: starter cap, same-team player and tactic, no moving rows between plans or matches.
  - RLS and column-level grants; RPCs `save_lineup` (atomic replace) and `move_plan_section`.
- `20261019220000_lineup_fk_cascade.sql`: corrective, see defect 1.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx vitest run` | exit 0, 73/73 (adds timezone and DST edges, lineup and section schemas, readiness) |
| `npx supabase test db` | exit 0, 5 files (adds 28 plan assertions + 4 cascade regressions) |
| `npx playwright test` | exit 0, 34/34, now with an auto fixture that fails any test on a hydration or uncaught page error |
| `npx playwright test tests/e2e/matches.spec.ts --repeat-each=2` | exit 0, 14/14 (before the regression test was added) |
| `npm run build` | exit 0 |

## Defects found and fixed
1. **Deleting a team or account with any lineup failed.** The lineup→player FK was `RESTRICT`, which Postgres checks before the longer team→match→plan→lineup cascade has run. `NO ACTION` has the same ordering problem. Fixed with a corrective migration to `CASCADE`. That's safe because users have no DELETE privilege on players (archive-only), and published briefings will be immutable snapshots. Regression tests added in pgTAP and E2E. This was found because the demo seed script couldn't re-create its account, and the script also swallowed that error (now fixed).
2. **Hydration mismatch on fixture times:** Node printed "GMT" where Chromium printed "GMT+0". Kickoff labels are now formatted on the server only (DEC-36), and the E2E suite now fails on any hydration error. A deliberate negative check confirmed the fixture catches errors.
3. **DST ambiguity:** 01:30 on the autumn change day resolved to the later instant. The conversion now considers offsets 12 hours either side and picks the earliest valid instant; the spring-gap rule is unchanged. Unit-tested.
4. **Plan page overflowed by 136 px at 375 px** with long opponent names (grid items' `min-width: auto`). Fixed at the root grid.

## Manual verification
Screenshots in `docs/evidence/phase-4/` from the production build: dashboard with next match, match list, add-fixture dialog, plan blocked at 6/7, attach-tactic dialog, phone plan. Reviewed by eye.
Not yet checked: Safari, Firefox, screen reader, real phones.

## Known limitations
- Publish and preview arrive in Phase 5. The button is intentionally disabled with an explanation.
- Plan text fields are last-write-wins (DEC-37). Two tabs editing the same section would overwrite each other's field values.
- The strict-errors E2E fixture only watches the default browser context. Tests that open extra contexts (isolation tests) aren't covered by it.
- No fixture status changes (played/cancelled) in the UI yet. The column exists, defaulting to scheduled.

## Next
Phase 5: immutable published snapshots (with private notes stripped and player names and numbers resolved), hashed share tokens with revocation, the SlideSpec model, a full-screen matchday viewer, and the public `/p/:token` page (PRES-01/02, QA-06/07/09/10).
