//! Local Turso persistence. Database paths are host-generated; workers receive
//! bounded JSON snapshots, never filenames, connections, or SQL authority.
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, ensure};
use serde_json::Value;
use sha2::{Digest, Sha256};
use turso::{Builder, Connection};
use uuid::Uuid;

use crate::Workspace;
use crate::workspace::{ensure_directory, ensure_file};

pub type ObjectData = BTreeMap<String, Value>;
pub type ObjectSnapshot = BTreeMap<String, BTreeMap<String, ObjectData>>;
pub const MAX_STORAGE_BYTES: usize = 64 * 1024;
const SCHEMA: &str =
    "CREATE TABLE IF NOT EXISTS studio_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);";

fn database(path: &Path) -> Result<(turso::Database, Connection)> {
    // Turso may open sidecars itself. Reject existing links/special files for
    // every file the driver can use; same-user filesystem races are out of scope.
    for suffix in ["", "-wal", "-shm", "-tshm"] {
        let file = PathBuf::from(format!("{}{suffix}", path.display()));
        if fs::symlink_metadata(&file).is_ok() {
            ensure_file(&file)?;
        }
    }
    let db = pollster::block_on(
        Builder::new_local(path.to_str().context("database path must be UTF-8")?)
            .experimental_multiprocess_wal(true)
            .build(),
    )?;
    let conn = db.connect()?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    pollster::block_on(conn.execute_batch(SCHEMA))?;
    Ok((db, conn))
}

fn read(path: &Path, key: &str) -> Result<Option<String>> {
    let (_db, conn) = database(path)?;
    pollster::block_on(async {
        let mut rows = conn
            .query("SELECT value FROM studio_state WHERE key = ?1", [key])
            .await?;
        Ok(rows
            .next()
            .await?
            .map(|row| row.get::<String>(0))
            .transpose()?)
    })
}

fn write(path: &Path, key: &str, value: &str) -> Result<()> {
    let (_db, conn) = database(path)?;
    pollster::block_on(conn.execute(
        "INSERT INTO studio_state (key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key,value]))?;
    Ok(())
}

pub(crate) fn catalog_read(root: &Path) -> Result<Option<String>> {
    read(&root.join(".studio/studio.db"), "catalog")
}
pub(crate) fn catalog_write(root: &Path, value: &str) -> Result<()> {
    write(&root.join(".studio/studio.db"), "catalog", value)
}

pub(crate) fn catalog_delete_app(root: &Path, value: &str, app: Uuid) -> Result<()> {
    let (_db, mut conn) = database(&root.join(".studio/studio.db"))?;
    pollster::block_on(async {
        let tx = conn.transaction().await?;
        tx.execute(
            "UPDATE studio_state SET value = ?1 WHERE key = 'catalog'",
            [value],
        )
        .await?;
        tx.execute(
            "DELETE FROM studio_state WHERE key = ?1",
            [format!("objects/{app}")],
        )
        .await?;
        tx.commit().await?;
        Ok(())
    })
}

fn index(root: &Path, app: Uuid) -> Result<Vec<(String, String)>> {
    let value = read(&root.join(".studio/studio.db"), &format!("objects/{app}"))?;
    Ok(value
        .map(|v| serde_json::from_str(&v))
        .transpose()?
        .unwrap_or_default())
}

fn object_path(root: &Path, app: Uuid, namespace: &str, name: &str) -> Result<PathBuf> {
    let mut dir = root.join(".studio");
    ensure_directory(&dir)?;
    for part in [
        "objects".to_owned(),
        app.to_string(),
        hex::encode(Sha256::digest(namespace)),
    ] {
        dir.push(part);
        if fs::symlink_metadata(&dir).is_err() {
            fs::create_dir(&dir)?;
        }
        ensure_directory(&dir)?;
    }
    Ok(dir.join(format!("{}.db", hex::encode(Sha256::digest(name)))))
}

fn validate(snapshot: &ObjectSnapshot, namespaces: &BTreeMap<String, String>) -> Result<()> {
    ensure!(
        serde_json::to_vec(snapshot)?.len() <= MAX_STORAGE_BYTES,
        "performer storage exceeds 64 KiB prototype limit"
    );
    let mut count = 0;
    for (namespace, objects) in snapshot {
        ensure!(
            namespaces.contains_key(namespace),
            "unknown Durable Object namespace"
        );
        count += objects.len();
        for (name, values) in objects {
            ensure!(
                !name.is_empty() && name.len() <= 128 && !name.chars().any(char::is_control),
                "object names must contain 1–128 bytes without control characters"
            );
            ensure!(
                values.len() <= 128 && values.keys().all(|k| !k.is_empty() && k.len() <= 256),
                "invalid object storage keys"
            );
        }
    }
    ensure!(
        count <= 32,
        "at most 32 objects per performer in this prototype"
    );
    Ok(())
}

impl Workspace {
    pub(crate) fn load_objects(
        &self,
        app: Uuid,
        namespaces: &BTreeMap<String, String>,
    ) -> Result<ObjectSnapshot> {
        let mut snapshot = ObjectSnapshot::new();
        for (namespace, name) in index(self.root(), app)? {
            // Removing a namespace revokes access without deleting its data.
            if !namespaces.contains_key(&namespace) {
                continue;
            }
            let path = object_path(self.root(), app, &namespace, &name)?;
            let values = read(&path, "data")?.context("object database is missing its data")?;
            snapshot
                .entry(namespace)
                .or_default()
                .insert(name, serde_json::from_str(&values)?);
        }
        validate(&snapshot, namespaces)?;
        Ok(snapshot)
    }

    pub(crate) fn commit_objects(
        &self,
        app: Uuid,
        snapshot: &ObjectSnapshot,
        namespaces: &BTreeMap<String, String>,
    ) -> Result<()> {
        validate(snapshot, namespaces)?;
        let mut entries = index(self.root(), app)?;
        for (namespace, objects) in snapshot {
            for (name, values) in objects {
                let path = object_path(self.root(), app, namespace, name)?;
                // One atomic JSON-row update per object; no cross-object atomicity.
                write(&path, "data", &serde_json::to_string(values)?)?;
                let identity = (namespace.clone(), name.clone());
                if !entries.contains(&identity) {
                    entries.push(identity);
                }
            }
        }
        write(
            &self.root().join(".studio/studio.db"),
            &format!("objects/{app}"),
            &serde_json::to_string(&entries)?,
        )
    }

    /// Inspect one app's object data through the trusted CLI/core. Worker
    /// authority is assigned separately from the selected execution snapshot.
    pub fn object_data(&self, app: Uuid, namespace: &str, name: &str) -> Result<ObjectData> {
        let _lock = self.runtime_lock()?;
        let manifest = self.snapshot(app)?.manifest;
        ensure!(
            manifest.durable_objects.contains_key(namespace),
            "unknown Durable Object namespace"
        );
        Ok(self
            .load_objects(app, &manifest.durable_objects)?
            .get(namespace)
            .and_then(|o| o.get(name))
            .cloned()
            .unwrap_or_default())
    }

    pub(crate) fn runtime_lock_cancellable(
        &self,
        cancelled: &std::sync::atomic::AtomicBool,
    ) -> Result<fs::File> {
        use fs2::FileExt;
        let path = self.root().join(".studio/runtime.lock");
        if fs::symlink_metadata(&path).is_ok() {
            ensure_file(&path)?;
        }
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)?;
        let start = std::time::Instant::now();
        loop {
            ensure!(
                !cancelled.load(std::sync::atomic::Ordering::Acquire),
                "request cancelled"
            );
            match file.try_lock_exclusive() {
                Ok(()) => return Ok(file),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(error) => return Err(error.into()),
            }
            ensure!(
                start.elapsed() < std::time::Duration::from_secs(10),
                "workspace runtime is busy"
            );
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }

    pub(crate) fn runtime_lock(&self) -> Result<fs::File> {
        use fs2::FileExt;
        let path = self.root().join(".studio/runtime.lock");
        if fs::symlink_metadata(&path).is_ok() {
            ensure_file(&path)?;
        }
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)?;
        file.lock_exclusive()?;
        Ok(file)
    }
}

#[cfg(test)]
mod deletion_tests {
    use super::*;
    use serde_json::json;

    fn seed(workspace: &Workspace, app: Uuid, value: &str) {
        workspace
            .commit_objects(
                app,
                &BTreeMap::from([
                    (
                        "TODOS".into(),
                        BTreeMap::from([(
                            "default".into(),
                            BTreeMap::from([("value".into(), json!(value))]),
                        )]),
                    ),
                    (
                        "RETIRED".into(),
                        BTreeMap::from([(
                            "old".into(),
                            BTreeMap::from([("value".into(), json!(value))]),
                        )]),
                    ),
                ]),
                &BTreeMap::from([
                    ("TODOS".into(), "TodoList".into()),
                    ("RETIRED".into(), "OldClass".into()),
                ]),
            )
            .unwrap();
    }

    #[test]
    fn deletion_removes_only_its_source_objects_and_index() {
        let dir = tempfile::tempdir().unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        let deleted = w.create_from_template("Delete", "solid-todomvc").unwrap();
        let keep = w.create_from_template("Keep", "solid-todomvc").unwrap();
        seed(&w, deleted.id, "deleted data");
        seed(&w, keep.id, "preserved data");
        let before = w.snapshot(keep.id).unwrap().revision;
        assert!(w.delete_app(Uuid::new_v4()).is_err());
        assert_eq!(w.list().unwrap().len(), 2);
        w.delete_app(deleted.id).unwrap();
        assert!(
            !dir.path()
                .join(format!("performers/{}", deleted.id))
                .exists()
        );
        assert!(
            !dir.path()
                .join(format!(".studio/objects/{}", deleted.id))
                .exists()
        );
        assert!(
            read(
                &dir.path().join(".studio/studio.db"),
                &format!("objects/{}", deleted.id)
            )
            .unwrap()
            .is_none()
        );
        assert!(w.snapshot(deleted.id).is_err());
        assert!(w.object_data(deleted.id, "TODOS", "default").is_err());
        let reopened = Workspace::open(dir.path()).unwrap();
        assert_eq!(reopened.list().unwrap().len(), 1);
        assert_eq!(reopened.snapshot(keep.id).unwrap().revision, before);
        assert_eq!(
            reopened.object_data(keep.id, "TODOS", "default").unwrap()["value"],
            "preserved data"
        );
    }

    #[test]
    fn deleting_a_reviewed_sample_preserves_its_original_source() {
        let source_dir = tempfile::tempdir().unwrap();
        let source = Workspace::init(source_dir.path()).unwrap();
        let original = source.create("Original sample").unwrap();
        let original_revision = source.snapshot(original.id).unwrap().revision;
        let dir = tempfile::tempdir().unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        let copy = w
            .import(
                source_dir
                    .path()
                    .join(format!("performers/{}", original.id)),
            )
            .unwrap();
        w.promote(copy.id, &w.snapshot(copy.id).unwrap().revision)
            .unwrap();
        w.delete_app(copy.id).unwrap();
        assert!(w.list().unwrap().is_empty());
        assert_eq!(
            source.snapshot(original.id).unwrap().revision,
            original_revision
        );
    }

    #[test]
    fn reopening_finishes_interrupted_deletion() {
        let dir = tempfile::tempdir().unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        let deleted = w
            .create_from_template("Interrupted", "solid-todomvc")
            .unwrap();
        let keep = w.create("Keep").unwrap();
        seed(&w, deleted.id, "pending cleanup");
        // Simulate interruption just after the durable revocation transaction.
        let mut catalog: Value =
            serde_json::from_str(&catalog_read(dir.path()).unwrap().unwrap()).unwrap();
        catalog["apps"]
            .as_array_mut()
            .unwrap()
            .retain(|app| app["id"] != deleted.id.to_string());
        catalog["pending_deletions"] = json!([deleted.id]);
        catalog_delete_app(dir.path(), &catalog.to_string(), deleted.id).unwrap();
        let reopened = Workspace::open(dir.path()).unwrap();
        assert!(
            !dir.path()
                .join(format!("performers/{}", deleted.id))
                .exists()
        );
        assert!(
            !dir.path()
                .join(format!(".studio/objects/{}", deleted.id))
                .exists()
        );
        assert_eq!(reopened.list().unwrap()[0].app.id, keep.id);
        let catalog: Value =
            serde_json::from_str(&catalog_read(dir.path()).unwrap().unwrap()).unwrap();
        assert!(catalog.get("pending_deletions").is_none());
    }

    #[test]
    fn deletion_waits_for_in_flight_storage_commits() {
        use std::sync::mpsc;
        let dir = tempfile::tempdir().unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        let app = w
            .create_from_template("In flight", "solid-todomvc")
            .unwrap();
        let active = w.runtime_lock().unwrap();
        let other = w.clone();
        let (started, start) = mpsc::channel();
        let (finished, finish) = mpsc::channel();
        let thread = std::thread::spawn(move || {
            started.send(()).unwrap();
            finished.send(other.delete_app(app.id)).unwrap();
        });
        start.recv().unwrap();
        assert!(
            finish
                .recv_timeout(std::time::Duration::from_millis(100))
                .is_err()
        );
        seed(&w, app.id, "last worker commit");
        drop(active);
        finish
            .recv_timeout(std::time::Duration::from_secs(5))
            .unwrap()
            .unwrap();
        thread.join().unwrap();
        assert!(w.snapshot(app.id).is_err());
        assert!(
            !dir.path()
                .join(format!(".studio/objects/{}", app.id))
                .exists()
        );
    }

    #[cfg(unix)]
    #[test]
    fn deletion_rejects_substituted_roots_and_never_follows_nested_links() {
        use std::os::unix::fs::symlink;
        for root in [
            "performers",
            "performers/APP",
            ".studio/objects",
            ".studio/objects/APP",
        ] {
            let dir = tempfile::tempdir().unwrap();
            let outside = tempfile::tempdir().unwrap();
            fs::write(outside.path().join("keep"), "outside").unwrap();
            let w = Workspace::init(dir.path()).unwrap();
            let app = w.create_from_template("Symlink", "solid-todomvc").unwrap();
            seed(&w, app.id, "keep on rejection");
            let path = dir.path().join(root.replace("APP", &app.id.to_string()));
            let original = dir.path().join("original");
            fs::rename(&path, &original).unwrap();
            symlink(outside.path(), &path).unwrap();
            let before = catalog_read(dir.path()).unwrap();
            assert!(w.delete_app(app.id).is_err());
            assert_eq!(catalog_read(dir.path()).unwrap(), before);
            assert_eq!(
                fs::read_to_string(outside.path().join("keep")).unwrap(),
                "outside"
            );
        }
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("keep"), "outside").unwrap();
        let w = Workspace::init(dir.path()).unwrap();
        let app = w.create("Nested symlink").unwrap();
        symlink(
            outside.path(),
            dir.path().join(format!("performers/{}/linked", app.id)),
        )
        .unwrap();
        w.delete_app(app.id).unwrap();
        assert_eq!(
            fs::read_to_string(outside.path().join("keep")).unwrap(),
            "outside"
        );
    }
}
