use std::ffi::c_char;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result, ensure};
use electrobun::{
    Core, OpenFileDialogOptions, Rect, WebviewCallbacks, WebviewOptions, WindowCallbacks,
    WindowOptions,
};
use serde::Deserialize;
use serde_json::{Value, json};
use studio::{Workspace, shell};
use uuid::Uuid;

#[cfg(feature = "preview-smoke")]
mod smoke;

const PAGE: &str = "views://studio/index.html";
static APP: OnceLock<App> = OnceLock::new();

struct App {
    core: Core,
    webview: AtomicU32,
    workspace: Mutex<Option<Workspace>>,
    stopping: AtomicBool,
    responder: Mutex<Option<thread::JoinHandle<()>>>,
    preview: Mutex<Option<studio::server::NativePreview>>,
    preview_origin: Mutex<Option<String>>,
    preview_window: AtomicU32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Message {
    id: u32,
    action: Action,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Action {
    Native(NativeAction),
    Core(shell::Action),
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum NativeAction {
    ChooseWorkspace,
    Import,
}

fn app() -> &'static App {
    APP.get().expect("desktop initialized")
}

fn main() {
    if let Err(error) = run() {
        eprintln!("studio: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    eprintln!("studio: loading desktop core");
    let core = Core::load().map_err(anyhow::Error::msg)?;
    let bundle = electrobun::resolve_bundle_paths().map_err(anyhow::Error::msg)?;
    let info = electrobun::resolve_app_info_from_bundle(&bundle).map_err(anyhow::Error::msg)?;
    let workspace = std::env::var_os("STUDIO_WORKSPACE")
        .map(Workspace::init)
        .transpose()?;
    // Native bundled-asset loading uses ../Resources relative to the main
    // executable's directory. Resolve caller-relative workspace paths first.
    std::env::set_current_dir(&bundle.exe_dir)?;
    core.configure_webview_runtime_from_executable_dir(&bundle, 0)
        .map_err(anyhow::Error::msg)?;
    eprintln!("studio: desktop transport ready");
    APP.set(App {
        core,
        webview: AtomicU32::new(0),
        workspace: Mutex::new(workspace),
        stopping: AtomicBool::new(false),
        responder: Mutex::new(None),
        preview: Mutex::new(None),
        preview_origin: Mutex::new(None),
        preview_window: AtomicU32::new(0),
    })
    .map_err(|_| anyhow::anyhow!("desktop already initialized"))?;
    // Load the native wrapper on the main thread before any worker calls it.
    // Electrobun's lazy native-wrapper initialization is not synchronized.
    app()
        .core
        .set_quit_requested_handler(Some(quit_requested))
        .map_err(anyhow::Error::msg)?;
    let opener = thread::spawn(|| {
        // The SDK currently exposes no event-loop-ready callback. Match its
        // Rust startup convention so Cocoa initializes before window creation.
        thread::sleep(Duration::from_millis(150));
        if let Err(error) = open_window() {
            eprintln!("studio: {error:#}");
            let _ = app().core.stop_event_loop();
        }
    });
    let result = app()
        .core
        .run_main_thread(&info)
        .map_err(anyhow::Error::msg);
    app().stopping.store(true, Ordering::Release);
    let _ = opener.join();
    if let Some(responder) = app().responder.lock().unwrap().take() {
        let _ = responder.join();
    }
    result
}

fn webview_key() -> Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|error| anyhow::anyhow!("cannot generate webview key: {error}"))?;
    Ok(bytes
        .iter()
        .map(u8::to_string)
        .collect::<Vec<_>>()
        .join(","))
}

fn open_window() -> Result<()> {
    eprintln!("studio: opening desktop window");
    let core = &app().core;
    core.set_application_menu_json(&json!([
        {"label":"Memoremix Studio","submenu":[{"role":"about"},{"type":"separator"},{"role":"quit"}]},
        {"label":"Edit","submenu":[{"role":"undo"},{"role":"redo"},{"type":"separator"},{"role":"cut"},{"role":"copy"},{"role":"paste"},{"role":"selectAll"}]}
    ]).to_string(), None).map_err(anyhow::Error::msg)?;
    let frame = Rect::new(0.0, 0.0, 1200.0, 800.0);
    let mut options = WindowOptions::new("Memoremix Studio", frame);
    options.centered = true;
    options.callbacks = WindowCallbacks {
        close: Some(closed),
        ..Default::default()
    };
    let window = core.create_window(options).map_err(anyhow::Error::msg)?;
    eprintln!("studio: desktop window created");
    let key = webview_key()?;
    let mut view = WebviewOptions::new(window, PAGE, frame);
    view.partition = "studio-shell";
    view.sandbox = false;
    view.secret_key = &key;
    view.callbacks = WebviewCallbacks {
        decide_navigation: Some(navigate),
        // WKWebView's navigation delegate calls this even when no event
        // observer is needed; the SDK's default None crashes on navigation.
        event: Some(electrobun::noop_webview_event),
        internal_bridge: Some(electrobun::noop_webview_post_message),
        event_bridge: Some(electrobun::noop_webview_post_message),
        ..Default::default()
    };
    #[cfg(feature = "preview-smoke")]
    {
        view.callbacks.event_bridge = Some(preview_message);
    }
    let id = core.create_webview(view).map_err(anyhow::Error::msg)?;
    core.set_webview_navigation_rules(id, r#"["^*","views://studio/index.html"]"#)
        .map_err(anyhow::Error::msg)?;
    app().webview.store(id, Ordering::Release);
    *app().responder.lock().unwrap() = Some(thread::spawn(answer_pages));
    Ok(())
}

extern "C" fn navigate(_: u32, url: *const c_char) -> u32 {
    u32::from(electrobun::c_string_to_string(url) == PAGE)
}

extern "C" fn closed(_: u32) {
    quit_requested();
}

extern "C" fn quit_requested() {
    if app().stopping.swap(true, Ordering::AcqRel) {
        return;
    }
    app().webview.store(0, Ordering::Release);

    // The core exits the process when its event loop stops, so reclaim active
    // sandboxed workers before stopping that loop, not after it returns.
    // Keep the GUI thread free to finish any native operation already queued
    // by the responder while shutdown waits for it.
    thread::spawn(|| {
        if let Some(responder) = app().responder.lock().unwrap().take() {
            let _ = responder.join();
        }
        let preview = app().preview.lock().unwrap().take();
        drop(preview);
        let _ = app().core.stop_event_loop();
    });
}

fn answer_pages() {
    while !app().stopping.load(Ordering::Acquire) {
        let Some((sender, text)) = app().core.pop_next_queued_host_message_string() else {
            thread::sleep(Duration::from_millis(10));
            continue;
        };
        if sender != app().webview.load(Ordering::Acquire) || text.len() > 12 * 1024 * 1024 {
            continue;
        }
        let Ok(message) = serde_json::from_str::<Message>(&text) else {
            continue;
        };
        if matches!(message.action, Action::Core(shell::Action::Catalog)) {
            eprintln!("studio: desktop shell connected");
        }
        let response = match dispatch(message.action) {
            Ok(value) => json!({"id": message.id, "ok": true, "value": value}),
            Err(error) => json!({"id": message.id, "ok": false, "error": format!("{error:#}")}),
        };
        if sender == app().webview.load(Ordering::Acquire) {
            let _ = app()
                .core
                .send_host_message_to_webview_json(sender, &response.to_string());
            #[cfg(feature = "preview-smoke")]
            smoke::after_response();
        }
    }
}

fn choose_folder() -> Result<Option<PathBuf>> {
    let selection = app()
        .core
        .open_file_dialog(OpenFileDialogOptions {
            starting_folder: "",
            allowed_file_types: "",
            can_choose_files: false,
            can_choose_directory: true,
            allows_multiple_selection: false,
        })
        .map_err(anyhow::Error::msg)?;
    let paths: Vec<PathBuf> = serde_json::from_str(&selection)?;
    ensure!(paths.len() <= 1, "select one folder");
    Ok(paths.into_iter().next())
}

fn dispatch(action: Action) -> Result<Value> {
    match action {
        Action::Native(NativeAction::ChooseWorkspace) => {
            if let Some(folder) = choose_folder()? {
                close_preview();
                *app().workspace.lock().unwrap() = Some(Workspace::init(folder)?);
            }
            catalog()
        }
        Action::Core(shell::Action::Catalog) => catalog(),
        other => {
            let workspace = app()
                .workspace
                .lock()
                .unwrap()
                .clone()
                .context("choose a workspace first")?;
            match other {
                Action::Native(NativeAction::Import) => {
                    if let Some(folder) = choose_folder()? {
                        workspace.import(folder)?;
                    }
                    catalog()
                }
                Action::Core(shell::Action::Preview { app: id }) => {
                    open_preview(workspace, id)?;
                    Ok(json!({"native":true}))
                }
                Action::Core(shell::Action::ClosePreview) => {
                    close_preview();
                    Ok(Value::Null)
                }
                Action::Core(action @ shell::Action::Delete { .. }) => {
                    close_preview();
                    shell::dispatch(&workspace, action, &app().stopping)
                }
                Action::Core(action) => shell::dispatch(&workspace, action, &app().stopping),
                Action::Native(NativeAction::ChooseWorkspace) => unreachable!(),
            }
        }
    }
}
fn catalog() -> Result<Value> {
    shell::catalog(app().workspace.lock().unwrap().as_ref())
}
fn close_preview() {
    let preview = app().preview.lock().unwrap().take();
    drop(preview);

    *app().preview_origin.lock().unwrap() = None;
    let window = app().preview_window.swap(0, Ordering::AcqRel);
    if window != 0 {
        let _ = app().core.close_window(window);
    }
}
fn open_preview(workspace: Workspace, id: Uuid) -> Result<()> {
    close_preview();
    let result = create_preview(workspace, id);
    if result.is_err() {
        close_preview();
    }
    result
}
fn create_preview(workspace: Workspace, id: Uuid) -> Result<()> {
    let preview = studio::server::native_preview(workspace, id)?;
    let url = preview.url.clone();
    *app().preview.lock().unwrap() = Some(preview);
    let origin = url
        .split("/#")
        .next()
        .context("invalid preview URL")?
        .to_owned();
    *app().preview_origin.lock().unwrap() = Some(origin.clone());
    let frame = Rect::new(0.0, 0.0, 700.0, 800.0);
    let mut options = WindowOptions::new("Studio performer preview", frame);
    options.centered = true;
    options.callbacks = WindowCallbacks {
        close: Some(preview_closed),
        ..Default::default()
    };
    let window = app()
        .core
        .create_window(options)
        .map_err(anyhow::Error::msg)?;
    app().preview_window.store(window, Ordering::Release);
    let key = webview_key()?;
    // Native WKWebView consults the core's navigation rules, independently of
    // decide_navigation. Install them before loading any booth content.
    let mut view = WebviewOptions::new(window, "", frame);
    view.secret_key = &key;
    view.sandbox = true;
    view.allowed_protocols = electrobun::AllowedProtocols {
        views: false,
        app_data: false,
    };
    let partition = format!("booth-{}", Uuid::new_v4());
    view.partition = &partition;
    view.callbacks = WebviewCallbacks {
        decide_navigation: Some(preview_navigate),
        event: Some(preview_event),
        host_bridge: Some(electrobun::noop_webview_post_message),
        bun_bridge: Some(electrobun::noop_webview_post_message),
        internal_bridge: Some(electrobun::noop_webview_post_message),
        event_bridge: Some(preview_message),
    };
    let id = app()
        .core
        .create_webview(view)
        .map_err(anyhow::Error::msg)?;
    app()
        .core
        .set_webview_navigation_rules(id, &json!(["^*", format!("{origin}/*")]).to_string())
        .map_err(anyhow::Error::msg)?;
    // The SDK's load_url path logs its argument on macOS. Navigate from the
    // empty view without putting the single-use bootstrap token in native logs.
    app()
        .core
        .evaluate_javascript_with_no_completion(id, &format!("location.replace({});", json!(url)))
        .map_err(anyhow::Error::msg)?;
    #[cfg(feature = "preview-smoke")]
    smoke::opened(id);
    Ok(())
}
extern "C" fn preview_navigate(_: u32, url: *const c_char) -> u32 {
    let url = electrobun::c_string_to_string(url);
    u32::from(
        app()
            .preview_origin
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|origin| url.starts_with(&format!("{origin}/"))),
    )
}
extern "C" fn preview_closed(window: u32) {
    if app()
        .preview_window
        .compare_exchange(window, 0, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        let preview = app().preview.lock().unwrap().take();
        // Keep native callbacks responsive while an active worker is cancelled.
        thread::spawn(move || drop(preview));
        *app().preview_origin.lock().unwrap() = None;
    }
}

extern "C" fn preview_event(sender: u32, event: *const c_char, data: *const c_char) {
    // Navigation event payloads can contain bootstrap fragments; do not log them.
    #[cfg(feature = "preview-smoke")]
    smoke::navigation(sender, event, data);
    #[cfg(not(feature = "preview-smoke"))]
    let _ = (sender, event, data);
}
extern "C" fn preview_message(sender: u32, text: *const c_char) {
    #[cfg(feature = "preview-smoke")]
    smoke::message(sender, text);
    #[cfg(not(feature = "preview-smoke"))]
    let _ = (sender, text);
}
