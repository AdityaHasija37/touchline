import { expect, test } from "@playwright/test";
import { createConfirmedUser, createTeam, signIn } from "./helpers/users";

test("NFR-01: dashboard and squad have no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, await createConfirmedUser("mobile"));
  const teamId = await createTeam(page, "A Very Long Team Name Football Club United", "11v11");
  for (const path of ["/app/teams", `/app/teams/${teamId}`, `/app/teams/${teamId}/squad`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className).slice(0, 80)}`),
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflowing: ${offenders.join(" | ")}`).toBeLessThanOrEqual(0);
  }
});
