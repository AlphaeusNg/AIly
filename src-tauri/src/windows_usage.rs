use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::State;

const SAMPLE_INTERVAL: Duration = Duration::from_secs(5);
const MAX_SAMPLE_ELAPSED: Duration = Duration::from_secs(10);
const MIN_VISIBLE_MS: u64 = 60_000;
pub const MAX_SAMPLES: usize = 50;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsUsageSample {
    process_name: String,
    label: String,
    foreground_ms: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct WindowsUsageStatus {
    available: bool,
    tracking: bool,
    day: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct WindowsUsageSnapshot {
    day: String,
    samples: Vec<WindowsUsageSample>,
}

#[derive(Default)]
struct UsageAccumulator {
    consented: bool,
    day: String,
    totals: BTreeMap<String, WindowsUsageSample>,
}

impl UsageAccumulator {
    fn set_tracking(&mut self, consented: bool, day: &str) {
        self.consented = consented;
        if !consented {
            self.day.clear();
            self.totals.clear();
            return;
        }
        self.roll_to(day);
    }

    fn roll_to(&mut self, day: &str) {
        if self.day != day {
            self.day = day.to_owned();
            self.totals.clear();
        }
    }

    fn record(&mut self, day: &str, process_name: &str, label: &str, elapsed: Duration) {
        if !self.consented || process_name.is_empty() || label.is_empty() {
            return;
        }
        self.roll_to(day);
        let elapsed_ms = u64::try_from(elapsed.min(MAX_SAMPLE_ELAPSED).as_millis())
            .unwrap_or(MAX_SAMPLE_ELAPSED.as_millis() as u64);
        if elapsed_ms == 0 {
            return;
        }
        let key = process_name.to_ascii_lowercase();
        let entry = self
            .totals
            .entry(key)
            .or_insert_with(|| WindowsUsageSample {
                process_name: process_name.to_owned(),
                label: label.to_owned(),
                foreground_ms: 0,
            });
        entry.foreground_ms = entry.foreground_ms.saturating_add(elapsed_ms);
    }

    fn snapshot(&mut self, day: &str) -> WindowsUsageSnapshot {
        self.roll_to(day);
        let mut samples: Vec<_> = self
            .totals
            .values()
            .filter(|sample| sample.foreground_ms >= MIN_VISIBLE_MS)
            .cloned()
            .collect();
        samples.sort_by(|left, right| {
            right
                .foreground_ms
                .cmp(&left.foreground_ms)
                .then_with(|| left.process_name.cmp(&right.process_name))
        });
        samples.truncate(MAX_SAMPLES);
        WindowsUsageSnapshot {
            day: self.day.clone(),
            samples,
        }
    }
}

pub struct WindowsUsageState {
    inner: Arc<Mutex<UsageAccumulator>>,
}

impl WindowsUsageState {
    pub fn new() -> Self {
        let inner = Arc::new(Mutex::new(UsageAccumulator::default()));
        spawn_monitor(Arc::clone(&inner));
        Self { inner }
    }

    fn status(&self) -> Result<WindowsUsageStatus, String> {
        let day = local_day();
        let mut usage = self.inner.lock().map_err(|_| "usage state unavailable")?;
        usage.roll_to(&day);
        Ok(WindowsUsageStatus {
            available: cfg!(target_os = "windows"),
            tracking: usage.consented,
            day,
        })
    }
}

#[tauri::command]
pub fn windows_usage_status(
    state: State<'_, WindowsUsageState>,
) -> Result<WindowsUsageStatus, String> {
    state.status()
}

#[tauri::command]
pub fn set_windows_usage_tracking(
    consented: bool,
    state: State<'_, WindowsUsageState>,
) -> Result<WindowsUsageStatus, String> {
    if consented && !cfg!(target_os = "windows") {
        return Err("Windows foreground usage is unavailable on this platform".to_owned());
    }
    let day = local_day();
    state
        .inner
        .lock()
        .map_err(|_| "usage state unavailable")?
        .set_tracking(consented, &day);
    state.status()
}

#[tauri::command]
pub fn list_windows_session_usage(
    consented: bool,
    state: State<'_, WindowsUsageState>,
) -> Result<WindowsUsageSnapshot, String> {
    if !consented {
        return Err("Explicit usage consent is required".to_owned());
    }
    let day = local_day();
    let mut usage = state.inner.lock().map_err(|_| "usage state unavailable")?;
    if !usage.consented {
        return Err("Windows foreground tracking is not active".to_owned());
    }
    Ok(usage.snapshot(&day))
}

fn spawn_monitor(inner: Arc<Mutex<UsageAccumulator>>) {
    #[cfg(target_os = "windows")]
    thread::spawn(move || {
        let mut last_sample = Instant::now();
        loop {
            thread::sleep(SAMPLE_INTERVAL);
            let elapsed = last_sample.elapsed();
            last_sample = Instant::now();
            let consented = inner.lock().map(|usage| usage.consented).unwrap_or(false);
            if !consented {
                continue;
            }
            let Some((process_name, label)) = foreground_process() else {
                continue;
            };
            if let Ok(mut usage) = inner.lock() {
                usage.record(&local_day(), &process_name, &label, elapsed);
            }
        }
    });

    #[cfg(not(target_os = "windows"))]
    let _ = inner;
}

#[cfg(target_os = "windows")]
fn local_day() -> String {
    use windows_sys::Win32::Foundation::SYSTEMTIME;
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;

    let mut time = SYSTEMTIME::default();
    unsafe { GetLocalTime(&mut time) };
    format!("{:04}-{:02}-{:02}", time.wYear, time.wMonth, time.wDay)
}

#[cfg(not(target_os = "windows"))]
fn local_day() -> String {
    "unsupported".to_owned()
}

#[cfg(target_os = "windows")]
fn foreground_process() -> Option<(String, String)> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    let window = unsafe { GetForegroundWindow() };
    if window.is_null() {
        return None;
    }
    let mut process_id = 0;
    unsafe { GetWindowThreadProcessId(window, &mut process_id) };
    if process_id == 0 || process_id == std::process::id() {
        return None;
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) };
    if process.is_null() {
        return None;
    }
    let mut path = vec![0_u16; 32_768];
    let mut path_len = u32::try_from(path.len()).ok()?;
    let queried = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            path.as_mut_ptr(),
            &mut path_len,
        )
    };
    unsafe { CloseHandle(process) };
    if queried == 0 || path_len == 0 {
        return None;
    }
    let full_path = String::from_utf16_lossy(&path[..path_len as usize]);
    let process_name = full_path.rsplit(['\\', '/']).next()?.trim();
    if process_name.is_empty() {
        return None;
    }
    let process_name: String = process_name.chars().take(200).collect();
    let label: String = process_name
        .strip_suffix(".exe")
        .unwrap_or(&process_name)
        .chars()
        .take(120)
        .collect();
    if label.is_empty() {
        return None;
    }
    Some((process_name, label))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accumulator_requires_consent_and_a_full_visible_minute() {
        let mut usage = UsageAccumulator::default();
        usage.record(
            "2026-08-25",
            "editor.exe",
            "Editor",
            Duration::from_secs(60),
        );
        assert!(usage.snapshot("2026-08-25").samples.is_empty());

        usage.set_tracking(true, "2026-08-25");
        for _ in 0..6 {
            usage.record(
                "2026-08-25",
                "editor.exe",
                "Editor",
                Duration::from_secs(10),
            );
        }
        assert_eq!(
            usage.snapshot("2026-08-25").samples[0].foreground_ms,
            60_000
        );
    }

    #[test]
    fn accumulator_rolls_days_caps_rows_and_clears_on_revoke() {
        let mut usage = UsageAccumulator::default();
        usage.set_tracking(true, "2026-08-25");
        for index in 0..55 {
            for _ in 0..(6 + index % 3) {
                usage.record(
                    "2026-08-25",
                    &format!("app-{index:02}.exe"),
                    &format!("App {index:02}"),
                    Duration::from_secs(10),
                );
            }
        }
        let snapshot = usage.snapshot("2026-08-25");
        assert_eq!(snapshot.samples.len(), MAX_SAMPLES);
        assert!(snapshot.samples[0].foreground_ms >= snapshot.samples[49].foreground_ms);

        assert!(usage.snapshot("2026-08-26").samples.is_empty());
        for _ in 0..6 {
            usage.record(
                "2026-08-26",
                "browser.exe",
                "Browser",
                Duration::from_secs(10),
            );
        }
        assert_eq!(usage.snapshot("2026-08-26").samples.len(), 1);
        usage.set_tracking(false, "2026-08-26");
        assert!(usage.snapshot("2026-08-26").samples.is_empty());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_probe_never_exposes_a_path_or_this_process() {
        if let Some((process_name, label)) = foreground_process() {
            assert!(!process_name.contains(['\\', '/']));
            assert!(!label.is_empty());
        }
        assert_eq!(local_day().len(), 10);
    }
}
