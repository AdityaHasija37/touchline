# Requirements traceability matrix

Generated at the Phase 6 release check (20 Oct 2026) and updated for release 1.1 the same day. Status reflects tests **actually run**; see `docs/evidence/PHASE-6.md` and `docs/evidence/PHASE-7.md` for the commands and exit codes.
Legend: ✅ implemented and covered by passing automated tests · 🟡 partially implemented or partially verified · ❌ missing.

| ID | Pri | Requirement (PRD-001) | Status | Implementation | Automated evidence |
|---|---|---|---|---|---|
| AUTH-01 | P0 | Register, log in, log out, reset password; private URLs redirect to login | ✅ | `app/(auth)/*`, `app/auth/confirm`, `proxy.ts`, `lib/auth/session.ts` | E2E `auth.spec` (5 tests incl. email confirm and reset via Mailpit, QA-01); `journey.spec`; unit `validation.test` (safe redirects) |
| TEAM-01 | P0 | Team name 2–60, colour, format 5/7/11; owner-only edit/delete | ✅ | `app/(app)/app/teams/*`, migration 0001 | E2E `teams.spec`; pgTAP `001` (constraints, owner-only); unit `validation.test` |
| TEAM-02 | P0 | Players 1–60 chars, optional number, positions, archive; stable ids; history kept | ✅ | `components/teams/squad-manager.tsx`, migration 0001 (no DELETE grant, team-change guard) | E2E `teams.spec`, `matches.spec` (archived players), `publish.spec` QA-10; pgTAP `001`, `004` |
| TAC-01 | P0 | Start from a preset matching the format, or blank; 7v7 preset = exactly 7 markers | ✅ | `lib/domain/formations.ts`, `components/tactics/new-tactic-dialog.tsx` | Unit `board.test` (every preset × format); E2E `tactics.spec` (TAC-01 ×2) |
| TAC-02 | P0 | Drag players/ball; arrows, lines, zones, text; editable; moving never changes player id; 0–100 coords | ✅ | `lib/domain/board-ops.ts`, `components/tactics/editor/*` | Unit `board.test`, `tools.test`, `pitch.test`; E2E `tactics.spec`, `tools.spec` (7 tests incl. horizontal) |
| TAC-03 | P0 | Create, rename, duplicate, update, delete; save visible; reopen recovers; no cross-team leakage | ✅ | `app/(app)/app/tactics/actions.ts`, migration 0002 (server-owned version) | E2E `tactics.spec` (QA-03, QA-04, save failure, library, SEC-01); pgTAP `002` |
| TAC-04 | P1 | Undo/redo 30 actions; exact restore; new action clears redo | ✅ | `lib/domain/history.ts`, editor store | Unit `history.test`; E2E `tools.spec` TAC-04 |
| MATCH-01 | P0 | Fixture: opponent, timezone-aware kickoff, optional venue; one team | ✅ | `lib/domain/time.ts`, migration 0003 | Unit `matches.test` (DST edges); E2E `matches.spec` MATCH-01 |
| MATCH-02 | P0 | Unique starters/bench with positions; max starters = format; draft may be incomplete, can't publish | ✅ | `components/matches/lineup-panel.tsx`, `save_lineup` RPC + trigger | Unit `matches.test`; pgTAP `003`; E2E `matches.spec` MATCH-02 + QA-05 |
| PLAN-01 | P0 | Ordered tactic boards, objective, phase labels, notes; draft; tactics copied into the snapshot | ✅ | `components/matches/*`, `lib/domain/snapshot.ts` | E2E `matches.spec` PLAN-01, `publish.spec` QA-06; unit `snapshot.test`; pgTAP `003` |
| PRES-01 | P0 | Title, starters, boards, notes, reminders full-screen; stored order; keyboard; readable at 1280×720 | ✅ | `lib/domain/slides.ts`, `components/slides/*`, `/app/plans/:id/present` | Unit `snapshot.test` (SlideSpec order); E2E `publish.spec` J03 + presenter; screenshots at 1280×720 |
| PRES-02 | P0 | Read-only snapshot behind an unguessable token; revocable; only included content | ✅ | migration 0005, `app/(app)/app/plans/actions.ts`, `/p`, `/api/briefing` | pgTAP `005` (24 incl. rate limit, revocation, no direct anon access); E2E `publish.spec` (J03 privacy, QA-07, bad tokens, link switching); unit `snapshot.test` |
| EXP-01 | P0 | Export the published plan to PDF; same order; meaningful diagrams; source unchanged | ✅ | `lib/pdf/briefing-pdf.tsx`, `lib/domain/board-render.ts`, `/api/plans/:id/pdf`, `/api/briefing/pdf` | Unit `pdf.test` (5/7/11, Unicode names), `board-render.test`; E2E `pdf.spec` (QA-08, 5v5, 11v11, endpoint security), `journey.spec` |
| SEC-01 | P0 | User A can't read or edit user B's records via URLs or direct requests | ✅ | RLS + column grants on every table; generic 404s | pgTAP `001`–`006` (anon / owner / other user on every table); E2E isolation tests in 5 specs |
| LINE-01 | P1 | Role (filtered to the line), duty (allowed by the role) and ≤ 140-char instruction per starter; bench has none; shown on lineup slide, phone and PDF | ✅ | `lib/domain/roles.ts`, `components/matches/lineup-panel.tsx`, `save_lineup` (migration 0009) | Unit `roles-minutes.test`, `lineup-slots.test`, `snapshot.test`; pgTAP `008` (duty/slug/bench checks); E2E `plan-extras.spec`, `demo.spec` |
| LINE-02 | P1 | Formation per plan; one starter per slot; best-fit placement; swap/bench from the pitch; fit indicator in colour and text; non-blocking warning; pitch on the lineup slide | ✅ | `lib/domain/lineup-slots.ts`, `lib/domain/lineup-board.ts`, `updateFormation` action | Unit `lineup-slots.test`; pgTAP `008`; E2E `plan-extras.spec` (placement, swap, warning, reload), `a11y.spec` (1.1) |
| SETP-01 | P1 | Captain, penalties, free kicks, corners L/R, long throws, ≤ 11 marking jobs; starters only (server-checked); stale jobs dropped; slide only when set | ✅ | `components/matches/set-pieces-panel.tsx`, `saveSetPieces` action, `setPiecesSchema` | Unit `snapshot.test` (starters-only, ids → keys); pgTAP `008` (shape, owner-only); E2E `plan-extras.spec`, `demo.spec` |
| SUBS-01 | P1 | Match length by format; valid-sub rules; inline problems; invalid subs excluded; under-half warning; minutes bars; slide only with a valid sub | ✅ | `lib/domain/minutes.ts`, `components/matches/sub-plan-panel.tsx`, `saveSubPlan` action | Unit `roles-minutes.test` (chains, re-entry, invalid subs), `snapshot.test`; pgTAP `008` (size cap); E2E `plan-extras.spec`, `demo.spec` |
| VIEW-01 | P1 | Find me card (position, role, instruction, jobs, subs, minutes, boards); Highlight on every slide; client-only; no ids; old briefings still open | ✅ | `components/publish/find-me.tsx`, `playerCard()` in `lib/domain/snapshot.ts`, renderer `highlight` option | Unit `snapshot.test` (playerCard, back-compat parse, no ids); E2E `plan-extras.spec` (API body has no UUIDs), `a11y.spec` (dialog) |
| NFR-01 | P0 | Desktop-first editor; mobile-readable briefing at 375 px; keyboard focus; non-canvas alternatives | 🟡 | Inspector list + numeric fields, keyboard nudge, focus rings, view-only editor < 1024 px | E2E `a11y.spec` (axe WCAG 2.2 AA, 13 screens, no serious/critical); 375 px overflow tests in 4 specs. **Not done:** manual screen-reader pass, real-phone test |

## QA test matrix (PLAN-004 §4)
| Test | Scenario | Status | Where |
|---|---|---|---|
| QA-01 | Signed-out user opens a private page | ✅ | `auth.spec` |
| QA-02 | User A opens user B's tactic | ✅ | `tactics.spec` SEC-01, `isolation.spec`, pgTAP `002` |
| QA-03 | Move a player, add an arrow, reload | ✅ | `tools.spec` QA-03, `tactics.spec` QA-03 |
| QA-04 | Same tactic saved from two stale tabs | ✅ | `tactics.spec` QA-04, pgTAP `002` |
| QA-05 | 7v7 plan with 6 starters | ✅ | `matches.spec` |
| QA-06 | Publish, then edit the original tactic | ✅ | `publish.spec` QA-06 |
| QA-07 | Revoke the link, then open it | ✅ | `publish.spec` QA-07 |
| QA-08 | Export the published plan | ✅ | `pdf.spec` QA-08, unit `pdf.test` |
| QA-09 | View the published plan on a phone | 🟡 | `publish.spec` QA-09 (375 px emulation). A real device isn't tested |
| QA-10 | Archive a player used historically | ✅ | `publish.spec` QA-10 |
| QA-11 | Swap a defender into a forward slot | ✅ | `plan-extras.spec` (fit text, checklist warning, swap back) |
| QA-12 | Bench a player who holds a set-piece job, then publish | ✅ | unit `snapshot.test` (job dropped); server rejects non-starters in `saveSetPieces` |
| QA-13 | Sub a player who isn't on the pitch | ✅ | unit `roles-minutes.test`, `snapshot.test` (excluded); UI inline problem verified in browser |
| QA-14 | Player opens Find me on a 375 px phone | ✅ | `plan-extras.spec`, `a11y.spec` (1.1), `demo.spec` (no overflow on new slides) |
| QA-15 | Open a briefing published before 1.1 | ✅ | unit `snapshot.test` (v1 back-compat parse → title + lineup slides) |

## TECH-003 §9 test strategy
| Layer | Status |
|---|---|
| Unit: schema, clamping, lineup capacity, slide order, inclusion, roles, minutes, pitch slots | ✅ 14 files |
| Integration: tenancy, optimistic concurrency, revocation, snapshot immutability | ✅ pgTAP (9 files) + E2E |
| E2E: new user → … → PDF | ✅ `journey.spec` |
| Visual regression: boards and PDF for 5/7/11 | 🟡 Shared render primitives guarantee identical shapes; PDF text/order parity is automated; pages were reviewed by eye. No pixel golden-file comparisons |
| Accessibility: focus, labels, contrast, keyboard | 🟡 axe automated (contrast, labels, roles) + keyboard E2E; reduced motion respected in CSS but not tested |
| Database: RLS allow/deny in CI | 🟡 Runs locally (`npm run test:db`); no CI pipeline exists yet |
