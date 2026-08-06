//! AIly core domain — targets, capacity, replan, tutorial, block rules.
//! Brand: **AIly** — Your AI Ally.

pub mod audit;
pub mod block;
pub mod capacity;
pub mod replan;
pub mod target;
pub mod tutorial;

pub use audit::{AllyActionLog, Origin};
pub use block::{BlockMode, BlockRule, BreakGlassPolicy};
pub use capacity::{CapacityConfig, CapacityError, CapacityInput, check_plan_accept};
pub use replan::{CommitmentSlice, ReplanInput, ReplanOutput, replan_today};
pub use target::{Metric, MetricDirection, Target, TargetStatus};
pub use tutorial::{ChapterId, ChapterStatus, PermissionFlags, TutorialState, TutorialEngine};
