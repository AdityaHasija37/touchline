// Phase 4 evidence screenshots (fixtures, lineup, plan). Local only; uses the seeded demo account.
import { chromium } from "@playwright/test";

const out = "docs/evidence/phase-4";
const base = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
const page = await ctx.newPage();
const settle = async (p = page) => {
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
};

await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("demo@touchline.test");
await page.getByLabel("Password").fill("touchline-demo-7v7");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/app\/teams/);
await settle();
await page.screenshot({ path: `${out}/01-dashboard-next-match.png` });

await page.getByRole("link", { name: /Sunday Rovers/ }).click();
await page.getByRole("link", { name: "Matches", exact: true }).click();
await page.waitForURL(/matches$/);
await settle();
await page.screenshot({ path: `${out}/02-match-list.png` });

await page.getByRole("button", { name: "Add fixture" }).click();
await page.getByRole("dialog").getByLabel("Opponent").fill("Hackney Wick FC");
await settle();
await page.screenshot({ path: `${out}/03-add-fixture.png` });
await page.keyboard.press("Escape");

await page.getByRole("link", { name: /Riverside Dynamos/ }).click();
await page.waitForURL(/plan$/);
await settle();
await page.screenshot({ path: `${out}/04-plan-blocked-6-of-7.png`, fullPage: true });

await page.getByRole("button", { name: "Add tactic board" }).click();
await settle();
await page.screenshot({ path: `${out}/05-attach-tactic.png` });
await page.keyboard.press("Escape");

const phone = await ctx.newPage();
await phone.setViewportSize({ width: 375, height: 812 });
await phone.goto(page.url());
await settle(phone);
await phone.screenshot({ path: `${out}/06-mobile-plan.png`, fullPage: true });

await browser.close();
console.log(`Saved screenshots to ${out}`);
