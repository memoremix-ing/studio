//! Bundled templates are authored and reviewed with Studio, never fetched or
//! installed while creating a performer.
use anyhow::{Result, bail};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
pub struct Template {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}
pub fn list() -> Vec<Template> {
    vec![
        Template {
            id: "hello",
            name: "Hello, remixer",
            description: "A minimal Worker to make your own.",
        },
        Template {
            id: "solid-todomvc",
            name: "Solid 2 TodoMVC",
            description: "A todo performer with a Turso-backed Durable Object. Solid 2.0 release candidate.",
        },
    ]
}
pub(crate) fn bundle(id: &str) -> Result<BTreeMap<String, Vec<u8>>> {
    let files: Vec<(&str, &[u8])> = match id {
        "hello" => vec![
            (
                "studio.json",
                include_bytes!("../samples/hello/studio.json"),
            ),
            ("worker.js", include_bytes!("../samples/hello/worker.js")),
        ],
        "solid-todomvc" => vec![
            (
                "studio.json",
                include_bytes!("../templates/solid-todomvc/dist/studio.json"),
            ),
            (
                "worker.js",
                include_bytes!("../templates/solid-todomvc/dist/worker.js"),
            ),
            (
                "client.js",
                include_bytes!("../templates/solid-todomvc/dist/client.js"),
            ),
            (
                "index.html",
                include_bytes!("../templates/solid-todomvc/dist/index.html"),
            ),
            (
                "style.css",
                include_bytes!("../templates/solid-todomvc/dist/style.css"),
            ),
            (
                "solid-license.txt",
                include_bytes!("../templates/solid-todomvc/dist/solid-license.txt"),
            ),
            (
                "upstream.json",
                include_bytes!("../templates/solid-todomvc/dist/upstream.json"),
            ),
            (
                "src/main.tsx",
                include_bytes!("../templates/solid-todomvc/dist/src/main.tsx"),
            ),
            (
                "src/app.tsx",
                include_bytes!("../templates/solid-todomvc/dist/src/app.tsx"),
            ),
            (
                "src/todos.ts",
                include_bytes!("../templates/solid-todomvc/dist/src/todos.ts"),
            ),
            (
                "src/filter.ts",
                include_bytes!("../templates/solid-todomvc/dist/src/filter.ts"),
            ),
            (
                "src/api.ts",
                include_bytes!("../templates/solid-todomvc/dist/src/api.ts"),
            ),
            (
                "src/app.css",
                include_bytes!("../templates/solid-todomvc/dist/src/app.css"),
            ),
        ],
        _ => bail!("unknown template; use studio templates"),
    };
    Ok(files
        .into_iter()
        .map(|(name, data)| (name.into(), data.to_vec()))
        .collect())
}
