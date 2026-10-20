const $ = (id) => document.getElementById(id);
let nextId = 0;
const waiting = new Map();
let catalog = { workspace: null, apps: [] };
let selected = null;
let review = null;
let busy = false;
let deleteTarget = null;

function receive(message) {
  const pending = waiting.get(message?.id);
  if (!pending) return;
  waiting.delete(message.id);
  clearTimeout(pending.timeout);
  message.ok ? pending.resolve(message.value) : pending.reject(new Error(message.error));
}

window.__electrobun = window.__electrobun || {};
window.__electrobun.receiveMessageFromHost = receive;
for (const message of window.__electrobunPendingHostMessages?.splice(0) || []) receive(message);

let browserSession = sessionStorage.getItem("studio-session");
const native = Boolean(window.__electrobunHostBridge);
async function browserSend(action) {
  const response = await fetch("/api/action", {method:"POST",headers:{"Content-Type":"application/json", "X-Studio-Session":browserSession || ""},body:JSON.stringify(action)});
  const result = await response.json();
  if (response.status === 401 || response.status === 503) { browserSession=null; sessionStorage.removeItem("studio-session"); closePreview().catch(() => {}); }
  if (!response.ok) throw new Error(result.error || "Studio could not complete the request.");
  return result;
}
let previewActive = false;
async function closePreview() {
  const revoke = previewActive; previewActive=false;
  $("app-preview").removeAttribute("src"); $("app-preview").hidden=true; $("close-preview").hidden=true;
  if (revoke) await send({kind:"close_preview"});
}
function send(action) {
  if (!native) return browserSend(action);
  if (!window.__electrobunHostBridge) return Promise.reject(new Error("Open Studio as a desktop app to use this workspace."));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { waiting.delete(id); reject(new Error("Studio did not respond. Try reopening the workspace.")); }, 20000);
    waiting.set(id, { resolve, reject, timeout });
    window.__electrobunHostBridge.postMessage(JSON.stringify({ id, action }));
  });
}

async function act(operation) {
  if (busy) return;
  busy = true;
  $("message").textContent = "";
  updateButtons();
  try { await operation(); }
  catch (error) { $("message").textContent = error.message; }
  finally { busy = false; updateButtons(); }
}

function dirty() {
  const file = review?.files.find((file) => file.path === $("module").value);
  return Boolean(file && file.text !== null && $("source").value !== file.text);
}

function updateButtons() {
  for (const id of ["workspace", "welcome-create"]) $(id).disabled = busy || (!native && id === "workspace");
  for (const id of ["create", "import"]) $(id).disabled = busy || !catalog.workspace;
  for (const id of ["save", "run", "promote", "demote", "module", "preview", "delete-app"]) $(id).disabled = busy || !review;
  $("preview").hidden = !review?.manifest.page;
  $("preview").disabled = busy || !review || dirty();
  $("save").disabled = busy || !dirty();
  $("run").disabled = busy || !review || dirty();
  $("promote").disabled = busy || !review || dirty();
  $("module").disabled = busy || !review || dirty();
  $("source").readOnly = busy || !review || $("module").value === "studio.json" || review.files.find((file) => file.path === $("module").value)?.text === null;
  $("edit-status").textContent = dirty() ? "Unsaved changes" : "Saved";
}

function realmLabel(item) {
  if (item.app.origin === "personal") return "Your performer";
  return item.realm.kind === "trusted" ? "Reviewed sample" : "Shared sample · solitary";
}

function renderCatalog(value) {
  catalog = value;
  $("workspace").replaceChildren(document.createTextNode(value.workspace ? value.workspace.split(/[\\/]/).filter(Boolean).at(-1) : "Choose a folder"));
  $("workspace").title = value.workspace || "Choose or initialize a workspace";
  $("count").textContent = String(value.apps.length);
  const buttons = value.apps.map((item) => {
    const button = document.createElement("button");
    button.className = `app-item${item.app.id === selected ? " active" : ""}`;
    const name = document.createElement("strong");
    name.textContent = item.manifest.name;
    const realm = document.createElement("small");
    realm.textContent = realmLabel(item);
    button.append(name, realm);
    button.addEventListener("click", () => act(async () => {
      if (dirty() && !window.confirm("Discard unsaved changes?")) return;
      await select(item.app.id);
    }));
    return button;
  });
  $("apps").replaceChildren(...buttons);
  if (!value.apps.some((item) => item.app.id === selected)) { selected = null; review = null; }
  $("welcome").hidden = Boolean(selected);
  $("booth").hidden = !selected;
}

async function select(id) {
  await closePreview();
  selected = id;
  showReview(await send({ kind: "review", app: id }));
  renderCatalog(catalog);
  $("output").textContent = "Your performer's response will appear here.";
}

function showReview(value) {
  review = value;
  $("app-name").textContent = value.manifest.name;
  const trusted = value.realm.kind === "trusted";
  $("realm").textContent = trusted ? "TRUSTED REALM" : "SOLITARY REALM";
  $("realm").className = `badge${trusted ? "" : " solitary"}`;
  $("trust-note").textContent = trusted ? "This performer shares a runtime with your trusted performers." : "This sample runs in its own space, separate from your trusted performers.";
  $("promote").hidden = trusted || value.app.origin !== "imported";
  $("demote").hidden = !trusted || value.app.origin !== "imported";
  $("review-note").textContent = value.app.origin === "personal" ? "A little change can make it yours." : trusted ? "Editing this sample returns it to the solitary realm." : "Review every module before trusting this revision.";
  $("revision").textContent = `REVISION ${value.revision.slice(0, 12)}`;
  $("revision").title = value.revision;
  const previous = $("module").value;
  $("module").replaceChildren(...value.files.map((file) => {
    const option = document.createElement("option");
    option.value = file.path;
    option.textContent = file.path;
    return option;
  }));
  $("module").value = value.files.some((file) => file.path === previous) ? previous : value.manifest.entrypoint;
  showModule();
}

function showModule() {
  const file = review.files.find((file) => file.path === $("module").value);
  $("source").value = file?.text ?? "Binary module. Review this file outside the text editor.";
  updateButtons();
}

function newApp() {
  if (dirty() && !window.confirm("Discard unsaved changes?")) return;
  if (!catalog.workspace) {
    return act(async () => { renderCatalog(await send({ kind: "choose_workspace" })); });
  }
  $("new-name").value = "";
  $("new-dialog").returnValue = "";
  $("new-dialog").showModal();
  $("new-name").focus();
}

$("workspace").addEventListener("click", () => act(async () => {
  if (dirty() && !window.confirm("Discard unsaved changes?")) return;
  const value = await send({ kind: "choose_workspace" });
  selected = null; review = null;
  renderCatalog(value);
}));
$("create").addEventListener("click", newApp);
$("welcome-create").addEventListener("click", newApp);
$("new-dialog").addEventListener("close", () => {
  if ($("new-dialog").returnValue !== "create") return;
  act(async () => {
    renderCatalog(await send({ kind: "create", name: $("new-name").value, template: $("new-template").value }));
    await select(catalog.apps.at(-1).app.id);
  });
});
$("import").addEventListener("click", () => act(async () => {
  if (dirty() && !window.confirm("Discard unsaved changes?")) return;
  if (!native) { $("import-files").click(); return; }
  renderCatalog(await send({ kind: "import" }));
  if (catalog.apps.length) await select(catalog.apps.at(-1).app.id);
}));
$("module").addEventListener("change", showModule);
$("source").addEventListener("input", updateButtons);
$("save").addEventListener("click", () => act(async () => {
  await closePreview();
  showReview(await send({ kind: "save", app: selected, module: $("module").value, text: $("source").value, revision: review.revision }));
  renderCatalog(await send({ kind: "catalog" }));
}));
$("run").addEventListener("click", () => act(async () => {
  $("output").textContent = "Running your performer…";
  const result = await send({ kind: "run", app: selected, path: $("request-path").value });
  $("output").textContent = [result.stdout, result.stderr, result.exit_code ? `Exit code: ${result.exit_code}` : ""].filter(Boolean).join("\n");
}));
$("promote").addEventListener("click", () => act(async () => {
  renderCatalog(await send({ kind: "promote", app: selected, revision: review.revision }));
  await select(selected);
}));
$("demote").addEventListener("click", () => act(async () => {
  renderCatalog(await send({ kind: "demote", app: selected }));
  await select(selected);
}));
$("preview").addEventListener("click", () => act(async () => {
  const value = await send({kind:"preview",app:selected});
  previewActive = true;
  if (!value.native) { $("app-preview").src = value.url; $("app-preview").hidden=false; }
  $("close-preview").hidden=false;
}));
$("close-preview").addEventListener("click",() => act(closePreview));
$("delete-app").addEventListener("click", () => {
  if (busy || !review) return;
  deleteTarget = selected;
  $("delete-name").textContent = review.manifest.name;
  $("delete-unsaved").hidden = !dirty();
  $("delete-dialog").returnValue = "";
  $("delete-dialog").showModal();
});
$("delete-dialog").addEventListener("close", () => {
  const app = deleteTarget;
  deleteTarget = null;
  if ($("delete-dialog").returnValue !== "delete" || !app) return;
  act(async () => {
    await closePreview();
    renderCatalog(await send({kind:"delete", app}));
    $("source").value = "";
    $("output").textContent = "Your performer's response will appear here.";
    $("message").textContent = "Performer deleted.";
  });
});
$("import-files").addEventListener("change", () => act(async () => {
  const picked=[...$("import-files").files];
  if (picked.length > 256 || picked.reduce((n,f)=>n+f.size,0)>8*1024*1024) throw new Error("Sample exceeds 256 files or 8 MiB.");
  const files=Object.create(null);
  for (const file of picked) {
    const path=file.webkitRelativePath.split("/").slice(1).join("/");
    if (file.name.endsWith(".wasm")) throw new Error("Import binary samples with the CLI or desktop folder chooser.");
    files[path]=await file.text();
  }
  if (!picked.length) return;
  renderCatalog(await send({kind:"import_bundle",files}));
  await select(catalog.apps.at(-1).app.id);
  $("import-files").value="";
}));
act(async () => {
  if (!native) {
    $("workspace").disabled=true;
    const token=new URLSearchParams(location.hash.slice(1)).get("token");
    history.replaceState(null,"",location.pathname);
    if (token) {
      const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
      const result=await response.json();
      if (!response.ok) throw new Error(result.error);
      browserSession=result.session; sessionStorage.setItem("studio-session",browserSession);
    }
  }
  renderCatalog(await send({kind:"catalog"}));
});
