import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

test.use({ serviceWorkers: "block", reducedMotion: "reduce" });

const scenarios = [
  { name: "320px phone", width: 320, height: 740 },
  { name: "375px phone", width: 375, height: 812 },
  { name: "768px tablet", width: 768, height: 1024 },
  { name: "1280px desktop", width: 1280, height: 800 },
  { name: "375px with 200% text", width: 375, height: 812, text: 2 },
  { name: "1280px with CSS zoom 200%", width: 1280, height: 800, zoom: 2 },
];

function seed() {
  const state = defaultState();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  Object.keys(state.tutorial.chapters).forEach((id) => { state.tutorial.chapters[id] = "done"; });
  state.ui = { ...state.ui, tutorialOpen: false, checkInOpen: false, lastCheckInDate: today, installBannerDismissed: true };
  state.targets = [{ id: "target", title: "Ship a meaningful improvement to my side project", status: "active", softCapacityHours: 4,
    metrics: [{ name: "Shippable pieces", unit: "pieces", baseline: 0, current: 1, target: 8 }] }];
  state.commitments = [0, 1].map((priority) => ({ id: `commit-${priority}`, targetId: "target", planDate: today,
    text: "Review the smallest useful implementation and write down next steps", estimateMin: 15, status: "pending", priority }));
  state.blockRules = [{ id: "rule", appKeys: ["youtube"], mode: "soft_delay", armed: false, breakGlass: { delaySec: 20, requireReason: true, dailyLimit: 5 } }];
  return state;
}

async function assertReflow(page) {
  const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(bounds.scroll, "page content fits the viewport without sideways scrolling").toBeLessThanOrEqual(bounds.width + 1);
}

for (const scenario of scenarios) {
  test(`controls and dialogs reflow at ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript((state) => localStorage.setItem("aily.v1.state", JSON.stringify(state)), seed());
    await page.goto("/");
    await expect(page.locator("body")).toHaveClass(/app-ready/);
    await expect(page.locator("#boot-splash")).toBeHidden();
    await page.evaluate(({ text = 1, zoom = 1 }) => {
      document.documentElement.style.fontSize = `${text * 100}%`;
      document.documentElement.style.zoom = String(zoom);
    }, scenario);

    const skip = page.locator("a.sr-only");
    await skip.focus();
    const skipBox = await skip.boundingBox();
    expect(skipBox.width).toBeGreaterThanOrEqual(24);
    expect(skipBox.height).toBeGreaterThanOrEqual(24);
    expect(skipBox.x).toBeGreaterThanOrEqual(0);
    await assertReflow(page);

    for (const [key, panel] of [["1", "today"], ["2", "targets"], ["3", "review"], ["4", "usage"], ["5", "blocks"], ["6", "setup"], ["7", "activity"]]) {
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press(key);
      await expect(page.locator(`#panel-${panel}`)).toBeVisible();
      await expect(page.locator(`#panel-${panel}`)).not.toBeEmpty();
      await assertReflow(page);
      if (panel === "today") {
        await page.locator(".custom-focus > summary").click();
        await expect(page.getByRole("button", { name: "Start custom focus", exact: true })).toBeVisible();
        await assertReflow(page);
        for (const selector of [".custom-focus > summary", ".commit-overflow > summary", ".chk"]) {
          const box = await page.locator(selector).first().boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(24);
        }
        await page.locator(".commit-overflow > summary").click();
        await expect(page.locator(".commit-overflow-menu")).toBeVisible();
        await assertReflow(page);
      }
      if (panel === "usage") await expect(page.locator(`#panel-${panel}`)).toContainText("Grant usage tracking");
      if (panel === "blocks") await expect(page.locator(`#panel-${panel}`)).toContainText("before arming blocks");
    }
    await page.keyboard.press("6");
    await page.getByRole("button", { name: "Open tutorial", exact: true }).click();
    for (const modalId of ["tutorial-modal", "help-modal", "checkin-modal", "more-sheet"]) {
      if (modalId === "help-modal") await page.keyboard.press("?");
      if (modalId === "checkin-modal") await page.keyboard.press("i");
      if (modalId === "more-sheet") await page.evaluate(() => document.querySelector('[data-action="open-more"]').click());
      const modal = page.locator(`#${modalId} .modal`);
      await expect(modal).toBeVisible();
      // Modal focus is assigned on the next animation frame. Let it settle
      // before checking scroll reachability of the final action.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const box = await modal.boundingBox();
      expect(box.y, `${modalId} starts inside the viewport`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${modalId} ends inside the viewport`).toBeLessThanOrEqual(scenario.height + 1);
      const last = modal.locator("button").last();
      await last.scrollIntoViewIfNeeded();
      const action = await last.boundingBox();
      expect(action.y).toBeGreaterThanOrEqual(0);
      expect(action.y + action.height).toBeLessThanOrEqual(scenario.height + 1);
      await assertReflow(page);
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
    }
  });
}
