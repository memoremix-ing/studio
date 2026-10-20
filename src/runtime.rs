//! One-request runtime adapter. Each invocation stages immutable bundles and
//! launches workerd through MXC. There is deliberately no unsandboxed fallback.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{Context, Result, bail, ensure};
use mxc_sdk::v1::{
    self, ContainerRequest, Containment, FilesystemPolicy, NetworkAction, NetworkEgressPolicy,
    NetworkIngressPolicy, NetworkPolicy, UiPolicy,
};
use serde::Serialize;
use uuid::Uuid;

use crate::{Realm, Snapshot, Workspace};

const OUTPUT_LIMIT: usize = 128 * 1024;
const DEADLINE: Duration = Duration::from_secs(10);

#[derive(Debug, Serialize)]
pub struct RunPlan {
    pub target: Uuid,
    pub realm: Realm,
    pub apps: Vec<Uuid>,
    pub network: &'static str,
    pub timeout_ms: u64,
    pub output_limit_bytes: usize,
}

#[derive(Debug, Serialize)]
pub struct RunResult {
    pub plan: RunPlan,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Workspace {
    pub fn plan(&self, id: Uuid) -> Result<RunPlan> {
        Ok(plan(&self.execution_group(id)?))
    }

    pub fn run(&self, id: Uuid, workerd: &Path, request_path: &str) -> Result<RunResult> {
        self.run_cancellable(id, workerd, request_path, &AtomicBool::new(false))
    }

    pub fn run_cancellable(
        &self,
        id: Uuid,
        workerd: &Path,
        request_path: &str,
        cancelled: &AtomicBool,
    ) -> Result<RunResult> {
        ensure!(!cancelled.load(Ordering::Acquire), "request cancelled");
        ensure!(
            request_path.starts_with('/')
                && !request_path.starts_with("//")
                && request_path.len() <= 4096
                && !request_path.chars().any(char::is_control),
            "request path must start with a single / and contain no control characters"
        );
        let group = self.execution_group(id)?;
        let plan = plan(&group);
        let binary = workerd
            .canonicalize()
            .context("workerd executable not found; set STUDIO_WORKERD to its absolute path")?;
        ensure!(
            binary.is_file(),
            "workerd must be a regular executable file"
        );
        // The runtime receives only a private staging directory, never the
        // workspace/catalog, credentials, or other solitary samples.
        let staging = tempfile::Builder::new().prefix("studio-run-").tempdir()?;
        for snapshot in &group {
            crate::workspace::write_bundle(
                &staging.path().join(snapshot.app.id.to_string()),
                &snapshot.files,
            )?;
        }
        let config = configuration(&group, request_path)?;
        fs::write(staging.path().join("run.capnp"), config)?;
        let scratch = tempfile::Builder::new()
            .prefix("studio-scratch-")
            .tempdir()?;
        let mut request = sandbox_request(&binary, staging.path(), scratch.path())?;
        request.timeout_ms = Some(DEADLINE.as_millis() as u32);
        let mut child = v1::spawn(request, Default::default())
            .context("MXC could not establish the required sandbox")?;
        drop(child.take_stdin());
        let overflow = Arc::new(AtomicBool::new(false));
        let stdout = capture(
            child.take_stdout().context("missing runtime stdout")?,
            Arc::clone(&overflow),
        );
        let stderr = capture(
            child.take_stderr().context("missing runtime stderr")?,
            Arc::clone(&overflow),
        );
        let started = Instant::now();
        let outcome = loop {
            if cancelled.load(Ordering::Acquire)
                || overflow.load(Ordering::Relaxed)
                || started.elapsed() >= DEADLINE
            {
                let _ = child.kill();
                break child.wait();
            }
            match child.try_wait() {
                Ok(Some(code)) => break Ok(v1::WaitResult::Exited(code)),
                Ok(None) => thread::sleep(Duration::from_millis(10)),
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    break Err(error);
                }
            }
        };
        // Drain normal exit output first, then stop reads if a descendant
        // retained a pipe. Never wait indefinitely for an untrusted writer.
        let drain = Instant::now();
        while (!stdout.is_finished() || !stderr.is_finished())
            && drain.elapsed() < Duration::from_millis(250)
        {
            thread::sleep(Duration::from_millis(5));
        }
        if let Some(closer) = child.stdout_closer() {
            closer.close();
        }
        if let Some(closer) = child.stderr_closer() {
            closer.close();
        }
        let stdout = stdout
            .join()
            .map_err(|_| anyhow::anyhow!("stdout reader failed"))??;
        let stderr = stderr
            .join()
            .map_err(|_| anyhow::anyhow!("stderr reader failed"))??;
        if overflow.load(Ordering::Relaxed) {
            bail!("runtime exceeded its output limit");
        }
        ensure!(!cancelled.load(Ordering::Acquire), "request cancelled");
        ensure!(
            started.elapsed() < DEADLINE,
            "runtime exceeded its 10-second deadline"
        );
        let exit_code = match outcome? {
            v1::WaitResult::Exited(code) => code,
            v1::WaitResult::TimedOut => bail!("runtime exceeded its deadline"),
        };
        Ok(RunResult {
            plan,
            exit_code,
            stdout: String::from_utf8_lossy(&stdout).into(),
            stderr: String::from_utf8_lossy(&stderr).into(),
        })
    }
}

fn capture(
    mut stream: Box<dyn Read + Send>,
    overflow: Arc<AtomicBool>,
) -> thread::JoinHandle<std::io::Result<Vec<u8>>> {
    thread::spawn(move || {
        let mut output = Vec::new();
        let mut buffer = [0; 8192];
        loop {
            let count = match stream.read(&mut buffer) {
                Ok(count) => count,
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(error) => return Err(error),
            };
            if count == 0 {
                return Ok(output);
            }
            if output.len() + count > OUTPUT_LIMIT {
                overflow.store(true, Ordering::Relaxed);
                // Keep draining until the supervisor terminates the process.
            } else {
                output.extend_from_slice(&buffer[..count]);
            }
        }
    })
}

fn plan(group: &[Snapshot]) -> RunPlan {
    RunPlan {
        target: group[0].app.id,
        realm: group[0].realm.clone(),
        apps: group.iter().map(|s| s.app.id).collect(),
        network: "denied",
        timeout_ms: DEADLINE.as_millis() as u64,
        output_limit_bytes: OUTPUT_LIMIT,
    }
}

fn sandbox_request(binary: &Path, staging: &Path, scratch: &Path) -> Result<ContainerRequest> {
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    bail!("this initial runtime adapter supports macOS and Linux only");
    let binary = path_text(binary)?;
    // MXC's Unix backends launch via a shell. All variable arguments are quoted;
    // no imported metadata or worker source is interpolated into this command.
    let mut request = ContainerRequest::new(format!(
        "ulimit -t 5; exec {} test run.capnp studio-request",
        shell_quote(&binary)
    ));
    #[cfg(target_os = "macos")]
    {
        let mut config = v1::configs::SeatbeltConfig::default();
        config.nested_pty = false;
        request.containment = Containment::Seatbelt(config);
    }
    #[cfg(target_os = "linux")]
    {
        request.containment = Containment::Bubblewrap;
    }
    request.filesystem = Some(FilesystemPolicy {
        readonly_paths: vec![binary, path_text(staging)?],
        readwrite_paths: vec![path_text(scratch)?],
        ..Default::default()
    });
    request.network = Some(NetworkPolicy {
        egress: Some(NetworkEgressPolicy {
            default: Some(NetworkAction::Deny),
            ..Default::default()
        }),
        ingress: Some(NetworkIngressPolicy {
            default: Some(NetworkAction::Deny),
            host_loopback: Some(NetworkAction::Deny),
        }),
        runtime_config: None,
    });
    request.ui = Some(UiPolicy::default());
    request.working_directory = Some(path_text(staging)?);
    request.environment = Some(vec![
        ("HOME".into(), path_text(scratch)?),
        ("TMPDIR".into(), path_text(scratch)?),
        ("PATH".into(), "/usr/bin:/bin".into()),
    ]);
    request.inherit_default_environment = Some(false);
    Ok(request)
}

fn path_text(path: &Path) -> Result<String> {
    Ok(path
        .to_str()
        .context("runtime paths must be UTF-8")?
        .to_owned())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn configuration(group: &[Snapshot], request_path: &str) -> Result<String> {
    let mut config = String::from(
        "using W = import \"/workerd/workerd.capnp\";\nconst config :W.Config = (services = [\n",
    );
    for app in group {
        let mut modules = vec![module(app, &app.manifest.entrypoint)?];
        for name in app
            .files
            .keys()
            .filter(|name| **name != app.manifest.entrypoint && *name != "studio.json")
        {
            modules.push(module(app, name)?);
        }
        config.push_str(&format!("(name = {}, worker = (modules = [{}], compatibilityDate = {}, globalOutbound = \"blocked\")),\n", quote(&app.app.id.to_string()), modules.join(","), quote(&app.manifest.compatibility_date)));
    }
    // No sockets and no inspector. The host controls the only service binding.
    let runner = format!(
        r#"export default {{ async test(_controller, env) {{
      const response = await env.APP.fetch(new Request({}));
      const reader = response.body?.getReader();
      const chunks = []; let size = 0;
      if (reader) for (;;) {{
        const {{ value, done }} = await reader.read(); if (done) break;
        size += value.length; if (size > 65536) throw new Error("Response exceeds 64 KiB");
        chunks.push(value);
      }}
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) {{ bytes.set(chunk, offset); offset += chunk.length; }}
      console.log(JSON.stringify({{status: response.status, body: new TextDecoder().decode(bytes)}}));
    }} }};"#,
        quote(&format!("https://booth.invalid{request_path}"))
    );
    config.push_str(&format!("(name = \"studio-request\", worker = (modules = [(name = \"runner.js\", esModule = {})], compatibilityDate = \"2026-10-19\", globalOutbound = \"blocked\", bindings = [(name = \"APP\", service = {})])),\n", quote(&runner), quote(&group[0].app.id.to_string())));
    config.push_str("(name = \"blocked\", worker = (modules = [(name = \"blocked.js\", esModule = \"export default { fetch() { throw new Error('Network access is disabled'); } };\")], compatibilityDate = \"2026-10-19\", globalOutbound = \"internet\")),\n(name = \"internet\", network = (allow = []))\n]);\n");
    Ok(config)
}

fn module(app: &Snapshot, name: &str) -> Result<String> {
    let kind = match Path::new(name).extension().and_then(|x| x.to_str()) {
        Some("js" | "mjs") => "esModule",
        Some("json") => "json",
        Some("txt") => "text",
        Some("wasm") => "wasm",
        _ => bail!("unsupported module: {name}"),
    };
    let path = format!("{}/{name}", app.app.id);
    Ok(format!(
        "(name = {}, {kind} = embed {})",
        quote(name),
        quote(&path)
    ))
}

fn quote(value: &str) -> String {
    serde_json::to_string(value).expect("strings serialize")
}

/// Resolve only an explicitly configured runtime or Studio's pinned local tool.
pub fn workerd_path(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        return Ok(path);
    }
    let platform = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "darwin-arm64",
        ("macos", "x86_64") => "darwin-64",
        ("linux", "x86_64") => "linux-64",
        ("linux", "aarch64") => "linux-arm64",
        _ => bail!("unsupported runtime platform"),
    };
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
        "tools/runtime/node_modules/@cloudflare/workerd-{platform}/bin/workerd"
    ));
    ensure!(
        path.is_file(),
        "install the development runtime with `bun install --cwd tools/runtime`, or set STUDIO_WORKERD"
    );
    Ok(path)
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    #[ignore = "launches a real MXC Seatbelt process"]
    fn kernel_policy_denies_host_files_and_loopback_even_outside_workerd() {
        let staging = tempfile::tempdir().unwrap();
        let scratch = tempfile::tempdir().unwrap();
        let private = tempfile::NamedTempFile::new().unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let program = format!(
            r#"import socket
try:
    open({:?}).read()
    print('FILE_ESCAPE')
except PermissionError:
    print('FILE_DENIED')
s = socket.socket()
s.settimeout(1)
try:
    s.connect(('127.0.0.1', {}))
    print('NETWORK_ESCAPE')
except PermissionError:
    print('NETWORK_DENIED')
"#,
            private.path().to_str().unwrap(),
            listener.local_addr().unwrap().port()
        );
        let mut request = sandbox_request(
            Path::new("/usr/bin/python3"),
            staging.path(),
            scratch.path(),
        )
        .unwrap();
        request.command = format!("/usr/bin/python3 -c {}", shell_quote(&program));
        request.timeout_ms = Some(5000);
        let result = v1::run(request, Default::default()).unwrap();
        let stdout = String::from_utf8(result.stdout).unwrap();
        assert_eq!(
            result.outcome,
            v1::WaitResult::Exited(0),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert!(stdout.contains("FILE_DENIED"), "{stdout}");
        assert!(stdout.contains("NETWORK_DENIED"), "{stdout}");
        assert!(!stdout.contains("ESCAPE"));
    }
}
