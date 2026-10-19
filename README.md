# Touchline

Match preparation for grassroots football captains. Roster → fixture → lineup → tactics boards → a frozen matchday briefing players can open on their phones.

> Status: **in development, Phase 0 (foundation)**. No user research, pilot results or deployment exist yet. Specs are proposals (v0.9).

## Docs
- `docs/specs/`: PRD-001, UX-002, TECH-003, PLAN-004 and the build brief (original .docx plus text copies)
- `docs/IMPLEMENTATION-MAP.md`: routes, data contracts, security model, migrations, backlog
- `docs/DECISIONS.md`: decision register and open questions

## Prerequisites
Node 22+, Docker Desktop (for local Supabase).

## Setup
```bash
npm install
npx supabase start          # local Postgres + Auth + Mailpit
cp .env.example .env.local  # fill from `npx supabase status`
npm run dev
```

## Environment variables (names only)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`

## Commands
| | |
|---|---|
| `npm run check` | typecheck, lint, unit tests, build |
| `npm run test:db` | pgTAP / RLS tests against local Supabase |
| `npm run test:e2e` | Playwright (desktop + 375 px) |
| `npm run db:reset` | re-apply migrations and seed |
