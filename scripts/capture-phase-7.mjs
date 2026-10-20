// Release 1.1 evidence: pitch builder, roles, set pieces, sub plan, new slides and Find me.
// Uses a fresh demo sandbox (local only). Usage: node scripts/capture-phase-7.mjs
import { chromium } from "@playwright/test";

const out = "docs/evidence/phase-7";
const base = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, timezoneId: "Europe/London", extraHTTPHeaders: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.9` } });
const page = await ctx.newPage();
const settle = async (p) => {
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
};

await page.goto(base);
await page.getByRole("button", { name: "Try the demo, no sign-up" }).click();
await page.waitForURL(/welcome=demo/);
await page.getByRole("link", { name: /Open Saturday's match plan/ }).click();
await page.waitForURL(/\/plan$/);
await settle(page);
await page.screenshot({ path: `${out}/01-plan-overview.png`, fullPage: true });
await page.getByRole("region", { name: "Lineup" }).or(page.locator("section[aria-labelledby=lineup-heading]")).first().screenshot({ path: `${out}/02-lineup-pitch-roles.png` });
await page.getByRole("button", { name: /^RM: / }).click();
await page.locator("section[aria-labelledby=lineup-heading]").screenshot({ path: `${out}/03-slot-picker.png` });
await page.getByRole("button", { name: /^RM: / }).click();
await page.locator("section[aria-labelledby=sp-heading]").screenshot({ path: `${out}/04-set-pieces.png` });
await page.locator("section[aria-labelledby=subs-heading]").screenshot({ path: `${out}/05-sub-plan.png` });

await page.getByRole("link", { name: "Preview & publish" }).click();
await settle(page);
await page.getByRole("button", { name: "Publish briefing" }).click();
const url = await page.getByLabel("Share this link").inputValue();

const desk = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-forwarded-for": "10.78.1.2" } })).newPage();
await desk.goto(url);
await desk.getByRole("heading", { name: "vs Riverside Dynamos" }).waitFor();
for (const [i, label] of [[6, "2. Starting lineup"], [7, "3. Set pieces"], [8, "4. Sub plan"]]) {
  await desk.getByLabel("Jump to slide").selectOption({ label });
  await desk.waitForTimeout(500);
  await desk.screenshot({ path: `${out}/0${i}-slide-${label.slice(3).toLowerCase().replace(/ /g, "-")}.png` });
}

const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": "10.78.1.3" } })).newPage();
await phone.goto(url);
await phone.getByRole("heading", { name: "vs Riverside Dynamos" }).waitFor();
await phone.getByRole("button", { name: "Find me" }).click();
await phone.getByLabel("Who are you?").selectOption({ label: "9 · Lee Novak" });
await phone.waitForTimeout(300);
await phone.screenshot({ path: `${out}/09-find-me-card.png` });
await phone.getByRole("button", { name: "Highlight me in the briefing" }).click();
await phone.getByLabel("Jump to slide").selectOption({ label: "2. Starting lineup" });
await phone.waitForTimeout(500);
await phone.screenshot({ path: `${out}/10-find-me-highlight-phone.png` });
await phone.getByLabel("Jump to slide").selectOption({ label: "5. Our press" });
await phone.waitForTimeout(500);
await phone.screenshot({ path: `${out}/11-find-me-highlight-board.png` });
await browser.close();
console.log("captured");
