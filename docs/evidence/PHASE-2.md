# Phase 2 evidence: Tactics editor core (M2)

Date: 19 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium.

## Feasibility spike (done first)
A Konva drag plus the 0–100 mapping was prototyped on a throwaway dev route, then deleted. A real stepped mouse drag to pitch (20, 30) landed at (19.9–20.0, 30.1) at both 1280 px and 1024 px. Drags 2000 px off the pitch clamp to (0, 100). Konva loads client-only via `next/dynamic` with `ssr: false`. **Outcome: approach kept.** Not covered: true touch drags (Playwright can't simulate them), which need a manual tablet check.

## Requirement IDs
TAC-01 (presets and blank pitch), TAC-03 (create, rename, duplicate, save, reopen, delete), part of TAC-02 (drag players and ball; geometry 0–100; moves never change player IDs), SEC-01, NFR-01 (non-canvas alternatives; view-only at narrow widths). QA-03 and QA-04.
Deferred to Phase 3: drawing tools for arrows, lines, zones and text (already in the v1 schema and renderers), erase, undo/redo (TAC-04).

## User-facing behaviour
- S04 library: cards with an SVG thumbnail, type, format and edit time; duplicate; delete with confirmation; first-run empty state.
- New tactic: name, type, and a start from the format's presets (3 per format) or a blank pitch, each previewed.
- S05 editor (≥1024 px):
  - Header: breadcrumb, inline rename and type change (with a Saved indicator), save status, Save button.
  - Left toolbar: add own player, opponent or ball, each capped and disabled at the limit.
  - Konva pitch: drag with clamping, click to select, arrow keys nudge (Shift ×5), Delete removes, Esc deselects.
  - Inspector: link a squad player, edit the label, type exact x/y, remove; a list of every object for keyboard and screen-reader users; orientation setting.
  - Saving: autosave, Cmd/Ctrl+S, a save-failed banner with Retry (edits kept), a conflict banner with "save as copy" or "discard and reload", and a leave-page warning while unsaved.
- Below 1024 px: a read-only SVG of the board plus an explanation.

## Routes / components / domain
`/app/teams/[teamId]/tactics`, `/app/tactics/[tacticId]`. `lib/domain/{pitch,pitch-markings,formations,board-ops,colors}.ts`, `lib/validation/board.ts`, `lib/db/tactics.ts`, `components/board/board-svg.tsx` (the shared deterministic renderer for the presenter and PDF later), `components/tactics/**`.

## Schema migration
`20261019200000_tactics.sql`: the tactics table with a board-shape CHECK (schema version, format match, objects array, ≤200 objects, ≤256 KB); a versioning trigger (server-owned, increments only on board changes); a trigger blocking team changes; RLS through `is_team_owner`; column-level UPDATE grants (`name`, `category`, `board_json` only).

## Security controls
- RLS plus column grants.
- Zod strips unknown fields and validates bounds, duplicate IDs, duplicate players, per-side caps and the ball count.
- The server checks that linked player IDs belong to the team.
- A stale `expectedVersion` returns a conflict, with no silent overwrite (enforced both in the action and in the conditional UPDATE).
- Foreign tactic IDs return a 404.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx vitest run` | exit 0, 45/45 (geometry, formations, schema, ops, colour contrast, plus Phase 1) |
| `npx supabase test db` | exit 0, 60 assertions across 3 files (17 new for tactics) |
| `npx playwright test` | exit 0, 19/19 |
| `npx playwright test tests/e2e/tactics.spec.ts --repeat-each=3` | exit 0, 27/27 |
| `npm run build` | exit 0 |

## Defects found and fixed during the phase
1. Grass-green team markers were near-invisible on the pitch. Added a 3:1 contrast rule (DEC-23), unit-tested for every team colour.
2. Formation thumbnails duplicated their names for screen readers. Thumbnails inside labelled controls are now `aria-hidden`.
3. Rename and type changes saved silently, so an immediate reload could drop them. Added a visible Saving…/Saved status.
4. The demo seed script couldn't find its account after more than 50 users (pagination). It now walks every page.
5. React Compiler lint errors (refs read during render, setState in effects). Refactored to `useState` initialisers, keyed remounts and a closure-based saver.

## Manual verification
Screenshots in `docs/evidence/phase-2/` from the production build: library, new-tactic dialog, editor with a selection, horizontal orientation, phone view-only, phone library. Reviewed by eye.
Not yet checked: real touch devices, Safari, Firefox, a screen reader pass, editor performance with a large number of objects.

## Known limitations
- No undo/redo or drawing tools yet (Phase 3).
- Marker labels are copied when a player is linked, so renaming the player later doesn't update the label. Published snapshots (Phase 5) will resolve names at publish time.
- Changing a team's format doesn't convert existing tactics; each keeps its own format (DEC-13). Lineup-related conversion arrives with Phase 4.
- The editor sits inside the app's 1152 px content width; a wider canvas could be considered.

## Next
Phase 3: arrow, line, zone and text tools; erase; undo/redo with a 30-step history (TAC-04). `applyOp` already funnels every mutation, so history becomes a wrapper around it.
