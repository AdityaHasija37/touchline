# Phase 7 evidence: release 1.1, matchday detail (M5)

Date: 20 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium. Change request: CR-01 (PLAN-004 §7).

## Why
A hands-on walkthrough of the deployed MVP, first as a captain and then as a player on a phone, found no bugs but a product gap: the briefing showed the team's shape, not each player's job. The product owner approved five enhancements inspired by Football Manager and EA FC, sized for grassroots teams.

## Requirement IDs
LINE-01, LINE-02, SETP-01, SUBS-01, VIEW-01 (PRD-001 §5.1); QA-11 to QA-15 (PLAN-004 §4); decisions D-06 to D-08 and DEC-49 to DEC-58.

## User-facing behaviour
- **Squad on the pitch.** A formation select on the lineup panel. Starters fill the best-fit free slot; tapping a slot opens a player picker that swaps or benches. Each slot has a fit ring (natural / can cover / out of position), also in its accessible name. The list view is unchanged for keyboard use.
- **Roles and duties.** Per starter: role (filtered to the slot's line), duty (filtered to the role) and a one-line instruction. Changing slot keeps a role that still fits, otherwise picks the slot's default.
- **Set pieces.** Captain, penalties, free kicks, corners left/right, long throws (starters only) and up to 11 marking jobs.
- **Sub plan & minutes.** Match length (40/60/90 by default), sub rows with inline problems, planned-minutes bars, and an under-half warning.
- **Checklist.** Three new non-blocking warnings: out-of-position starters, subs that don't work, players under half the match.
- **Briefing.** New slide order: Title → Starting lineup (on a pitch with names, roles and instructions) → Set pieces → Sub plan → sections. The same slides appear in the presenter, phone view and PDF.
- **Find me.** A header button on the public briefing: pick your name, see your card, and highlight yourself on every slide.
- **Demo sandbox** now ships with a 2-3-1 formation, roles, instructions, set pieces and a three-sub rolling plan; the tour points at them.

## Implementation
- Migration `20261021000000_roles_setpieces_subs.sql`: lineup role/duty/instruction columns with checks; `match_plans.formation_id`, `set_pieces`, `sub_plan` (size-capped JSON); `save_lineup` v2; analytics allowlist for adoption counts.
- Domain: `lib/domain/roles.ts`, `minutes.ts`, `lineup-slots.ts`, `lineup-board.ts`; `snapshot.ts` (player keys, new optional fields, `playerCard`, canonical fingerprint); `slides.ts` (setpieces, subs); `plan-readiness.ts` (warnings).
- Server actions: `saveLineup` (explicit slots, roles), `updateFormation`, `saveSetPieces`, `saveSubPlan`; `publishPlan` adoption props.
- UI: `lineup-panel.tsx`, `set-pieces-panel.tsx`, `sub-plan-panel.tsx`, `use-serial-save.ts`, `find-me.tsx`, `slide-view.tsx`, `viewer.tsx`, `briefing-pdf.tsx`; the board renderer gained `captions` and `highlight`.
- Docs: PRD, UX, Tech and QA specs to v1.1; brief M5; DECISIONS, TRACEABILITY, RELEASE-ASSESSMENT, IMPLEMENTATION-MAP, case study, README.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |
| `npx vitest run` | exit 0, 120/120 in 14 files (adds roles, minutes, pitch slots, snapshot keys, back-compat parse, playerCard, key-order fingerprint) |
| `npx supabase test db` | exit 0, 133 assertions in 9 files (adds `008`: role/duty/instruction checks, explicit slots, JSON shape and size caps, other-user denial, analytics allowlist) |
| `npx playwright test` | **Against `next dev`: 47/52 and 48/52**, with different tests timing out each run (sign-in redirects, tactic creation, library duplicate; areas this release didn't touch), all passing when rerun alone; the machine was under memory pressure while the dev server compiled on demand. **Against the production build (`next start`): exit 0, 52/52 in 1.6 min.** New: `plan-extras.spec`, a 1.1 accessibility test, and extended `demo.spec` |
| axe WCAG 2.2 AA (`a11y.spec`, now also the pitch builder, three new slides and the Find me dialog) | no serious or critical violations after the fix in defect 3 |
| `npm run build` | exit 0 |
| PDF of the demo plan rendered and rasterised (`scripts/render-pdf-pages.mjs`) | 7 pages in slide order; pitch, set pieces and sub plan reviewed by eye |

## Defects found and fixed
1. **An unchanged plan showed "Your draft has changes" after publishing** (E2E `pdf.spec`). Postgres `jsonb` reorders object keys, and the new `markerRefs` record broke the string comparison. The fingerprint now sorts keys (DEC-57), with a regression unit test.
2. **Lineup slide overflowed sideways on phones.** Long role/instruction lines widened the grid's auto track; the grids now use `minmax(0, 1fr)`. A 375 px no-overflow check now covers all three new slides.
3. **Scrollable slides weren't keyboard-reachable** (axe, serious): the phone lineup slide scrolls now. The viewer's slide body is focusable, with a visible focus ring; thumbnails are unchanged.
4. **The lineup slide was cut off at 16:9 on desktop.** Starters now sit in two compact columns beside the pitch, and the bench is shown inline.
5. Small fixes from review: the Find me sub times are now in time order; the PDF position label no longer collides with a wrapped instruction; the set-piece selects no longer truncate names.
6. Test updates for the new slide order (`demo.spec`: "Our press" moved from slide 3 to slide 5).

## Screenshots (`phase-7/`)
01 plan overview · 02 lineup pitch with roles · 03 slot picker · 04 set pieces · 05 sub plan · 06–08 new slides at 1280×720 · 09 Find me card on a phone · 10–11 highlight on the lineup and on a board.

## Known limitations
- Matching a role to the player's line is a UI rule, not enforced by the server (DEC-49).
- Find me isn't measured, by design (DEC-55).
- Set-piece jobs held by a player who is later benched stay in the private plan until the next set-piece edit; they're never published.
- Not tested on a real phone (unchanged from Phase 6).
