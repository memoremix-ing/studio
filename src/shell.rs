//! Transport-independent shell operations. Native folder selection stays in
//! the desktop adapter; the browser is confined to its CLI-selected workspace.
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use crate::{
    Workspace,
    runtime::{self, WorkerRequest},
};
use anyhow::{Context, Result, ensure};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Catalog,
    Create {
        name: String,
        #[serde(default = "hello")]
        template: String,
    },
    ImportBundle {
        files: BTreeMap<String, String>,
    },
    Review {
        app: Uuid,
    },
    Save {
        app: Uuid,
        module: String,
        text: String,
        revision: String,
    },
    Promote {
        app: Uuid,
        revision: String,
    },
    Demote {
        app: Uuid,
    },
    Delete {
        app: Uuid,
    },
    Run {
        app: Uuid,
        path: String,
    },
    Preview {
        app: Uuid,
    },
    ClosePreview,
    Request {
        app: Uuid,
        revision: String,
        request: WorkerRequest,
    },
}
fn hello() -> String {
    "hello".into()
}

pub fn catalog(workspace: Option<&Workspace>) -> Result<Value> {
    Ok(match workspace {
        Some(w) => {
            json!({"workspace":w.root(), "apps":w.list()?, "templates":crate::templates::list()})
        }
        None => json!({"workspace":null,"apps":[], "templates":crate::templates::list()}),
    })
}

pub fn dispatch(workspace: &Workspace, action: Action, cancelled: &AtomicBool) -> Result<Value> {
    match action {
        Action::ClosePreview => Ok(Value::Null),
        Action::Catalog => catalog(Some(workspace)),
        Action::Create { name, template } => {
            workspace.create_from_template(&name, &template)?;
            catalog(Some(workspace))
        }
        Action::ImportBundle { files } => {
            ensure!(
                files.len() <= 256
                    && files.values().map(String::len).sum::<usize>() <= 8 * 1024 * 1024,
                "sample exceeds bundle limits"
            );
            let files = files
                .into_iter()
                .map(|(name, text)| (name, text.into_bytes()))
                .collect();
            let dir = tempfile::tempdir()?;
            crate::workspace::write_bundle(dir.path(), &files)?;
            workspace.import(dir.path())?;
            catalog(Some(workspace))
        }
        Action::Review { app } => Ok(serde_json::to_value(workspace.review(app)?)?),
        Action::Save {
            app,
            module,
            text,
            revision,
        } => {
            workspace.write_module(app, &module, &text, &revision)?;
            Ok(serde_json::to_value(workspace.review(app)?)?)
        }
        Action::Promote { app, revision } => {
            workspace.promote(app, &revision)?;
            catalog(Some(workspace))
        }
        Action::Demote { app } => {
            workspace.demote(app)?;
            catalog(Some(workspace))
        }
        Action::Delete { app } => {
            workspace.delete_app(app)?;
            catalog(Some(workspace))
        }
        Action::Run { app, path } => {
            let workerd =
                runtime::workerd_path(std::env::var_os("STUDIO_WORKERD").map(PathBuf::from))?;
            Ok(serde_json::to_value(
                workspace.run_cancellable(app, &workerd, &path, cancelled)?,
            )?)
        }
        Action::Request {
            app,
            revision,
            request,
        } => {
            let workerd =
                runtime::workerd_path(std::env::var_os("STUDIO_WORKERD").map(PathBuf::from))?;
            let result = workspace.request_cancellable(
                app,
                &workerd,
                &request,
                Some(&revision),
                cancelled,
            )?;
            ensure!(
                result.exit_code == 0,
                "worker execution failed: {}",
                result.stderr
            );
            Ok(serde_json::to_value(
                result.response.context("missing worker response")?,
            )?)
        }
        Action::Preview { app } => {
            let snapshot = workspace.snapshot(app)?;
            let page = snapshot
                .manifest
                .page
                .as_ref()
                .context("this performer has no browser page")?;
            let mut html = String::from_utf8(snapshot.files[page].clone())?;
            // Pages are data until delivered on the separate booth origin.
            // Inline only bundle-relative assets; never resolve host paths/URLs.
            for (name, bytes) in &snapshot.files {
                if name.ends_with(".js") || name.ends_with(".mjs") {
                    if let Ok(text) = std::str::from_utf8(bytes) {
                        html = html.replace(
                            &format!("<script type=\"module\" src=\"{name}\"></script>"),
                            &format!(
                                "<script type=\"module\">{}</script>",
                                text.replace("</script", "<\\/script")
                            ),
                        );
                    }
                    if let Ok(text) = std::str::from_utf8(bytes) {
                        html = html.replace(
                            &format!("<script src=\"{name}\"></script>"),
                            &format!(
                                "<script>{}</script>",
                                text.replace("</script", "<\\/script")
                            ),
                        );
                    }
                } else if name.ends_with(".css") {
                    let text = std::str::from_utf8(bytes)?;
                    html = html.replace(
                        &format!("<link rel=\"stylesheet\" href=\"{name}\">"),
                        &format!("<style>{}</style>", text.replace("</style", "<\\/style")),
                    );
                }
            }
            Ok(json!({"html":html,"revision":snapshot.revision,"app":app}))
        }
    }
}
