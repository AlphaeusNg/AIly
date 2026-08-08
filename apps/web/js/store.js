/**
 * Local-first persistence for AIly Phase 0 dogfood.
 * Mirrors aily-core concepts in JS until Tauri bridges Rust.
 */
const KEY = "aily.v1.state";
const CHAPTER_STATUSES = new Set(["pending", "done", "skipped"]);
const TABS = new Set(["today", "targets", "review", "usage", "blocks", "setup", "activity"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function finiteInRange(value, fallback, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
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
    ui: { tab: "today", tutorialOpen: true },
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
    commitments: records(saved.commitments),
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
    blockRules: records(saved.blockRules).map((rule) => ({
      ...rule,
      appKeys: Array.isArray(rule.appKeys)
        ? rule.appKeys.filter((appKey) => typeof appKey === "string")
        : [],
    })),
    usageSamples: records(saved.usageSamples).filter(
      (sample) =>
        typeof sample.app === "string" &&
        Number.isFinite(sample.mins) &&
        typeof sample.ts === "string"
    ),
    audit: records(saved.audit),
    ui: {
      ...defaults.ui,
      ...savedUi,
      tab: TABS.has(savedUi.tab) ? savedUi.tab : defaults.ui.tab,
      tutorialOpen:
        typeof savedUi.tutorialOpen === "boolean"
          ? savedUi.tutorialOpen
          : defaults.ui.tutorialOpen,
    },
  };
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

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function uid() {
  return crypto.randomUUID();
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
