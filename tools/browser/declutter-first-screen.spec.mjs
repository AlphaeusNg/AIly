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
  await expect(propose).toHaveAttribute("data-label", "Ask AIly to propose a plan");
  await expect(commitment).toBeVisible();
  for (const chip of await page.locator(".quick-chips .chip").all()) {
    expect((await chip.boundingBox()).height).toBeLessThan(40);
  }
  const add = page.locator('[data-action="add-commit"]');
  expect((await add.boundingBox()).height).toBeLessThan(48);
  expect(await add.evaluate(el => {
    const text = document.createRange();
    text.selectNodeContents(el);
    return text.getClientRects().length;
  })).toBe(1);

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
  const windows = banner.getByRole("link", { name: "Windows package", exact: true });

  const styles = await banner.locator(".icon-control").evaluateAll(els => els.map(el => {
    const css = getComputedStyle(el);
    return [css.backgroundColor, css.border, css.borderRadius];
  }));
  expect(styles.length).toBe(3);
  for (const style of styles) expect(style).toEqual(styles[0]);
  await expect(summary).toHaveAttribute("aria-label", "Install options");
  await expect(summary).toHaveAttribute("data-label", "Install options");
  await summary.hover();
  await expect(summary).toBeVisible();
  await expect(windows).toBeVisible();
  await expect(options.locator(".install-desc")).toBeHidden();
  const title = await banner.locator(".install-copy").boundingBox();
  expect(title?.width || 0).toBeGreaterThan(140);

  await summary.click();
  await expect(windows).toBeVisible();
  expect(await summary.evaluate((el) => getComputedStyle(el, "::after").visibility)).toBe("hidden");
  await expect(options.locator(".install-desc")).toBeVisible();
  await expect(banner.getByRole("button", { name: "Install PWA", exact: true })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Dismiss", exact: true })).toBeVisible();

  const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fit).toBe(true);
});

test("desktop install banner keeps the description and Windows package visible", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await openFreshToday(page);

  const banner = page.locator("#install-banner");
  if (!(await banner.isVisible())) {
    test.skip(true, "install banner is not shown");
    return;
  }

  await expect(banner.getByRole("link", { name: "Windows package", exact: true })).toBeVisible();
  await expect(banner.locator(".install-desc-wide")).toBeVisible();
  await expect(banner.locator("#install-options")).toBeVisible();
  await expect(banner.locator("#install-options")).not.toHaveAttribute("open");
  await expect(banner.locator("#install-options .install-desc")).toBeHidden();

  await expect(banner.locator("summary")).toBeVisible();
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
  await expect(page.locator('[data-action="ally-propose"]')).toHaveText("Ask AIly to propose a plan");
  await expect(page.locator('[data-action="ally-propose"]')).not.toHaveAttribute("data-label");
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


test("secondary icons expose names and keyboard tooltips within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);
  const toggle = page.getByRole("button", { name: "Add to plan", exact: true });
  // Reach the toggle using actual keyboard navigation, ensuring :focus-visible.
  await page.keyboard.press("Tab");
  for (let step = 0; step < 100 && !(await toggle.evaluate((el) => el === document.activeElement)); step++) {
    await page.keyboard.press("Tab");
  }
  await expect(toggle).toBeFocused();
  const tooltip = await toggle.evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { opacity: style.opacity, visibility: style.visibility, content: style.content,
      left: el.getBoundingClientRect().left + el.clientLeft + parseFloat(style.left), width: parseFloat(style.width) };
  });
  expect(tooltip.opacity).toBe("1");
  expect(tooltip.visibility).toBe("visible");
  expect(tooltip.content).toBe('"Add to plan"');
  expect(tooltip.left).toBeGreaterThanOrEqual(8);
  expect(tooltip.left + tooltip.width).toBeLessThanOrEqual(382);
  await page.keyboard.press("Enter");
  for (const control of await page.locator("#panel-today .icon-control, #install-banner .icon-control, #update-banner .icon-control").all()) {
    const label = await control.getAttribute("aria-label");
    expect(label).toBeTruthy();
    await expect(control).toHaveAttribute("data-label", label);
    await expect(control).toHaveText("");
    await expect(control.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(control.locator("svg")).toHaveAttribute("focusable", "false");
  }
  const summary = page.locator("#install-options summary");
  await summary.focus();
  const rightTooltip = await summary.evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { left: el.getBoundingClientRect().left + el.clientLeft + parseFloat(style.left), width: parseFloat(style.width) };
  });
  expect(rightTooltip.left).toBeGreaterThanOrEqual(8);
  expect(rightTooltip.left + rightTooltip.width).toBeLessThanOrEqual(382);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await toggle.evaluate((el) => getComputedStyle(el, "::after").transitionDuration)).toBe("0s");
});


test("Today management controls retain accessible words as icon labels", async ({ page }) => {
  const state = profileWithTarget({ commitments: true });
  state.ui.dailyIntention = "Make time to read";
  state.commitments.push({ ...state.commitments[0], id: "done-1", text: "Finished item", status: "done" });
  await page.addInitScript((saved) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(saved));
  }, state);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);
  for (const name of ["Export plan", "Copy plan", "Move open → tomorrow", "Drop done from list", "Clone yesterday", "Edit", "Clear"]) {
    const control = page.getByRole("button", { name, exact: true });
    await expect(control).toHaveAttribute("aria-label", name);
    await expect(control).toHaveAttribute("data-label", name);
    await expect(control).toHaveText("");
  }
  await page.getByRole("button", { name: "Ask AIly to propose a plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear proposal", exact: true })).toHaveAttribute("data-label", "Clear proposal");
});


test("Clone yesterday hover shows a compact tooltip at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFreshToday(page);
  await page.locator("#add-to-plan-toggle").click();
  const clone = page.getByRole("button", { name: "Clone yesterday", exact: true });
  await clone.hover();
  const tooltip = await clone.evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { visibility: style.visibility, position: style.position, width: parseFloat(style.width) };
  });
  expect(tooltip.visibility).toBe("visible");
  expect(tooltip.position).toBe("absolute");
  expect(tooltip.width).toBeLessThan(240);
});

function noticeLabel(count) {
  return `${count} notice${count === 1 ? "" : "s"}`;
}

test("Today notices summary shows the count and reflects open state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);

  const details = page.locator(".today-notices");
  const summary = details.locator("summary");
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open");
  const text = (await summary.innerText()).replace(/\s+/g, " ").trim();
  expect(text).toMatch(/^\d+ notices?$/);
  const count = Number.parseInt(text, 10);
  expect(text).toBe(noticeLabel(count));
  expect(count).toBeGreaterThan(1);
  await expect(summary).toHaveAttribute("aria-label", text);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  const detailsBox = await details.boundingBox();
  const panelBox = await page.locator("#panel-today").boundingBox();
  expect(detailsBox.width).toBeGreaterThan(70);
  expect(detailsBox.width).toBeLessThan(panelBox.width * 0.75);

  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(details).toHaveAttribute("open", "");
});

test("a single Today notice uses the singular label", async ({ page }) => {
  const state = profileWithTarget();
  state.ui.lastExportAt = new Date().toISOString();
  state.blockRules = [];
  await page.addInitScript((saved) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(saved));
  }, state);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);

  const summary = page.locator(".today-notices > summary");
  await expect(summary).toHaveText("1 notice");
  await expect(summary).toHaveAttribute("aria-label", "1 notice");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test("Today omits the notices strip when nothing needs attention", async ({ page }) => {
  const state = profileWithTarget();
  state.ui.lastExportAt = new Date().toISOString();
  state.user.weeklyCapacityHours = 10;
  state.targets[0].softCapacityHours = 8;
  state.targets.push({
    id: "target-2",
    title: "Second target",
    status: "active",
    softCapacityHours: 8,
    metrics: [],
  });
  state.commitments = [];
  state.blockRules = [];
  state.recovery = { invalidCommitments: [] };
  await page.addInitScript((saved) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(saved));
  }, state);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await dismissTutorial(page);

  await expect(page.locator("#panel-today h1")).toHaveText("Today");
  await expect(page.locator(".banner.danger")).toBeVisible();
  await expect(page.locator(".today-notices")).toHaveCount(0);
});

test("touch tap shows a tooltip and still activates the icon control", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  try {
    await openFreshToday(page);
    const toggle = page.locator("#add-to-plan-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.tap();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveClass(/is-tip-visible/);
    expect(await toggle.evaluate((el) => getComputedStyle(el, "::after").visibility)).toBe("visible");
    await page.waitForTimeout(2000);
    await expect(toggle).not.toHaveClass(/is-tip-visible/);
    expect(await toggle.evaluate((el) => getComputedStyle(el, "::after").visibility)).toBe("hidden");
  } finally {
    await context.close();
  }
});

async function expectIconSquares(page) {
  const controls = page.locator(".icon-control:visible, [data-modal-close]:visible");
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        radius: style.borderRadius,
      };
    });
    expect(Math.abs(box.width - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height - 40)).toBeLessThanOrEqual(1);
    expect(box.radius).toBe("12px");
    expect(box.radius).not.toContain("50%");
  }
}

test("icon buttons are 40px rounded squares", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);
  await page.keyboard.press("?");
  await expect(page.locator("#help-modal")).toBeVisible();
  await expectIconSquares(page);

  await page.keyboard.press("Escape");
  await expect(page.locator("#help-modal")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("?");
  await expect(page.locator("#help-modal")).toBeVisible();
  await expectIconSquares(page);
});

test("focus tooltip stays above its control near the mobile bottom nav", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshToday(page);
  const control = page.locator("#add-to-plan-toggle");
  await control.evaluate((el) => {
    el.style.position = "fixed";
    el.style.bottom = "60px";
  });
  await control.focus();
  await expect(control).toHaveClass(/tooltip-above/);
  const tooltip = await control.evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { visibility: style.visibility, bottom: parseFloat(style.bottom), height: el.clientHeight };
  });
  expect(tooltip.visibility).toBe("visible");
  expect(tooltip.bottom).toBeGreaterThanOrEqual(tooltip.height + 6);
});

for (const width of [1366, 390]) {
  test(`shared icon rules and inline folds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = profileWithTarget({ commitments: true });
    state.ui.installBannerDismissed = false;
    state.commitments.push({ ...state.commitments[0], id: "done-1", text: "Finished item", status: "done" });
    await page.addInitScript(state => localStorage.setItem("aily.v1.state", JSON.stringify(state)), state);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toHaveClass(/app-ready/);
    const toggle = page.locator("#add-to-plan-toggle");
    const rootVars = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return [css.getPropertyValue("--icon-btn-size").trim(), css.getPropertyValue("--icon-btn-radius").trim()];
    });
    expect(rootVars).toEqual(["40px", "12px"]);
    await page.evaluate(() => document.documentElement.style.setProperty("--icon-btn-size", "44px"));
    expect(await toggle.evaluate(el => el.getBoundingClientRect().width)).toBe(44);
    await page.evaluate(() => document.documentElement.style.removeProperty("--icon-btn-size"));
    await expectIconSquares(page);
    for (const control of await page.locator(".icon-control:visible").all()) {
      const hit = await control.evaluate(el => {
        const css = getComputedStyle(el, "::before");
        return [parseFloat(css.width), parseFloat(css.height)];
      });
      expect(hit[0]).toBeGreaterThanOrEqual(48);
      expect(hit[1]).toBeGreaterThanOrEqual(48);
    }
    const icons = page.locator("button svg, nav svg, .today-notices svg");
    for (const svg of await icons.all()) {
      await expect(svg).toHaveAttribute("stroke", "currentColor");
      await expect(svg).toHaveAttribute("stroke-width", "2");
    }
    for (const el of await page.locator("button, nav, .today-notices > summary").all()) {
      expect(await el.textContent()).not.toMatch(/[\u2190-\u2BFF\u{1F300}-\u{1FAFF}]/u);
    }
    for (const selector of [".today-toolbar", ".install-actions"]) {
      const row = page.locator(selector);
      if (!(await row.isVisible())) continue;
      const boxes = await row.locator(":scope > button, :scope > a, :scope > details > summary").evaluateAll(els => els.map(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
      expect(boxes.length).toBeGreaterThan(1);
      expect(Math.max(...boxes.map(b => b.top)) - Math.min(...boxes.map(b => b.top))).toBeLessThanOrEqual(1);
    }
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    const panel = await page.locator("#plan-tools-panel").boundingBox();
    const row = await page.locator(".today-toolbar").boundingBox();
    expect(panel.y).toBeGreaterThanOrEqual(row.y + row.height);
    const options = page.locator("#install-options");
    if (await options.isVisible()) {
      await options.locator("summary").click();
      const content = await options.locator(".install-desc").boundingBox();
      const actions = await page.locator(".install-actions").boundingBox();
      expect(content.y).toBeGreaterThanOrEqual(actions.y + actions.height);
    }
  });
}
