/** Unit tests for block / break-glass helpers. */
import assert from "node:assert/strict";
import {
  appKeyMatches,
  breakGlassPolicy,
  breakGlassReady,
  breakGlassRemainingSec,
  breakGlassUsesToday,
  findRuleForApp,
  formatFocusRemaining,
  isAppBlocked,
  upsertBlockRule,
  validateBreakGlassComplete,
} from "../apps/web/js/block.js";

const policy = breakGlassPolicy({
  breakGlass: { delaySec: 10, requireReason: true, dailyLimit: 3 },
});
assert.equal(policy.delaySec, 10);
assert.equal(policy.requireReason, true);
assert.equal(policy.dailyLimit, 3);

assert.equal(breakGlassPolicy(null).delaySec, 30, "defaults delay");
assert.equal(breakGlassPolicy({}).requireReason, true, "defaults require reason");

const start = 1_000_000;
assert.equal(breakGlassReady(start, 30, start + 29_000), false);
assert.equal(breakGlassReady(start, 30, start + 30_000), true);
assert.equal(breakGlassRemainingSec(start, 30, start + 10_000), 20);
assert.equal(breakGlassRemainingSec(start, 30, start + 40_000), 0);

const early = validateBreakGlassComplete({
  startedAtMs: start,
  delaySec: 30,
  requireReason: true,
  reason: "need a tool",
  nowMs: start + 5_000,
});
assert.equal(early.ok, false);
assert.match(early.error, /Wait/i);

const noReason = validateBreakGlassComplete({
  startedAtMs: start,
  delaySec: 5,
  requireReason: true,
  reason: " ",
  nowMs: start + 10_000,
});
assert.equal(noReason.ok, false);
assert.match(noReason.error, /reason/i);

const ok = validateBreakGlassComplete({
  startedAtMs: start,
  delaySec: 5,
  requireReason: true,
  reason: "need docs",
  nowMs: start + 10_000,
  usesToday: 1,
  dailyLimit: 5,
});
assert.equal(ok.ok, true);

const limited = validateBreakGlassComplete({
  startedAtMs: start,
  delaySec: 0,
  requireReason: false,
  reason: "",
  nowMs: start,
  usesToday: 5,
  dailyLimit: 5,
});
assert.equal(limited.ok, false);
assert.match(limited.error, /limit/i);

const uses = breakGlassUsesToday(
  [
    { tool: "block.break_glass", ts: "2026-08-11T08:00:00.000Z" },
    { tool: "block.arm", ts: "2026-08-11T09:00:00.000Z" },
    { tool: "block.break_glass", ts: "2026-08-10T08:00:00.000Z" },
  ],
  "2026-08-11"
);
assert.equal(uses, 1);

const rules = [
  { id: "1", armed: true, appKeys: ["Firefox", "chrome"] },
  { id: "2", armed: false, appKeys: ["Slack"] },
];
assert.equal(isAppBlocked(rules, "firefox")?.id, "1");
assert.equal(isAppBlocked(rules, "slack"), null);
assert.equal(isAppBlocked(rules, "Notion"), null);

assert.equal(appKeyMatches("youtube", "youtube"), true);
assert.equal(appKeyMatches("youtube", "com.google.android.youtube"), true);
assert.equal(appKeyMatches("com.google.android.youtube", "youtube"), true);
assert.equal(appKeyMatches("yt", "youtube"), false, "short keys stay exact-only");
assert.equal(
  isAppBlocked(
    [{ id: "yt", armed: true, appKeys: ["youtube"] }],
    "com.google.android.youtube"
  )?.id,
  "yt"
);

assert.equal(findRuleForApp(rules, "Slack")?.id, "2");
const upserted = upsertBlockRule(rules, {
  appKeys: ["Firefox"],
  mode: "hard",
  delaySec: 45,
});
assert.equal(upserted.merged, true);
assert.equal(upserted.rule.mode, "hard_block");
assert.equal(upserted.rule.breakGlass.delaySec, 45);
assert.equal(upserted.rules.length, 2, "does not duplicate Firefox rule");

const added = upsertBlockRule(upserted.rules, { app: "YouTube", delaySec: 10 });
assert.equal(added.merged, false);
assert.equal(added.rules.length, 3);

const now = 1_000_000;
assert.equal(formatFocusRemaining(now + 10 * 60_000, now), "10m");
assert.equal(formatFocusRemaining(now + 90_000, now), "1:30");
assert.equal(formatFocusRemaining(now - 1000, now), null);

console.log("test-block.mjs: break-glass and block match helpers passed");
