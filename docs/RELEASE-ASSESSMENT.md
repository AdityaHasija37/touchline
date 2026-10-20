# Release gap assessment and recommendation

Date: 20 Oct 2026. Scope: the MVP defined in PRD-001 v0.9. Written per the build brief §5: "candid release recommendation".

## Recommendation
**Ready to deploy as a private portfolio demo and invite-only beta. Not ready to claim product validation, and not yet ready for a real pilot with teams' data.**

All 14 P0 requirements and the P1 history requirement are implemented and covered by passing automated tests (14 fully verified, NFR-01 partially). The core loop works end to end without external slide or design software, which is the PRD's own success bar for the MVP. What's missing is mostly evidence about people and real devices, which no amount of local testing can produce, plus a handful of operational prerequisites for hosting other people's data.

## Launch gate (PRD-001 §9)
| Gate | Status | Notes |
|---|---|---|
| One end-to-end E2E path | ✅ Met | `journey.spec`: register → team → 7 players → tactic → fixture → lineup → publish → present → PDF |
| Zero critical security findings | 🟡 Self-assessed | RLS, grants and token handling are tested (pgTAP, 7 files). One serious issue (rate-limit bypass) was found and fixed in self-review. **No independent security review yet** |
| PDF / slide parity check | 🟡 Mostly met | Shared primitives and SlideSpec; automated order and text parity for 5/7/11; visual review by eye; no pixel golden files |
| Accessibility smoke check | ✅ Met (automated) | axe WCAG 2.2 AA on 13 screens, no serious/critical issues. Manual screen-reader pass not done |
| Manual rehearsal on laptop and phone | 🟡 Partial | Laptop: done through browser automation and screenshots. **Real phone: not done** |
| ≥3 pilot captains complete the task unassisted | ❌ Not done | Needs real captains (PLAN-004 §6) |

## Gaps, by severity
**Blocking a real pilot**
1. **No discovery or pilot evidence.** The 5 interviews (PRD §2.2) and 3–5 pilot captains haven't happened. The value proposition is still a hypothesis, and G1–G4 are unmeasured.
2. **Not deployed.** It needs the owner's accounts, custom SMTP for confirmation emails, and the DEPLOY.md smoke test (including rate limiting behind Vercel's real headers and the "no tokens in logs" check).
3. **Contact and data-request process.** The privacy page and runbook need a real contact address. Account deletion is operator-run SQL, not self-service.

**Should fix soon**
4. No CI: the suites run locally only. Add GitHub Actions for typecheck, lint, unit, pgTAP and E2E.
5. Real-device testing: touch drawing on tablets (desktop-first by design), swipe on phones, Safari and Firefox.
6. Independent security review of RLS, the token flow and the service-role route.
7. Free-tier Supabase has no downloadable backups. Run the restore drill in OPERATIONS.md once.

**Known product limitations (accepted for MVP)**
- Plan text fields are last-write-wins (DEC-37). Boards have proper conflict detection.
- A share link is shown once and can only be rotated (DEC-39).
- PDFs cover Latin, Cyrillic and Greek scripts (Noto Sans); CJK, Arabic and Hebrew names would lose glyphs.
- No free zoom or pan in the editor (DEC-29); 9v9 deferred (D-01); no multi-coach roles (D-03).

## What was verified (summary)
See `docs/TRACEABILITY.md` for the per-requirement matrix and `docs/evidence/PHASE-0…6.md` for commands, exit codes, defects found and screenshots. Totals at release check: see PHASE-6 evidence.

## Suggested next steps
1. Owner: run 5 discovery conversations (PLAN-004 §6 guide). This is independent of the code.
2. Deploy to Vercel + Supabase (DEPLOY.md) and record the smoke-test results.
3. Add CI.
4. Pilot with 3–5 captains, measure G1–G5 from `analytics_events`, and write up the case study with hypotheses, decisions, feedback and outcomes kept separate.
