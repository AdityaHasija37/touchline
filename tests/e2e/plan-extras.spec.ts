import { expect, test } from "./fixtures";
import { addPlayers, createConfirmedUser, createTeam, signIn } from "./helpers/users";
import { createFixture, starters, waitLineupSaved } from "./helpers/matches";
import { playerContext, publish } from "./helpers/publish";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });
test.describe.configure({ timeout: 90_000 });

const SQUAD: [string, string][] = [
  ["Sam Okafor", "GK"],
  ["Alex Moreno", "DEF"],
  ["Jo Lindqvist", "DEF"],
  ["Kai Brennan", "FWD"],
  ["Lee Novak", "FWD"],
  ["Dani Ruiz", "MID"],
  ["Toni Walsh", "MID"],
];

test("Enhancements 1–5: formation, roles, set pieces and subs flow into the briefing; players can find themselves", async ({ page, browser }) => {
  await signIn(page, await createConfirmedUser("extras"));
  const teamId = await createTeam(page, "Extras Five", "5v5");
  await addPlayers(teamId, SQUAD.map(([name, pos], i) => ({ name, shirt_number: i + 1, preferred_positions: [pos] })));
  await createFixture(page, teamId, "Dynamos");

  // 2: pick a formation, then start players; each lands in the best free slot.
  await page.getByLabel("Formation").selectOption({ label: "2-2 box" });
  for (const [name] of SQUAD.slice(0, 5)) await page.getByRole("button", { name: `Start ${name}` }).click();
  for (const [name] of SQUAD.slice(5)) await page.getByRole("button", { name: `Bench ${name}` }).click();
  await waitLineupSaved(page);
  await expect(page.getByRole("button", { name: /^GK: Sam Okafor, natural position/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^LF: Kai Brennan, natural position/ })).toBeVisible();

  // Swap a defender into a forward slot from the pitch: both are now out of position.
  await page.getByRole("button", { name: /^RF: Lee Novak/ }).click();
  await page.locator("#slot-player").selectOption({ label: "Jo Lindqvist (RB, out of position)" });
  await waitLineupSaved(page);
  await expect(page.getByRole("button", { name: /^RF: Jo Lindqvist, out of position/ })).toBeVisible();
  await expect(page.getByLabel("Publishing checklist")).toContainText("2 starters are out of position.");
  // Swap back.
  await page.getByRole("button", { name: /^RF: Jo Lindqvist/ }).click();
  await page.locator("#slot-player").selectOption({ label: "Lee Novak (RB, natural position)" });
  await waitLineupSaved(page);
  await expect(page.getByLabel("Publishing checklist")).not.toContainText("out of position");

  // 1: role, duty and a personal instruction (roles are filtered to the slot's line).
  await page.getByLabel("Role for Alex Moreno").selectOption({ label: "Wing-back" });
  await page.getByLabel("Duty for Alex Moreno").selectOption({ label: "Attack" });
  await page.getByLabel("Instruction for Alex Moreno").fill("Overlap on every attack");
  await page.getByLabel("Instruction for Alex Moreno").press("Enter");
  await waitLineupSaved(page);
  await expect(page.getByLabel("Role for Kai Brennan").locator("option", { hasText: "Centre-back" })).toHaveCount(0);

  // 4: set pieces.
  await page.getByLabel("Captain").selectOption({ label: "Alex Moreno" });
  await page.getByLabel("Penalties").selectOption({ label: "Kai Brennan" });
  await page.getByLabel("Player marking").selectOption({ label: "Jo Lindqvist" });
  await page.getByLabel("Who or where they mark").fill("Their #9");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("list", { name: "Marking jobs" })).toContainText("Jo Lindqvist → Their #9");
  await expect(page.getByTestId("setpieces-status")).toHaveText("Saved");

  // 5: a sub plan with planned minutes (5v5 defaults to 40).
  await expect(page.getByLabel("Match length (minutes)")).toHaveValue("40");
  await page.getByRole("button", { name: "Add sub" }).click();
  await page.getByLabel("Player off in sub 1").selectOption({ label: "Kai Brennan" });
  await page.getByLabel("Player on in sub 1").selectOption({ label: "Dani Ruiz" });
  await expect(page.getByTestId("subs-status")).toHaveText("Saved");
  const minutes = page.getByRole("list", { name: "Planned minutes" });
  await expect(minutes.getByRole("listitem").filter({ hasText: "Kai Brennan" })).toContainText("20′");
  await expect(page.getByLabel("Publishing checklist")).toContainText("1 player gets under half the match.");

  // Everything survives a reload.
  await page.reload();
  await expect(starters(page).filter({ hasText: "Alex Moreno" }).getByLabel("Role for Alex Moreno")).toHaveValue("wing_back");
  await expect(page.getByLabel("Captain")).toHaveValue(/[0-9a-f-]{36}/);
  await expect(page.getByLabel("Player on in sub 1")).not.toHaveValue("");

  await page.getByRole("button", { name: "Add final reminders" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(1);
  await page.getByRole("link", { name: "Preview & publish" }).click();
  const url = await publish(page);

  const { ctx, page: player } = await playerContext(browser);
  await player.goto(url);
  const body = await (await ctx.request.post("/api/briefing", { data: { token: url.split("#")[1] } })).text();
  expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

  const viewer = player.getByTestId("viewer");
  await expect(player.getByTestId("slide-counter")).toHaveText("1 / 5");
  await player.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("img", { name: "2-2 box on the pitch" })).toBeVisible();
  await expect(viewer).toContainText("Wing-back (Attack) · Overlap on every attack");
  await player.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("heading", { name: "Set pieces" })).toBeVisible();
  await expect(viewer).toContainText("Jo Lindqvist → Their #9");
  await player.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("heading", { name: "Sub plan" })).toBeVisible();
  await expect(viewer).toContainText("On Dani Ruiz · off Kai Brennan");

  // 3: Find me.
  await player.getByRole("button", { name: "Find me" }).click();
  await player.getByLabel("Who are you?").selectOption({ label: "2 · Alex Moreno" });
  const card = player.getByTestId("player-card");
  await expect(card).toContainText("Starting · LB");
  await expect(card).toContainText("Wing-back (Attack)");
  await expect(card).toContainText("Overlap on every attack");
  await expect(card).toContainText("Captain");
  await player.getByLabel("Who are you?").selectOption({ label: "4 · Kai Brennan" });
  await expect(card).toContainText("Penalties");
  await expect(card).toContainText("Off at 20′");
  await expect(card).toContainText("20 of 40");
  await card.getByRole("button", { name: "Highlight me in the briefing" }).click();
  await expect(player.getByRole("status")).toContainText("Highlighting Kai Brennan");
  await expect(viewer.locator("li.bg-yellow-100")).toContainText("Kai Brennan");
  await ctx.close();
});
