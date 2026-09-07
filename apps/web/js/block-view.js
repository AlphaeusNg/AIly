import { breakGlassPolicy, breakGlassUsesToday } from "./block.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBlocksPanel({
  element,
  state,
  canArm,
  focusRemaining,
  today,
  onAddRule,
  onTryOpen,
}) {
  const armedCount = (state.blockRules || []).filter((rule) => rule.armed).length;
  element.innerHTML = `
    <header class="panel-head">
      <h1>Blocks</h1>
      <p class="muted">Self-admin productivity blocks — ally, not prison. Break-glass always.</p>
    </header>
    ${
      canArm
        ? `<div class="banner ok">Admin + usage granted. ${armedCount} rule${armedCount === 1 ? "" : "s"} armed.</div>`
        : `<div class="banner warn">Complete Attention map + Ally admin in Setup before arming blocks.</div>`
    }
    ${
      focusRemaining
        ? `<div class="banner focus-armed">Focus session active · ${focusRemaining} left. Armed rules protect this window.</div>`
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
        .slice()
        .sort(
          (a, b) =>
            Number(!!b.armed) - Number(!!a.armed) ||
            String(a.appKeys?.[0] || "").localeCompare(String(b.appKeys?.[0] || "")),
        )
        .map((rule) => {
          const policy = breakGlassPolicy(rule);
          return `<li>
          <strong>${escapeHtml(rule.appKeys.join(", "))}</strong>
          <span class="tag">${rule.mode}</span>
          <span class="tag ${rule.armed ? "armed" : ""}">${rule.armed ? "armed" : "idle"}</span>
          <span class="muted">${policy.delaySec}s glass</span>
          <button type="button" data-action="toggle-arm" data-id="${rule.id}">${rule.armed ? "Disarm" : "Arm"}</button>
          <button type="button" data-action="toggle-block-mode" data-id="${rule.id}">${
            rule.mode === "hard_block" ? "Make soft" : "Make hard"
          }</button>
          <button type="button" data-action="break-glass" data-id="${rule.id}" ${rule.armed ? "" : "disabled"}>Break glass</button>
          <button type="button" data-action="rename-rule-app" data-id="${rule.id}">App key</button>
          <button type="button" data-action="set-delay" data-id="${rule.id}">Delay</button>
          <button type="button" data-action="set-daily-limit" data-id="${rule.id}">Limit</button>
          <button type="button" data-action="delete-rule" data-id="${rule.id}">Delete</button>
        </li>`;
        })
        .join("") || "<li class='muted'>No block rules yet.</li>"}
    </ul>
    <div class="row">
      <button type="button" data-action="disarm-all" ${state.blockRules.some((rule) => rule.armed) ? "" : "disabled"}>Disarm all</button>
      <button type="button" data-action="arm-all" ${canArm && state.blockRules.some((rule) => !rule.armed) ? "" : "disabled"}>Arm all</button>
    </div>
    <p class="muted">Break-glass uses today: ${breakGlassUsesToday(state.audit || [], today)}${
      (() => {
        const uses = breakGlassUsesToday(state.audit || [], today);
        const limits = (state.blockRules || [])
          .map((rule) => breakGlassPolicy(rule).dailyLimit)
          .filter((limit) => limit != null);
        if (!limits.length) return "";
        const limit = Math.min(...limits);
        return ` · tightest daily limit ${limit}${uses >= limit ? " (at/over)" : ""}`;
      })()
    }</p>
  `;

  element.querySelector("#block-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    let delaySec = Number(form.get("delay"));
    if (!Number.isFinite(delaySec) || delaySec < 0) delaySec = 30;
    onAddRule({
      app: String(form.get("app") || "").trim(),
      mode: form.get("mode") === "hard" ? "hard_block" : "soft_delay",
      delaySec: Math.min(600, Math.floor(delaySec)),
    });
  });
  element.querySelector("#try-open-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    onTryOpen(String(form.get("app") || ""));
  });
}
