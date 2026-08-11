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

/** Next calendar day YYYY-MM-DD (UTC date arithmetic). */
export function nextDayISO(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + 1);
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

/**
 * Compare planned minutes vs logged attention for a gentle mismatch note.
 * @returns {string|null}
 */
/**
 * Detect near-duplicate commitments on the same plan day (honest planning aid).
 * @returns {{ duplicate: boolean, match?: object }}
 */
export function findSameDayDuplicate(commitments, { planDate, text, excludeId }) {
  if (!Array.isArray(commitments) || typeof text !== "string") {
    return { duplicate: false };
  }
  const norm = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm || typeof planDate !== "string") return { duplicate: false };
  for (const c of commitments) {
    if (!c || c.status === "dropped") continue;
    if (excludeId && c.id === excludeId) continue;
    if (c.planDate !== planDate) continue;
    const other = String(c.text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (other === norm) return { duplicate: true, match: c };
  }
  return { duplicate: false };
}

export function attentionMismatchNote(plannedMin, usageMin) {
  if (!Number.isFinite(plannedMin) || !Number.isFinite(usageMin)) return null;
  if (plannedMin < 30 || usageMin < 15) return null;
  if (usageMin > plannedMin * 1.5) {
    return "Logged attention is well above planned work — worth a honest pause.";
  }
  if (plannedMin > usageMin * 2 && usageMin >= 15) {
    return "Plan is much larger than logged attention — replan or protect a real focus block.";
  }
  return null;
}

/**
 * Pending commitments planned before `today` (still open from earlier days).
 * @param {Array} commitments
 * @param {string} today YYYY-MM-DD
 * @returns {Array}
 */
export function stalePendingCommitments(commitments, today) {
  if (!Array.isArray(commitments) || typeof today !== "string" || !today) return [];
  return commitments.filter(
    (c) =>
      c &&
      c.status === "pending" &&
      typeof c.planDate === "string" &&
      c.planDate < today
  );
}

/**
 * Plain-text day plan for copy/export (local-only honesty aid).
 * @param {{
 *   dayISO: string,
 *   intention?: string,
 *   note?: string,
 *   commitments?: Array,
 *   targets?: Array,
 * }} input
 * @returns {string}
 */
export function formatDayPlanText(input = {}) {
  const dayISO = typeof input.dayISO === "string" ? input.dayISO : "";
  const list = Array.isArray(input.commitments) ? input.commitments : [];
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const titleById = new Map(targets.map((t) => [t?.id, t?.title || "?"]));
  const lines = [`AIly plan ${dayISO || "(unknown day)"}`];
  const intention = typeof input.intention === "string" ? input.intention.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (intention) lines.push(`Intention: ${intention}`);
  if (note) lines.push(`Note: ${note}`);
  lines.push("");
  if (!list.length) {
    lines.push("(no commitments)");
  } else {
    for (const c of list) {
      if (!c || c.status === "dropped") continue;
      const title = titleById.get(c.targetId) || "?";
      const keep = c.mustKeep ? " (must-keep)" : "";
      const mins = Number.isFinite(c.estimateMin) ? c.estimateMin : 0;
      lines.push(`- [${c.status || "pending"}] ${mins}m${keep} ${c.text || ""} · ${title}`);
    }
  }
  const total = list
    .filter((c) => c && c.status !== "dropped")
    .reduce((a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0), 0);
  lines.push("", `Total planned: ${total}m`);
  return lines.join("\n");
}

/**
 * Plain-text week honesty summary for copy/export.
 * @param {{
 *   dayISO?: string,
 *   version?: string,
 *   intention?: string,
 *   note?: string,
 *   todayPlannedMin?: number,
 *   todayUsageMin?: number,
 *   week?: object,
 *   days?: Array,
 *   reflection?: string,
 * }} input
 */
export function formatWeekHonestyText(input = {}) {
  const dayISO = typeof input.dayISO === "string" ? input.dayISO : "";
  const version = typeof input.version === "string" ? input.version : "";
  const week = input.week || {};
  const days = Array.isArray(input.days) ? input.days : [];
  const lines = [
    `AIly${version ? ` ${version}` : ""} · local summary ${dayISO || ""}`.trim(),
  ];
  const intention = typeof input.intention === "string" ? input.intention.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  lines.push(intention ? `Intention: ${intention}` : "Intention: (none)");
  if (note) lines.push(`Note: ${note}`);
  if (Number.isFinite(input.todayPlannedMin) || Number.isFinite(input.todayUsageMin)) {
    lines.push(
      `Today planned: ${Number.isFinite(input.todayPlannedMin) ? input.todayPlannedMin : 0}m · usage samples: ${
        Number.isFinite(input.todayUsageMin) ? input.todayUsageMin : 0
      }m`
    );
  }
  lines.push(
    `Week from ${week.start || "?"}: planned ${week.plannedMin|0}m · done ${week.doneMin|0}m · usage ${week.usageMin|0}m · glass ${week.glass|0}`
  );
  const reflection =
    typeof input.reflection === "string" && input.reflection
      ? input.reflection
      : weekReflection(week);
  if (reflection) lines.push(reflection);
  if (days.length) {
    lines.push("", "By day:");
    for (const day of days) {
      if (!day) continue;
      const mark = day.date === dayISO ? " (today)" : "";
      lines.push(
        `${day.date || "?"}${mark}: plan ${day.plannedMin|0}m · done ${day.doneMin|0}m · open ${day.openCount|0}`
      );
    }
  }
  lines.push("", "Data stays on this device.");
  return lines.join("\n");
}

/**
 * Drop audit rows older than keepDays (by ts date prefix).
 * @returns {{ audit: Array, removed: number }}
 */
export function pruneAuditEntries(audit, keepDays = 45, today = "") {
  const list = Array.isArray(audit) ? audit.slice() : [];
  if (!today || !Number.isFinite(keepDays) || keepDays < 1) {
    return { audit: list, removed: 0 };
  }
  let cutoff = today;
  for (let i = 0; i < keepDays; i += 1) cutoff = previousDayISO(cutoff);
  const next = list.filter((a) => {
    if (!a || typeof a.ts !== "string" || a.ts.length < 10) return true;
    return a.ts.slice(0, 10) >= cutoff;
  });
  return { audit: next, removed: list.length - next.length };
}

/**
 * Per-day planned/done totals for the week containing `now` (Mon–Sun).
 * @returns {{ start: string, days: Array<{ date: string, plannedMin: number, doneMin: number, openCount: number, doneCount: number }> }}
 */
export function weekDayBreakdown(state = {}) {
  const now = state.now instanceof Date ? state.now : new Date();
  const start = weekStartISO(now);
  const days = [];
  let cursor = start;
  for (let i = 0; i < 7; i += 1) {
    const commits = (state.commitments || []).filter(
      (c) => c && c.planDate === cursor && c.status !== "dropped"
    );
    const done = commits.filter((c) => c.status === "done");
    const open = commits.filter((c) => c.status === "pending");
    const plannedMin = commits.reduce(
      (a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
      0
    );
    const doneMin = done.reduce(
      (a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
      0
    );
    days.push({
      date: cursor,
      plannedMin,
      doneMin,
      openCount: open.length,
      doneCount: done.length,
    });
    cursor = nextDayISO(cursor);
  }
  return { start, days };
}
