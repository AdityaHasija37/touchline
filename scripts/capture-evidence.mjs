// Captures screenshots of key screens for milestone evidence. Local only; uses the seeded demo account.
// Usage: node scripts/capture-evidence.mjs <phase-folder>
import { chromium } from "@playwright/test";

const out = `docs/evidence/${process.argv[2] ?? "phase-1"}`;
const base = "http://localhost:3000";
const browser = await chromium.launch();

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.locator('[aria-busy="true"]').waitFor({ state: "detached" }).catch(() => {});
  await page.waitForTimeout(400); // let tab/colour transitions finish
}

async function session(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill("demo@touchline.test");
  await page.getByLabel("Password").fill("touchline-demo-7v7");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/teams/);
  await settle(page);
  return page;
}

const anon = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
for (const [name, path] of [["01-landing", "/"], ["02-register", "/register"], ["03-login", "/login"]]) {
  await anon.goto(base + path);
  await settle(anon);
  await anon.screenshot({ path: `${out}/${name}.png` });
}

const desk = await session({ width: 1280, height: 800 });
await desk.screenshot({ path: `${out}/04-dashboard.png` });
await desk.getByRole("link", { name: /Sunday Rovers/ }).click();
await desk.waitForURL(/teams\/[0-9a-f-]{36}$/);
  await settle(desk);
await desk.screenshot({ path: `${out}/05-team-overview.png`, fullPage: true });
await desk.getByRole("link", { name: "Squad", exact: true }).click();
await desk.waitForURL(/squad$/);
  await settle(desk);
await desk.screenshot({ path: `${out}/06-squad.png`, fullPage: true });
await desk.getByRole("button", { name: "Edit Kai Brennan" }).click();
await desk.getByRole("dialog").waitFor();
  await settle(desk);
await desk.screenshot({ path: `${out}/07-edit-player.png` });
await desk.goto(`${base}/app/teams/new`);
await desk.getByLabel("Team name").fill("X");
await desk.getByRole("button", { name: "Create team" }).click();
await desk.getByText("Team name needs at least 2 characters.").waitFor();
  await settle(desk);
await desk.screenshot({ path: `${out}/08-team-setup-validation.png` });

const phone = await session({ width: 375, height: 812 });
await phone.waitForTimeout(0);
await phone.screenshot({ path: `${out}/09-mobile-dashboard.png` });
await phone.getByRole("link", { name: /Sunday Rovers/ }).click();
await phone.getByRole("link", { name: "Squad", exact: true }).click();
await phone.waitForURL(/squad$/);
  await settle(phone);
await phone.screenshot({ path: `${out}/10-mobile-squad.png`, fullPage: true });

await browser.close();
console.log(`Saved screenshots to ${out}`);
