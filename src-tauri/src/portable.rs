use std::path::PathBuf;

use portable_core::{PortableResolution, TargetOs};

/// Result of portable-mode detection, stored as managed state.
#[derive(Clone, Debug)]
pub struct AppMode {
    pub portable: bool,
    pub data_dir: Option<PathBuf>,
    pub warning: Option<String>,
}

/// Detect portable mode and, if active, redirect config/data/cache dirs via
/// environment variables. Must run before the Builder and before any threads.
pub fn init() -> AppMode {
    let os = TargetOs::current();
    let env_force = std::env::var("DEPLUG_PORTABLE").is_ok_and(|v| v == "1");
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(e) => {
            return AppMode {
                portable: false,
                data_dir: None,
                warning: Some(format!("Could not determine executable path: {e}")),
            }
        }
    };
    let appimage = std::env::var_os("APPIMAGE");
    let base = portable_core::base_dir(&exe, appimage.as_deref(), os);
    match portable_core::resolve(&base, env_force) {
        PortableResolution::Portable { data_dir } => {
            for (key, value) in portable_core::env_overrides(&data_dir, os) {
                // Called at startup before any other thread exists.
                std::env::set_var(key, value);
            }
            AppMode {
                portable: true,
                data_dir: Some(data_dir),
                warning: None,
            }
        }
        PortableResolution::Installed { warning } => AppMode {
            portable: false,
            data_dir: None,
            warning,
        },
    }
}
