import { expect, test } from "@playwright/test";
import { createConfirmedUser, createTeam, signIn } from "./helpers/users";

test("QA-02 / SEC-01: user B cannot see user A's team via manipulated URLs", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await signIn(pageA, await createConfirmedUser("tenant-a"));
  const teamId = await createTeam(pageA, "Private Rovers", "7v7");
  await pageA.getByRole("button", { name: "Add player" }).click();
  await pageA.getByLabel("Name", { exact: true }).fill("Secret Striker");
  await pageA.getByRole("button", { name: "Add player" }).click();
  await expect(pageA.getByText("Secret Striker added to the squad.")).toBeVisible();

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await signIn(pageB, await createConfirmedUser("tenant-b"));
  await expect(pageB.getByText("Private Rovers")).toHaveCount(0);

  for (const path of [`/app/teams/${teamId}`, `/app/teams/${teamId}/squad`, `/app/teams/not-a-uuid`]) {
    const res = await pageB.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(pageB.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(pageB.getByText("Private Rovers")).toHaveCount(0);
    await expect(pageB.getByText("Secret Striker")).toHaveCount(0);
  }

  await a.close();
  await b.close();
});
