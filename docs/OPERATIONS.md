# Operations runbook

Covers the PLAN-004 §8 items: error handling, backup/restore, incident response, data requests. Status: written for the planned Vercel + Supabase deployment; **not yet exercised in production.**

## Error handling (as built)
- Every authenticated route has a generic error boundary ("Nothing you saved has been lost") and a generic 404 that doesn't reveal whether a record exists.
- Editor saves never show success before the server acknowledges. Failures keep local edits and offer Retry, and conflicts stop autosave (DEC-19/20/21).
- Public link failures (unknown, revoked, rate-limited, network) each have a plain-language page.
- Analytics and audit writes are best effort and can never fail a user action.

## Backups and restore
- **Paid Supabase plans:** daily backups and point-in-time recovery from the dashboard.
- **Free plan:** no downloadable backups, so take your own:
  ```bash
  npx supabase db dump --linked -f backups/schema.sql
  npx supabase db dump --linked --data-only -f backups/data-$(date +%F).sql
  ```
  Store the dumps outside the repo, encrypted (they contain player names and private notes).
- **Restore drill** (do this once before a pilot): create a scratch project, `db push` the migrations, load the data dump with `psql`, then run the post-deploy smoke test from DEPLOY.md against it.

## Incident response
| Situation | Immediate action |
|---|---|
| A share link was posted somewhere it shouldn't be | The owner revokes it in S08 (instant). Operators can run `update published_plans set revoked_at = now() where plan_id = '<id>' and revoked_at is null;` |
| Suspected wide link exposure | Revoke **all** live links: `update published_plans set revoked_at = now() where revoked_at is null;` Owners can republish for fresh links |
| Service-role key leaked | Rotate it in Supabase, update `SUPABASE_SERVICE_ROLE_KEY` in Vercel, redeploy. Only the briefing lookup uses it |
| `SHARE_RATE_SALT` leaked | Rotate and redeploy. The only effect is that rate-limit buckets reset |
| Scraping of `/api/briefing` | Check `share_lookup_counters` for hot client hashes; lower the per-minute limit in `get_published_snapshot` via a migration |

Contact for incidents: **set before launch** (the owner's address; also used as `NEXT_PUBLIC_CONTACT_EMAIL`).

## Data requests
- **Delete an account and everything in it:** `delete from auth.users where id = '<user id>';`. This cascades to profiles, teams, players, tactics, matches, plans, lineups and publications (regression-tested in `supabase/tests/004`). Analytics stay only under an unlinkable random id.
- **Delete one team:** the owner can do it in the app (typed-name confirmation). Its links stop working.
- **Export a user's data:** not built. Use SQL scoped to their `owner_id` if asked.

## Monitoring
- Vercel function logs: request paths contain no tokens by design (DEC-38). Never add request-body logging to `/api/briefing*`.
- Audit trail: `audit_events` (publish, republish, revoke, rotate) per team.
- Product metrics: `analytics_events` (PLAN-004 §5). Example query for G4 (briefing usage):
  ```sql
  select count(*) filter (where event = 'presentation_opened') as opens,
         count(*) filter (where event = 'pdf_exported') as exports,
         count(*) filter (where event = 'plan_published') as publishes
  from analytics_events where created_at > now() - interval '30 days';
  ```
