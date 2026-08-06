//! Block rules model (enforcement is platform-specific, later).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BlockMode {
    SoftDelay,
    HardBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakGlassPolicy {
    pub delay_sec: u32,
    pub require_reason: bool,
    pub daily_limit: Option<u32>,
}

impl Default for BreakGlassPolicy {
    fn default() -> Self {
        Self {
            delay_sec: 30,
            require_reason: true,
            daily_limit: Some(5),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BlockSchedule {
    Always,
    Window,
    WhenFocusSession,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockRule {
    pub id: Uuid,
    pub app_keys: Vec<String>,
    pub schedule: BlockSchedule,
    pub mode: BlockMode,
    pub break_glass: BreakGlassPolicy,
    pub armed: bool,
}

impl BlockRule {
    pub fn new(app_keys: Vec<String>, mode: BlockMode) -> Self {
        Self {
            id: Uuid::new_v4(),
            app_keys,
            schedule: BlockSchedule::WhenFocusSession,
            mode,
            break_glass: BreakGlassPolicy::default(),
            armed: false,
        }
    }

    /// Safety: never arm without tutorial grants (caller must check TutorialEngine::can_arm_blocks).
    pub fn try_arm(&mut self, can_arm: bool) -> Result<(), String> {
        if !can_arm {
            return Err(
                "complete Attention map + Ally admin tutorial chapters before arming blocks".into(),
            );
        }
        if self.app_keys.is_empty() {
            return Err("block rule needs at least one app".into());
        }
        self.armed = true;
        Ok(())
    }

    pub fn disarm(&mut self) {
        self.armed = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cannot_arm_without_grant() {
        let mut r = BlockRule::new(vec!["firefox".into()], BlockMode::HardBlock);
        assert!(r.try_arm(false).is_err());
        assert!(!r.armed);
        assert!(r.try_arm(true).is_ok());
        assert!(r.armed);
    }
}
