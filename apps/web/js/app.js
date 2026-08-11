import { SITE_VERSION } from "./version.js";
import {
  loadState,
  saveState,
  uid,
  todayISO,
  appendAudit,
  defaultState,
  discardInvalidCommitments,
  exportState,
  importState,
  pruneOldCommitments,
  pruneOldUsageSamples,
} from "./store.js";
import {
  checkPlanAccept,
  replanToday,
  errorLabel,
  dailySoftCapMinutes,
  snapEstimateMin,
} from "./capacity.js";
import { CHAPTERS, canArmBlocks, isReady, chapterStatus } from "./tutorial.js";
import {
  appendUsageSample,
  createSessionTracker,
  summarizeDayByApp,
  totalMinutesForDay,
} from "./usage.js";
import {
  breakGlassPolicy,
  breakGlassRemainingSec,
  breakGlassUsesToday,
  formatFocusRemaining,
  isAppBlocked,
  upsertBlockRule,
  validateBreakGlassComplete,
} from "./block.js";
import { proposeDayPlan, returnNudge } from "./ally.js";
import {
  attentionMismatchNote,
  findSameDayDuplicate,
  intentionStreak,
  weekJourneyStats,
  weekReflection,
} from "./journey.js";
import { selectUsageBackend, usageBackendHonesty } from "./platform-usage.js";

let state = loadState();
{
  const pruned = pruneOldCommitments(state, 45, todayISO());
  const prunedUsage = pruneOldUsageSamples(state, 45, todayISO());
  if (pruned > 0 || prunedUsage > 0) {
    appendAudit(
      state,
      "state.prune",
      `commitments:${pruned} usage:${prunedUsage}`
    );
    saveState(state);
  }
}
/** @type {{ ok: boolean, error?: string, message?: string } | null} */
let lastSave = null;
/** @type {null | { text: string, targetId: string, estimateMin: number, mustKeep: boolean }} */
let pendingIntention = null;
/** @type {null | { ruleId: string, startedAt: number, timer: number | null }} */
let pendingBreakGlass = null;
/** @type {null | { summary: string, proposals: Array }} */
let allyProposal = null;
/** @type {BeforeInstallPromptEvent | null} */
let deferredInstall = null;
/** @type {ServiceWorkerRegistration | null} */
let swRegistration = null;
let updateBannerDismissed = false;
let helpOpen = false;
const sessionStartedAt = Date.now();
let skipIntentionThisSession = false;
let usageTracker = null;
let lastHiddenAt = 0;
const usageBackend = selectUsageBackend();
/** @type {Array<{ type: string, payload: any }>} */
let undoStack = [];
const MAX_UNDO = 12;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function persist() {
  lastSave = saveState(state);
  render();
  if (lastSave && !lastSave.ok) {
    showToast(
      `Could not save locally (${lastSave.error || "error"}). Your latest change may be lost on refresh.`,
      "error",
      6000
    );
  }
  updateSaveStatus();
  return lastSave;
}

function updateSaveStatus() {
  const el = $("#save-status");
  if (!el) return;
  if (!lastSave) {
    el.hidden = true;
    return;
  }
  if (lastSave.ok) {
    el.hidden = true;
    el.textContent = "";
    el.className = "save-status is-ok";
    return;
  }
  el.hidden = false;
  el.className = "save-status is-error";
  el.textContent = "Save failed — storage full or blocked";
}

function pushUndo(entry) {
  undoStack.unshift(entry);
  undoStack = undoStack.slice(0, MAX_UNDO);
}

function undoLast() {
  const entry = undoStack.shift();
  if (!entry) {
    showToast("Nothing to undo.", "ok");
    return;
  }
  if (entry.type === "drop-commit") {
    const c = state.commitments.find((x) => x.id === entry.payload.id);
    if (c) {
      c.status = entry.payload.prevStatus || "pending";
      appendAudit(state, "undo.drop", c.text);
      persist();
      showToast("Restored dropped commitment.", "ok");
      return;
    }
  }
  if (entry.type === "hide-done") {
    for (const item of entry.payload || []) {
      const c = state.commitments.find((x) => x.id === item.id);
      if (c) c.status = item.prevStatus || "done";
    }
    appendAudit(state, "undo.hide_done", `${(entry.payload || []).length}`);
    persist();
    showToast("Restored completed items on Today.", "ok");
    return;
  }
  showToast("Could not undo that action.", "error");
}

function showToast(message, kind = "ok", ms = 3200) {
  const host = $("#toast-host");
  if (!host) return;
  // Cap concurrent toasts so spam actions don't flood the screen.
  while (host.children.length >= 3) {
    host.firstElementChild?.remove();
  }
  const el = document.createElement("div");
  el.className = `toast is-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("is-leaving");
    window.setTimeout(() => el.remove(), 280);
  }, ms);
}

function softCaps() {
  const active = state.targets.filter((t) => t.status === "active");
  return active
    .filter((t) => t.softCapacityHours != null)
    .map((t) => ({ targetId: t.id, hours: t.softCapacityHours }));
}

/** Soft-cap hours still free this week for a target (today + rough week view). */
function softCapRemainingHours(targetId) {
  const soft = softCaps().find((s) => s.targetId === targetId);
  if (!soft) return null;
  const usedMin = (state.commitments || [])
    .filter((c) => c.targetId === targetId && c.status !== "dropped")
    .reduce((a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0), 0);
  return Math.max(0, soft.hours - usedMin / 60);
}

function softCapOverTargets() {
  return softCaps()
    .map((s) => {
      const rem = softCapRemainingHours(s.targetId);
      const t = state.targets.find((x) => x.id === s.targetId);
      return { targetId: s.targetId, title: t?.title || s.targetId, remaining: rem, hours: s.hours };
    })
    .filter((x) => x.remaining != null && x.remaining <= 0);
}

/** Pending minutes on today for a target. */
function todayPendingMinForTarget(targetId) {
  return todayCommitments()
    .filter((c) => c.targetId === targetId && c.status === "pending")
    .reduce((a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0), 0);
}

function todayCommitments() {
  const d = todayISO();
  return state.commitments.filter((c) => c.planDate === d && c.status !== "dropped");
}

function dayUsageMinutes() {
  return totalMinutesForDay(state.usageSamples || [], todayISO());
}

function flushUsageSample(entry) {
  if (!state.tutorial.permissions.usage) return;
  const result = appendUsageSample(state.usageSamples || [], entry);
  if (!result.added) return;
  state.usageSamples = result.samples;
  appendAudit(
    state,
    result.merged ? "usage.merge" : "usage.session",
    `${entry.app} +${entry.mins}m`
  );
  // Quiet persist without full toast noise — still re-render if on Usage.
  lastSave = saveState(state);
  if (state.ui.tab === "usage" || state.ui.tab === "today") render();
  updateSaveStatus();
}

function syncUsageTracker() {
  const granted = !!state.tutorial.permissions.usage;
  if (granted && !usageTracker) {
    usageTracker = createSessionTracker({
      appName: "AIly",
      minFlushMinutes: 1,
      onFlush: flushUsageSample,
    });
    usageTracker.start();
  } else if (!granted && usageTracker) {
    usageTracker.stop();
    usageTracker = null;
  }
}

function startBreakGlass(ruleId) {
  const rule = state.blockRules.find((r) => r.id === ruleId);
  if (!rule?.armed) return;
  if (pendingBreakGlass?.timer) window.clearInterval(pendingBreakGlass.timer);
  pendingBreakGlass = {
    ruleId,
    startedAt: Date.now(),
    timer: window.setInterval(() => {
      renderBreakGlassModal();
    }, 250),
  };
  renderBreakGlassModal();
}

function cancelBreakGlass() {
  if (pendingBreakGlass?.timer) window.clearInterval(pendingBreakGlass.timer);
  pendingBreakGlass = null;
  renderBreakGlassModal();
}

function completeBreakGlass() {
  if (!pendingBreakGlass) return;
  const rule = state.blockRules.find((r) => r.id === pendingBreakGlass.ruleId);
  if (!rule) {
    cancelBreakGlass();
    return;
  }
  const policy = breakGlassPolicy(rule);
  const reason = $("#breakglass-reason")?.value || "";
  const check = validateBreakGlassComplete({
    startedAtMs: pendingBreakGlass.startedAt,
    delaySec: policy.delaySec,
    requireReason: policy.requireReason,
    reason,
    usesToday: breakGlassUsesToday(state.audit || [], todayISO()),
    dailyLimit: policy.dailyLimit,
  });
  if (!check.ok) {
    showToast(check.error, "error");
    return;
  }
  rule.armed = false;
  appendAudit(state, "block.break_glass", `${rule.appKeys.join(",")}: ${reason.trim()}`);
  cancelBreakGlass();
  persist();
  showToast("Unlocked. Your journey stays honest — reason logged.", "ok", 4000);
}

function renderBreakGlassModal() {
  const modal = $("#breakglass-modal");
  if (!modal) return;
  const show = !!pendingBreakGlass;
  modal.classList.toggle("hidden", !show);
  if (!show || !pendingBreakGlass) return;
  const rule = state.blockRules.find((r) => r.id === pendingBreakGlass.ruleId);
  if (!rule) {
    cancelBreakGlass();
    return;
  }
  const policy = breakGlassPolicy(rule);
  const left = breakGlassRemainingSec(pendingBreakGlass.startedAt, policy.delaySec);
  const ready = left === 0;
  $("#breakglass-body").textContent = `You set ${rule.appKeys.join(", ")} off-limits (${rule.mode}). Wait the delay, then unlock with a reason.`;
  const cd = $("#breakglass-countdown");
  if (cd) {
    cd.textContent = ready ? "Ready" : `${left}s`;
    cd.classList.toggle("is-ready", ready);
  }
  const btn = $("#breakglass-confirm");
  if (btn) btn.disabled = !ready;
}

function plannedMinutes() {
  return todayCommitments().reduce((a, c) => a + c.estimateMin, 0);
}

function sessionMinutes() {
  return Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000));
}

function allyTimeMessage(dailyCap, planned, usage) {
  const session = sessionMinutes();
  const parts = [];
  const name = (state.user.displayName || "").trim();
  if (name) {
    parts.push(`Hi <strong>${escapeHtml(name)}</strong>.`);
  }
  parts.push(
    `You've planned <strong>${planned|0}m</strong> of about <strong>${dailyCap|0}m</strong> soft capacity today.`
  );
  if (usage > 0) {
    parts.push(`Logged attention samples: <strong>${usage|0}m</strong>.`);
  }
  if (session >= 1) {
    parts.push(`This AIly session: <strong>${session}m</strong>.`);
  }
  parts.push("Pause a second — is this how you want to spend the next stretch?");
  return parts.join(" ");
}

function meterClass(ratio) {
  if (ratio > 1) return "is-over";
  if (ratio >= 0.85) return "is-warn";
  return "";
}

function dismissBootSplash() {
  const splash = $("#boot-splash");
  const shell = $("#app-shell");
  if (shell) {
    shell.hidden = false;
  }
  document.body.classList.remove("is-booting");
  document.body.classList.add("app-ready");
  if (!splash) return;
  // Minimum beat so the brand mark is felt, not a white flash.
  const minMs = 550;
  const started = performance.now();
  const finish = () => {
    const wait = Math.max(0, minMs - (performance.now() - started));
    window.setTimeout(() => {
      splash.classList.add("is-done");
      window.setTimeout(() => splash.remove(), 500);
    }, wait);
  };
  // Wait a frame so first paint of the app shell lands under the splash.
  requestAnimationFrame(() => requestAnimationFrame(finish));
}

function applyUiPrefs() {
  document.body.classList.toggle("density-compact", state.ui.density === "compact");
  document.body.classList.toggle("reduce-motion", !!state.ui.reduceMotion);
}

function render() {
  applyUiPrefs();
  $("#brand-version").textContent = SITE_VERSION.id;
  $("#tray-status").textContent = trayLabel();
  renderNetStatus();
  renderInstallBanner();
  renderNav();
  const tab = state.ui.tab;
  $$(".panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab));
  if (tab === "today") renderToday();
  if (tab === "targets") renderTargets();
  if (tab === "review") renderReview();
  if (tab === "usage") renderUsage();
  if (tab === "blocks") renderBlocks();
  if (tab === "setup") renderSetup();
  if (tab === "activity") renderActivity();
  renderTutorialModal();
  renderIntentionModal();
  renderBreakGlassModal();
  renderCheckInModal();
  renderHelpModal();
  syncUsageTracker();
  maybeOfferCheckIn();
  updateSaveStatus();
}

function renderHelpModal() {
  const modal = $("#help-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !helpOpen);
}

function maybeOfferCheckIn() {
  if (!isReady(state)) return;
  if (state.ui.tutorialOpen) return;
  if (state.ui.checkInOpen) return;
  const day = todayISO();
  if (state.ui.lastCheckInDate === day) return;
  // Defer a beat so boot splash / first paint settle.
  if (maybeOfferCheckIn._scheduled) return;
  maybeOfferCheckIn._scheduled = true;
  window.setTimeout(() => {
    maybeOfferCheckIn._scheduled = false;
    if (!isReady(state) || state.ui.tutorialOpen) return;
    if (state.ui.lastCheckInDate === todayISO()) return;
    state.ui.checkInOpen = true;
    renderCheckInModal();
  }, 700);
}

function renderCheckInModal() {
  const modal = $("#checkin-modal");
  if (!modal) return;
  const show = !!state.ui.checkInOpen;
  modal.classList.toggle("hidden", !show);
  if (!show) return;
  const input = $("#checkin-intention");
  if (input && !input.value && state.ui.dailyIntention) {
    input.value = state.ui.dailyIntention;
  }
}

function saveCheckIn() {
  const text = ($("#checkin-intention")?.value || "").trim().slice(0, 280);
  const focusMin = Number($("#checkin-focus-min")?.value) || 0;
  state.ui.dailyIntention = text;
  state.ui.lastCheckInDate = todayISO();
  state.ui.checkInOpen = false;
  if (focusMin > 0) {
    state.ui.focusSessionEndsAt = Date.now() + focusMin * 60_000;
    // Soft-arm all idle rules the user already created (still requires canArmBlocks).
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
    appendAudit(state, "focus.start", `${focusMin}m`);
    if (focusMin > 0 && !canArmBlocks(state)) {
      showToast("Focus timer started. Complete usage + admin grants to auto-arm blocks.", "ok", 4500);
    } else if (armed) {
      showToast(`Intention set · focus ${focusMin}m · armed ${armed} rule${armed === 1 ? "" : "s"}.`, "ok", 4500);
      persist();
      return;
    }
  }
  appendAudit(state, "checkin.save", text || "(empty)");
  persist();
  showToast(
    text
      ? `Intention set${focusMin ? ` · focus ${focusMin}m` : ""}.`
      : "Check-in noted. You can set an intention anytime from Today.",
    "ok",
    4000
  );
}

function skipCheckIn() {
  state.ui.lastCheckInDate = todayISO();
  state.ui.checkInOpen = false;
  appendAudit(state, "checkin.skip", todayISO());
  persist();
}

function focusRemainingMin() {
  const ends = state.ui.focusSessionEndsAt || 0;
  if (!ends || ends <= Date.now()) return 0;
  return Math.ceil((ends - Date.now()) / 60000);
}

function focusRemainingLabel() {
  return formatFocusRemaining(state.ui.focusSessionEndsAt || 0) || "";
}

function startFocusMinutes(mins) {
  const m = Number(mins);
  if (!Number.isFinite(m) || m < 1) return;
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

function endFocusSessionIfNeeded() {
  if (!state.ui.focusSessionEndsAt) return false;
  if (state.ui.focusSessionEndsAt > Date.now()) return false;
  state.ui.focusSessionEndsAt = 0;
  // Soft policy: disarm rules when the timed focus session ends.
  let disarmed = 0;
  for (const r of state.blockRules || []) {
    if (r.armed) {
      r.armed = false;
      disarmed += 1;
    }
  }
  appendAudit(state, "focus.end", disarmed ? `timer+disarm:${disarmed}` : "timer");
  return true;
}

function isMorningLocal() {
  const h = new Date().getHours();
  return h >= 5 && h < 11;
}

function trayLabel() {
  if (!isReady(state)) return "AIly · Setup";
  const focusLabel = focusRemainingLabel();
  if (focusLabel) {
    document.title = `Focus ${focusLabel} · AIly`;
    return `AIly · Focus ${focusLabel}`;
  }
  if (document.title.startsWith("Focus ")) {
    document.title = "AIly — Your AI Ally";
  }
  if (state.blockRules.some((r) => r.armed)) return "AIly · Focus";
  if (!navigator.onLine) return "AIly · Offline";
  const pending = pendingReviewCount();
  if (isEveningLocal() && pending > 0) return `AIly · Review ${pending}`;
  if (isMorningLocal() && isReady(state) && state.ui.lastCheckInDate !== todayISO()) {
    return "AIly · Intention?";
  }
  return "AIly · Ready";
}

function renderNetStatus() {
  const el = $("#net-status");
  if (!el) return;
  const online = navigator.onLine;
  el.textContent = online ? "Online" : "Offline";
  el.classList.toggle("is-offline", !online);
  el.title = online
    ? "Network available (data stays local)"
    : "Offline — cached shell; your data is still local";
}

function renderInstallBanner() {
  const banner = $("#install-banner");
  if (!banner) return;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true;
  const canPrompt = !!deferredInstall && !state.ui.installBannerDismissed && !standalone;
  banner.classList.toggle("hidden", !canPrompt);
  const update = $("#update-banner");
  if (update) {
    const waiting = !!(swRegistration && swRegistration.waiting && !updateBannerDismissed);
    update.classList.toggle("hidden", !waiting);
  }
}

function watchServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return;
    swRegistration = reg;
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          swRegistration = reg;
          updateBannerDismissed = false;
          renderInstallBanner();
          showToast("Update ready — reload when you can.", "ok", 4000);
        }
      });
    });
    if (reg.waiting && navigator.serviceWorker.controller) {
      renderInstallBanner();
    }
    // Periodic check while the app is open
    window.setInterval(() => {
      reg.update().catch(() => {});
    }, 30 * 60_000);
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // New SW took over after skipWaiting — soft reload if we asked for it.
    if (watchServiceWorkerUpdates._reloading) {
      window.location.reload();
    }
  });
}

function setNavCount(btn, n, show) {
  let pill = btn.querySelector(".nav-count");
  if (show && n > 0) {
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "nav-count";
      btn.appendChild(pill);
    }
    pill.textContent = String(n);
    pill.hidden = false;
  } else if (pill) {
    pill.hidden = true;
  }
}

function renderNav() {
  $$("[data-nav]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === state.ui.tab);
    if (btn.dataset.nav === "review") {
      setNavCount(btn, pendingReviewCount(), isEveningLocal());
    }
    if (btn.dataset.nav === "today") {
      const n = todayCommitments().filter((c) => c.status === "pending").length;
      setNavCount(btn, n, n > 0 && isReady(state));
    }
    if (btn.dataset.nav === "blocks") {
      const n = (state.blockRules || []).filter((r) => r.armed).length;
      setNavCount(btn, n, n > 0);
    }
  });
  const badge = $("#setup-badge");
  if (badge) badge.classList.toggle("hidden", isReady(state));
}

function seedDemoJourney(opts = {}) {
  const keepName = !!opts.keepName;
  const priorName = state.user?.displayName || "";
  usageTracker?.stop();
  usageTracker = null;
  if (pendingBreakGlass?.timer) window.clearInterval(pendingBreakGlass.timer);
  pendingBreakGlass = null;
  pendingIntention = null;
  allyProposal = null;
  undoStack = [];
  const t1 = uid();
  const t2 = uid();
  state = defaultState();
  state.user.displayName = keepName && priorName ? priorName : priorName || "Friend";
  state.user.weeklyCapacityHours = 12;
  state.user.nightsPerWeek = 5;
  state.tutorial.chapters = Object.fromEntries(
    CHAPTERS.map((c) => [c.id, c.required ? "done" : "skipped"])
  );
  state.tutorial.permissions = { usage: true, notifications: false, blockAdmin: true };
  state.ui.tutorialOpen = false;
  state.ui.lastCheckInDate = todayISO();
  state.ui.dailyIntention = "Protect deep work before noon";
  state.targets = [
    {
      id: t1,
      title: "Ship side project",
      status: "active",
      softCapacityHours: 7,
      metrics: [
        {
          name: "shippable pieces",
          unit: "items",
          baseline: 0,
          target: 8,
          current: 2,
          minMeaningfulDelta: 0.4,
        },
      ],
    },
    {
      id: t2,
      title: "Health & rest",
      status: "active",
      softCapacityHours: 5,
      metrics: [
        {
          name: "sessions",
          unit: "n",
          baseline: 0,
          target: 5,
          current: 1,
          minMeaningfulDelta: 0.25,
        },
      ],
    },
  ];
  state.commitments = [
    {
      id: uid(),
      targetId: t1,
      planDate: todayISO(),
      text: "Deep work on hard part",
      estimateMin: 50,
      mustKeep: true,
      priority: 0,
      status: "pending",
    },
    {
      id: uid(),
      targetId: t2,
      planDate: todayISO(),
      text: "Move body / break",
      estimateMin: 15,
      mustKeep: false,
      priority: 2,
      status: "pending",
    },
  ];
  state.blockRules = [
    {
      id: uid(),
      appKeys: ["youtube"],
      mode: "soft_delay",
      armed: false,
      breakGlass: { delaySec: 20, requireReason: true, dailyLimit: 5 },
    },
  ];
  state.usageSamples = [
    { app: "AIly", mins: 12, ts: new Date().toISOString() },
  ];
  appendAudit(state, "demo.seed", "sample journey");
  persist();
  syncUsageTracker();
  showToast("Sample journey loaded. Explore Today, propose, and blocks.", "ok", 4500);
}

function emptyTodayCta() {
  const hasTargets = state.targets.some((t) => t.status === "active");
  if (!hasTargets) {
    return `<div class="empty-hero">
      <img src="assets/logo.svg" width="56" height="56" alt="" />
      <h2>No plan yet</h2>
      <p class="muted">Create a target first — then AIly can help you protect time for it.</p>
      <button type="button" class="primary" data-action="goto-targets">Create a target</button>
    </div>`;
  }
  return `<li class='muted'>No commitments yet — add one above, clone yesterday, or ask AIly to propose.</li>`;
}

function renderToday() {
  const el = $("#panel-today");
  const cap = state.user.weeklyCapacityHours;
  const daily = dailySoftCapMinutes(cap, state.user.nightsPerWeek);
  const today = todayCommitments();
  const invalidCommitments = state.recovery?.invalidCommitments || [];
  const used = plannedMinutes();
  const usage = dayUsageMinutes();
  const ratio = daily > 0 ? used / daily : 0;
  const fillPct = Math.min(100, Math.round(ratio * 100));
  const check = checkPlanAccept({
    weeklyCapacityHours: cap,
    nightsPerWeek: state.user.nightsPerWeek,
    softCaps: softCaps(),
    weekOther: [],
    today: today.map((c) => ({
      id: c.id,
      targetId: c.targetId,
      estimateMin: c.estimateMin,
      mustKeep: c.mustKeep,
    })),
  });

  el.innerHTML = `
    <header class="panel-head">
      <h1>Today</h1>
      <p class="muted">Journey for ${todayISO()} · ${used|0}m / ${daily|0}m day soft cap · ${cap}h week</p>
    </header>
    <div class="capacity-card">
      <h2>Time consciousness</h2>
      <div class="capacity-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fillPct}" aria-label="Day plan fill">
        <div class="capacity-meter-fill ${meterClass(ratio)}" style="width:${fillPct}%"></div>
      </div>
      <p class="ally-line">${allyTimeMessage(daily, used, usage)}</p>
      ${
        (() => {
          const note = attentionMismatchNote(used, usage);
          return note ? `<p class="ally-line muted">${escapeHtml(note)}</p>` : "";
        })()
      }
      ${
        state.ui.dailyIntention
          ? `<p class="ally-line intention-chip">Today’s intention: <strong>${escapeHtml(state.ui.dailyIntention)}</strong>
             <button type="button" class="ghost" data-action="open-checkin">Edit</button></p>`
          : `<p class="ally-line"><button type="button" class="primary" data-action="open-checkin">Set today’s intention</button></p>`
      }
      ${
        focusRemainingLabel()
          ? `<p class="ally-line">Focus session: <strong>${focusRemainingLabel()}</strong> left.
             <button type="button" data-action="extend-focus-10">+10m</button>
             <button type="button" data-action="end-focus">End early</button></p>`
          : `<p class="ally-line row">
               <button type="button" data-action="start-focus-25">Focus 25m</button>
               <button type="button" class="primary" data-action="start-focus-50">Focus 50m</button>
             </p>`
      }
    </div>
    ${
      state.blockRules.some((r) => r.armed)
        ? `<div class="banner focus-armed">Focus rules armed — distractions you listed stay off-limits. <button type="button" data-action="goto-blocks">Manage blocks</button></div>`
        : ""
    }
    ${!isReady(state) ? `<div class="banner warn">Finish Setup so AIly can guide your full journey. <button type="button" data-action="open-tutorial">Continue tutorial</button></div>` : ""}
    ${invalidCommitments.length ? `<div class="banner warn">
      <strong>AIly quarantined ${invalidCommitments.length} invalid saved commitment${invalidCommitments.length === 1 ? "" : "s"}.</strong>
      They cannot block today’s plan. Recreate anything you still need, then remove these damaged records.
      <ul>${invalidCommitments.slice(0, 3).map((item) => `<li><strong>${escapeHtml(item.text)}</strong> — ${escapeHtml(item.reason)}</li>`).join("")}</ul>
      ${invalidCommitments.length > 3 ? `<p>And ${invalidCommitments.length - 3} more.</p>` : ""}
      <button type="button" data-action="discard-invalid-commitments">Remove quarantined items</button>
    </div>` : ""}
    ${!check.ok ? `<div class="banner danger">${errorLabel(check.error)} <button type="button" data-action="replan">Force replan</button></div>` : `<div class="banner ok">Plan fits capacity.</div>`}
    ${
      (() => {
        const overs = softCapOverTargets();
        if (!overs.length || !check.ok) return "";
        return `<div class="banner warn">Soft-cap pressure: ${overs
          .map((o) => escapeHtml(o.title))
          .join(", ")} at/over weekly soft hours. Consider replan or drop optional work.</div>`;
      })()
    }
    ${
      isMorningLocal() && isReady(state) && state.ui.lastCheckInDate !== todayISO()
        ? `<div class="banner warn">Morning pause — set today’s intention before the day runs you. <button type="button" class="primary" data-action="open-checkin">Check in</button></div>`
        : ""
    }
    ${
      isEveningLocal() && pendingReviewCount() > 0
        ? `<div class="banner warn">Evening check — ${pendingReviewCount()} open commitment${pendingReviewCount() === 1 ? "" : "s"}. <button type="button" data-action="goto-review">Review with honesty</button></div>`
        : ""
    }
    <div class="row">
      <button type="button" class="primary" data-action="ally-propose">Ask AIly to propose a plan</button>
      <button type="button" data-action="clone-yesterday">Clone yesterday</button>
      ${today.some((c) => c.status === "done") ? `<button type="button" data-action="hide-done-today">Drop done from list</button>` : ""}
      ${allyProposal ? `<button type="button" data-action="ally-clear">Clear proposal</button>` : ""}
    </div>
    ${
      allyProposal
        ? `<div class="capacity-card ally-propose-card">
             <h2>Ally proposal (local, not cloud)</h2>
             <p class="ally-line">${escapeHtml(allyProposal.summary)}</p>
             <ul class="list">
               ${allyProposal.proposals
                 .map(
                   (p, i) => `<li>
                   <strong>${escapeHtml(p.text)}</strong>
                   <span class="muted">${p.estimateMin}m · ${escapeHtml(state.targets.find((t) => t.id === p.targetId)?.title || "?")}${p.mustKeep ? " · must-keep" : ""}</span>
                   <span class="muted">${escapeHtml(p.reason || "")}</span>
                   <button type="button" class="primary" data-action="ally-accept-one" data-index="${i}">Add</button>
                 </li>`
                 )
                 .join("") || "<li class='muted'>Nothing to propose right now.</li>"}
             </ul>
             ${
               allyProposal.proposals.length
                 ? `<button type="button" class="primary" data-action="ally-accept-all">Add all that fit</button>`
                 : ""
             }
           </div>`
        : ""
    }
    <div class="row quick-chips" aria-label="Quick commitment templates">
      <button type="button" class="chip" data-action="quick-commit" data-text="Deep work block" data-min="50">Deep work 50m</button>
      <button type="button" class="chip" data-action="quick-commit" data-text="Admin / email batch" data-min="25">Admin 25m</button>
      <button type="button" class="chip" data-action="quick-commit" data-text="Move body / break" data-min="15">Break 15m</button>
    </div>
    <div class="row">
      <input id="new-commit-text" placeholder="Next commitment…" />
      <select id="new-commit-target">${state.targets
        .filter((t) => t.status === "active")
        .map((t) => {
          const rem = softCapRemainingHours(t.id);
          const remLabel = rem == null ? "" : ` · ~${rem.toFixed(1)}h left`;
          return `<option value="${t.id}">${escapeHtml(t.title)}${remLabel}</option>`;
        })
        .join("")}</select>
      <input id="new-commit-min" type="number" min="15" step="15" value="30" style="width:5rem" />
      <label class="chk"><input type="checkbox" id="new-commit-keep" /> must-keep</label>
      <button type="button" class="primary" data-action="add-commit">Add</button>
    </div>
    <ul class="list">
      ${today
        .slice()
        .sort((a, b) => {
          // must-keep first, then lower priority number (more important), then longer blocks
          const mk = (b.mustKeep ? 1 : 0) - (a.mustKeep ? 1 : 0);
          if (mk) return mk;
          const pa = Number.isFinite(a.priority) ? a.priority : 0;
          const pb = Number.isFinite(b.priority) ? b.priority : 0;
          if (pa !== pb) return pa - pb;
          return (b.estimateMin || 0) - (a.estimateMin || 0);
        })
        .map((c) => {
          const t = state.targets.find((x) => x.id === c.targetId);
          return `<li>
            <strong>${escapeHtml(c.text)}</strong>
            <span class="muted">${c.estimateMin}m · ${escapeHtml(t?.title || "?")}${c.mustKeep ? " · must-keep" : ""}${c.status === "done" ? " · done" : ""} · p${c.priority|0}</span>
            ${
              c.status !== "done"
                ? `<button type="button" data-action="done-commit" data-id="${c.id}">Done</button>
                   <button type="button" data-action="edit-commit" data-id="${c.id}">Edit</button>
                   <button type="button" data-action="toggle-must-keep" data-id="${c.id}">${c.mustKeep ? "Unprotect" : "Must-keep"}</button>
                   <button type="button" data-action="prio-up" data-id="${c.id}" title="Less important (sacrifice first)">P+</button>
                   <button type="button" data-action="prio-down" data-id="${c.id}" title="More important">P−</button>`
                : ""
            }
            <button type="button" data-action="drop-commit" data-id="${c.id}">Drop</button>
          </li>`;
        })
        .join("") || emptyTodayCta()}
    </ul>
  `;
}

function targetProgressPct(metric) {
  if (!metric) return 0;
  const span = Math.abs(metric.target - metric.baseline) || 1;
  const moved = Math.abs(metric.current - metric.baseline);
  return Math.min(100, Math.max(0, Math.round((moved / span) * 100)));
}

function renderTargets() {
  const el = $("#panel-targets");
  const active = state.targets.filter((t) => t.status === "active");
  const sortedTargets = state.targets.slice().sort((a, b) => {
    const order = { active: 0, paused: 1, completed: 2 };
    const sa = order[a.status] ?? 9;
    const sb = order[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return targetProgressPct(a.metrics?.[0]) - targetProgressPct(b.metrics?.[0]);
  });
  el.innerHTML = `
    <header class="panel-head">
      <h1>Targets</h1>
      <p class="muted">What you're journeying toward — with real metrics.</p>
    </header>
    ${
      !active.length
        ? `<div class="empty-hero">
             <img src="assets/logo.svg" width="64" height="64" alt="" />
             <h2>Start with one real target</h2>
             <p class="muted">AIly protects time for something measurable — not a vague wish. Name it, set a metric, then plan Today.</p>
           </div>`
        : ""
    }
    <form id="target-form" class="card form">
      <h2>${active.length ? "New target" : "Your first target"}</h2>
      <label>Title <input name="title" required placeholder="Ship side project v1" /></label>
      <label>Metric name <input name="metric" required placeholder="shippable increments" /></label>
      <label>Unit <input name="unit" required placeholder="items" value="items" /></label>
      <div class="row">
        <label>Baseline <input name="baseline" type="number" value="0" required /></label>
        <label>Target <input name="target" type="number" value="10" required /></label>
        <label>Soft hours/week <input name="soft" type="number" min="0" step="0.5" placeholder="optional" /></label>
      </div>
      <button class="primary" type="submit">Create target</button>
    </form>
    <ul class="list">
      ${sortedTargets
        .map((t) => {
          const m = t.metrics[0];
          const pct = targetProgressPct(m);
          return `<li class="target-card">
            <div class="target-card-main">
              <strong>${escapeHtml(t.title)}</strong>
              <span class="muted">${escapeHtml(m?.name || "")}: ${m?.current ?? "—"} / ${m?.target ?? "—"} ${escapeHtml(m?.unit || "")}</span>
              <div class="capacity-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Target progress">
                <div class="capacity-meter-fill" style="width:${pct}%"></div>
              </div>
              <span class="muted">${pct}% of the journey</span>
              ${
                t.status === "active"
                  ? `<span class="muted">Today pending: <strong>${todayPendingMinForTarget(t.id)|0}m</strong>${
                      t.softCapacityHours != null
                        ? ` · ~${softCapRemainingHours(t.id)?.toFixed(1) ?? "?"}h soft left`
                        : ""
                    }</span>`
                  : ""
              }
            </div>
            <div class="row">
              ${t.softCapacityHours != null ? `<span class="tag">${t.softCapacityHours}h soft</span>` : ""}
              <span class="tag">${t.status || "active"}</span>
              ${
                t.status === "active"
                  ? `<button type="button" data-action="bump-metric" data-id="${t.id}">+ progress</button>
                     <button type="button" data-action="rename-target" data-id="${t.id}">Rename</button>
                     <button type="button" data-action="pause-target" data-id="${t.id}">Pause</button>
                     <button type="button" data-action="complete-target" data-id="${t.id}">Complete</button>`
                  : `<button type="button" data-action="rename-target" data-id="${t.id}">Rename</button>
                     <button type="button" data-action="activate-target" data-id="${t.id}">Reactivate</button>`
              }
            </div>
          </li>`;
        })
        .join("") || ""}
    </ul>
  `;
  $("#target-form")?.addEventListener("submit", onCreateTarget);
}

function isEveningLocal() {
  const h = new Date().getHours();
  return h >= 17 || h < 5;
}

function pendingReviewCount() {
  const d = todayISO();
  return state.commitments.filter(
    (c) => c.planDate === d && c.status === "pending"
  ).length;
}

function renderReview() {
  const el = $("#panel-review");
  const d = todayISO();
  const list = state.commitments.filter((c) => c.planDate === d && c.status !== "dropped");
  const pending = list.filter((c) => c.status === "pending");
  const done = list.filter((c) => c.status === "done");
  const week = weekJourneyStats(state);
  const streak = intentionStreak(state, d);
  el.innerHTML = `
    <header class="panel-head">
      <h1>Review</h1>
      <p class="muted">Evening honesty — evidence toward targets, or structured no-impact.</p>
    </header>
    ${
      state.ui.dailyIntention
        ? `<div class="capacity-card"><p class="ally-line">You intended: <strong>${escapeHtml(state.ui.dailyIntention)}</strong>. Did your time match?</p></div>`
        : ""
    }
    <div class="capacity-card">
      <h2>This week (from ${week.start})</h2>
      <p class="ally-line">
        Planned <strong>${week.plannedMin|0}m</strong> · done <strong>${week.doneMin|0}m</strong>
        (${week.doneCount} closed, ${week.openCount} still open) · logged attention <strong>${week.usageMin|0}m</strong>
        · break-glass <strong>${week.glass}</strong>.
      </p>
      <p class="ally-line">${escapeHtml(weekReflection(week))}</p>
      ${streak > 0 ? `<p class="muted">Check-in streak: <strong>${streak}</strong> day${streak === 1 ? "" : "s"}.</p>` : ""}
      <p class="muted">Numbers stay on this device. Use them to notice patterns — not to shame yourself.</p>
      <button type="button" data-action="copy-summary">Copy honesty summary</button>
    </div>
    <p class="muted">Today: ${done.length} done · ${pending.length} still open</p>
    ${
      pending.length
        ? `<div class="row">
             <button type="button" data-action="review-all-noimpact">Mark all remaining no-impact</button>
           </div>`
        : ""
    }
    <ul class="list">
      ${list
        .map(
          (c) => `<li class="review-item" data-id="${c.id}">
          <strong>${escapeHtml(c.text)}</strong>
          <div class="row">
            ${
              c.status === "pending"
                ? `<button type="button" data-action="review-done" data-id="${c.id}">Done + metric</button>
                   <button type="button" data-action="review-noimpact" data-id="${c.id}">No impact</button>`
                : `<span class="tag">closed</span>`
            }
            <span class="muted">${c.status}</span>
          </div>
        </li>`
        )
        .join("") || "<li class='muted'>Nothing to review for today. Plan something on Today first.</li>"}
    </ul>
  `;
}

function renderUsage() {
  const el = $("#panel-usage");
  const granted = state.tutorial.permissions.usage;
  const usage = dayUsageMinutes();
  const byApp = summarizeDayByApp(state.usageSamples || [], todayISO());
  const maxMins = byApp.reduce((m, x) => Math.max(m, x.mins), 0) || 1;
  const pendingMs = usageTracker?.pendingMs?.() || 0;
  const pendingMin = Math.floor(pendingMs / 60000);
  const pendingSec = Math.floor((pendingMs % 60000) / 1000);
  el.innerHTML = `
    <header class="panel-head">
      <h1>Usage</h1>
      <p class="muted">${escapeHtml(usageBackendHonesty(usageBackend))}</p>
    </header>
    <p class="muted">Backend: <strong>${escapeHtml(usageBackend.label)}</strong> · <code>${escapeHtml(usageBackend.id)}</code></p>
    ${
      granted
        ? `<div class="banner ok">Usage on. Session tracker is active for <strong>AIly</strong> while this tab is visible and focused.${
            usageTracker?.isRunning?.()
              ? ` Live buffer ~${pendingMin}m ${pendingSec}s (flushes in whole minutes).`
              : ""
          }</div>
           <div class="capacity-card">
             <h2>Today’s logged attention</h2>
             <p class="ally-line"><strong>${usage|0}m</strong> total. Does that match how you meant to spend the day?</p>
             ${
               byApp.length
                 ? `<div class="usage-bars">${byApp
                     .map(
                       (row) => `<div class="usage-bar-row" title="${escapeHtml(row.app)}">
                         <div>
                           <div>${escapeHtml(row.app)}</div>
                           <div class="usage-bar-track"><div class="usage-bar-fill" style="width:${Math.round((row.mins / maxMins) * 100)}%"></div></div>
                         </div>
                         <div class="usage-bar-mins">${row.mins|0}m</div>
                       </div>`
                     )
                     .join("")}</div>`
                 : `<p class="muted">No samples yet — stay in AIly a minute, or log another app below.</p>`
             }
           </div>
           <form id="usage-form" class="row">
             <input name="app" placeholder="App name (e.g. YouTube)" required />
             <input name="mins" type="number" min="1" value="15" style="width:5rem" />
             <button class="primary" type="submit">Log sample usage</button>
           </form>
           <div class="row">
             <button type="button" data-action="flush-usage" ${usageTracker?.isRunning?.() ? "" : "disabled"}>Flush live buffer now</button>
             <button type="button" data-action="clear-usage" ${(state.usageSamples || []).length ? "" : "disabled"}>Clear all samples</button>
           </div>
           <ul class="list">${(state.usageSamples || [])
             .slice(0, 20)
             .map((u) => `<li>${escapeHtml(u.app)} · ${u.mins}m · ${u.ts.slice(0, 16).replace("T", " ")}</li>`)
             .join("") || "<li class='muted'>No samples yet.</li>"}</ul>`
        : `<div class="banner warn">Grant usage in Setup / tutorial chapter “Attention map”.</div>
           <button type="button" class="primary" data-action="grant-usage">Grant usage tracking</button>`
    }
  `;
  $("#usage-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const app = String(fd.get("app"));
    const mins = Number(fd.get("mins"));
    const blocked = isAppBlocked(state.blockRules || [], app);
    if (blocked) {
      const ok = confirm(
        `${app} matches an armed off-limits rule. Log this attention honestly anyway? (No shame — clarity only.)`
      );
      if (!ok) return;
      appendAudit(state, "usage.blocked_sample", app);
    }
    const result = appendUsageSample(state.usageSamples || [], { app, mins });
    if (!result.added) {
      showToast("Enter a valid app and minutes.", "error");
      return;
    }
    state.usageSamples = result.samples;
    appendAudit(state, "usage.sample", app);
    persist();
    showToast(
      blocked
        ? "Logged. Noticing off-limits time is part of the journey."
        : "Usage sample logged.",
      "ok",
      4000
    );
  });
}

function renderBlocks() {
  const el = $("#panel-blocks");
  const ok = canArmBlocks(state);
  const armedCount = (state.blockRules || []).filter((r) => r.armed).length;
  el.innerHTML = `
    <header class="panel-head">
      <h1>Blocks</h1>
      <p class="muted">Self-admin productivity blocks — ally, not prison. Break-glass always.</p>
    </header>
    ${
      ok
        ? `<div class="banner ok">Admin + usage granted. ${armedCount} rule${armedCount === 1 ? "" : "s"} armed.</div>`
        : `<div class="banner warn">Complete Attention map + Ally admin in Setup before arming blocks.</div>`
    }
    ${
      focusRemainingLabel()
        ? `<div class="banner focus-armed">Focus session active · ${focusRemainingLabel()} left. Armed rules protect this window.</div>`
        : ""
    }
    <form id="block-form" class="row">
      <input name="app" placeholder="App key (e.g. firefox)" required />
      <select name="mode"><option value="soft">Soft delay</option><option value="hard">Hard block</option></select>
      <input name="delay" type="number" min="0" max="600" value="30" title="Break-glass delay seconds" style="width:5rem" />
      <button class="primary" type="submit">Add rule</button>
    </form>
    <form id="try-open-form" class="card form">
      <h2>Try open (dogfood)</h2>
      <p class="muted">Simulate opening an app. If an armed rule matches, AIly starts break-glass instead of letting it through.</p>
      <div class="row">
        <input name="app" placeholder="App key to open" required />
        <button class="primary" type="submit">Try open</button>
      </div>
    </form>
    <ul class="list">
      ${(state.blockRules || [])
        .map((r) => {
          const policy = breakGlassPolicy(r);
          return `<li>
          <strong>${escapeHtml(r.appKeys.join(", "))}</strong>
          <span class="tag">${r.mode}</span>
          <span class="tag ${r.armed ? "armed" : ""}">${r.armed ? "armed" : "idle"}</span>
          <span class="muted">${policy.delaySec}s glass</span>
          <button type="button" data-action="toggle-arm" data-id="${r.id}">${r.armed ? "Disarm" : "Arm"}</button>
          <button type="button" data-action="break-glass" data-id="${r.id}" ${r.armed ? "" : "disabled"}>Break glass</button>
          <button type="button" data-action="set-delay" data-id="${r.id}">Delay</button>
          <button type="button" data-action="delete-rule" data-id="${r.id}">Delete</button>
        </li>`;
        })
        .join("") || "<li class='muted'>No block rules yet.</li>"}
    </ul>
    <div class="row">
      <button type="button" data-action="disarm-all" ${state.blockRules.some((r) => r.armed) ? "" : "disabled"}>Disarm all</button>
      <button type="button" data-action="arm-all" ${ok && state.blockRules.some((r) => !r.armed) ? "" : "disabled"}>Arm all</button>
    </div>
    <p class="muted">Break-glass uses today: ${breakGlassUsesToday(state.audit || [], todayISO())}${
      (() => {
        const uses = breakGlassUsesToday(state.audit || [], todayISO());
        const limits = (state.blockRules || [])
          .map((r) => breakGlassPolicy(r).dailyLimit)
          .filter((x) => x != null);
        if (!limits.length) return "";
        const lim = Math.min(...limits);
        return ` · tightest daily limit ${lim}${uses >= lim ? " (at/over)" : ""}`;
      })()
    }</p>
  `;
  $("#block-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let delaySec = Number(fd.get("delay"));
    if (!Number.isFinite(delaySec) || delaySec < 0) delaySec = 30;
    delaySec = Math.min(600, Math.floor(delaySec));
    const app = String(fd.get("app") || "").trim();
    if (!app) {
      showToast("Enter an app key.", "error");
      return;
    }
    const result = upsertBlockRule(state.blockRules || [], {
      id: uid(),
      appKeys: [app],
      mode: fd.get("mode") === "hard" ? "hard_block" : "soft_delay",
      delaySec,
    });
    state.blockRules = result.rules;
    appendAudit(
      state,
      result.merged ? "block.rule_merge" : "block.rule_add",
      `${app}@${delaySec}s`
    );
    persist();
    showToast(
      result.merged
        ? `Updated existing rule for ${app} (${delaySec}s glass).`
        : `Rule added (${delaySec}s break-glass).`,
      "ok"
    );
  });
  $("#try-open-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const app = String(fd.get("app") || "");
    const hit = isAppBlocked(state.blockRules || [], app);
    if (!hit) {
      appendAudit(state, "block.try_open_allowed", app);
      persist();
      showToast(`${app || "App"} is not armed-blocked — allowed (simulation).`, "ok");
      return;
    }
    appendAudit(state, "block.try_open_blocked", `${app} → ${hit.id}`);
    startBreakGlass(hit.id);
    showToast(`${app} is blocked. Complete break-glass to unlock.`, "error", 4000);
  });
}

function renderSetup() {
  const el = $("#panel-setup");
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS
    window.navigator.standalone === true;
  const doneCh = CHAPTERS.filter((c) => chapterStatus(state, c.id) === "done").length;
  const setupPct = Math.round((doneCh / CHAPTERS.length) * 100);
  el.innerHTML = `
    <header class="panel-head">
      <h1>Setup</h1>
      <p class="muted">Tutorial checklist — AIly walks you through everything.</p>
    </header>
    <div class="capacity-card">
      <h2>Setup progress</h2>
      <div class="capacity-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${setupPct}">
        <div class="capacity-meter-fill" style="width:${setupPct}%"></div>
      </div>
      <p class="muted">${doneCh}/${CHAPTERS.length} chapters · ready: <strong>${isReady(state) ? "yes" : "not yet"}</strong></p>
    </div>
    <button type="button" class="primary" data-action="open-tutorial">Open tutorial</button>
    <ul class="list checklist">
      ${CHAPTERS.map((c) => {
        const st = chapterStatus(state, c.id);
        return `<li>
          <span class="dot ${st}"></span>
          <strong>${escapeHtml(c.title)}</strong>
          <span class="muted">${st}${c.required ? " · required" : ""}</span>
        </li>`;
      }).join("")}
    </ul>
    <div class="card">
      <h2>App install</h2>
      <p class="muted">${
        standalone
          ? "Running as an installed app."
          : deferredInstall
            ? "Install available — use the banner or button below."
            : "Use your browser’s Install / Add to Home Screen when offered."
      }</p>
      ${
        !standalone && deferredInstall
          ? `<button type="button" class="primary" data-action="install-app">Install AIly</button>`
          : ""
      }
    </div>
    <div class="card form">
      <h2>You</h2>
      <label>Display name <input id="setup-name" type="text" maxlength="80" value="${escapeHtml(state.user.displayName || "")}" placeholder="Optional — how AIly greets you" /></label>
      <button type="button" data-action="save-name">Save name</button>
    </div>
    <div class="card form">
      <h2>Capacity</h2>
      <p class="muted">How much time you can honestly protect each week.</p>
      <div class="row">
        <label>Weekly hours <input id="setup-hours" type="number" min="1" max="80" step="0.5" value="${state.user.weeklyCapacityHours}" /></label>
        <label>Nights/week <input id="setup-nights" type="number" min="1" max="7" value="${state.user.nightsPerWeek}" /></label>
        <button type="button" class="primary" data-action="save-capacity">Save capacity</button>
      </div>
      <p class="muted">Day soft cap ≈ ${dailySoftCapMinutes(state.user.weeklyCapacityHours, state.user.nightsPerWeek)|0}m</p>
    </div>
    <div class="card">
      <h2>Display</h2>
      <div class="row">
        <label class="chk"><input type="checkbox" id="setup-compact" ${state.ui.density === "compact" ? "checked" : ""} /> Compact density</label>
        <label class="chk"><input type="checkbox" id="setup-reduce-motion" ${state.ui.reduceMotion ? "checked" : ""} /> Reduce motion</label>
        <button type="button" data-action="save-display">Save display</button>
      </div>
    </div>
    <div class="card">
      <h2>Permissions</h2>
      <p>Usage: <strong>${state.tutorial.permissions.usage ? "on" : "off"}</strong>
         · Notifications: <strong>${state.tutorial.permissions.notifications ? "on" : "off"}</strong>
         · Block admin: <strong>${state.tutorial.permissions.blockAdmin ? "on" : "off"}</strong></p>
      <p class="muted">Can arm blocks: <strong>${canArmBlocks(state) ? "yes" : "no"}</strong></p>
      <div class="row">
        <button type="button" data-action="revoke-usage" ${state.tutorial.permissions.usage ? "" : "disabled"}>Revoke usage</button>
        <button type="button" data-action="revoke-admin" ${state.tutorial.permissions.blockAdmin ? "" : "disabled"}>Revoke block admin</button>
        <button type="button" data-action="notify-test" ${state.tutorial.permissions.notifications ? "" : "disabled"}>Test notification</button>
      </div>
    </div>
    <div class="card">
      <h2>Local backup</h2>
      <p class="muted">Export stays on this device until you save the file. Import replaces current local state after confirmation.</p>
      <div class="row">
        <button type="button" class="primary" data-action="export-backup">Export backup</button>
        <label class="chk file-pick">
          <span class="file-pick-label">Import backup…</span>
          <input type="file" id="import-backup" accept="application/json,.json" hidden />
        </label>
        <button type="button" data-action="export-audit">Export audit TSV</button>
        <button type="button" data-action="clear-audit">Clear activity log</button>
        <button type="button" data-action="seed-demo">Load sample journey</button>
        <button type="button" data-action="undo" ${undoStack.length ? "" : "disabled"}>Undo last</button>
        <button type="button" data-action="reset-demo">Reset demo data</button>
        <button type="button" data-action="open-help">Keyboard help</button>
      </div>
      <p class="muted">Version ${SITE_VERSION.id} · ${SITE_VERSION.tagline}</p>
      <p class="muted">Local store ≈ ${formatBytes(storageRoughBytes())} · undo stack ${undoStack.length}</p>
    </div>
  `;
  $("#import-backup")?.addEventListener("change", onImportBackup);
}

function friendlyAuditTool(tool) {
  const map = {
    "commitment.add": "Added commitment",
    "commitment.done": "Marked done",
    "commitment.edit": "Edited commitment",
    "commitment.priority": "Changed priority",
    "commitment.must_keep": "Toggled must-keep",
    "commitment.drop": "Dropped commitment",
    "target.create": "Created target",
    "target.pause": "Paused target",
    "target.complete": "Completed target",
    "target.activate": "Reactivated target",
    "target.rename": "Renamed target",
    "undo.drop": "Undid drop",
    "undo.hide_done": "Undid hide-done",
    // keep labels in sync with pushUndo types
    "checkin.save": "Daily intention",
    "checkin.skip": "Skipped check-in",
    "focus.start": "Focus started",
    "focus.end": "Focus ended",
    "focus.extend": "Focus extended",
    "block.arm": "Armed block",
    "block.arm_focus": "Armed for focus",
    "block.disarm": "Disarmed block",
    "block.break_glass": "Break glass",
    "block.try_open_blocked": "Blocked try-open",
    "block.try_open_allowed": "Allowed try-open",
    "usage.session": "Session attention",
    "usage.merge": "Merged attention",
    "usage.sample": "Logged usage",
    "usage.blocked_sample": "Logged off-limits app",
    "usage.clear": "Cleared usage samples",
    "plan.replan": "Replanned day",
    "tutorial.complete": "Tutorial step",
    "permission.grant": "Granted permission",
    "app.installed": "App installed",
    "state.export": "Exported backup",
    "state.import": "Imported backup",
    "state.prune": "Pruned old commitments",
    "state.copy_summary": "Copied honesty summary",
    "demo.seed": "Loaded sample journey",
    "ally.propose": "Ally proposed plan",
    "ally.accept_all": "Accepted ally plan",
    "block.rule_delete": "Deleted block rule",
    "block.rule_merge": "Merged block rule",
    "block.disarm_all": "Disarmed all rules",
    "block.arm_all": "Armed all rules",
    "block.delay": "Changed break-glass delay",
    "capacity.save": "Saved capacity",
    "permission.revoke": "Revoked permission",
    "user.name": "Saved display name",
    "ui.display": "Saved display prefs",
    "audit.clear": "Cleared activity log",
    "audit.export": "Exported audit TSV",
    "notify.test": "Test notification",
    "plan.clone_yesterday": "Cloned yesterday’s plan",
    "plan.hide_done": "Hid completed items",
    "review.bulk_no_impact": "Bulk no-impact close",
  };
  return map[tool] || tool;
}

function renderActivity() {
  const el = $("#panel-activity");
  const filter = (state.ui.activityFilter || "").trim().toLowerCase();
  const rows = (state.audit || []).filter((a) => {
    if (!filter) return true;
    const hay = `${a.tool || ""} ${a.detail || ""} ${friendlyAuditTool(a.tool)}`.toLowerCase();
    return hay.includes(filter);
  });
  el.innerHTML = `
    <header class="panel-head"><h1>Activity</h1>
    <p class="muted">What AIly recorded (local audit — never leaves this device).</p></header>
    <div class="row">
      <input id="activity-filter" type="search" placeholder="Filter log…" value="${escapeHtml(state.ui.activityFilter || "")}" />
      <button type="button" data-action="apply-activity-filter">Filter</button>
      ${filter ? `<button type="button" data-action="clear-activity-filter">Clear</button>` : ""}
    </div>
    <p class="muted">${rows.length} shown${filter ? ` · filter “${escapeHtml(filter)}”` : ""}</p>
    <ul class="list">
      ${rows
        .map((a) => {
          const when = typeof a.ts === "string" ? a.ts.slice(0, 16).replace("T", " ") : "";
          return `<li>
            <strong>${escapeHtml(friendlyAuditTool(a.tool))}</strong>
            <span class="muted">${escapeHtml(a.detail || "")}</span>
            <span class="muted">${when}</span>
          </li>`;
        })
        .join("") || "<li class='muted'>No actions yet. Use Today, Targets, or Blocks to begin.</li>"}
    </ul>
  `;
  $("#activity-filter")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.ui.activityFilter = e.target.value || "";
      persist();
    }
  });
}

function renderTutorialModal() {
  const modal = $("#tutorial-modal");
  if (!modal) return;
  const show = state.ui.tutorialOpen;
  modal.classList.toggle("hidden", !show);
  if (!show) return;

  const pending = CHAPTERS.find((c) => chapterStatus(state, c.id) === "pending") || CHAPTERS[0];
  $("#tutorial-title").textContent = pending.title;
  $("#tutorial-body").innerHTML = markdownLite(pending.body);
  $("#tutorial-progress").textContent = `${CHAPTERS.filter((c) => chapterStatus(state, c.id) === "done").length}/${CHAPTERS.length} chapters`;
  const actions = $("#tutorial-actions");
  actions.innerHTML = "";
  if (pending.grant) {
    const g = document.createElement("button");
    g.className = "primary";
    g.textContent =
      pending.grant === "usage"
        ? "Grant usage permission"
        : pending.grant === "blockAdmin"
          ? "Grant block admin"
          : "Allow notifications";
    g.onclick = () => grantAndComplete(pending);
    actions.appendChild(g);
  } else if (pending.id === "first_target") {
    actions.innerHTML = `<p class="muted">Create a target in the Targets tab, then mark done.</p>`;
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = state.targets.length ? "I created a target — continue" : "Go to Targets";
    b.onclick = () => {
      if (!state.targets.length) {
        state.ui.tab = "targets";
        state.ui.tutorialOpen = false;
      } else {
        completeChapter("first_target");
      }
      persist();
    };
    actions.appendChild(b);
  } else if (pending.id === "capacity") {
    actions.innerHTML = `
      <label>Weekly hours <input type="number" id="tut-hours" min="1" max="80" value="${state.user.weeklyCapacityHours}" /></label>
      <label>Nights/week <input type="number" id="tut-nights" min="1" max="7" value="${state.user.nightsPerWeek}" /></label>
    `;
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = "Save capacity";
    b.onclick = () => {
      state.user.weeklyCapacityHours = Number($("#tut-hours").value) || 10;
      state.user.nightsPerWeek = Number($("#tut-nights").value) || 4;
      completeChapter("capacity");
      persist();
    };
    actions.appendChild(b);
  } else {
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = pending.id === "meet" ? "Nice to meet you" : "Continue";
    b.onclick = () => {
      completeChapter(pending.id);
      persist();
    };
    actions.appendChild(b);
  }
  if (!pending.required) {
    const s = document.createElement("button");
    s.textContent = "Skip for now";
    s.onclick = () => {
      state.tutorial.chapters[pending.id] = "skipped";
      appendAudit(state, "tutorial.skip", pending.id);
      persist();
    };
    actions.appendChild(s);
  }
  if (isReady(state)) {
    const d = document.createElement("button");
    d.textContent = "Enter AIly";
    d.className = "primary";
    d.onclick = () => {
      state.ui.tutorialOpen = false;
      state.ui.tab = "today";
      persist();
      showToast(
        state.user.displayName
          ? `Welcome, ${state.user.displayName}. Protect the time that matters.`
          : "You're ready. Set an intention and protect the time that matters.",
        "ok",
        4500
      );
    };
    actions.appendChild(d);
  }
}

function renderIntentionModal() {
  const modal = $("#intention-modal");
  if (!modal) return;
  const show = !!pendingIntention;
  modal.classList.toggle("hidden", !show);
  if (!show || !pendingIntention) return;

  const daily = dailySoftCapMinutes(state.user.weeklyCapacityHours, state.user.nightsPerWeek);
  const after = plannedMinutes() + pendingIntention.estimateMin;
  const ratio = daily > 0 ? after / daily : 0;
  const fillPct = Math.min(100, Math.round(ratio * 100));
  const target = state.targets.find((t) => t.id === pendingIntention.targetId);
  const intention = (state.ui.dailyIntention || "").trim();

  const preview = capacityPreview(pendingIntention.estimateMin);
  $("#intention-body").innerHTML = `You're about to put <strong>${pendingIntention.estimateMin}m</strong> toward
    <strong>${escapeHtml(pendingIntention.text)}</strong>
    ${target ? ` · target <strong>${escapeHtml(target.title)}</strong>` : ""}.`;
  let hint = `That would make ~${after|0}m of ~${daily|0}m day soft capacity (${fillPct}%). Do you really want to spend this time this way?`;
  if (intention) {
    const aligned =
      intention
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some(
          (w) =>
            pendingIntention.text.toLowerCase().includes(w) ||
            (target?.title || "").toLowerCase().includes(w)
        );
    hint += aligned
      ? ` Aligns with today’s intention (“${intention.slice(0, 60)}”).`
      : ` Today’s intention is “${intention.slice(0, 60)}” — does this serve it?`;
  }
  if (!preview.ok) {
    hint += ` Warning: ${errorLabel(preview.error)}.`;
  }
  $("#intention-hint").textContent = hint;
  const fill = $("#intention-meter-fill");
  if (fill) {
    fill.style.width = `${fillPct}%`;
    fill.className = `capacity-meter-fill ${meterClass(ratio)}`;
  }
}

function shouldAskIntention(estimateMin) {
  if (skipIntentionThisSession) return false;
  if (Date.now() < (state.ui.intentionSkipUntil || 0)) return false;
  // Always ask for 30m+; short tasks stay friction-light.
  return estimateMin >= 30;
}

function previousDayLocalISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function cloneYesterday() {
  const y = previousDayLocalISO();
  const today = todayISO();
  const yItems = (state.commitments || []).filter(
    (c) => c.planDate === y && c.status !== "dropped"
  );
  if (!yItems.length) {
    showToast("Nothing on yesterday’s plan to clone.", "error");
    return;
  }
  let n = 0;
  let skipped = 0;
  for (const c of yItems) {
    const active = state.targets.some((t) => t.id === c.targetId && t.status === "active");
    if (!active) {
      skipped += 1;
      continue;
    }
    const dup = findSameDayDuplicate(state.commitments || [], {
      planDate: today,
      text: c.text,
    });
    if (dup.duplicate) {
      skipped += 1;
      continue;
    }
    state.commitments.push({
      id: uid(),
      targetId: c.targetId,
      planDate: today,
      text: c.text,
      estimateMin: c.estimateMin,
      mustKeep: !!c.mustKeep,
      priority: Number.isFinite(c.priority) ? c.priority : 0,
      status: "pending",
    });
    n += 1;
  }
  if (!n) {
    showToast(
      skipped
        ? "Nothing new to clone (inactive targets or already on today)."
        : "Nothing on yesterday’s plan to clone.",
      "error",
      4500
    );
    return;
  }
  appendAudit(state, "plan.clone_yesterday", `${n} from ${y} skip:${skipped}`);
  persist();
  showToast(
    skipped
      ? `Cloned ${n}; skipped ${skipped}. Replan if over capacity.`
      : `Cloned ${n} item${n === 1 ? "" : "s"} from yesterday. Replan if over capacity.`,
    "ok",
    4500
  );
}

function runAllyPropose() {
  const result = proposeDayPlan({
    targets: state.targets,
    weeklyCapacityHours: state.user.weeklyCapacityHours,
    nightsPerWeek: state.user.nightsPerWeek,
    softCaps: softCaps(),
    existingToday: todayCommitments(),
    intention: state.ui.dailyIntention || "",
    maxItems: 3,
  });
  allyProposal = {
    summary: result.summary,
    proposals: result.proposals || [],
  };
  appendAudit(
    state,
    "ally.propose",
    result.ok ? `${allyProposal.proposals.length} items` : result.error || "failed"
  );
  persist();
  if (!result.ok) {
    showToast(result.summary, "error", 4500);
  } else if (!allyProposal.proposals.length) {
    showToast(result.summary, "ok", 4500);
  } else {
    showToast("Proposal ready — accept only what you mean.", "ok");
  }
}

function acceptAllyProposal(index) {
  if (!allyProposal?.proposals?.[index]) return;
  const p = allyProposal.proposals[index];
  const payload = {
    text: p.text,
    targetId: p.targetId,
    estimateMin: p.estimateMin,
    mustKeep: !!p.mustKeep,
  };
  if (shouldAskIntention(payload.estimateMin)) {
    pendingIntention = payload;
    renderIntentionModal();
    return;
  }
  queueCommitment(payload);
  allyProposal.proposals.splice(index, 1);
  if (!allyProposal.proposals.length) allyProposal = null;
  render();
}

function acceptAllAllyProposals() {
  if (!allyProposal?.proposals?.length) return;
  const list = allyProposal.proposals.slice();
  allyProposal = null;
  let n = 0;
  let skipped = 0;
  for (const p of list) {
    const active = state.targets.some((t) => t.id === p.targetId && t.status === "active");
    if (!active) {
      skipped += 1;
      continue;
    }
    // Skip intention gate for bulk accept — user already reviewed the list.
    state.commitments.push({
      id: uid(),
      targetId: p.targetId,
      planDate: todayISO(),
      text: p.text,
      estimateMin: p.estimateMin,
      mustKeep: !!p.mustKeep,
      priority: 0,
      status: "pending",
    });
    n += 1;
  }
  appendAudit(state, "ally.accept_all", `${n} commitments${skipped ? ` skip:${skipped}` : ""}`);
  persist();
  if (!n) {
    showToast("No proposals could be added (targets inactive?).", "error");
    return;
  }
  showToast(
    skipped
      ? `Added ${n}; skipped ${skipped} for inactive targets.`
      : `Added ${n} proposed commitment${n === 1 ? "" : "s"}.`,
    "ok"
  );
}

function capacityPreview(extraMin = 0) {
  const today = todayCommitments().map((c) => ({
    id: c.id,
    targetId: c.targetId,
    estimateMin: c.estimateMin,
    mustKeep: c.mustKeep,
  }));
  if (extraMin > 0) {
    today.push({
      id: "__preview__",
      targetId: state.targets[0]?.id || "preview",
      estimateMin: extraMin,
      mustKeep: false,
    });
  }
  return checkPlanAccept({
    weeklyCapacityHours: state.user.weeklyCapacityHours,
    nightsPerWeek: state.user.nightsPerWeek,
    softCaps: softCaps(),
    weekOther: [],
    today,
  });
}

function queueCommitment(payload) {
  const preview = capacityPreview(payload.estimateMin);
  const active = state.targets.some((t) => t.id === payload.targetId && t.status === "active");
  if (!active) {
    showToast("Pick an active target first.", "error");
    pendingIntention = null;
    renderIntentionModal();
    return;
  }
  const dup = findSameDayDuplicate(state.commitments || [], {
    planDate: todayISO(),
    text: payload.text,
  });
  if (dup.duplicate) {
    if (!confirm(`You already have “${dup.match.text}” today. Add another copy anyway?`)) {
      pendingIntention = null;
      renderIntentionModal();
      return;
    }
  }
  state.commitments.push({
    id: uid(),
    targetId: payload.targetId,
    planDate: todayISO(),
    text: payload.text,
    estimateMin: payload.estimateMin,
    mustKeep: !!payload.mustKeep,
    priority: 0,
    status: "pending",
  });
  appendAudit(state, "commitment.add", payload.text);
  pendingIntention = null;
  // Clear form fields when present
  if ($("#new-commit-text")) $("#new-commit-text").value = "";
  persist();
  if (!preview.ok) {
    showToast(
      `Added — but this overfills capacity (${errorLabel(preview.error)}). Replan when ready.`,
      "error",
      5500
    );
  } else {
    showToast("Commitment added — protect that time.", "ok");
  }
}

function completeChapter(id) {
  state.tutorial.chapters[id] = "done";
  appendAudit(state, "tutorial.complete", id);
}

async function grantAndComplete(chapter) {
  if (chapter.grant === "usage") state.tutorial.permissions.usage = true;
  if (chapter.grant === "blockAdmin") state.tutorial.permissions.blockAdmin = true;
  if (chapter.grant === "notifications") {
    state.tutorial.permissions.notifications = true;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          showToast("Browser notifications blocked — AIly will still work; nudges stay in-app.", "ok", 4500);
        }
      } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        showToast("Browser notifications are denied — in-app toasts still work.", "ok", 4000);
      }
    } catch {
      // Browser denied or unavailable — permission flag still records user intent.
    }
  }
  completeChapter(chapter.id);
  appendAudit(state, "permission.grant", chapter.grant);
  persist();
  syncUsageTracker();
}

function onImportBackup(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = importState(String(reader.result || ""));
    if (!result.ok) {
      showToast(`Import failed: ${result.error}`, "error", 5000);
      return;
    }
    if (!confirm("Replace all local AIly data with this backup?")) {
      e.target.value = "";
      return;
    }
    state = result.state;
    pendingIntention = null;
    lastSave = null;
    appendAudit(state, "state.import", file.name || "backup");
    persist();
    showToast("Backup imported.", "ok");
    e.target.value = "";
  };
  reader.onerror = () => showToast("Could not read backup file.", "error");
  reader.readAsText(file);
}

async function storageRoughBytes() {
  try {
    const raw = localStorage.getItem("aily.v1.state");
    return raw ? raw.length * 2 : 0; // UTF-16-ish browser estimate
  } catch {
    return 0;
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function downloadBackup() {
  const name = `aily-backup-${todayISO()}.json`;
  const text = exportState(state);
  const blob = new Blob([text], { type: "application/json" });
  // Prefer Web Share when available (Android PWA / mobile).
  try {
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "AIly backup",
          text: "Local AIly backup — keep private.",
        });
        appendAudit(state, "state.export", `share:${name}`);
        persist();
        showToast("Backup shared.", "ok");
        return;
      }
    }
  } catch (err) {
    // User cancelled share — fall through to download unless AbortError only.
    if (err && err.name === "AbortError") {
      showToast("Share cancelled.", "ok");
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  appendAudit(state, "state.export", name);
  persist();
  showToast("Backup downloaded.", "ok");
}

async function initNativeShell() {
  try {
    // Capacitor injects globals only inside the Android/iOS shell — no CDN.
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const StatusBar = cap.Plugins?.StatusBar;
    if (StatusBar) {
      if (typeof StatusBar.setBackgroundColor === "function") {
        await StatusBar.setBackgroundColor({ color: "#0e1116" });
      }
      if (typeof StatusBar.setStyle === "function") {
        await StatusBar.setStyle({ style: "DARK" });
      }
    }
    const App = cap.Plugins?.App;
    if (App?.addListener) {
      // Hardware back: close modals first, then navigate toward Today, then minimize.
      await App.addListener("backButton", ({ canGoBack }) => {
        if (pendingBreakGlass) {
          cancelBreakGlass();
          return;
        }
        if (pendingIntention) {
          pendingIntention = null;
          renderIntentionModal();
          return;
        }
        if (state.ui.checkInOpen) {
          skipCheckIn();
          return;
        }
        if (state.ui.tutorialOpen) {
          state.ui.tutorialOpen = false;
          persist();
          return;
        }
        if (state.ui.tab !== "today") {
          state.ui.tab = "today";
          persist();
          return;
        }
        if (canGoBack && cap.Plugins?.App?.minimizeApp) {
          cap.Plugins.App.minimizeApp();
        } else if (cap.Plugins?.App?.exitApp) {
          // Last resort on some devices — prefer minimize when available.
          cap.Plugins.App.minimizeApp?.() || cap.Plugins.App.exitApp();
        }
      });
      await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          lastHiddenAt = Date.now();
          usageTracker?.flush();
        } else if (lastHiddenAt) {
          const awayMin = (Date.now() - lastHiddenAt) / 60000;
          lastHiddenAt = 0;
          const msg = returnNudge({
            awayMin,
            intention: state.ui.dailyIntention || "",
            focusActive: focusRemainingMin() > 0,
          });
          if (msg) showToast(msg, "ok", 5500);
          usageTracker?.onVisibilityOrFocus();
        }
      });
    }
  } catch {
    // Web / missing plugin — ignore.
  }
}

function onCreateTarget(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const baseline = Number(fd.get("baseline"));
  const target = Number(fd.get("target"));
  if (!Number.isFinite(baseline) || !Number.isFinite(target)) {
    showToast("Baseline and target must be numbers.", "error");
    return;
  }
  if (baseline === target) {
    showToast("Baseline and target must differ.", "error");
    return;
  }
  const softRaw = fd.get("soft");
  let soft = softRaw === "" || softRaw == null ? null : Number(softRaw);
  if (soft != null && (!Number.isFinite(soft) || soft < 0)) {
    showToast("Soft hours must be empty or a non-negative number.", "error");
    return;
  }
  const title = String(fd.get("title") || "").trim();
  const metricName = String(fd.get("metric") || "").trim();
  const unit = String(fd.get("unit") || "").trim();
  if (!title || !metricName || !unit) {
    showToast("Title, metric, and unit are required.", "error");
    return;
  }
  const t = {
    id: uid(),
    title,
    status: "active",
    softCapacityHours: soft,
    metrics: [
      {
        name: metricName,
        unit,
        baseline,
        target,
        current: baseline,
        minMeaningfulDelta: Math.max(0.01, Math.abs(target - baseline) * 0.05),
      },
    ],
  };
  state.targets.push(t);
  const active = state.targets.filter((x) => x.status === "active");
  if (active.length >= 2) {
    const missing = active.filter((x) => x.softCapacityHours == null || x.softCapacityHours <= 0);
    if (missing.length) {
      const share = state.user.weeklyCapacityHours / active.length;
      for (const x of active) {
        if (x.softCapacityHours == null || x.softCapacityHours <= 0) {
          x.softCapacityHours = Math.round(share * 10) / 10;
        }
      }
    }
  }
  if (state.tutorial.chapters.first_target !== "done") {
    completeChapter("first_target");
  }
  appendAudit(state, "target.create", t.title);
  persist();
  showToast("Target created.", "ok");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownLite(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

// Events
document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    state.ui.tab = nav.dataset.nav;
    persist();
    return;
  }
  const act = e.target.closest("[data-action]");
  if (!act) return;
  const action = act.dataset.action;
  const id = act.dataset.id;

  if (action === "goto-blocks") {
    state.ui.tab = "blocks";
    persist();
  }
  if (action === "open-checkin") {
    state.ui.checkInOpen = true;
    renderCheckInModal();
    // Focus intention field for speed
    requestAnimationFrame(() => $("#checkin-intention")?.focus());
  }
  if (action === "checkin-save") {
    saveCheckIn();
  }
  if (action === "checkin-skip") {
    skipCheckIn();
  }
  if (action === "end-focus") {
    state.ui.focusSessionEndsAt = 0;
    let disarmed = 0;
    for (const r of state.blockRules || []) {
      if (r.armed) {
        r.armed = false;
        disarmed += 1;
      }
    }
    appendAudit(state, "focus.end", disarmed ? `manual+disarm:${disarmed}` : "manual");
    persist();
    showToast(
      disarmed ? `Focus ended · disarmed ${disarmed} rule${disarmed === 1 ? "" : "s"}.` : "Focus session ended.",
      "ok"
    );
  }
  if (action === "notify-test") {
    try {
      if (typeof Notification === "undefined") {
        showToast("Notifications not available here.", "error");
        return;
      }
      if (Notification.permission === "default") {
        Notification.requestPermission().then((result) => {
          if (result === "granted") {
            showToast("Notifications allowed — try again.", "ok");
          } else {
            showToast("Still blocked — AIly keeps using in-app toasts.", "ok", 4000);
          }
        });
        return;
      }
      if (Notification.permission !== "granted") {
        showToast("Allow notifications in the tutorial / browser first.", "error");
        return;
      }
      new Notification("AIly", {
        body: state.ui.dailyIntention
          ? `Intention: ${state.ui.dailyIntention.slice(0, 80)}`
          : "Gentle check-in — is this what you want to be doing?",
        icon: "icons/icon-192.png",
        tag: "aily-checkin",
      });
      appendAudit(state, "notify.test", "ok");
      persist();
    } catch {
      showToast("Could not show a notification.", "error");
    }
  }
  if (action === "open-tutorial") {
    state.ui.tutorialOpen = true;
    persist();
  }
  if (action === "close-tutorial") {
    state.ui.tutorialOpen = false;
    persist();
  }
  if (action === "close-help") {
    helpOpen = false;
    renderHelpModal();
  }
  if (action === "open-help") {
    helpOpen = true;
    renderHelpModal();
  }
  if (action === "goto-review") {
    state.ui.tab = "review";
    persist();
  }
  if (action === "goto-targets") {
    state.ui.tab = "targets";
    persist();
  }
  if (action === "ally-propose") {
    runAllyPropose();
  }
  if (action === "clone-yesterday") {
    cloneYesterday();
  }
  if (action === "hide-done-today") {
    const d = todayISO();
    const done = (state.commitments || []).filter((c) => c.planDate === d && c.status === "done");
    if (!done.length) return;
    if (
      !confirm(
        `Remove ${done.length} completed item${done.length === 1 ? "" : "s"} from today’s list? History still has audit entries.`
      )
    ) {
      return;
    }
    pushUndo({
      type: "hide-done",
      payload: done.map((c) => ({ id: c.id, prevStatus: c.status })),
    });
    for (const c of done) c.status = "dropped";
    appendAudit(state, "plan.hide_done", `${done.length}`);
    persist();
    showToast("Completed items removed. Press Z to undo.", "ok");
  }
  if (action === "ally-clear") {
    allyProposal = null;
    render();
  }
  if (action === "ally-accept-one") {
    const idx = Number(act.dataset.index);
    acceptAllyProposal(idx);
  }
  if (action === "ally-accept-all") {
    acceptAllAllyProposals();
  }
  if (action === "quick-commit") {
    const text = act.dataset.text || "";
    const estimateMin = Number(act.dataset.min) || 30;
    const targetId = $("#new-commit-target")?.value || state.targets.find((t) => t.status === "active")?.id;
    if (!targetId) {
      showToast("Create a target first.", "error");
      state.ui.tab = "targets";
      persist();
      return;
    }
    if ($("#new-commit-text")) $("#new-commit-text").value = text;
    if ($("#new-commit-min")) $("#new-commit-min").value = String(estimateMin);
    const payload = { text, targetId, estimateMin, mustKeep: false };
    if (shouldAskIntention(estimateMin)) {
      pendingIntention = payload;
      renderIntentionModal();
      return;
    }
    queueCommitment(payload);
  }
  if (action === "add-commit") {
    const text = $("#new-commit-text")?.value?.trim();
    const targetId = $("#new-commit-target")?.value;
    let estimateMin = Number($("#new-commit-min")?.value) || 30;
    const mustKeep = $("#new-commit-keep")?.checked;
    if (!text || !targetId) {
      showToast("Add a commitment and pick a target.", "error");
      return;
    }
    if (!Number.isFinite(estimateMin) || estimateMin < 15) {
      showToast("Estimate must be at least 15 minutes.", "error");
      return;
    }
    estimateMin = snapEstimateMin(estimateMin);
    if ($("#new-commit-min")) $("#new-commit-min").value = String(estimateMin);
    const payload = { text, targetId, estimateMin, mustKeep: !!mustKeep };
    if (shouldAskIntention(estimateMin)) {
      pendingIntention = payload;
      renderIntentionModal();
      return;
    }
    queueCommitment(payload);
  }
  if (action === "intention-confirm") {
    if (pendingIntention) queueCommitment(pendingIntention);
  }
  if (action === "intention-cancel") {
    pendingIntention = null;
    renderIntentionModal();
  }
  if (action === "intention-skip-session") {
    skipIntentionThisSession = true;
    state.ui.intentionSkipUntil = Date.now() + 4 * 60 * 60 * 1000;
    if (pendingIntention) queueCommitment(pendingIntention);
    else {
      persist();
      showToast("Intention checks paused for a few hours.", "ok");
    }
  }
  if (action === "done-commit") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    pushUndo({ type: "drop-commit", payload: { id: c.id, prevStatus: c.status } });
    c.status = "done";
    appendAudit(state, "commitment.done", c.text);
    persist();
    showToast("Marked done. Z undoes. Review can still log metric impact.", "ok");
  }
  if (action === "edit-commit") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c || c.status === "done") return;
    const text = prompt("Commitment text", c.text);
    if (text == null) return;
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) {
      showToast("Text cannot be empty.", "error");
      return;
    }
    const minsRaw = prompt("Estimate minutes", String(c.estimateMin));
    if (minsRaw == null) return;
    let mins = Number(minsRaw);
    if (!Number.isFinite(mins) || mins < 15) {
      showToast("Estimate must be at least 15 minutes.", "error");
      return;
    }
    mins = snapEstimateMin(mins);
    const activeTargets = state.targets.filter((t) => t.status === "active");
    if (activeTargets.length) {
      const labels = activeTargets.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
      const pick = prompt(
        `Target number (Enter keeps current):\n${labels}`,
        String(Math.max(1, activeTargets.findIndex((t) => t.id === c.targetId) + 1))
      );
      if (pick != null && String(pick).trim() !== "") {
        const idx = Number(pick) - 1;
        if (Number.isFinite(idx) && activeTargets[idx]) {
          c.targetId = activeTargets[idx].id;
        }
      }
    }
    c.text = trimmed;
    c.estimateMin = Math.round(mins);
    appendAudit(state, "commitment.edit", c.id);
    persist();
    showToast("Commitment updated.", "ok");
  }
  if (action === "toggle-must-keep") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c || c.status === "done") return;
    c.mustKeep = !c.mustKeep;
    appendAudit(state, "commitment.must_keep", `${c.id}:${c.mustKeep}`);
    persist();
    showToast(c.mustKeep ? "Protected as must-keep." : "Must-keep cleared.", "ok");
  }
  if (action === "prio-up") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    // Higher priority number = sacrificed first in replan (lower importance).
    c.priority = (Number.isFinite(c.priority) ? c.priority : 0) + 1;
    appendAudit(state, "commitment.priority", `${c.id}→${c.priority}`);
    persist();
  }
  if (action === "prio-down") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    c.priority = Math.max(0, (Number.isFinite(c.priority) ? c.priority : 0) - 1);
    appendAudit(state, "commitment.priority", `${c.id}→${c.priority}`);
    persist();
  }
  if (action === "drop-commit") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    if (c.mustKeep && !confirm(`“${c.text}” is must-keep. Drop it anyway?`)) return;
    pushUndo({ type: "drop-commit", payload: { id: c.id, prevStatus: c.status } });
    c.status = "dropped";
    appendAudit(state, "commitment.drop", c.text);
    persist();
    showToast("Dropped. Press Z to undo.", "ok");
  }
  if (action === "undo") {
    undoLast();
  }
  if (action === "discard-invalid-commitments") {
    const count = state.recovery?.invalidCommitments?.length || 0;
    if (!count) return;
    if (!confirm(`Remove ${count} quarantined saved commitment${count === 1 ? "" : "s"}?`)) {
      return;
    }
    discardInvalidCommitments(state);
    appendAudit(state, "state.recovery_discard", `${count} invalid commitment(s)`);
    persist();
  }
  if (action === "replan") {
    const pending = todayCommitments().filter((c) => c.status === "pending");
    const today = pending.map((c) => ({
      id: c.id,
      targetId: c.targetId,
      estimateMin: c.estimateMin,
      mustKeep: c.mustKeep,
      priority: c.priority || 0,
    }));
    if (!today.length) {
      showToast("Nothing pending to replan.", "ok");
      return;
    }
    const preview = replanToday({
      weeklyCapacityHours: state.user.weeklyCapacityHours,
      nightsPerWeek: state.user.nightsPerWeek,
      softCaps: softCaps(),
      weekOther: [],
      today,
    });
    const msg = `Replan will keep ${preview.keep.length}, drop ${preview.drop.length}, shrink ${preview.shrink.length}. Apply?`;
    if (!confirm(msg)) return;
    for (const d of preview.drop) {
      const c = state.commitments.find((x) => x.id === d);
      if (c) c.status = "dropped";
    }
    for (const s of preview.shrink) {
      const c = state.commitments.find((x) => x.id === s.id);
      if (c) c.estimateMin = s.newEstimateMin;
    }
    appendAudit(state, "plan.replan", preview.reasons.join("; "));
    showToast(
      `Replan: kept ${preview.keep.length}, dropped ${preview.drop.length}, shrunk ${preview.shrink.length}.`,
      "ok",
      4500
    );
    persist();
  }
  if (action === "bump-metric") {
    const t = state.targets.find((x) => x.id === id);
    if (!t?.metrics?.[0]) return;
    if (t.status !== "active") {
      showToast("Reactivate the target before logging progress.", "error");
      return;
    }
    const m = t.metrics[0];
    const step = m.minMeaningfulDelta || 1;
    const before = m.current;
    if (m.target >= m.baseline) m.current = Math.min(m.target, m.current + step);
    else m.current = Math.max(m.target, m.current - step);
    if (m.current === before) {
      showToast("Already at target — consider marking complete.", "ok");
      return;
    }
    appendAudit(state, "metric.bump", t.title);
    persist();
    const pct = targetProgressPct(m);
    showToast(`Progress logged · ~${pct}% of journey.`, "ok");
  }
  if (action === "pause-target") {
    const t = state.targets.find((x) => x.id === id);
    if (!t) return;
    t.status = "paused";
    appendAudit(state, "target.pause", t.title);
    persist();
    showToast("Target paused — it won’t appear in new plans.", "ok");
  }
  if (action === "complete-target") {
    const t = state.targets.find((x) => x.id === id);
    if (!t) return;
    if (!confirm(`Mark “${t.title}” complete?`)) return;
    t.status = "completed";
    appendAudit(state, "target.complete", t.title);
    persist();
    showToast("Target completed. Nice journey.", "ok");
  }
  if (action === "activate-target") {
    const t = state.targets.find((x) => x.id === id);
    if (!t) return;
    t.status = "active";
    appendAudit(state, "target.activate", t.title);
    persist();
    showToast("Target active again.", "ok");
  }
  if (action === "rename-target") {
    const t = state.targets.find((x) => x.id === id);
    if (!t) return;
    const next = prompt("Rename target", t.title);
    if (next == null) return;
    const title = next.trim().slice(0, 120);
    if (!title) {
      showToast("Title cannot be empty.", "error");
      return;
    }
    const prev = t.title;
    t.title = title;
    appendAudit(state, "target.rename", `${prev}→${title}`);
    persist();
    showToast("Target renamed.", "ok");
  }
  if (action === "review-done") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    pushUndo({ type: "drop-commit", payload: { id: c.id, prevStatus: c.status } });
    c.status = "done";
    c.metricDelta = true;
    const t = state.targets.find((x) => x.id === c.targetId);
    if (t?.metrics?.[0] && t.status === "active") {
      const m = t.metrics[0];
      const step = m.minMeaningfulDelta || 1;
      if (m.target >= m.baseline) m.current = Math.min(m.target, m.current + step);
      else m.current = Math.max(m.target, m.current - step);
    }
    appendAudit(state, "review.metric_path", c.text);
    persist();
    showToast("Done + metric. Z undoes status (not metric).", "ok");
  }
  if (action === "review-noimpact") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    c.status = "done";
    c.noImpactReason = "priority_shift";
    appendAudit(state, "review.no_impact", c.text);
    persist();
  }
  if (action === "review-all-noimpact") {
    const d = todayISO();
    const open = (state.commitments || []).filter((c) => c.planDate === d && c.status === "pending");
    if (!open.length) return;
    if (!confirm(`Close ${open.length} remaining item${open.length === 1 ? "" : "s"} as no-impact?`)) {
      return;
    }
    for (const c of open) {
      c.status = "done";
      c.noImpactReason = "bulk_close";
    }
    appendAudit(state, "review.bulk_no_impact", `${open.length}`);
    persist();
    showToast(`Closed ${open.length} as no-impact.`, "ok");
  }
  if (action === "grant-usage") {
    state.tutorial.permissions.usage = true;
    completeChapter("attention");
    persist();
    syncUsageTracker();
    showToast("Usage tracking on — AIly will log this tab’s attention.", "ok");
  }
  if (action === "flush-usage") {
    if (!usageTracker?.isRunning?.()) {
      showToast("Usage tracker is not running.", "error");
      return;
    }
    const mins = usageTracker.flush();
    if (mins > 0) showToast(`Flushed ${mins}m of AIly attention.`, "ok");
    else showToast("Less than a minute buffered — nothing to flush yet.", "ok");
    if (state.ui.tab === "usage") renderUsage();
  }
  if (action === "clear-usage") {
    const n = (state.usageSamples || []).length;
    if (!n) return;
    if (!confirm(`Clear ${n} usage sample${n === 1 ? "" : "s"} from this device?`)) return;
    state.usageSamples = [];
    appendAudit(state, "usage.clear", `${n}`);
    persist();
    showToast("Usage samples cleared.", "ok");
  }
  if (action === "toggle-arm") {
    const r = state.blockRules.find((x) => x.id === id);
    if (!r) return;
    if (!r.armed) {
      if (!canArmBlocks(state)) {
        showToast("Complete Attention map + Ally admin first.", "error");
        return;
      }
      r.armed = true;
      appendAudit(state, "block.arm", r.appKeys.join(","));
    } else {
      r.armed = false;
      appendAudit(state, "block.disarm", r.appKeys.join(","));
    }
    persist();
  }
  if (action === "break-glass") {
    const r = state.blockRules.find((x) => x.id === id);
    if (!r?.armed) return;
    startBreakGlass(r.id);
  }
  if (action === "delete-rule") {
    const before = (state.blockRules || []).length;
    state.blockRules = (state.blockRules || []).filter((r) => r.id !== id);
    if (state.blockRules.length < before) {
      appendAudit(state, "block.rule_delete", id);
      if (pendingBreakGlass?.ruleId === id) cancelBreakGlass();
      persist();
      showToast("Rule deleted.", "ok");
    }
  }
  if (action === "disarm-all") {
    let n = 0;
    for (const r of state.blockRules || []) {
      if (r.armed) {
        r.armed = false;
        n += 1;
      }
    }
    if (n) {
      appendAudit(state, "block.disarm_all", `${n}`);
      persist();
      showToast(`Disarmed ${n} rule${n === 1 ? "" : "s"}.`, "ok");
    }
  }
  if (action === "arm-all") {
    if (!canArmBlocks(state)) {
      showToast("Complete Attention map + Ally admin first.", "error");
      return;
    }
    let n = 0;
    for (const r of state.blockRules || []) {
      if (!r.armed && (r.appKeys || []).length) {
        r.armed = true;
        n += 1;
      }
    }
    if (n) {
      appendAudit(state, "block.arm_all", `${n}`);
      persist();
      showToast(`Armed ${n} rule${n === 1 ? "" : "s"}.`, "ok");
    }
  }
  if (action === "save-name") {
    state.user.displayName = ($("#setup-name")?.value || "").trim().slice(0, 80);
    appendAudit(state, "user.name", state.user.displayName || "(cleared)");
    persist();
    showToast(state.user.displayName ? `Hi, ${state.user.displayName}.` : "Name cleared.", "ok");
  }
  if (action === "save-display") {
    state.ui.density = $("#setup-compact")?.checked ? "compact" : "comfortable";
    state.ui.reduceMotion = !!$("#setup-reduce-motion")?.checked;
    appendAudit(state, "ui.display", `${state.ui.density},${state.ui.reduceMotion}`);
    persist();
    showToast("Display preferences saved.", "ok");
  }
  if (action === "clear-audit") {
    const n = (state.audit || []).length;
    if (!n) return;
    if (!confirm(`Clear ${n} activity log entries on this device?`)) return;
    state.audit = [];
    appendAudit(state, "audit.clear", `${n}`);
    persist();
    showToast("Activity log cleared.", "ok");
  }
  if (action === "export-audit") {
    const rows = state.audit || [];
    if (!rows.length) {
      showToast("Activity log is empty.", "ok");
      return;
    }
    const text = rows
      .map((a) => `${a.ts || ""}\t${a.tool || ""}\t${(a.detail || "").replace(/\t/g, " ")}`)
      .join("\n");
    const blob = new Blob([`ts\ttool\tdetail\n${text}\n`], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aily-audit-${todayISO()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    appendAudit(state, "audit.export", `${rows.length}`);
    persist();
    showToast("Audit TSV downloaded (local only).", "ok");
  }
  if (action === "start-focus-25") {
    startFocusMinutes(25);
  }
  if (action === "start-focus-50") {
    startFocusMinutes(50);
  }
  if (action === "extend-focus-10") {
    const ends = state.ui.focusSessionEndsAt || 0;
    if (!ends || ends <= Date.now()) {
      startFocusMinutes(10);
      return;
    }
    state.ui.focusSessionEndsAt = ends + 10 * 60_000;
    appendAudit(state, "focus.extend", "10m");
    persist();
    showToast("Focus extended +10m.", "ok");
  }
  if (action === "save-capacity") {
    const hours = Number($("#setup-hours")?.value);
    const nights = Number($("#setup-nights")?.value);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      showToast("Weekly hours must be between 1 and 168.", "error");
      return;
    }
    if (!Number.isFinite(nights) || nights < 1 || nights > 7) {
      showToast("Nights/week must be 1–7.", "error");
      return;
    }
    state.user.weeklyCapacityHours = hours;
    state.user.nightsPerWeek = nights;
    appendAudit(state, "capacity.save", `${hours}h / ${nights} nights`);
    persist();
    showToast("Capacity updated.", "ok");
  }
  if (action === "revoke-usage") {
    if (!confirm("Revoke usage tracking? Session auto-log stops; samples stay until you clear them.")) return;
    state.tutorial.permissions.usage = false;
    usageTracker?.stop();
    usageTracker = null;
    appendAudit(state, "permission.revoke", "usage");
    persist();
    showToast("Usage permission revoked.", "ok");
  }
  if (action === "revoke-admin") {
    if (!confirm("Revoke block admin? Armed rules will disarm.")) return;
    state.tutorial.permissions.blockAdmin = false;
    for (const r of state.blockRules || []) r.armed = false;
    appendAudit(state, "permission.revoke", "blockAdmin");
    persist();
    showToast("Block admin revoked; rules disarmed.", "ok");
  }
  if (action === "breakglass-cancel") {
    cancelBreakGlass();
  }
  if (action === "breakglass-confirm") {
    completeBreakGlass();
  }
  if (action === "set-delay") {
    const r = state.blockRules.find((x) => x.id === id);
    if (!r) return;
    const policy = breakGlassPolicy(r);
    const raw = prompt("Break-glass delay (seconds)", String(policy.delaySec));
    if (raw == null) return;
    let delaySec = Number(raw);
    if (!Number.isFinite(delaySec) || delaySec < 0) {
      showToast("Delay must be 0–600 seconds.", "error");
      return;
    }
    delaySec = Math.min(600, Math.floor(delaySec));
    r.breakGlass = {
      ...(r.breakGlass || {}),
      delaySec,
      requireReason: policy.requireReason,
      dailyLimit: policy.dailyLimit,
    };
    appendAudit(state, "block.delay", `${r.appKeys.join(",")}:${delaySec}`);
    persist();
    showToast(`Break-glass delay set to ${delaySec}s.`, "ok");
  }
  if (action === "reset-demo") {
    if (confirm("Reset all local AIly demo data?")) {
      usageTracker?.stop();
      usageTracker = null;
      if (pendingBreakGlass?.timer) window.clearInterval(pendingBreakGlass.timer);
      state = defaultState();
      lastSave = null;
      pendingIntention = null;
      allyProposal = null;
      pendingBreakGlass = null;
      helpOpen = false;
      updateBannerDismissed = false;
      persist();
      showToast("Demo data reset.", "ok");
    }
  }
  if (action === "seed-demo") {
    const hasData =
      (state.targets || []).length > 0 ||
      (state.commitments || []).length > 0 ||
      (state.blockRules || []).length > 0;
    if (hasData && !confirm("You already have data. Replace with a sample journey?")) return;
    if (!hasData && !confirm("Load a sample journey so you can explore AIly quickly?")) return;
    seedDemoJourney({ keepName: true });
  }
  if (action === "export-backup") {
    downloadBackup();
  }
  if (action === "copy-summary") {
    const week = weekJourneyStats(state);
    const lines = [
      `AIly ${SITE_VERSION.id} · local summary ${todayISO()}`,
      state.ui.dailyIntention ? `Intention: ${state.ui.dailyIntention}` : "Intention: (none)",
      `Today planned: ${plannedMinutes()}m · usage samples: ${dayUsageMinutes()}m`,
      `Week from ${week.start}: planned ${week.plannedMin}m · done ${week.doneMin}m · usage ${week.usageMin}m · glass ${week.glass}`,
      weekReflection(week),
      "Data stays on this device.",
    ];
    const text = lines.join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          appendAudit(state, "state.copy_summary", "ok");
          persist();
          showToast("Honesty summary copied.", "ok");
        },
        () => showToast("Could not copy.", "error")
      );
    } else {
      showToast("Clipboard unavailable.", "error");
    }
  }
  if (action === "dismiss-install") {
    state.ui.installBannerDismissed = true;
    persist();
  }
  if (action === "dismiss-update") {
    updateBannerDismissed = true;
    renderInstallBanner();
  }
  if (action === "apply-update") {
    const waiting = swRegistration?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    watchServiceWorkerUpdates._reloading = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    // Fallback if controllerchange is slow
    window.setTimeout(() => window.location.reload(), 800);
  }
  if (action === "install-app") {
    if (!deferredInstall) {
      showToast("Install isn’t available in this browser right now.", "error");
      return;
    }
    deferredInstall
      .prompt()
      .then(() => deferredInstall.userChoice)
      .then((choice) => {
        appendAudit(state, "app.install_prompt", choice?.outcome || "unknown");
        deferredInstall = null;
        persist();
      })
      .catch(() => {
        showToast("Install prompt failed.", "error");
      });
  }
  if (action === "apply-activity-filter") {
    state.ui.activityFilter = ($("#activity-filter")?.value || "").trim().slice(0, 80);
    persist();
  }
  if (action === "clear-activity-filter") {
    state.ui.activityFilter = "";
    persist();
  }
  if (action === "copy-version") {
    const text = `AIly ${SITE_VERSION.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast("Version copied.", "ok"),
        () => showToast(text, "ok", 4000)
      );
    } else {
      showToast(text, "ok", 4000);
    }
  }
});

window.addEventListener("online", () => {
  renderNetStatus();
  $("#tray-status").textContent = trayLabel();
});
window.addEventListener("offline", () => {
  renderNetStatus();
  $("#tray-status").textContent = trayLabel();
  showToast("You’re offline. AIly still works from the local shell.", "ok");
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  renderInstallBanner();
});

window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  state.ui.installBannerDismissed = true;
  appendAudit(state, "app.installed", SITE_VERSION.id);
  persist();
  showToast("AIly installed. Open it from your home screen.", "ok", 4500);
});

// First visit: open tutorial
if (!isReady(state)) state.ui.tutorialOpen = true;

render();
dismissBootSplash();
initNativeShell();
syncUsageTracker();
watchServiceWorkerUpdates();

document.addEventListener("visibilitychange", () => {
  usageTracker?.onVisibilityOrFocus();
  if (document.visibilityState === "hidden") {
    lastHiddenAt = Date.now();
    usageTracker?.flush();
  } else if (document.visibilityState === "visible" && lastHiddenAt) {
    const awayMin = (Date.now() - lastHiddenAt) / 60000;
    lastHiddenAt = 0;
    const msg = returnNudge({
      awayMin,
      intention: state.ui.dailyIntention || "",
      focusActive: focusRemainingMin() > 0,
    });
    if (msg) showToast(msg, "ok", 5500);
  }
});
window.addEventListener("focus", () => usageTracker?.onVisibilityOrFocus());
window.addEventListener("blur", () => usageTracker?.onVisibilityOrFocus());
window.addEventListener("pagehide", () => usageTracker?.flush());

// Focus tray tick (1s) when a session is active
window.setInterval(() => {
  if (document.visibilityState !== "visible") return;
  if (!focusRemainingLabel()) return;
  $("#tray-status").textContent = trayLabel();
  if (state.ui.tab === "today" && !state.ui.tutorialOpen) {
    // Light update: only tray is required every second; full today every 5s via other timer
  }
  if (state.ui.tab === "blocks" && !state.ui.tutorialOpen) {
    // keep blocks focus banner roughly current without full re-render thrash
  }
  const ended = endFocusSessionIfNeeded();
  if (ended) {
    persist();
    showToast("Focus session complete. How did you spend it?", "ok", 4000);
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        state.tutorial.permissions.notifications
      ) {
        new Notification("AIly · Focus complete", {
          body: state.ui.dailyIntention
            ? `Intention was: ${state.ui.dailyIntention.slice(0, 90)}`
            : "Pause — does the next hour still match what you want?",
          icon: "icons/icon-192.png",
          tag: "aily-focus-end",
        });
      }
    } catch {
      /* ignore */
    }
  }
}, 1000);

// Refresh session clock on Today occasionally while tab is visible
window.setInterval(() => {
  if (document.visibilityState === "visible" && !state.ui.tutorialOpen) {
    if (state.ui.tab === "today") renderToday();
    if (state.ui.tab === "usage" && state.tutorial.permissions.usage) renderUsage();
    if (state.ui.tab === "blocks") renderBlocks();
    $("#tray-status").textContent = trayLabel();
    renderNav();
  }
  // Periodic flush so multi-minute sessions land without waiting for hide
  if (usageTracker?.isRunning()) usageTracker.flush();
}, 30_000);

// Light keyboard nav for desktop dogfood (ignore when typing).
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.key === "Escape") {
    if (pendingBreakGlass) {
      cancelBreakGlass();
      return;
    }
    if (pendingIntention) {
      pendingIntention = null;
      renderIntentionModal();
      return;
    }
    if (state.ui.checkInOpen) {
      skipCheckIn();
      return;
    }
    if (state.ui.tutorialOpen) {
      state.ui.tutorialOpen = false;
      persist();
      return;
    }
    if (helpOpen) {
      helpOpen = false;
      renderHelpModal();
      return;
    }
    if (allyProposal) {
      allyProposal = null;
      render();
      return;
    }
    return;
  }
  const map = {
    "1": "today",
    "2": "targets",
    "3": "review",
    "4": "usage",
    "5": "blocks",
    "6": "setup",
    "7": "activity",
  };
  if (map[e.key]) {
    state.ui.tab = map[e.key];
    persist();
  }
  if (e.key === "f" || e.key === "F") {
    if (!focusRemainingLabel()) startFocusMinutes(25);
  }
  if (e.key === "?" && !state.ui.tutorialOpen) {
    helpOpen = true;
    renderHelpModal();
  }
  if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
    undoLast();
  }
  if (e.key === "u" || e.key === "U") {
    if (undoStack.length) undoLast();
  }
});
