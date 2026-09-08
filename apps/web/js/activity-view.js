function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function friendlyAuditTool(tool) {
  const labels = {
    "commitment.add": "Added commitment",
    "commitment.done": "Marked done",
    "commitment.edit": "Edited commitment",
    "commitment.priority": "Changed priority",
    "commitment.must_keep": "Toggled must-keep",
    "commitment.drop": "Dropped commitment",
    "commitment.reopen": "Reopened commitment",
    "commitment.estimate": "Adjusted estimate",
    "plan.defer_one": "Deferred one item",
    "target.create": "Created target",
    "target.pause": "Paused target",
    "target.complete": "Completed target",
    "target.complete_drop": "Dropped pending on complete",
    "target.activate": "Reactivated target",
    "target.duplicate": "Duplicated target",
    "target.rename": "Renamed target",
    "target.soft": "Edited soft hours",
    "block.mode": "Toggled block mode",
    "undo.drop": "Undid drop",
    "undo.hide_done": "Undid hide-done",
    "checkin.save": "Daily intention",
    "checkin.skip": "Skipped check-in",
    "checkin.clear": "Cleared intention",
    "focus.start": "Focus started",
    "focus.end": "Focus ended",
    "focus.extend": "Focus extended",
    "focus.pause": "Focus paused",
    "focus.resume": "Focus resumed",
    "metric.bump": "Logged progress",
    "metric.nudge_back": "Reversed progress",
    "metric.snap_goal": "Snapped metric to goal",
    "metric.set": "Set metric value",
    "metric.step": "Edited progress step",
    "target.soft_scale": "Scaled soft caps",
    "target.soft_share": "Shared soft hours evenly",
    "plan.defer_tomorrow": "Deferred open items",
    "plan.copy_one_tomorrow": "Copied item to tomorrow",
    "undo.defer_tomorrow": "Undid defer-to-tomorrow",
    "undo.replan": "Undid replan",
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
    "usage.clear_today": "Cleared today’s usage",
    "usage.remove": "Removed usage sample",
    "state.export_week": "Exported week honesty",
    "plan.replan": "Replanned day",
    "tutorial.complete": "Tutorial step",
    "permission.grant": "Granted permission",
    "permission.denied": "Permission denied",
    "permission.dismissed": "Permission prompt dismissed",
    "permission.unavailable": "Permission unavailable",
    "permission.error": "Permission check failed",
    "permission.reconcile": "Permission reconciled",
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
    "block.rule_rename": "Renamed rule app key",
    "block.disarm_all": "Disarmed all rules",
    "block.arm_all": "Armed all rules",
    "block.delay": "Changed break-glass delay",
    "block.limit": "Changed daily glass limit",
    "capacity.save": "Saved capacity",
    "permission.revoke": "Revoked permission",
    "user.name": "Saved display name",
    "ui.display": "Saved display prefs",
    "audit.clear": "Cleared activity log",
    "audit.export": "Exported audit TSV",
    "audit.prune": "Pruned old activity",
    "intention.resume": "Resumed intention checks",
    "intention.snooze": "Snoozed intention checks",
    "notify.test": "Test notification",
    "plan.clone_yesterday": "Cloned yesterday’s plan",
    "plan.hide_done": "Hid completed items",
    "plan.export_today": "Exported today plan",
    "plan.copy_today": "Copied today plan",
    "plan.pull_stale": "Pulled stale items to today",
    "plan.drop_stale": "Dropped stale items",
    "review.bulk_no_impact": "Bulk no-impact close",
    "review.bulk_metric": "Bulk done + metric",
  };
  return labels[tool] || tool;
}

export function renderActivityPanel({ element, audit, activityFilter, onFilter }) {
  const filter = (activityFilter || "").trim().toLowerCase();
  const rows = audit.filter((entry) => {
    if (!filter) return true;
    const haystack = `${entry.tool || ""} ${entry.detail || ""} ${friendlyAuditTool(entry.tool)}`.toLowerCase();
    return haystack.includes(filter);
  });
  element.innerHTML = `
    <header class="panel-head"><h1>Activity</h1>
    <p class="muted">What AIly recorded (local audit — never leaves this device).</p></header>
    <div class="row">
      <input id="activity-filter" type="search" placeholder="Filter log…" value="${escapeHtml(activityFilter || "")}" />
      <button type="button" data-action="apply-activity-filter">Filter</button>
      ${filter ? `<button type="button" data-action="clear-activity-filter">Clear</button>` : ""}
      <button type="button" data-action="prune-audit" ${audit.length ? "" : "disabled"}>Prune &gt;45d</button>
    </div>
    <p class="muted">${rows.length} shown${filter ? ` · filter “${escapeHtml(filter)}”` : ""} · ${audit.length} total</p>
    <ul class="list">
      ${rows
        .map((entry) => {
          const when = typeof entry.ts === "string" ? entry.ts.slice(0, 16).replace("T", " ") : "";
          return `<li>
            <strong>${escapeHtml(friendlyAuditTool(entry.tool))}</strong>
            <span class="muted">${escapeHtml(entry.detail || "")}</span>
            <span class="muted">${when}</span>
          </li>`;
        })
        .join("") || "<li class='muted'>No actions yet. Use Today, Targets, or Blocks to begin.</li>"}
    </ul>
  `;
  element.querySelector("#activity-filter")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") onFilter(event.target.value || "");
  });
}
