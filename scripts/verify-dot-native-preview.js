// Actual browser print UI inspection, not just emulated print media / PDF output.
// Use a disposable browser profile and close only the browser spawned here.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createServer } = require("node:net");
const channel = process.argv[2] || "chrome";
const executable = channel === "edge" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" :
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = path.resolve(__dirname, "../output/playwright");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function connect(url) {
  const socket = new WebSocket(url);
  let next = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    const callback = pending.get(data.id);
    if (!callback) return;
    pending.delete(data.id); clearTimeout(callback.timer);
    if (data.error) callback.reject(new Error(JSON.stringify(data.error)));
    else callback.resolve(data.result);
  };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connection timed out")), 5000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = () => { clearTimeout(timer); reject(new Error("CDP connection failed")); };
  });
  return { close: () => socket.close(), send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 5000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
  } };
}
async function until(fn, label) {
  const deadline = Date.now() + 15000;
  let error;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (failure) { error = failure; }
    await sleep(150);
  }
  throw new Error(`Timed out: ${label}${error ? ` (${error.message})` : ""}`);
}
async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

(async () => {
  const debugPort = await port();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dot-copy-native-"));
  const browser = spawn(executable, [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-search-engine-choice-screen", "--window-size=1280,1000",
    "http://127.0.0.1:4190/apps/dot-copy-print/"], { stdio: "ignore" });
  const clients = [];
  try {
    const targets = async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(3000) });
      return response.json();
    };
    const target = await until(async () => (await targets()).find(item => item.url.includes("4190/apps/dot-copy-print")), "app target");
    const client = await connect(target.webSocketDebuggerUrl); clients.push(client);
    await until(() => evaluate(client, "document.querySelectorAll('.dot-problem').length === 4 && !document.querySelector('#printBtn').disabled"), "generated problems");
    await evaluate(client, "for (const [key,value] of Object.entries({rows:3,columns:3,lineCount:2})) document.getElementById(key).value = String(value); document.querySelector('#lineCount').dispatchEvent(new Event('input',{bubbles:true})); true");
    await until(() => evaluate(client, "!document.querySelector('#printBtn').disabled && JSON.parse(localStorage.getItem('dot-copy-print-state-v1')).applied.rows === 3"), "reported print conditions");
    await evaluate(client, "document.querySelector('#printPunchGuide').value = 'left'; document.querySelector('#printPunchGuide').dispatchEvent(new Event('change')); document.querySelector('#hintStart').checked = true; document.querySelector('#hintStart').dispatchEvent(new Event('change')); true");
    await evaluate(client, "setTimeout(() => document.querySelector('#printBtn').click(), 50); true");
    const printTarget = await until(async () => (await targets()).find(item => /^(chrome|edge):\/\/print/.test(item.url)), "native print preview target");
    const preview = await connect(printTarget.webSocketDebuggerUrl); clients.push(preview);
    const details = await until(() => evaluate(preview, `(() => {
      const app = document.querySelector('print-preview-app');
      if (!app || !app.shadowRoot) {
        const shell = document.querySelector('app-shell');
        if (!shell?.shadowRoot) return false;
        const flatten = root => [...root.querySelectorAll('*')].flatMap(node => [node, ...(node.shadowRoot ? flatten(node.shadowRoot) : [])]);
        const nodes = flatten(document);
        const text = nodes.filter(n => n.children.length === 0 && !['STYLE','SCRIPT'].includes(n.tagName)).map(n => n.textContent?.trim()).filter(Boolean).join(' ');
        const plugin = nodes.find(n => n.id === 'plugin-container');
        if (!text.includes('A4') || !plugin?.childElementCount || plugin.classList.contains('hidden')) return false;
        return { url: location.href, text, controls: nodes.filter(n => ['SELECT','INPUT','BUTTON'].includes(n.tagName)).map(n => ({tag:n.tagName,id:n.id,value:n.value,text:n.textContent?.trim().slice(0,200)})),
          previewNodes: nodes.filter(n => ['EMBED','IFRAME','CANVAS','IMG','OBJECT'].includes(n.tagName) || /spinner|loading|preview/i.test(n.className || '')).map(n => ({tag:n.tagName,cls:n.className,display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility,html:n.outerHTML.slice(0,500)})) };
      }
      const pane = app.shadowRoot.querySelector('print-preview-preview-area');
      const loading = pane?.previewState;
      if (loading === 'loading' || loading === undefined) return false;
      const flatten = root => [...root.querySelectorAll('*')].flatMap(node => [node, ...(node.shadowRoot ? flatten(node.shadowRoot) : [])]);
      const nodes = flatten(document);
      return { url: location.href, title: document.title, text: nodes.filter(n => n.children.length === 0 && !['STYLE','SCRIPT'].includes(n.tagName)).map(n => n.textContent?.trim()).filter(Boolean).join(' ').slice(0, 7000),
        previewState: loading, controls: nodes.filter(n => ['SELECT','INPUT','BUTTON'].includes(n.tagName)).map(n => ({tag: n.tagName, id:n.id, value:n.value, text:n.textContent?.trim().slice(0,200)})),
        settings: app.settings, pageCount: pane?.pageCount, state: app.state, documentInfo: app.documentInfo,
        ready: loading === 'display-preview' };
    })()`), "ready native preview");
    // Edge's PDF iframe is created before its compositor displays the first page.
    // Allow its short built-in fade and initial PDF paint to complete.
    if (channel === "edge") await sleep(1800);
    const nativeA4 = details.controls.some(control => /ISO_A4/.test(control.value || "") || control.text === "A4");
    if (!nativeA4 || !/1\s*枚/.test(details.text)) throw new Error("Native preview does not show one A4 sheet");
    fs.mkdirSync(output, { recursive: true });
    const screenshot = await preview.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(output, `dot-copy-${channel}-native-preview.png`), Buffer.from(screenshot.data, "base64"));
    fs.writeFileSync(path.join(output, `dot-copy-${channel}-native-preview.json`), JSON.stringify(details, null, 2));
    console.log(JSON.stringify({ channel, nativeA4, pages: 1, ready: details.ready ?? true }));
  } finally {
    for (const client of clients) client.close();
    browser.kill();
    await Promise.race([new Promise(resolve => browser.once("exit", resolve)), sleep(1500)]);
    // This is the synthetic profile created above, never a user's browser data.
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("dot-copy-native-")) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
      catch { console.warn(`Temporary profile remains: ${profile}`); }
    }
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
