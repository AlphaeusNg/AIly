/** Node tests for persisted web-state hydration (no browser required). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkPlanAccept } from "../apps/web/js/capacity.js";
import {
  defaultState,
  discardInvalidCommitments,
  exportState,
  hydrateState,
  importState,
  loadState,
  saveState,
} from "../apps/web/js/store.js";

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
assert.equal(malformed.recovery.invalidCommitments.length, 1, "quarantines a malformed container");
assert.match(
  malformed.recovery.invalidCommitments[0].reason,
  /container must be a list/,
  "explains why the commitments container was quarantined"
);
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

const recovered = hydrateState({
  commitments: [
    {
      id: "valid",
      targetId: "target",
      planDate: "2026-08-10",
      text: "Keep the valid work",
      estimateMin: 30,
    },
    {
      id: "negative",
      targetId: "target",
      planDate: "2026-08-10",
      text: "Negative estimate",
      estimateMin: -15,
    },
    {
      id: "bad-date",
      targetId: "target",
      planDate: "2026-02-30",
      text: "Impossible date",
      estimateMin: 30,
    },
    { targetId: "target", planDate: "2026-08-10", text: "Missing id", estimateMin: 30 },
    "not-an-object",
  ],
});
assert.equal(recovered.commitments.length, 1, "keeps only renderable commitments active");
assert.equal(recovered.commitments[0].mustKeep, false, "defaults an older missing must-keep flag");
assert.equal(recovered.commitments[0].priority, 0, "defaults an older missing priority");
assert.equal(recovered.commitments[0].status, "pending", "defaults an older missing status");
assert.equal(recovered.recovery.invalidCommitments.length, 4, "quarantines every invalid record");
assert.match(
  recovered.recovery.invalidCommitments.map((entry) => entry.reason).join("; "),
  /estimate.*date.*ID.*object/i,
  "quarantine reasons identify each invalid boundary"
);
const capacity = checkPlanAccept({
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  softCaps: [],
  weekOther: [],
  today: recovered.commitments,
});
assert.equal(capacity.ok, true, "quarantined records cannot poison capacity checks");

const rehydrated = hydrateState(recovered);
assert.equal(
  rehydrated.recovery.invalidCommitments.length,
  4,
  "rehydrating an already repaired state does not duplicate quarantine entries"
);
assert.equal(discardInvalidCommitments(rehydrated), 4, "discard reports the removed quarantine count");
assert.deepEqual(rehydrated.recovery.invalidCommitments, [], "discard clears quarantined records");
assert.equal(rehydrated.commitments.length, 1, "discard preserves valid commitments");

const appSource = readFileSync(new URL("../apps/web/js/app.js", import.meta.url), "utf8");
assert.match(appSource, /data-action="discard-invalid-commitments"/, "Today exposes recovery");
assert.match(appSource, /confirm\(/, "discard requires explicit confirmation");
assert.match(appSource, /discardInvalidCommitments\(state\)/, "UI uses the tested discard action");
assert.match(appSource, /dismissBootSplash/, "boot splash is dismissed after first render");
assert.match(appSource, /shouldAskIntention|intention-confirm/, "intentional commitment gate exists");
assert.match(appSource, /Time consciousness/, "Today surfaces time consciousness");

// saveState must never throw and must report ok/failure for the UI toast path.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};
const saved = saveState(defaultState());
assert.equal(saved.ok, true, "saveState succeeds with working storage");
assert.equal(typeof saved.ok, "boolean", "saveState returns a boolean ok flag");

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {
    const err = new Error("QuotaExceededError");
    err.name = "QuotaExceededError";
    throw err;
  },
};
const failed = saveState(defaultState());
assert.equal(failed.ok, false, "saveState fails closed on quota errors");
assert.equal(failed.error, "QuotaExceededError", "saveState surfaces the storage error name");
assert.match(String(failed.message || ""), /./, "saveState includes a message for toasts");

globalThis.localStorage = {
  getItem: () => "stale",
  setItem: () => {},
};
const verifyFail = saveState(defaultState());
assert.equal(verifyFail.ok, false, "saveState fails when round-trip verification mismatches");
assert.equal(verifyFail.error, "verify_failed", "round-trip failure is labeled");

const html = readFileSync(new URL("../apps/web/index.html", import.meta.url), "utf8");
assert.match(html, /id="boot-splash"/, "index includes boot splash");
assert.match(html, /assets\/logo\.svg/, "index references logo asset");
assert.match(html, /id="intention-modal"/, "index includes intention modal");
assert.match(html, /id="install-banner"/, "index includes install banner");

const sw = readFileSync(new URL("../apps/web/sw.js", import.meta.url), "utf8");
assert.match(sw, /assets\/logo\.svg/, "service worker caches logo");
assert.match(sw, /aily-2026\.08\.10/, "service worker cache id is bumped for this ship");

assert.equal(
  defaultState().ui.installBannerDismissed,
  false,
  "default UI tracks install banner dismissal"
);

const backupRaw = exportState(
  hydrateState({
    user: { weeklyCapacityHours: 12, displayName: "Alphaeus" },
    targets: [{ id: "t1", title: "Ship", metrics: [] }],
  })
);
assert.match(backupRaw, /aily\.backup\.v1/, "export uses stable backup format");
const imported = importState(backupRaw);
assert.equal(imported.ok, true, "import accepts a valid backup");
assert.equal(imported.state.user.weeklyCapacityHours, 12, "import restores capacity");
assert.equal(imported.state.user.displayName, "Alphaeus", "import restores display name");
assert.equal(imported.state.targets[0].title, "Ship", "import restores targets");
assert.equal(importState("{not-json").ok, false, "import rejects corrupt JSON");
assert.equal(importState("{}").ok, true, "import hydrates an empty object to defaults");
assert.match(appSource, /export-backup/, "Setup exposes export backup");
assert.match(appSource, /importState/, "UI uses tested import helper");

console.log("test-store.mjs: hydration, recovery, persist, backup, and shell assertions passed");
