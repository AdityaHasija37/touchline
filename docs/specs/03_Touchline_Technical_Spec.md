*TOUCHLINE / TECH-003*

# Technical Specification & Data Contracts

Architecture decisions, relational model, authorization, canvas schema, interfaces and operations

| Version 1.1 | Status: MVP shipped; 1.1 in build | Owner: Product | 20 Oct 2026 |
|---|---|---|---|

Revision history: **0.9** (17 Oct 2026) original. **1.1** (20 Oct 2026) adds the schema, contracts and rendering changes behind PRD-001 §5.1 (migration `20261021000000_roles_setpieces_subs.sql`). See §3.1, §5.1 and §7.1.

Decision status: Proposed specification. Assumptions, targets, and design choices require validation; no user research or shipped capability is claimed.

## 1. Architecture and ADRs

Proposed MVP: Next.js / TypeScript, React Konva for editor, Zustand for ephemeral canvas state, Supabase Postgres + Auth for persistence, Tailwind/shadcn components, Zod validation, and a shared slide renderer with server-side PDF generation. Exact dependency versions should be pinned at build start after compatibility checks.

| ADR | Decision | Rationale / trade-off |
|---|---|---|
| ADR-01 | Single Next.js codebase | Faster build, simpler deployments; may split services later |
| ADR-02 | Normalized 0–100 board coordinates | Resolution independence; must carefully map pitch aspect ratio |
| ADR-03 | Immutable publication snapshots | Shared links remain stable; requires republish workflow |
| ADR-04 | Owner-only write model in MVP | Reduces permissions complexity; invitation roles later |
| ADR-05 | Server-side publish and PDF | Keeps secrets private and enforces validation; extra server cost |

## 2. Logical modules

Web clients (authenticated editor, authenticated matchday preview, public read-only viewer) → Next.js server actions/routes (validation, tenancy and publication) → PostgreSQL (teams, players, matches, tactics, plans, snapshots) and Auth. PDF renderer consumes the exact published snapshot schema; storage optionally caches exported PDFs.

## 3. Relational schema (proposed)

| Table | Representative fields / constraints |
|---|---|
| profiles | id uuid PK references auth.users; display_name; created_at |
| teams | id uuid PK; owner_id FK; name varchar(60); match_format int CHECK IN (5,7,11); primary_color; created_at |
| players | id uuid PK; team_id FK; name varchar(60); shirt_number nullable; preferred_positions text[]; archived_at nullable |
| tactics | id uuid PK; team_id FK; name; category; board_schema_version int; board_json jsonb; version int; updated_at |
| matches | id uuid PK; team_id FK; opponent_name; kickoff_at timestamptz; venue; status |
| match_plans | id uuid PK; match_id unique FK; objective; draft_status; version; updated_at |
| lineup_assignments | plan_id FK; player_id FK; role starter/bench; formation_slot; UNIQUE(plan_id,player_id) |
| plan_sections | id uuid PK; plan_id FK; section_type; title; content_json; tactic_id nullable; sort_order |
| published_plans | id uuid PK; plan_id FK; share_token_hash unique; snapshot_json jsonb; published_at; revoked_at |
| audit_events | id uuid PK; actor_id; team_id; action; resource_type; resource_id; created_at |

Required DB indexes: teams(owner_id), players(team_id, archived_at), tactics(team_id, updated_at), matches(team_id,kickoff_at), plan_sections(plan_id,sort_order), published_plans(share_token_hash). Foreign keys need ON DELETE behaviors designed to protect historic published content.

### 3.1 Release 1.1 schema additions

| Table | New fields / constraints |
|---|---|
| lineup_assignments | player_role varchar(40) slug (`^[a-z_]{2,40}$`); duty ∈ defend/support/attack; instruction varchar(140), trimmed non-empty; CHECK bench rows carry none of the three |
| match_plans | formation_id varchar(20) (`^[0-9]{1,2}-[0-9]{1,6}$`, validated against the team format in the server action); set_pieces jsonb object ≤ 4 KB; sub_plan jsonb object ≤ 8 KB; column UPDATE grant extended to these fields |

`save_lineup` now also writes role, duty and instruction and honours explicit formation slots (`slot`), still in one transaction and still enforcing the starter cap. JSON columns are re-validated with Zod (`setPiecesSchema`, `subPlanSchema`) on every read and write; malformed stored data falls back to empty rather than breaking the plan.

## 4. Canvas JSON contract

Persist typed, versioned JSON, not a serialized DOM or Konva node tree. Validate with Zod at API boundary and migrate schema versions explicitly.

Illustrative schema: { schemaVersion: 1, format: 7, orientation: "vertical", objects: [{ id: "obj-1", kind: "player", playerId: "uuid", x: 50, y: 74, team: "home", label: "6" }, { id: "obj-2", kind: "arrow", from: {x:45,y:55}, to:{x:65,y:38}, style:"run" }] }.

- Each object has stable UUID, supported kind, coordinates within [0,100], and permitted annotation styles.
- Drawing operations must be deterministic and serializable; strip unknown fields before persistence.
- Published snapshots embed resolved player labels and asset references; private player profile data is not copied automatically.
- Track board version for optimistic concurrency; reject stale writes with a conflict response.

## 5. Server/API contracts

| Method / path (illustrative) | Request / response | Authorization |
|---|---|---|
| POST /api/teams | {name, format, color} → {teamId} | Authenticated owner |
| POST /api/teams/:id/players | Player fields → {playerId} | Owner of team |
| PUT /api/tactics/:id | {board, expectedVersion} → {newVersion} | Owner; reject stale version |
| POST /api/matches/:id/plan/publish | {includedSectionIds} → {publishedId, shareUrl} | Owner; validate complete lineup |
| POST /api/published/:id/revoke | No body → {revoked:true} | Owner of underlying plan |
| GET /p/:token | Sanitized snapshot / rendered viewer | Token bearer; check revoked status |
| GET /api/published/:id/pdf | PDF document | Owner or authorized public token |

### 5.1 Release 1.1 server actions

| Action | Input → result | Authorization / validation |
|---|---|---|
| saveLineup(planId, entries) | entries gain `slot`, `playerRole`, `duty`, `instruction` → saved | Owner; role must be one of the 20 known keys (matching a role to the line is a UI rule, not a data rule); duty must be one the role allows (else dropped); explicit slots used only if unique and ≤ format, otherwise slots are assigned in order |
| updateFormation(planId, formationId \| null) | → saved | Owner; formation must exist for the match format |
| saveSetPieces(planId, setPieces) | {captain?, penalties?, freeKicks?, cornersLeft?, cornersRight?, longThrows?, marking[≤11]} → saved | Owner; every player must currently be a starter on this plan |
| saveSubPlan(planId, subPlan) | {matchLength 10–120, subs[≤30] of {minute, outId, inId}} → saved | Owner; minute < match length; both players in this plan's lineup or bench; sequencing problems are warnings, not errors |

### 5.2 Snapshot v1, additive fields (1.1)

The published snapshot stays `version: 1`; new fields are optional so every earlier briefing still parses. Players get per-briefing keys (`p1`… starters in slot order, then bench), used instead of ids everywhere: `lineup.starters[].{key, role, instruction, x, y}`, `lineup.bench[].key`, `lineup.formation`, `setPieces` (jobs → keys, marking → {key, target}), `subPlan` {matchLength, subs → {minute, outKey, inKey}, minutes per key}, and `sections[].markerRefs` (board marker id → key, for highlighting). Only jobs held by starters and only valid subs are copied; minutes are computed once at publish time. Find me (VIEW-01) is built entirely client-side from this snapshot.

## 6. Security and privacy design

- Turn on PostgreSQL RLS for every exposed table and match grants to actual use; test allow/deny paths for anonymous, owner and other authenticated user.
- Every private resource query must be scoped to team ownership server-side; never trust teamId from client without authorization.
- Only hashes of share tokens are stored; create cryptographically random raw token once when publishing.
- Token links grant read-only access to an explicit immutable presentation snapshot, not underlying roster or editable plans.
- Use no-store on sensitive server responses, prevent token logging, apply rate limiting to public token lookups, and support revocation.
- Keep Supabase service-role credentials only on server; separate dev and production projects; redact email/player notes from app telemetry.
Supabase RLS reference: https://supabase.com/docs/guides/database/postgres/row-level-security (reviewed 17 Oct 2026).

## 7. Rendering and export consistency

Define a canonical SlideSpec[] from a published snapshot. Both full-screen presentation and PDF must consume SlideSpec, not independently assemble match data. Store slide order and resolved text in the snapshot. Use an SVG/pitch renderer or equivalent deterministic drawing pipeline for export where Konva DOM is unavailable on the server.

### 7.1 Release 1.1 rendering

SlideSpec gains `setpieces` and `subs` kinds, and the lineup slide carries the formation and per-starter role, instruction and pitch coordinates. The pitch lineup is turned into an ordinary Board (`lib/domain/lineup-board.ts`, marker ids = player keys), so the screen SVG and the PDF draw it with the same primitives as tactic boards. The shared renderer gained two options: `captions` (names under markers) and `highlight` (a ring behind chosen markers for Find me).

## 8. Non-functional SLOs (proposed targets)

| Dimension | Acceptance target |
|---|---|
| Editor stability | No unsaved data loss on transient network failure during pilot tests |
| Performance | p75 editor interactive within 3 seconds on baseline laptop/network (measure in pilot) |
| Export | 95% of standard <= 12-slide exports complete under 10 seconds in staging |
| Security | All cross-tenant access tests deny; zero exposed service keys |
| Compatibility | Latest stable Chrome, Firefox, Safari; keyboard presentation controls |
| Observability | Structured errors with request IDs; events for save, publish, view, export without personal notes |

## 9. Test strategy and developer done criteria

- Unit: schema validation, coordinate clamping, lineup capacity, slide order and publication inclusion rules.
- Integration: team tenancy, optimistic concurrency, share-token revocation, snapshot immutability.
- E2E: new user → team → seven players → tactic → fixture → plan → publish → present → PDF.
- Visual regression: tactics board and published PDF screenshots with representative 5v5/7v7/11v11 fixtures.
- Accessibility: focus order, labels, contrast, reduced-motion and keyboard navigation.
- Database: run RLS allow/deny tests in CI alongside migrations.

## 10. Repo structure and Claude implementation contract

Suggested folders: app/(auth), app/(app)/teams, app/(app)/matches, app/p/[token]; components/tactics, components/presentation; lib/domain, lib/auth, lib/db, lib/validation; supabase/migrations, supabase/tests; tests/unit, tests/e2e.

For every feature: implement smallest vertical slice; include migration and RLS when needed; add typed schemas and tests; run lint/typecheck/build; provide screenshots of altered screens; never claim passing tests not executed. Request explicit approval before introducing new major dependencies, paid APIs, changes to publication/privacy model, or requirements absent from PRD.

## 11. Sources

React Konva drag-and-drop: https://konvajs.org/docs/react/Drag_And_Drop.html. Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security. Reviewed 17 Oct 2026.
