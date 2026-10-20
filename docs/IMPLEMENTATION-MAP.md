# Touchline: Implementation Map (M0)

Source specs: `docs/specs/` (PRD-001 > UX-002 > TECH-003 > PLAN-004 when they disagree).
Ambiguities and choices are logged in [`DECISIONS.md`](./DECISIONS.md). Nothing here claims user research, deployment or test results that haven't happened.

## 1. Stack (pinned 19 Oct 2026)

| Concern | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, TypeScript strict | next 16.3.8, react 19.3.0 |
| UI | Tailwind v4 + shadcn/ui (base-nova), lucide icons | tailwindcss 4.3.3 |
| Editor canvas | react-konva + konva | 19.3.0 / 10.9.0 |
| Ephemeral editor state | zustand | 5.0.15 |
| Validation | zod (shared client + server) | 4.6.7 |
| DB + Auth | Supabase Postgres + GoTrue, `@supabase/ssr` cookies | supabase-js 2.118.0, ssr 0.12.7, CLI 2.121.0 |
| Unit / component tests | vitest + Testing Library + jsdom | vitest 5.0.3 |
| E2E | Playwright (desktop Chromium + 375 px mobile) | 1.64.1 |
| DB / RLS tests | pgTAP via `supabase test db` | bundled with CLI |
| PDF | **Open: Q-03.** Needs approval before adding | n/a |

Versions were chosen to be mutually compatible and at least ~3 weeks old.

## 2. Route tree

```
app/
  page.tsx                         Marketing / sign-in entry
  (auth)/login, /register, /reset-password, /auth/callback
  (app)/app                        → redirect to /app/teams
  (app)/app/teams                  S01 Team dashboard
  (app)/app/teams/new              S02 Team setup
  (app)/app/teams/[teamId]         Overview tab
  (app)/app/teams/[teamId]/squad   S03 Squad
  (app)/app/teams/[teamId]/tactics S04 Tactics library
  (app)/app/tactics/[tacticId]     S05 Tactics editor (≥1024 px edit, mobile view-only)
  (app)/app/teams/[teamId]/matches S06 Match list
  (app)/app/matches/[matchId]/plan S07 Match plan
  (app)/app/plans/[planId]/publish S08 Preview / publish / revoke
  (app)/app/plans/[planId]/present S09 Matchday viewer (owner, draft or published)
  p/[token]                        S10 Public share (read-only snapshot)
  api/published/[id]/pdf           EXP-01 PDF (owner or valid token)
proxy.ts                           Session refresh + redirect unauthenticated /app/* → /login
```

## 3. Core data contracts

**Tables** follow TECH-003 §3, plus the additions in DECISIONS.md (`matches.kickoff_tz`, `tactics.orientation`, `tactics.format`).

| Table | Owner path | Delete behaviour |
|---|---|---|
| profiles | `id = auth.uid()` | cascade from auth.users |
| teams | `owner_id = auth.uid()` | cascades to everything below, which revokes links (DEC-07) |
| players | team → owner | **archive only** (no DELETE grant); lineup FK cascades only when the whole team/account goes (see migration `…220000_lineup_fk_cascade`) |
| tactics | team → owner | plan_sections.tactic_id `set null`; snapshots unaffected |
| matches | team → owner | cascade to plan |
| match_plans | match (unique) → team → owner | cascade |
| lineup_assignments | plan → … | UNIQUE(plan_id, player_id), UNIQUE(plan_id, formation_slot) |
| plan_sections | plan → … | ordered by `sort_order` |
| published_plans | plan → … | `share_token_hash` unique, `revoked_at` |
| audit_events | insert-only by server | n/a |

**Board JSON v1** (`lib/validation/board.ts`, Zod, unknown keys stripped):

```ts
{ schemaVersion: 1, format: 5|7|11, orientation: "vertical"|"horizontal",
  objects: Array<
    | { id, kind: "player",   playerId: uuid|null, team: "home"|"away", label, x, y }
    | { id, kind: "ball",     x, y }
    | { id, kind: "arrow",    from:{x,y}, to:{x,y}, style: "run"|"pass"|"dribble" }
    | { id, kind: "line",     from:{x,y}, to:{x,y} }
    | { id, kind: "zone",     x, y, w, h, color, label? }
    | { id, kind: "text",     x, y, text (≤240) } > }
```
All coordinates are clamped to [0, 100] in pitch space (x left→right, y top→bottom). Rendering maps them onto a 68:105 pitch, so one x unit is not the same physical length as one y unit (ADR-02).

**SlideSpec** (`lib/domain/slides.ts`): `{ id, kind: "title"|"lineup"|"board"|"notes"|"reminders", title, body?, board?, lineup? }[]`. It's built once from the published snapshot and used by the viewer, the public page and the PDF.

## 4. Security model

- RLS is on for every table in `public`. Policies use a `is_team_owner(team_id)` SECURITY DEFINER helper (stable, `search_path` pinned) so child tables don't repeat joins.
- Grants: `anon` gets **no** table privileges at all. `authenticated` gets only the DML that policies allow.
- Public share: the raw token (32 random bytes, base64url) is returned once at publish. The DB stores only `sha256(token)`. Anonymous viewers call the RPC `get_published_snapshot(token)` (SECURITY DEFINER). It hashes the token, checks `revoked_at is null` and returns **only** `snapshot_json`. No service-role key is needed on the read path.
- The service-role key isn't used in MVP request paths at all. If it's ever needed, it stays server-only (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`).
- Every server action re-derives ownership from the session. A client-provided `teamId` is only a lookup key, and RLS is the backstop.
- `Cache-Control: no-store` on private and token responses. Tokens are never logged, and request logging redacts `/p/*` paths.
- Rate limiting public token lookups: **Open: Q-04.**

## 5. Migrations plan

| # | Migration | Phase |
|---|---|---|
| 0001 | profiles, teams, players, `is_team_owner()`, RLS + grants, indexes | 1 |
| 0002 | tactics (board_json jsonb, version, CHECK schemaVersion) | 2 |
| 0003 | matches, match_plans, lineup_assignments, plan_sections | 4 |
| 0004 | published_plans, audit_events, `publish_plan()` / `revoke_plan()` / `get_published_snapshot()` | 5 |
| 0009 (`20261021000000_roles_setpieces_subs`) | Release 1.1: role/duty/instruction on lineup rows, formation + set pieces + sub plan on match plans, `save_lineup` v2, analytics allowlist for adoption counts | 7 (1.1) |

As built, phases 0–6 used eight migrations (see `supabase/migrations/`); the table above keeps the original M0 plan plus the 1.1 addition.

Each migration ships with pgTAP tests in `supabase/tests/` that cover the allow and deny paths for anon, the owner and another user.

## 6. Commands

| Purpose | Command |
|---|---|
| Start local DB/Auth (Docker) | `npx supabase start` |
| Reset DB + apply migrations + seed | `npm run db:reset` |
| RLS / DB tests | `npm run test:db` |
| Generate DB types | `npm run db:types` |
| Unit tests | `npm test` |
| E2E | `npm run test:e2e` |
| Typecheck / lint / build | `npm run typecheck` / `npm run lint` / `npm run build` |
| Everything except E2E | `npm run check` |
| Local auth emails | Mailpit at http://127.0.0.1:54324 |

## 7. Milestone backlog

| Phase | Epics | Requirements | QA tests |
|---|---|---|---|
| 0 Foundation | Scaffold, tooling, this map | none | none |
| 1 Auth, teams, squad | EP1, EP2 | AUTH-01, TEAM-01, TEAM-02, SEC-01 | QA-01, QA-02 (team/player scope) |
| 2 Editor core | EP3 | TAC-01, TAC-03, part of TAC-02 (drag) | QA-03, QA-04 |
| 3 Tactical tools | EP4 | TAC-02, TAC-04 | tool acceptance suite |
| 4 Matches & plans | EP5, EP6 | MATCH-01, MATCH-02, PLAN-01 | QA-05 |
| 5 Publish & present | EP7 | PRES-01, PRES-02 | QA-06, QA-07, QA-09, QA-10 |
| 6 PDF & release | EP8 | EXP-01, NFR-01 | QA-08, full E2E, traceability matrix |

## 8. Open questions (need the product owner)

See DECISIONS.md §Open. Short list: Q-01 auth email confirmation, Q-02 product name and branding, Q-03 PDF library, Q-04 rate limiting, Q-05 analytics sink.
