# Deploying Touchline (Vercel + Supabase)

Status: **deployed 20 Oct 2026** at https://touchline-olive-six.vercel.app (Vercel Hobby + Supabase Free, linked with the Supabase–Vercel integration). This is the checklist that was followed, kept for redeploys.

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
- **Email templates:** optional. `/auth/confirm` accepts both Supabase's default links (`?code=`) and the custom token-hash templates in `supabase/templates/`. Supabase only lets you edit templates after setting up custom SMTP; the custom ones also work when the email is opened on a different device.
- **SMTP:** without custom SMTP (e.g. Resend, Postmark or SES), Supabase's built-in sender only delivers to members of your Supabase organization, so the public can't confirm real accounts. The one-click demo needs no email, which is why it's the recruiter path.
- Minimum password length: 8.

## 3. Vercel
Import the GitHub repo (framework: Next.js) and set these environment variables. They're names only here; never commit the values.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only, sensitive** | Used only by two server-side jobs: the public briefing lookup (DEC-40) and demo sandboxes (DEC-48) |
| `SHARE_RATE_SALT` | server only, sensitive | Optional. Rate-limit key; falls back to a keyed hash of the service-role key |
| `NEXT_PUBLIC_SITE_URL` | all | Optional on Vercel (uses the platform's production domain); set it for a custom domain |
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
