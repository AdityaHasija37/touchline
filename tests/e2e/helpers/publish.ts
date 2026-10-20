import { expect, type Browser, type Page } from "@playwright/test";
import { addPlayers, createConfirmedUser, createTeam, signIn } from "./users";
import { createTactic } from "./editor";
import { createFixture, waitLineupSaved } from "./matches";

export const SQUAD = ["Sam Okafor", "Alex Moreno", "Jo Lindqvist", "Riley Chen", "Max Adeyemi", "Kai Brennan", "Lee Novak", "Dani Ruiz", "Toni Walsh", "Unpicked Ulla"];
export const PRIVATE_NOTE = "PRIVATE-do-not-share-9f3";
export const EXCLUDED_NOTE = "EXCLUDED-section-text-7c1";

/** A complete, publishable 7v7 plan: 7 starters, 2 bench, a board, an excluded notes section, reminders. */
export async function readyPlan(page: Page, tag: string) {
  await signIn(page, await createConfirmedUser(tag));
  const teamId = await createTeam(page, `${tag} Rovers`, "7v7");
  await addPlayers(teamId, SQUAD.map((name, i) => ({ name, shirt_number: i + 1 })));
  const tacticId = await createTactic(page, teamId, "Press shape", "2-3-1");
  const matchId = await createFixture(page, teamId, "Dynamos", { date: "2030-05-04", time: "14:00", venue: "Riverside Park" });

  for (const name of SQUAD.slice(0, 7)) await page.getByRole("button", { name: `Start ${name}` }).click();
  for (const name of SQUAD.slice(7, 9)) await page.getByRole("button", { name: `Bench ${name}` }).click();
  await waitLineupSaved(page);
  await page.getByLabel("Match objective").fill("Win the second balls");
  await page.getByLabel("Match objective").press("Enter");
  await expect(page.getByTestId("objective-status")).toHaveText("Saved");

  await page.getByRole("button", { name: "Add tactic board" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Press shape/ }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(1);
  const board = page.getByTestId("plan-section").first();
  await board.getByLabel("Coaching notes for players").fill("Stay compact in midfield.");
  await board.getByText("Private note (never shared)").click();
  await board.getByLabel(/Private note for/).fill(PRIVATE_NOTE);
  await board.getByLabel(/Private note for/).blur();
  await expect(board.getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Add notes" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(2);
  const notes = page.getByTestId("plan-section").nth(1);
  await notes.getByLabel("Coaching notes for players").fill(EXCLUDED_NOTE);
  await notes.getByLabel("Coaching notes for players").blur();
  await expect(notes.getByText("Saved")).toBeVisible();
  await notes.getByLabel("Include in players' briefing").uncheck();
  await expect(notes).toContainText("Not in briefing");

  await page.getByRole("button", { name: "Add final reminders" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(3);
  const rem = page.getByTestId("plan-section").nth(2);
  await rem.getByLabel("Reminders for players").fill("Talk early\nWin the first header");
  await rem.getByLabel("Reminders for players").blur();
  await expect(rem.getByText("Saved")).toBeVisible();

  await page.getByRole("link", { name: "Preview & publish" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]{36}\/publish$/);
  const planId = page.url().match(/plans\/([0-9a-f-]{36})/)![1];
  return { teamId, tacticId, matchId, planId };
}

export async function publish(page: Page): Promise<string> {
  // After a full page load, wait for hydration so the click reaches React.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Publish briefing" }).click();
  const link = page.getByLabel("Share this link");
  await expect(link).toBeVisible();
  return link.inputValue();
}

/** A fresh anonymous browser (own IP for the rate limiter), not yet navigated. */
export async function playerContext(browser: Browser, viewport = { width: 1280, height: 720 }) {
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": `10.${rand()}.${rand()}.${rand()}` } });
  return { ctx, page: await ctx.newPage() };
}

/** Open a share link as a player would. */
export async function openAsPlayer(browser: Browser, url: string, viewport = { width: 1280, height: 720 }) {
  const p = await playerContext(browser, viewport);
  await p.page.goto(url);
  return p;
}

const rand = () => Math.floor(Math.random() * 250) + 1;
