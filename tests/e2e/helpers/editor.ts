import { expect, type Page } from "@playwright/test";

export async function createTactic(page: Page, teamId: string, name: string, start = "2-3-1") {
  await page.goto(`/app/teams/${teamId}/tactics`);
  await page.getByRole("button", { name: /Create tactic|New tactic/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  const radio = dialog.getByRole("radio", { name: start, exact: true });
  await dialog.locator("label").filter({ hasText: new RegExp(`^${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
  await expect(radio).toBeChecked();
  await dialog.getByRole("button", { name: "Create and open editor" }).click();
  await expect(page).toHaveURL(/\/app\/tactics\/[0-9a-f-]{36}$/);
  await waitForCanvas(page);
  return page.url().split("/").pop()!;
}

export async function waitForCanvas(page: Page) {
  await page.locator("[data-testid=pitch-stage] canvas").first().waitFor();
}

export const objectList = (page: Page) => page.getByRole("list", { name: "Board objects" }).getByRole("button");

export async function objectPos(page: Page, name: RegExp) {
  const el = objectList(page).filter({ hasText: name }).first();
  return { x: Number(await el.getAttribute("data-x")), y: Number(await el.getAttribute("data-y")) };
}

/** Real pointer drag from one pitch coordinate to another (stepped so Konva sees a drag). */
export async function dragOnPitch(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const stage = page.getByTestId("pitch-stage");
  const box = (await stage.boundingBox())!;
  const g = JSON.parse((await stage.getAttribute("data-pitch"))!) as { x: number; y: number; vw: number; vh: number };
  const at = (p: { x: number; y: number }) => [box.x + g.x + (p.x / 100) * g.vw, box.y + g.y + (p.y / 100) * g.vh] as const;
  const [sx, sy] = at(from);
  const [tx, ty] = at(to);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
}

export async function expectSaved(page: Page) {
  await expect(page.getByTestId("save-status")).toContainText("All changes saved", { timeout: 10_000 });
}

export async function geom(page: Page, name: RegExp) {
  const el = objectList(page).filter({ hasText: name }).first();
  return JSON.parse((await el.getAttribute("data-geom"))!) as Record<string, unknown> & { id: string; kind: string };
}

export const activeTool = (page: Page) => page.locator("[role=toolbar] button[aria-pressed=true]");

/** Pixel position of a pitch point (for clicks on handles etc.). */
export async function pitchPx(page: Page, p: { x: number; y: number }) {
  const stage = page.getByTestId("pitch-stage");
  const box = (await stage.boundingBox())!;
  const g = JSON.parse((await stage.getAttribute("data-pitch"))!) as { x: number; y: number; vw: number; vh: number };
  return [box.x + g.x + (p.x / 100) * g.vw, box.y + g.y + (p.y / 100) * g.vh] as const;
}
