*TOUCHLINE / UX-002*

# UX Blueprint & Screen Specifications

Information architecture, primary journeys, interaction states, content rules and handoff

| Version 1.1 | Status: MVP shipped; 1.1 in build | Owner: Product | 20 Oct 2026 |
|---|---|---|---|

Revision history: **0.9** (17 Oct 2026) original. **1.1** (20 Oct 2026) adds the pitch builder, roles, set pieces and sub plan to S07, Find me to S09/S10, journey J05, and new microcopy (PRD-001 §5.1).

Decision status: Proposed specification. Assumptions, targets, and design choices require validation; no user research or shipped capability is claimed.

## 1. Experience principles

- Coach-first, not analyst-first: recognizable football language; defaults should work without a tutorial.
- One source of truth: a player and a saved tactic can be reused across fixtures.
- Presentation is the output, not an afterthought: the draft UI makes publication state clear.
- Low friction: templates, duplicate, autosave, keyboard shortcuts and clear error recovery.
- Private by default: visibility is explicit and published content is previewed before sharing.

## 2. Information architecture

Authenticated: /app → /app/teams → /app/teams/:teamId (Overview, Squad, Tactics, Matches) → /app/matches/:matchId/plan → /app/plans/:planId/present. Public: /p/:shareToken (read-only). Account: /login, /register, /reset-password.

## 3. Navigation and screen contracts

| Screen | Primary action | Content / empty state | Responsive expectation |
|---|---|---|---|
| S01 Team Dashboard | Create / open team | Team cards, upcoming matches, recently edited tactics; first-run CTA | Single-column on mobile |
| S02 Team Setup | Save team | Name, format, color; inline validation | Single-column form |
| S03 Squad | Add / edit player | Player list, shirt number, role, archive; first-player CTA | Card view on narrow screens |
| S04 Tactics Library | Create tactic | Cards with names, types, modified date; duplicate / delete | 2-column desktop, 1-column mobile |
| S05 Tactics Editor | Save tactic | Toolbar, pitch canvas, layers, undo/redo, board properties | Optimized >= 1024px; mobile view-only in MVP |
| S06 Match List | Create match | Fixture cards sorted by date; no-fixtures CTA | Stacked cards mobile |
| S07 Match Plan | Prepare plan | Lineup selector, tactic attachments, notes, section order | Mobile readable; editing primarily desktop |
| S08 Preview / Publish | Publish / revoke | Review included sections, link state, privacy notice | Full mobile support |
| S09 Matchday Viewer | Navigate slides | Full-screen slides, next/back, jump list | Touch swipe and keyboard |
| S10 Public Share | View plan | Same published slides, no edit, expiry/revocation state | Mobile-first view |

## 4. Critical end-to-end journeys

### J01 First-time captain

Register → create team → add 7 players → create 7v7 tactic → drag players → save → confirm tactic in library

Exception / recovery: If authentication interrupted, resume after login; do not discard previously submitted records.

### J02 Prepare a match

Open team → create fixture → select starters → attach tactic → add objectives → reorder slides → preview

Exception / recovery: Publishing is blocked if starting lineup incomplete; user can retain draft.

### J03 Present and share

Preview → publish immutable snapshot → full-screen present → copy token link → export PDF

Exception / recovery: Revoked link yields a safe unavailable state; original draft stays private.

### J04 Reuse strategy

Duplicate prior tactic or plan → edit copy → save under new name → use for next match

Exception / recovery: Edits to a copy never mutate the original or previously published briefings.

### J05 Player finds their job (1.1)

Open shared link on a phone → tap **Find me** → choose own name → read personal card (position, role and duty, instruction, set pieces, sub minutes, boards) → **Highlight me** → swipe through slides with own marker and rows highlighted → **Clear**

Exception / recovery: A briefing published before 1.1 has no player keys, so Find me is hidden and the slides work as before. A player not in the match squad isn't listed.

## 5. Tactics canvas interaction specification

| Mode | Input | Result / state feedback |
|---|---|---|
| Select / move | Click marker; drag; arrow keys nudge selected | Selected outline; save dirty indicator; bounds clamped to pitch |
| Arrow / pass | Choose tool, drag origin to endpoint | Visible directional line, selectable and deletable |
| Zone | Drag rectangular region | Semi-transparent zone label and resize handles |
| Text | Place text then edit in side panel | Esc cancels; Enter commits; character limit 240 |
| Undo / redo | Ctrl/Cmd+Z / Shift+Z | History max 30 actions; disabled control when empty |
| Save | Ctrl/Cmd+S or Save | Saving… then Saved timestamp; retry on error |

Canvas geometry convention: pitch-space x increases left to right and y increases top to bottom, both 0–100. Rendering orientation is stored per board. Game entities are not rasterized to pixels for persistence.

## 6. Wireframe-by-region specification

### S05 · Editor

Top header: breadcrumb, tactic name, unsaved indicator, Save. Left toolbar: move, arrow, zone, text, erase. Center: responsive pitch and markers. Right inspector: selected object data, notes, color. Bottom: Undo, Redo, Zoom fit and help.

### S07 · Match Plan

Left: fixture details and lineup/bench selection. Center: ordered sections and attached tactics. Right: privacy controls, validation checklist, Preview/Publish CTA.

1.1 additions:
- **Lineup (left).** A *Formation* select ("None (list only)" keeps the MVP list). With a formation, a pitch shows one button per slot: shirt number and surname, ringed by fit (green natural, amber can cover, red out of position; the fit is also in the button's accessible name). Selecting a slot opens a player picker for it, listing starters, bench and squad with their fit; choosing an occupied player swaps them. Under each starter: *Role* and *Duty* selects (filtered to the slot's line) and a *Personal instruction* field. The list view and its Start / Bench / Move to bench buttons remain the keyboard-first path.
- **Set pieces (center, under the objective).** A select per job (Captain, Penalties, Free kicks, Corners left/right, Long throws) listing only starters, and a *Marking* list with player + "Marks…" text and Add / Remove.
- **Sub plan & minutes (center).** Match length, rows of minute + Off + On, inline problem text per invalid row, and a *Planned minutes* bar per player (amber under half the match, with the same fact in text).
- **Checklist (right).** Non-blocking warnings for out-of-position starters, subs that don't work, and players under half the match.

### S09 · Matchday Viewer

Dark chrome and high-contrast slide canvas. Upper-left match label; slide number top-right; contextual navigation bottom; no editing controls. Keyboard and touch navigation.

1.1 slide order: Title → Starting lineup (on a pitch, with roles and instructions, when a formation is set) → Set pieces (if any) → Sub plan (if any) → sections in stored order.

### S10 · Public Share

Header with match title, slide deck, read-only notice; no private navigation; no team management entry points; generic unavailable page for bad tokens.

1.1: a **Find me** button in the header opens a dialog (name select → personal card → *Highlight me in the briefing*). While highlighting, a yellow status bar reads "Highlighting {name}" with *Clear*; the player's marker gets a yellow ring on the pitch and on boards, and their rows are tinted on lineup, set-piece and sub slides.

## 7. Feedback states and accessibility

| State | Required behavior |
|---|---|
| Empty | Explain why screen is empty and show one relevant primary action |
| Loading | Skeleton or labeled progress; avoid blank pitch while loading |
| Validation | Inline actionable text and summary when publication blocked |
| Save failed | Do not discard local changes; persistent retry banner |
| Conflict / stale update | Prevent overwrite of newer persisted version; prompt reload or duplicate |
| Permission denied | Safe 403/404 message; never disclose other team identity |
| Accessibility | Visible focus, WCAG 2.2 AA design target, keyboard navigation outside canvas, no color-only meanings |
| Reduced motion | Respect prefers-reduced-motion for transitions and presentation effects |

## 8. Content design and microcopy

| Moment | Recommended copy |
|---|---|
| Empty roster | Add your first player to start building a lineup. |
| No tactics | Start with a formation or a blank pitch. |
| Saved | All changes saved. |
| Save failed | Changes haven’t synced. Your edits are still here. Retry save. |
| Blocked publish | Add all 7 starters before publishing this 7v7 match plan. |
| Share warning | Anyone with this link can view the published briefing. You can revoke access at any time. |
| Out of position (1.1) | 2 starters are out of position. |
| Broken sub (1.1) | The player coming off isn't on the pitch at that point. |
| Unfair minutes (1.1) | 1 player gets under half the match. |
| Find me (1.1) | Pick your name to see your job in this plan. |

## 9. Usability study protocol

Participants: 5–8 actual amateur captains/coaches, varied digital confidence. Tasks: set up a team; create a formation; prepare a fixture; find presentation link. Collect task success, assistance events, time-on-task, 1–5 clarity score and qualitative observations. No unobserved test results should appear in case studies.

## 10. Design acceptance checklist

- All named screens present and navigation consistent.
- User can understand draft vs published state at a glance.
- One full workflow works with 7v7 sample data; 5v5 and 11v11 tested.
- PDF and full-screen presentation use one ordered slide specification.
- All destructive actions clearly identify what will be deleted.
