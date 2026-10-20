use std::fs;

use studio::{Origin, Realm, Workspace};
use tempfile::TempDir;

fn workspace() -> (TempDir, Workspace) {
    let dir = tempfile::tempdir().unwrap();
    let workspace = Workspace::init(dir.path()).unwrap();
    (dir, workspace)
}

fn sample() -> TempDir {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("studio.json"),
        include_str!("../samples/hello/studio.json"),
    )
    .unwrap();
    fs::write(
        dir.path().join("worker.js"),
        include_str!("../samples/hello/worker.js"),
    )
    .unwrap();
    dir
}

#[test]
fn imported_samples_are_solitary_even_when_their_code_matches_a_personal_app() {
    let (_dir, workspace) = workspace();
    let own = workspace.create("Personal").unwrap();
    let shared = workspace.import(sample().path()).unwrap();
    assert_eq!(workspace.snapshot(own.id).unwrap().realm, Realm::Trusted);
    assert_eq!(shared.origin, Origin::Imported);
    assert_eq!(workspace.plan(shared.id).unwrap().apps, vec![shared.id]);
    assert_eq!(
        workspace.snapshot(shared.id).unwrap().realm,
        Realm::Solitary { app_id: shared.id }
    );
    assert!(!workspace.plan(own.id).unwrap().apps.contains(&shared.id));
}

#[test]
fn review_grants_follow_exact_bytes_and_edits_revoke_membership() {
    let (_dir, workspace) = workspace();
    let own = workspace.create("Personal").unwrap();
    let shared = workspace.import(sample().path()).unwrap();
    let review = workspace.review(shared.id).unwrap();
    assert!(review.files.iter().all(|file| file.text.is_some()));
    workspace.promote(shared.id, &review.revision).unwrap();
    assert_eq!(workspace.plan(shared.id).unwrap().realm, Realm::Trusted);
    assert!(workspace.plan(own.id).unwrap().apps.contains(&shared.id));
    let file = workspace
        .root()
        .join(format!("performers/{}/worker.js", shared.id));
    fs::write(
        file,
        "export default { fetch() { return new Response('changed'); } };",
    )
    .unwrap();
    assert_eq!(workspace.plan(shared.id).unwrap().apps, vec![shared.id]);
    assert!(!workspace.plan(own.id).unwrap().apps.contains(&shared.id));
    assert!(workspace.promote(shared.id, &review.revision).is_err());
}

#[test]
fn promotion_can_be_revoked_and_cannot_be_declared_in_an_imported_manifest() {
    let (_dir, workspace) = workspace();
    let source = sample();
    let app = workspace.import(source.path()).unwrap();
    workspace
        .promote(app.id, &workspace.review(app.id).unwrap().revision)
        .unwrap();
    workspace.demote(app.id).unwrap();
    assert_eq!(
        workspace.snapshot(app.id).unwrap().realm,
        Realm::Solitary { app_id: app.id }
    );
    let mut manifest: serde_json::Value =
        serde_json::from_str(include_str!("../samples/hello/studio.json")).unwrap();
    manifest["origin"] = "personal".into();
    fs::write(source.path().join("studio.json"), manifest.to_string()).unwrap();
    assert!(workspace.import(source.path()).is_err());
}

#[test]
fn snapshot_keeps_the_reviewed_bytes_when_files_change_later() {
    let (_dir, workspace) = workspace();
    let app = workspace.create("Immutable snapshot").unwrap();
    let snapshot = workspace.snapshot(app.id).unwrap();
    fs::write(
        workspace
            .root()
            .join(format!("performers/{}/worker.js", app.id)),
        "changed",
    )
    .unwrap();
    assert_ne!(
        snapshot.revision,
        workspace.snapshot(app.id).unwrap().revision
    );
    assert_eq!(
        snapshot.files["worker.js"],
        include_bytes!("../samples/hello/worker.js")
    );
}

#[test]
fn initialization_preserves_existing_apps_and_rejects_unknown_catalogs() {
    let (dir, workspace) = workspace();
    let app = workspace.create("Keep me").unwrap();
    assert_eq!(
        Workspace::init(dir.path()).unwrap().list().unwrap()[0]
            .app
            .id,
        app.id
    );
    pollster::block_on(async {
        let db =
            turso::Builder::new_local(dir.path().join(".studio/studio.turso").to_str().unwrap())
                .experimental_multiprocess_wal(true)
                .build()
                .await
                .unwrap();
        db.connect().unwrap().execute("UPDATE studio_state SET value=?1 WHERE key='catalog'", [r#"{"version":99,"workspace_id":"00000000-0000-0000-0000-000000000000","apps":[]}"#]).await.unwrap();
    });
    assert!(Workspace::open(dir.path()).is_err());
}

#[test]
fn manifest_entrypoint_cannot_escape_the_bundle() {
    let (_dir, workspace) = workspace();
    let source = sample();
    let mut manifest: serde_json::Value =
        serde_json::from_str(include_str!("../samples/hello/studio.json")).unwrap();
    for entrypoint in [
        "../worker.js",
        "/worker.js",
        "a/../../worker.js",
        "a\\worker.js",
        "C:worker.js",
    ] {
        manifest["entrypoint"] = entrypoint.into();
        fs::write(source.path().join("studio.json"), manifest.to_string()).unwrap();
        assert!(workspace.import(source.path()).is_err(), "{entrypoint}");
    }
}

#[cfg(unix)]
#[test]
fn imported_symlinks_and_workspace_state_symlinks_are_rejected() {
    use std::os::unix::fs::symlink;
    let (dir, workspace) = workspace();
    let source = sample();
    symlink("/etc/passwd", source.path().join("leak.txt")).unwrap();
    assert!(workspace.import(source.path()).is_err());
    let app = workspace.create("No symlink escapes").unwrap();
    let app_dir = dir.path().join(format!("performers/{}", app.id));
    fs::remove_file(app_dir.join("worker.js")).unwrap();
    symlink("/etc/passwd", app_dir.join("worker.js")).unwrap();
    assert!(workspace.snapshot(app.id).is_err());
    fs::remove_file(dir.path().join(".studio/studio.turso")).unwrap();
    symlink("/etc/passwd", dir.path().join(".studio/studio.turso")).unwrap();
    assert!(Workspace::open(dir.path()).is_err());
}

#[test]
fn shell_metacharacters_in_names_are_data() {
    let (_dir, workspace) = workspace();
    let app = workspace
        .create("Remix $(touch nope) ' \" <script>")
        .unwrap();
    assert_eq!(workspace.snapshot(app.id).unwrap().manifest.name, app.name);
    assert!(!workspace.root().join("nope").exists());
}

#[test]
fn editor_rejects_stale_writes_and_keeps_imported_provenance() {
    let (_dir, workspace) = workspace();
    let app = workspace.import(sample().path()).unwrap();
    let revision = workspace.review(app.id).unwrap().revision;
    workspace.promote(app.id, &revision).unwrap();
    workspace
        .write_module(app.id, "worker.js", "export default {};", &revision)
        .unwrap();
    assert!(
        workspace
            .write_module(app.id, "worker.js", "overwrite", &revision)
            .is_err()
    );
    let snapshot = workspace.snapshot(app.id).unwrap();
    assert_eq!(snapshot.app.origin, Origin::Imported);
    assert_eq!(snapshot.realm, Realm::Solitary { app_id: app.id });
    assert_eq!(snapshot.files["worker.js"], b"export default {};");
    assert!(
        workspace
            .write_module(app.id, "../outside.js", "escape", &snapshot.revision)
            .is_err()
    );
}
