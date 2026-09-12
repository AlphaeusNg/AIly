import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

function todayLocal() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function readyTodayState() {
  const state = defaultState();
  Object.keys(state.tutorial.chapters).forEach((id) => {
    state.tutorial.chapters[id] = "done";
  });
  state.targets = [{
    id: "target-1",
    title: "Modal target",
    status: "active",
    softCapacityHours: 4,
    metrics: [{
      id: "metric-1",
      name: "Items",
      unit: "items",
      baseline: 0,
      current: 1,
      target: 10,
    }],
  }];
  state.ui.tab = "today";
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();
  state.ui.checkInOpen = false;
  return state;
}

test("dialog isolates background, traps focus, blocks shortcuts, and restores its trigger", async ({ page }) => {
  await page.addInitScript(({ seed }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(seed));
  }, { seed: readyTodayState() });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const trigger = page.locator('.side [data-nav="today"]');
  await trigger.focus();
  await page.keyboard.press("?");

  const dialog = page.locator("#help-modal");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#app-shell")).toHaveAttribute("inert", "");
  await expect(dialog.locator("[data-modal-initial]")).toBeFocused();

  // Last-to-first wrapping proves Tab cannot enter the inert app shell.
  await page.keyboard.press("Tab");
  await expect(dialog.locator("[data-modal-close]")).toBeFocused();

  // Background numeric shortcuts do nothing while a dialog owns interaction.
  await page.keyboard.press("2");
  await expect(page.locator("body")).toHaveAttribute("data-active-panel", "today");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#app-shell")).not.toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();

  // Escape closes immediately from an editable modal field as well.
  await page.keyboard.press("i");
  await expect(page.locator("#checkin-modal")).toBeVisible();
  await expect(page.locator("#checkin-intention")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#checkin-modal")).toBeHidden();
  await expect(page.locator("#app-shell")).not.toHaveAttribute("inert", "");
});
