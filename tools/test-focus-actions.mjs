import assert from "node:assert/strict";
import { createFocusActions } from "../apps/web/js/focus-actions.js";
import { defaultState, hydrateState, exportState, importState } from "../apps/web/js/store.js";
import { canArmBlocks } from "../apps/web/js/tutorial.js";

assert.equal(defaultState().ui.customFocusMinutes, 25);
for (const customFocusMinutes of [undefined, null, "40", 0, -1, 181, 4.5, Infinity, {}, []]) {
  assert.equal(hydrateState({ ui: { customFocusMinutes } }).ui.customFocusMinutes, 25,
    "invalid saved durations fall back without coercion");
}
for (const customFocusMinutes of [1, 40, 180]) {
  const state = defaultState();
  state.ui.customFocusMinutes = customFocusMinutes;
  assert.equal(importState(exportState(state)).state.ui.customFocusMinutes, customFocusMinutes,
    "valid custom durations round-trip through the existing backup");
}
for (const usage of [false, true]) {
  for (const blockAdmin of [false, true]) {
    const state = defaultState();
    state.tutorial.permissions.usage = usage;
    state.tutorial.permissions.blockAdmin = blockAdmin;
    state.blockRules = [{ id: "rule", appKeys: ["distractor"], armed: false }];
    const audit = [];
    let persisted = 0;
    const actions = createFocusActions({
      getState: () => state, canArmBlocks,
      appendAudit: (_state, type, detail) => audit.push({ type, detail }),
      persist: () => persisted++, showToast: () => {},
    });
    const before = JSON.stringify(state);
    for (const minutes of [NaN, Infinity, 0, -1, 181, 10.5, ""]) {
      actions.startFocusMinutes(minutes, { rememberCustom: true });
      assert.equal(JSON.stringify(state), before, "invalid actions cannot mutate state");
    }
    assert.equal(persisted, 0);
    assert.equal(audit.length, 0);
    const now = Date.now();
    actions.startFocusMinutes(40, { rememberCustom: true });
    assert.equal(state.ui.customFocusMinutes, 40);
    assert.ok(state.ui.focusSessionEndsAt >= now + 40 * 60_000);
    assert.ok(state.ui.focusSessionEndsAt <= Date.now() + 40 * 60_000);
    assert.equal(state.blockRules[0].armed, usage && blockAdmin, "both existing grants are required");
    assert.deepEqual(state.tutorial.permissions, { ...defaultState().tutorial.permissions, usage, blockAdmin });
    assert.ok(audit.some((entry) => entry.type === "focus.start" && entry.detail === "40m"));
    actions.pauseFocusSession();
    assert.equal(state.ui.focusSessionEndsAt, 0);
    assert.ok(state.ui.focusPausedRemainingMs > 39 * 60_000);
    actions.resumeFocusSession();
    assert.equal(state.ui.focusPausedRemainingMs, 0);
    actions.startFocusMinutes(15);
    assert.equal(state.ui.customFocusMinutes, 40, "quick starts keep the custom preference");
    for (const minutes of [1, 180]) {
      actions.startFocusMinutes(minutes, { rememberCustom: true });
      assert.equal(state.ui.customFocusMinutes, minutes, "both duration boundaries work");
    }
  }
}
console.log("test-focus-actions.mjs: custom bounds, backup, audit, pause/resume, quick starts and all consent combinations passed");
