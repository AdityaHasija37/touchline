// Phase 3 evidence screenshots (drawing tools + history). Local only; uses the seeded demo account.
import { chromium } from "@playwright/test";

const out = "docs/evidence/phase-3";
const base = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const settle = async () => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
};
const item = (re) => page.getByRole("list", { name: "Board objects" }).getByRole("button").filter({ hasText: re });

await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("demo@touchline.test");
await page.getByLabel("Password").fill("touchline-demo-7v7");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/app\/teams/);
await page.getByRole("link", { name: /Sunday Rovers/ }).click();
await page.getByRole("link", { name: "Tactics", exact: true }).click();
await page.waitForURL(/tactics$/);
await settle();
await page.screenshot({ path: `${out}/01-library-thumbnail.png` });

await page.getByRole("link", { name: "2-3-1 base shape" }).click();
await page.locator("[data-testid=pitch-stage] canvas").first().waitFor();
await settle();
await page.screenshot({ path: `${out}/02-board-with-tools.png` });

await item(/^Zone/).click();
await settle();
await page.screenshot({ path: `${out}/03-zone-selected-handles.png` });

await item(/Arrow \(run\)/).click();
await settle();
await page.screenshot({ path: `${out}/04-arrow-selected.png` });

await page.keyboard.press("Escape");
await page.keyboard.press("t");
const stage = await page.getByTestId("pitch-stage").boundingBox();
const g = JSON.parse(await page.getByTestId("pitch-stage").getAttribute("data-pitch"));
await page.mouse.click(stage.x + g.x + 0.75 * g.vw, stage.y + g.y + 0.62 * g.vh);
await page.getByLabel("Note on the pitch").fill("Overlap when 5 has it");
await settle();
await page.screenshot({ path: `${out}/05-text-entry.png` });

await browser.close();
console.log(`Saved screenshots to ${out}`);
