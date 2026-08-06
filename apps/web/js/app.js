import { SITE_VERSION } from "./version.js";
import {
  loadState,
  saveState,
  uid,
  todayISO,
  appendAudit,
  defaultState,
} from "./store.js";
import {
  checkPlanAccept,
  replanToday,
  errorLabel,
  dailySoftCapMinutes,
} from "./capacity.js";
import { CHAPTERS, canArmBlocks, isReady, chapterStatus } from "./tutorial.js";

let state = loadState();

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function persist() {
  saveState(state);
  render();
}

function softCaps() {
  const active = state.targets.filter((t) => t.status === "active");
  return active
    .filter((t) => t.softCapacityHours != null)
    .map((t) => ({ targetId: t.id, hours: t.softCapacityHours }));
}

function todayCommitments() {
  const d = todayISO();
  return state.commitments.filter((c) => c.planDate === d && c.status !== "dropped");
}

function render() {
  $("#brand-version").textContent = SITE_VERSION.id;
  $("#tray-status").textContent = trayLabel();
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
}

function trayLabel() {
  if (!isReady(state)) return "AIly · Setup";
  if (state.blockRules.some((r) => r.armed)) return "AIly · Focus";
  return "AIly · Ready";
}

function renderNav() {
  $$("[data-nav]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === state.ui.tab);
  });
  const badge = $("#setup-badge");
  if (badge) badge.classList.toggle("hidden", isReady(state));
}

function renderToday() {
  const el = $("#panel-today");
  const cap = state.user.weeklyCapacityHours;
  const daily = dailySoftCapMinutes(cap, state.user.nightsPerWeek);
  const today = todayCommitments();
  const used = today.reduce((a, c) => a + c.estimateMin, 0);
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
    ${!isReady(state) ? `<div class="banner warn">Finish Setup so AIly can guide your full journey. <button type="button" data-action="open-tutorial">Continue tutorial</button></div>` : ""}
    ${!check.ok ? `<div class="banner danger">${errorLabel(check.error)} <button type="button" data-action="replan">Force replan</button></div>` : `<div class="banner ok">Plan fits capacity.</div>`}
    <div class="row">
      <input id="new-commit-text" placeholder="Next commitment…" />
      <select id="new-commit-target">${state.targets
        .filter((t) => t.status === "active")
        .map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`)
        .join("")}</select>
      <input id="new-commit-min" type="number" min="15" step="15" value="30" style="width:5rem" />
      <label class="chk"><input type="checkbox" id="new-commit-keep" /> must-keep</label>
      <button type="button" class="primary" data-action="add-commit">Add</button>
    </div>
    <ul class="list">
      ${today
        .map((c) => {
          const t = state.targets.find((x) => x.id === c.targetId);
          return `<li>
            <strong>${escapeHtml(c.text)}</strong>
            <span class="muted">${c.estimateMin}m · ${escapeHtml(t?.title || "?")}${c.mustKeep ? " · must-keep" : ""}</span>
            <button type="button" data-action="drop-commit" data-id="${c.id}">Drop</button>
          </li>`;
        })
        .join("") || "<li class='muted'>No commitments yet — add one above.</li>"}
    </ul>
  `;
}

function renderTargets() {
  const el = $("#panel-targets");
  el.innerHTML = `
    <header class="panel-head">
      <h1>Targets</h1>
      <p class="muted">What you're journeying toward — with real metrics.</p>
    </header>
    <form id="target-form" class="card form">
      <h2>New target</h2>
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
      ${state.targets
        .map((t) => {
          const m = t.metrics[0];
          const pct = m
            ? Math.round(
                (Math.abs(m.current - m.baseline) / Math.abs(m.target - m.baseline || 1)) * 100
              )
            : 0;
          return `<li>
            <strong>${escapeHtml(t.title)}</strong>
            <span class="muted">${escapeHtml(m?.name || "")}: ${m?.current ?? "—"} / ${m?.target ?? "—"} ${escapeHtml(m?.unit || "")} (~${pct}%)</span>
            ${t.softCapacityHours != null ? `<span class="tag">${t.softCapacityHours}h soft</span>` : ""}
            <button type="button" data-action="bump-metric" data-id="${t.id}">+ progress</button>
          </li>`;
        })
        .join("") || "<li class='muted'>No targets yet.</li>"}
    </ul>
  `;
  $("#target-form")?.addEventListener("submit", onCreateTarget);
}

function renderReview() {
  const el = $("#panel-review");
  const d = todayISO();
  const list = state.commitments.filter((c) => c.planDate === d && c.status !== "dropped");
  el.innerHTML = `
    <header class="panel-head">
      <h1>Review</h1>
      <p class="muted">Evening honesty — evidence toward targets, or structured no-impact.</p>
    </header>
    <ul class="list">
      ${list
        .map(
          (c) => `<li class="review-item" data-id="${c.id}">
          <strong>${escapeHtml(c.text)}</strong>
          <div class="row">
            <button type="button" data-action="review-done" data-id="${c.id}">Done + metric</button>
            <button type="button" data-action="review-noimpact" data-id="${c.id}">No impact</button>
            <span class="muted">${c.status}</span>
          </div>
        </li>`
        )
        .join("") || "<li class='muted'>Nothing to review for today.</li>"}
    </ul>
  `;
}

function renderUsage() {
  const el = $("#panel-usage");
  const granted = state.tutorial.permissions.usage;
  el.innerHTML = `
    <header class="panel-head">
      <h1>Usage</h1>
      <p class="muted">App attention map — local only. Full OS tracking lands after platform hooks.</p>
    </header>
    ${
      granted
        ? `<div class="banner ok">Usage permission granted (dogfood: log sample apps below).</div>
           <form id="usage-form" class="row">
             <input name="app" placeholder="App name" required />
             <input name="mins" type="number" min="1" value="15" style="width:5rem" />
             <button class="primary" type="submit">Log sample usage</button>
           </form>
           <ul class="list">${(state.usageSamples || [])
             .map((u) => `<li>${escapeHtml(u.app)} · ${u.mins}m · ${u.ts.slice(0, 10)}</li>`)
             .join("") || "<li class='muted'>No samples yet.</li>"}</ul>`
        : `<div class="banner warn">Grant usage in Setup / tutorial chapter “Attention map”.</div>
           <button type="button" class="primary" data-action="grant-usage">Grant usage (dogfood)</button>`
    }
  `;
  $("#usage-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.usageSamples = state.usageSamples || [];
    state.usageSamples.unshift({
      app: String(fd.get("app")),
      mins: Number(fd.get("mins")),
      ts: new Date().toISOString(),
    });
    appendAudit(state, "usage.sample", String(fd.get("app")));
    persist();
  });
}

function renderBlocks() {
  const el = $("#panel-blocks");
  const ok = canArmBlocks(state);
  el.innerHTML = `
    <header class="panel-head">
      <h1>Blocks</h1>
      <p class="muted">Self-admin productivity blocks — ally, not prison. Break-glass always.</p>
    </header>
    ${
      ok
        ? `<div class="banner ok">Admin + usage granted. You may arm rules.</div>`
        : `<div class="banner warn">Complete Attention map + Ally admin in Setup before arming blocks.</div>`
    }
    <form id="block-form" class="row">
      <input name="app" placeholder="App key (e.g. firefox)" required />
      <select name="mode"><option value="soft">Soft delay</option><option value="hard">Hard block</option></select>
      <button class="primary" type="submit">Add rule</button>
    </form>
    <ul class="list">
      ${(state.blockRules || [])
        .map(
          (r) => `<li>
          <strong>${escapeHtml(r.appKeys.join(", "))}</strong>
          <span class="tag">${r.mode}</span>
          <span class="tag ${r.armed ? "armed" : ""}">${r.armed ? "armed" : "idle"}</span>
          <button type="button" data-action="toggle-arm" data-id="${r.id}">${r.armed ? "Disarm" : "Arm"}</button>
          <button type="button" data-action="break-glass" data-id="${r.id}">Break glass</button>
        </li>`
        )
        .join("") || "<li class='muted'>No block rules yet.</li>"}
    </ul>
  `;
  $("#block-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.blockRules = state.blockRules || [];
    state.blockRules.push({
      id: uid(),
      appKeys: [String(fd.get("app"))],
      mode: fd.get("mode") === "hard" ? "hard_block" : "soft_delay",
      armed: false,
      breakGlass: { delaySec: 30, requireReason: true },
    });
    appendAudit(state, "block.rule_add", String(fd.get("app")));
    persist();
  });
}

function renderSetup() {
  const el = $("#panel-setup");
  el.innerHTML = `
    <header class="panel-head">
      <h1>Setup</h1>
      <p class="muted">Tutorial checklist — AIly walks you through everything.</p>
    </header>
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
      <h2>Permissions</h2>
      <p>Usage: <strong>${state.tutorial.permissions.usage ? "on" : "off"}</strong>
         · Notifications: <strong>${state.tutorial.permissions.notifications ? "on" : "off"}</strong>
         · Block admin: <strong>${state.tutorial.permissions.blockAdmin ? "on" : "off"}</strong></p>
      <p class="muted">Can arm blocks: <strong>${canArmBlocks(state) ? "yes" : "no"}</strong></p>
      <button type="button" data-action="reset-demo">Reset demo data</button>
    </div>
  `;
}

function renderActivity() {
  const el = $("#panel-activity");
  el.innerHTML = `
    <header class="panel-head"><h1>Activity</h1>
    <p class="muted">What AIly recorded (local audit).</p></header>
    <ul class="list">
      ${(state.audit || [])
        .map((a) => `<li><code>${escapeHtml(a.tool)}</code> ${escapeHtml(a.detail || "")} <span class="muted">${a.ts}</span></li>`)
        .join("") || "<li class='muted'>No actions yet.</li>"}
    </ul>
  `;
}

function renderTutorialModal() {
  const modal = $("#tutorial-modal");
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
    };
    actions.appendChild(d);
  }
}

function allOptionalDone() {
  return CHAPTERS.every((c) => {
    const st = chapterStatus(state, c.id);
    return st === "done" || st === "skipped" || !c.required;
  });
}

function completeChapter(id) {
  state.tutorial.chapters[id] = "done";
  appendAudit(state, "tutorial.complete", id);
}

function grantAndComplete(chapter) {
  if (chapter.grant === "usage") state.tutorial.permissions.usage = true;
  if (chapter.grant === "blockAdmin") state.tutorial.permissions.blockAdmin = true;
  if (chapter.grant === "notifications") state.tutorial.permissions.notifications = true;
  completeChapter(chapter.id);
  appendAudit(state, "permission.grant", chapter.grant);
  persist();
}

function onCreateTarget(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const baseline = Number(fd.get("baseline"));
  const target = Number(fd.get("target"));
  if (baseline === target) {
    alert("Baseline and target must differ.");
    return;
  }
  const softRaw = fd.get("soft");
  const soft = softRaw === "" || softRaw == null ? null : Number(softRaw);
  const t = {
    id: uid(),
    title: String(fd.get("title")),
    status: "active",
    softCapacityHours: soft,
    metrics: [
      {
        name: String(fd.get("metric")),
        unit: String(fd.get("unit")),
        baseline,
        target,
        current: baseline,
        minMeaningfulDelta: Math.max(0.01, Math.abs(target - baseline) * 0.05),
      },
    ],
  };
  state.targets.push(t);
  // When ≥2 active targets, require soft caps that sum ≤ weekly (plan D14-style)
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

  if (action === "open-tutorial") {
    state.ui.tutorialOpen = true;
    persist();
  }
  if (action === "close-tutorial") {
    state.ui.tutorialOpen = false;
    persist();
  }
  if (action === "add-commit") {
    const text = $("#new-commit-text")?.value?.trim();
    const targetId = $("#new-commit-target")?.value;
    const estimateMin = Number($("#new-commit-min")?.value) || 30;
    const mustKeep = $("#new-commit-keep")?.checked;
    if (!text || !targetId) return;
    state.commitments.push({
      id: uid(),
      targetId,
      planDate: todayISO(),
      text,
      estimateMin,
      mustKeep: !!mustKeep,
      priority: 0,
      status: "pending",
    });
    appendAudit(state, "commitment.add", text);
    persist();
  }
  if (action === "drop-commit") {
    const c = state.commitments.find((x) => x.id === id);
    if (c) c.status = "dropped";
    persist();
  }
  if (action === "replan") {
    const today = todayCommitments().map((c) => ({
      id: c.id,
      targetId: c.targetId,
      estimateMin: c.estimateMin,
      mustKeep: c.mustKeep,
      priority: c.priority || 0,
    }));
    const out = replanToday({
      weeklyCapacityHours: state.user.weeklyCapacityHours,
      nightsPerWeek: state.user.nightsPerWeek,
      softCaps: softCaps(),
      weekOther: [],
      today,
    });
    for (const d of out.drop) {
      const c = state.commitments.find((x) => x.id === d);
      if (c) c.status = "dropped";
    }
    for (const s of out.shrink) {
      const c = state.commitments.find((x) => x.id === s.id);
      if (c) c.estimateMin = s.newEstimateMin;
    }
    appendAudit(state, "plan.replan", out.reasons.join("; "));
    alert(`Replan applied.\nKept ${out.keep.length}, dropped ${out.drop.length}, shrunk ${out.shrink.length}.`);
    persist();
  }
  if (action === "bump-metric") {
    const t = state.targets.find((x) => x.id === id);
    if (!t?.metrics?.[0]) return;
    const m = t.metrics[0];
    const step = m.minMeaningfulDelta || 1;
    if (m.target >= m.baseline) m.current = Math.min(m.target, m.current + step);
    else m.current = Math.max(m.target, m.current - step);
    appendAudit(state, "metric.bump", t.title);
    persist();
  }
  if (action === "review-done") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    c.status = "done";
    c.metricDelta = true;
    const t = state.targets.find((x) => x.id === c.targetId);
    if (t?.metrics?.[0]) {
      const m = t.metrics[0];
      const step = m.minMeaningfulDelta || 1;
      if (m.target >= m.baseline) m.current = Math.min(m.target, m.current + step);
      else m.current = Math.max(m.target, m.current - step);
    }
    appendAudit(state, "review.metric_path", c.text);
    persist();
  }
  if (action === "review-noimpact") {
    const c = state.commitments.find((x) => x.id === id);
    if (!c) return;
    c.status = "done";
    c.noImpactReason = "priority_shift";
    appendAudit(state, "review.no_impact", c.text);
    persist();
  }
  if (action === "grant-usage") {
    state.tutorial.permissions.usage = true;
    completeChapter("attention");
    persist();
  }
  if (action === "toggle-arm") {
    const r = state.blockRules.find((x) => x.id === id);
    if (!r) return;
    if (!r.armed) {
      if (!canArmBlocks(state)) {
        alert("Complete Attention map + Ally admin first.");
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
    const reason = prompt("Break glass — why? (logged)") || "unspecified";
    r.armed = false;
    appendAudit(state, "block.break_glass", `${r.appKeys.join(",")}: ${reason}`);
    persist();
  }
  if (action === "reset-demo") {
    if (confirm("Reset all local AIly demo data?")) {
      state = defaultState();
      persist();
    }
  }
});

// First visit: open tutorial
if (!isReady(state)) state.ui.tutorialOpen = true;

render();
