import { expect, test } from "@playwright/test";

test.describe("application foundation", () => {
  test("homepage renders the storefront shell without errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");

    await expect(page).toHaveTitle("Samy's Bakery");
    await expect(
      page.getByRole("heading", { level: 1, name: "Something delicious is always baking." })
    ).toBeVisible();

    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(mainNav.getByRole("link", { name: "Menu" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: "Cart" })).toBeVisible();
    await expect(mainNav.getByRole("link", { name: /admin/i })).toHaveCount(0);

    await expect(page.getByRole("contentinfo")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("unknown routes show the not-found page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page not found.")).toBeVisible();
  });

  test("layout has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
