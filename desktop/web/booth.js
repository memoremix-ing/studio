// This script runs only on a fresh, unprivileged booth origin. It never receives
// the administrative shell session. The Rust host binds all requests to one performer.
(async () => {
  try {
    const token = new URLSearchParams(location.hash.slice(1)).get("token");
    history.replaceState(null,"",location.pathname);
    if (!token) throw new Error("Reopen this preview from Studio.");
    const redeemed = await fetch("/api/booth/session", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
    if (!redeemed.ok) throw new Error("This preview link has expired. Reopen it from Studio.");
    const {session} = await redeemed.json();
    const page = await fetch("/api/booth/page", {headers:{"X-Studio-Session":session}});
    if (!page.ok) throw new Error("Preview ended. Reopen it from Studio.");
    const {html} = await page.json();
    const bridge = `<script>window.studio=Object.freeze({async request(request){const response=await fetch('/api/booth/request',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Session':${JSON.stringify(session)}},body:JSON.stringify(request)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Preview request failed');return result;}});<\/script>`;
    document.open();
    document.write(bridge + html);
    document.close();
  } catch (error) { document.body.textContent = error.message; }
})();
