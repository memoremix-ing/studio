use std::fs;
use studio::{Origin, Realm, Workspace};

#[test]
fn initialization_preserves_custom_ignore_rules_and_is_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let ignore = dir.path().join(".gitignore");
    // No final newline: appended Studio rules still need their own lines.
    let custom = b"/build/\n!important.turso";
    fs::write(&ignore, custom).unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let original = fs::read(&ignore).unwrap();
    assert!(original.starts_with(custom));
    assert!(dir.path().join(".studio/studio.turso").is_file());
    assert!(!dir.path().join(".studio/studio.db").exists());
    w.create("Keep on reinitialization").unwrap();
    assert_eq!(
        Workspace::init(dir.path()).unwrap().list().unwrap().len(),
        1
    );
    assert_eq!(fs::read(&ignore).unwrap(), original);
}

#[cfg(unix)]
#[test]
fn initialization_rejects_an_ignore_symlink_without_writing_its_target() {
    use std::os::unix::fs::symlink;
    let dir = tempfile::tempdir().unwrap();
    let target = tempfile::NamedTempFile::new().unwrap();
    fs::write(target.path(), "preserved").unwrap();
    symlink(target.path(), dir.path().join(".gitignore")).unwrap();
    assert!(Workspace::init(dir.path()).is_err());
    assert_eq!(fs::read_to_string(target.path()).unwrap(), "preserved");
    assert!(!dir.path().join(".studio").exists());
}

#[test]
fn catalog_is_in_turso_and_legacy_provenance_survives_migration() {
    let dir = tempfile::tempdir().unwrap();
    let state = dir.path().join(".studio");
    fs::create_dir(&state).unwrap();
    let app = uuid::Uuid::new_v4();
    let files = dir.path().join("performers").join(app.to_string());
    fs::create_dir_all(&files).unwrap();
    fs::write(
        files.join("studio.json"),
        include_bytes!("../samples/hello/studio.json"),
    )
    .unwrap();
    fs::write(
        files.join("worker.js"),
        include_bytes!("../samples/hello/worker.js"),
    )
    .unwrap();
    fs::write(state.join("catalog.json"),serde_json::json!({"version":1,"workspace_id":uuid::Uuid::new_v4(),"apps":[{"id":app,"name":"Legacy sample","origin":"imported","reviewed_revision":null}]}).to_string()).unwrap();
    let w = Workspace::open(dir.path()).unwrap();
    assert!(!state.join("catalog.json").exists());
    assert!(state.join("studio.turso").exists());
    let snap = w.snapshot(app).unwrap();
    assert_eq!(snap.app.origin, Origin::Imported);
    assert_eq!(snap.realm, Realm::Solitary { app_id: app });
    drop(w);
    assert_eq!(
        Workspace::open(dir.path()).unwrap().list().unwrap()[0]
            .app
            .id,
        app
    );
}
#[test]
fn templates_are_personal_and_unknown_templates_do_not_create_apps() {
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w.create_from_template("My todos", "solid-todomvc").unwrap();
    let snap = w.snapshot(app.id).unwrap();
    assert_eq!(snap.app.origin, Origin::Personal);
    assert_eq!(snap.realm, Realm::Trusted);
    assert_eq!(snap.manifest.durable_objects["TODOS"], "TodoList");
    assert_eq!(snap.manifest.page.as_deref(), Some("index.html"));
    assert!(snap.files.contains_key("client.js"));
    assert!(w.create_from_template("Missing", "../template").is_err());
    assert_eq!(w.list().unwrap().len(), 1);
    // Importing that exact source is still someone else's solitary sample.
    let sample = w
        .import(dir.path().join("performers").join(app.id.to_string()))
        .unwrap();
    assert_eq!(
        w.snapshot(sample.id).unwrap().realm,
        Realm::Solitary { app_id: sample.id }
    );
}
#[cfg(unix)]
#[test]
fn database_and_wal_symlinks_are_rejected() {
    use std::os::unix::fs::symlink;
    for suffix in ["", "-wal", "-shm", "-tshm"] {
        let dir = tempfile::tempdir().unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        drop(w);
        let path = dir.path().join(format!(".studio/studio.turso{suffix}"));
        if path.exists() {
            fs::remove_file(&path).unwrap();
        }
        symlink("/etc/passwd", path).unwrap();
        assert!(Workspace::open(dir.path()).is_err());
    }
}

#[test]
fn canonical_solid_sources_are_preserved_with_their_upstream_revision() {
    use sha2::{Digest, Sha256};
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w
        .create_from_template("Canonical", "solid-todomvc")
        .unwrap();
    let snapshot = w.snapshot(app.id).unwrap();
    let provenance: serde_json::Value =
        serde_json::from_slice(&snapshot.files["upstream.json"]).unwrap();
    assert_eq!(
        provenance["commit"],
        "4937f0a2bfddd45a65738c189075aff577530073"
    );
    let files = provenance["unchanged_files_sha256"].as_object().unwrap();
    assert_eq!(files.len(), 5);
    for (path, hash) in files {
        assert_eq!(
            hex::encode(Sha256::digest(&snapshot.files[path])),
            hash.as_str().unwrap(),
            "{path} differs from pinned upstream source"
        );
    }
    assert!(!snapshot.files.contains_key("solid.js"));
}
