*TOUCHLINE / PRD-001*

# Product Requirements Document

Strategy, customer problem, scope, functional requirements and release criteria

| Version 0.9 | Status: Proposed | Owner: Product | 17 Oct 2026 |
|---|---|---|---|

Decision status: Proposed specification. Assumptions, targets, and design choices require validation; no user research or shipped capability is claimed.

## 1. Executive decision

Touchline is a responsive, browser-based preparation workspace for amateur football captains and grassroots coaches. It turns a maintained roster into a match-specific lineup, editable tactical diagrams, and a player-facing matchday briefing. The MVP is successful only when that end-to-end loop works without external slide or design software.

| Decision | Proposed baseline |
|---|---|
| Primary persona | Volunteer captain or grassroots coach of a recurring 5v5/7v7/11v11 team |
| Primary job to be done | Prepare, communicate and reuse a coherent match plan in less time |
| MVP release boundary | Single owner per team; editable static tactics; fixtures; slide-view briefing; PDF export |
| North-star proxy | Match plans actually presented/shared per active team per month |
| Non-goals | Live player tracking, automated tactical advice, video processing, real-time co-editing, payment and league administration |

## 2. Problem and opportunity

Hypothesis: grassroots teams currently distribute planning across messages, memory, improvised diagrams and generic slides. Context is lost between weeks and players may receive inconsistent instructions. Touchline centralizes plan creation and presentation. This is a problem hypothesis, not a quantified finding.

### 2.1 Audience and jobs-to-be-done

| Persona | Trigger / job | Pain / desired outcome |
|---|---|---|
| Captain (primary) | An upcoming match needs a lineup and instructions | Build something useful quickly, even without formal coaching experience |
| Volunteer coach | Teach shape and set-piece roles | Explain positioning consistently with visuals |
| Player (consumer) | Receive game-day instructions | See assignment on a phone with no account required for published plans |

### 2.2 Evidence and competitive boundary

TacticalPad already offers sophisticated tactical drawing and exports. Touchline will not position basic drawing or PDF export as unique. The intended differentiation is the lightweight continuity of roster → fixture → lineup → tactical boards → frozen briefing, tailored to grassroots teams. Conduct at least five discovery conversations before claiming this value proposition is validated.

Reference: TacticalPad training / export functionality, https://tacticalpad.com/edu/formation.php (reviewed 17 Oct 2026).

## 3. Goals, non-goals and success measurement

| ID | Goal / metric | Instrumentation and initial threshold |
|---|---|---|
| G1 | Complete core workflow | One new user can create team, 7 players, fixture, board, and briefing in a moderated usability test |
| G2 | Time to first plan | Median <= 10 minutes in initial test cohort; revise after baseline |
| G3 | Activation | >= 60% of test signups create a team and persist one tactic within 7 days (hypothesis target) |
| G4 | Briefing usage | >= 40% of completed plans opened in presentation view or exported (hypothesis target) |
| G5 | Reliability | No P0/P1 bugs at pilot; successful save/reopen in 99% of instrumented attempts |

Metrics are planning targets, not outcomes. Segment by team format, new versus repeat users, and device type. Log no player notes in analytics payloads.

## 4. Release scope and precedence

Contract priority is PRD-001 > UX-002 > TECH-003 > PLAN-004 if documents disagree. Any contradiction must be logged in the decision register and resolved before implementation.

| MVP (must) | Next (should) | Explicitly out |
|---|---|---|
| Email authentication; create one or more teams; player roster | Multiple coach roles and invitations | AI coaching recommendations |
| 5v5/7v7/11v11 formation support; static canvas and tools | Keyframed animations | Tracking or video analysis |
| Fixtures, starting lineup, bench and instructions | Community tactics library | Public searchable teams |
| Presentation mode, private read-only link, PDF export | Offline installable PWA | Live match scoring |
| Save/reopen, duplicate, delete, autosave feedback | Rich presence / simultaneous edits | Payments and availability collection |

## 5. Functional requirements: acceptance contracts

### AUTH-01 · Account access [P0]

Users can register, log in, log out and request a password reset.

Acceptance: Given valid credentials, when signing in, user reaches team dashboard; unauthenticated access to private URL redirects to login.

### TEAM-01 · Team creation [P0]

Owner creates team with name, primary color and match format 5/7/11.

Acceptance: Required name 2–60 chars; successful creation persists and shows in dashboard; only owner can edit or delete.

### TEAM-02 · Roster [P0]

Owner adds, edits and archives players (name, optional number, preferred positions).

Acceptance: Names 1–60 chars; player IDs stable; archiving never removes historic match snapshots.

### TAC-01 · Formation [P0]

User starts board from a preset matching team format or a blank pitch.

Acceptance: A 7v7 template places exactly 7 own-team markers; presets cannot silently introduce 11 players.

### TAC-02 · Canvas editing [P0]

Drag players and ball; draw arrows, lines, zones and text with pointer controls.

Acceptance: Elements remain editable; moving a marker cannot alter its player ID; coordinate system is 0–100 for each axis.

### TAC-03 · Board persistence [P0]

Create, rename, duplicate, update and delete tactics.

Acceptance: Save success visible; reopen recovers geometry and annotation text; no cross-team data leakage.

### TAC-04 · History [P1]

Undo and redo last 30 local editor actions.

Acceptance: Undo restores last mutation exactly; new action after undo clears redo branch.

### MATCH-01 · Fixture [P0]

Create and edit fixture with opponent, kickoff date/time and venue (optional).

Acceptance: Timezone-aware kickoff; empty venue accepted; fixture belongs to exactly one team.

### MATCH-02 · Lineup [P0]

Assign unique roster players as starters or bench, plus positions.

Acceptance: Maximum starters equals format; duplicate player IDs forbidden; incomplete lineup may remain draft but cannot publish.

### PLAN-01 · Match plan [P0]

Attach ordered tactical boards and add objective, phase labels and coaching notes.

Acceptance: A plan can be saved as draft; attached tactics are copied into a published snapshot to avoid later mutation.

### PRES-01 · Presentation [P0]

Render title, starters, board sections, notes and final reminders full-screen.

Acceptance: Slides follow stored order; keyboard next/previous works; screen is readable at 1280x720.

### PRES-02 · Publish/share [P0]

Publish a read-only snapshot behind an unguessable token; owner can revoke.

Acceptance: Viewer sees only explicitly included slide content; no team roster directory or unpublished notes exposed.

### EXP-01 · PDF [P0]

Export the published plan to printable PDF.

Acceptance: PDF pages show the same order and meaningful diagrams; source plan remains unchanged.

### SEC-01 · Authorization [P0]

Enforce team ownership and resource scope in server/db.

Acceptance: User A cannot read/edit user B private records via manipulated URLs or direct requests.

### NFR-01 · Responsive and accessible [P0]

Editor desktop-first, reader mobile-supported; accessible navigation/labels.

Acceptance: At 375 px, published briefing is readable; keyboard controls have clear focus and non-canvas alternatives for key functions.

## 6. Key policies and edge cases

- Publish requires a complete starting lineup equal to the selected format; drafts can be incomplete.
- Team format changes do not silently alter existing match snapshots; warn and request explicit conversion for drafts.
- Archived players stay resolvable in old published plans via immutable name/number snapshots.
- If a referenced tactic is edited after publication, published slides do not change until republish.
- Owner can revoke a share link; subsequent token fetches return not found, not private data.
- Save failures retain unsaved local editor state and show retry; never display success before server acknowledgement.
- No public player directory; default sharing is private and token-based.

## 7. Dependencies, risks and mitigations

| Risk | Impact | Mitigation / exit signal |
|---|---|---|
| Canvas interaction bugs across devices | Critical usability blocker | Prototype pointer/touch, zoom and geometry before full app; automated save/reopen test |
| PDF fidelity mismatches | Briefing cannot be trusted | Single shared render model, golden-file visual checks |
| Scope expands into full coaching suite | Release delayed | Change control and explicit MVP exit criteria |
| Privacy leakage in links | Trust/security failure | Immutable public snapshots, allowlist fields, revocation tests |
| Unvalidated market need | Low adoption | Five interviews and pilot of 3+ real team captains |

## 8. Decisions requiring review

| ID | Question | Default recommendation |
|---|---|---|
| D-01 | Which playing formats first? | 5v5, 7v7, 11v11; 9v9 later |
| D-02 | Can players access without login? | Yes, published briefing only; no editable access |
| D-03 | Can multiple coaches edit? | Not in MVP; one team owner |
| D-04 | Should tactical animations be MVP? | No; static sequences with separate boards |
| D-05 | Can plans have arbitrary private notes? | Yes, but explicit public-section inclusion before publish |

## 9. Launch gate and references

Gate: complete one end-to-end E2E path, zero critical security findings, PDF/slide parity check, accessibility smoke check, manual rehearsal on laptop and phone, and at least three pilot captains completing the task without assistance. Any missed gate must be noted in release notes.

References: TacticalPad https://tacticalpad.com/edu/formation.php; Konva https://konvajs.org/docs/react/Drag_And_Drop.html; Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security. Reviewed 17 Oct 2026.
