import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

test("browser visit excludes saved measurements after reload", async ({ page }) => {
  const seed = defaultState();
  for (const id of Object.keys(seed.tutorial.chapters)) seed.tutorial.chapters[id] = "done";
  seed.tutorial.permissions.usage = true;
  seed.ui.tab = "usage";
  seed.ui.tutorialOpen = false;
  seed.ui.installBannerDismissed = true;
  await page.addInitScript((state) => {
    if (localStorage.getItem("aily.v1.state")) return;
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    state.ui.lastCheckInDate = day;
    state.usageSamples = [{ app: "AIly", mins: 8, ts: `${day}T12:00:00`, source: "web-session", visitId: "earlier-visit" }];
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, seed);
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  const reading = page.locator("#panel-usage .ally-line").filter({ has: page.locator(".usage-window-label") });
  await expect(reading).toContainText("0m browser visit");
  await expect(page.locator("#panel-usage")).toContainText("8m");
  await page.reload();
  await expect(reading).toContainText("0m browser visit");
});
