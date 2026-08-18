/**
 * Local propose-only ally helpers (no cloud, no model download).
 * Deterministic suggestions the user can accept or ignore.
 */

import { checkPlanAccept, dailySoftCapMinutes } from "./capacity.js";
import { findSameDayDuplicate } from "./journey.js";
import { metricProgressRatio } from "./target.js";

const FLOOR = 15;

function clampEstimate(min) {
  if (!Number.isFinite(min) || min < FLOOR) return FLOOR;
  // Snap to 15m steps for dogfood friendliness.
  return Math.max(FLOOR, Math.round(min / 15) * 15);
}

/**
 * Existing Today ranking: must-keep first, then lower priority number,
 * then longer blocks. Same order the list and propose-adjacent pick use.
 */
export function rankCommitments(items) {
  return (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const mk = Number(!!b?.mustKeep) - Number(!!a?.mustKeep);
    if (mk) return mk;
    const pa = Number.isFinite(a?.priority) ? a.priority : 0;
    const pb = Number.isFinite(b?.priority) ? b.priority : 0;
    if (pa !== pb) return pa - pb;
    return (b?.estimateMin || 0) - (a?.estimateMin || 0);
  });
}

/**
 * Single next commitment the ally would start: first pending item
 * under the existing ranking.
 */
export function pickNextCommitment(items) {
  const pending = (Array.isArray(items) ? items : []).filter(
    (c) => c && c.status === "pending"
  );
  return rankCommitments(pending)[0] || null;
}

/**
 * Propose a capacity-honest set of commitments for today.
 * Never mutates state — pure.
 *
 * @param {{
 *   targets: Array,
 *   weeklyCapacityHours: number,
 *   nightsPerWeek: number,
 *   softCaps?: Array,
 *   existingToday?: Array,
 *   intention?: string,
 *   maxItems?: number,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   proposals: Array<{ text: string, targetId: string, estimateMin: number, mustKeep: boolean, reason: string }>,
 *   summary: string,
 *   remainingMin: number,
 *   error?: string,
 * }}
 */
export function proposeDayPlan(input) {
  const targets = Array.isArray(input?.targets)
    ? input.targets.filter((t) => t && t.status === "active" && t.id)
    : [];
  const weekly = input?.weeklyCapacityHours;
  const nights = input?.nightsPerWeek;
  if (!Number.isFinite(weekly) || weekly <= 0 || !Number.isFinite(nights) || nights <= 0) {
    return {
      ok: false,
      proposals: [],
      summary: "Set a positive weekly capacity and nights/week first.",
      remainingMin: 0,
      error: "invalid_capacity",
    };
  }
  if (!targets.length) {
    return {
      ok: false,
      proposals: [],
      summary: "Create at least one active target before AIly can propose a plan.",
      remainingMin: dailySoftCapMinutes(weekly, nights),
      error: "no_targets",
    };
  }

  const dailyCap = dailySoftCapMinutes(weekly, nights);
  const existing = Array.isArray(input?.existingToday) ? input.existingToday : [];
  const used = existing.reduce(
    (a, c) => a + (c && c.status !== "dropped" && Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
    0
  );
  let remaining = Math.max(0, dailyCap - used);
  const maxItems = Number.isFinite(input?.maxItems) ? Math.max(1, Math.min(6, input.maxItems)) : 3;
  const intention = typeof input?.intention === "string" ? input.intention.trim() : "";
  const softCaps = Array.isArray(input?.softCaps) ? input.softCaps : [];

  // Targets that already have pending work today — prefer other journeys first.
  const plannedTargetIds = new Set(
    existing
      .filter((c) => c && c.status === "pending" && c.targetId)
      .map((c) => c.targetId)
  );

  if (remaining < FLOOR) {
    return {
      ok: true,
      proposals: [],
      summary: "Today is already full under your soft cap. Drop or replan before adding more.",
      remainingMin: remaining,
    };
  }

  // Prefer targets furthest from their metric goal; stable by title for determinism.
  const ranked = targets
    .map((t) => ({
      target: t,
      progress: metricProgressRatio(t.metrics?.[0]),
      softHours:
        softCaps.find((s) => s.targetId === t.id)?.hours ??
        (Number.isFinite(t.softCapacityHours) ? t.softCapacityHours : null),
      alreadyPlanned: plannedTargetIds.has(t.id),
    }))
    .sort(
      (a, b) =>
        Number(a.alreadyPlanned) - Number(b.alreadyPlanned) ||
        a.progress - b.progress ||
        String(a.target.title).localeCompare(String(b.target.title))
    );

  const proposals = [];
  const intentionLower = intention.toLowerCase();

  // If intention mentions a target title, bias first slot toward that target.
  let order = ranked.slice();
  if (intention) {
    const hit = order.findIndex((r) =>
      String(r.target.title || "")
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 2 && intentionLower.includes(word.toLowerCase()))
    );
    if (hit > 0) {
      const [item] = order.splice(hit, 1);
      order.unshift(item);
    }
  }

  const existingTexts = new Set(
    existing
      .filter((c) => c && c.status !== "dropped" && typeof c.text === "string")
      .map((c) => c.text.trim().toLowerCase().replace(/\s+/g, " "))
  );

  for (const row of order) {
    if (proposals.length >= maxItems || remaining < FLOOR) break;
    const t = row.target;
    // Skip targets that already have pending work unless intention named them first.
    if (row.alreadyPlanned && !(intention && proposals.length === 0 && order[0] === row)) {
      continue;
    }
    // Share remaining across remaining slots, but leave room for later targets.
    const slotsLeft = maxItems - proposals.length;
    let slice = clampEstimate(remaining / slotsLeft);

    // Respect soft weekly hours as a soft daily share when present.
    if (row.softHours != null && row.softHours > 0) {
      const softDay = clampEstimate((row.softHours * 60) / Math.max(1, nights));
      slice = Math.min(slice, softDay);
    }
    // Cap deep work blocks for dogfood readability.
    slice = Math.min(slice, 90);
    slice = clampEstimate(slice);
    if (slice > remaining) slice = clampEstimate(remaining);
    if (slice < FLOOR) continue;

    const metric = t.metrics?.[0];
    const metricHint = metric?.name ? ` on ${metric.name}` : "";
    const text = intention && proposals.length === 0
      ? `Protect: ${intention.slice(0, 80)}`
      : `Progress: ${String(t.title).slice(0, 60)}${metricHint}`;
    const normText = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (existingTexts.has(normText) || proposals.some((p) => p.text.trim().toLowerCase().replace(/\s+/g, " ") === normText)) {
      continue;
    }

    const draft = {
      text,
      targetId: t.id,
      estimateMin: slice,
      mustKeep: proposals.length === 0 && !!intention,
      reason:
        proposals.length === 0 && intention
          ? "Anchored to today’s intention"
          : `Lowest progress first (${Math.round(row.progress * 100)}% journey)`,
    };

    const previewToday = [
      ...existing
        .filter((c) => c && c.status !== "dropped")
        .map((c) => ({
          id: c.id,
          targetId: c.targetId,
          estimateMin: c.estimateMin,
          mustKeep: !!c.mustKeep,
        })),
      ...proposals.map((p, i) => ({
        id: `prop-${i}`,
        targetId: p.targetId,
        estimateMin: p.estimateMin,
        mustKeep: p.mustKeep,
      })),
      {
        id: "prop-next",
        targetId: draft.targetId,
        estimateMin: draft.estimateMin,
        mustKeep: draft.mustKeep,
      },
    ];

    const check = checkPlanAccept({
      weeklyCapacityHours: weekly,
      nightsPerWeek: nights,
      softCaps,
      weekOther: [],
      today: previewToday,
    });
    if (!check.ok) {
      // Try smaller slice once.
      draft.estimateMin = FLOOR;
      previewToday[previewToday.length - 1].estimateMin = FLOOR;
      const retry = checkPlanAccept({
        weeklyCapacityHours: weekly,
        nightsPerWeek: nights,
        softCaps,
        weekOther: [],
        today: previewToday,
      });
      if (!retry.ok) continue;
    }

    proposals.push(draft);
    remaining -= draft.estimateMin;
  }

  // Always leave a small recovery buffer suggestion if room remains and we proposed deep work only.
  if (remaining >= 15 && proposals.length < maxItems && proposals.length > 0) {
    const buffer = clampEstimate(Math.min(15, remaining));
    const anchor = proposals[0];
    const draft = {
      text: "Buffer / break — protect recovery",
      targetId: anchor.targetId,
      estimateMin: buffer,
      mustKeep: false,
      reason: "Leave margin so the day stays honest",
    };
    const previewToday = [
      ...existing
        .filter((c) => c && c.status !== "dropped")
        .map((c) => ({
          id: c.id,
          targetId: c.targetId,
          estimateMin: c.estimateMin,
          mustKeep: !!c.mustKeep,
        })),
      ...proposals.map((p, i) => ({
        id: `prop-${i}`,
        targetId: p.targetId,
        estimateMin: p.estimateMin,
        mustKeep: p.mustKeep,
      })),
      {
        id: "prop-buffer",
        targetId: draft.targetId,
        estimateMin: draft.estimateMin,
        mustKeep: false,
      },
    ];
    const check = checkPlanAccept({
      weeklyCapacityHours: weekly,
      nightsPerWeek: nights,
      softCaps,
      weekOther: [],
      today: previewToday,
    });
    if (check.ok) {
      proposals.push(draft);
      remaining -= buffer;
    }
  }

  const summary = proposals.length
    ? `Proposed ${proposals.length} block${proposals.length === 1 ? "" : "s"} (~${proposals.reduce((a, p) => a + p.estimateMin, 0)}m) under your ~${Math.round(dailyCap)}m day soft cap. Accept only what you mean.`
    : "No safe proposals fit remaining capacity.";

  return {
    ok: true,
    proposals,
    summary,
    remainingMin: remaining,
  };
}

/**
 * Preview what accept-all would add or skip — never mutates.
 * Reasons: inactive | duplicate | capacity error from checkPlanAccept.
 *
 * @param {{
 *   proposals: Array,
 *   existingToday?: Array,
 *   allCommitments?: Array,
 *   targets: Array,
 *   weeklyCapacityHours: number,
 *   nightsPerWeek: number,
 *   softCaps?: Array,
 *   planDate: string,
 * }} input
 * @returns {{
 *   added: Array,
 *   skipped: Array<{ text?: string, targetId?: string, estimateMin?: number, reason: string }>,
 *   addedMin: number,
 *   remainingMin: number,
 *   dailyCapMin: number,
 * }}
 */
export function previewAcceptAll(input) {
  const proposals = Array.isArray(input?.proposals) ? input.proposals : [];
  const targets = Array.isArray(input?.targets) ? input.targets : [];
  const existingToday = Array.isArray(input?.existingToday) ? input.existingToday : [];
  const planDate = typeof input?.planDate === "string" ? input.planDate : "";
  const working = existingToday
    .filter((c) => c && c.status !== "dropped")
    .map((c) => ({
      id: c.id,
      targetId: c.targetId,
      estimateMin: c.estimateMin,
      mustKeep: !!c.mustKeep,
    }));
  const seen = Array.isArray(input?.allCommitments) ? input.allCommitments.slice() : existingToday.slice();
  const added = [];
  const skipped = [];

  for (const p of proposals) {
    if (!p) {
      skipped.push({ reason: "inactive" });
      continue;
    }
    const active = targets.some((t) => t && t.id === p.targetId && t.status === "active");
    if (!active) {
      skipped.push({ ...p, reason: "inactive" });
      continue;
    }
    const dup = findSameDayDuplicate(seen.concat(added), {
      planDate,
      text: p.text,
    });
    if (dup.duplicate) {
      skipped.push({ ...p, reason: "duplicate" });
      continue;
    }
    const draft = {
      id: `preview-${added.length}`,
      targetId: p.targetId,
      estimateMin: p.estimateMin,
      mustKeep: !!p.mustKeep,
      text: p.text,
      status: "pending",
      planDate,
    };
    const check = checkPlanAccept({
      weeklyCapacityHours: input?.weeklyCapacityHours,
      nightsPerWeek: input?.nightsPerWeek,
      softCaps: Array.isArray(input?.softCaps) ? input.softCaps : [],
      weekOther: [],
      today: [
        ...working,
        ...added.map((c) => ({
          id: c.id,
          targetId: c.targetId,
          estimateMin: c.estimateMin,
          mustKeep: !!c.mustKeep,
        })),
        {
          id: draft.id,
          targetId: draft.targetId,
          estimateMin: draft.estimateMin,
          mustKeep: draft.mustKeep,
        },
      ],
    });
    if (!check.ok) {
      skipped.push({ ...p, reason: check.error || "capacity" });
      continue;
    }
    added.push(draft);
  }

  const used = working.concat(added).reduce(
    (a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0),
    0
  );
  const dailyCapMin = dailySoftCapMinutes(input?.weeklyCapacityHours, input?.nightsPerWeek);
  return {
    added,
    skipped,
    addedMin: added.reduce((a, c) => a + (Number.isFinite(c.estimateMin) ? c.estimateMin : 0), 0),
    remainingMin: Math.max(0, dailyCapMin - used),
    dailyCapMin,
  };
}

/**
 * Return-from-away check-in. A real question the UI can answer, plus
 * a single `text` line for logs / tests.
 * @param {{
 *   awayMin: number,
 *   intention?: string,
 *   focusActive?: boolean,
 *   openPending?: number,
 *   plannedMin?: number,
 * }} ctx
 * @returns {null | {
 *   question: string,
 *   text: string,
 *   awayMin: number,
 *   intention: string,
 *   focusActive: boolean,
 *   openPending: number,
 *   plannedMin: number,
 *   stillYes: string,
 *   stillNo: string,
 *   chooseNext: string,
 * }}
 */
export function returnNudge(ctx) {
  const away = Number.isFinite(ctx?.awayMin) ? ctx.awayMin : 0;
  if (away < 5) return null;
  const intention = typeof ctx?.intention === "string" ? ctx.intention.trim() : "";
  const open = Number.isFinite(ctx?.openPending) ? Math.max(0, Math.floor(ctx.openPending)) : 0;
  const planned = Number.isFinite(ctx?.plannedMin) ? Math.max(0, Math.round(ctx.plannedMin)) : 0;
  const awayRounded = Math.round(away);
  const planHint =
    open > 0
      ? ` You still have ${open} open item${open === 1 ? "" : "s"}${planned > 0 ? ` (~${planned}m planned)` : ""}.`
      : "";
  const question = intention
    ? `Still protecting ${intention.slice(0, 80)}?`
    : ctx?.focusActive
      ? "Is this still what you want to focus on?"
      : "What do you want the next stretch to be for?";
  let text;
  if (ctx?.focusActive) {
    text = `Welcome back (${awayRounded}m away). Focus is still on — is this still what you want?${planHint}`;
  } else if (intention) {
    text = `Welcome back (${awayRounded}m away). Your intention was “${intention.slice(0, 80)}”. Still true?${planHint}`;
  } else if (open > 0) {
    text = `Welcome back (${awayRounded}m away).${planHint} Pause — re-choose the next stretch intentionally.`;
  } else {
    text = `Welcome back (${awayRounded}m away). Pause — what do you want the next stretch to be for?`;
  }
  return {
    question,
    text,
    awayMin: awayRounded,
    intention,
    focusActive: !!ctx?.focusActive,
    openPending: open,
    plannedMin: planned,
    stillYes: intention ? "Yes — still this" : "Yes — keep going",
    stillNo: "No — change intention",
    chooseNext: "I'll choose next",
  };
}
