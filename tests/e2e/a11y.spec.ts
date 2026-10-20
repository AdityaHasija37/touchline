import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { waitForCanvas } from "./helpers/editor";
import { openAsPlayer, publish, readyPlan } from "./helpers/publish";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });
test.describe.configure({ timeout: 180_000 });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: import("@playwright/test").Page, name: string, settle: "networkidle" | "load" = "networkidle") {
  await page.waitForLoadState(settle);
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude("[data-testid=pitch-stage] canvas").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`);
  expect.soft(summary, `${name}\n${summary.join("\n")}`).toEqual([]);
}

test("NFR-01: no serious or critical WCAG 2.2 AA violations on key screens", async ({ page, browser }) => {
  for (const path of ["/", "/login", "/register", "/reset-password"]) {
    await page.goto(path);
    await audit(page, path);
  }

  const { teamId, tacticId, matchId, planId } = await readyPlan(page, "a11y");
  for (const [name, path] of [
    ["dashboard", "/app/teams"],
    ["team overview", `/app/teams/${teamId}`],
    ["squad", `/app/teams/${teamId}/squad`],
    ["tactics library", `/app/teams/${teamId}/tactics`],
    ["matches", `/app/teams/${teamId}/matches`],
    ["match plan", `/app/matches/${matchId}/plan`],
    ["publish", `/app/plans/${planId}/publish`],
  ] as const) {
    await page.goto(path);
    await audit(page, name);
  }

  await page.goto(`/app/tactics/${tacticId}`);
  await waitForCanvas(page);
  await audit(page, "tactics editor");

  await page.goto(`/app/plans/${planId}/publish`);
  const url = await publish(page);
  await page.goto(`/app/plans/${planId}/present`);
  await audit(page, "presenter", "load");

  const { ctx, page: player } = await openAsPlayer(browser, url);
  await expect(player.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  await audit(player, "public briefing", "load");
  await player.goto("/p#not-a-real-token");
  await expect(player.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
  await audit(player, "unavailable page", "load");
  await ctx.close();
});

test("NFR-01 (1.1): pitch builder, set pieces, sub plan, new slides and Find me have no serious violations", async ({ browser }) => {
  // The demo sandbox has a formation, roles, set pieces and a sub plan already filled in.
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.201.${Math.floor(Math.random() * 250)}.7` }, viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo, no sign-up" }).click();
  await page.getByRole("link", { name: /Open Saturday's match plan/ }).click();
  await expect(page.getByRole("group", { name: "2-3-1 pitch" })).toBeVisible();
  await page.getByRole("button", { name: /^ST: / }).click();
  await audit(page, "match plan with pitch builder");

  await page.getByRole("link", { name: "Preview & publish" }).click();
  const url = await publish(page);
  const { ctx: pctx, page: player } = await openAsPlayer(browser, url, { width: 375, height: 812 });
  await expect(player.getByRole("heading", { name: "vs Riverside Dynamos" })).toBeVisible();
  for (const label of ["2. Starting lineup", "3. Set pieces", "4. Sub plan"]) {
    await player.getByLabel("Jump to slide").selectOption({ label });
    await audit(player, `public ${label}`, "load");
  }
  await player.getByRole("button", { name: "Find me" }).click();
  await player.getByLabel("Who are you?").selectOption({ index: 1 });
  await expect(player.getByTestId("player-card")).toBeVisible();
  await audit(player, "find me dialog", "load");
  await pctx.close();
  await ctx.close();
});
