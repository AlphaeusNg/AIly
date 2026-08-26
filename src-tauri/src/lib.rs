mod windows_usage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(windows_usage::WindowsUsageState::new())
        .invoke_handler(tauri::generate_handler![
            windows_usage::windows_usage_status,
            windows_usage::set_windows_usage_tracking,
            windows_usage::list_windows_session_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AIly");
}
