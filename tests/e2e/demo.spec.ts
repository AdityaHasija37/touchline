import { expect, test } from "./fixtures";
import { openAsPlayer, publish } from "./helpers/publish";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });
test.describe.configure({ timeout: 90_000 });

const visitor = (n: number) => ({ "x-forwarded-for": `10.200.${n}.${Math.floor(Math.random() * 250) + 1}` });

test("one click from the landing page into a ready sandbox; publish and view as a player", async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: visitor(1), timezoneId: "Europe/London", viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo, no sign-up" }).click();
  await expect(page).toHaveURL(/\/app\/teams\?welcome=demo$/);
  await expect(page.getByText("You're in a private demo sandbox.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A two-minute tour" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sunday Rovers/ })).toContainText("9 players");
  await expect(page.getByRole("link", { name: /Sunday Rovers/ })).toContainText("Next: vs Riverside Dynamos");

  await page.getByRole("link", { name: /Open Saturday's match plan/ }).click();
  await expect(page).toHaveURL(/\/app\/matches\/[0-9a-f-]{36}\/plan$/);
  await expect(page.getByTestId("starter-count")).toHaveText("7/7");
  await expect(page.getByTestId("plan-section")).toHaveCount(3);
  await expect(page.getByText("Ready to publish.")).toBeVisible();

  await page.getByRole("link", { name: "Preview & publish" }).click();
  const url = await publish(page);
  const { ctx: pctx, page: player } = await openAsPlayer(browser, url, { width: 375, height: 812 });
  await expect(player.getByRole("heading", { name: "vs Riverside Dynamos" })).toBeVisible();
  await player.getByLabel("Jump to slide").selectOption({ label: "3. Our press" });
  await expect(player.getByTestId("viewer")).toContainText("Show them inside");
  await expect(player.getByTestId("viewer")).not.toContainText("Players never see this");
  await pctx.close();
  await ctx.close();
});

test("each visitor gets an isolated sandbox, and demo creation is rate-limited", async ({ browser }) => {
  const ip = visitor(2);
  const a = await browser.newContext({ extraHTTPHeaders: ip });
  const pa = await a.newPage();
  await pa.goto("/");
  await pa.getByRole("button", { name: "Try the demo, no sign-up" }).click();
  await expect(pa).toHaveURL(/welcome=demo/);
  const teamA = (await pa.getByRole("link", { name: /Sunday Rovers/ }).getAttribute("href"))!;

  const b = await browser.newContext({ extraHTTPHeaders: visitor(3) });
  const pb = await b.newPage();
  await pb.goto("/");
  await pb.getByRole("button", { name: "Try the demo, no sign-up" }).click();
  await expect(pb).toHaveURL(/welcome=demo/);
  expect(await pb.getByRole("link", { name: /Sunday Rovers/ }).getAttribute("href")).not.toBe(teamA);
  expect((await pb.goto(teamA))?.status()).toBe(404);

  // Same network: 5 per hour. This visitor has used 1, so 4 more succeed and the 6th is turned away.
  for (let i = 0; i < 5; i++) {
    const c = await browser.newContext({ extraHTTPHeaders: ip });
    const pc = await c.newPage();
    await pc.goto("/");
    await pc.getByRole("button", { name: "Try the demo, no sign-up" }).click();
    if (i < 4) await expect(pc).toHaveURL(/welcome=demo/);
    else await expect(pc.getByText("The demo is busy right now.")).toBeVisible();
    await c.close();
  }
  await a.close();
  await b.close();
});
