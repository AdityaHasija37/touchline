import { expect, test } from "./fixtures";
import { addPlayers, createConfirmedUser, createTeam, signIn } from "./helpers/users";
import { createTactic, dragOnPitch, expectSaved, objectList, objectPos, waitForCanvas } from "./helpers/editor";

test.use({ viewport: { width: 1280, height: 860 } });

test.describe("TAC-01 formations", () => {
  test("a 7v7 preset places exactly 7 own markers and the cap holds", async ({ page }) => {
    await signIn(page, await createConfirmedUser("tac01"));
    const teamId = await createTeam(page, "Preset Rovers", "7v7");
    await page.goto(`/app/teams/${teamId}/tactics`);
    await expect(page.getByText("Start with a formation or a blank pitch.")).toBeVisible();
    // Only formats matching the team are offered.
    await page.getByRole("button", { name: "Create tactic" }).click();
    await expect(page.getByRole("dialog").getByText("4-4-2")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await createTactic(page, teamId, "Base shape", "2-3-1");
    await expect(objectList(page).filter({ hasText: /^Player/ })).toHaveCount(7);
    await expect(objectList(page).filter({ hasText: "Ball" })).toHaveCount(1);
    await expect(page.getByText("Your players 7/7")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add your player (7/7)" })).toBeDisabled();
  });

  test("blank pitch: add up to the format, opponents too, remove with Delete", async ({ page }) => {
    await signIn(page, await createConfirmedUser("blank"));
    const teamId = await createTeam(page, "Blank Five", "5v5");
    await createTactic(page, teamId, "Empty", "Blank pitch");
    await expect(page.getByText("Nothing yet.")).toBeVisible();
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Add your player/ }).click();
    await expect(page.getByRole("button", { name: "Add your player (5/5)" })).toBeDisabled();
    await page.getByRole("button", { name: /^Add opponent/ }).click();
    await page.getByRole("button", { name: "Add ball" }).click();
    await expect(page.getByRole("button", { name: "Add ball" })).toBeDisabled();
    await expect(objectList(page)).toHaveCount(7);

    await objectList(page).filter({ hasText: /^Opponent/ }).click();
    await page.getByRole("application").focus();
    await page.keyboard.press("Delete");
    await expect(objectList(page).filter({ hasText: /^Opponent/ })).toHaveCount(0);
    await expectSaved(page);
  });
});

test.describe("TAC-02 / TAC-03 editing and persistence", () => {
  test("QA-03: drag, nudge and link a player; reload restores identical geometry", async ({ page }) => {
    await signIn(page, await createConfirmedUser("qa03"));
    const teamId = await createTeam(page, "Geometry FC", "7v7");
    await addPlayers(teamId, [{ name: "Sam Okafor", shirt_number: 1 }, { name: "Kai Brennan", shirt_number: 10 }]);
    await createTactic(page, teamId, "Drag test", "2-3-1");

    // Striker starts at (50, 28) in the 2-3-1 preset.
    await dragOnPitch(page, { x: 50, y: 28 }, { x: 70, y: 20 });
    const dragged = await objectPos(page, /^Player ST/);
    expect(Math.abs(dragged.x - 70)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(dragged.y - 20)).toBeLessThanOrEqual(0.5);

    // Link the striker to a squad player: label changes, position doesn't.
    await page.getByLabel("Squad player").selectOption({ label: "10 · Kai Brennan" });
    await expect(objectList(page).filter({ hasText: "Kai Brennan" })).toContainText("Player 10");
    expect(await objectPos(page, /Kai Brennan/)).toEqual(dragged);

    // Keyboard alternative: nudge right 3, down 5 (Shift).
    await page.getByRole("application").focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const nudged = await objectPos(page, /Kai Brennan/);
    expect(nudged.x).toBeCloseTo(dragged.x + 3, 5);
    expect(nudged.y).toBeCloseTo(dragged.y + 5, 5);

    // Non-canvas alternative: type exact coordinates.
    await objectList(page).filter({ hasText: /^Player GK/ }).click();
    await page.getByLabel("Across (x)").fill("44.5");
    await page.getByLabel("Across (x)").press("Enter");

    await page.keyboard.press("ControlOrMeta+s");
    await expectSaved(page);
    const before = await page.getByRole("list", { name: "Board objects" }).innerText();

    await page.reload();
    await waitForCanvas(page);
    expect(await page.getByRole("list", { name: "Board objects" }).innerText()).toBe(before);
    expect(await objectPos(page, /Kai Brennan/)).toEqual(nudged);
    expect((await objectPos(page, /^Player GK/)).x).toBe(44.5);
  });

  test("drags past the touchline clamp to the pitch edge", async ({ page }) => {
    await signIn(page, await createConfirmedUser("clamp"));
    const teamId = await createTeam(page, "Clamp United", "5v5");
    await createTactic(page, teamId, "Edges", "2-2 box");
    const stage = (await page.getByTestId("pitch-stage").boundingBox())!;
    const g = JSON.parse((await page.getByTestId("pitch-stage").getAttribute("data-pitch"))!);
    // Left forward at (30, 38): drag far off the left and top of the canvas.
    await page.mouse.move(stage.x + g.x + 0.3 * g.vw, stage.y + g.y + 0.38 * g.vh);
    await page.mouse.down();
    await page.mouse.move(stage.x - 300, stage.y - 300, { steps: 12 });
    await page.mouse.up();
    expect(await objectPos(page, /^Player LF/)).toEqual({ x: 0, y: 0 });
  });

  test("QA-04: a stale tab can't overwrite a newer save; it can keep its work as a copy", async ({ context }) => {
    const tab1 = await context.newPage();
    await signIn(tab1, await createConfirmedUser("qa04"));
    const teamId = await createTeam(tab1, "Two Tabs FC", "7v7");
    const tacticId = await createTactic(tab1, teamId, "Contested", "3-2-1");

    const tab2 = await context.newPage();
    await tab2.goto(`/app/tactics/${tacticId}`);
    await waitForCanvas(tab2);

    for (const [tab, key] of [[tab1, "ArrowLeft"], [tab2, "ArrowRight"]] as const) {
      await objectList(tab).filter({ hasText: /^Player ST/ }).click();
      await tab.getByRole("application").focus();
      await tab.keyboard.press(`Shift+${key}`);
    }
    await tab1.keyboard.press("ControlOrMeta+s");
    await expectSaved(tab1);
    expect((await objectPos(tab1, /^Player ST/)).x).toBe(45);

    await tab2.keyboard.press("ControlOrMeta+s");
    const banner = tab2.getByRole("alert").filter({ hasText: "changed in another tab" });
    await expect(banner).toBeVisible();
    await expect(tab2.getByTestId("save-status")).toContainText("conflict");

    // Server still has tab 1's version.
    await tab1.reload();
    await waitForCanvas(tab1);
    expect((await objectPos(tab1, /^Player ST/)).x).toBe(45);

    await banner.getByRole("button", { name: "Save mine as a copy" }).click();
    await expect(tab2).not.toHaveURL(new RegExp(tacticId));
    await waitForCanvas(tab2);
    expect((await objectPos(tab2, /^Player ST/)).x).toBe(55);
    await expect(tab2.getByLabel("Tactic name")).toHaveValue("Contested (my copy)");
  });

  test("save failure keeps edits and recovers on retry", async ({ page }) => {
    await signIn(page, await createConfirmedUser("savefail"));
    const teamId = await createTeam(page, "Flaky Wifi FC", "7v7");
    await createTactic(page, teamId, "Offline", "2-3-1");

    const block = (route: import("@playwright/test").Route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort("internetdisconnected") : route.fallback();
    await page.route("**/app/tactics/**", block);

    await objectList(page).filter({ hasText: /^Player GK/ }).click();
    await page.getByRole("application").focus();
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("ControlOrMeta+s");
    const alert = page.getByRole("alert").filter({ hasText: "Changes haven't synced. Your edits are still here." });
    await expect(alert).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Not saved");
    expect((await objectPos(page, /^Player GK/)).y).toBe(87);

    await page.unroute("**/app/tactics/**", block);
    await alert.getByRole("button", { name: "Retry save" }).click();
    await expectSaved(page);
    await page.reload();
    await waitForCanvas(page);
    expect((await objectPos(page, /^Player GK/)).y).toBe(87);
  });

  test("rename, duplicate and delete from the library", async ({ page }) => {
    await signIn(page, await createConfirmedUser("library"));
    const teamId = await createTeam(page, "Library Lads", "11v11");
    const tacticId = await createTactic(page, teamId, "Draft", "4-3-3");

    await page.getByLabel("Tactic name").fill("High press 4-3-3");
    await page.getByLabel("Tactic name").press("Enter");
    await expect(page.getByTestId("title-status")).toHaveText("Saved");
    await page.getByLabel("Tactic type").selectOption("Defending");
    await expect(page.getByTestId("title-status")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByLabel("Tactic name")).toHaveValue("High press 4-3-3");
    await expect(page.getByLabel("Tactic type")).toHaveValue("defending");

    await page.goto(`/app/teams/${teamId}/tactics`);
    const card = page.getByRole("article").filter({ hasText: "High press 4-3-3" });
    await expect(card).toContainText("Defending");
    await expect(card).toContainText("11v11");
    await page.getByRole("button", { name: "Duplicate High press 4-3-3" }).click();
    await expect(page.getByText("Copy of High press 4-3-3")).toBeVisible();

    // Editing the copy never touches the original (J04).
    await page.getByRole("link", { name: "Copy of High press 4-3-3" }).click();
    await waitForCanvas(page);
    await objectList(page).filter({ hasText: /^Player GK/ }).click();
    await page.getByRole("application").focus();
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("ControlOrMeta+s");
    await expectSaved(page);
    await page.goto(`/app/tactics/${tacticId}`);
    await waitForCanvas(page);
    expect((await objectPos(page, /^Player GK/)).y).toBe(93);

    await page.goto(`/app/teams/${teamId}/tactics`);
    await page.getByRole("button", { name: "Delete Copy of High press 4-3-3" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete tactic" }).click();
    await expect(page.getByRole("article")).toHaveCount(1);
  });
});

test("SEC-01: another user's tactic URL is a 404", async ({ browser }) => {
  const a = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const pa = await a.newPage();
  await signIn(pa, await createConfirmedUser("tac-a"));
  const teamId = await createTeam(pa, "Secret Shapes", "7v7");
  const tacticId = await createTactic(pa, teamId, "Secret corner routine", "2-3-1");

  const b = await browser.newContext();
  const pb = await b.newPage();
  await signIn(pb, await createConfirmedUser("tac-b"));
  for (const path of [`/app/tactics/${tacticId}`, `/app/teams/${teamId}/tactics`]) {
    const res = await pb.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(pb.getByText("Secret corner routine")).toHaveCount(0);
  }
  await a.close();
  await b.close();
});

test("NFR-01: below 1024px the editor is view-only", async ({ page }) => {
  await signIn(page, await createConfirmedUser("tac-mobile"));
  const teamId = await createTeam(page, "Phone FC", "5v5");
  const tacticId = await createTactic(page, teamId, "On the bus", "1-2-1 diamond");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/app/tactics/${tacticId}`);
  await expect(page.getByText("Editing works on screens 1024px and wider.")).toBeVisible();
  await expect(page.getByRole("img", { name: "On the bus" })).toBeVisible();
  await expect(page.getByRole("application")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
