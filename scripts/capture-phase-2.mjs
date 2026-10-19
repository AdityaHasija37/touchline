// Phase 2 evidence screenshots (tactics). Local only; uses the seeded demo account.
import { chromium } from "@playwright/test";

const out = "docs/evidence/phase-2";
const base = "http://localhost:3000";
const browser = await chromium.launch();
const settle = async (p) => {
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
};

const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("demo@touchline.test");
await page.getByLabel("Password").fill("touchline-demo-7v7");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/app\/teams/);
await page.getByRole("link", { name: /Sunday Rovers/ }).click();
await page.getByRole("link", { name: "Tactics", exact: true }).click();
await page.waitForURL(/tactics$/);
const libraryUrl = page.url();
await settle(page);
await page.screenshot({ path: `${out}/01-library.png` });

await page.getByRole("button", { name: "New tactic" }).click();
await page.getByRole("dialog").getByLabel("Name").fill("Pressing shape vs. Dynamos");
await settle(page);
await page.screenshot({ path: `${out}/02-new-tactic.png` });
await page.keyboard.press("Escape");

await page.getByRole("link", { name: "2-3-1 base shape" }).click();
await page.locator("[data-testid=pitch-stage] canvas").first().waitFor();
await settle(page);
await page.getByRole("list", { name: "Board objects" }).getByRole("button").filter({ hasText: "Kai Brennan" }).click();
await settle(page);
await page.screenshot({ path: `${out}/03-editor-selected.png` });

await page.getByRole("list", { name: "Board objects" }).getByRole("button").filter({ hasText: "Kai Brennan" }).click();
await page.getByRole("application").focus();
await page.keyboard.press("Escape");
await page.getByLabel("Orientation").selectOption("horizontal");
await settle(page);
await page.screenshot({ path: `${out}/04-editor-horizontal.png` });
await page.getByLabel("Orientation").selectOption("vertical");
await page.keyboard.press("ControlOrMeta+s");
await page.getByTestId("save-status").filter({ hasText: "All changes saved" }).waitFor();

const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await phone.context().addCookies(await page.context().cookies());
await phone.goto(page.url());
await settle(phone);
await phone.screenshot({ path: `${out}/05-mobile-view-only.png`, fullPage: true });
await phone.goto(libraryUrl);
await settle(phone);
await phone.screenshot({ path: `${out}/06-mobile-library.png`, fullPage: true });

await browser.close();
console.log(`Saved screenshots to ${out}`);
