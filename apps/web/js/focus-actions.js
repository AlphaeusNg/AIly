/** Focus actions load only when a session control is used. */
export function createFocusActions({ getState, canArmBlocks, appendAudit, persist, showToast }) {
  function startFocusMinutes(mins) {

    const state = getState();

    const m = Number(mins);

    if (!Number.isFinite(m) || m < 1) return;

    state.ui.focusPausedRemainingMs = 0;

    state.ui.focusSessionEndsAt = Date.now() + m * 60_000;

    let armed = 0;

    if (canArmBlocks(state)) {

      for (const r of state.blockRules || []) {

        if (!r.armed && (r.appKeys || []).length) {

          r.armed = true;

          armed += 1;

          appendAudit(state, "block.arm_focus", r.appKeys.join(","));

        }

      }

    }

    appendAudit(state, "focus.start", `${m}m`);

    persist();

    showToast(

      armed

        ? `Focus ${m}m · armed ${armed} rule${armed === 1 ? "" : "s"}.`

        : canArmBlocks(state)

          ? `Focus ${m}m started.`

          : `Focus ${m}m started (grants needed to auto-arm blocks).`,

      "ok",

      4000

    );

  }



  function pauseFocusSession() {

    const state = getState();

    const ends = state.ui.focusSessionEndsAt || 0;

    if (!ends || ends <= Date.now()) {

      showToast("No active focus to pause.", "error");

      return;

    }

    state.ui.focusPausedRemainingMs = Math.max(0, ends - Date.now());

    state.ui.focusSessionEndsAt = 0;

    appendAudit(state, "focus.pause", `${Math.ceil(state.ui.focusPausedRemainingMs / 60000)}m`);

    persist();

    showToast("Focus paused. Resume when ready.", "ok");

  }



  function resumeFocusSession() {

    const state = getState();

    const rem = state.ui.focusPausedRemainingMs || 0;

    if (rem <= 0) {

      showToast("No paused focus to resume.", "error");

      return;

    }

    state.ui.focusSessionEndsAt = Date.now() + rem;

    state.ui.focusPausedRemainingMs = 0;

    appendAudit(state, "focus.resume", `${Math.ceil(rem / 60000)}m`);

    persist();

    showToast("Focus resumed.", "ok");

  }
  return { startFocusMinutes, pauseFocusSession, resumeFocusSession };
}
