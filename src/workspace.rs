use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use anyhow::{Context, Result, ensure};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use walkdir::WalkDir;

const MAX_FILE: u64 = 2 * 1024 * 1024;
const MAX_BUNDLE: usize = 8 * 1024 * 1024;
const MAX_FILES: usize = 256;
const DEFAULT_WORKER: &str = include_str!("../samples/hello/worker.js");

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AppManifest {
    pub name: String,
    pub entrypoint: String,
    pub compatibility_date: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    Personal,
    Imported,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct App {
    pub id: Uuid,
    pub name: String,
    pub origin: Origin,
    /// Imported code remains imported after copying, editing, or renaming.
    pub reviewed_revision: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Realm {
    Trusted,
    Solitary { app_id: Uuid },
}

#[derive(Debug, Serialize)]
pub struct Review {
    pub app: App,
    pub revision: String,
    pub realm: Realm,
    pub manifest: AppManifest,
    pub files: Vec<ReviewedFile>,
}

#[derive(Debug, Serialize)]
pub struct ReviewedFile {
    pub path: String,
    pub bytes: usize,
    pub sha256: String,
    pub text: Option<String>,
}

/// An immutable in-memory bundle: the exact bytes classified and executed.
#[derive(Clone, Debug)]
pub struct Snapshot {
    pub app: App,
    pub manifest: AppManifest,
    pub revision: String,
    pub realm: Realm,
    pub files: BTreeMap<String, Vec<u8>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Catalog {
    version: u32,
    workspace_id: Uuid,
    apps: Vec<App>,
}

#[derive(Clone, Debug)]
pub struct Workspace {
    root: PathBuf,
}

impl Workspace {
    pub fn init(root: impl AsRef<Path>) -> Result<Self> {
        fs::create_dir_all(root.as_ref())?;
        let root = root.as_ref().canonicalize()?;
        let state = root.join(".studio");
        if state.exists() {
            return Self::open(root);
        }
        ensure!(
            fs::symlink_metadata(&state).is_err(),
            ".studio must not be a symlink"
        );
        fs::create_dir(&state)?;
        let workspace = Self { root };
        let _lock = workspace.lock()?;
        workspace.save(&Catalog {
            version: 1,
            workspace_id: Uuid::new_v4(),
            apps: Vec::new(),
        })?;
        Ok(workspace)
    }

    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let workspace = Self {
            root: root.as_ref().canonicalize()?,
        };
        ensure_directory(&workspace.root.join(".studio"))?;
        let _lock = workspace.lock()?;
        workspace.catalog()?;
        Ok(workspace)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn list(&self) -> Result<Vec<Review>> {
        let _lock = self.lock()?;
        self.catalog()?
            .apps
            .iter()
            .map(|app| self.snapshot_app(app).map(|s| s.review(false)))
            .collect()
    }

    pub fn create(&self, name: &str) -> Result<App> {
        validate_name(name)?;
        let manifest = AppManifest {
            name: name.to_owned(),
            entrypoint: "worker.js".into(),
            compatibility_date: "2026-10-19".into(),
        };
        let files = BTreeMap::from([
            ("studio.json".into(), serde_json::to_vec_pretty(&manifest)?),
            ("worker.js".into(), DEFAULT_WORKER.as_bytes().to_vec()),
        ]);
        self.add(name, Origin::Personal, files)
    }

    pub fn import(&self, source: impl AsRef<Path>) -> Result<App> {
        // No build scripts or package installation run while importing.
        let files = read_bundle(source.as_ref())?;
        let manifest = manifest(&files)?;
        self.add(&manifest.name, Origin::Imported, files)
    }

    fn add(&self, name: &str, origin: Origin, files: BTreeMap<String, Vec<u8>>) -> Result<App> {
        let _lock = self.lock()?;
        let mut catalog = self.catalog()?;
        let app = App {
            id: Uuid::new_v4(),
            name: name.into(),
            origin,
            reviewed_revision: None,
        };
        let apps = self.root.join("apps");
        if !apps.exists() {
            fs::create_dir(&apps)?;
        }
        ensure_directory(&apps)?;
        let staging = tempfile::tempdir_in(&apps)?;
        write_bundle(staging.path(), &files)?;
        let target = apps.join(app.id.to_string());
        fs::rename(staging.path(), &target)?;
        catalog.apps.push(app.clone());
        if let Err(error) = self.save(&catalog) {
            let _ = fs::remove_dir_all(target);
            return Err(error);
        }
        Ok(app)
    }

    pub fn review(&self, id: Uuid) -> Result<Review> {
        Ok(self.snapshot(id)?.review(true))
    }

    pub fn snapshot(&self, id: Uuid) -> Result<Snapshot> {
        let _lock = self.lock()?;
        let catalog = self.catalog()?;
        let app = catalog
            .apps
            .iter()
            .find(|a| a.id == id)
            .context("unknown app")?;
        self.snapshot_app(app)
    }

    /// A stale review cannot authorize changed code. The expected digest comes
    /// from a prior review, not a newly computed value hidden behind a prompt.
    pub fn promote(&self, id: Uuid, expected_revision: &str) -> Result<()> {
        let _lock = self.lock()?;
        let mut catalog = self.catalog()?;
        let app = catalog
            .apps
            .iter_mut()
            .find(|a| a.id == id)
            .context("unknown app")?;
        ensure!(
            app.origin == Origin::Imported,
            "personal apps already use the trusted realm"
        );
        let snapshot = self.snapshot_app(app)?;
        ensure!(
            snapshot.revision == expected_revision,
            "sample changed since review; review it again"
        );
        app.reviewed_revision = Some(snapshot.revision);
        self.save(&catalog)
    }

    pub fn demote(&self, id: Uuid) -> Result<()> {
        let _lock = self.lock()?;
        let mut catalog = self.catalog()?;
        let app = catalog
            .apps
            .iter_mut()
            .find(|a| a.id == id)
            .context("unknown app")?;
        ensure!(
            app.origin == Origin::Imported,
            "only imported samples have a review grant"
        );
        app.reviewed_revision = None;
        self.save(&catalog)
    }

    /// Save an existing text module only if the editor still has the current
    /// revision. Imported provenance survives edits; its old review no longer
    /// matches the new bytes.
    pub fn write_module(
        &self,
        id: Uuid,
        name: &str,
        text: &str,
        expected_revision: &str,
    ) -> Result<()> {
        validate_path(name)?;
        ensure!(
            name != "studio.json" && text.len() as u64 <= MAX_FILE,
            "invalid module edit"
        );
        let _lock = self.lock()?;
        let catalog = self.catalog()?;
        let app = catalog
            .apps
            .iter()
            .find(|a| a.id == id)
            .context("unknown app")?;
        let snapshot = self.snapshot_app(app)?;
        ensure!(
            snapshot.revision == expected_revision,
            "app changed since it was opened; reload before saving"
        );
        let old = snapshot.files.get(name).context("unknown module")?;
        ensure!(
            std::str::from_utf8(old).is_ok(),
            "binary modules cannot be edited as text"
        );
        let size: usize = snapshot.files.values().map(Vec::len).sum();
        ensure!(
            size - old.len() + text.len() <= MAX_BUNDLE,
            "sample exceeds 8 MiB"
        );
        let path = self.root.join("apps").join(id.to_string()).join(name);
        let mut output =
            tempfile::NamedTempFile::new_in(path.parent().context("missing module parent")?)?;
        output.write_all(text.as_bytes())?;
        output.as_file().sync_all()?;
        output.persist(path)?;
        Ok(())
    }

    /// Co-locate only bundles whose *current bytes* belong to the trusted realm.
    pub fn execution_group(&self, id: Uuid) -> Result<Vec<Snapshot>> {
        let _lock = self.lock()?;
        let catalog = self.catalog()?;
        let app = catalog
            .apps
            .iter()
            .find(|a| a.id == id)
            .context("unknown app")?;
        let selected = self.snapshot_app(app)?;
        if selected.realm != Realm::Trusted {
            return Ok(vec![selected]);
        }
        let mut group = vec![selected];
        for app in catalog.apps.iter().filter(|a| a.id != id) {
            // Broken siblings must not prevent the selected app from running.
            if let Ok(snapshot) = self.snapshot_app(app)
                && snapshot.realm == Realm::Trusted
            {
                group.push(snapshot);
            }
        }
        Ok(group)
    }

    fn snapshot_app(&self, app: &App) -> Result<Snapshot> {
        ensure_directory(&self.root.join("apps"))?;
        let files = read_bundle(&self.root.join("apps").join(app.id.to_string()))?;
        let manifest = manifest(&files)?;
        let revision = revision(&files);
        let trusted =
            app.origin == Origin::Personal || app.reviewed_revision.as_deref() == Some(&revision);
        let realm = if trusted {
            Realm::Trusted
        } else {
            Realm::Solitary { app_id: app.id }
        };
        Ok(Snapshot {
            app: app.clone(),
            manifest,
            revision,
            realm,
            files,
        })
    }

    fn lock(&self) -> Result<File> {
        let lock = self.root.join(".studio/lock");
        if fs::symlink_metadata(&lock).is_ok() {
            ensure_file(&lock)?;
        }
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(lock)?;
        file.lock_exclusive()?;
        Ok(file)
    }

    fn catalog(&self) -> Result<Catalog> {
        let path = self.root.join(".studio/catalog.json");
        let data = read_file(&path)?;
        let catalog: Catalog = serde_json::from_slice(&data).context("invalid Studio catalog")?;
        ensure!(catalog.version == 1, "unsupported Studio catalog version");
        let mut ids = std::collections::HashSet::new();
        ensure!(
            catalog.apps.iter().all(|a| ids.insert(a.id)),
            "duplicate app identity"
        );
        Ok(catalog)
    }

    fn save(&self, catalog: &Catalog) -> Result<()> {
        let mut file = tempfile::NamedTempFile::new_in(self.root.join(".studio"))?;
        serde_json::to_writer_pretty(&mut file, catalog)?;
        file.write_all(b"\n")?;
        file.as_file().sync_all()?;
        file.persist(self.root.join(".studio/catalog.json"))?;
        Ok(())
    }
}

impl Snapshot {
    fn review(self, include_text: bool) -> Review {
        let files = self
            .files
            .into_iter()
            .map(|(path, data)| ReviewedFile {
                path,
                bytes: data.len(),
                sha256: hex::encode(Sha256::digest(&data)),
                text: include_text.then(|| String::from_utf8(data).ok()).flatten(),
            })
            .collect();
        Review {
            app: self.app,
            revision: self.revision,
            realm: self.realm,
            manifest: self.manifest,
            files,
        }
    }
}

fn manifest(files: &BTreeMap<String, Vec<u8>>) -> Result<AppManifest> {
    let data = files
        .get("studio.json")
        .context("sample needs a studio.json manifest")?;
    let manifest: AppManifest = serde_json::from_slice(data).context("invalid studio.json")?;
    validate_name(&manifest.name)?;
    validate_path(&manifest.entrypoint)?;
    ensure!(
        manifest.entrypoint.ends_with(".js") || manifest.entrypoint.ends_with(".mjs"),
        "entrypoint must be a JavaScript module"
    );
    ensure!(
        files.contains_key(&manifest.entrypoint),
        "entrypoint is missing from sample"
    );
    let date = manifest.compatibility_date.as_bytes();
    ensure!(
        date.len() == 10
            && date[4] == b'-'
            && date[7] == b'-'
            && date
                .iter()
                .enumerate()
                .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit()),
        "compatibility_date must be YYYY-MM-DD"
    );
    Ok(manifest)
}

fn validate_name(name: &str) -> Result<()> {
    ensure!(
        !name.trim().is_empty() && name.len() <= 120 && !name.chars().any(char::is_control),
        "app name must contain 1–120 bytes without control characters"
    );
    Ok(())
}

fn validate_path(name: &str) -> Result<()> {
    ensure!(
        !name.is_empty()
            && !name.contains('\\')
            && !name.contains(':')
            && !name.chars().any(char::is_control),
        "invalid module path"
    );
    ensure!(
        Path::new(name)
            .components()
            .all(|p| matches!(p, Component::Normal(_))),
        "module paths must be relative without traversal"
    );
    Ok(())
}

fn ensure_directory(path: &Path) -> Result<()> {
    ensure!(
        fs::symlink_metadata(path)?.file_type().is_dir(),
        "{} must be a real directory",
        path.display()
    );
    Ok(())
}

fn ensure_file(path: &Path) -> Result<()> {
    ensure!(
        fs::symlink_metadata(path)?.file_type().is_file(),
        "{} must be a regular file",
        path.display()
    );
    Ok(())
}

fn read_file(path: &Path) -> Result<Vec<u8>> {
    ensure_file(path)?;
    let mut bytes = Vec::new();
    File::open(path)?
        .take(MAX_FILE + 1)
        .read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= MAX_FILE,
        "file exceeds 2 MiB: {}",
        path.display()
    );
    Ok(bytes)
}

fn read_bundle(root: &Path) -> Result<BTreeMap<String, Vec<u8>>> {
    ensure_directory(root)?;
    let mut files = BTreeMap::new();
    let mut total = 0;
    for entry in WalkDir::new(root).min_depth(1).max_depth(16) {
        let entry = entry?;
        if entry.file_type().is_dir() {
            continue;
        }
        let name = entry
            .path()
            .strip_prefix(root)?
            .to_str()
            .context("module paths must be UTF-8")?
            .replace(std::path::MAIN_SEPARATOR, "/");
        validate_path(&name)?;
        ensure!(
            entry.file_type().is_file(),
            "symlinks and special files are not allowed: {name}"
        );
        ensure!(
            matches!(
                entry.path().extension().and_then(|e| e.to_str()),
                Some("js" | "mjs" | "json" | "txt" | "wasm")
            ),
            "unsupported sample file: {name}; use a dedicated source directory"
        );
        let data = read_file(entry.path())?;
        total += data.len();
        ensure!(
            total <= MAX_BUNDLE && files.len() < MAX_FILES,
            "sample exceeds 8 MiB or 256 files"
        );
        files.insert(name, data);
    }
    manifest(&files)?;
    Ok(files)
}

pub(crate) fn write_bundle(root: &Path, files: &BTreeMap<String, Vec<u8>>) -> Result<()> {
    for (name, bytes) in files {
        validate_path(name)?;
        let path = root.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, bytes)?;
    }
    Ok(())
}

fn revision(files: &BTreeMap<String, Vec<u8>>) -> String {
    let mut digest = Sha256::new();
    digest.update(b"memoremix-studio-bundle-v1\0");
    for (name, bytes) in files {
        digest.update((name.len() as u64).to_be_bytes());
        digest.update(name.as_bytes());
        digest.update((bytes.len() as u64).to_be_bytes());
        digest.update(bytes);
    }
    hex::encode(digest.finalize())
}
