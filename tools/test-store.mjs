/** Node tests for persisted web-state hydration (no browser required). */
import assert from "node:assert/strict";

import { defaultState, hydrateState, loadState } from "../apps/web/js/store.js";

const partial = hydrateState({
  user: { weeklyCapacityHours: 20 },
  tutorial: { chapters: { meet: "done" } },
  ui: { tab: "targets" },
});
assert.equal(partial.user.weeklyCapacityHours, 20, "preserves a valid saved value");
assert.equal(partial.user.nightsPerWeek, 4, "restores a missing nested user default");
assert.equal(partial.tutorial.chapters.meet, "done", "preserves a completed chapter");
assert.equal(partial.tutorial.chapters.capacity, "pending", "restores missing chapters");
assert.equal(partial.tutorial.permissions.usage, false, "restores missing permissions");
assert.equal(partial.ui.tab, "targets", "preserves a valid tab");
assert.equal(partial.ui.tutorialOpen, true, "restores missing UI state");

const malformed = hydrateState({
  version: "one",
  user: { weeklyCapacityHours: Number.NaN, nightsPerWeek: 99, displayName: false },
  targets: [null, { id: "target", title: "Valid container" }],
  commitments: "not-an-array",
  tutorial: {
    chapters: { meet: "complete" },
    permissions: { usage: "true", blockAdmin: true },
  },
  blockRules: [null, { id: "rule", appKeys: "firefox" }],
  usageSamples: [
    { app: "Editor", mins: 10, ts: "2026-08-09T00:00:00.000Z" },
    { app: "Broken", mins: 10, ts: null },
  ],
  audit: [null, { tool: "valid" }],
  ui: { tab: "unknown", tutorialOpen: "false" },
});
assert.equal(malformed.version, 1, "rejects an invalid version");
assert.equal(malformed.user.weeklyCapacityHours, 10, "rejects a non-finite capacity");
assert.equal(malformed.user.nightsPerWeek, 4, "rejects nights outside the supported range");
assert.equal(malformed.user.displayName, "", "rejects a non-string display name");
assert.deepEqual(malformed.targets[0].metrics, [], "restores the target metrics container");
assert.deepEqual(malformed.commitments, [], "rejects a malformed commitments container");
assert.equal(malformed.tutorial.chapters.meet, "pending", "rejects an unknown chapter status");
assert.equal(malformed.tutorial.permissions.usage, false, "does not coerce a permission string");
assert.equal(malformed.tutorial.permissions.blockAdmin, true, "preserves a real permission boolean");
assert.deepEqual(malformed.blockRules[0].appKeys, [], "restores the rule app-key container");
assert.equal(malformed.usageSamples.length, 1, "drops usage samples that cannot render safely");
assert.equal(malformed.audit.length, 1, "drops malformed audit entries");
assert.equal(malformed.ui.tab, "today", "rejects an unknown tab");
assert.equal(malformed.ui.tutorialOpen, true, "rejects a non-boolean modal state");

globalThis.localStorage = { getItem: () => "{not-json" };
assert.deepEqual(loadState(), defaultState(), "corrupt JSON falls back to a clean state");

globalThis.localStorage = {
  getItem: () => JSON.stringify({ tutorial: { chapters: { meet: "done" } } }),
};
const loaded = loadState();
assert.equal(loaded.tutorial.chapters.meet, "done", "loadState preserves partial saved data");
assert.equal(loaded.tutorial.permissions.usage, false, "loadState hydrates partial nested state");

console.log("test-store.mjs: ok");
