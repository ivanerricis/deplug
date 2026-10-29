use std::path::PathBuf;

use portable_core::Settings;
use serde::Serialize;
use tauri::State;

use crate::portable::AppMode;

/// Managed state holding the location of settings.json.
pub struct SettingsPath(pub PathBuf);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub portable: bool,
    pub data_dir: Option<String>,
    pub portable_warning: Option<String>,
    /// True when the process runs with administrator rights (Windows only).
    pub elevated: bool,
}

#[tauri::command]
pub fn get_settings(path: State<'_, SettingsPath>) -> Settings {
    portable_core::load(&path.0)
}

#[tauri::command]
pub fn save_custom_paths(paths: Vec<String>, path: State<'_, SettingsPath>) -> Result<(), String> {
    let mut settings = portable_core::load(&path.0);
    settings.custom_scan_paths = paths;
    if let Some(parent) = path.0.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    portable_core::save(&path.0, &settings).map_err(|e| e.to_string())
}

/// Persists the whole settings struct after sanitizing it.
#[tauri::command]
pub fn save_settings(settings: Settings, path: State<'_, SettingsPath>) -> Result<(), String> {
    portable_core::save(&path.0, &settings.sanitized()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_info(mode: State<'_, AppMode>) -> AppInfo {
    AppInfo {
        portable: mode.portable,
        data_dir: mode
            .data_dir
            .as_ref()
            .map(|p| p.to_string_lossy().into_owned()),
        portable_warning: mode.warning.clone(),
        elevated: crate::elevation::is_elevated(),
    }
}
