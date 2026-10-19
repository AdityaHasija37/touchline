import { expect, type Page } from "@playwright/test";

export async function createFixture(page: Page, teamId: string, opponent: string, opts: { date?: string; time?: string; venue?: string } = {}) {
  await page.goto(`/app/teams/${teamId}/matches`);
  await page.getByRole("button", { name: "Add fixture" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Opponent").fill(opponent);
  await dialog.getByLabel("Date").fill(opts.date ?? "2030-05-04");
  await dialog.getByLabel("Kickoff").fill(opts.time ?? "14:00");
  if (opts.venue) await dialog.getByLabel("Venue (optional)").fill(opts.venue);
  await dialog.getByRole("button", { name: "Add and plan it" }).click();
  await expect(page).toHaveURL(/\/app\/matches\/[0-9a-f-]{36}\/plan$/);
  return page.url().match(/matches\/([0-9a-f-]{36})/)![1];
}

export async function waitLineupSaved(page: Page) {
  await expect(page.getByTestId("lineup-status")).toHaveText("Saved", { timeout: 10_000 });
}

export const starters = (page: Page) => page.getByRole("list", { name: "Starters" }).getByRole("listitem");
export const bench = (page: Page) => page.getByRole("list", { name: "Bench" }).getByRole("listitem");
