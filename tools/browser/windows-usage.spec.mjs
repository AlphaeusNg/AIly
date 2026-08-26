import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

function todayLocal() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

test("starts, renders, and revokes honest Windows session usage", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  const state = defaultState();
  Object.keys(state.tutorial.chapters).forEach((id) => {
    state.tutorial.chapters[id] = "done";
  });
  state.ui.tab = "usage";
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();

  await page.addInitScript(({ seed, day }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(seed));
    window.__windowsUsageCalls = [];
    window.__TAURI__ = {
      core: {
        invoke: async (command, args = {}) => {
          window.__windowsUsageCalls.push([command, args]);
          if (command === "windows_usage_status") {
            return { available: true, tracking: false, day };
          }
          if (command === "set_windows_usage_tracking") {
            return { available: true, tracking: args.consented, day };
          }
          if (command === "list_windows_session_usage") {
            return {
              day,
              samples: [{ processName: "editor.exe", label: "Editor", foregroundMs: 125_000 }],
            };
          }
          throw new Error(`unexpected command: ${command}`);
        },
      },
    };
  }, { seed: state, day: todayLocal() });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#panel-usage")).toContainText("Windows foreground apps since AIly opened");
  await page.locator('[data-action="grant-usage"]').click();
  await expect(page.locator("#panel-usage")).toContainText("Editor");
  await expect(page.locator("#panel-usage")).toContainText("2m");
  await expect(page.locator("#panel-usage")).toContainText("since AIly opened");

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('[data-action="revoke-usage"]').click();
  await expect.poll(() => page.evaluate(() => window.__windowsUsageCalls.at(-1))).toEqual([
    "set_windows_usage_tracking",
    { consented: false },
  ]);
  await page.getByRole("button", { name: "Usage", exact: true }).click();
  await expect(page.locator('[data-action="grant-usage"]')).toContainText("Start Windows");
  expect(runtimeErrors).toEqual([]);
});
