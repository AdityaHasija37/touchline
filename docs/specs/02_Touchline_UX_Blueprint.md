*TOUCHLINE / UX-002*

# UX Blueprint & Screen Specifications

Information architecture, primary journeys, interaction states, content rules and handoff

| Version 0.9 | Status: Proposed | Owner: Product | 17 Oct 2026 |
|---|---|---|---|

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

### S09 · Matchday Viewer

Dark chrome and high-contrast slide canvas. Upper-left match label; slide number top-right; contextual navigation bottom; no editing controls. Keyboard and touch navigation.

### S10 · Public Share

Header with match title, slide deck, read-only notice; no private navigation; no team management entry points; generic unavailable page for bad tokens.

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

## 9. Usability study protocol

Participants: 5–8 actual amateur captains/coaches, varied digital confidence. Tasks: set up a team; create a formation; prepare a fixture; find presentation link. Collect task success, assistance events, time-on-task, 1–5 clarity score and qualitative observations. No unobserved test results should appear in case studies.

## 10. Design acceptance checklist

- All named screens present and navigation consistent.
- User can understand draft vs published state at a glance.
- One full workflow works with 7v7 sample data; 5v5 and 11v11 tested.
- PDF and full-screen presentation use one ordered slide specification.
- All destructive actions clearly identify what will be deleted.
