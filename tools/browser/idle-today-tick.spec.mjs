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

test("idle Today tick updates tray without rewriting the panel tree", async ({ page }) => {
  const seed = readyTodayState();
  await page.addInitScript(({ seed: state }) => {
    localStorage.setItem("aily.v1.state", JSON.stringify(state));
  }, { seed });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/app-ready/);
  await expect(page.locator("#panel-today")).toContainText("First Today item");

  const result = await page.evaluate(() => {
    const panel = document.querySelector("#panel-today");
    let childList = 0;
    const obs = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") childList += 1;
      }
    });
    obs.observe(panel, { childList: true, subtree: true });
    const trayBefore = document.querySelector("#tray-status")?.textContent || "";
    document.dispatchEvent(new Event("aily:idle-tick"));
    obs.disconnect();
    return {
      childList,
      trayBefore,
      trayAfter: document.querySelector("#tray-status")?.textContent || "",
      stillHasCommitment: panel.textContent.includes("First Today item"),
    };
  });

  expect(result.childList, "idle tick must not rebuild Today DOM").toBe(0);
  expect(result.stillHasCommitment).toBe(true);
  expect(result.trayAfter).toBeTruthy();
});
