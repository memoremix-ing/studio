use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use std::sync::{Arc, atomic::AtomicBool};
use studio::{Workspace, server::Server};
use tower::ServiceExt;

fn server() -> (tempfile::TempDir, Workspace, Arc<Server>, Router) {
    let dir = tempfile::tempdir().unwrap();
    let workspace = Workspace::init(dir.path()).unwrap();
    let server = Server::new(workspace.clone(), 4747, Arc::new(AtomicBool::new(false)));
    let router = server.router();
    (dir, workspace, server, router)
}
async fn call(
    router: &Router,
    host: &str,
    path: &str,
    session: Option<&str>,
    body: Option<Value>,
) -> axum::response::Response {
    let mut req = Request::builder().uri(path).header("host", host);
    if let Some(session) = session {
        req = req.header("x-studio-session", session);
    }
    let body = if let Some(body) = body {
        req = req
            .method("POST")
            .header("origin", format!("http://{host}"))
            .header("sec-fetch-site", "same-origin")
            .header("content-type", "application/json");
        body.to_string()
    } else {
        String::new()
    };
    router
        .clone()
        .oneshot(req.body(Body::from(body)).unwrap())
        .await
        .unwrap()
}
async fn value(response: axum::response::Response) -> Value {
    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_slice(
        &to_bytes(response.into_body(), 4 * 1024 * 1024)
            .await
            .unwrap(),
    )
    .unwrap()
}
async fn session(server: &Server, router: &Router) -> String {
    let token = server.link().split_once("#token=").unwrap().1.to_owned();
    value(
        call(
            router,
            server.host(),
            "/api/session",
            None,
            Some(json!({"token":token})),
        )
        .await,
    )
    .await["session"]
        .as_str()
        .unwrap()
        .to_owned()
}
#[tokio::test]
async fn shell_bootstrap_requires_exact_authority_origin_and_a_single_use_link() {
    let (_dir, _w, s, r) = server();
    for host in [
        "localhost:4747",
        "evil.example:4747",
        "studio-old.localhost:4747",
        "127.0.0.1:4747",
    ] {
        let res = call(&r, host, "/", None, None).await;
        assert_eq!(res.status(), StatusCode::MISDIRECTED_REQUEST);
        assert!(
            !String::from_utf8(to_bytes(res.into_body(), 4096).await.unwrap().to_vec())
                .unwrap()
                .contains("token=")
        );
    }
    assert_eq!(
        call(
            &r,
            s.host(),
            "/api/action",
            None,
            Some(json!({"kind":"catalog"}))
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    let token = s.link().split_once("#token=").unwrap().1.to_owned();
    let bad = Request::post("/api/session")
        .header("host", s.host())
        .header("origin", "http://evil.example")
        .header("content-type", "application/json")
        .body(Body::from(json!({"token":token}).to_string()))
        .unwrap();
    assert_eq!(
        r.clone().oneshot(bad).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );
    let res = call(
        &r,
        s.host(),
        "/api/session",
        None,
        Some(json!({"token":token})),
    )
    .await;
    assert_eq!(res.headers()["x-frame-options"], "DENY");
    assert_eq!(res.headers()["cache-control"], "no-store");
    assert!(res.headers().get("set-cookie").is_none());
    let auth = value(res).await["session"].as_str().unwrap().to_owned();
    assert_eq!(
        call(
            &r,
            s.host(),
            "/api/session",
            None,
            Some(json!({"token":token}))
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(
            &r,
            s.host(),
            "/api/action",
            Some(&auth),
            Some(json!({"kind":"catalog"}))
        )
        .await
        .status(),
        StatusCode::OK
    );
    // An absent Origin and fetch metadata are not enough to authorize a client.
    let req = Request::post("/api/action")
        .header("host", s.host())
        .header("x-studio-session", &auth)
        .header("content-type", "application/json")
        .body(Body::from("{\"kind\":\"catalog\"}"))
        .unwrap();
    assert_eq!(
        r.clone().oneshot(req).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );
    let req = Request::post("/api/action")
        .header("host", s.host())
        .header("origin", format!("http://{}", s.host()))
        .header("sec-fetch-site", "same-site")
        .header("x-studio-session", &auth)
        .header("content-type", "application/json")
        .body(Body::from("{\"kind\":\"catalog\"}"))
        .unwrap();
    assert_eq!(
        r.clone().oneshot(req).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );
    let req = Request::get("/")
        .header("host", s.host())
        .header("host", s.host())
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        r.clone().oneshot(req).await.unwrap().status(),
        StatusCode::MISDIRECTED_REQUEST
    );
}
#[tokio::test]
async fn booth_sessions_are_confined_to_their_app_and_replacement_revokes_them() {
    let (_dir, w, s, r) = server();
    let app = w.create_from_template("Todos", "solid-todomvc").unwrap();
    let auth = session(&s, &r).await;
    let url = value(
        call(
            &r,
            s.host(),
            "/api/action",
            Some(&auth),
            Some(json!({"kind":"preview","app":app.id})),
        )
        .await,
    )
    .await["url"]
        .as_str()
        .unwrap()
        .to_owned();
    let (host, token) = url
        .strip_prefix("http://")
        .unwrap()
        .split_once("/#token=")
        .unwrap();
    assert_eq!(
        call(
            &r,
            host,
            "/api/action",
            Some(&auth),
            Some(json!({"kind":"catalog"}))
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&r, host, "/api/booth/page", Some(&auth), None)
            .await
            .status(),
        StatusCode::UNAUTHORIZED
    );
    let booth = value(
        call(
            &r,
            host,
            "/api/booth/session",
            None,
            Some(json!({"token":token})),
        )
        .await,
    )
    .await["session"]
        .as_str()
        .unwrap()
        .to_owned();
    assert_eq!(
        call(
            &r,
            s.host(),
            "/api/action",
            Some(&booth),
            Some(json!({"kind":"catalog"}))
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    let page = value(call(&r, host, "/api/booth/page", Some(&booth), None).await).await;
    assert!(
        page["html"]
            .as_str()
            .unwrap()
            .contains("<script type=\"module\">")
    );
    // Caller cannot add an app id to select another booth's Worker.
    assert_eq!(
        call(
            &r,
            host,
            "/api/booth/request",
            Some(&booth),
            Some(json!({"path":"/api/todos","app":app.id}))
        )
        .await
        .status(),
        StatusCode::UNPROCESSABLE_ENTITY
    );
    s.preview(app.id).unwrap();
    assert_eq!(
        call(&r, host, "/api/booth/page", Some(&booth), None)
            .await
            .status(),
        StatusCode::MISDIRECTED_REQUEST
    );
}
#[tokio::test]
async fn deletion_requires_shell_authority_and_revokes_the_booth() {
    let (_dir, w, s, r) = server();
    let app = w.create_from_template("Delete", "solid-todomvc").unwrap();
    let keep = w.create("Keep").unwrap();
    let auth = session(&s, &r).await;
    let url = s.preview(app.id).unwrap();
    let (host, token) = url
        .strip_prefix("http://")
        .unwrap()
        .split_once("/#token=")
        .unwrap();
    let booth = value(
        call(
            &r,
            host,
            "/api/booth/session",
            None,
            Some(json!({"token":token})),
        )
        .await,
    )
    .await["session"]
        .as_str()
        .unwrap()
        .to_owned();
    for credential in [None, Some(booth.as_str())] {
        assert_eq!(
            call(
                &r,
                s.host(),
                "/api/action",
                credential,
                Some(json!({"kind":"delete","app":keep.id}))
            )
            .await
            .status(),
            StatusCode::UNAUTHORIZED
        );
    }
    assert_eq!(
        call(
            &r,
            host,
            "/api/action",
            Some(&booth),
            Some(json!({"kind":"delete","app":app.id}))
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(w.list().unwrap().len(), 2);
    let catalog = value(
        call(
            &r,
            s.host(),
            "/api/action",
            Some(&auth),
            Some(json!({"kind":"delete","app":app.id})),
        )
        .await,
    )
    .await;
    assert_eq!(catalog["apps"].as_array().unwrap().len(), 1);
    assert_eq!(catalog["apps"][0]["app"]["id"], keep.id.to_string());
    assert_eq!(
        call(&r, host, "/api/booth/page", Some(&booth), None)
            .await
            .status(),
        StatusCode::MISDIRECTED_REQUEST
    );
    assert!(s.preview(app.id).is_err());
    assert!(w.snapshot(keep.id).is_ok());
}

#[tokio::test]
async fn native_preview_host_has_no_administrative_surface() {
    let (_dir, w, _, _) = server();
    let s = Server::booth_only(w, 4747, Arc::new(AtomicBool::new(false)));
    assert_eq!(
        call(&s.router(), s.host(), "/", None, None).await.status(),
        StatusCode::MISDIRECTED_REQUEST
    );
}
#[tokio::test]
async fn loopback_listeners_hold_both_families_and_fail_on_an_ipv6_conflict() {
    let listeners = studio::server::listen(0).await.unwrap();
    let port = listeners[0].local_addr().unwrap().port();
    assert!(
        tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .is_err()
    );
    if listeners.len() == 2 {
        assert_eq!(listeners[1].local_addr().unwrap().port(), port);
        assert!(
            tokio::net::TcpListener::bind((std::net::Ipv6Addr::LOCALHOST, port))
                .await
                .is_err()
        );
        let other = tokio::net::TcpListener::bind("[::1]:0").await.unwrap();
        let port = other.local_addr().unwrap().port();
        assert!(studio::server::listen(port).await.is_err());
        assert!(
            tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port))
                .await
                .is_ok()
        );
    }
}

#[test]
fn native_preview_shutdown_is_bounded_even_with_an_unfinished_http_body() {
    use std::io::Write;
    use std::time::{Duration, Instant};
    let dir = tempfile::tempdir().unwrap();
    let w = Workspace::init(dir.path()).unwrap();
    let app = w.create_from_template("Preview", "solid-todomvc").unwrap();
    let preview = studio::server::native_preview(w, app.id).unwrap();
    let authority = preview
        .url
        .strip_prefix("http://")
        .unwrap()
        .split('/')
        .next()
        .unwrap();
    let port: u16 = authority.rsplit_once(':').unwrap().1.parse().unwrap();
    let mut connection =
        std::net::TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port)).unwrap();
    write!(connection,"POST /api/booth/session HTTP/1.1\r\nHost: {authority}\r\nOrigin: http://{authority}\r\nSec-Fetch-Site: same-origin\r\nContent-Type: application/json\r\nContent-Length: 4000\r\n\r\n{{").unwrap();
    connection.flush().unwrap();
    std::thread::sleep(Duration::from_millis(100));
    let started = Instant::now();
    drop(preview);
    assert!(started.elapsed() < Duration::from_secs(3));
    assert!(std::net::TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port)).is_err());
}
