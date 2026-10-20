import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { PASSWORD, analyticsEvents, confirmationLink, uniqueEmail } from "./helpers/users";
import { dragOnPitch, expectSaved, objectPos, waitForCanvas } from "./helpers/editor";
import { pdfPages } from "./helpers/pdf";
import { openAsPlayer, publish } from "./helpers/publish";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });
test.describe.configure({ timeout: 180_000 });

/** TECH-003 §9 E2E: new user → team → seven players → tactic → fixture → plan → publish → present → PDF. All through the UI. */
test("full journey J01 → J02 → J03", async ({ page, browser }) => {
  // J01: register and confirm
  const email = uniqueEmail("journey");
  await page.goto("/register");
  await page.getByLabel("Your name (optional)").fill("Jordan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("confirmation link");
  await page.goto(await confirmationLink(email));
  await expect(page.getByRole("heading", { name: "Set up your first team" })).toBeVisible();

  // Team + 7 players
  await page.getByRole("link", { name: "Create a team" }).click();
  await page.getByLabel("Team name").fill("Journey Rovers");
  await page.getByText("7v7", { exact: true }).click();
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/squad$/);
  const teamId = page.url().match(/teams\/([0-9a-f-]{36})/)![1];
  await page.getByRole("button", { name: "Add player" }).click();
  const squad = ["Sam", "Alex", "Jo", "Riley", "Max", "Kai", "Lee"];
  for (const [i, name] of squad.entries()) {
    await page.getByLabel("Name", { exact: true }).fill(`${name} Journey`);
    await page.getByLabel("Shirt no.").fill(String(i + 1));
    await page.getByRole("button", { name: "Add player" }).click();
    await expect(page.getByRole("list", { name: "Active players" }).getByText(`${name} Journey`)).toBeVisible();
  }

  // 7v7 tactic: drag a player, save, confirm in library
  await page.getByRole("link", { name: "Tactics", exact: true }).click();
  await page.getByRole("button", { name: "Create tactic" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Journey shape");
  await page.getByRole("dialog").getByRole("button", { name: "Create and open editor" }).click();
  await waitForCanvas(page);
  await dragOnPitch(page, { x: 50, y: 28 }, { x: 60, y: 22 });
  await page.keyboard.press("ControlOrMeta+s");
  await expectSaved(page);
  const moved = await objectPos(page, /^Player ST/);
  await page.getByRole("link", { name: "Tactics" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Journey shape" })).toBeVisible();

  // J02: fixture, lineup, attach tactic, objective, preview
  await page.getByRole("link", { name: "Matches", exact: true }).click();
  await page.getByRole("button", { name: "Add fixture" }).click();
  const fixture = page.getByRole("dialog");
  await fixture.getByLabel("Opponent").fill("Final Opponents");
  await fixture.getByLabel("Date").fill("2030-09-21");
  await fixture.getByLabel("Kickoff").fill("10:30");
  await fixture.getByRole("button", { name: "Add and plan it" }).click();
  await expect(page).toHaveURL(/plan$/);
  for (const name of squad) await page.getByRole("button", { name: `Start ${name} Journey` }).click();
  await expect(page.getByTestId("lineup-status")).toHaveText("Saved");
  await page.getByLabel("Match objective").fill("Keep the ball on the floor");
  await page.getByLabel("Match objective").press("Enter");
  await page.getByRole("button", { name: "Add tactic board" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Journey shape/ }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(1);
  await expect(page.getByText("Ready to publish.")).toBeVisible();

  // J03: publish, present, share, PDF
  await page.getByRole("link", { name: "Preview & publish" }).click();
  const url = await publish(page);
  await page.getByRole("link", { name: "Present published briefing" }).click();
  await expect(page.getByTestId("viewer").getByRole("heading", { name: "vs Final Opponents" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByTestId("viewer").getByRole("img", { name: "Journey shape" })).toBeVisible();
  await page.getByRole("link", { name: "Exit" }).click();

  const { ctx, page: player } = await openAsPlayer(browser, url, { width: 375, height: 812 });
  await expect(player.getByRole("heading", { name: "vs Final Opponents" })).toBeVisible();
  await player.getByRole("button", { name: "Next slide" }).click();
  for (const name of squad) await expect(player.getByTestId("viewer")).toContainText(`${name} Journey`);
  await ctx.close();

  const dl = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const pages = await pdfPages(readFileSync((await (await dl).path())!));
  expect(pages).toHaveLength(3);
  expect(pages[0]).toMatch(/Sat, 21 Sept? 2030, 10:30 BST/);
  expect(pages[2]).toContain("Journey shape");
  expect(moved.x).toBeGreaterThan(55);

  const events = (await analyticsEvents(teamId)).map((e) => e.event);
  expect(events.filter((e) => e === "player_added")).toHaveLength(7);
  for (const e of ["team_created", "tactic_saved", "match_plan_created", "plan_published", "presentation_opened", "pdf_exported"]) expect(events, e).toContain(e);
});
