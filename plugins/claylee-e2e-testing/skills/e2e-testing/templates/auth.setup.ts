import { test as setup } from "@playwright/test";
import { accounts } from "../../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

setup("authenticate as sysadmin", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.loginAs(accounts.sysadmin);
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.context().storageState({ path: ".auth/sysadmin.json" });
});
