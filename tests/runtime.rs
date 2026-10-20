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
        dir.path().join(format!("performers/{}/worker.js", app.id)),
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
        dir.path()
            .join(format!("performers/{}/worker.js", sibling.id)),
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
        dir.path().join(format!("performers/{}/worker.js", app.id)),
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

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn turso_objects_survive_restart_and_remain_app_and_name_scoped() {
    use studio::runtime::WorkerRequest;
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w.create_from_template("Todos", "solid-todomvc").unwrap();
    let other = w.create_from_template("Other", "solid-todomvc").unwrap();
    let runtime = runtime::workerd_path(None).unwrap();
    let req = |method: &str, body: Option<&str>| WorkerRequest {
        path: "/api/todos".into(),
        method: method.into(),
        body: body.map(str::to_owned),
    };
    let result = w
        .request_cancellable(
            app.id,
            &runtime,
            &req("POST", Some(r#"{"type":"add","title":"Persistent todo"}"#)),
            None,
            &AtomicBool::new(false),
        )
        .unwrap();
    assert_eq!(result.exit_code, 0, "{}", result.stderr);
    assert!(result.response.unwrap().body.contains("Persistent todo"));
    drop(w);
    let w = Workspace::open(dir.path()).unwrap();
    let data = w.object_data(app.id, "TODOS", "default").unwrap();
    assert_eq!(data["todos"][0]["title"], "Persistent todo");
    assert!(w.object_data(app.id, "TODOS", "other").unwrap().is_empty());
    assert!(
        w.object_data(other.id, "TODOS", "default")
            .unwrap()
            .is_empty()
    );
    let get = w
        .request_cancellable(
            app.id,
            &runtime,
            &req("GET", None),
            None,
            &AtomicBool::new(false),
        )
        .unwrap();
    assert!(get.response.unwrap().body.contains("Persistent todo"));
    let revision = w.review(app.id).unwrap().revision;
    w.write_module(app.id, "worker.js", "export default {};", &revision)
        .unwrap();
    assert!(
        w.request_cancellable(
            app.id,
            &runtime,
            &req("GET", None),
            Some(&revision),
            &AtomicBool::new(false)
        )
        .unwrap_err()
        .to_string()
        .contains("changed")
    );
    let dbs: Vec<_> = walkdir::WalkDir::new(dir.path().join(".studio/objects"))
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().is_some_and(|x| x == "db"))
        .collect();
    assert_eq!(dbs.len(), 1);
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn failed_requests_do_not_commit_object_state_and_imports_get_new_storage() {
    use studio::runtime::WorkerRequest;
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w.create_from_template("Failure", "solid-todomvc").unwrap();
    let revision = w.review(app.id).unwrap().revision;
    let source = r#"export class TodoList { constructor(ctx){this.storage=ctx.storage;} async fetch(){await this.storage.put('secret','do not commit');throw new Error('Abort');} } export default { fetch(req,env){return env.TODOS.getByName('default').fetch(req);} };"#;
    w.write_module(app.id, "worker.js", source, &revision)
        .unwrap();
    let result = w
        .request_cancellable(
            app.id,
            &runtime::workerd_path(None).unwrap(),
            &WorkerRequest {
                path: "/".into(),
                method: "POST".into(),
                body: None,
            },
            None,
            &AtomicBool::new(false),
        )
        .unwrap();
    assert_ne!(result.exit_code, 0);
    assert!(
        w.object_data(app.id, "TODOS", "default")
            .unwrap()
            .is_empty()
    );
    let imported = w
        .import(dir.path().join("performers").join(app.id.to_string()))
        .unwrap();
    assert!(
        w.object_data(imported.id, "TODOS", "default")
            .unwrap()
            .is_empty()
    );
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn object_databases_are_distinct_for_namespace_name_and_app_and_enforce_quotas() {
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w.create_from_template("Counters", "solid-todomvc").unwrap();
    let folder = dir.path().join("performers").join(app.id.to_string());
    let mut manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(folder.join("studio.json")).unwrap()).unwrap();
    manifest["durable_objects"]["OTHER"] = "Counter".into();
    manifest["durable_objects"]["TODOS"] = "Counter".into();
    fs::write(folder.join("studio.json"), manifest.to_string()).unwrap();
    fs::write(folder.join("worker.js"),r#"
        export class Counter { constructor(ctx){this.storage=ctx.storage;} async fetch(req) {
          if(new URL(req.url).searchParams.has('oversize')) { await this.storage.put('large','x'.repeat(65536)); return new Response('large'); }
          const count=(await this.storage.get('count')||0)+1;await this.storage.put('count',count);return new Response(String(count));
        }}
        export default { fetch(req,env) { const url=new URL(req.url);return env[url.searchParams.get('ns')||'TODOS'].getByName(url.searchParams.get('name')||'default').fetch(req); } };
    "#).unwrap();
    let runtime = runtime::workerd_path(None).unwrap();
    for (path, expected) in [
        ("/", "1"),
        ("/?ns=OTHER", "1"),
        ("/?name=../../other", "1"),
        ("/", "2"),
    ] {
        let result = w.run(app.id, &runtime, path).unwrap();
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        assert_eq!(result.response.unwrap().body, expected);
    }
    let copy = w.import(&folder).unwrap();
    assert_eq!(
        w.run(copy.id, &runtime, "/")
            .unwrap()
            .response
            .unwrap()
            .body,
        "1"
    );
    assert!(
        w.run(app.id, &runtime, "/?oversize=1")
            .unwrap_err()
            .to_string()
            .contains("64 KiB")
    );
    assert_eq!(
        w.object_data(app.id, "TODOS", "default").unwrap()["count"],
        2
    );
    assert!(
        !w.object_data(app.id, "TODOS", "default")
            .unwrap()
            .contains_key("large")
    );
    let dbs = walkdir::WalkDir::new(dir.path().join(".studio/objects"))
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().is_some_and(|x| x == "db"))
        .count();
    assert_eq!(dbs, 4);
}

#[test]
#[ignore = "requires the development workerd and a functioning MXC backend"]
fn canonical_todo_api_keeps_retry_identities_and_scopes_bulk_mutations() {
    use serde_json::{Value, json};
    use studio::runtime::WorkerRequest;
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w
        .create_from_template("Canonical API", "solid-todomvc")
        .unwrap();
    let runtime = runtime::workerd_path(None).unwrap();
    let post = |body: Value| {
        let result = w
            .request_cancellable(
                app.id,
                &runtime,
                &WorkerRequest {
                    path: "/api/todos".into(),
                    method: "POST".into(),
                    body: Some(body.to_string()),
                },
                None,
                &AtomicBool::new(false),
            )
            .unwrap();
        assert_eq!(result.exit_code, 0, "{}", result.stderr);
        let response = result.response.unwrap();
        assert_eq!(response.status, 200, "{}", response.body);
        serde_json::from_str::<Vec<Value>>(&response.body).unwrap()
    };
    let todo = json!({"id":"a","title":"Retry safely","completed":false});
    post(json!({"type":"add","todo":todo}));
    assert_eq!(post(json!({"type":"add","todo":todo})).len(), 1);
    post(json!({"type":"add","todo":{"id":"b","title":"Independent","completed":false}}));
    post(json!({"type":"toggle","id":"a","completed":true}));
    let data = post(json!({"type":"toggle","id":"a","completed":true}));
    assert_eq!(data[0]["completed"], true); // Retry does not flip it back.
    let data = post(json!({"type":"toggle_all","ids":["b"],"completed":true}));
    assert!(data.iter().all(|t| t["completed"] == true));
    let data = post(json!({"type":"clear_completed","ids":["a"]}));
    assert_eq!(data.len(), 1);
    assert_eq!(data[0]["id"], "b");
    let stored = w.object_data(app.id, "TODOS", "default").unwrap();
    assert_eq!(stored["todos"][0]["id"], "b");
}
