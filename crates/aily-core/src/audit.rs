//! Ally action log — fail-closed audit for admin actions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    UiIpc,
    InternalTemplate,
    SidecarSocket,
    CloudGateway,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllyActionLog {
    pub id: Uuid,
    pub tool: String,
    pub args_redacted: String,
    pub origin: Origin,
    pub result: String,
    pub ts: DateTime<Utc>,
}

impl AllyActionLog {
    pub fn record(
        tool: impl Into<String>,
        args_redacted: impl Into<String>,
        origin: Origin,
        result: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tool: tool.into(),
            args_redacted: args_redacted.into(),
            origin,
            result: result.into(),
            ts: Utc::now(),
        }
    }
}
