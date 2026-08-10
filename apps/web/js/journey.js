/**
 * Journey / week honesty helpers (pure).
 */

/**
 * Monday-start ISO date for the week containing `from`.
 * @param {Date} [from]
 * @returns {string} YYYY-MM-DD
 */
export function weekStartISO(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/**
 * @param {{
 *   commitments?: Array,
 *   usageSamples?: Array,
 *   audit?: Array,
 *   now?: Date,
 * }} state
 */
export function weekJourneyStats(state = {}) {
  const now = state.now instanceof Date ? state.now : new Date();
  const start = weekStartISO(now);
  const commits = (state.commitments || []).filter(
    (c) => c && typeof c.planDate === "string" && c.planDate >= start && c.status !== "dropped"
  );
  const done = commits.filter((c) => c.status === "done");
  const plannedMin = commits.reduce(
    (a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
    0
  );
  const doneMin = done.reduce(
    (a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
    0
  );
  const usageMin = (state.usageSamples || [])
    .filter((u) => u && typeof u.ts === "string" && u.ts.slice(0, 10) >= start)
    .reduce((a, u) => a + (Number.isFinite(u.mins) ? u.mins : 0), 0);
  const glass = (state.audit || []).filter(
    (a) =>
      a &&
      a.tool === "block.break_glass" &&
      typeof a.ts === "string" &&
      a.ts.slice(0, 10) >= start
  ).length;
  const doneRatio = plannedMin > 0 ? doneMin / plannedMin : 0;
  return {
    start,
    plannedMin,
    doneMin,
    usageMin,
    doneCount: done.length,
    openCount: commits.length - done.length,
    glass,
    doneRatio,
  };
}

/**
 * Consecutive calendar days ending today where lastCheckInDate is set and
 * matches a chain of days with saved intentions (via audit checkin.save).
 * Falls back to 1 if today was checked in, else 0.
 */
export function intentionStreak(state = {}, today = "") {
  if (!today || typeof today !== "string") return 0;
  const last = state?.ui?.lastCheckInDate;
  if (last !== today) return 0;

  const daysWithSave = new Set(
    (state.audit || [])
      .filter((a) => a && a.tool === "checkin.save" && typeof a.ts === "string")
      .map((a) => a.ts.slice(0, 10))
  );
  // Always count today if lastCheckInDate matches (skip still sets the date).
  daysWithSave.add(today);

  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 60; i += 1) {
    if (!daysWithSave.has(cursor) && cursor !== today) break;
    if (!daysWithSave.has(cursor)) break;
    streak += 1;
    cursor = previousDayISO(cursor);
  }
  return streak;
}

export function previousDayISO(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() - 1);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`;
}

/**
 * Suggest a gentle ally reflection string from week stats.
 */
export function weekReflection(stats) {
  if (!stats) return "No journey data yet this week.";
  if (stats.plannedMin === 0) {
    return "No planned commitments this week yet — start small on Today.";
  }
  if (stats.doneRatio >= 0.8) {
    return "Strong follow-through this week. Protect recovery so it stays sustainable.";
  }
  if (stats.doneRatio >= 0.4) {
    return "Some progress landed. Notice what got done — and what kept slipping.";
  }
  if (stats.glass > 3) {
    return "Several break-glass unlocks. Rules may be too tight or intention unclear — adjust without shame.";
  }
  return "Plans outpaced completion. Consider fewer, must-keep blocks and an honest replan.";
}
