import { test as setup } from "@playwright/test";
import { accounts } from "../../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

setup("authenticate as admin", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.admin);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/admin.json" });
});
