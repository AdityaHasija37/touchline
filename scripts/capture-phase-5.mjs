// Phase 5 evidence screenshots (publish, present, public share). Local only; demo account.
// The share token is masked before any screenshot so no token is ever committed.
import { chromium } from "@playwright/test";

const out = "docs/evidence/phase-5";
const base = "http://localhost:3000";
const browser = await chromium.launch();
const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
const page = await owner.newPage();
const settle = async (p = page) => {
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
};

await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("demo@touchline.test");
await page.getByLabel("Password").fill("touchline-demo-7v7");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/app\/teams/);
await page.getByRole("link", { name: /Sunday Rovers/ }).click();
await page.getByRole("link", { name: "Matches", exact: true }).click();
await page.getByRole("link", { name: /Riverside Dynamos/ }).click();
await page.waitForURL(/plan$/);
await page.getByRole("link", { name: "Preview & publish" }).click();
await page.waitForURL(/publish$/);
await settle();
await page.screenshot({ path: `${out}/01-publish-blocked.png`, fullPage: true });

await page.goBack();
await page.getByRole("button", { name: "Start Kai Brennan" }).click();
await page.getByTestId("lineup-status").filter({ hasText: "Saved" }).waitFor();
await page.getByRole("link", { name: "Preview & publish" }).click();
await page.waitForURL(/publish$/);
await page.getByRole("button", { name: "Publish briefing" }).click();
const linkBox = page.getByLabel("Share this link");
await linkBox.waitFor();
const link = await linkBox.inputValue();
await linkBox.evaluate((el) => (el.value = el.value.replace(/#.*/, "#••••••••••••••••••••••")));
await settle();
await page.screenshot({ path: `${out}/02-published-link.png`, fullPage: true });

const player = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-forwarded-for": "10.1.2.3" } });
const v = await player.newPage();
await v.goto(link);
await v.getByTestId("viewer").waitFor();
for (let i = 1; i <= 4; i++) {
  await settle(v);
  await v.screenshot({ path: `${out}/0${2 + i}-public-slide-${i}.png` });
  await v.keyboard.press("ArrowRight");
}

const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": "10.1.2.4" } });
const m = await phone.newPage();
await m.goto(link);
await m.getByTestId("viewer").waitFor();
await settle(m);
await m.screenshot({ path: `${out}/07-phone-title.png` });
await m.getByRole("button", { name: "Next slide" }).click();
await settle(m);
await m.screenshot({ path: `${out}/08-phone-lineup.png` });

await page.getByRole("button", { name: "Revoke link" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Revoke link" }).click();
await page.getByTestId("link-state").filter({ hasText: "Not published" }).waitFor();
await v.reload();
await v.getByRole("heading", { name: "Briefing unavailable" }).waitFor();
await v.waitForTimeout(500);
await v.screenshot({ path: `${out}/09-revoked-unavailable.png` });

await browser.close();
console.log(`Saved screenshots to ${out}`);
