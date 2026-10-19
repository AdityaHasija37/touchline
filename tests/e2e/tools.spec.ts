import { expect, test } from "./fixtures";
import { createConfirmedUser, createTeam, signIn } from "./helpers/users";
import { activeTool, createTactic, dragOnPitch, expectSaved, geom, objectList, objectPos, pitchPx, waitForCanvas } from "./helpers/editor";

test.use({ viewport: { width: 1280, height: 860 } });

async function setup(page: import("@playwright/test").Page, tag: string, format: "5v5" | "7v7" | "11v11" = "7v7", start = "2-3-1") {
  await signIn(page, await createConfirmedUser(tag));
  const teamId = await createTeam(page, `${tag} FC`, format);
  return createTactic(page, teamId, `${tag} board`, start);
}

const extras = (page: import("@playwright/test").Page) => objectList(page).filter({ hasText: /^(Arrow|Line|Zone|Text)/ });

test("QA-03: move a player, add an arrow, reload: geometry and style identical", async ({ page }) => {
  await setup(page, "qa03full");
  await dragOnPitch(page, { x: 50, y: 54 }, { x: 40, y: 60 }); // CM
  await page.keyboard.press("a");
  await expect(activeTool(page)).toHaveAccessibleName("Arrow (A)");
  await page.getByLabel("Pass (solid)").check();
  await dragOnPitch(page, { x: 40, y: 60 }, { x: 70, y: 30 });
  const arrow = await geom(page, /^Arrow/);
  expect(arrow).toMatchObject({ kind: "arrow", style: "pass" });
  const snapshot = await objectList(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-geom")));
  await page.keyboard.press("ControlOrMeta+s");
  await expectSaved(page);

  await page.reload();
  await waitForCanvas(page);
  expect(await objectList(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-geom")))).toEqual(snapshot);
});

test("arrows: styles, endpoint handles, numeric edits, move", async ({ page }) => {
  await setup(page, "arrows", "5v5", "Blank pitch");
  await page.keyboard.press("a");
  await page.getByLabel("Run (dashed)").check();
  await dragOnPitch(page, { x: 20, y: 80 }, { x: 60, y: 40 });
  // The new arrow is selected; changing its style also sets the style for the next arrow.
  await page.getByLabel("Dribble (dotted)").check();
  await page.getByLabel("Run (dashed)").check();
  await dragOnPitch(page, { x: 70, y: 80 }, { x: 70, y: 50 });
  await page.getByLabel("Dribble (dotted)").check();
  await expect(extras(page)).toHaveText([/Arrow \(run\)/, /Arrow \(dribble\)/]);

  // Tiny drag = click, draws nothing.
  await dragOnPitch(page, { x: 30, y: 30 }, { x: 30.5, y: 30.5 });
  await expect(extras(page)).toHaveCount(2);

  // Back to select; drag the "to" handle of the first arrow.
  await page.keyboard.press("v");
  await extras(page).first().click();
  await dragOnPitch(page, { x: 60, y: 40 }, { x: 80, y: 20 });
  const a1 = await geom(page, /Arrow \(run\)/);
  expect(a1.from).toEqual({ x: 20, y: 80 });
  expect(Math.abs((a1.to as { x: number }).x - 80)).toBeLessThanOrEqual(0.5);

  // Inspector: change style and exact endpoint.
  await page.getByRole("radio", { name: "Pass (solid)" }).check();
  await page.getByLabel("Start x").fill("25");
  await page.getByLabel("Start x").press("Enter");
  expect(await geom(page, /Arrow \(pass\)/)).toMatchObject({ style: "pass", from: { x: 25, y: 80 } });
  await expectSaved(page);
});

test("zones: draw, label, colour, resize by handle, resize numerically", async ({ page }) => {
  await setup(page, "zones", "11v11", "4-4-2");
  await page.keyboard.press("z");
  await dragOnPitch(page, { x: 60, y: 30 }, { x: 20, y: 10 }); // drawn right-to-left, bottom-to-top
  expect(await geom(page, /^Zone/)).toMatchObject({ x: 20, y: 10, w: 40, h: 20 });

  await page.getByLabel("Zone label (optional)").or(page.getByLabel("Label (optional)")).fill("Press trap");
  await page.getByLabel("Label (optional)").press("Enter");
  await page.getByText("Blue", { exact: true }).click();
  expect(await geom(page, /^Zone/)).toMatchObject({ label: "Press trap", color: "#38bdf8" });

  // Zone tool stays active; switch to select to get handles.
  await page.keyboard.press("v");
  await objectList(page).filter({ hasText: /^Zone/ }).click();
  await dragOnPitch(page, { x: 60, y: 30 }, { x: 70, y: 40 }); // south-east handle
  const z = await geom(page, /^Zone/);
  expect(z).toMatchObject({ x: 20, y: 10 });
  expect(Math.abs((z.w as number) - 50)).toBeLessThanOrEqual(0.5);

  await page.getByLabel("Height").fill("15");
  await page.getByLabel("Height").press("Enter");
  expect((await geom(page, /^Zone/)).h).toBe(15);

  // Too-small zones aren't created.
  await page.keyboard.press("z");
  await dragOnPitch(page, { x: 80, y: 80 }, { x: 81, y: 90 });
  await expect(objectList(page).filter({ hasText: /^Zone/ })).toHaveCount(1);
});

test("text: place, Enter commits, Esc cancels, 240-character limit, edit later", async ({ page }) => {
  await setup(page, "text", "7v7", "Blank pitch");
  await page.keyboard.press("t");
  const [x, y] = await pitchPx(page, { x: 50, y: 20 });
  await page.mouse.click(x, y);
  const input = page.getByLabel("Note on the pitch");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(page.getByText("Type something first, or press Esc to cancel.")).toBeVisible();
  await input.press("Escape");
  await expect(extras(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled(); // cancelled placement leaves no history

  await page.mouse.click(x, y);
  await page.getByLabel("Note on the pitch").fill("x".repeat(300));
  await expect(page.getByLabel("Note on the pitch")).toHaveValue("x".repeat(240));
  await page.getByLabel("Note on the pitch").fill("Press their left back");
  await page.keyboard.press("Enter");
  expect(await geom(page, /^Text/)).toMatchObject({ kind: "text", text: "Press their left back", x: 50, y: 20 });

  await page.keyboard.press("v");
  await extras(page).first().click();
  const field = page.getByLabel("Text", { exact: true });
  await field.fill("Changed my mind");
  await field.press("Escape");
  await expect(field).toHaveValue("Press their left back");
  await field.fill("Show for the ball");
  await field.press("Enter");
  expect((await geom(page, /^Text/)).text).toBe("Show for the ball");
});

test("erase tool removes what you click; undo brings it back", async ({ page }) => {
  await setup(page, "erase", "5v5", "2-2 box");
  await page.keyboard.press("e");
  await expect(activeTool(page)).toHaveAccessibleName("Erase (E)");
  const [x, y] = await pitchPx(page, { x: 30, y: 38 }); // LF
  await page.mouse.click(x, y);
  await expect(objectList(page).filter({ hasText: /^Player LF/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(objectList(page).filter({ hasText: /^Player LF/ })).toHaveCount(1);
  expect(await objectPos(page, /^Player LF/)).toEqual({ x: 30, y: 38 });
});

test("TAC-04: undo/redo exactness, redo cleared by a new action, 30-step limit, persists via save", async ({ page }) => {
  await setup(page, "history", "7v7", "2-3-1");
  const undoBtn = page.getByRole("button", { name: "Undo" });
  const redoBtn = page.getByRole("button", { name: "Redo" });
  await expect(undoBtn).toBeDisabled();
  await expect(redoBtn).toBeDisabled();

  const start = await objectPos(page, /^Player ST/);
  await dragOnPitch(page, { x: 50, y: 28 }, { x: 30, y: 20 }); // one drag = one step
  await page.keyboard.press("ControlOrMeta+z");
  expect(await objectPos(page, /^Player ST/)).toEqual(start);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  const moved = await objectPos(page, /^Player ST/);
  expect(moved).not.toEqual(start);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(redoBtn).toBeEnabled();
  await objectList(page).filter({ hasText: /^Player GK/ }).click();
  await page.getByRole("application").focus();
  await page.keyboard.press("ArrowUp"); // new action clears redo
  await expect(redoBtn).toBeDisabled();

  // 35 nudges; only the last 30 are undoable.
  for (let i = 0; i < 34; i++) await page.keyboard.press("ArrowRight");
  let undos = 0;
  while (await undoBtn.isEnabled()) {
    await undoBtn.click();
    undos++;
  }
  expect(undos).toBe(30);
  // 35 actions (1 up + 34 right), 30 undone: GK is up 1 and right 4 of where it started (50, 92).
  expect(await objectPos(page, /^Player GK/)).toEqual({ x: 54, y: 91 });

  // Typing in a text field keeps native undo; board history is untouched.
  await page.getByLabel("Tactic name").click();
  await page.keyboard.press("ControlOrMeta+z");
  expect(await objectPos(page, /^Player GK/)).toEqual({ x: 54, y: 91 });

  // Undone state is what gets saved.
  await page.keyboard.press("ControlOrMeta+s");
  await expectSaved(page);
  await page.reload();
  await waitForCanvas(page);
  expect(await objectPos(page, /^Player GK/)).toEqual({ x: 54, y: 91 });
});

test("drawing works in horizontal orientation", async ({ page }) => {
  await setup(page, "horiz", "7v7", "Blank pitch");
  await page.getByLabel("Orientation").selectOption("horizontal");
  await page.keyboard.press("a");
  // In horizontal view, screen-right is towards the opponent's goal (pitch y decreasing).
  const stage = (await page.getByTestId("pitch-stage").boundingBox())!;
  const g = JSON.parse((await page.getByTestId("pitch-stage").getAttribute("data-pitch"))!);
  const left = g.x - g.vh; // rotated group's left edge in stage px
  const sx = stage.x + left + 0.2 * g.vh, sy = stage.y + g.y + 0.5 * g.vw;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 0.5 * g.vh, sy, { steps: 10 });
  await page.mouse.up();
  const a = (await geom(page, /^Arrow/)) as unknown as { from: { x: number; y: number }; to: { x: number; y: number } };
  expect(Math.abs(a.from.x - 50)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.from.y - 80)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.to.y - 30)).toBeLessThanOrEqual(0.5);
});
