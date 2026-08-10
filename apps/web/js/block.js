/**
 * Block / break-glass helpers (UI enforcement dogfood until OS hooks ship).
 */

export function breakGlassPolicy(rule) {
  const bg = rule && typeof rule === "object" ? rule.breakGlass : null;
  const delaySec =
    bg && Number.isFinite(bg.delaySec) && bg.delaySec >= 0 ? Math.floor(bg.delaySec) : 30;
  const requireReason = !bg || bg.requireReason !== false;
  const dailyLimit =
    bg && bg.dailyLimit != null && Number.isFinite(bg.dailyLimit) ? bg.dailyLimit : null;
  return { delaySec, requireReason, dailyLimit };
}

/** True when enough wall time has elapsed since break-glass started. */
export function breakGlassReady(startedAtMs, delaySec, nowMs = Date.now()) {
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return false;
  const delay = Number.isFinite(delaySec) && delaySec >= 0 ? delaySec : 30;
  return nowMs - startedAtMs >= delay * 1000;
}

/** Seconds remaining until unlock (0 when ready). */
export function breakGlassRemainingSec(startedAtMs, delaySec, nowMs = Date.now()) {
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return delaySec || 0;
  const delay = Number.isFinite(delaySec) && delaySec >= 0 ? delaySec : 30;
  const left = Math.ceil((startedAtMs + delay * 1000 - nowMs) / 1000);
  return left > 0 ? left : 0;
}

/**
 * Count break-glass audit events for a local calendar day.
 * @param {Array<{tool: string, ts: string}>} audit
 * @param {string} dayISO
 */
export function breakGlassUsesToday(audit, dayISO) {
  if (!Array.isArray(audit) || typeof dayISO !== "string") return 0;
  return audit.filter(
    (a) =>
      a &&
      a.tool === "block.break_glass" &&
      typeof a.ts === "string" &&
      a.ts.startsWith(dayISO)
  ).length;
}

/**
 * Validate completing break-glass. Fail closed on missing readiness or reason.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateBreakGlassComplete({
  startedAtMs,
  delaySec,
  requireReason,
  reason,
  nowMs = Date.now(),
  usesToday = 0,
  dailyLimit = null,
}) {
  if (!breakGlassReady(startedAtMs, delaySec, nowMs)) {
    return {
      ok: false,
      error: `Wait ${breakGlassRemainingSec(startedAtMs, delaySec, nowMs)}s before unlocking`,
    };
  }
  if (dailyLimit != null && Number.isFinite(dailyLimit) && usesToday >= dailyLimit) {
    return { ok: false, error: `Daily break-glass limit reached (${dailyLimit})` };
  }
  const text = typeof reason === "string" ? reason.trim() : "";
  if (requireReason && text.length < 2) {
    return { ok: false, error: "Add a short reason — no shame, just honesty" };
  }
  return { ok: true };
}

/** Simulate whether an app key is currently blocked by armed rules. */
export function isAppBlocked(rules, appKey) {
  if (!Array.isArray(rules) || typeof appKey !== "string") return null;
  const key = appKey.trim().toLowerCase();
  if (!key) return null;
  for (const rule of rules) {
    if (!rule || !rule.armed) continue;
    const keys = Array.isArray(rule.appKeys) ? rule.appKeys : [];
    if (keys.some((k) => String(k).toLowerCase() === key)) {
      return rule;
    }
  }
  return null;
}

/** Find any rule (armed or not) that already lists this app key. */
export function findRuleForApp(rules, appKey) {
  if (!Array.isArray(rules) || typeof appKey !== "string") return null;
  const key = appKey.trim().toLowerCase();
  if (!key) return null;
  for (const rule of rules) {
    if (!rule) continue;
    const keys = Array.isArray(rule.appKeys) ? rule.appKeys : [];
    if (keys.some((k) => String(k).toLowerCase() === key)) return rule;
  }
  return null;
}

/**
 * Add a rule or update an existing one with the same primary app key.
 * @returns {{ rules: Array, merged: boolean, rule: object }}
 */
export function upsertBlockRule(rules, draft) {
  const list = Array.isArray(rules) ? rules.slice() : [];
  const app = String(draft?.appKeys?.[0] || draft?.app || "")
    .trim()
    .slice(0, 80);
  if (!app) return { rules: list, merged: false, rule: null };

  const mode = draft.mode === "hard_block" || draft.mode === "hard" ? "hard_block" : "soft_delay";
  let delaySec = Number(draft.delaySec ?? draft.breakGlass?.delaySec);
  if (!Number.isFinite(delaySec) || delaySec < 0) delaySec = 30;
  delaySec = Math.min(600, Math.floor(delaySec));

  const existing = findRuleForApp(list, app);
  if (existing) {
    existing.mode = mode;
    existing.breakGlass = {
      ...(existing.breakGlass || {}),
      delaySec,
      requireReason: true,
      dailyLimit:
        existing.breakGlass?.dailyLimit != null ? existing.breakGlass.dailyLimit : 5,
    };
    // Ensure canonical appKeys entry is present
    if (!Array.isArray(existing.appKeys)) existing.appKeys = [app];
    else if (!existing.appKeys.some((k) => String(k).toLowerCase() === app.toLowerCase())) {
      existing.appKeys.push(app);
    }
    return { rules: list, merged: true, rule: existing };
  }

  const rule = {
    id: draft.id || `rule-${Date.now()}`,
    appKeys: [app],
    mode,
    armed: false,
    breakGlass: { delaySec, requireReason: true, dailyLimit: 5 },
  };
  list.push(rule);
  return { rules: list, merged: false, rule };
}

/** Format remaining focus time for tray/UI. */
export function formatFocusRemaining(endsAtMs, nowMs = Date.now()) {
  if (!Number.isFinite(endsAtMs) || endsAtMs <= nowMs) return null;
  const totalSec = Math.ceil((endsAtMs - nowMs) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 5) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
