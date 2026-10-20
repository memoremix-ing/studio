#!/usr/bin/env python3
"""Exercise WKWebView in a disposable copy of the dev bundle and workspace.

Run from any directory after `hutch electrobun build --env=dev` in desktop/.
Requires a graphical macOS session and the installed sandboxed worker runtime.
The original bundle and any running Studio instance are left alone.
"""
import json
import os
from pathlib import Path
import platform
import plistlib
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
DESKTOP = ROOT / "desktop"


def run(*args, **kwargs):
    return subprocess.run(args, check=True, cwd=ROOT, **kwargs)


def probe(bundle, workspace, app, persist, delete=False):
    env = {**os.environ, "STUDIO_WORKSPACE": str(workspace),
           "STUDIO_PREVIEW_SMOKE_APP": app}
    env.pop("STUDIO_PREVIEW_SMOKE_PERSIST", None)
    env.pop("STUDIO_PREVIEW_SMOKE_DELETE", None)
    if delete:
        env["STUDIO_PREVIEW_SMOKE_DELETE"] = "1"
    if persist:
        env["STUDIO_PREVIEW_SMOKE_PERSIST"] = "1"
    log = bundle.parent / "probe.log"
    with log.open("w") as output:
        process = subprocess.Popen([bundle / "Contents/MacOS/main"], env=env,
                                   stdout=output, stderr=output)
        try:
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline:
                text = log.read_text()
                if "studio-smoke: passed" in text or "studio-smoke: failed" in text:
                    break
                if process.poll() is not None:
                    break
                time.sleep(0.2)
        finally:
            process.terminate()
            try:
                process.wait(timeout=6)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
    text = log.read_text()
    diagnostics = "\n".join(line for line in text.splitlines() if line.startswith("studio"))
    assert process.returncode == 0, diagnostics
    assert "studio-smoke: failed" not in text, diagnostics
    assert "studio-smoke: passed" in text, diagnostics
    if delete:
        assert "studio-smoke: cancel preserved preview" in text, diagnostics
    else:
        assert "studio-smoke: blocked external" in text, diagnostics
        assert "studio-smoke: blocked shell" in text, diagnostics
    assert "#token=" not in text, "Native SDK logged a bootstrap token"


def main():
    assert platform.system() == "Darwin", "This probe exercises macOS WKWebView"
    arch = "arm64" if platform.machine() == "arm64" else "x64"
    triple = "aarch64-apple-darwin" if arch == "arm64" else "x86_64-apple-darwin"
    build = DESKTOP / f"build/dev-macos-{arch}"
    apps = list(build.glob("*.app"))
    assert len(apps) == 1, "Build the Electrobun dev app first"
    with (apps[0] / "Contents/Info.plist").open("rb") as file:
        ats = plistlib.load(file)["NSAppTransportSecurity"]
    assert not ats.get("NSAllowsArbitraryLoads")
    assert not ats.get("NSAllowsArbitraryLoadsInWebContent")
    assert ats["NSExceptionDomains"] == {"localhost": {
        "NSIncludesSubdomains": True, "NSExceptionAllowsInsecureHTTPLoads": True}}
    run("cargo", "build", "--locked")
    target = build / "rust-target"
    run("cargo", "build", "--locked", "--manifest-path", str(DESKTOP / "Cargo.toml"),
        "--features", "preview-smoke", "--target", triple,
        env={**os.environ, "CARGO_TARGET_DIR": str(target)})
    cli = ROOT / "target/debug/studio"
    with tempfile.TemporaryDirectory(prefix="studio-native-preview-") as directory:
        temporary = Path(directory)
        bundle = temporary / "Studio Preview Probe.app"
        shutil.copytree(apps[0], bundle, symlinks=True)
        # Replace the inode; modifying a cached signed Mach-O in place can fail.
        executable = bundle / "Contents/MacOS/main"
        replacement = executable.with_suffix(".next")
        shutil.copy2(target / triple / "debug/main", replacement)
        replacement.replace(executable)
        workspace = temporary / "workspace"

        def command(*args):
            return json.loads(run(str(cli), "--workspace", str(workspace), *args,
                                  capture_output=True, text=True).stdout)

        command("init")
        app = command("new", "Native preview fixture", "--template", "solid-todomvc")["id"]
        keeper = command("new", "Native preview keeper")["id"]
        keeper_revision = command("review", keeper)["revision"]
        probe(bundle, workspace, app, persist=False)
        data = command("object", app, "TODOS", "default")
        assert len(data["todos"]) == 1
        assert data["todos"][0]["title"] == "Native preview regression"
        assert data["todos"][0]["completed"] is True
        print("Native preview: render, add, complete, filters, navigation denial and Turso commit passed", flush=True)
        probe(bundle, workspace, app, persist=True)
        print("Native preview: persistence after reopening and clean shutdown passed", flush=True)
        probe(bundle, workspace, app, persist=True, delete=True)
        assert not (workspace / "performers" / app).exists()
        assert not (workspace / ".studio/objects" / app).exists()
        assert [item["app"]["id"] for item in command("list")] == [keeper]
        assert command("review", keeper)["revision"] == keeper_revision
        print("Native deletion: confirmation, cancel, source/data removal, preview closure and sibling preservation passed", flush=True)


if __name__ == "__main__":
    main()
