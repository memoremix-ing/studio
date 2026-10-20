# Canonical Solid 2 Todos template

Adapted from Solid's [canonical client-side Todos example at
solid-js@2.0.0-rc.15](https://github.com/solidjs/solid/tree/solid-js%402.0.0-rc.15/examples/todos),
commit `4937f0a2bfddd45a65738c189075aff577530073`.

`src/app.tsx`, `src/todos.ts`, `src/filter.ts`, `src/main.tsx` and `src/app.css`
are unchanged upstream files. They retain the canonical JSX components,
`createOptimisticStore`, `action` generators, per-item pending/error/retry state,
`Loading`/`Errored` boundaries and hash-based filters. The upstream example does
not implement editing todo titles. [upstream.json](upstream.json) records the
source revision, hashes and adaptations. The upstream MIT license is included.

Studio replaces `src/api.ts`'s localStorage mock with a performer-scoped Worker API.
`src/worker.js` implements a TodoList object whose named `default` instance
persists in a separate Turso database per created performer. Caller-generated todo
IDs survive retries, and bulk operations affect only the IDs selected by the UI.
Real request failures feed the original retry affordances; the mock's random
33% write failures and artificial delays are not enabled. `index.html` loads
the bundled client and stylesheet; `studio.json` supplies the deployment data.

The source comes from RC.15. Runtime packages and the JSX compiler remain
pinned to **2.0.0-rc.14**, which supports this example and satisfies the existing
dependency release-age policy. Keep release-age and integrity checks enabled.
The Babel integration compiles the canonical TSX with Solid's official compiler;
creating or importing a performer never runs installation or build scripts.

Rebuild the embedded template after editing its source:

```sh
bun install --frozen-lockfile --cwd templates/solid-todomvc
bun run --cwd templates/solid-todomvc build
```

Rebuild Studio, then create a performer with `studio new "My todos" --template
solid-todomvc`, or choose it in the workbench's New performer dialog. New performers include
the original TS/TSX source and the prebuilt `client.js`/`style.css`.

To compile source edits in an existing performer, run the template's explicit build
command, then reopen the preview:

```sh
bun run --cwd templates/solid-todomvc build --performer /path/to/workspace/performers/PERFORMER_UUID
```

Studio displays and edits TS/TSX as source data; it does not transpile it on save.
The command above uses this template's pinned tooling, not scripts from the performer.
