*TOUCHLINE / PLAN-004*

# Delivery Plan, Backlog & Validation

Implementation sequencing, traceability, quality gates, analytics and review decisions

| Version 1.1 | Status: MVP shipped; 1.1 in build | Owner: Product | 20 Oct 2026 |
|---|---|---|---|

Revision history: **0.9** (17 Oct 2026) original. **1.1** (20 Oct 2026) adds sprint S6, epics EP9–EP11, stories US-08 to US-11, tests QA-11 to QA-15, adoption analytics and change CR-01.

Decision status: Proposed specification. Assumptions, targets, and design choices require validation; no user research or shipped capability is claimed.

## 1. Release plan and governance

MVP is a staged six-sprint proposal, not a deadline commitment. Each sprint produces a demoable vertical slice with explicit acceptance. Maintain a decision log and change request whenever scope, privacy, product behavior, or data model changes. Owner is currently the sole builder / product lead.

| Sprint | Outcome | Exit evidence |
|---|---|---|
| S0 · Discovery and framing | Five interviews, prototype editor feasibility, PRD approval | Interview notes, validated/revised problem statement, ADR review |
| S1 · Foundation | Auth, teams, roster, RLS | Create/edit team demo; deny cross-tenant tests |
| S2 · Editor | Pitch, formation, drag, save/reopen | 7v7 persisted board demo; geometry tests |
| S3 · Tactical tools | Arrows, zones, text, undo and duplication | Tool behavior acceptance suite |
| S4 · Match planning | Fixtures, lineup validation, ordered plan sections | Incomplete lineup cannot publish |
| S5 · Briefings & launch | Snapshot, full screen, link revoke, PDF, polish | Full E2E test, pilot review, launch checklist |
| S6 · Matchday detail (1.1) | Roles and duties, squad on the pitch, set pieces, sub plan, Find me | QA-11 to QA-15; demo sandbox shows every feature; no change to publish rules |

## 2. Prioritized backlog and traceability

| Epic / story | Priority | Depends on | Related requirement |
|---|---|---|---|
| EP1 / account access + team CRUD | P0 | Auth + data model | AUTH-01; TEAM-01; SEC-01 |
| EP2 / players and archiving | P0 | EP1 | TEAM-02 |
| EP3 / formation board and persistence | P0 | EP2 | TAC-01; TAC-02; TAC-03 |
| EP4 / arrows, zones, text, history | P0/P1 | EP3 | TAC-02; TAC-04 |
| EP5 / fixtures and validated lineup | P0 | EP2 | MATCH-01; MATCH-02 |
| EP6 / plan sections and selected tactics | P0 | EP3; EP5 | PLAN-01 |
| EP7 / immutable publication and view | P0 | EP6 | PRES-01; PRES-02 |
| EP8 / PDF and quality hardening | P0 | EP7 | EXP-01; NFR-01 |
| EP9 / roles, duties and squad on the pitch | P1 | EP5 | LINE-01; LINE-02 |
| EP10 / set pieces and sub plan | P1 | EP9 | SETP-01; SUBS-01 |
| EP11 / Find me on the player briefing | P1 | EP7; EP10 | VIEW-01 |

## 3. Detailed user stories and definition of done

### US-01

As a captain, I can create a 7v7 team so that my squad has a persistent workspace.

Acceptance tests: Valid creation, duplicate names allowed across owners, no anonymous write, redirect after save.

### US-02

As a captain, I can register and archive players so that lineups use accurate team identities.

Acceptance tests: Archived players omitted from new lineup picker; historic snapshots remain readable.

### US-03

As a captain, I can move and annotate player positions so that I can explain my shape.

Acceptance tests: Pointer drag works; arrows persist; reload has same positions; limited to board bounds.

### US-04

As a captain, I can create a fixture and select a starting lineup so that I can prepare a specific opponent plan.

Acceptance tests: Cannot assign duplicate player; starter count enforced; draft supports incomplete lineup.

### US-05

As a captain, I can turn a plan into a full-screen briefing so that I can coach before kickoff.

Acceptance tests: Slide order preserved; next/back keyboard; published snapshot does not drift.

### US-06

As a captain, I can share and revoke a read-only link so that players can view only my chosen content.

Acceptance tests: Link displays no edit controls; revoked token fails; anonymous viewer cannot enumerate roster.

### US-07

As a captain, I can export PDF so that I can print or distribute the plan.

Acceptance tests: Readable pitch, player names and notes; correct slide order, download works.

### US-08 (1.1)

As a captain, I can put my starters into a formation on a pitch and give each one a role, duty and instruction, so that every player knows their job, not just their position.

Acceptance tests: Best-fit placement; swap from the pitch; fit shown in colour and text; out-of-position warning; roles filtered to the line; reload keeps everything.

### US-09 (1.1)

As a captain, I can say who takes each set piece and who marks whom, so that nobody argues over the ball at a corner.

Acceptance tests: Only starters selectable; server rejects others; benched takers drop out of the briefing; set-piece slide appears only when set.

### US-10 (1.1)

As a captain, I can plan substitutions and see everyone's minutes, so that I can give a fair game to the whole squad.

Acceptance tests: Default length by format; invalid subs explained and excluded; under-half warning; minutes bars on the slide.

### US-11 (1.1)

As a player, I can find my own name in the briefing and see only what I need to do, so that I don't have to read the whole plan on the way to the pitch.

Acceptance tests: Personal card complete; highlight on every slide; works at 375 px; no internal ids in the API response; older briefings still open.

Definition of Done for every story: feature matches UX copy and acceptance criteria; typed validation; authorization covered; relevant automated tests pass; empty/error states handled; no secrets exposed; accessible labels/focus; updated docs and demo evidence.

## 4. Test matrix: minimum critical paths

| Test ID | Scenario | Expected result |
|---|---|---|
| QA-01 | Unauthenticated user opens private editor | Redirect or deny; no private response |
| QA-02 | User A accesses User B tactic ID | 403/404, no data leak |
| QA-03 | Move player, add arrow, reload | Geometry and style identical |
| QA-04 | Save same tactic from two stale tabs | Conflict surfaced, no silent overwrite |
| QA-05 | 7v7 plan has only 6 starters | Publish disabled; draft retained |
| QA-06 | Publish plan, edit original tactic | Existing published snapshot unchanged |
| QA-07 | Revoke link then open it | Safe unavailable page |
| QA-08 | Export published plan | PDF matches section order and content |
| QA-09 | View published plan on phone | No horizontal overflow / unreadable pitch |
| QA-10 | Delete or archive player used historically | Historical published slide still renders |
| QA-11 | Swap a defender into a forward slot (1.1) | Fit shows "out of position" in text; non-blocking warning; swap back clears it |
| QA-12 | Bench a player who holds a set-piece job, then publish (1.1) | Job is not shown in the briefing; publishing still works |
| QA-13 | Sub a player who isn't on the pitch (1.1) | Inline explanation; sub excluded from briefing; checklist warning |
| QA-14 | Player uses Find me on a phone (1.1) | Card complete; highlight visible; no horizontal overflow |
| QA-15 | Open a briefing published before 1.1 | Opens normally; Find me hidden |

## 5. Analytics specification

| Event | Trigger | Safe properties |
|---|---|---|
| team_created | Server acknowledges creation | format, team_id pseudonymous |
| player_added | Player saved successfully | team_id; no name |
| tactic_saved | Server accepts updated version | format, object_count, duration_ms |
| match_plan_created | First plan persisted | format, sections_count |
| plan_published | Snapshot commit succeeded | slide_count, format; (1.1) has_formation, roles_count, set_piece_jobs, subs_count |
| presentation_opened | Reader viewer loaded | viewer_type(owner/public), slide_count |
| pdf_exported | Export completed | slide_count, latency_ms |
| share_revoked | Owner revokes snapshot | link_age_days |

Do not transmit player names, coaching notes, email addresses, raw share tokens, or complete board JSON as analytics event properties. Aggregate by team and user pseudonymous IDs; provide a deletion path if analytics is ever tied to user accounts.

## 6. Product experiment and discovery protocol

Discovery guide: (1) Walk me through preparation for your last match. (2) What tools did you use and where did you repeat work? (3) Show how you explained the formation. (4) What changed on the day? (5) Which artifact did players actually consult? Do not lead participants toward recommending Touchline.

Pilot: 3–5 actual captains each prepare one upcoming match using Touchline. Observe completion unassisted, save/reopen success, whether briefing is actually used, qualitative feedback and request for reuse. Obtain permission before recording or displaying team material in a portfolio.

## 7. Risk register and change log

| Risk / owner | Likelihood x impact | Mitigation |
|---|---|---|
| Editor complexity / Engineering | High x High | Proof-of-concept before building adjacent features |
| Public link data leakage / Engineering | Medium x High | Snapshot allowlist, hashing, RLS, adversarial tests |
| Low grassroots adoption / Product | Medium x High | Interview coaches and measure matchday usage |
| Export inconsistency / Engineering | Medium x Medium | Shared slide model and visual regression |
| Scope creep / Product | High x Medium | MVP boundary, changelog and signoff |

Change log: **CR-01** (20 Oct 2026, product owner). Problem/evidence: a hands-on walkthrough of the shipped MVP found that players could see the team's shape but not their own job; positions were free text and set pieces and subs lived in notes. Affected: MATCH-02 (extended), PRES-01/02 (new slides), EXP-01 (new pages); new LINE-01, LINE-02, SETP-01, SUBS-01, VIEW-01. Options: free-text roles only; FM-style roles + instruction (chosen); full FM attribute model (rejected as out of scope). Privacy impact: published snapshot gains roles, instructions, set-piece and sub data the captain chose to share; players referenced by per-briefing keys, never ids. Decision: build as release 1.1; never blocks publishing. Migration 0009; tests and docs updated.

Change request template: Change ID; requester/date; problem/evidence; affected requirement IDs; options; user impact; privacy impact; effort; decision owner; decision; release target; migration/test/doc impacts.

## 8. Release readiness and handoff

- All P0 requirements have linked tests and passing proof; open P1/P2 bugs documented.
- No cross-team record access; token viewer supports revocation; service keys are server-only.
- Presentation and PDF checked with at least one 5v5, 7v7, 11v11 sample.
- Critical keyboard flows verified; reader works on mobile.
- Privacy page, error handling, backup/restore plan and incident contact documented.
- README includes setup, migrations, environment variable names (not values), test commands and demo data.
- Portfolio case study separates hypotheses, decisions, user feedback and observed outcomes.

## 9. Review and signoff register

| Artifact | Reviewer | Status |
|---|---|---|
| PRD-001 | Product owner | Pending review |
| UX-002 | Product + sample coach | Pending review |
| TECH-003 | Engineering / security reviewer | Pending review |
| PLAN-004 | Product owner | Pending review |
