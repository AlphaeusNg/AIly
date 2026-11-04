import { expect, test } from "@playwright/test";
import { defaultState } from "../../apps/web/js/store.js";

test("tutorial rejects invalid capacity without completing the chapter or changing saved limits", async ({ page }) => {
  const seed = defaultState();
  seed.tutorial.chapters.meet = "done";
  seed.tutorial.chapters.first_target = "done";
  seed.targets = [
    { id: "a", title: "A", status: "active", softCapacityHours: 4, metrics: [] },
    { id: "b", title: "B", status: "active", softCapacityHours: 4, metrics: [] },
  ];
  seed.ui.tutorialOpen = true;
  await page.addInitScript((state) => localStorage.setItem("aily.v1.state", JSON.stringify(state)), seed);
  await page.goto("/");
  await expect(page.locator("#tut-hours")).toBeVisible();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("aily.v1.state")));
  for (const [hours, nights] of [["", "4"], ["0", "4"], ["169", "4"], ["10", ""], ["10", "8"], ["10", "2.5"], ["7", "4"]]) {
    await page.locator("#tut-hours").fill(hours);
    await page.locator("#tut-nights").fill(nights);
    await page.getByRole("button", { name: "Save capacity", exact: true }).click();
    expect((await saved()).user.weeklyCapacityHours).toBe(10);
    expect((await saved()).user.nightsPerWeek).toBe(4);
    expect((await saved()).tutorial.chapters.capacity).toBe("pending");
    await expect(page.locator("#tut-hours")).toHaveValue(hours);
  }
  await page.locator("#tut-hours").fill("168");
  await page.locator("#tut-nights").fill("7");
  await page.getByRole("button", { name: "Save capacity", exact: true }).click();
  await expect.poll(async () => (await saved()).tutorial.chapters.capacity).toBe("done");
  expect((await saved()).user.weeklyCapacityHours).toBe(168);
  expect((await saved()).user.nightsPerWeek).toBe(7);
  await page.keyboard.press("Escape");
  await expect(page.locator("#tutorial-modal")).toBeHidden();
  await page.locator('.side [data-nav="setup"]').click();
  await expect(page.locator("#setup-hours")).toBeVisible();
  for (const [hours, nights] of [["0.5", "7"], ["168", "2.5"]]) {
    await page.locator("#setup-hours").fill(hours);
    await page.locator("#setup-nights").fill(nights);
    await page.locator('[data-action="save-capacity"]').click();
    expect((await saved()).user.weeklyCapacityHours).toBe(168);
    expect((await saved()).user.nightsPerWeek).toBe(7);
  }
});
