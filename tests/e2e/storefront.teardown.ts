import { rmSync } from "node:fs";

import { test as teardown } from "@playwright/test";

import { clearActiveMenus, service } from "./helpers";

teardown("clear the storefront fixture menu", async () => {
  await clearActiveMenus();
  await service.from("system_settings").upsert({ key: "ORDER_CUTOFF_TIME", value: "17:00" });
  rmSync("tests/e2e/.storefront-fixture.json", { force: true });
});
