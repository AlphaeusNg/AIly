import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

test.use({ serviceWorkers: "block" });

function todayLocal() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function freshProfile() {
  const state = defaultState();
  state.ui.tab = "today";
  state.ui.tutorialOpen = true;
  state.ui.installBannerDismissed = false;
  state.ui.checkInOpen = false;
  state.targets = [];
  state.commitments = [];
  return state;
}

function profileWithTarget({ commitments = false } = {}) {
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
  state.commitments = commitments
    ? [{
      id: "commit-1",
      targetId: "target-1",
      planDate: todayLocal(),
      text: "First Today item",
      estimateMin: 30,
      mustKeep: false,
      priority: 0,
      status: "pending",
    }]
    : [];
  state.ui.tab = "today";
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();
  state.ui.checkInOpen = false;
  return state;
}

async function dismissTutorial(page) {
  const tutorial = page.locator("#tutorial-modal");
  if (await tutorial.isVisible()) {
    await tutorial.locator("[data-action='close-tutorial']").click();
    await expect(tutorial).toBeHidden();
  }
}

async function openFreshToday(page) {
  await page.addInitScript((state) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, freshProfile());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);
  await expect(page.locator("#panel-today")).toBeVisible();
}

test("fresh Today hides planning tools and keeps one primary action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);

  const toggle = page.getByRole("button", { name: "Add to plan", exact: true });
  const propose = page.getByRole("button", { name: "Ask AIly to propose a plan", exact: true });
  const commitment = page.locator("#new-commit-text");
  const primary = page.locator("#panel-today button.primary:visible");

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-controls", "plan-tools-panel");
  await expect(page.locator("#plan-tools-panel")).toBeHidden();
  await expect(propose).toBeHidden();
  await expect(commitment).toBeHidden();
  await expect(page.locator('[data-action="clone-yesterday"]')).toBeHidden();
  await expect(page.locator(".quick-chips")).toBeHidden();
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveText("Create a target");
  await expect(page.locator('[data-action="open-checkin"]')).not.toHaveClass(/primary/);
  await expect(page.locator('[data-action="start-focus-50"]')).not.toHaveClass(/primary/);
  await expect(page.locator('[data-action="ally-propose"]')).not.toHaveClass(/primary/);
  for (const action of ["start-focus-15", "start-focus-25", "start-focus-50"]) {
    await expect(page.locator(`[data-action="${action}"]`)).toBeVisible();
  }
  await expect(page.locator(".custom-focus")).not.toHaveAttribute("open");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(propose).toBeVisible();
  await expect(commitment).toBeVisible();
  await expect(page.locator("#panel-today button.primary:visible")).toHaveCount(1);
  await expect(page.locator("#panel-today button.primary:visible")).toHaveText("Create a target");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(propose).toBeHidden();
  await expect(commitment).toBeHidden();

  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fit).toBe(true);
});

test("install options open in one tap at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);

  const banner = page.locator("#install-banner");
  if (!(await banner.isVisible())) {
    test.skip(true, "install banner is not shown");
    return;
  }

  const options = banner.locator("#install-options");
  const summary = options.locator("summary");
  const windows = options.getByRole("link", { name: "Windows package", exact: true });
  await expect(summary).toHaveText("Install options");
  await expect(summary).toBeVisible();
  await expect(windows).toBeHidden();
  await expect(options.locator(".install-desc")).toBeHidden();
  const title = await banner.locator(".install-copy").boundingBox();
  expect(title?.width || 0).toBeGreaterThan(140);

  await summary.click();
  await expect(windows).toBeVisible();
  await expect(options.locator(".install-desc")).toBeVisible();
  await expect(banner.getByRole("button", { name: "Install PWA", exact: true })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Dismiss", exact: true })).toBeVisible();

  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fit).toBe(true);
});

test("desktop install banner keeps the description and Windows package visible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshToday(page);

  const banner = page.locator("#install-banner");
  if (!(await banner.isVisible())) {
    test.skip(true, "install banner is not shown");
    return;
  }

  await expect(banner.getByRole("link", { name: "Windows package", exact: true })).toBeVisible();
  await expect(banner.locator(".install-desc-wide")).toBeVisible();
  await expect(banner.locator("#install-options")).toBeHidden();
  await expect(banner.locator("summary")).toBeHidden();
  await expect(banner.getByRole("button", { name: "Install PWA", exact: true })).toBeVisible();
  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fit).toBe(true);
});

test("planning controls keep primary styling once a target exists", async ({ page }) => {
  await page.addInitScript((state) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, profileWithTarget());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);

  await expect(page.locator("#add-to-plan-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-action="open-checkin"]')).toHaveClass(/primary/);
  await expect(page.locator('[data-action="start-focus-50"]')).toHaveClass(/primary/);
  await expect(page.locator('[data-action="ally-propose"]')).toHaveClass(/primary/);
  await expect(page.locator('[data-action="add-commit"]')).toHaveClass(/primary/);
  await expect(page.locator('[data-action="start-focus-15"]')).not.toHaveClass(/primary/);
  await expect(page.locator('[data-action="start-focus-25"]')).not.toHaveClass(/primary/);
});

test("Add to plan starts expanded when today already has commitments", async ({ page }) => {
  await page.addInitScript((state) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, profileWithTarget({ commitments: true }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);

  await expect(page.locator("#add-to-plan-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Ask AIly to propose a plan", exact: true })).toBeVisible();
  await expect(page.locator("#new-commit-text")).toBeVisible();
  await expect(page.locator('[data-action="export-today-plan"]')).toBeVisible();
});
