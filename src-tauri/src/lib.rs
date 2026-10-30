mod elevation;
mod leftovers;
mod meta;
mod portable;
mod registry_leftovers;
mod settings;
mod syspaths;
mod uninstall;
mod vendor;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Must come before the single-instance plugin is registered: when we were relaunched
    // elevated, the previous instance still holds the lock until it has exited.
    let args: Vec<String> = std::env::args().collect();
    let elevated_from = elevation::parse_elevated_from(&args);
    if let Some(pid) = elevated_from {
        elevation::wait_for_exit(pid, elevation::WAIT_TIMEOUT_MS);
    }

    // Must be first: may set env vars, which is only safe before other threads start.
    let mode = portable::init();

    let mut builder = tauri::Builder::default();

    // In portable mode on Windows/macOS the window-state plugin would write
    // outside the data dir, so skip it there.
    let use_window_state = !(mode.portable && (cfg!(windows) || cfg!(target_os = "macos")));
    if use_window_state {
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(mode.clone())
        .manage(registry_leftovers::RegistryContexts::default())
        .invoke_handler(tauri::generate_handler![
            meta::plugin_meta,
            syspaths::system_paths,
            settings::get_settings,
            settings::save_custom_paths,
            settings::save_settings,
            settings::app_info,
            uninstall::trash_plugin,
            uninstall::trash_plugins_elevated,
            uninstall::create_restore_point,
            vendor::find_vendor_uninstaller,
            vendor::run_vendor_uninstaller,
            leftovers::find_leftovers,
            leftovers::trash_leftovers,
            registry_leftovers::capture_registry_context,
            registry_leftovers::find_registry_leftovers_after,
            registry_leftovers::delete_registry_leftovers
        ])
        .setup(move |app| {
            let settings_path = match &mode.data_dir {
                Some(dir) if mode.portable => dir.join("settings.json"),
                _ => app.path().app_config_dir()?.join("settings.json"),
            };
            let loaded = portable_core::load(&settings_path);
            app.manage(settings::SettingsPath(settings_path));

            // Opt-in "always run as administrator": relaunch elevated and quit before any window shows.
            if elevation::should_relaunch(
                loaded.run_as_admin,
                elevation::is_elevated(),
                elevated_from.is_some(),
                cfg!(windows),
            ) {
                match elevation::relaunch_elevated(std::process::id()) {
                    Ok(()) => std::process::exit(0),
                    // Typically the user declined the UAC prompt: keep running un-elevated.
                    Err(e) => eprintln!("Could not relaunch as administrator: {e}"),
                }
            }

            // Updater and relaunch exist on desktop only.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            // The window is configured visible:false; always show it here.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
