import { rmSync } from "node:fs";

import { test as teardown } from "@playwright/test";

import { clearActiveMenus } from "./helpers";

teardown("clear the storefront fixture menu", async () => {
  await clearActiveMenus();
  rmSync("tests/e2e/.storefront-fixture.json", { force: true });
});
