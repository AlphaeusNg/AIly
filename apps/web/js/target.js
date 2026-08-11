/** Direction-aware target metric progress shared by the UI and local ally. */

export function metricProgressRatio(metric) {
  const baseline = metric?.baseline;
  const target = metric?.target;
  const current = metric?.current;
  if (![baseline, target, current].every(Number.isFinite)) return 0;

  const delta = target - baseline;
  const span = Math.abs(delta);
  if (span === 0) return 0;

  const movement = delta > 0 ? current - baseline : baseline - current;
  return Math.min(1, Math.max(0, movement / span));
}

export function metricProgressPct(metric) {
  return Math.round(metricProgressRatio(metric) * 100);
}

/** True when higher current is better (target >= baseline). */
export function metricIsUpward(metric) {
  if (!metric) return true;
  if (![metric.baseline, metric.target].every(Number.isFinite)) return true;
  return metric.target >= metric.baseline;
}

/**
 * Step current toward target by minMeaningfulDelta (or 1).
 * @returns {{ next: number, moved: boolean, complete: boolean }}
 */
export function stepMetricTowardTarget(metric) {
  if (!metric || ![metric.baseline, metric.target, metric.current].every(Number.isFinite)) {
    return { next: metric?.current, moved: false, complete: false };
  }
  const step = Number.isFinite(metric.minMeaningfulDelta) && metric.minMeaningfulDelta > 0
    ? metric.minMeaningfulDelta
    : 1;
  const upward = metricIsUpward(metric);
  let next = metric.current;
  if (upward) next = Math.min(metric.target, metric.current + step);
  else next = Math.max(metric.target, metric.current - step);
  const complete = upward ? next >= metric.target : next <= metric.target;
  return { next, moved: next !== metric.current, complete };
}

/**
 * Soft-cap sum check when ≥2 caps present (mirrors capacity soft_sum_over).
 * @returns {{ ok: boolean, sum: number, weekly: number, error?: string }}
 */
export function checkSoftCapSum(softCaps, weeklyCapacityHours) {
  const weekly = Number(weeklyCapacityHours);
  if (!Number.isFinite(weekly) || weekly < 0) {
    return { ok: false, sum: 0, weekly: 0, error: "invalid_weekly" };
  }
  const caps = Array.isArray(softCaps) ? softCaps : [];
  const hours = caps
    .map((s) => (s && Number.isFinite(s.hours) ? s.hours : null))
    .filter((h) => h != null && h > 0);
  const sum = hours.reduce((a, h) => a + h, 0);
  if (hours.length >= 2 && sum > weekly + 1e-9) {
    return { ok: false, sum, weekly, error: "soft_sum_over" };
  }
  return { ok: true, sum, weekly };
}
