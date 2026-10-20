# Memoremix Studio

A malleable content workspace with isolated app booths, built as a Rust CLI
and an Electrobun desktop app sharing a Rust core.

Studio's users are **remixers**. Remixers modify apps we author, author their
own apps, and share their work as **samples** for other remixers to explore
and remix.

## Proposed execution and trust model

Booths are grouped by trust so that each booth does not require its own
workerd process:

- **Trusted realm:** apps we ship, a remixer's personal remixes of our trusted
  code, and apps that remixer personally authored can share one workerd
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

## Try the first implementation

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
workerd version may need to age before installation; an intentional immediate
installation can use `--minimum-release-age 0`.

Commands return JSON. Use the app UUID from `new` or `list`:

```sh
studio --workspace /path/to/workspace list
studio --workspace /path/to/workspace run APP_UUID --path '/?name=Studio'
studio --workspace /path/to/workspace import samples/hello
studio --workspace /path/to/workspace review IMPORTED_APP_UUID
studio --workspace /path/to/workspace promote IMPORTED_APP_UUID --revision REVIEWED_SHA256
studio --workspace /path/to/workspace demote IMPORTED_APP_UUID
studio --workspace /path/to/workspace plan APP_UUID
```

Use `cargo run --` instead of `studio`, or `cargo install --path . --locked`
to install the CLI. `STUDIO_WORKERD` or `run --workerd` can select an explicit
workerd executable. The development default finds the pinned runtime in this
checkout. The desktop accepts `STUDIO_WORKERD` too.

Each app is a dedicated source directory containing `studio.json` and its
modules. The starter in [samples/hello](samples/hello) shows the format.
Supported modules are JavaScript ES modules (`.js`, `.mjs`), JSON, text and
WebAssembly. Imports copy source files without running installation or build
scripts. Symlinks and special files are rejected. Bundles are limited to 256
files, 2 MiB per file and 8 MiB total. This prototype accepts prebuilt modules;
it does not install npm dependencies or transpile TypeScript.

The workspace stores host-managed provenance and review grants under
`.studio/`; editable app files live under `apps/APP_UUID/`. A complete bundle
digest includes module paths, contents and the manifest. Promotion requires
the exact digest displayed by `review`. Any later edit to an imported sample
changes its realm until the new revision is reviewed. Execution snapshots the
same bytes used to classify the app, so subsequent edits cannot change an
already prepared run. The workspace catalog is host state, not an importable
trust assertion; other processes with unrestricted access as the same OS user
remain outside this protection.

## Desktop

The Electrobun shell links the same Rust core and uses its native bridge,
without a Studio administrative HTTP listener. It provides workspace
selection, app creation and sample import, module editing, revision review,
promotion/demotion and a local request runner. App code and response text are
displayed as text in the shell; runnable booth pages are not implemented yet.

With [Hutch](https://framework.blackboard.sh/electrobun/guides/hutch/) installed:

```sh
cd desktop
hutch electrobun sync
cargo generate-lockfile
hutch run dev
```

Electrobun 2.0.4 is pinned. The desktop uses the platform's native webview;
remote debugging is disabled. Choose a workspace folder in the app, or set
`STUDIO_WORKSPACE` to initialize/open a specific folder at startup. Runtime
installation is a separate development step above; the current app bundle
does not yet include workerd. Release packaging, signing and updates remain
to be implemented.

## Runtime scope

`run` executes one fetch request through a host-generated workerd test harness
inside an MXC sandbox. A trusted run stages trusted apps together in one
workerd process; a solitary run stages only its selected sample. Staging uses
immutable copies, and neither the workspace catalog nor other solitary apps
is granted to the sandbox. Network access is denied both by workerd routing
and by the OS sandbox. The child receives a minimal environment, read-only
staged modules and private scratch storage. There is no unsandboxed fallback.

Each invocation currently starts and stops a runtime. Long-lived shared
realms, dynamic deployment, explicit content/service bindings, durable app
storage and the outbound credential broker are subsequent work. workerd runs
as a child executable for this first adapter; linking its runtime into a Rust
helper still requires a build/lifecycle integration.

The runner limits wall time to 10 seconds, CPU time to 5 seconds on its Unix
backends, captured output to 128 KiB per stream, and response bodies to 64 KiB.
It terminates runaway or flooding workers and cancels active requests during
desktop shutdown. Hard process-memory and storage quotas are not implemented;
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
```

The opt-in tests exercise real workerd execution, denied worker egress, output
flooding and runaway JavaScript. On macOS they also launch a non-workerd probe
under the actual MXC policy to verify kernel denial of a host file and a live
loopback listener. These checks do not constitute a complete sandbox audit.
See [AGENTS.md](AGENTS.md) for implementation guidance.
