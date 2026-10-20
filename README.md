# Memoremix Studio

A malleable content workspace with isolated performer booths, built as a Rust CLI
and an Electrobun desktop app sharing a Rust core.

Studio's users are **remixers**. A **performer** is a program a remixer creates
and runs in an isolated **booth**. Remixers modify performers we author, author
their own, and share their work as **samples** for others to explore and remix.

## Proposed execution and trust model

Booths are grouped by trust so that each booth does not require its own
workerd process:

- **Trusted realm:** performers we ship, a remixer's personal remixes of our trusted
  code, and performers that remixer personally authored can share one workerd
  process inside an MXC-managed sandbox.
- **Other remixers' samples:** each initially runs in its own MXC-managed
  sandbox with its own workerd process, separate from the trusted realm and
  from other samples.
- **Promotion after review:** the remixer may explicitly promote a reviewed
  sample into the trusted realm. Trust applies to the reviewed revision;
  importing updates or code from another remixer requires a new trust decision.
  Making a personal copy or editing an imported sample does not automatically
  promote it.

The trusted realm shares runtime overhead and a process failure boundary.
Booths within it still have separate capability grants and storage identities;
joining it does not grant access to every other booth or to the privileged
desktop shell. Separate sandboxes contain the effects of a runtime escape in
an unreviewed sample. Studio's trusted core and credential broker remain
outside worker sandboxes.

## Try Studio

Requires Rust 1.92 or later. Worker execution currently supports macOS and
Linux; the sandbox integration has been exercised on macOS 26.5.1 (Apple
silicon). MXC's macOS backend requires macOS 15 or later. Linux requires
Bubblewrap 0.5 or later and enabled unprivileged user namespaces.

Install the pinned development runtime with Bun, then create a workspace:

```sh
bun install --cwd tools/runtime
cargo run -- init --workspace /path/to/workspace
cargo run -- new "My first remix" --workspace /path/to/workspace
```

If your Bun configuration defers newly published packages, the exact pinned
workerd version may need to age before installation. Let the configured
release-age protection take effect.

Most commands return JSON. Use the performer UUID from `new` or `list`:

```sh
studio templates
studio --workspace /path/to/workspace new "My todos" --template solid-todomvc
studio --workspace /path/to/workspace serve
studio --workspace /path/to/workspace list
studio --workspace /path/to/workspace run PERFORMER_UUID --path '/?name=Studio'
studio --workspace /path/to/workspace import samples/hello
studio --workspace /path/to/workspace review IMPORTED_PERFORMER_UUID
studio --workspace /path/to/workspace promote IMPORTED_PERFORMER_UUID --revision REVIEWED_SHA256
studio --workspace /path/to/workspace demote IMPORTED_PERFORMER_UUID
studio --workspace /path/to/workspace plan PERFORMER_UUID
```

Use `cargo run --` instead of `studio`, or `cargo install --path . --locked`
to install the CLI. `STUDIO_WORKERD` or `run --workerd` can select an explicit
workerd executable. The development default finds the pinned runtime in this
checkout. The desktop accepts `STUDIO_WORKERD` too.

Each performer is a dedicated source directory containing `studio.json` and its
modules. The starter in [samples/hello](samples/hello) shows the format.
Supported modules are JavaScript ES modules (`.js`, `.mjs`), JSON, text and
WebAssembly, plus HTML and CSS for browser pages. TS/TSX files are retained
as editable source data. Imports copy source files
without running installation or build scripts. Symlinks and special files are rejected. Bundles are limited to 256
files, 2 MiB per file and 8 MiB total. This prototype accepts prebuilt modules;
it does not install npm dependencies or transpile TypeScript.

The workspace stores host-managed provenance and review grants in the local
Turso database `.studio/studio.turso`; editable performer files live under
`performers/PERFORMER_UUID/`. A complete bundle digest includes module paths, contents and the manifest. Promotion requires
the exact digest displayed by `review`. Any later edit to an imported sample
changes its realm until the new revision is reviewed. Execution snapshots the
same bytes used to classify the performer, so subsequent edits cannot change an
already prepared run. The workspace catalog is host state, not an importable
trust assertion; other processes with unrestricted access as the same OS user
remain outside this protection.

## Performer templates

`studio templates` lists built-in templates. Use `new NAME --template hello`
for a minimal Worker, or `--template solid-todomvc` for a Solid 2 TodoMVC performer.
Both GUI hosts offer a template selector in **New performer**. Templates shipped by
Studio create personal performers; importing the same source as a sample remains
solitary until review. Each created performer has a fresh storage identity.

The TodoMVC template uses Solid's [canonical Todos example from
solid-js@2.0.0-rc.15](https://github.com/solidjs/solid/tree/solid-js%402.0.0-rc.15/examples/todos).
Its JSX components, optimistic store/actions, loading/error boundaries, retry
controls, hash filters and CSS are unchanged. Studio replaces the mock API with
a named Turso-backed TodoList object. The canonical example supports adding,
completing, deleting, filtering, toggling all and clearing completed todos.
Use **Open performer preview** to interact with it.

Runtime/compiler packages remain pinned to **2.0.0-rc.14**, compatible with the
example and eligible under the configured dependency release-age policy. Solid 2
is still a release candidate. Source, upstream revision/hashes, adaptation notes
and explicit rebuild commands live in
[templates/solid-todomvc](templates/solid-todomvc). Created performers include the
canonical TS/TSX sources and a prebuilt browser bundle; source edits require an
explicit build before reopening the preview. Creation/import never installs
packages or runs build scripts.

## Local GUI

```sh
studio --workspace /path/to/workspace serve
# Select a port explicitly if needed:
studio --workspace /path/to/workspace serve --port 4848
```

The default is `--port 0`, which automatically chooses an available port.
Open the link printed in the terminal. It uses a fresh random localhost name,
holds both IPv4 and IPv6 loopback addresses on the same port (IPv4 alone only
when IPv6 is unavailable), and checks the exact authority and browser Origin.
The fragment token works once, expires after five minutes, and is exchanged for
an in-memory server session; the tab retains its bearer in sessionStorage.
Sessions expire after eight hours and are lost on restart. Restart `serve` for
a fresh link. No cookies or CORS are used. Ctrl-C cancels active workers and
stops the server. HTTP does not authenticate a replacement process that later
takes over the same port; use the native bridge for operations requiring a
trusted connection to the running app.

Select a booth and choose **Delete performer…** to permanently remove its source
files and all its stored performer data. The confirmation names the selected performer;
Cancel keeps it intact. Deletion closes the current preview. Other performers and
their data are preserved.

The browser workbench supports templates, source editing, review/promotion,
local requests and sample folder uploads. It is scoped to the workspace named
on the CLI; it has no arbitrary host-path or folder-selection API. Binary
samples can be imported through the CLI or desktop's native folder chooser.

Performer previews run at separate random booth origins with short-lived, performer-scoped
sessions. A booth can request only its own Worker revision; it cannot select
another performer or call shell administration. Browser previews use sandboxed
cross-origin frames; desktop previews use separate unprivileged webviews.
Replacing or closing a preview revokes its session and cancels active requests.
Browser network restrictions are a prototype and require further platform
validation, including navigation-based egress; the OS sandbox covers Worker
execution, not the browser renderer.

## Turso persistence and Durable Objects

Studio uses the embedded Rust Turso engine (`turso = 0.8.3`), with no hosted
account or network connection required. Workspace metadata and the object
index live in `.studio/studio.turso`. Each object lives in its own database under
`.studio/objects/PERFORMER_UUID/SHA256_NAMESPACE/SHA256_OBJECT_NAME.turso`. Performer identity,
namespace and object name define its scope; worker-supplied paths are never used.
Keep the `.studio/` directory together when backing up a stopped workspace.
New workspaces create a `.gitignore` that excludes `.studio/`, `*.turso`
databases and `*.turso-*` sidecars (including WAL and shared-memory files)
throughout the workspace. Existing ignore rules are preserved; performer
source files remain available to version control.
Existing JSON catalogs migrate on open, preserving identities, provenance and
review grants; a conflicting JSON catalog and database fail closed.

A performer declares bindings in `studio.json`, for example:

```json
{ "durable_objects": { "TODOS": "TodoList" } }
```

Its entry module exports `TodoList`, a class with `constructor(ctx, env)` and
`fetch(request)`. `ctx.storage` supports async JSON `get`, `put`, `delete`,
`deleteAll` and `list`; callers use `env.TODOS.getByName("default").fetch(request)`.
`idFromName`/`get` are also supported. These are Studio's initial Durable Object
semantics: per-request instances, JSON values, serialized execution per workspace,
64 KiB total hydrated state per performer, up to 32 objects and 128 keys per object.
There are no alarms, WebSocket hibernation, direct SQL or storage transactions yet.
Each object's commit is atomic; updates spanning objects have no shared
transaction. Failed Worker execution or cancellation before commit discards staged changes;
a failure during a multi-object commit may leave earlier objects committed.

Only the selected performer's bounded state enters its Worker. A separate trusted
runner authenticates the completion record, and Rust validates object scope
and quotas before committing. Worker sandboxes receive no database files or
SQL connections. `studio object PERFORMER_UUID TODOS default` inspects one object's
JSON through the trusted CLI. Source imports and templates never copy performer data.

## Desktop

The Electrobun shell links the same Rust core and uses its native bridge,
without a Studio administrative HTTP listener. It provides workspace
selection, performer creation and sample import, module editing, revision review,
promotion/demotion, a local request runner and isolated performer previews. Performer code
and response text are displayed as text in the shell. Only booth preview
listeners are opened for performer pages; administrative operations use the native bridge.

With [Hutch](https://framework.blackboard.sh/electrobun/guides/hutch/) installed:

```sh
cd desktop
hutch electrobun sync
cargo generate-lockfile
hutch run dev
```

Electrobun 2.0.4 is pinned. The desktop uses the platform's native webview;
remote debugging is disabled. On macOS, the build enables HTTP only for
`localhost` and its subdomains in App Transport Security so isolated previews
can load without installing certificates. Choose a workspace folder in the app, or set
`STUDIO_WORKSPACE` to initialize/open a specific folder at startup. Runtime
installation is a separate development step above; the current app bundle
does not yet include workerd. Release packaging, signing and updates remain
to be implemented.

## Runtime scope

`run` executes one fetch request through a host-generated workerd test harness
inside an MXC sandbox. A trusted run stages trusted performers together in one
workerd process; a solitary run stages only its selected sample. Staging uses
immutable copies, and neither the workspace catalog nor other solitary performers
is granted to the sandbox. Network access is denied both by workerd routing
and by the OS sandbox. The child receives a minimal environment, read-only
staged modules and private scratch storage. There is no unsandboxed fallback.

Each invocation currently starts and stops a runtime. Long-lived shared
realms, dynamic deployment, explicit content/service bindings, expanded
Durable Object semantics and the outbound credential broker are subsequent work. workerd runs
as a child executable for this first adapter; linking its runtime into a Rust
helper still requires a build/lifecycle integration.

The runner limits wall time to 10 seconds, CPU time to 5 seconds on its Unix
backends, captured output to 256 KiB per stream, and response bodies to 64 KiB.
It terminates runaway or flooding workers and cancels active requests during
desktop shutdown. Hard process-memory and sandbox scratch-disk quotas remain
unimplemented;
do not treat this prototype as ready to execute hostile samples. Runtime
escapes, VM containment and browser-renderer isolation require further review
and validation before distribution.

## Development checks

```sh
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
# Requires the installed runtime and a working native sandbox:
cargo test --locked -- --ignored
# After synchronizing the Electrobun SDK:
cargo clippy --manifest-path desktop/Cargo.toml --no-deps --all-targets -- -D warnings
# After building the dev desktop app, in a graphical macOS session:
python3 desktop/scripts/preview-smoke.py
```

The opt-in tests exercise real workerd execution, denied worker egress, output
flooding, runaway JavaScript and Turso persistence/isolation across requests.
On macOS they also launch a non-workerd probe
under the actual MXC policy to verify kernel denial of a host file and a live
loopback listener. These checks do not constitute a complete sandbox audit.
The native preview probe uses a disposable bundle and workspace to exercise
TodoMVC rendering, adding/completing todos, filters, Turso persistence after
reopening, denied navigation to other origins/the shell, confirmed deletion
and cancellation, preservation of other booths, and clean shutdown.
Its `preview-smoke` Cargo feature is excluded from normal desktop builds.
See [AGENTS.md](AGENTS.md) for implementation guidance.
