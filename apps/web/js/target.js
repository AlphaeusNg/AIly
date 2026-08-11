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
