import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

function todayLocal() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

test("platform refresh keeps Usage form draft without remounting", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });

  const state = defaultState();
  Object.keys(state.tutorial.chapters).forEach((id) => {
    state.tutorial.chapters[id] = "done";
  });
  state.tutorial.permissions.usage = true;
  state.ui.tab = "usage";
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();

  await page.addInitScript(({ seed, day }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(seed));
    window.__usageListCalls = 0;
    window.__TAURI__ = {
      core: {
        invoke: async (command, args = {}) => {
          if (command === "desktop_ready") return "AIly frontend ready";
          if (command === "windows_usage_status") {
            return { available: true, tracking: true, day };
          }
          if (command === "set_windows_usage_tracking") {
            return { available: true, tracking: !!args.consented, day };
          }
          if (command === "list_windows_session_usage") {
            window.__usageListCalls += 1;
            const mins = Math.max(1, window.__usageListCalls);
            return {
              day,
              samples: [
                {
                  processName: "editor.exe",
                  label: "Editor",
                  foregroundMs: mins * 60_000,
                },
              ],
            };
          }
          throw new Error(`unexpected command: ${command}`);
        },
      },
    };
  }, { seed: state, day: todayLocal() });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await expect(page.locator("#usage-form")).toBeVisible();
  await expect(page.locator("#panel-usage")).toContainText("Editor");

  const formHandle = await page.locator("#usage-form").elementHandle();
  const appInput = page.locator('#usage-form input[name="app"]');
  await appInput.fill("DraftApp");
  await appInput.focus();
  await expect(appInput).toBeFocused();

  const callsBefore = await page.evaluate(() => window.__usageListCalls);
  // Keyboard-activate refresh without leaving the input first, then assert draft
  // survived on the same form node (button click would intentionally move focus).
  await page.locator('[data-action="refresh-platform-usage"]').evaluate((btn) => btn.click());
  await expect.poll(() => page.evaluate(() => window.__usageListCalls)).toBeGreaterThan(callsBefore);

  const sameForm = await page.evaluate((el) => el === document.querySelector("#usage-form"), formHandle);
  expect(sameForm, "refresh must not remount #usage-form").toBe(true);
  await expect(appInput).toHaveValue("DraftApp");
  // After a programmatic click, restore and prove the live input still accepts focus.
  await appInput.focus();
  await expect(appInput).toBeFocused();
  await expect(page.locator("[data-usage-totals]")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
