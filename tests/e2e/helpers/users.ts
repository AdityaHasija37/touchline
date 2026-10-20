import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const PASSWORD = "matchday-ready-1";

export function uniqueEmail(tag: string) {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

/** Test-only admin client against the LOCAL stack, used to create pre-confirmed users quickly. */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Run against local Supabase with .env.local present");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("Refusing to use admin helpers outside local dev");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function createConfirmedUser(tag: string) {
  const email = uniqueEmail(tag);
  const { error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return email;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/teams/);
}

/** Polls Mailpit for the newest email to `to` and returns the first /auth/confirm link in it. */
export async function confirmationLink(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No confirmation email for ${to}`);
}

export async function createTeam(page: Page, name: string, format: "5v5" | "7v7" | "11v11" = "7v7") {
  await page.goto("/app/teams/new");
  await page.getByLabel("Team name").fill(name);
  await page.getByText(format, { exact: true }).click();
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/app\/teams\/[0-9a-f-]{36}\/squad$/);
  return page.url().match(/teams\/([0-9a-f-]{36})/)![1];
}

/** Test-only: seed squad players straight into the local DB. */
export async function addPlayers(teamId: string, players: { name: string; shirt_number?: number }[]) {
  const { error } = await admin().from("players").insert(players.map((p) => ({ team_id: teamId, ...p })));
  if (error) throw error;
}

/** Test-only: analytics events recorded for a team (read via the local service role). */
export async function analyticsEvents(teamId: string): Promise<{ event: string; props: Record<string, unknown> }[]> {
  const db = admin();
  const { data: team } = await db.from("teams").select("analytics_id").eq("id", teamId).single();
  const { data } = await db.from("analytics_events").select("event, props").eq("team_ref", team!.analytics_id).order("id");
  return (data ?? []) as { event: string; props: Record<string, unknown> }[];
}
