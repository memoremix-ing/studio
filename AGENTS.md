# studio

Memoremix Studio is a malleable content workspace with isolated performer booths.
Its Rust CLI and Electrobun desktop app share a Rust application core, linked
into both the CLI executable and the desktop main process. Keep application
logic and authorization in that core, independent of the CLI, HTTP, desktop
bridge and worker-runtime adapters.

Use **performer** for a program a remixer creates and runs in a **booth**, and
**sample** for work shared for others to remix. Use this terminology in GUI
labels, CLI help and documentation. The desktop application is the Studio app.
Store performer source bundles under `performers/<UUID>/` in a workspace.

The repository contains a CLI, desktop shell, authenticated localhost GUI,
Turso persistence, performer templates and a one-request runtime adapter. Requirements below describe the intended security model; validate
each control in the code and packaged build before relying on it. See
[README.md](README.md) for current capabilities and implementation limits.

## Dependency installation

Respect configured dependency release-age, integrity and security checks. Do not
disable or lower them to make an installation succeed; wait for eligible releases
or choose a compatible version that satisfies the existing policy.

## Trust boundaries

- Treat workspace files, generated code, imported performers, booth HTML and scripts,
  worker output, model output, and renderer messages as untrusted.
- The trusted shell manages grants and workspace state. Each booth receives
  only explicitly granted capabilities. Neither a path, a booth name, a
  localhost origin, nor a webview id by itself authorizes an operation.
- Bind grants to a host-maintained caller identity, workspace, booth and
  generation. Validate arguments and authorization in the Rust core for every
  transport. Do not trust a caller-supplied tenant id or target webview id.
- Revoke capabilities on booth teardown or replacement. Mediate content writes
  through scoped APIs, including symlink/path escape checks; do not expose
  arbitrary filesystem, shell, process, or unrestricted network access.
- Keep shell secrets and authority out of booth renderers and worker globals.
  Put credentials in a narrowly scoped broker when possible. Log security
  decisions without recording tokens, keys, or private content.
- Browser origins, storage partitions, V8 isolates, and OS sandboxes provide
  different boundaries. Do not substitute one for another or claim protection
  against a compromised OS or a process that can read studio's memory/profile.

## Localhost servers

Prefer the native desktop bridge for shell administration and inherited or
access-controlled local IPC for runtime control. Avoid an administrative HTTP
listener solely to connect the desktop shell to its Rust core. Booth preview
servers and Electrobun's own transport can still create listeners: inventory
them rather than claiming the whole desktop app opens no ports.

### Binding and routing

- Treat loopback as reachable by other local processes and users. Bind only
  loopback, never `0.0.0.0`, `::`, or a hostname with unchecked resolution.
- For browser-facing localhost names, reserve both `127.0.0.1` and `[::1]` on
  the same port before serving, and fail closed if either is occupied. Permit
  IPv4 alone only when IPv6 loopback is actually unavailable. Do not rely on a
  particular browser's address preference. For port 0, bind one family, obtain
  its port, then bind the other; release and retry if the second bind fails.
- Parse and check HTTP authority/Host on every request, including upgrades.
  Allow only the exact names and port registered for the current run and booth;
  do not accept arbitrary `*.localhost`, suffix lookalikes, duplicate Host
  values, or untrusted forwarded-host headers. Reject external hostnames to
  prevent DNS rebinding. Define equivalent authority checks for HTTP/2 if used.
- Use an unpredictable origin for each run, with at least 128 random bits,
  such as `studio-<random>.localhost`. Give each booth its own origin within
  that run. Route only explicitly registered names. Never serve the shell or
  bootstrap tokens at a fixed localhost name or a previous run's origin.
- Wrong-name browser requests must not serve application content or exchange
  credentials. An optional 421 discovery response may contain only the public
  current address. Explicit numeric-address CLI endpoints still require
  authentication; an absent `Sec-Fetch-Site` is not proof of a trusted client.
- Verify localhost resolution and origin/site behavior in each supported
  browser and renderer. Separate ports create separate origins, but cookies
  ignore ports and different ports on one host can remain same-site.

### Sessions and request checks

- Authenticate every read or write of private state, and all event streams,
  WebSockets and other upgrade endpoints. Public shell assets contain no
  secrets. Booth sessions never authorize the shell or another booth.
- Bootstrap through a trusted channel, such as a printed URL with a short-lived,
  single-use random token in its fragment. Exchange it for a scoped session
  using a request body, then remove the fragment with `history.replaceState`.
  Fragments are hidden from HTTP URLs and Referer, but visible to page scripts,
  browser history and code serving a compromised origin. Redact the exchange
  body from logs too.
- Do not use cookies for local administrative sessions: cookies are scoped to
  hosts and paths, not ports; `HttpOnly` does not hide them from another server
  on that host. Keep browser bearer sessions in memory or `sessionStorage` and
  send them in a custom header. Keep server sessions in memory and invalidate
  them on restart. Do not persist secrets in localStorage or IndexedDB.
- Treat persistent preferences as untrusted input. If same-origin tabs share
  sessions over BroadcastChannel, validate offered sessions against the server
  before accepting them. Never broadcast shell sessions to booth origins.
- GET and HEAD must have no state-changing effects. For browser mutations,
  including session exchange, require an exact allowed Origin and require
  `Sec-Fetch-Site: same-origin` when present. Reject `Origin: null`. Support
  non-browser clients through an explicit authenticated policy; do not weaken
  browser checks merely because these headers can be omitted or forged by CLI
  clients. Origin checks supplement credentials rather than replace them.
- Keep administrative APIs same-origin without CORS. A custom session header
  makes cross-origin fetches preflight; do not authorize those preflights.
  Any intentional booth-to-service CORS requires a narrow, documented policy
  and its own scoped authorization. Validate WebSocket Origin separately and
  do not put reusable credentials in URLs.
- For shell HTTP responses, set `X-Frame-Options: DENY`, CSP
  `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and
  `Referrer-Policy: no-referrer`, plus a restrictive tested script policy.
  Booths intended for framing need an explicit allowlist of shell ancestors
  instead of DENY. Do not assume these HTTP controls apply to custom schemes.

### Content, restarts and server authentication

- Never serve untrusted content as executable HTML, SVG or script at the
  privileged shell origin. Return data as JSON and render plain text with
  `textContent`. Rich content and runnable performers belong in isolated booth
  contexts. Any sanitizer must have a defined policy and tests.
- A process taking an old port can install a service worker or leave storage
  and pages listening for sessions. A fresh origin prevents prepared state at
  an old origin from following a new run; random ports alone are insufficient.
  It does not authenticate a server that later takes over the current port.
- Old tabs can send drafts or credentials to a replacement server even if
  those credentials no longer authorize studio. Do not send private data to
  an unauthenticated replacement. Use an authenticated channel rooted in a
  trusted bootstrap when this threat is in scope, and stop background writes
  when the authenticated session/channel ends.
- Use HTTP for browser-facing loopback servers by default. Supported browsers
  already treat localhost origins as secure contexts; verify the APIs Studio
  needs on each supported browser and renderer. Do not require a local CA,
  certificate installation or warning click-throughs for normal use. HTTP
  does not authenticate the server; prefer the native bridge or protected local
  IPC for operations that require a trusted connection to the running app.
- Bootstrap authenticated channels from trusted application code and a trusted
  launch channel. Use a reviewed protocol that binds requests and responses to
  the session and operation, with replay protection and appropriate key and
  nonce management.

## Electrobun desktop

### Shell, booths and bridges

- Load only packaged, trusted shell assets into a privileged webview. Never
  navigate a bridged shell to remote or booth content. Treat injected shell
  script as having every capability exposed by its bridge. Set explicit
  navigation and event callbacks on each view, including a no-op event callback
  when events are unused.
- Install an explicit `internal_bridge` handler on every non-sandboxed
  webview. Use a deny/no-op handler when child tags are unnecessary. The
  audited core/SDK defaults accept powerful `webviewTag*` operations; do not
  forward them wholesale. Create views in the host and enforce sender/target
  ownership for navigation, preload, script execution, devtools and lifecycle
  operations. Child ids in payloads are not ownership evidence.
- Accept application RPC only from host-created, currently authorized views.
  Validate message schema, size, operation and scope. Bind the native sender
  to its grant; remove it from the registry when closed or navigated away.
- Use `sandbox: true` for booth and remote views, without privileged preloads,
  shell keys, or application RPC. In Electrobun 2.0.4, sandboxed
  tags retain an event-only `window.__electrobunSendToHost()` channel. Treat
  those events as untrusted and never translate them into ambient authority.
  Verify bridge behavior on every supported renderer.
- Give booths separate origins and storage partitions. Use ephemeral
  partitions by default; persistent per-booth state is an explicit feature.
  A partition separates browsing state, not necessarily renderer processes.
  Electrobun does not promise one OS process per webview/tag.
- Mediate deliberate shell/booth communication with a small capability API.
  For postMessage transports, check sender window, exact origin, schema and
  scope; use exact target origins. Handle opaque origins explicitly.

### Schemes, navigation and permissions

- Reserve `views://studio/*` for trusted bundled assets. The audited CEF
  scheme bypasses CSP, and audited CEF/WKWebView permission paths trust
  `views://` content. Never use it for user HTML or rely on CSP there as a
  security boundary. Recheck the exact shipped core and renderer versions.
- Keep `appdata://` / `allowed_protocols.app_data` disabled unless required
  and scoped. Do not depend solely on a scheme handler's traversal checks to
  protect private data. Test encoded separators, traversal and symlink escapes.
- Use default-deny navigation rules (audited semantics: last match wins,
  `^` blocks), such as `["^*", "views://studio/*"]` for the shell. Apply
  rules before untrusted navigation is possible and to every frame. Deny or
  explicitly handle new windows, popups, downloads and external protocols;
  do not send unvalidated URLs to the OS.
- Navigation rules do not filter fetch, XHR, WebSockets, subresources or all
  other network paths. Worker outbound policy also does not constrain a
  booth's browser JavaScript. If booth egress is restricted, enforce that
  separately through verified renderer/network controls and test bypasses.
- Explicitly restrict device permissions for booths. Electrobun's bridge
  sandbox flag alone does not establish permission denial, browser process
  hardening, or filesystem/network isolation.

### Transport, debugging and storage

- Electrobun's audited core opens a loopback socket (starting at port 50000)
  and selects connections by webview id without Origin authentication.
  Treat it as attack surface even when studio uses the native bridge.
- Generate a fresh cryptographically random 32-byte secret per webview for
  its AES-256-GCM transport, including sandboxed views: the core requires a
  valid key even when the privileged transport is disabled. Never enable
  `setWebviewPlaintextHostTransport`. Page scripts can read the page's key;
  transport encryption does not protect a view from its own scripts.
- On macOS, permit HTTP preview loads with an ATS exception scoped to
  `localhost` and its subdomains. Keep arbitrary-load exceptions disabled.
  Apply release plist changes before signing and verify the packaged renderer.
- Do not infer replay protection or availability from encryption. Other
  clients can attempt connection displacement; verify fallback, cleanup and
  malformed/replayed-message handling against the shipped binary.
- Explicitly disable remote debugging/inspectors for Electrobun/CEF, workerd,
  and other embedded runtimes in development and packaged defaults. Audited
  CEF development builds otherwise enable a local debugging endpoint. Any
  opt-in is temporary and must be absent from distributed builds.
- `persist:*` partitions keep browser state on disk. Store ordinary preferences
  there, not administrative credentials; use an appropriate protected native
  credential store for secrets that must survive restart.

## Persistence

Use local Turso databases for host metadata and separately scoped Durable Object
state. Use the `.turso` extension and exclude databases and their sidecars from
version control through each new workspace's `.gitignore`, preserving existing
ignore rules. Keep database paths, object indexes and SQL connections in the Rust core;
workers receive only their own bounded data through host-authorized bindings.
Key object identities by performer, namespace and object name. Imports never carry host
trust grants or another performer's data. Serialize mutations, validate storage limits
before commits, and preserve identities and provenance during catalog migrations.
Treat Turso's experimental multiprocess WAL mode as a version-pinned on-disk
contract; all CLI and desktop processes must use the same engine and mode.

## Worker execution and tenant policy

- workerd supplies runtime primitives, not the complete hosted Workers for
  Platforms control plane. Studio owns deployment identity, dispatch policy,
  tenant authorization, capability grants, persistence, quotas and auditing.
- Model dispatch, user execution and outbound policy as distinct roles. Resolve
  the booth from authenticated host state. Grant workers only required service
  bindings; never let user code choose its own privileged outbound service.
- Deny general worker egress by default. Static workers otherwise default
  `globalOutbound` to `internet`. Dynamic WorkerCode supports
  `globalOutbound: null`; use a trusted gateway capability for allowed egress.
  Cover TCP connect, redirects, DNS-resolved private/loopback addresses,
  WebSockets and alternate service bindings. Inject credentials only for
  authorized destinations without forwarding them across redirects.
- Key dynamic-worker caches by tenant, code revision and capability/policy
  revision. Reusing a loader name can reuse a live worker; changing source or
  grants must not accidentally reuse an old instance. Isolate durable storage,
  cache namespaces and resource identifiers too; globals are not persistence.
- Studio must enforce CPU, memory, concurrency, storage and output limits.
  workerd's standalone server defaults are designed for single-tenant use;
  supplied worker limits may not be enforced by its local adapters. Verify
  enforcement in the version Studio ships, including interruption of runaway
  JavaScript, and apply independently enforceable sandbox/process limits.
- Upstream explicitly says workerd alone is not a hardened sandbox. Run
  potentially hostile booth code inside an appropriate additional security
  boundary, such as a suitably configured VM or OS sandbox. An ordinary child
  process running as the user gives crash separation but still has that user's
  authority. Decide which tenants may share a sandbox and its failure domain.
- Link the trusted studio core into CLI and desktop main processes. Keep
  hostile worker execution outside the privileged main process. A Rust helper
  executable may itself embed workerd, with narrow authenticated/inherited IPC
  and restricted filesystem/network access. Package it with the performer.
- Pin the exact workerd source revision and build configuration. Its Rust
  server and cxx/KJ/V8 integration are Bazel-built internals, not an established
  Cargo embedding contract. The in-process server is a test harness that mocks
  the Internet; the CLI entry path can exit/re-exec the process. Build a deliberate
  lifecycle adapter instead of treating either as a desktop-ready library API.

## Verification

When implementing or changing these boundaries, add focused regression checks
for the behavior changed: dual-family bind conflicts, authority/rebinding
rejection, authentication and cross-origin requests, stale sessions/origins,
cross-booth access, bridge ownership, booth network bypasses and permission
denial, runtime escape surface, quota exhaustion and clean shutdown. Test the
actual packaged core as well as source-level policy on each supported renderer
and platform. Documentation-only changes need review and link checks, not a
runtime build. Record unverified behavior as such.

Version-specific guidance is based on source review of Electrobun 2.0.4
(`c54c0c14876455d43a25af0f9cd41a4b14e21854`) and workerd 2026-10-20
(`320013cc48a9d5e274a1ae91c25360abcc4ce540`). This is not runtime validation
of Studio. Revalidate these assumptions against the versions Studio ships.

Primary references:

- [workerd sandbox warning](https://github.com/cloudflare/workerd#warning-workerd-is-not-a-hardened-sandbox)
- [workerd configuration schema](https://github.com/cloudflare/workerd/blob/320013cc48a9d5e274a1ae91c25360abcc4ce540/src/workerd/server/workerd.capnp)
- [Dynamic Worker API and cache identity](https://developers.cloudflare.com/dynamic-workers/api-reference/)
- [Dynamic Worker egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/)
- [Hosted outbound Workers](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/outbound-workers/)
