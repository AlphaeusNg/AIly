use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetStatus {
    Active,
    Paused,
    Done,
    Abandoned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetricDirection {
    Up,
    Down,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metric {
    pub name: String,
    pub unit: String,
    pub direction: MetricDirection,
    pub baseline: f64,
    pub target: f64,
    pub current: f64,
    /// Minimum meaningful movement; default 5% of |target − baseline|.
    pub min_meaningful_delta: f64,
}

impl Metric {
    pub fn new(
        name: impl Into<String>,
        unit: impl Into<String>,
        baseline: f64,
        target_val: f64,
    ) -> Result<Self, String> {
        if (baseline - target_val).abs() < f64::EPSILON {
            return Err("baseline and target must differ".into());
        }
        let span = (target_val - baseline).abs();
        Ok(Self {
            name: name.into(),
            unit: unit.into(),
            direction: if target_val >= baseline {
                MetricDirection::Up
            } else {
                MetricDirection::Down
            },
            baseline,
            target: target_val,
            current: baseline,
            min_meaningful_delta: (span * 0.05).max(0.01),
        })
    }

    pub fn progress_toward_target(&self) -> f64 {
        let span = (self.target - self.baseline).abs();
        if span < f64::EPSILON {
            return 0.0;
        }
        match self.direction {
            MetricDirection::Up => ((self.current - self.baseline) / span).clamp(0.0, 1.0),
            MetricDirection::Down => ((self.baseline - self.current) / span).clamp(0.0, 1.0),
        }
    }

    pub fn is_meaningful_delta(&self, delta: f64) -> bool {
        delta.abs() >= self.min_meaningful_delta
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Target {
    pub id: Uuid,
    pub title: String,
    pub outcome: String,
    pub status: TargetStatus,
    pub metrics: Vec<Metric>,
    /// Soft capacity hours per week for this target (required when ≥2 active).
    pub soft_capacity_hours: Option<f64>,
    pub non_negotiables: Vec<String>,
    pub priority: i32,
}

impl Target {
    pub fn new(title: impl Into<String>, metric: Metric) -> Self {
        Self {
            id: Uuid::new_v4(),
            title: title.into(),
            outcome: String::new(),
            status: TargetStatus::Active,
            metrics: vec![metric],
            soft_capacity_hours: None,
            non_negotiables: vec![],
            priority: 0,
        }
    }

    pub fn is_active(&self) -> bool {
        self.status == TargetStatus::Active
    }

    pub fn validate_active(&self) -> Result<(), String> {
        if self.metrics.is_empty() {
            return Err("active target requires ≥1 metric".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metric_rejects_equal_baseline_target() {
        assert!(Metric::new("x", "n", 1.0, 1.0).is_err());
    }

    #[test]
    fn progress_up() {
        let mut m = Metric::new("pages", "pages", 0.0, 100.0).unwrap();
        m.current = 40.0;
        assert!((m.progress_toward_target() - 0.4).abs() < 1e-9);
    }
}
