# Phase 3 evidence: Tactical tools and history (M2, completed)

Date: 19 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium.

## Requirement IDs
TAC-02 (complete), TAC-04. QA-03 in full (move a player, add an arrow, reload: identical geometry and style). Library duplication (TAC-03) was already delivered in Phase 2.

## User-facing behaviour
- **Toolbar:** Select (V), Arrow (A), Line (L), Zone (Z), Text (T), Erase (E), then add player, opponent or ball. The active tool is announced via `aria-pressed` and in the pitch's accessible name.
- **Arrow:** drag from start to end, in Run (dashed), Pass (solid) or Dribble (dotted). Once selected, endpoint handles can be dragged, start and end can be typed as numbers, and you can drag the arrow to move both ends.
- **Line:** same as arrow, without a style.
- **Zone:** drag a rectangle in any direction. Semi-transparent fill, optional label (≤40 characters), five named colours, corner resize handles, numeric x/y/width/height. Minimum size 3 × 3.
- **Text:** click to place a ghost, type in the side panel, Enter adds, Esc cancels. 240-character limit with a live counter. Edit later in the inspector (Enter saves, Esc reverts).
- **Erase:** click an item to remove it. Delete/Backspace still removes the selected item.
- **Undo/Redo:** buttons plus Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y. Buttons disable when there's nothing to undo or redo. The last 30 actions are kept, and a new action clears redo. Undone states autosave like any edit.
- Tiny drags count as clicks, so stray clicks don't create arrows.

## Implementation
- `lib/domain/board-ops.ts`: new ops `add-arrow`, `add-line`, `set-endpoint`, `set-arrow-style`, `add-zone`, `set-zone-rect`, `update-zone`, `add-text`, `edit-text`. All pure, with clamping and validation.
- `lib/domain/history.ts`: generic immutable history (record/undo/redo, 30-step cap, no-ops skipped).
- `lib/domain/text-wrap.ts`: shared word wrap.
- `components/tactics/editor/*`: store (tool, arrow style, pending text, history), canvas (draws through `getRelativePointerPosition` so it works when rotated; handles with live preview; draft shapes), inspector panels, toolbar and shortcuts.
- No schema migration: board JSON v1 already covered these kinds.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx vitest run` | exit 0, 59/59 (adds tool ops, history and text wrap) |
| `npx supabase test db` | exit 0 (unchanged, 60 assertions) |
| `npx playwright test` | exit 0, 26/26 |
| `npx playwright test tests/e2e/tools.spec.ts --repeat-each=3` | exit 0, 21/21 |
| `npm run build` | exit 0 |

## Defects found and fixed during the phase
1. The text-placement input lost focus to the pitch, because the placing click focuses the pitch after the input mounts. It now focuses on the next animation frame.
2. Changing an arrow's style right after drawing edited that arrow, not the next one. Unified this as "last used style" (DEC-28).
3. Notes wrapped in the editor but not in the SVG renderer (a parity risk for the presenter and PDF). Added a shared deterministic wrap (DEC-30).
4. The object list truncated notes with a dangling space. It now uses an ellipsis.

## Not verified / known limitations
- Touch drawing on real tablets hasn't been tried (the editor is desktop-first; mobile is view-only).
- One early probe screenshot showed the Line tool still highlighted after pressing V. I couldn't reproduce it in two follow-up runs, and the E2E suite asserts tool state via `aria-pressed`. I'm treating it as a stale frame, but it's noted here.
- Overlapping objects: clicking picks the top-most one (by z-order: zone < line < arrow < text < player < ball). There's no "select underneath" yet. The object list in the inspector reaches anything.
- No free zoom or pan (DEC-29).

## Next
Phase 4: fixtures (MATCH-01), lineups with starters and bench (MATCH-02), and ordered match-plan sections with attached tactics (PLAN-01). This needs migration 0003.
