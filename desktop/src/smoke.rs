//! Opt-in native renderer regression probe. This feature is excluded from
//! ordinary builds and does not add any administrative operations to booths.
use super::*;
static STARTED: AtomicBool = AtomicBool::new(false);
static VIEW: AtomicU32 = AtomicU32::new(0);

pub fn after_response() {
    let Ok(id) = std::env::var("STUDIO_PREVIEW_SMOKE_APP") else {
        return;
    };
    if STARTED.swap(true, Ordering::AcqRel) {
        return;
    }
    let result = (|| -> Result<()> {
        let workspace = app()
            .workspace
            .lock()
            .unwrap()
            .clone()
            .context("workspace required")?;
        open_preview(workspace, Uuid::parse_str(&id)?)
    })();
    if let Err(error) = result {
        eprintln!("studio-smoke: failed {error:#}");
    }
}
pub fn opened(id: u32) {
    VIEW.store(id, Ordering::Release);
    thread::spawn(move || {
        let delete = std::env::var("STUDIO_PREVIEW_SMOKE_DELETE").is_ok();
        let persist = std::env::var("STUDIO_PREVIEW_SMOKE_PERSIST").is_ok();
        let script = if delete {
            include_str!("delete-smoke.js").to_owned()
        } else {
            include_str!("smoke.js").replace("PERSISTENCE_ONLY", &persist.to_string())
        };
        let target = if delete {
            app().webview.load(Ordering::Acquire)
        } else {
            id
        };
        for _ in 0..150 {
            if app().stopping.load(Ordering::Acquire) {
                break;
            }
            let _ = app()
                .core
                .evaluate_javascript_with_no_completion(target, &script);
            thread::sleep(Duration::from_millis(200));
        }
    });
}
pub fn message(id: u32, text: *const c_char) {
    let delete = std::env::var("STUDIO_PREVIEW_SMOKE_DELETE").is_ok();
    if id != VIEW.load(Ordering::Acquire)
        && !(delete && id == app().webview.load(Ordering::Acquire))
    {
        return;
    }
    let message = electrobun::c_string_to_string(text);
    // Test fixtures only. This diagnostic has no action/authorization path.
    if let Ok(value) = serde_json::from_str::<Value>(&message)
        && let Some(detail) = value.pointer("/payload/detail").and_then(Value::as_str)
        && let Ok(report) = serde_json::from_str::<Value>(detail)
    {
        if report.get("studioSmokeCancel").and_then(Value::as_bool) == Some(true) {
            let intact = app().preview_window.load(Ordering::Acquire) != 0
                && app().preview.lock().unwrap().is_some();
            eprintln!(
                "studio-smoke: {}",
                if intact {
                    "cancel preserved preview"
                } else {
                    "failed"
                }
            );
        }
        if let Some(passed) = report.get("studioSmoke").and_then(Value::as_bool) {
            let closed = !delete
                || (app().preview_window.load(Ordering::Acquire) == 0
                    && app().preview.lock().unwrap().is_none());
            eprintln!(
                "studio-smoke: {}",
                if passed && closed { "passed" } else { "failed" }
            );
        }
    }
}
pub fn navigation(id: u32, event: *const c_char, data: *const c_char) {
    if id != VIEW.load(Ordering::Acquire)
        || electrobun::c_string_to_string(event) != "will-navigate"
    {
        return;
    }
    if let Ok(value) = serde_json::from_str::<Value>(&electrobun::c_string_to_string(data))
        && value.get("allowed").and_then(Value::as_bool) == Some(false)
    {
        match value.get("url").and_then(Value::as_str) {
            Some("http://not-the-booth.localhost:49123/") => {
                eprintln!("studio-smoke: blocked external")
            }
            Some("views://studio/index.html") => eprintln!("studio-smoke: blocked shell"),
            _ => {}
        }
    }
}
