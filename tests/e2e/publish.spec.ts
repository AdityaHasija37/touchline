import { expect, test } from "./fixtures";
import { createConfirmedUser, signIn } from "./helpers/users";
import { waitForCanvas } from "./helpers/editor";
import { EXCLUDED_NOTE, PRIVATE_NOTE, SQUAD, openAsPlayer, playerContext, publish, readyPlan } from "./helpers/publish";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });
// Each test builds a full plan through the UI first (~25 steps), so allow more than the 30 s default.
test.describe.configure({ timeout: 90_000 });

test("J03 / PRES-01 / PRES-02: publish, open as a player, navigate, and nothing private leaks", async ({ page, browser }) => {
  await readyPlan(page, "j03");
  await expect(page.getByTestId("link-state")).toContainText("Not published");
  await expect(page.getByText(/Not included: “Coaching notes”/)).toBeVisible();
  const url = await publish(page);
  expect(url).toMatch(/\/p#[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId("link-state")).toContainText("Live");

  // Listen before the first navigation so we see every request and the one briefing response.
  const { ctx, page: player } = await playerContext(browser);
  const token = url.split("#")[1];
  const requested: string[] = [];
  player.on("request", (r) => requested.push(r.url()));
  await player.goto(url);
  // Inspect exactly what the public API returns for this token (same client context and headers).
  const api = await ctx.request.post("/api/briefing", { data: { token } });
  expect(api.status()).toBe(200);
  const body = await api.text();

  // Title → lineup → board → reminders, in stored order; keyboard and jump list work.
  const viewer = player.getByTestId("viewer");
  await expect(viewer.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  await expect(viewer).toContainText("Sat, 4 May 2030, 14:00 BST");
  await expect(viewer).toContainText("Win the second balls");
  await expect(player.getByTestId("slide-counter")).toHaveText("1 / 4");
  await player.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("heading", { name: "Starting lineup" })).toBeVisible();
  for (const name of SQUAD.slice(0, 9)) await expect(viewer).toContainText(name);
  await player.keyboard.press("ArrowRight");
  await expect(viewer.getByRole("heading", { name: "Press shape" })).toBeVisible();
  await expect(viewer.getByRole("img", { name: "Press shape" })).toBeVisible();
  await expect(viewer).toContainText("Stay compact in midfield.");
  await player.keyboard.press("End");
  await expect(viewer.getByRole("heading", { name: "Final reminders" })).toBeVisible();
  await expect(viewer.getByRole("listitem")).toHaveText([/Talk early/, /Win the first header/]);
  await player.keyboard.press("ArrowLeft");
  await expect(player.getByTestId("slide-counter")).toHaveText("3 / 4");
  await player.getByLabel("Jump to slide").selectOption({ label: "2. Starting lineup" });
  await expect(player.getByTestId("slide-counter")).toHaveText("2 / 4");
  await player.getByRole("button", { name: "Previous slide" }).click();
  await expect(player.getByRole("button", { name: "Previous slide" })).toBeDisabled();

  // Read-only and private: no app links, no private/excluded content, no squad directory, no ids.
  await expect(player.locator('a[href^="/app"]')).toHaveCount(0);
  for (const secret of [PRIVATE_NOTE, EXCLUDED_NOTE, "Unpicked Ulla"]) {
    expect(await player.content()).not.toContain(secret);
    expect(body).not.toContain(secret);
  }
  expect(body).not.toMatch(/"playerId":"[0-9a-f-]{36}"/);
  expect(body).not.toMatch(/privateNotes|owner_id|team_id/);
  // The token never travels in a URL (DEC-38).
  expect(requested.some((u) => u.includes(token))).toBe(false);
  await ctx.close();
});

test("QA-06: editing after publishing doesn't change the briefing until republish (same link)", async ({ page, browser }) => {
  const { tacticId, matchId } = await readyPlan(page, "qa06");
  const url = await publish(page);

  // Edit the source tactic and the plan notes.
  await page.goto(`/app/tactics/${tacticId}`);
  await waitForCanvas(page);
  await page.getByRole("list", { name: "Board objects" }).getByRole("button").filter({ hasText: /^Player ST/ }).click();
  await page.getByLabel("Label on pitch").fill("NEW");
  await page.getByLabel("Label on pitch").press("Enter");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByTestId("save-status")).toContainText("All changes saved");
  await page.goto(`/app/matches/${matchId}/plan`);
  const board = page.getByTestId("plan-section").first();
  await board.getByLabel("Coaching notes for players").fill("Changed after publishing.");
  await board.getByLabel("Coaching notes for players").blur();
  await expect(board.getByText("Saved")).toBeVisible();

  const { ctx, page: player } = await openAsPlayer(browser, url);
  await player.getByLabel("Jump to slide").selectOption({ index: 2 });
  await expect(player.getByTestId("viewer")).toContainText("Stay compact in midfield.");
  await expect(player.getByTestId("viewer").getByRole("img", { name: "Press shape" })).not.toContainText("NEW");

  await page.getByRole("link", { name: "Preview & publish" }).click();
  await expect(page.getByText("Your draft has changes players can't see yet.")).toBeVisible();
  await page.getByRole("button", { name: "Republish changes" }).click();
  await expect(page.getByText("Your draft has changes players can't see yet.")).toHaveCount(0);

  await player.reload();
  await player.getByLabel("Jump to slide").selectOption({ index: 2 });
  await expect(player.getByTestId("viewer")).toContainText("Changed after publishing.");
  await expect(player.getByTestId("viewer").getByRole("img", { name: "Press shape" })).toContainText("NEW");
  await ctx.close();
});

test("QA-07: revoke shows a safe unavailable page; a new link replaces the old one", async ({ page, browser }) => {
  await readyPlan(page, "qa07");
  const first = await publish(page);

  // Rotate: new link works, old one stops.
  await page.getByRole("button", { name: "Get a new link" }).click();
  await expect(page.getByLabel("Share this link")).not.toHaveValue(first);
  const second = await page.getByLabel("Share this link").inputValue();
  const a = await openAsPlayer(browser, first);
  await expect(a.page.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
  const b = await openAsPlayer(browser, second);
  await expect(b.page.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();

  // Revoke.
  await page.getByRole("button", { name: "Revoke link" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByTestId("link-state")).toContainText("Not published");
  await b.page.reload();
  await expect(b.page.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
  await expect(b.page.getByText("vs Dynamos")).toHaveCount(0);

  // Draft stays private and intact; publishing again issues a fresh link.
  const third = await publish(page);
  expect(third).not.toBe(second);
  await b.page.reload();
  await expect(b.page.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
  await a.ctx.close();
  await b.ctx.close();
});

test("QA-10: archiving a player after publishing doesn't break the published lineup", async ({ page, browser }) => {
  const { teamId } = await readyPlan(page, "qa10");
  const url = await publish(page);
  await page.goto(`/app/teams/${teamId}/squad`);
  await page.getByRole("button", { name: `Archive ${SQUAD[0]}` }).click();
  await expect(page.getByText(`${SQUAD[0]} archived.`)).toBeVisible();

  const { ctx, page: player } = await openAsPlayer(browser, url);
  await player.getByRole("button", { name: "Next slide" }).click();
  await expect(player.getByTestId("viewer")).toContainText(SQUAD[0]);
  await ctx.close();
});

test("QA-09: the briefing is readable on a 375px phone with no horizontal overflow", async ({ page, browser }) => {
  await readyPlan(page, "qa09");
  const url = await publish(page);
  const { ctx, page: phone } = await openAsPlayer(browser, url, { width: 375, height: 812 });
  await expect(phone.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  for (let i = 0; i < 4; i++) {
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `slide ${i + 1}`).toBeLessThanOrEqual(0);
    const slide = (await phone.locator("[aria-roledescription=slide]").boundingBox())!;
    expect(slide.width).toBeGreaterThan(300);
    if (i < 3) await phone.getByRole("button", { name: "Next slide" }).click();
  }
  await expect(phone.getByRole("heading", { name: "Final reminders" })).toBeVisible();
  await ctx.close();
});

test("bad, empty and stale tokens all get the same safe page; headers keep it private", async ({ browser, request }) => {
  for (const url of ["/p", "/p#nope", "/p#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde"]) {
    const { ctx, page } = await openAsPlayer(browser, url);
    await expect(page.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
    await ctx.close();
  }
  const res = await request.post("/api/briefing", { data: { token: "x".repeat(43) }, headers: { "x-forwarded-for": "10.9.9.9" } });
  expect(res.status()).toBe(404);
  // The API carries the data, so it must never be cached. The /p shell holds no data (the
  // briefing arrives via the API), so Next may cache it, but it must not be indexed or leak a Referer.
  expect(res.headers()["cache-control"]).toContain("no-store");
  for (const h of [res.headers(), (await request.get("/p")).headers()]) {
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["referrer-policy"]).toBe("no-referrer");
  }
});

test("owner presenter works with the keyboard; other users can't reach publish or present", async ({ page, browser }) => {
  const { planId } = await readyPlan(page, "presenter");
  await page.getByRole("link", { name: "Preview full screen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft preview" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("slide-counter")).toHaveText("2 / 4");
  await page.getByRole("link", { name: "Exit" }).click();
  await publish(page);
  await page.getByRole("link", { name: "Present published briefing" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft preview" })).toHaveCount(0);
  await expect(page.getByTestId("viewer").getByRole("heading", { name: "vs Dynamos" })).toBeVisible();

  const other = await browser.newContext();
  const op = await other.newPage();
  await signIn(op, await createConfirmedUser("presenter-b"));
  for (const path of [`/app/plans/${planId}/publish`, `/app/plans/${planId}/present`]) {
    const res = await op.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(op.getByText("Dynamos")).toHaveCount(0);
  }
  await other.close();
});

test("opening a different share link in the same tab shows that briefing, not the previous one", async ({ page, browser }) => {
  await readyPlan(page, "hashswap");
  const url = await publish(page);
  const { ctx, page: player } = await openAsPlayer(browser, url);
  await expect(player.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  await player.evaluate(() => (window.location.hash = "#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde"));
  await expect(player.getByRole("heading", { name: "Briefing unavailable" })).toBeVisible();
  await player.evaluate((h) => (window.location.hash = h), url.split("#")[1]);
  await expect(player.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  await ctx.close();
});
