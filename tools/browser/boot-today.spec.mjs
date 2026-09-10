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
    title: "Boot target",
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
  state.commitments = [{
    id: "commit-1",
    targetId: "target-1",
    planDate: todayLocal(),
    text: "First Today item",
    estimateMin: 30,
    mustKeep: false,
    priority: 0,
    status: "pending",
  }];
  state.ui.tab = "today";
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();
  state.ui.checkInOpen = false;
  return state;
}

async function openReady(page) {
  const seed = readyTodayState();
  await page.addInitScript(({ seed: state }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
    performance.mark("aily-boot-script");
  }, { seed });
  const started = Date.now();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  return started;
}

test("cold open builds Today only, then lazy-loads Targets", async ({ page }) => {
  const started = await openReady(page);

  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await expect(page.locator("#panel-today")).toBeVisible();
  await expect(page.locator("#panel-today")).toContainText("First Today item");

  // Inactive panels stay empty until first visit.
  await expect(page.locator("#panel-targets")).toBeEmpty();
  await expect(page.locator("#panel-usage")).toBeEmpty();
  await expect(page.locator("#panel-blocks")).toBeEmpty();
  await expect(page.locator("body")).toHaveAttribute("data-rendered-tabs", "today");

  const toTodayMs = await page.evaluate(() => {
    const ready = performance.getEntriesByName("aily-boot-script")[0];
    return Math.round(performance.now() - (ready?.startTime || 0));
  });
  // Guardrail: Today interactive well under a couple seconds on CI Chromium.
  expect(toTodayMs, `time-to-Today ${toTodayMs}ms`).toBeLessThan(2500);
  expect(Date.now() - started, "wall clock to Today").toBeLessThan(5000);

  await page.locator('[data-nav="targets"]').click();
  await expect(page.locator("#panel-targets")).toBeVisible();
  await expect(page.locator("#panel-targets")).toContainText("Boot target");
  await expect(page.locator("body")).toHaveAttribute("data-rendered-tabs", "today,targets");

  // Returning to Today does not require rebuilding Targets again for correctness.
  await page.locator('[data-nav="today"]').click();
  await expect(page.locator("#panel-today")).toContainText("First Today item");
});
