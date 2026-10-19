import { expect, test } from "./fixtures";
import { PASSWORD, confirmationLink, createConfirmedUser, signIn, uniqueEmail } from "./helpers/users";

test.describe("AUTH-01 account access", () => {
  test("QA-01: signed-out visitors are redirected to login and resume afterwards", async ({ page }) => {
    const email = await createConfirmedUser("qa01");
    await page.goto("/app/teams/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fteams%2Fnew/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/teams\/new$/);
  });

  test("private pages are not served to signed-out requests", async ({ request }) => {
    const res = await request.get("/app/teams", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/login");
  });

  test("register → confirm email → dashboard → sign out → sign in", async ({ page }) => {
    const email = uniqueEmail("register");
    await page.goto("/register");
    await page.getByLabel("Your name (optional)").fill("Jordan");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText("confirmation link");

    // Unconfirmed accounts can't sign in yet.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Confirm your email first/)).toBeVisible();

    await page.goto(await confirmationLink(email));
    await expect(page).toHaveURL(/\/app\/teams$/);
    await expect(page.getByRole("heading", { name: "Set up your first team" })).toBeVisible();
    await expect(page.getByText("Jordan")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/app/teams");
    await expect(page).toHaveURL(/\/login/);

    await signIn(page, email);
  });

  test("wrong password shows a generic error", async ({ page }) => {
    const email = await createConfirmedUser("wrongpw");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match an account.")).toBeVisible();
  });

  test("password reset email leads to choosing a new password", async ({ page }) => {
    const email = await createConfirmedUser("reset");
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("reset link is on its way");

    await page.goto(await confirmationLink(email));
    await expect(page).toHaveURL(/\/reset-password\/update$/);
    await page.getByLabel("New password", { exact: true }).fill("brand-new-pass-2");
    await page.getByLabel("Confirm new password").fill("brand-new-pass-2");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/app\/teams$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, email, "brand-new-pass-2");
  });
});
