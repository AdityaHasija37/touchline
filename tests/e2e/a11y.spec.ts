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
