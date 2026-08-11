/**
 * Local-first persistence for AIly Phase 0 dogfood.
 * Mirrors aily-core concepts in JS until Tauri bridges Rust.
 */
const KEY = "aily.v1.state";
const CHAPTER_STATUSES = new Set(["pending", "done", "skipped"]);
const TABS = new Set(["today", "targets", "review", "usage", "blocks", "setup", "activity"]);
const COMMITMENT_STATUSES = new Set(["pending", "done", "dropped"]);
const MAX_QUARANTINED_COMMITMENTS = 100;
const MAX_USAGE_SAMPLES = 200;
const MAX_BLOCK_RULES = 50;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function finiteInRange(value, fallback, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function text(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validYmd(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function quarantineEntry(value, index, reasons) {
  const source = isRecord(value) ? value : {};
  return {
    id: text(source.id, 100) || `saved-item-${index + 1}`,
    text: text(source.text, 120) || `Saved commitment ${index + 1}`,
    reason: reasons.join("; "),
  };
}

function normalizeCommitment(value, index) {
  if (!isRecord(value)) {
    return {
      invalid: quarantineEntry(value, index, ["record must be an object"]),
    };
  }

  const reasons = [];
  const id = text(value.id, 200);
  const targetId = text(value.targetId, 200);
  const planDate = value.planDate;
  const description = text(value.text);
  const estimateMin = value.estimateMin;
  const mustKeep = value.mustKeep === undefined ? false : value.mustKeep;
  const priority = value.priority === undefined ? 0 : value.priority;
  const status = value.status === undefined ? "pending" : value.status;

  if (!id) reasons.push("ID must be a non-empty string");
  if (!targetId) reasons.push("target ID must be a non-empty string");
  if (!validYmd(planDate)) reasons.push("plan date must be a real calendar date");
  if (!description) reasons.push("description must be a non-empty string");
  if (!Number.isFinite(estimateMin) || estimateMin <= 0) {
    reasons.push("estimate must be a positive number");
  }
  if (typeof mustKeep !== "boolean") reasons.push("must-keep must be a boolean");
  if (!Number.isFinite(priority) || priority < 0) {
    reasons.push("priority must be a non-negative number");
  }
  if (!COMMITMENT_STATUSES.has(status)) reasons.push("status is not supported");

  if (reasons.length) return { invalid: quarantineEntry(value, index, reasons) };
  return {
    valid: {
      ...value,
      id,
      targetId,
      planDate,
      text: description,
      estimateMin,
      mustKeep,
      priority,
      status,
    },
  };
}

function hydrateCommitments(value) {
  if (value === undefined) return { commitments: [], invalid: [] };
  if (!Array.isArray(value)) {
    return {
      commitments: [],
      invalid: [
        quarantineEntry(null, 0, ["commitments container must be a list"]),
      ],
    };
  }
  const commitments = [];
  const invalid = [];
  value.forEach((commitment, index) => {
    const normalized = normalizeCommitment(commitment, index);
    if (normalized.valid) commitments.push(normalized.valid);
    else invalid.push(normalized.invalid);
  });
  return { commitments, invalid };
}

function hydrateQuarantine(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry, index) => ({
      id: text(entry.id, 100) || `quarantined-item-${index + 1}`,
      text: text(entry.text, 120) || `Quarantined commitment ${index + 1}`,
      reason: text(entry.reason, 500) || "saved commitment is invalid",
    }));
}

export function defaultState() {
  return {
    version: 1,
    user: {
      weeklyCapacityHours: 10,
      nightsPerWeek: 4,
      displayName: "",
    },
    targets: [],
    commitments: [], // { id, targetId, planDate, text, estimateMin, mustKeep, status, evidence, metricDelta, noImpactReason }
    tutorial: {
      chapters: {
        meet: "pending",
        first_target: "pending",
        capacity: "pending",
        attention: "pending",
        off_limits: "pending",
        ally_admin: "pending",
        stay_in_touch: "pending",
        smarter: "pending",
      },
      permissions: { usage: false, notifications: false, blockAdmin: false },
    },
    blockRules: [],
    usageSamples: [],
    audit: [],
    recovery: { invalidCommitments: [] },
    ui: {
      tab: "today",
      tutorialOpen: true,
      installBannerDismissed: false,
      intentionSkipUntil: 0,
      lastCheckInDate: "",
      checkInOpen: false,
      focusSessionEndsAt: 0,
      dailyIntention: "",
      density: "comfortable",
      reduceMotion: false,
      activityFilter: "",
    },
  };
}

/** Restore defaults and safe container shapes around persisted version-1 data. */
export function hydrateState(saved) {
  const defaults = defaultState();
  if (!isRecord(saved)) return defaults;

  const savedUser = isRecord(saved.user) ? saved.user : {};
  const savedTutorial = isRecord(saved.tutorial) ? saved.tutorial : {};
  const savedChapters = isRecord(savedTutorial.chapters) ? savedTutorial.chapters : {};
  const savedPermissions = isRecord(savedTutorial.permissions) ? savedTutorial.permissions : {};
  const savedUi = isRecord(saved.ui) ? saved.ui : {};
  const savedRecovery = isRecord(saved.recovery) ? saved.recovery : {};
  const hydratedCommitments = hydrateCommitments(saved.commitments);

  const chapters = { ...defaults.tutorial.chapters };
  for (const chapterId of Object.keys(chapters)) {
    if (CHAPTER_STATUSES.has(savedChapters[chapterId])) {
      chapters[chapterId] = savedChapters[chapterId];
    }
  }

  return {
    ...defaults,
    ...saved,
    version: Number.isInteger(saved.version) && saved.version > 0 ? saved.version : defaults.version,
    user: {
      ...defaults.user,
      ...savedUser,
      weeklyCapacityHours: finiteInRange(
        savedUser.weeklyCapacityHours,
        defaults.user.weeklyCapacityHours,
        0,
        168
      ),
      nightsPerWeek: finiteInRange(savedUser.nightsPerWeek, defaults.user.nightsPerWeek, 1, 7),
      displayName:
        typeof savedUser.displayName === "string" ? savedUser.displayName : defaults.user.displayName,
    },
    targets: records(saved.targets).map((target) => ({
      ...target,
      metrics: records(target.metrics),
    })),
    commitments: hydratedCommitments.commitments,
    tutorial: {
      ...defaults.tutorial,
      ...savedTutorial,
      chapters,
      permissions: {
        usage:
          typeof savedPermissions.usage === "boolean"
            ? savedPermissions.usage
            : defaults.tutorial.permissions.usage,
        notifications:
          typeof savedPermissions.notifications === "boolean"
            ? savedPermissions.notifications
            : defaults.tutorial.permissions.notifications,
        blockAdmin:
          typeof savedPermissions.blockAdmin === "boolean"
            ? savedPermissions.blockAdmin
            : defaults.tutorial.permissions.blockAdmin,
      },
    },
    blockRules: records(saved.blockRules)
      .map((rule) => ({
        ...rule,
        appKeys: Array.isArray(rule.appKeys)
          ? rule.appKeys.filter((appKey) => typeof appKey === "string")
          : [],
      }))
      .slice(0, MAX_BLOCK_RULES),
    usageSamples: records(saved.usageSamples)
      .filter(
        (sample) =>
          typeof sample.app === "string" &&
          Number.isFinite(sample.mins) &&
          typeof sample.ts === "string"
      )
      .slice(0, MAX_USAGE_SAMPLES),
    audit: records(saved.audit).slice(0, 200),
    recovery: {
      invalidCommitments: [
        ...hydrateQuarantine(savedRecovery.invalidCommitments),
        ...hydratedCommitments.invalid,
      ].slice(0, MAX_QUARANTINED_COMMITMENTS),
    },
    ui: {
      ...defaults.ui,
      ...savedUi,
      tab: TABS.has(savedUi.tab) ? savedUi.tab : defaults.ui.tab,
      tutorialOpen:
        typeof savedUi.tutorialOpen === "boolean"
          ? savedUi.tutorialOpen
          : defaults.ui.tutorialOpen,
      installBannerDismissed:
        typeof savedUi.installBannerDismissed === "boolean"
          ? savedUi.installBannerDismissed
          : defaults.ui.installBannerDismissed,
      intentionSkipUntil: Number.isFinite(savedUi.intentionSkipUntil)
        ? savedUi.intentionSkipUntil
        : defaults.ui.intentionSkipUntil,
      lastCheckInDate:
        typeof savedUi.lastCheckInDate === "string" && validYmd(savedUi.lastCheckInDate)
          ? savedUi.lastCheckInDate
          : defaults.ui.lastCheckInDate,
      checkInOpen:
        typeof savedUi.checkInOpen === "boolean"
          ? savedUi.checkInOpen
          : defaults.ui.checkInOpen,
      focusSessionEndsAt: Number.isFinite(savedUi.focusSessionEndsAt)
        ? savedUi.focusSessionEndsAt
        : defaults.ui.focusSessionEndsAt,
      dailyIntention: text(savedUi.dailyIntention, 280),
      density: savedUi.density === "compact" ? "compact" : defaults.ui.density,
      reduceMotion: typeof savedUi.reduceMotion === "boolean" ? savedUi.reduceMotion : false,
      activityFilter: text(savedUi.activityFilter, 80),
    },
  };
}

export function discardInvalidCommitments(state) {
  if (!isRecord(state.recovery)) state.recovery = { invalidCommitments: [] };
  const count = Array.isArray(state.recovery.invalidCommitments)
    ? state.recovery.invalidCommitments.length
    : 0;
  state.recovery.invalidCommitments = [];
  return count;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return hydrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

/**
 * Persist state. Never throws — quota / privacy mode / disabled storage
 * return { ok: false } so the UI can keep working and surface a toast.
 */
export function saveState(state) {
  try {
    const payload = JSON.stringify(state);
    localStorage.setItem(KEY, payload);
    // Round-trip check catches some private-mode shims that swallow setItem.
    const roundTrip = localStorage.getItem(KEY);
    if (roundTrip !== payload) {
      return {
        ok: false,
        error: "verify_failed",
        message: "Saved data could not be verified in local storage",
      };
    }
    return { ok: true };
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "SaveError";
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Could not save to local storage";
    return { ok: false, error: name || "SaveError", message: message || "Could not save" };
  }
}

export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older WebViews / Node test shims without randomUUID.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function appendAudit(state, tool, detail) {
  state.audit.unshift({
    id: uid(),
    tool,
    detail,
    ts: new Date().toISOString(),
  });
  state.audit = state.audit.slice(0, 200);
}

/** Drop dropped/done commitments older than `keepDays` (default 45). */
export function pruneOldCommitments(state, keepDays = 45, today = "") {
  if (!isRecord(state) || !Array.isArray(state.commitments)) return 0;
  const day = typeof today === "string" && validYmd(today) ? today : null;
  if (!day) return 0;
  const cutoff = previousCalendarDay(day, keepDays);
  const before = state.commitments.length;
  state.commitments = state.commitments.filter((c) => {
    if (!isRecord(c) || typeof c.planDate !== "string") return false;
    if (c.planDate >= cutoff) return true;
    // Keep open pending forever (user may still need them).
    return c.status === "pending";
  });
  return before - state.commitments.length;
}

/** Prune old usage samples by calendar day (keeps last keepDays). */
export function pruneOldUsageSamples(state, keepDays = 45, today = "") {
  if (!isRecord(state) || !Array.isArray(state.usageSamples)) return 0;
  const day = typeof today === "string" && validYmd(today) ? today : null;
  if (!day) return 0;
  const cutoff = previousCalendarDay(day, keepDays);
  const before = state.usageSamples.length;
  state.usageSamples = state.usageSamples.filter((u) => {
    if (!isRecord(u) || typeof u.ts !== "string") return false;
    return u.ts.slice(0, 10) >= cutoff;
  });
  return before - state.usageSamples.length;
}

function previousCalendarDay(ymd, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() - Math.max(0, days));
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`;
}

/** Portable backup JSON for export / import (local-only). */
export function exportState(state) {
  return JSON.stringify(
    {
      format: "aily.backup.v1",
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2
  );
}

/**
 * Parse and hydrate a backup payload. Returns { ok, state } or { ok: false, error }.
 */
export function importState(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isRecord(parsed)) {
      return { ok: false, error: "Backup must be a JSON object" };
    }
    const body = isRecord(parsed.state) ? parsed.state : parsed;
    if (parsed.format && parsed.format !== "aily.backup.v1" && !isRecord(parsed.state)) {
      // Allow raw state dumps without format wrapper for power users.
      if (!("version" in parsed) && !("targets" in parsed) && !("user" in parsed)) {
        return { ok: false, error: "Unrecognized backup format" };
      }
    }
    return { ok: true, state: hydrateState(body) };
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Invalid JSON backup";
    return { ok: false, error: message };
  }
}
