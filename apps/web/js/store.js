/**
 * Local-first persistence for AIly Phase 0 dogfood.
 * Mirrors aily-core concepts in JS until Tauri bridges Rust.
 */
const KEY = "aily.v1.state";

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
    audit: [],
    ui: { tab: "today", tutorialOpen: true },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
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
