import { expect, test } from "./fixtures";
import { addPlayers, createConfirmedUser, createTeam, signIn } from "./helpers/users";
import { createTactic } from "./helpers/editor";
import { bench, createFixture, starters, waitLineupSaved } from "./helpers/matches";

test.use({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/London" });

const SQUAD = ["Sam Okafor", "Alex Moreno", "Jo Lindqvist", "Riley Chen", "Max Adeyemi", "Kai Brennan", "Lee Novak", "Dani Ruiz", "Toni Walsh"];

async function teamWithSquad(page: import("@playwright/test").Page, tag: string) {
  await signIn(page, await createConfirmedUser(tag));
  const teamId = await createTeam(page, `${tag} Rovers`, "7v7");
  await addPlayers(teamId, SQUAD.map((name, i) => ({ name, shirt_number: i + 1 })));
  return teamId;
}

test("MATCH-01: fixtures with timezone-aware kickoff, optional venue, edit and delete", async ({ page }) => {
  const teamId = await teamWithSquad(page, "fixtures");
  await page.goto(`/app/teams/${teamId}/matches`);
  await expect(page.getByText("No fixtures yet")).toBeVisible();

  // Validation is inline.
  await page.getByRole("button", { name: "Add fixture" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add and plan it" }).click();
  await expect(page.getByText("Enter the opponent's name.")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Times are in Europe/London.")).toBeVisible();
  await page.keyboard.press("Escape");

  // BST date: shown in the fixture's own zone.
  const matchId = await createFixture(page, teamId, "Dynamos", { date: "2030-06-01", time: "10:30" });
  await expect(page.getByRole("heading", { name: "vs Dynamos" })).toBeVisible();
  await expect(page.getByText(/Sat, 1 Jun 2030, 10:30 BST · 7v7/)).toBeVisible();

  await page.getByRole("button", { name: "Edit fixture" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Kickoff")).toHaveValue("10:30");
  await dialog.getByLabel("Venue (optional)").fill("Riverside Park");
  await dialog.getByLabel("Date").fill("2030-12-07");
  await dialog.getByRole("button", { name: "Save fixture" }).click();
  await expect(page.getByText(/Sat, 7 Dec 2030, 10:30 GMT/)).toBeVisible();
  await expect(page.getByText("Riverside Park")).toBeVisible();

  // Listed with lineup status; a second fixture sorts by date.
  await createFixture(page, teamId, "Athletic", { date: "2030-09-14" });
  await page.goto(`/app/teams/${teamId}/matches`);
  await expect(page.getByRole("list", { name: "Upcoming fixtures" }).getByRole("link")).toHaveText([/vs Athletic.*0\/7 starters/, /vs Dynamos.*0\/7 starters/]);

  // Dashboard shows the next fixture.
  await page.goto("/app/teams");
  await expect(page.getByRole("link", { name: /fixtures Rovers/ })).toContainText("Next: vs Athletic");

  await page.goto(`/app/matches/${matchId}/plan`);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete fixture" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/teams/${teamId}/matches$`));
  await expect(page.getByText("vs Dynamos")).toHaveCount(0);
});

test("MATCH-02 + QA-05: lineup caps, publish blocked until 7 starters, draft kept", async ({ page }) => {
  const teamId = await teamWithSquad(page, "lineup");
  await createFixture(page, teamId, "United");
  const publish = page.getByRole("button", { name: "Preview & publish" });

  for (const name of SQUAD.slice(0, 6)) await page.getByRole("button", { name: `Start ${name}` }).click();
  await page.getByRole("button", { name: `Bench ${SQUAD[7]}` }).click();
  await waitLineupSaved(page);
  await expect(page.getByTestId("starter-count")).toHaveText("6/7");
  await expect(page.getByText("Add all 7 starters before publishing this 7v7 match plan.")).toBeVisible();
  await expect(publish).toBeDisabled();

  // Draft retained across reload.
  await page.reload();
  await expect(starters(page)).toHaveCount(6);
  await expect(bench(page)).toHaveText([/Dani Ruiz/]);

  // Positions default from preferred positions and can be edited.
  await page.getByLabel(`Position for ${SQUAD[0]}`).fill("GK");
  await page.getByLabel(`Position for ${SQUAD[0]}`).press("Enter");

  // 7th starter completes it; 8th can't be added (MATCH-02 cap).
  await page.getByRole("button", { name: `Start ${SQUAD[6]}` }).click();
  await waitLineupSaved(page);
  await expect(page.getByTestId("starter-count")).toHaveText("7/7");
  await expect(page.getByText("All 7 starters picked.")).toBeVisible();
  await expect(page.getByRole("button", { name: `Start ${SQUAD[8]}` })).toBeDisabled();
  await expect(page.getByRole("button", { name: `Start ${SQUAD[7]}` })).toBeDisabled(); // from bench

  // Swap: bench a starter, then promote a sub; a player can't be in two places.
  await page.getByRole("button", { name: `Move ${SQUAD[1]} to bench` }).click();
  await page.getByRole("button", { name: `Start ${SQUAD[7]}` }).click();
  await waitLineupSaved(page);
  await expect(starters(page).filter({ hasText: SQUAD[7] })).toHaveCount(1);
  await expect(bench(page)).toHaveText([/Alex Moreno/]);

  await page.reload();
  await expect(starters(page)).toHaveCount(7);
  await expect(page.getByLabel(`Position for ${SQUAD[0]}`)).toHaveValue("GK");
  // Still blocked: no sections yet.
  await expect(page.getByText("Add at least one section to the briefing.")).toBeVisible();
  await expect(publish).toBeDisabled();
});

test("archived players are not offered for new lineups but stay where already picked", async ({ page }) => {
  const teamId = await teamWithSquad(page, "archived");
  const matchId = await createFixture(page, teamId, "Rangers");
  await page.getByRole("button", { name: `Start ${SQUAD[0]}` }).click();
  await waitLineupSaved(page);

  await page.goto(`/app/teams/${teamId}/squad`);
  for (const name of [SQUAD[0], SQUAD[1]]) await page.getByRole("button", { name: `Archive ${name}` }).click();
  await expect(page.getByText("7 active players")).toBeVisible();

  await page.goto(`/app/matches/${matchId}/plan`);
  await expect(starters(page).filter({ hasText: SQUAD[0] })).toContainText("archived");
  await expect(page.getByRole("button", { name: `Start ${SQUAD[1]}` })).toHaveCount(0);
  await expect(page.getByText(/1 starter is archived/)).toBeVisible();
});

test("PLAN-01: objective, ordered sections with tactics, notes, private notes and inclusion", async ({ page }) => {
  const teamId = await teamWithSquad(page, "plan");
  await createTactic(page, teamId, "High press", "2-3-1");
  const matchId = await createFixture(page, teamId, "City");
  await expect(page.getByText("No sections yet")).toBeVisible();

  await page.getByLabel("Match objective").fill("Press their keeper on every goal kick");
  await page.getByLabel("Match objective").press("Enter");
  await expect(page.getByTestId("objective-status")).toHaveText("Saved");

  await page.getByRole("button", { name: "Add tactic board" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /High press/ }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(1);
  await page.getByRole("button", { name: "Add notes" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(2);
  await page.getByRole("button", { name: "Add final reminders" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(3);

  const notes = page.getByTestId("plan-section").nth(1);
  await notes.getByLabel("Title").fill("Set pieces");
  await notes.getByLabel("Title").press("Enter");
  await notes.getByLabel("Phase").selectOption({ label: "Set pieces" });
  await notes.getByLabel("Coaching notes for players").fill("Near-post runs on every corner.");
  await notes.getByText("Private note (never shared)").click();
  await notes.getByLabel(/Private note for/).fill("Keep Kai off penalties.");
  await notes.getByLabel(/Private note for/).blur();
  await expect(notes.getByText("Saved")).toBeVisible();

  // Reorder: move "Final reminders" to the top.
  await page.getByRole("button", { name: "Move “Final reminders” up" }).click();
  await expect(page.getByTestId("plan-section").nth(1)).toContainText("Final reminders");
  await page.getByRole("button", { name: "Move “Final reminders” up" }).click();
  await expect(page.getByTestId("plan-section").first()).toContainText("Final reminders");

  // Exclude one from the briefing.
  await page.getByTestId("plan-section").nth(2).getByLabel("Include in players' briefing").uncheck();
  await expect(page.getByTestId("plan-section").nth(2)).toContainText("Not in briefing");

  await page.reload();
  const titles = await page.getByTestId("plan-section").getByLabel("Title").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(titles).toEqual(["Final reminders", "High press", "Set pieces"]);
  await expect(page.getByLabel("Match objective")).toHaveValue("Press their keeper on every goal kick");
  const setPieces = page.getByTestId("plan-section").nth(2);
  await expect(setPieces.getByLabel("Phase")).toHaveValue("set_pieces");
  await expect(setPieces.getByLabel(/Private note for/)).toHaveValue("Keep Kai off penalties.");
  await expect(setPieces).toContainText("Not in briefing");
  await expect(page.getByText("2 sections in the briefing.")).toBeVisible();

  // Removing a section.
  await page.getByRole("button", { name: "Remove “Set pieces”" }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(2);

  // A full lineup + sections = ready (publishing itself is Phase 5).
  for (const name of SQUAD.slice(0, 7)) await page.getByRole("button", { name: `Start ${name}` }).click();
  await waitLineupSaved(page);
  await expect(page.getByText("Ready. Publishing to a private player link arrives in the next release.")).toBeVisible();
  expect(matchId).toBeTruthy();
});

test("deleting an attached tactic flags the board section as blocking", async ({ page }) => {
  const teamId = await teamWithSquad(page, "detach");
  const tacticId = await createTactic(page, teamId, "Temporary", "2-3-1");
  const matchId = await createFixture(page, teamId, "Wanderers");
  await page.getByRole("button", { name: "Add tactic board" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Temporary/ }).click();
  await expect(page.getByTestId("plan-section")).toHaveCount(1);

  await page.goto(`/app/teams/${teamId}/tactics`);
  await page.getByRole("button", { name: "Delete Temporary" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete tactic" }).click();
  await expect(page.getByRole("article")).toHaveCount(0);

  await page.goto(`/app/matches/${matchId}/plan`);
  await expect(page.getByText("The attached tactic was deleted.")).toBeVisible();
  await expect(page.getByText("“Temporary” has no tactic attached.")).toBeVisible();
  expect(tacticId).toBeTruthy();
});

test("SEC-01: another user's fixture and plan are 404", async ({ browser }) => {
  const a = await browser.newContext();
  const pa = await a.newPage();
  const teamId = await teamWithSquad(pa, "plan-a");
  const matchId = await createFixture(pa, teamId, "Secret Opponent");

  const b = await browser.newContext();
  const pb = await b.newPage();
  await signIn(pb, await createConfirmedUser("plan-b"));
  for (const path of [`/app/matches/${matchId}/plan`, `/app/teams/${teamId}/matches`]) {
    const res = await pb.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(pb.getByText("Secret Opponent")).toHaveCount(0);
  }
  await a.close();
  await b.close();
});

test("NFR-01: match list and plan are readable at 375px", async ({ page }) => {
  const teamId = await teamWithSquad(page, "phone-plan");
  const matchId = await createFixture(page, teamId, "A Very Long Opponent Name Football Club", { venue: "Some Very Long Venue Name, Pitch Number Twelve" });
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [`/app/teams/${teamId}/matches`, `/app/matches/${matchId}/plan`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const offenders = await page.evaluate(() => {
      const W = window.innerWidth;
      const els = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > W + 1);
      return els.filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > W + 1)).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`);
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path}: ${offenders.join(" | ")}`).toBeLessThanOrEqual(0);
  }
  await expect(page.getByRole("heading", { name: "Lineup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready to publish?" })).toBeVisible();
});

test("deleting a team that has fixtures and lineups works (regression)", async ({ page }) => {
  const teamId = await teamWithSquad(page, "teamdel");
  await createFixture(page, teamId, "Doomed FC");
  await page.getByRole("button", { name: `Start ${SQUAD[0]}` }).click();
  await waitLineupSaved(page);
  await page.goto(`/app/teams/${teamId}`);
  await page.getByRole("button", { name: "Delete team…" }).click();
  await page.getByRole("dialog").getByLabel(/Type .* to confirm/).fill("teamdel Rovers");
  await page.getByRole("dialog").getByRole("button", { name: "Delete team permanently" }).click();
  await expect(page).toHaveURL(/\/app\/teams$/);
  await expect(page.getByText("teamdel Rovers")).toHaveCount(0);
});
