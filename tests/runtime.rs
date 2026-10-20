//! Explicit opt-in tests: these launch a real workerd through MXC.
//! Install tools/runtime first, then `cargo test --test runtime -- --ignored`.

use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use studio::{Workspace, runtime};

fn run(source: &str) -> anyhow::Result<runtime::RunResult> {
    let dir = tempfile::tempdir()?;
    let workspace = Workspace::init(dir.path())?;
    let app = workspace.create("Runtime test")?;
    fs::write(
        dir.path().join(format!("apps/{}/worker.js", app.id)),
        source,
    )?;
    workspace.run(app.id, &runtime::workerd_path(None)?, "/?name=Studio")
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn local_fetch_executes_in_the_sandbox() {
    let result = run(include_str!("../samples/hello/worker.js")).unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    assert!(result.stdout.contains("Hello, Studio!"));
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn worker_fetch_cannot_reach_the_network() {
    let result = run(r#"export default { async fetch() {
        try { await fetch('https://example.com'); return new Response('ESCAPED'); }
        catch { return new Response('NETWORK_DENIED'); }
    } };"#)
    .unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    assert!(result.stdout.contains("NETWORK_DENIED"));
    assert!(!result.stdout.contains("ESCAPED"));
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn output_flood_terminates_without_unbounded_capture() {
    let result = run("export default { fetch() { for (;;) console.log('x'.repeat(8192)); } };");
    assert!(result.is_err());
    assert!(format!("{:#}", result.unwrap_err()).contains("output limit"));
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn runaway_javascript_is_terminated() {
    let started = Instant::now();
    let result = run("export default { fetch() { for (;;) {} } };");
    assert!(result.is_err() || result.unwrap().exit_code != 0);
    assert!(started.elapsed() < Duration::from_secs(12));
}

#[test]
fn cancelled_requests_do_not_launch_a_runtime() {
    let dir = tempfile::tempdir().unwrap();
    let workspace = Workspace::init(dir.path()).unwrap();
    let app = workspace.create("Cancelled").unwrap();
    let result = workspace.run_cancellable(
        app.id,
        std::path::Path::new("/missing/workerd"),
        "/",
        &AtomicBool::new(true),
    );
    assert!(result.unwrap_err().to_string().contains("cancelled"));
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn request_runner_does_not_invoke_other_apps_test_handlers() {
    let dir = tempfile::tempdir().unwrap();
    let workspace = Workspace::init(dir.path()).unwrap();
    let selected = workspace.create("Selected app").unwrap();
    let sibling = workspace.create("Sibling app").unwrap();
    fs::write(
        dir.path().join(format!("apps/{}/worker.js", sibling.id)),
        "export default { test() { throw new Error('UNEXPECTED_TEST'); } };",
    )
    .unwrap();
    let result = workspace
        .run(selected.id, &runtime::workerd_path(None).unwrap(), "/")
        .unwrap();
    assert_eq!(result.plan.apps.len(), 2);
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    assert!(!result.stderr.contains("UNEXPECTED_TEST"));
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn shutdown_cancels_an_active_worker() {
    let dir = tempfile::tempdir().unwrap();
    let workspace = Workspace::init(dir.path()).unwrap();
    let app = workspace.create("Cancelled while running").unwrap();
    fs::write(
        dir.path().join(format!("apps/{}/worker.js", app.id)),
        "export default { fetch() { for (;;) {} } };",
    )
    .unwrap();
    let cancelled = AtomicBool::new(false);
    let started = Instant::now();
    std::thread::scope(|scope| {
        scope.spawn(|| {
            std::thread::sleep(Duration::from_millis(300));
            cancelled.store(true, Ordering::Release);
        });
        let result = workspace.run_cancellable(
            app.id,
            &runtime::workerd_path(None).unwrap(),
            "/",
            &cancelled,
        );
        assert!(result.unwrap_err().to_string().contains("cancelled"));
    });
    assert!(started.elapsed() < Duration::from_secs(3));
}
