import { expect, test } from "./fixtures";
import { createConfirmedUser, createTeam, signIn } from "./helpers/users";

const SEVEN = ["Sam Keeper", "Alex Stone", "Jo Banks", "Riley Cole", "Max Hart", "Kai Reed", "Lee Moss"];

test.describe("TEAM-01 / TEAM-02 team and squad", () => {
  test("J01 (part): create a 7v7 team and add seven players", async ({ page }) => {
    await signIn(page, await createConfirmedUser("j01"));

    // Validation is inline and actionable.
    await page.goto("/app/teams/new");
    await page.getByLabel("Team name").fill("X");
    await page.getByRole("button", { name: "Create team" }).click();
    await expect(page.getByText("Team name needs at least 2 characters.")).toBeVisible();

    await createTeam(page, "Sunday Rovers", "7v7");
    await expect(page.getByText("Add your first player to start building a lineup.")).toBeVisible();
    await page.getByRole("button", { name: "Add player" }).click();

    for (const [i, name] of SEVEN.entries()) {
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByLabel("Shirt no.").fill(String(i + 1));
      if (i === 0) await page.getByText("Goalkeeper", { exact: true }).click();
      await page.getByRole("button", { name: "Add player" }).click();
      await expect(page.getByRole("list", { name: "Active players" }).getByText(name)).toBeVisible();
    }
    await expect(page.getByText("7 active players")).toBeVisible();

    // Reload proves persistence.
    await page.reload();
    await expect(page.getByRole("list", { name: "Active players" }).getByRole("listitem")).toHaveCount(7);

    await page.goto("/app/teams");
    const card = page.getByRole("link", { name: /Sunday Rovers/ });
    await expect(card).toContainText("7v7");
    await expect(card).toContainText("7 players");
  });

  test("edit, archive and restore a player", async ({ page }) => {
    await signIn(page, await createConfirmedUser("roster"));
    await createTeam(page, "Rovers Five", "5v5");
    await page.getByRole("button", { name: "Add player" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Pat Wing");
    await page.getByRole("button", { name: "Add player" }).click();
    await expect(page.getByText("Pat Wing added to the squad.")).toBeVisible();

    await page.getByRole("button", { name: "Edit Pat Wing" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Pat Winger");
    await dialog.getByLabel("Shirt no.").fill("-1");
    await dialog.getByRole("button", { name: "Save player" }).click();
    await expect(dialog.getByText("Shirt numbers run from 0 to 99.")).toBeVisible();
    await dialog.getByLabel("Shirt no.").fill("11");
    await dialog.getByRole("button", { name: "Save player" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Pat Winger")).toBeVisible();

    await page.getByRole("button", { name: "Archive Pat Winger" }).click();
    await expect(page.getByText("0 active players")).toBeVisible();
    await page.getByRole("button", { name: /Show archived players \(1\)/ }).click();
    await page.getByRole("button", { name: "Restore Pat Winger" }).click();
    await expect(page.getByRole("list", { name: "Active players" }).getByText("Pat Winger")).toBeVisible();
  });

  test("owner edits then deletes a team after typing its name", async ({ page }) => {
    await signIn(page, await createConfirmedUser("delete"));
    const teamId = await createTeam(page, "Temp Eleven", "11v11");
    await page.goto(`/app/teams/${teamId}`);
    await page.getByLabel("Team name").fill("Temp Eleven FC");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Team details saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Temp Eleven FC");

    await page.getByRole("button", { name: "Delete team…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Any shared briefing links will stop working");
    await dialog.getByLabel(/Type .* to confirm/).fill("wrong");
    await dialog.getByRole("button", { name: "Delete team permanently" }).click();
    await expect(dialog.getByText("Type the team name exactly to confirm.")).toBeVisible();
    await dialog.getByLabel(/Type .* to confirm/).fill("Temp Eleven FC");
    await dialog.getByRole("button", { name: "Delete team permanently" }).click();
    await expect(page).toHaveURL(/\/app\/teams$/);
    await expect(page.getByText("Temp Eleven FC")).toHaveCount(0);
  });
});
