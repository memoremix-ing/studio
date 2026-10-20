//! Authenticated loopback GUI host. Only the exact random authority for this
//! run serves assets or accepts sessions; the server holds both IP families.
use crate::{Workspace, shell};
use anyhow::{Context, Result, bail};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Extension, Request, State},
    http::{HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::io::ErrorKind;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::net::TcpListener;
use uuid::Uuid;

fn secret() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}
fn digest(value: &str) -> [u8; 32] {
    Sha256::digest(value).into()
}
#[derive(Clone)]
struct Booth {
    host: String,
    app: Uuid,
    revision: String,
    html: String,
    token: [u8; 32],
    session: Option<[u8; 32]>,
    created: Instant,
    cancelled: Arc<AtomicBool>,
}
struct Session {
    token: Option<([u8; 32], Instant)>,
    session: Option<([u8; 32], Instant)>,
}
pub struct Server {
    host: String,
    workspace: Workspace,
    session: Mutex<Session>,
    cancelled: Arc<AtomicBool>,
    requests: Arc<tokio::sync::Semaphore>,
    booth: Mutex<Option<Booth>>,
    preview_changes: Mutex<()>,
    admin: bool,
}
impl Server {
    pub fn new(workspace: Workspace, port: u16, cancelled: Arc<AtomicBool>) -> Arc<Self> {
        Arc::new(Self {
            host: format!("studio-{}.localhost:{port}", Uuid::new_v4().simple()),
            workspace,
            session: Mutex::new(Session {
                token: None,
                session: None,
            }),
            cancelled,
            requests: Arc::new(tokio::sync::Semaphore::new(4)),
            booth: Mutex::new(None),
            preview_changes: Mutex::new(()),
            admin: true,
        })
    }
    pub fn booth_only(workspace: Workspace, port: u16, cancelled: Arc<AtomicBool>) -> Arc<Self> {
        let mut server = Self::new(workspace, port, cancelled);
        Arc::get_mut(&mut server).unwrap().admin = false;
        server
    }
    pub fn preview(&self, app: Uuid) -> Result<String> {
        let _change = self.preview_changes.lock().unwrap();
        let page = shell::dispatch(
            &self.workspace,
            shell::Action::Preview { app },
            &self.cancelled,
        )?;
        let token = secret();
        let port = self.host.rsplit_once(':').unwrap().1;
        let host = format!("booth-{}.localhost:{port}", Uuid::new_v4().simple());
        let link = format!("http://{host}/#token={token}");
        let booth = Booth {
            host,
            app,
            revision: page["revision"].as_str().unwrap().into(),
            html: page["html"].as_str().unwrap().into(),
            token: digest(&token),
            session: None,
            created: Instant::now(),
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        if let Some(previous) = self.booth.lock().unwrap().replace(booth) {
            previous.cancelled.store(true, Ordering::Release);
        }
        Ok(link)
    }
    fn revoke_preview(&self) {
        if let Some(booth) = self.booth.lock().unwrap().take() {
            booth.cancelled.store(true, Ordering::Release);
        }
    }
    pub fn link(&self) -> String {
        let token = secret();
        self.session.lock().unwrap().token = Some((digest(&token), Instant::now()));
        format!("http://{}/#token={token}", self.host)
    }
    pub fn host(&self) -> &str {
        &self.host
    }
    pub fn router(self: &Arc<Self>) -> Router {
        Router::new()
            .route("/", get(index))
            .route("/index.html", get(index))
            .route(
                "/booth.js",
                get(|| async {
                    asset(
                        "text/javascript; charset=utf-8",
                        include_str!("../desktop/web/booth.js"),
                    )
                }),
            )
            .route("/api/booth/session", post(booth_redeem))
            .route("/api/booth/page", get(booth_page))
            .route("/api/booth/request", post(booth_request))
            .route(
                "/app.js",
                get(|| async {
                    asset(
                        "text/javascript; charset=utf-8",
                        include_str!("../desktop/web/app.js"),
                    )
                }),
            )
            .route(
                "/style.css",
                get(|| async {
                    asset(
                        "text/css; charset=utf-8",
                        include_str!("../desktop/web/style.css"),
                    )
                }),
            )
            .route("/api/session", post(redeem))
            .route("/api/action", post(action))
            .layer(DefaultBodyLimit::max(12 * 1024 * 1024))
            .layer(middleware::from_fn_with_state(self.clone(), guard))
            .with_state(self.clone())
    }
}
fn asset(mime: &'static str, body: &'static str) -> Response {
    ([(header::CONTENT_TYPE, mime)], body).into_response()
}
async fn index(State(server): State<Arc<Server>>, headers: axum::http::HeaderMap) -> Response {
    if headers.get("host").and_then(|v| v.to_str().ok()) == Some(server.host.as_str()) {
        asset(
            "text/html; charset=utf-8",
            include_str!("../desktop/web/index.html"),
        )
    } else {
        asset(
            "text/html; charset=utf-8",
            "<!doctype html><html><head><meta charset=utf-8><title>Studio booth</title><script src=/booth.js defer></script></head><body>Opening performer…</body></html>",
        )
    }
}
fn refuse(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({"error":message}))).into_response()
}

async fn guard(State(server): State<Arc<Server>>, mut request: Request, next: Next) -> Response {
    let headers = request.headers();
    let single = |name: &str| headers.get_all(name).iter().count() == 1;
    let value = |name: &str| headers.get(name).and_then(|v| v.to_str().ok());
    let host = value("host").unwrap_or("");
    let booth = server
        .booth
        .lock()
        .unwrap()
        .clone()
        .filter(|b| b.host == host && b.created.elapsed() < Duration::from_secs(1800));
    let shell = server.admin && host == server.host;
    let authority_ok = single("host")
        && (shell || booth.is_some())
        && request.uri().authority().is_none_or(|a| a.as_str() == host);
    let mutation = request.method() != Method::GET && request.method() != Method::HEAD;
    let origin = format!("http://{host}");
    // Header-free clients must explicitly identify the CLI policy; a browser
    // cannot forge it cross-origin without a preflight that we never authorize.
    let cli = value("x-studio-client") == Some("cli")
        && !headers.contains_key("origin")
        && !headers.contains_key("sec-fetch-site");
    let browser = single("origin")
        && value("origin") == Some(origin.as_str())
        && value("sec-fetch-site").is_none_or(|v| v == "same-origin");
    let shell_session = single("x-studio-session")
        && value("x-studio-session").is_some_and(|s| {
            server
                .session
                .lock()
                .unwrap()
                .session
                .as_ref()
                .is_some_and(|(d, at)| {
                    *d == digest(s) && at.elapsed() < Duration::from_secs(8 * 3600)
                })
        });
    let booth_session = single("x-studio-session")
        && value("x-studio-session").is_some_and(|s| {
            booth
                .as_ref()
                .and_then(|b| b.session)
                .is_some_and(|d| d == digest(s))
        });
    let authenticated = if shell { shell_session } else { booth_session };
    let path = request.uri().path();
    let scope_ok = if shell {
        !path.starts_with("/api/booth/") && path != "/booth.js"
    } else {
        [
            "/",
            "/booth.js",
            "/api/booth/session",
            "/api/booth/page",
            "/api/booth/request",
        ]
        .contains(&path)
    };
    let mut response = if server.cancelled.load(Ordering::Acquire) {
        refuse(StatusCode::SERVICE_UNAVAILABLE, "Studio is stopping")
    } else if !authority_ok {
        refuse(
            StatusCode::MISDIRECTED_REQUEST,
            "Open the current link printed by studio serve",
        )
    } else if !scope_ok {
        refuse(
            StatusCode::FORBIDDEN,
            "Session scope does not authorize this endpoint",
        )
    } else if headers.contains_key("origin")
        && (!single("origin") || value("origin") != Some(origin.as_str()))
    {
        refuse(StatusCode::FORBIDDEN, "Cross-origin request refused")
    } else if mutation && !browser && !cli {
        refuse(
            StatusCode::FORBIDDEN,
            "An exact same-origin request is required",
        )
    } else if path.starts_with("/api/")
        && path != "/api/session"
        && path != "/api/booth/session"
        && !authenticated
    {
        refuse(
            StatusCode::UNAUTHORIZED,
            "Open a fresh link printed by studio serve",
        )
    } else {
        if let Some(booth) = booth {
            request.extensions_mut().insert(booth);
        }
        next.run(request).await
    };
    let h = response.headers_mut();
    let csp = if shell {
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-src http://*.localhost:*; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'".to_owned()
    } else {
        let ancestor = if server.admin {
            format!("http://{}", server.host)
        } else {
            "views://studio".into()
        };
        format!(
            "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-src 'none'; frame-ancestors {ancestor}; base-uri 'none'; object-src 'none'; form-action 'none'"
        )
    };
    h.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_str(&csp).unwrap(),
    );
    for (key, value) in [
        ("x-content-type-options", "nosniff"),
        ("referrer-policy", "no-referrer"),
        ("cache-control", "no-store"),
    ] {
        h.insert(key, HeaderValue::from_static(value));
    }
    if shell {
        h.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    }
    response
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Redeem {
    token: String,
}
async fn redeem(State(server): State<Arc<Server>>, Json(input): Json<Redeem>) -> Response {
    let mut state = server.session.lock().unwrap();
    if !state.token.as_ref().is_some_and(|(d, at)| {
        *d == digest(&input.token) && at.elapsed() < Duration::from_secs(300)
    }) {
        return refuse(StatusCode::FORBIDDEN, "Link is expired or already used");
    }
    state.token = None;
    let session = secret();
    state.session = Some((digest(&session), Instant::now()));
    Json(json!({"session":session})).into_response()
}
async fn action(State(server): State<Arc<Server>>, Json(action): Json<shell::Action>) -> Response {
    let Ok(permit) = server.requests.clone().try_acquire_owned() else {
        return refuse(StatusCode::TOO_MANY_REQUESTS, "Studio is busy");
    };
    let result = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        if let shell::Action::Preview { app } = action {
            return Ok(json!({"url":server.preview(app)?}));
        }
        if matches!(action, shell::Action::ClosePreview) {
            server.revoke_preview();
            return Ok(json!(null));
        }
        if matches!(action, shell::Action::Delete { .. }) {
            // Serialize with preview creation so an older snapshot cannot
            // publish a new preview after deletion has revoked it.
            let _change = server.preview_changes.lock().unwrap();
            server.revoke_preview();
            return shell::dispatch(&server.workspace, action, &server.cancelled);
        }
        shell::dispatch(&server.workspace, action, &server.cancelled)
    })
    .await;
    match result {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(error)) => refuse(StatusCode::BAD_REQUEST, &format!("{error:#}")),
        Err(_) => refuse(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Studio could not complete the operation",
        ),
    }
}

async fn booth_redeem(
    State(server): State<Arc<Server>>,
    Extension(authorized): Extension<Booth>,
    Json(input): Json<Redeem>,
) -> Response {
    let mut state = server.booth.lock().unwrap();
    let Some(booth) = state.as_mut() else {
        return refuse(StatusCode::FORBIDDEN, "Preview ended");
    };
    if booth.host != authorized.host
        || booth.session.is_some()
        || booth.token != digest(&input.token)
        || booth.created.elapsed() > Duration::from_secs(300)
    {
        return refuse(
            StatusCode::FORBIDDEN,
            "Preview link expired or already used",
        );
    }
    let session = secret();
    booth.session = Some(digest(&session));
    Json(json!({"session":session})).into_response()
}
async fn booth_page(Extension(booth): Extension<Booth>) -> Response {
    Json(json!({"html":booth.html})).into_response()
}
async fn booth_request(
    State(server): State<Arc<Server>>,
    Extension(booth): Extension<Booth>,
    Json(request): Json<crate::runtime::WorkerRequest>,
) -> Response {
    let Ok(permit) = server.requests.clone().try_acquire_owned() else {
        return refuse(StatusCode::TOO_MANY_REQUESTS, "Studio is busy");
    };
    match tokio::task::spawn_blocking(move || {
        let _permit = permit;
        shell::dispatch(
            &server.workspace,
            shell::Action::Request {
                app: booth.app,
                revision: booth.revision,
                request,
            },
            &booth.cancelled,
        )
    })
    .await
    {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(error)) => refuse(StatusCode::BAD_REQUEST, &format!("{error:#}")),
        Err(_) => refuse(StatusCode::INTERNAL_SERVER_ERROR, "Booth request failed"),
    }
}

/// Native shell adapter: only booth endpoints are enabled. Replacing a preview
/// cancels the prior listener and sessions without enabling HTTP administration.
pub struct NativePreview {
    pub url: String,
    cancelled: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}
impl Drop for NativePreview {
    fn drop(&mut self) {
        self.cancelled.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
pub fn native_preview(workspace: Workspace, app: Uuid) -> Result<NativePreview> {
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let cancelled = Arc::new(AtomicBool::new(false));
    let stopping = cancelled.clone();
    let thread = std::thread::spawn(move || {
        let result = (|| -> Result<()> {
            tokio::runtime::Runtime::new()?.block_on(async {
                let listeners = listen(0).await?;
                let server = Server::booth_only(
                    workspace,
                    listeners[0].local_addr()?.port(),
                    stopping.clone(),
                );
                let url = server.preview(app)?;
                if send.send(Ok(url)).is_err() {
                    return Ok(());
                }
                serve_listeners(listeners, server, stopping).await
            })
        })();
        if let Err(error) = result {
            let _ = send.send(Err(error));
        }
    });
    match receive
        .recv()
        .context("preview server failed")
        .and_then(|r| r)
    {
        Ok(url) => Ok(NativePreview {
            url,
            cancelled,
            thread: Some(thread),
        }),
        Err(error) => {
            cancelled.store(true, Ordering::Release);
            let _ = thread.join();
            Err(error)
        }
    }
}

pub async fn listen(port: u16) -> Result<Vec<TcpListener>> {
    for _ in 0..if port == 0 { 20 } else { 1 } {
        let v4 = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
        let selected = v4.local_addr()?.port();
        match TcpListener::bind((std::net::Ipv6Addr::LOCALHOST, selected)).await {
            Ok(v6) => return Ok(vec![v4, v6]),
            Err(e)
                if matches!(
                    e.kind(),
                    ErrorKind::AddrNotAvailable | ErrorKind::Unsupported
                ) =>
            {
                return Ok(vec![v4]);
            }
            Err(e) if e.kind() == ErrorKind::AddrInUse && port == 0 => continue,
            Err(e) => {
                return Err(e)
                    .context("IPv6 loopback port is occupied; Studio will not share a port");
            }
        }
    }
    bail!("could not reserve a port on both loopback addresses")
}
pub async fn serve(workspace: Workspace, port: u16, cancelled: Arc<AtomicBool>) -> Result<()> {
    let listeners = listen(port).await?;
    let server = Server::new(
        workspace,
        listeners[0].local_addr()?.port(),
        cancelled.clone(),
    );
    println!("studio: open {}", server.link());
    println!("studio: link works once and expires in five minutes; Ctrl-C stops the server");
    serve_listeners(listeners, server, cancelled).await
}
async fn serve_listeners(
    listeners: Vec<TcpListener>,
    server: Arc<Server>,
    cancelled: Arc<AtomicBool>,
) -> Result<()> {
    let mut tasks = tokio::task::JoinSet::new();
    for listener in listeners {
        let router = server.router();
        let cancelled = cancelled.clone();
        let active = server.clone();
        tasks.spawn(async move {
            axum::serve(listener, router)
                .with_graceful_shutdown(async move {
                    while !cancelled.load(Ordering::Acquire) {
                        tokio::time::sleep(Duration::from_millis(25)).await;
                    }
                    active.revoke_preview();
                })
                .await
        });
    }
    let mut stopping_at = None;
    while !tasks.is_empty() {
        if cancelled.load(Ordering::Acquire) {
            server.revoke_preview();
            let started = stopping_at.get_or_insert_with(Instant::now);
            // Do not let an unfinished HTTP body or idle connection hold the
            // native host open after its preview is revoked.
            if started.elapsed() >= Duration::from_secs(2) {
                tasks.shutdown().await;
                break;
            }
        }
        if let Some(result) = tasks.try_join_next() {
            if let Err(error) = result
                .context("server task failed")
                .and_then(|r| r.context("GUI server failed"))
            {
                cancelled.store(true, Ordering::Release);
                server.revoke_preview();
                tasks.shutdown().await;
                return Err(error);
            }
        } else {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }
    Ok(())
}
