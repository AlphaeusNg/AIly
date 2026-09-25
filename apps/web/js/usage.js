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
  const source = usageSource(entry.source);
  const visitId = source === "web-session" && typeof entry.visitId === "string" ? entry.visitId : "";

  // Merge into the latest same-app sample if within the window (keeps lists readable).
  if (list.length && mergeWindowMin > 0) {
    const top = list[0];
    if (
      top &&
      top.app === app &&
      (typeof top.source === "string" ? top.source : "") === source &&
      (top.visitId || "") === visitId &&
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

  const row = { app, mins, ts };
  if (source) row.source = source;
  if (visitId) row.visitId = visitId;
  list.unshift(row);
  return { samples: list.slice(0, maxSamples), added: true, merged: false };
}

const MEASURED_SOURCES = new Set([
  "web-session",
  "android-usagestats",
  "windows-foreground-session",
]);

function usageSource(value) {
  const source = typeof value === "string" ? value.trim() : "";
  return MEASURED_SOURCES.has(source) ? source : "";
}

/**
 * What a usage total is allowed to mean.
 * Unsupported installations never produce a measured window.
 */
export function measurementWindow(backend) {
  if (!backend || backend.available === false) return unsupportedWindow();
  if (backend.id === "web-session") {
    return {
      id: "browser-visit",
      label: "browser visit",
      source: "web-session",
      measured: true,
      resets: "Resets when this page loads again.",
      gaps: "Hidden, unfocused, or closed time is a gap. Other apps and devices are not included.",
    };
  }
  if (backend.id === "windows-foreground-session") {
    return {
      id: "windows-session",
      label: "installed Windows session",
      source: "windows-foreground-session",
      measured: true,
      resets: "Resets at local midnight, on revoke, and when AIly restarts.",
      gaps: "Only foreground process names while this installed app is open and tracking. Not a full day and not other devices.",
    };
  }
  if (backend.id === "android-usagestats") {
    return {
      id: "android-day",
      label: "Android day",
      source: "android-usagestats",
      measured: true,
      resets: "Resets at local midnight.",
      gaps: "Read on demand for this phone’s current day after consent. No background collector. Other devices are not included.",
    };
  }
  return unsupportedWindow();
}

function unsupportedWindow() {
  return {
    id: "unsupported",
    label: "not measured",
    source: "",
    measured: false,
    resets: "There is no measurement window on this installation.",
    gaps: "Unsupported totals are not measured usage.",
  };
}

function minutesOnDay(samples, day, source, visitId) {
  if (!Array.isArray(samples) || typeof day !== "string") return 0;
  return samples.reduce((total, sample) => {
    if (!sample || sample.source !== source) return total;
    if (source === "web-session" && visitId !== undefined && sample.visitId !== visitId) return total;
    if (typeof sample.ts !== "string" || !sample.ts.startsWith(day)) return total;
    return total + (Number.isFinite(sample.mins) ? sample.mins : 0);
  }, 0);
}

/**
 * Measured minutes for the active window, or null when nothing was measured.
 * A null total must not be rendered as 0m of device usage.
 */
export function presentUsageTotal({
  backend,
  permission,
  status,
  platformSamples,
  manualSamples,
  day,
  visitId,
} = {}) {
  const window = measurementWindow(backend);
  const native = !!(backend && backend.id && backend.id !== "web-session");
  const blockedStatus = native
    && ["unsupported", "denied", "revoked", "error", "waiting", "checking"].includes(status);
  const measured = window.measured && permission === "granted" && !blockedStatus;
  const minutes = measured
    ? minutesOnDay(platformSamples, day, window.source, visitId) + minutesOnDay(manualSamples, day, window.source, visitId)
    : null;
  const manualMinutes = (Array.isArray(manualSamples) ? manualSamples : []).reduce((total, sample) => {
    if (!sample || sample.source) return total;
    if (day && (typeof sample.ts !== "string" || !sample.ts.startsWith(day))) return total;
    return total + (Number.isFinite(sample.mins) ? sample.mins : 0);
  }, 0);
  return {
    measured,
    minutes,
    manualMinutes,
    source: measured ? window.source : "",
    windowId: measured ? window.id : "unsupported",
    windowLabel: measured ? window.label : "not measured",
    explanation: measured
      ? `${window.resets} ${window.gaps}`
      : "Not measured. Denied, revoked, or unsupported access is not a device total.",
  };
}

/**
 * Remove a sample by index (newest-first list as stored).
 * @returns {{ samples: Array, removed: boolean }}
 */
export function removeUsageSampleAt(samples, index) {
  const list = Array.isArray(samples) ? samples.slice() : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return { samples: list, removed: false };
  }
  list.splice(index, 1);
  return { samples: list, removed: true };
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
