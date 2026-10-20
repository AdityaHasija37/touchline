*TOUCHLINE / BUILD-005*

# Claude Code Implementation Brief

Instruction contract for an AI coding agent to execute the reviewed Touchline specs

| Version 0.9 | Status: Proposed | Owner: Product | 17 Oct 2026 |
|---|---|---|---|

Decision status: Proposed specification. Assumptions, targets, and design choices require validation; no user research or shipped capability is claimed.

## 1. Instructions for coding agent

You are implementing Touchline, a production-minded MVP for grassroots football captains. Read PRD-001, UX-002, TECH-003 and PLAN-004 in that order. Do not infer that a prototype, mock, placeholder, or untested screen satisfies an acceptance criterion.

## 2. Rules of engagement

- Before coding each epic, summarize requirements by ID, relevant screens, DB changes, acceptance tests and risks.
- Implement one vertical slice at a time. At the end of a slice, explain files changed, tests run, failures, screenshots and manual checks.
- Do not add external AI services, paid APIs, multiplayer, live tracking or animation unless the PRD is updated.
- Use real persistence for authenticated records; never use localStorage as the source of truth for squads, tactics or plans.
- Always enforce authorization server-side and via RLS; tests must prove cross-user isolation.
- Treat public share tokens as secrets. Never print them to logs or send them to telemetry.
- Do not invent interview results, engagement metrics, deployed status or benchmark measurements.
- If unclear, prefer the documented default; log ambiguity in DECISIONS.md rather than implementing multiple conflicting behaviors.

## 3. Milestone prompts

### M0

Inspect the repository and attached Touchline specs. Create an implementation map with route tree, core data contracts, security model, dependency choices, database migrations, testing commands, milestone backlog and open questions. Do not implement unrelated functionality.

### M1

Implement authenticated team and roster workflows from AUTH-01, TEAM-01, TEAM-02 and SEC-01, including migrations, RLS grants/policies, Zod validation, loading/empty/error states and cross-tenant tests. Show exact evidence of tests run.

### M2

Build 7v7 Tactics Studio satisfying TAC-01/02/03 and UX S05, storing versioned 0–100 board JSON. Support preset formation, drag, arrow, zone, text, save and reload. Add tests for bounds and persistence.

### M3

Build fixture and lineup flows, match-plan sections, complete-lineup publication validation, immutable snapshots and secure share/revocation from MATCH-01/02, PLAN-01 and PRES-01/02.

### M4

Build canonical SlideSpec rendering and PDF export with parity tests and 5v5/7v7/11v11 demos. Run full E2E flow; provide release gap assessment against every P0 ID.

### M5 (1.1)

Build matchday detail from PRD-001 §5.1 (LINE-01, LINE-02, SETP-01, SUBS-01, VIEW-01) as one migration plus vertical slices: roles and duties → set pieces → Find me → squad on the pitch → sub plan. Keep the published snapshot backward compatible, never expose player ids in it, and never let the new features block publishing. Update the demo sandbox so every feature is visible, add unit, pgTAP and E2E coverage, and update the specs, decision register and traceability matrix.

## 4. Required evidence template

For each milestone provide: Requirement IDs implemented; user-facing behavior; routes/components added; schema migrations; security controls; unit/integration/E2E commands with actual exit status; manual verification steps; screenshots; known limitations; risks; next recommendation. Use “not run” rather than stating or implying a test passed.

## 5. MVP release command

Produce a requirements traceability matrix for every P0 requirement, identify implemented / partially implemented / missing states, run typecheck/lint/build/test suites, perform manual 7v7 end-to-end rehearsal, test cross-tenant authorization and published link revocation, and prepare a candid release recommendation. Do not deploy automatically unless authorized.
