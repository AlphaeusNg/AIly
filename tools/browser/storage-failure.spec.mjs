import { expect, test } from "@playwright/test";
import { defaultState, exportState } from "../../apps/web/js/store.js";

const runtimeErrors = new WeakMap();

function todayLocal() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function readyState({ tab = "today", damagedCommitment = false } = {}) {
  const state = defaultState();
  Object.keys(state.tutorial.chapters).forEach((id) => {
    state.tutorial.chapters[id] = "done";
  });
  state.targets = [{
    id: "target-1",
    title: "Existing target",
    status: "active",
    softCapacityHours: 4,
    metrics: [{
      id: "metric-1",
      name: "Items",
      unit: "items",
      baseline: 0,
      current: 0,
      target: 10,
    }],
  }];
  state.ui.tab = tab;
  state.ui.tutorialOpen = false;
  state.ui.installBannerDismissed = true;
  state.ui.lastCheckInDate = todayLocal();
  if (damagedCommitment) {
    state.commitments = [{
      id: "damaged-1",
      targetId: "",
      planDate: "2026-99-99",
      text: "Damaged saved work",
      estimateMin: -1,
      status: "pending",
    }];
  }
  return state;
}

async function openWithWriteFailure(page, state) {
  await page.addInitScript(({ seed }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(seed));
    Storage.prototype.setItem = function setItemDenied() {
      const error = new Error("forced browser storage failure");
      error.name = "QuotaExceededError";
      throw error;
    };
  }, { seed: state });
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(runtimeErrors.get(page), "unexpected browser runtime errors").toEqual([]);
});

test("keeps target input usable and labels an unsaved session-only change", async ({ page }) => {
  await openWithWriteFailure(page, readyState({ tab: "targets" }));
  await page.locator('#target-form input[name="title"]').fill("Memory-only target");
  await page.locator('#target-form input[name="metric"]').fill("Steps");
  await page.locator("#target-form button[type=submit]").click();

  await expect(page.locator(".target-card")).toHaveCount(2);
  await expect(page.locator("#save-status")).toHaveText(
    "Save failed — storage full or blocked",
  );
  await expect(page.locator("#toast-host")).toContainText(
    "Target created for this session only. Export a backup before refresh.",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".target-card")).toHaveCount(1);
});

test("keeps quarantine recovery usable and labels a non-durable discard", async ({ page }) => {
  await openWithWriteFailure(page, readyState({ damagedCommitment: true }));
  await page.locator(".today-notices").evaluate((details) => {
    details.open = true;
  });
  await expect(page.locator('[data-action="discard-invalid-commitments"]')).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('[data-action="discard-invalid-commitments"]').evaluate((button) => {
    button.click();
  });

  await expect(page.locator('[data-action="discard-invalid-commitments"]')).toHaveCount(0);
  await expect(page.locator("#save-status")).toHaveText(
    "Save failed — storage full or blocked",
  );
  await expect(page.locator("#toast-host")).toContainText(
    "Quarantined items removed for this session only. They will return on refresh unless storage is unblocked.",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".today-notices").evaluate((details) => {
    details.open = true;
  });
  await expect(page.locator('[data-action="discard-invalid-commitments"]')).toBeVisible();
});

test("labels failed backup import and reset as session-only recovery", async ({ page }) => {
  const original = readyState({ tab: "setup" });
  original.user.displayName = "Original profile";
  const imported = readyState({ tab: "setup" });
  imported.user.displayName = "Imported profile";
  await openWithWriteFailure(page, original);
  page.on("dialog", (dialog) => dialog.accept());

  await page.locator("#import-backup").setInputFiles({
    name: "aily-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportState(imported)),
  });
  await expect(page.locator("#setup-name")).toHaveValue("Imported profile");
  await expect(page.locator("#toast-host")).toContainText(
    "Backup imported for this session only. Storage is blocked, so export a fresh backup before refresh.",
  );
  await expect(page.locator("#save-status")).toHaveText(
    "Save failed — storage full or blocked",
  );

  await page.locator('[data-action="reset-demo"]').click();
  await expect(page.locator("#toast-host")).toContainText(
    "Demo data reset for this session only. Stored data will return on refresh unless storage is unblocked.",
  );
  await expect(page.locator("#save-status")).toHaveText(
    "Save failed — storage full or blocked",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#setup-name")).toHaveValue("Original profile");
});
