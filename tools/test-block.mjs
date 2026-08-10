/** Unit tests for block / break-glass helpers. */
import assert from "node:assert/strict";
import {
  breakGlassPolicy,
  breakGlassReady,
  breakGlassRemainingSec,
  breakGlassUsesToday,
  isAppBlocked,
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

console.log("test-block.mjs: break-glass and block match helpers passed");
