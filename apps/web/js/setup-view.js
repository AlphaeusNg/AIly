import { dailySoftCapMinutes } from "./capacity.js";
import { CHAPTERS, canArmBlocks, chapterStatus, isReady } from "./tutorial.js";
import { SITE_VERSION } from "./version.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function storageLabel() {
  try {
    const raw = localStorage.getItem("aily.v1.state");
    return formatBytes(raw ? raw.length * 2 : 0);
  } catch {
    return "0 B";
  }
}

export function renderSetupPanel({
  element,
  state,
  tauri,
  standalone,
  canInstallPwa,
  windowsDownloadUrl,
  backupStale,
  undoCount,
  intentionPaused,
  onImport,
}) {
  const doneCh = CHAPTERS.filter((chapter) => chapterStatus(state, chapter.id) === "done").length;
  const setupPct = Math.round((doneCh / CHAPTERS.length) * 100);
  const dayCap = dailySoftCapMinutes(state.user.weeklyCapacityHours, state.user.nightsPerWeek);
  element.innerHTML = `
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
      ${CHAPTERS.map((chapter) => {
        const status = chapterStatus(state, chapter.id);
        return `<li>
          <span class="dot ${status}"></span>
          <strong>${escapeHtml(chapter.title)}</strong>
          <span class="muted">${status}${chapter.required ? " · required" : ""}</span>
        </li>`;
      }).join("")}
    </ul>
    <div class="card">
      <h2>Get AIly on this device</h2>
      <p class="muted">${
        tauri
          ? "You’re in the Windows package. Data lives in this app’s profile, not a random browser. OS app blocks are not in this build."
          : standalone
            ? "Running as an installed PWA. This is a browser app — not OS admin, and not AIly-setup.exe."
            : "Two different installs: a browser PWA now, or the Windows package (AIly-setup.exe) from GitHub Releases. Neither can hard-block apps yet."
      }</p>
      <div class="row">
        ${
          !standalone && canInstallPwa
            ? `<button type="button" class="primary" data-action="install-app">Install PWA</button>`
            : ""
        }
        ${
          tauri
            ? ""
            : `<a class="primary" href="${escapeHtml(windowsDownloadUrl)}" target="_blank" rel="noopener">Download Windows package</a>`
        }
      </div>
      <p class="muted">PWA stays in this browser profile. The Windows package is unsigned dogfood until a later signed MSIX. Auto-start stays off.</p>
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
      <p class="muted">Day soft cap ≈ ${dayCap | 0}m</p>
    </div>
    <div class="card">
      <h2>Display</h2>
      <div class="row">
        <label class="chk"><input type="checkbox" id="setup-compact" ${state.ui.density === "compact" ? "checked" : ""} /> Compact density</label>
        <label class="chk"><input type="checkbox" id="setup-reduce-motion" ${state.ui.reduceMotion ? "checked" : ""} /> Reduce motion</label>
        <label class="chk"><input type="checkbox" id="setup-contrast" ${state.ui.highContrast ? "checked" : ""} /> Higher contrast</label>
        <button type="button" data-action="save-display">Save display</button>
      </div>
      ${
        intentionPaused
          ? `<p class="muted">Intention checks are paused.
               <button type="button" data-action="resume-intention-checks">Resume now</button></p>`
          : ""
      }
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
        ${
          state.tutorial.permissions.notifications
            ? '<button type="button" data-action="notify-test">Test notification</button>'
            : '<button type="button" data-action="grant-notifications">Allow notifications</button>'
        }
      </div>
    </div>
    <div class="card">
      <h2>Take AIly with you</h2>
      <p class="muted">${
        backupStale
          ? "No recent backup on this device. Export a file before you switch browsers or install the Windows package — the PWA and the .exe do not share storage."
          : "Export stays on this device until you save the file. Import replaces current local state after confirmation."
      }</p>
      <div class="row">
        <button type="button" class="primary" data-action="export-backup">Export backup</button>
        <label class="chk file-pick">
          <span class="file-pick-label">Import backup…</span>
          <input type="file" id="import-backup" accept="application/json,.json" hidden />
        </label>
        <button type="button" data-action="export-audit">Export audit TSV</button>
        <button type="button" data-action="clear-audit">Clear activity log</button>
        <button type="button" data-action="seed-demo">Load sample journey</button>
        <button type="button" data-action="undo" ${undoCount ? "" : "disabled"}>Undo last</button>
        <button type="button" data-action="reset-demo">Reset demo data</button>
        <button type="button" data-action="open-help">Keyboard help</button>
      </div>
      <p class="muted">Version ${SITE_VERSION.id} · ${SITE_VERSION.tagline}</p>
      <p class="muted">Local store ≈ ${storageLabel()} · undo stack ${undoCount}</p>
      ${
        state.ui.lastExportAt
          ? `<p class="muted">Last backup: ${escapeHtml(state.ui.lastExportAt.slice(0, 19).replace("T", " "))}</p>`
          : `<p class="muted">No backup exported yet this device.</p>`
      }
    </div>
  `;
  element.querySelector("#import-backup")?.addEventListener("change", onImport);
  element.removeAttribute("aria-busy");
}
