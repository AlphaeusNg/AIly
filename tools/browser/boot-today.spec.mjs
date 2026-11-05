import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

// Observe deferred module requests directly; offline behavior has its own journey.
test.use({ serviceWorkers: "block" });

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


test("review completion bars match completed time, including an unfinished day", async ({ page }) => {
  const seed = readyTodayState();
  seed.ui.tab = "review";
  seed.commitments.push({ ...seed.commitments[0], id: "commit-2", status: "done" });
  await page.addInitScript((state) => localStorage.setItem("aily.v1.state", JSON.stringify(state)), seed);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const row = page.locator(".week-day-list li").filter({ has: page.getByText("Today", { exact: true }) });
  await expect(row.getByRole("meter")).toHaveAttribute("aria-valuenow", "50");
  await expect(row.locator(".capacity-meter-fill")).toHaveAttribute("style", "width:50%");
  await page.locator('[data-nav="targets"]').click();
  await expect(page.getByRole("meter", { name: "Target progress" })).toHaveAttribute("aria-valuenow", "10");
});

test("focus actions load on demand and preserve start, pause, resume and end", async ({ page }) => {
  const requested = [];
  page.on("request", (request) => { if (request.url().includes("focus-actions.js")) requested.push(request.url()); });
  await openReady(page);
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  expect(requested).toHaveLength(0);
  await page.locator('[data-action="start-focus-25"]').click();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  expect(requested).toHaveLength(1);
  await page.locator('[data-action="pause-focus"]').click();
  await expect(page.locator('[data-action="resume-focus"]')).toBeVisible();
  await page.locator('[data-action="resume-focus"]').click();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  await page.locator('[data-action="end-focus"]').click();
  await expect(page.locator('[data-action="start-focus-25"]')).toBeVisible();
  expect(requested).toHaveLength(1);
});


test("latest focus duration wins while its module is still loading", async ({ page }) => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  let requested = false;
  await page.route("**/focus-actions.js", async (route) => {
    requested = true;
    await waiting;
    await route.continue();
  });
  await openReady(page);
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await page.locator('[data-action="start-focus-15"]').click();
  await expect.poll(() => requested).toBe(true);
  await page.locator('[data-action="start-focus-25"]').click();
  release();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).ui.focusSessionEndsAt - Date.now());
  expect(remaining).toBeGreaterThan(24 * 60_000);
  expect(remaining).toBeLessThanOrEqual(25 * 60_000);
});

test.describe("offline focus controls", () => {
  test.use({ serviceWorkers: "allow" });
  test("first focus action works offline after the shell is prepared", async ({ page, context }) => {
    await openReady(page);
    await expect(page.locator("body")).toHaveClass(/app-ready/);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => {
      const keys = await caches.keys();
      const key = keys.find((name) => name.startsWith("aily-"));
      return key ? Boolean(await (await caches.open(key)).match(new URL("js/focus-actions.js", location.href))) : false;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.getByText("Custom duration", { exact: true }).click();
    await page.getByLabel("Minutes (1–180)").fill("10");
    await page.getByRole("button", { name: "Start custom focus", exact: true }).click();
    await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
    await page.locator('[data-action="pause-focus"]').click();
    await expect(page.locator('[data-action="resume-focus"]')).toBeVisible();
  });
});


test('Today preserves composition and shortcut chords before adding a commitment', async ({page}) => {
  await openReady(page);
  const field = page.locator('#new-commit-text');
  await field.fill('Composed commitment');
  await page.locator('#new-commit-min').fill('15');
  for (const extra of [{isComposing:true}, {keyCode:229}, {ctrlKey:true}, {metaKey:true}, {altKey:true}, {prevented:true}]) {
    await field.evaluate((input, extra) => {
      const event = new KeyboardEvent('keydown', {key:'Enter',bubbles:true,cancelable:true,...extra});
      if (extra.prevented) event.preventDefault();
      input.dispatchEvent(event);
    }, extra);
    await expect(field).toHaveValue('Composed commitment');
  }
  await expect(field).toHaveValue('Composed commitment');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aily.v1.state')).commitments.length)).toBe(1);
  await field.press('Enter');
  await expect(page.locator('#panel-today')).toContainText('Composed commitment');
  await expect(field).toHaveValue('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aily.v1.state')).commitments.length)).toBe(2);
});

test("custom focus validates input, remembers duration and stays compact", async ({ page }) => {
  const seed = readyTodayState();
  seed.blockRules = [{ id: "rule", appKeys: ["distractor"], mode: "soft_delay", armed: false }];
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript((state) => {
    if (!localStorage.getItem("aily.v1.state")) localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, seed);
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await expect(page.locator(".custom-focus")).not.toHaveAttribute("open");
  await page.getByText("Custom duration", { exact: true }).click();
  const input = page.getByLabel("Minutes (1–180)");
  const start = page.getByRole("button", { name: "Start custom focus", exact: true });
  await expect(input).toHaveValue("25");
  for (const value of ["", "0", "181", "12.5"]) {
    await input.fill(value);
    await start.click();
    await expect(input).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")));
    expect(saved.ui.focusSessionEndsAt).toBe(0);
    expect(saved.ui.customFocusMinutes).toBe(25);
    expect(saved.blockRules[0].armed).toBe(false);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await input.fill("40");
  await input.press("Enter");
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")));
  expect(started.ui.focusSessionEndsAt - Date.now()).toBeGreaterThan(39 * 60_000);
  expect(started.ui.customFocusMinutes).toBe(40);
  expect(started.tutorial.permissions).toEqual(seed.tutorial.permissions);
  expect(started.blockRules[0].armed).toBe(false);
  await page.reload();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  await page.locator('[data-action="end-focus"]').click();
  await page.getByText("Custom duration", { exact: true }).click();
  await expect(input).toHaveValue("40");
  await page.locator('[data-action="start-focus-15"]').click();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
  await page.locator('[data-action="end-focus"]').click();
  await page.getByText("Custom duration", { exact: true }).click();
  await expect(input).toHaveValue("40");
  await start.click();
  await expect(page.locator('[data-action="pause-focus"]')).toBeVisible();
});


test("Today metric check-in ignores shortcut chords and requires a number", async ({ page }) => {
  await openReady(page);
  const field = page.locator("#today-metric-value");
  await field.fill("7");
  for (const extra of [{isComposing:true}, {keyCode:229}, {ctrlKey:true}, {metaKey:true}, {altKey:true}, {prevented:true}]) {
    await field.evaluate((input, extra) => {
      const event = new KeyboardEvent("keydown", {key:"Enter",bubbles:true,cancelable:true,...extra});
      if (extra.prevented) event.preventDefault();
      input.dispatchEvent(event);
    }, extra);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).targets[0].metrics[0].current)).toBe(1);
    await expect(field).toHaveValue("7");
  }
  await field.fill("");
  await field.press("Enter");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).targets[0].metrics[0].current)).toBe(1);
  await expect(field).toHaveValue("");
  await field.fill("0");
  await field.press("Enter");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).targets[0].metrics[0].current)).toBe(0);
});


test("Today requires an estimate before adding a commitment", async ({ page }) => {
  await openReady(page);
  await page.locator("#new-commit-text").fill("Keep this draft");
  const count = () => page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).commitments.length);
  for (const value of ["", "0", "-15", "14"]) {
    await page.locator("#new-commit-min").fill(value);
    await page.locator('[data-action="add-commit"]').click();
    expect(await count()).toBe(1);
    await expect(page.locator("#new-commit-text")).toHaveValue("Keep this draft");
    await expect(page.locator("#new-commit-min")).toHaveValue(value);
  }
  await page.locator("#new-commit-min").fill("15");
  await page.locator('[data-action="add-commit"]').click();
  await expect.poll(count).toBe(2);
});

test("Targets Set value keeps progress on blank input and accepts explicit zero", async ({ page }) => {
  await openReady(page);
  await page.locator('[data-nav="targets"]').click();
  const value = () => page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).targets[0].metrics[0].current);
  for (const response of ["", "   ", "not a number", null]) {
    page.once("dialog", (dialog) => response === null ? dialog.dismiss() : dialog.accept(response));
    await page.locator('[data-action="set-metric"]').click();
    expect(await value()).toBe(1);
  }
  page.once("dialog", (dialog) => dialog.accept("0"));
  await page.locator('[data-action="set-metric"]').click();
  await expect.poll(value).toBe(0);
});

test("creating a sixth target keeps automatically shared caps within one weekly hour", async ({ page }) => {
  const seed = readyTodayState();
  seed.user.weeklyCapacityHours = 1;
  seed.commitments = [];
  seed.targets = Array.from({ length: 5 }, (_, index) => ({
    ...structuredClone(seed.targets[0]), id: `existing-${index}`, softCapacityHours: 0.2,
  }));
  seed.ui.tab = "targets";
  await page.addInitScript((state) => localStorage.setItem("aily.v1.state", JSON.stringify(state)), seed);
  await page.goto("/");
  await page.locator('#target-form input[name="title"]').fill("Sixth target");
  await page.locator('#target-form input[name="metric"]').fill("Steps");
  await page.locator('#target-form button[type="submit"]').click();
  await expect(page.locator(".target-card")).toHaveCount(6);
  const caps = await page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")).targets.map((target) => target.softCapacityHours));
  expect(caps.reduce((sum, cap) => sum + cap, 0)).toBeLessThanOrEqual(1 + 1e-9);
  expect(Math.max(...caps) - Math.min(...caps)).toBeLessThanOrEqual(0.1 + 1e-9);
});
