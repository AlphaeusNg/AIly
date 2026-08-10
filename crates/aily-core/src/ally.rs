//! Local propose-only day planning (deterministic, no model).
//! Mirrors the web `ally.js` contract for shared honesty.

const FLOOR: u32 = 15;

#[derive(Debug, Clone)]
pub struct TargetHint {
    pub id: String,
    pub title: String,
    /// 0.0 ..= 1.0 journey progress (higher = closer to done).
    pub progress: f64,
    pub soft_hours: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct ExistingCommitment {
    pub id: String,
    pub target_id: String,
    pub estimate_min: u32,
    pub must_keep: bool,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proposal {
    pub text: String,
    pub target_id: String,
    pub estimate_min: u32,
    pub must_keep: bool,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct ProposeInput {
    pub weekly_capacity_hours: f64,
    pub nights_per_week: f64,
    pub targets: Vec<TargetHint>,
    pub soft_caps: Vec<(String, f64)>,
    pub existing_today: Vec<ExistingCommitment>,
    pub intention: String,
    pub max_items: usize,
}

#[derive(Debug, Clone)]
pub struct ProposeOutput {
    pub ok: bool,
    pub proposals: Vec<Proposal>,
    pub summary: String,
    pub remaining_min: u32,
    pub error: Option<String>,
}

fn clamp_estimate(min: f64) -> u32 {
    if !min.is_finite() || min < FLOOR as f64 {
        return FLOOR;
    }
    let snapped = ((min / 15.0).round() as u32) * 15;
    snapped.max(FLOOR)
}

fn daily_soft_cap_minutes(weekly_hours: f64, nights: f64) -> f64 {
    let n = nights.max(1.0);
    (weekly_hours * 60.0 / n).max(15.0)
}

fn day_fits(
    weekly_hours: f64,
    nights: f64,
    soft_caps: &[(String, f64)],
    existing: &[ExistingCommitment],
    proposals: &[Proposal],
    next: &Proposal,
) -> bool {
    let daily_cap = daily_soft_cap_minutes(weekly_hours, nights);
    let mut total = 0.0_f64;
    let mut per_goal: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

    let push = |tid: &str, mins: f64, total: &mut f64, per: &mut std::collections::HashMap<String, f64>| {
        *total += mins;
        *per.entry(tid.to_string()).or_insert(0.0) += mins;
    };

    for c in existing.iter().filter(|c| c.status != "dropped") {
        push(
            &c.target_id,
            c.estimate_min as f64,
            &mut total,
            &mut per_goal,
        );
    }
    for p in proposals {
        push(&p.target_id, p.estimate_min as f64, &mut total, &mut per_goal);
    }
    push(
        &next.target_id,
        next.estimate_min as f64,
        &mut total,
        &mut per_goal,
    );

    if total > daily_cap + 1e-9 {
        return false;
    }
    if soft_caps.len() >= 2 {
        let sum: f64 = soft_caps.iter().map(|(_, h)| *h).sum();
        if sum > weekly_hours + 1e-9 {
            return false;
        }
    }
    for (tid, hours) in soft_caps {
        let used = per_goal.get(tid).copied().unwrap_or(0.0);
        if used > hours * 60.0 + 1e-9 {
            return false;
        }
    }
    // Weekly global with today only (dogfood same as JS when weekOther empty).
    if total > weekly_hours * 60.0 + 1e-9 {
        return false;
    }
    true
}

/// Deterministic propose-only plan under capacity.
pub fn propose_day_plan(input: &ProposeInput) -> ProposeOutput {
    if !input.weekly_capacity_hours.is_finite()
        || input.weekly_capacity_hours <= 0.0
        || !input.nights_per_week.is_finite()
        || input.nights_per_week <= 0.0
    {
        return ProposeOutput {
            ok: false,
            proposals: vec![],
            summary: "Set a positive weekly capacity and nights/week first.".into(),
            remaining_min: 0,
            error: Some("invalid_capacity".into()),
        };
    }

    let active: Vec<&TargetHint> = input.targets.iter().filter(|t| !t.id.is_empty()).collect();
    if active.is_empty() {
        return ProposeOutput {
            ok: false,
            proposals: vec![],
            summary: "Create at least one active target before AIly can propose a plan.".into(),
            remaining_min: daily_soft_cap_minutes(
                input.weekly_capacity_hours,
                input.nights_per_week,
            ) as u32,
            error: Some("no_targets".into()),
        };
    }

    let daily_cap =
        daily_soft_cap_minutes(input.weekly_capacity_hours, input.nights_per_week) as u32;
    let used: u32 = input
        .existing_today
        .iter()
        .filter(|c| c.status != "dropped")
        .map(|c| c.estimate_min)
        .sum();
    let mut remaining = daily_cap.saturating_sub(used);
    let max_items = input.max_items.clamp(1, 6);
    let intention = input.intention.trim();

    if remaining < FLOOR {
        return ProposeOutput {
            ok: true,
            proposals: vec![],
            summary: "Today is already full under your soft cap. Drop or replan before adding more."
                .into(),
            remaining_min: remaining,
            error: None,
        };
    }

    let mut ranked = active;
    ranked.sort_by(|a, b| {
        a.progress
            .partial_cmp(&b.progress)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.title.cmp(&b.title))
    });

    if !intention.is_empty() {
        let lower = intention.to_lowercase();
        if let Some(idx) = ranked.iter().position(|t| {
            t.title
                .to_lowercase()
                .split_whitespace()
                .any(|w| w.len() > 2 && lower.contains(w))
        }) {
            if idx > 0 {
                let item = ranked.remove(idx);
                ranked.insert(0, item);
            }
        }
    }

    let mut proposals: Vec<Proposal> = Vec::new();

    for t in ranked {
        if proposals.len() >= max_items || remaining < FLOOR {
            break;
        }
        let slots_left = max_items - proposals.len();
        let mut slice = clamp_estimate(remaining as f64 / slots_left as f64);
        if let Some(soft) = t.soft_hours.filter(|h| *h > 0.0) {
            let soft_day = clamp_estimate(soft * 60.0 / input.nights_per_week.max(1.0));
            slice = slice.min(soft_day);
        }
        slice = slice.min(90).min(remaining);
        slice = clamp_estimate(slice as f64);
        if slice < FLOOR {
            continue;
        }

        let text = if !intention.is_empty() && proposals.is_empty() {
            format!(
                "Protect: {}",
                intention.chars().take(80).collect::<String>()
            )
        } else {
            format!("Progress: {}", t.title.chars().take(60).collect::<String>())
        };
        let reason = if !intention.is_empty() && proposals.is_empty() {
            "Anchored to today’s intention".to_string()
        } else {
            format!(
                "Lowest progress first ({}% journey)",
                (t.progress * 100.0).round() as i32
            )
        };
        let must_keep = proposals.is_empty() && !intention.is_empty();

        let mut draft = Proposal {
            text,
            target_id: t.id.clone(),
            estimate_min: slice,
            must_keep,
            reason,
        };

        if !day_fits(
            input.weekly_capacity_hours,
            input.nights_per_week,
            &input.soft_caps,
            &input.existing_today,
            &proposals,
            &draft,
        ) {
            draft.estimate_min = FLOOR;
            if !day_fits(
                input.weekly_capacity_hours,
                input.nights_per_week,
                &input.soft_caps,
                &input.existing_today,
                &proposals,
                &draft,
            ) {
                continue;
            }
        }

        remaining = remaining.saturating_sub(draft.estimate_min);
        proposals.push(draft);
    }

    let total: u32 = proposals.iter().map(|p| p.estimate_min).sum();
    let summary = if proposals.is_empty() {
        "No safe proposals fit remaining capacity.".into()
    } else {
        format!(
            "Proposed {} block{} (~{}m) under your ~{}m day soft cap. Accept only what you mean.",
            proposals.len(),
            if proposals.len() == 1 { "" } else { "s" },
            total,
            daily_cap
        )
    };

    ProposeOutput {
        ok: true,
        proposals,
        summary,
        remaining_min: remaining,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proposes_for_targets_under_cap() {
        let out = propose_day_plan(&ProposeInput {
            weekly_capacity_hours: 10.0,
            nights_per_week: 4.0,
            targets: vec![
                TargetHint {
                    id: "a".into(),
                    title: "Ship AIly".into(),
                    progress: 0.1,
                    soft_hours: Some(6.0),
                },
                TargetHint {
                    id: "b".into(),
                    title: "Health".into(),
                    progress: 0.8,
                    soft_hours: Some(4.0),
                },
            ],
            soft_caps: vec![("a".into(), 6.0), ("b".into(), 4.0)],
            existing_today: vec![],
            intention: "Ship AIly hard part".into(),
            max_items: 3,
        });
        assert!(out.ok);
        assert!(!out.proposals.is_empty());
        assert_eq!(out.proposals[0].target_id, "a");
        let total: u32 = out.proposals.iter().map(|p| p.estimate_min).sum();
        assert!(total <= 150);
    }

    #[test]
    fn empty_when_day_full() {
        let out = propose_day_plan(&ProposeInput {
            weekly_capacity_hours: 10.0,
            nights_per_week: 4.0,
            targets: vec![TargetHint {
                id: "a".into(),
                title: "Ship".into(),
                progress: 0.0,
                soft_hours: None,
            }],
            soft_caps: vec![],
            existing_today: vec![ExistingCommitment {
                id: "x".into(),
                target_id: "a".into(),
                estimate_min: 200,
                must_keep: false,
                status: "pending".into(),
            }],
            intention: String::new(),
            max_items: 3,
        });
        assert!(out.ok);
        assert!(out.proposals.is_empty());
    }

    #[test]
    fn requires_targets() {
        let out = propose_day_plan(&ProposeInput {
            weekly_capacity_hours: 10.0,
            nights_per_week: 4.0,
            targets: vec![],
            soft_caps: vec![],
            existing_today: vec![],
            intention: String::new(),
            max_items: 3,
        });
        assert!(!out.ok);
        assert_eq!(out.error.as_deref(), Some("no_targets"));
    }
}
