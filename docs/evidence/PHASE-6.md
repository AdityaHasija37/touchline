# Phase 6 evidence: PDF export, hardening and release check (M4)

Date: 20 Oct 2026. Environment: local Supabase (Docker), Next 16.3.8 dev and production builds, headless Chromium.

## Requirement IDs
EXP-01, NFR-01 (accessibility smoke), QA-08, TECH-003 §9 full E2E, the PRD launch-gate check, and brief §5 (traceability matrix plus release recommendation). PLAN-004 §5 analytics and §8 release-readiness documents.

## User-facing behaviour
- **Owner:** "Download PDF" on the publish screen once a briefing is live. The file is named after team, opponent and date.
- **Player:** a "PDF" button in the public viewer. The token stays in the POST body and the same rate limit applies.
- **PDF:** A4 landscape, one page per slide in the presenter's order, with a footer (match and page n/N). Boards are the same shapes as on screen. Names in non-English scripts print correctly.
- **`/privacy`:** a plain-language notice, linked from the landing and auth pages.

## Implementation
- `lib/domain/board-render.ts`: renderer-agnostic primitives. `BoardSvg` was refactored onto them, and the PDF uses them too.
- `lib/pdf/briefing-pdf.tsx`: react-pdf document from SlideSpec; embedded Noto Sans; vector checkmarks; serialised renders.
- `GET /api/plans/:id/pdf` (owner, RLS) and `POST /api/briefing/pdf` (token); shared `app/api/briefing/lookup.ts`.
- Migration `20261020000000_analytics.sql`: `analytics_events`, hidden `teams.analytics_id`, `track_event()` with an allowlist, and the public lookup now records `presentation_opened` / `pdf_exported`.
- `lib/analytics/track.ts`, wired into team, player, tactic, fixture, publish, revoke, present and PDF.
- Docs: `TRACEABILITY.md`, `RELEASE-ASSESSMENT.md`, `DEPLOY.md`, `OPERATIONS.md`.

## Commands run (actual exit status)
| Command | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |
| `npx vitest run` | exit 0, 90/90 in 12 files (adds render primitives; PDF parity for 5/7/11; Unicode names; filename) |
| `npx supabase test db` | exit 0, 110 assertions in 7 files (adds analytics allowlist, pseudonymity, isolation) |
| `npx playwright test` | **47/48 on the first full run, then 48/48.** See defect 6 |
| `npx playwright test pdf/journey/publish --repeat-each=3` | exit 0, 39/39 |
| axe WCAG 2.2 AA (`a11y.spec`) on 13 screens | no serious or critical violations after fixes |
| `npm run build` | exit 0 |

## Defects found and fixed
1. **Checkmarks and non-English names missing in PDFs.** The built-in fonts lack those glyphs. Fixed by embedding Noto Sans and drawing checkmarks as vectors.
2. Filename accents: "Ünited" became "u-nited". Combining marks are now stripped after normalising.
3. **Colour contrast** (axe, serious): muted text on tinted cards and the delete button's red. Tokens darkened (DEC-47).
4. **Opening a second share link in the same tab kept showing the first briefing** (only the fragment changed). The page now reloads on `hashchange`, with stale requests cancelled. Regression test added.
5. Test assumptions corrected: seeded squads and never-re-saved tactics don't emit `player_added` / `tactic_saved`, which is correct behaviour. The journey test covers both.
6. **Open, narrowed down:** in full parallel E2E runs, a PDF occasionally extracts "midfield*" instead of "midfield." (3 of ~60 runs; 0 in 108 targeted reproductions, 60 varied sequential renders and 24 concurrent ones). The QA-08 test now keeps the odd file: rendering it shows the **page is visually correct**, and only the hidden text layer maps "." to "*". It's likely react-pdf font state reused across renders. Both reset APIs were tried and rejected (`Font.reset()` breaks loading; `Font.clear()` drops built-in fonts). Renders stay serialised; it's tracked in RELEASE-ASSESSMENT as an open issue.

## Visual verification
`docs/evidence/phase-6/pdf-page-1…4.png`: pages rendered from a real export (pdfjs in Chromium, via `scripts/render-pdf-pages.mjs`) and reviewed by eye. The board page matches the on-screen board.

## Not verified
Real phones and tablets, Safari and Firefox, a screen reader, deployment (rate-limit headers and logs behind Vercel), an independent security review, and any user research or pilot. See RELEASE-ASSESSMENT.md.
