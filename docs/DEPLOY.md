# Deploying Touchline (Vercel + Supabase)

Status: **not deployed.** This is the checklist for the first deployment (DEC-03). It needs the owner's own Vercel and Supabase accounts, and nothing deploys automatically.

## 0. Before you start
- Push the repo to GitHub (it's currently local-only).
- Create **two** Supabase projects: `touchline-dev` and `touchline-prod`. Dev and prod must stay separate (TECH-003 §6).
- Pick an SMTP provider for auth emails (see step 2). It's required for real sign-ups.

## 1. Database (Supabase cloud)
```bash
npx supabase login
npx supabase link --project-ref <prod-project-ref>
npx supabase db push            # applies supabase/migrations in order
npx supabase test db --linked   # optional: run the pgTAP suite against the linked project
```
Then, in the dashboard, confirm RLS shows as enabled on every `public` table.

## 2. Auth settings (dashboard → Authentication)
- **Site URL:** `https://<your-domain>`. **Redirect URLs:** `https://<your-domain>/**`.
- **Email confirmations:** on (DEC-14).
- **Email templates:** copy `supabase/templates/confirmation.html` and `recovery.html` into the Confirm signup and Reset password templates, or use `npx supabase config push`. Both use the token-hash link to `/auth/confirm`.
- **SMTP:** set up custom SMTP (e.g. Resend, Postmark or SES). Supabase's built-in sender is heavily rate-limited and won't deliver to arbitrary users, so without this nobody outside your team can confirm an account.
- Minimum password length: 8.

## 3. Vercel
Import the GitHub repo (framework: Next.js) and set these environment variables. They're names only here; never commit the values.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only, sensitive** | Used only by two server-side jobs: the public briefing lookup (DEC-40) and demo sandboxes (DEC-48) |
| `SHARE_RATE_SALT` | server only, sensitive | Long random string. Required in production |
| `NEXT_PUBLIC_SITE_URL` | all | `https://<your-domain>`, used in share links and auth emails |
| `NEXT_PUBLIC_CONTACT_EMAIL` | all | Optional; shown on `/privacy` |
| `DEMO_ENABLED` | server | Optional. Defaults to on; set `false` to hide "Try the demo" |

## 4. Post-deploy smoke test (record results, don't assume them)
0. Click **Try the demo** on the landing page: you should land in a pre-filled 7v7 team with no email step.
1. Register with a real email, confirm it, and sign in. Reset the password.
2. Create a 7v7 team, add 7 players, make a tactic, then save and reload it.
3. Add a fixture, pick 7 starters, attach the tactic, publish. Open the link on a phone, then present on a laptop.
4. Download the PDF as owner **and** from the player link. Check that the Noto Sans font renders (non-English names).
5. Revoke the link; confirm "Briefing unavailable".
6. **Rate limit behind Vercel:** fire 61 lookups in a minute from one client and confirm the 61st gets a 429. Then confirm that a *different* client isn't limited (that is, `x-vercel-forwarded-for` is being used).
7. **Logs:** search the Vercel and Supabase logs for a share token you used. It must not appear anywhere.
8. Check `/api/briefing` has `Cache-Control: no-store`, and that `/p` sends `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`.

## 5. Known deployment risks
- PDF generation runs in a Node serverless function. Check cold-start time and that `assets/fonts/**` was traced into the function (configured in `next.config.ts`).
- The free Supabase tier pauses inactive projects. Fine for a portfolio demo, not for a pilot.
