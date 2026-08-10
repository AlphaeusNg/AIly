/**
 * Usage helpers for AIly Phase 0 — local attention samples + session tracking.
 * Full OS hooks come later; this tracks honest in-app attention when granted.
 */

/**
 * @param {Array<{app: string, mins: number, ts: string}>} samples
 * @param {{ app: string, mins: number, ts?: string, mergeWindowMin?: number }} entry
 * @param {{ maxSamples?: number }} [opts]
 */
export function appendUsageSample(samples, entry, opts = {}) {
  const list = Array.isArray(samples) ? samples.slice() : [];
  const app = String(entry.app || "").trim().slice(0, 120);
  const mins = Number(entry.mins);
  if (!app || !Number.isFinite(mins) || mins <= 0) {
    return { samples: list, added: false, reason: "invalid_entry" };
  }
  const ts = typeof entry.ts === "string" && entry.ts ? entry.ts : new Date().toISOString();
  const mergeWindowMin = Number.isFinite(entry.mergeWindowMin) ? entry.mergeWindowMin : 15;
  const maxSamples = Number.isFinite(opts.maxSamples) ? opts.maxSamples : 200;

  // Merge into the latest same-app sample if within the window (keeps lists readable).
  if (list.length && mergeWindowMin > 0) {
    const top = list[0];
    if (
      top &&
      top.app === app &&
      typeof top.ts === "string" &&
      Number.isFinite(top.mins)
    ) {
      const topMs = Date.parse(top.ts);
      const nowMs = Date.parse(ts);
      if (Number.isFinite(topMs) && Number.isFinite(nowMs)) {
        const deltaMin = Math.abs(nowMs - topMs) / 60000;
        if (deltaMin <= mergeWindowMin) {
          list[0] = {
            ...top,
            mins: top.mins + mins,
            ts, // refresh timestamp to latest activity
          };
          return { samples: list.slice(0, maxSamples), added: true, merged: true };
        }
      }
    }
  }

  list.unshift({ app, mins, ts });
  return { samples: list.slice(0, maxSamples), added: true, merged: false };
}

/** Sum minutes for samples whose ts falls on the local calendar day YYYY-MM-DD. */
export function totalMinutesForDay(samples, dayISO) {
  if (!Array.isArray(samples) || typeof dayISO !== "string") return 0;
  return samples
    .filter((u) => u && typeof u.ts === "string" && u.ts.startsWith(dayISO))
    .reduce((a, u) => a + (Number.isFinite(u.mins) ? u.mins : 0), 0);
}

/**
 * Group samples for a day into { app, mins } sorted by mins desc.
 * @param {Array<{app: string, mins: number, ts: string}>} samples
 * @param {string} dayISO
 * @param {number} [limit]
 */
export function summarizeDayByApp(samples, dayISO, limit = 12) {
  const map = new Map();
  if (!Array.isArray(samples)) return [];
  for (const u of samples) {
    if (!u || typeof u.ts !== "string" || !u.ts.startsWith(dayISO)) continue;
    if (typeof u.app !== "string" || !Number.isFinite(u.mins) || u.mins <= 0) continue;
    map.set(u.app, (map.get(u.app) || 0) + u.mins);
  }
  return [...map.entries()]
    .map(([app, mins]) => ({ app, mins }))
    .sort((a, b) => b.mins - a.mins)
    .slice(0, limit);
}

/**
 * Visibility/focus session tracker. Pure clock via injectible now() for tests.
 * Flushes whole minutes of active (visible + focused) time.
 */
export function createSessionTracker(options = {}) {
  const appName = options.appName || "AIly";
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const onFlush = typeof options.onFlush === "function" ? options.onFlush : () => {};
  const minFlushMinutes = Number.isFinite(options.minFlushMinutes) ? options.minFlushMinutes : 1;

  let activeStart = null;
  let carryMs = 0;
  let running = false;

  function isActiveDocument(doc = globalThis.document) {
    if (!doc) return true;
    if (doc.visibilityState && doc.visibilityState !== "visible") return false;
    if (typeof doc.hasFocus === "function" && !doc.hasFocus()) return false;
    return true;
  }

  function pause() {
    if (activeStart == null) return;
    carryMs += Math.max(0, now() - activeStart);
    activeStart = null;
  }

  function resume() {
    if (!running) return;
    if (activeStart != null) return;
    if (!isActiveDocument()) return;
    activeStart = now();
  }

  function pendingMs() {
    let total = carryMs;
    if (activeStart != null) total += Math.max(0, now() - activeStart);
    return total;
  }

  function flush() {
    pause();
    const mins = Math.floor(carryMs / 60000);
    if (mins >= minFlushMinutes) {
      onFlush({ app: appName, mins, ts: new Date(now()).toISOString() });
      carryMs = carryMs % 60000;
      return mins;
    }
    return 0;
  }

  function start() {
    running = true;
    resume();
  }

  function stop() {
    flush();
    running = false;
    activeStart = null;
  }

  function onVisibilityOrFocus() {
    if (!running) return;
    if (isActiveDocument()) resume();
    else pause();
  }

  return {
    start,
    stop,
    flush,
    pause,
    resume,
    onVisibilityOrFocus,
    pendingMs,
    isRunning: () => running,
  };
}
