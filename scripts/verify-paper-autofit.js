const { createServer } = require("node:http");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createServer: createNetServer } = require("node:net");

// This runner deliberately uses one fixed screen viewport (Chrome's default)
// and never changes it per paper. The requested paper is supplied only to
// Page.printToPDF, while the app's own print-adjustments code owns orientation,
// logical pages, answers, and scaling.
const rootDir = path.resolve(__dirname, "..");
const requestedAppPort = Number(process.env.APP_PORT || 0);
const requestedChromePort = Number(process.env.CHROME_PORT || 0);
const externalAppUrl = String(process.env.APP_URL || "").replace(/\/$/, "");
let appPort = requestedAppPort;
let chromePort = requestedChromePort;
let baseUrl = externalAppUrl;

const timeoutMs = 15000;
const commandTimeoutMs = 5000;
const shutdownTimeoutMs = 3000;
const outputRoot = path.resolve(rootDir, "output", "playwright", "paper-autofit-regression");
const runId = String(process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, "-"));
const runDir = path.join(outputRoot, runId);
fs.mkdirSync(runDir, { recursive: true });

const papers = [
  { id: "a4", widthMm: 210, heightMm: 297 },
  { id: "a3", widthMm: 297, heightMm: 420 },
  { id: "a5", widthMm: 148, heightMm: 210 },
  { id: "b4-jis", widthMm: 257, heightMm: 364 },
  { id: "b5-jis", widthMm: 182, heightMm: 257 },
  { id: "custom-215x330", widthMm: 215, heightMm: 330 },
];
const layouts = ["horizontal", "horizontal-workspace", "vertical"];
const orientations = ["portrait", "landscape"];
const apps = [
  {
    id: "calculation-problem-set",
    path: "/apps/calculation-problem-set/",
  },
  {
    id: "custom-calculation-problem-builder",
    path: "/apps/custom-calculation-problem-builder/",
  },
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function withTimeout(promise, timeout, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out after ${timeout}ms`));
    }, timeout);
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort(requestedPort) {
  const probe = createNetServer();
  await withTimeout(new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(requestedPort, "127.0.0.1", resolve);
  }), commandTimeoutMs, "Port reservation");
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  await withTimeout(new Promise((resolve, reject) => {
    probe.close((error) => error ? reject(error) : resolve());
  }), commandTimeoutMs, "Port release");
  return port;
}

async function startStaticServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, baseUrl || "http://127.0.0.1");
    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      res.end(data);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedAppPort, "127.0.0.1", resolve);
  });
  const address = server.address();
  appPort = typeof address === "object" && address ? address.port : requestedAppPort;
  baseUrl = `http://127.0.0.1:${appPort}`;
  return server;
}

async function getJson(url, init = undefined) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await withTimeout(fetch(url, init), commandTimeoutMs, `Fetch ${url}`);
      if (response.ok) return response.json();
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(100);
  }
  throw new Error(`Failed to fetch ${url}: ${lastError}`);
}

async function assertHttp(url) {
  const response = await withTimeout(fetch(url), commandTimeoutMs, `Fetch ${url}`);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Google Chrome was not found. Set CHROME_PATH if needed.");
  return found;
}

async function startChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "paper-autofit-regression-"));
  try {
    chromePort = await reservePort(requestedChromePort);
    const chrome = spawn(chromePath(), [
      "--headless=new",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${profile}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ], { stdio: "ignore" });
    await getJson(`http://127.0.0.1:${chromePort}/json/version`);
    return { chrome, profile };
  } catch (error) {
    fs.rmSync(profile, { recursive: true, force: true });
    throw error;
  }
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Chrome DevTools connection timed out."));
    }, commandTimeoutMs);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((sendResolve, sendReject) => {
            pending.set(messageId, { resolve: sendResolve, reject: sendReject });
          });
        },
        close() {
          pending.forEach(({ reject: sendReject }) => sendReject(new Error("CDP closed.")));
          pending.clear();
          ws.close();
        },
      });
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
      else callback.resolve(message.result);
    };
    ws.onerror = () => reject(new Error("Chrome DevTools WebSocket failed."));
  });
}

async function openTarget() {
  const target = await getJson(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  const client = await createCdpClient(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  return client;
}

async function evaluate(client, expression) {
  const result = await withTimeout(client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }), commandTimeoutMs, "Runtime.evaluate");
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitFor(client, expression, label = expression) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(client, expression);
      if (value) return value;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? ` (${lastError})` : ""}`);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitFor(client, "document.readyState === 'complete'", `${url} load`);
  await waitFor(client, "Boolean(document.querySelector('#pages') && document.querySelector('.print-page-content') && window.__printAdjustmentsApplySettings)", `${url} app setup`);
}

async function configureWorksheet(client, appId, layout, orientation, includeAnswers = true, sheetCount = 1) {
  const config = JSON.stringify({ appId, layout, orientation, includeAnswers, sheetCount });
  const result = await evaluate(client, `(() => {
    const config = ${config};
    const select = (id, value) => {
      const element = document.querySelector('#' + id);
      if (!element) throw new Error('Missing control #' + id);
      const option = [...(element.options || [])].find((item) => item.value === value);
      if (!option) throw new Error('Missing option ' + id + '=' + value);
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const input = (id, value) => {
      const element = document.querySelector('#' + id);
      if (!element) throw new Error('Missing control #' + id);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (config.appId === 'calculation-problem-set') {
      select('grade', '3');
      select('operation', 'divideRemainder');
      select('difficulty', 'standard');
      const digitOptions = [...(document.querySelector('#digits')?.options || [])].map((item) => item.value);
      const preferredDigits = digitOptions.includes('three-one') ? 'three-one' : digitOptions.includes('3') ? '3' : digitOptions[0];
      if (preferredDigits) select('digits', preferredDigits);
    } else {
      select('creationMode', 'auto');
      select('operation', 'divideRemainder');
      select('digitsA', '3');
      select('digitsB', '1');
    }
    input('problemCount', '30');
    input('columns', '3');
    select('layoutMode', config.layout);
    window.__printAdjustmentsApplySettings({
      scalePct: 100,
      sheetCount: config.sheetCount,
      includeAnswers: config.includeAnswers,
      autoFitEnabled: true,
      orientation: config.orientation,
      punchGuide: 'none',
    });
    window.__printAdjustmentsRefresh({ previewZoom: false });
    return {
      layout: document.querySelector('#layoutMode')?.value,
      operation: document.querySelector('#operation')?.value,
      orientation: window.__printAdjustmentsGetSettings?.().orientation,
    };
  })()`);
  await sleep(250);
  return result;
}

async function domSnapshot(client) {
  return evaluate(client, `(() => {
    const visiblePages = [...document.querySelectorAll('.print-page')]
      .filter((page) => !page.hidden && !page.classList.contains('print-adjust-answer-hidden'));
    const signature = (page) => {
      const copy = page.cloneNode(true);
      copy.querySelectorAll('.answer-value, .blank').forEach((element) => element.remove());
      return copy.querySelector('[data-problems]')?.textContent.replace(/\\s+/g, '') || '';
    };
    const signatures = visiblePages.map(signature);
    const answerFlags = visiblePages.map((page) => Boolean(
      page.classList.contains('answer-page') || page.querySelector('.sheet-kind.answer, .print-kind.answer'),
    ));
    const problemCounts = visiblePages.map((page) => page.querySelectorAll(':scope [data-problems] > .problem').length);
    const pairsMatch = visiblePages.length % 2 === 0 && visiblePages.every((page, index) => (
      index % 2 === 0
        ? !answerFlags[index]
        : answerFlags[index] && problemCounts[index] === problemCounts[index - 1]
    ));
    return {
      visiblePageCount: visiblePages.length,
      logicalPageCount: document.querySelectorAll('.print-page').length,
      declaredCount: document.querySelector('#problemCount')?.value || null,
      declaredCountMax: document.querySelector('#problemCount')?.max || null,
      problemCounts,
      kinds: visiblePages.map((page) => page.querySelector('[data-kind]')?.textContent.trim() || ''),
      pairsMatch,
      signatures,
      layout: document.querySelector('#layoutMode')?.value || null,
      operation: document.querySelector('#operation')?.value || null,
      orientation: window.__printAdjustmentsGetSettings?.().orientation || null,
      printArea: document.body.classList.contains('print-paper-area'),
      printLandscape: document.body.classList.contains('print-landscape'),
      cssSupport: Boolean(window.CSS?.supports?.('transform', 'scale(min(calc(100vw / 210mm), calc(100vh / 297mm)))')),
      containSizeRule: document.querySelector('#printAdjustmentsStyle')?.textContent.includes('contain: size !important') || false,
      childTransforms: visiblePages.map((page) => getComputedStyle(page.querySelector(':scope > .print-page-content')).transform),
      pageRule: document.querySelector('#printPageRuleStyle')?.textContent || '',
      printMedia: window.matchMedia('print').matches,
    };
  })()`);
}

async function printLifecycleSnapshot(client, stage) {
  const label = JSON.stringify(stage);
  return evaluate(client, `(() => {
    const visiblePages = [...document.querySelectorAll('.print-page')]
      .filter((page) => !page.hidden && !page.classList.contains('print-adjust-answer-hidden'));
    const pageMetrics = visiblePages.map((page) => {
      const grid = page.querySelector('[data-problems]');
      const content = page.querySelector(':scope > .print-page-content');
      const gridStyle = grid ? getComputedStyle(grid) : null;
      const contentRect = content?.getBoundingClientRect();
      return {
        kind: page.querySelector('[data-kind]')?.textContent.trim() || '',
        problemCount: grid?.querySelectorAll(':scope > .problem').length || 0,
        problemFont: gridStyle?.getPropertyValue('--problem-font').trim() || '',
        rowGap: gridStyle?.getPropertyValue('--row-gap').trim() || '',
        problemBlockHeight: gridStyle?.getPropertyValue('--problem-block-height').trim() || '',
        gridClientHeight: grid?.clientHeight || 0,
        gridScrollHeight: grid?.scrollHeight || 0,
        contentRect: contentRect ? {
          width: contentRect.width,
          height: contentRect.height,
        } : null,
      };
    });
    return {
      stage: ${label},
      visiblePageCount: visiblePages.length,
      problemCounts: pageMetrics.map((page) => page.problemCount),
      pageMetrics,
      declaredCount: document.querySelector('#problemCount')?.value || null,
      layout: document.querySelector('#layoutMode')?.value || null,
      orientation: window.__printAdjustmentsGetSettings?.().orientation || null,
      printArea: document.body.classList.contains('print-paper-area'),
      printMedia: window.matchMedia('print').matches,
      printButtonManaged: document.querySelector('#printBtn')?.dataset.printAdjustManaged === 'true',
    };
  })()`);
}

async function clickPrintButton(client, appId = "") {
  const rebuildControl = appId === "custom-calculation-problem-builder" ? "columns" : "studentName";
  await evaluate(client, `(() => {
    const rebuildControl = document.querySelector('#${rebuildControl}');
    if (rebuildControl) rebuildControl.dispatchEvent(new Event('input', { bubbles: true }));
    const button = document.querySelector('#printBtn');
    if (!button) throw new Error('Missing #printBtn');
    button.click();
    return true;
  })()`);
  await sleep(400);
}

async function dispatchAfterPrint(client) {
  await evaluate(client, "window.dispatchEvent(new Event('afterprint')); true");
  await sleep(350);
}

async function runPrintPathRegression(client, app) {
  await navigate(client, `${baseUrl}${app.path}`);
  await configureWorksheet(client, app.id, "horizontal", "landscape", true, 1);
  const paper = papers.find((candidate) => candidate.id === "b5-jis");
  const before = await printLifecycleSnapshot(client, "before-bare-pdf");
  const bareFile = await printPdf(client, `${app.id}-bare-b5-landscape.pdf`, paper, "landscape");

  // The button path is intentionally separate from the direct PDF path. It
  // exercises the app's last-moment render/window.print preparation sequence
  // that native Chrome uses, without opening a blocking headed dialog.
  await clickPrintButton(client, app.id);
  const afterButton = await printLifecycleSnapshot(client, "after-button-window-print");
  const buttonFile = await printPdf(client, `${app.id}-button-b5-landscape.pdf`, paper, "landscape");

  // Native cancel fires afterprint and must leave the same worksheet/page
  // state so a subsequent print does not inherit stale pagination or scale.
  await dispatchAfterPrint(client);
  const afterCancel = await printLifecycleSnapshot(client, "after-cancel");
  await clickPrintButton(client, app.id);
  const repeatFile = await printPdf(client, `${app.id}-repeat-b5-landscape.pdf`, paper, "landscape");
  const afterRepeat = await printLifecycleSnapshot(client, "after-repeat-window-print");

  return {
    appId: app.id,
    paper: paper.id,
    orientation: "landscape",
    files: [bareFile, buttonFile, repeatFile],
    snapshots: [before, afterButton, afterCancel, afterRepeat],
  };
}

function physicalPaper(paper, orientation) {
  return orientation === "landscape"
    ? { widthMm: paper.heightMm, heightMm: paper.widthMm }
    : { widthMm: paper.widthMm, heightMm: paper.heightMm };
}

async function printPdf(client, filename, paper, orientation) {
  const physical = physicalPaper(paper, orientation);
  const pdf = await withTimeout(client.send("Page.printToPDF", {
    paperWidth: physical.widthMm / 25.4,
    paperHeight: physical.heightMm / 25.4,
    landscape: false,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: false,
  }), timeoutMs, `${filename} PDF`);
  const filePath = path.join(runDir, filename);
  fs.writeFileSync(filePath, Buffer.from(pdf.data, "base64"));
  return filePath;
}

function expectedScale(paper, orientation) {
  const physical = physicalPaper(paper, orientation);
  const logical = orientation === "landscape"
    ? { widthMm: 297, heightMm: 210 }
    : { widthMm: 210, heightMm: 297 };
  return Math.min(physical.widthMm / logical.widthMm, physical.heightMm / logical.heightMm);
}

function assertClose(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}`);
  }
}

function runPdfMeasure(directory) {
  const helper = path.join(__dirname, "measure-paper-autofit-pdfs.py");
  const commands = [process.env.PYTHON || "python", "python3"];
  let lastError = "";
  for (const command of commands) {
    const result = spawnSync(command, [helper, directory], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (!result.error && result.status === 0) {
      return JSON.parse(result.stdout);
    }
    lastError = result.error?.message || result.stderr || `status ${result.status}`;
  }
  throw new Error(`PDF measurement helper failed: ${lastError}`);
}

function clampedDeclaredProblemCount(dom) {
  const declared = Number(dom.declaredCount);
  const maximum = Number(dom.declaredCountMax);
  if (!Number.isFinite(declared)) return 0;
  const upper = Number.isFinite(maximum) && maximum > 0 ? maximum : declared;
  return Math.min(Math.max(1, declared), upper);
}

function validateResults(generated, measurements) {
  const failures = [];
  const refs = new Map();
  const rows = [];
  for (const item of generated) {
    const actual = measurements[path.basename(item.file)];
    if (!actual) {
      failures.push(`${item.name}: missing PDF measurement`);
      continue;
    }
    const physical = physicalPaper(item.paper, item.orientation);
    const expectedWidthPt = physical.widthMm * 72 / 25.4;
    const expectedHeightPt = physical.heightMm * 72 / 25.4;
    const expectedPages = item.dom.visiblePageCount;
    if (actual.pageCount !== expectedPages) {
      failures.push(`${item.name}: page count ${actual.pageCount} != ${expectedPages}`);
    }
    actual.pages.forEach((page, index) => {
      // Chrome rounds CDP paper dimensions to its internal print units. The
      // observed maximum drift is below 1pt (A4: 595.28 requested, 595.92
      // emitted), so keep the assertion tighter than a printer-safe margin
      // while allowing that deterministic quantization.
      assertClose(page.widthPt, expectedWidthPt, 1.0, `${item.name} page ${index + 1} width`);
      assertClose(page.heightPt, expectedHeightPt, 1.0, `${item.name} page ${index + 1} height`);
      if (page.charCount <= 0) failures.push(`${item.name}: blank PDF page ${index + 1}`);
      if (page.charBbox) {
        const [x0, top, x1, bottom] = page.charBbox;
        if (x0 < -1 || top < -1 || x1 > page.widthPt + 1 || bottom > page.heightPt + 1) {
          failures.push(`${item.name}: clipped text bounds on page ${index + 1}`);
        }
      }
      const expectedProblemCount = clampedDeclaredProblemCount(item.dom);
      if (!Number.isFinite(page.problemCount) || page.problemCount !== expectedProblemCount) {
        failures.push(`${item.name}: PDF page ${index + 1} problem count ${page.problemCount} != declared/clamped ${expectedProblemCount}`);
      }
    });
    const maxFontPt = Math.max(...actual.pages.map((page) => page.maxFontPt));
    const refKey = `${item.appId}|${item.layout}|${item.orientation}`;
    if (item.mode === "matrix" && item.paper.id === "a4") refs.set(refKey, maxFontPt);
    const reference = refs.get(refKey);
    rows.push({
      app: item.appId,
      mode: item.mode,
      layout: item.layout,
      orientation: item.orientation,
      paper: item.paper.id,
      pages: actual.pageCount,
      sizePt: `${actual.pages[0]?.widthPt.toFixed(2)}x${actual.pages[0]?.heightPt.toFixed(2)}`,
      problems: item.dom.problemCounts.join("/"),
      pdfProblems: actual.pages.map((page) => page.problemCount).join("/"),
      declared: `${item.dom.declaredCount}/${item.dom.declaredCountMax}`,
      maxFontPt: Number(maxFontPt.toFixed(3)),
      expectedScale: Number(expectedScale(item.paper, item.orientation).toFixed(4)),
      fontRatio: reference ? Number((maxFontPt / reference).toFixed(4)) : null,
    });
    if (item.dom.printArea !== true || item.dom.cssSupport !== true || item.dom.containSizeRule !== true) {
      failures.push(`${item.name}: paper-area feature gate or size containment missing`);
    }
    if (item.dom.printMedia !== false) failures.push(`${item.name}: unexpectedly left print media active`);
    if (!item.dom.pageRule.includes(`size: ${item.orientation}`) || item.dom.pageRule.includes("A4")) {
      failures.push(`${item.name}: app print rule did not preserve orientation-only paper CSS`);
    }
    if (item.dom.childTransforms.some((value) => value !== "none")) failures.push(`${item.name}: screen transform changed`);
    if (item.includeAnswers && !item.dom.pairsMatch) failures.push(`${item.name}: answer pairing mismatch`);
    const expectedProblemCount = clampedDeclaredProblemCount(item.dom);
    if (expectedProblemCount <= 0 || item.dom.problemCounts.some((count) => count !== expectedProblemCount)) {
      failures.push(`${item.name}: problem counts are not paired (${item.dom.problemCounts.join("/")}, declared ${item.dom.declaredCount}/${item.dom.declaredCountMax})`);
    }
    if (item.dom.layout !== item.layout || item.dom.operation !== "divideRemainder") failures.push(`${item.name}: app layout/operation was not applied`);
    if (item.dom.orientation !== item.orientation) failures.push(`${item.name}: app orientation was not applied`);

    if (reference && ["matrix", "answers-off"].includes(item.mode)) {
      const ratio = maxFontPt / reference;
      assertClose(ratio, expectedScale(item.paper, item.orientation), 0.04, `${item.name} font ratio`);
    }
  }
  return { failures, rows };
}

function revalidationItems(directory) {
  const summaryPath = path.join(directory, "summary.json");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const rows = summary.validation?.rows || [];
  const occurrences = new Map();
  return rows.map((row) => {
    const paper = papers.find((candidate) => candidate.id === row.paper);
    if (!paper) throw new Error(`Unknown paper in summary: ${row.paper}`);
    const baseKey = `${row.app}|${row.mode}|${row.layout}|${row.orientation}|${row.paper}`;
    const occurrence = occurrences.get(baseKey) || 0;
    occurrences.set(baseKey, occurrence + 1);
    const fileName = row.mode === "matrix"
      ? `${row.app}-${row.layout}-${row.orientation}-${row.paper}.pdf`
      : row.mode === "repeat"
        ? `${row.app}-repeat-${occurrence + 1}-${row.paper}.pdf`
        : `${row.app}-${row.mode}-${row.layout}-${row.orientation}-${row.paper}.pdf`;
    const [declaredCount, declaredCountMax] = String(row.declared).split("/");
    return {
      name: path.basename(fileName, ".pdf"),
      file: path.join(directory, fileName),
      appId: row.app,
      layout: row.layout,
      orientation: row.orientation,
      paper,
      mode: row.mode,
      includeAnswers: row.mode !== "answers-off",
      dom: {
        visiblePageCount: row.pages,
        problemCounts: String(row.problems).split("/").map(Number),
        declaredCount,
        declaredCountMax,
        printArea: true,
        cssSupport: true,
        containSizeRule: true,
        printMedia: false,
        pageRule: `@page { size: ${row.orientation}; margin: 0; }`,
        childTransforms: [],
        pairsMatch: true,
        layout: row.layout,
        operation: "divideRemainder",
        orientation: row.orientation,
      },
    };
  });
}

function revalidateExistingRun(directory) {
  const resolvedDirectory = path.resolve(directory);
  const generated = revalidationItems(resolvedDirectory);
  const measurements = runPdfMeasure(resolvedDirectory);
  const validation = validateResults(generated, measurements);
  const summary = {
    sourceRun: path.join(resolvedDirectory, "summary.json"),
    revalidatedAt: new Date().toISOString(),
    pdfCount: generated.length,
    validation,
  };
  fs.writeFileSync(path.join(resolvedDirectory, "revalidate-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`Paper autofit PDF revalidation checked ${generated.length} PDFs in ${resolvedDirectory}`);
  console.table(validation.rows.filter((row) => row.mode === "matrix" && row.orientation === "portrait" && row.layout === "horizontal"));
  if (validation.failures.length) {
    validation.failures.forEach((failure) => console.error(`FAIL ${failure}`));
    throw new Error(`Paper autofit PDF revalidation failed with ${validation.failures.length} failure(s).`);
  }
  console.log("Paper autofit PDF revalidation passed: every measured PDF page matches its declared/clamped problem count.");
}

async function runApp(client, app) {
  await navigate(client, `${baseUrl}${app.path}`);
  const generated = [];
  const matrix = [];
  for (const layout of layouts) {
    for (const orientation of orientations) {
      const settings = await configureWorksheet(client, app.id, layout, orientation, true, 1);
      const dom = await domSnapshot(client);
      if (settings.layout !== layout || settings.orientation !== orientation) {
        throw new Error(`${app.id}/${layout}/${orientation}: app settings did not apply`);
      }
      for (const paper of papers) {
        const name = `${app.id}-${layout}-${orientation}-${paper.id}`;
        const file = await printPdf(client, `${name}.pdf`, paper, orientation);
        const item = {
          name,
          file,
          appId: app.id,
          layout,
          orientation,
          paper,
          mode: "matrix",
          includeAnswers: true,
          dom,
        };
        generated.push(item);
        matrix.push(item);
      }
    }
  }

  const modeCases = [
    { mode: "answers-off", layout: "horizontal", orientation: "portrait", paper: papers.find((paper) => paper.id === "a4"), includeAnswers: false, sheetCount: 1 },
    { mode: "answers-off", layout: "horizontal", orientation: "landscape", paper: papers.find((paper) => paper.id === "a3"), includeAnswers: false, sheetCount: 1 },
    { mode: "multiset", layout: "horizontal-workspace", orientation: "portrait", paper: papers.find((paper) => paper.id === "b5-jis"), includeAnswers: true, sheetCount: 2 },
    { mode: "multiset", layout: "vertical", orientation: "landscape", paper: papers.find((paper) => paper.id === "b4-jis"), includeAnswers: true, sheetCount: 2 },
  ];
  for (const testCase of modeCases) {
    await configureWorksheet(client, app.id, testCase.layout, testCase.orientation, testCase.includeAnswers, testCase.sheetCount);
    const dom = await domSnapshot(client);
    const name = `${app.id}-${testCase.mode}-${testCase.layout}-${testCase.orientation}-${testCase.paper.id}`;
    const file = await printPdf(client, `${name}.pdf`, testCase.paper, testCase.orientation);
    generated.push({
      name,
      file,
      appId: app.id,
      layout: testCase.layout,
      orientation: testCase.orientation,
      paper: testCase.paper,
      mode: testCase.mode,
      includeAnswers: testCase.includeAnswers,
      dom,
    });
  }

  // Native cancel/reopen is covered by Terra's headed harness. Here we cover
  // the app-side part: prepare twice, cancel the first output, then print twice
  // after returning to the original orientation without stale page state.
  await configureWorksheet(client, app.id, "horizontal", "portrait", true, 1);
  const beforeCancel = await domSnapshot(client);
  await evaluate(client, "window.__printAdjustmentsRefresh({ previewZoom: false }); window.__printAdjustmentsRefresh({ previewZoom: false }); true");
  const afterCancel = await domSnapshot(client);
  if (beforeCancel.visiblePageCount !== afterCancel.visiblePageCount || beforeCancel.kinds.join("|") !== afterCancel.kinds.join("|")) {
    throw new Error(`${app.id}: repeated print preparation changed page state`);
  }
  for (const repeat of [1, 2]) {
    const paper = papers.find((candidate) => candidate.id === "a4");
    const name = `${app.id}-repeat-${repeat}-a4`;
    const file = await printPdf(client, `${name}.pdf`, paper, "portrait");
    generated.push({
      name,
      file,
      appId: app.id,
      layout: "horizontal",
      orientation: "portrait",
      paper,
      mode: "repeat",
      includeAnswers: true,
      dom: afterCancel,
    });
  }
  return { generated, matrixCount: matrix.length };
}

async function stopChrome(handle) {
  if (!handle) return;
  const { chrome, profile } = handle;
  try {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await withTimeout(exited, shutdownTimeoutMs, "Chrome shutdown").catch(() => {
        if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
      });
    }
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function stopServer(server) {
  if (!server) return;
  await withTimeout(new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }), shutdownTimeoutMs, "Static server shutdown").catch(() => server.closeAllConnections?.());
}

async function main() {
  let server = null;
  let chromeHandle = null;
  let client = null;
  try {
    const revalidateDirectory = String(process.env.PAPER_AUTOFIT_REVALIDATE_DIR || "").trim();
    if (revalidateDirectory) {
      revalidateExistingRun(revalidateDirectory);
      return;
    }
    if (!baseUrl) server = await startStaticServer();
    await assertHttp(`${baseUrl}/apps/calculation-problem-set/`);
    chromeHandle = await startChrome();
    client = await openTarget();
    if (process.env.PAPER_AUTOFIT_PRINT_PATH_ONLY === "1") {
      const printPath = [];
      for (const app of apps) {
        printPath.push(await runPrintPathRegression(client, app));
      }
      const generated = printPath.flatMap((result) => result.files.map((file, index) => ({
        name: path.basename(file, ".pdf"),
        file,
        appId: result.appId,
        layout: "horizontal",
        orientation: result.orientation,
        paper: papers.find((paper) => paper.id === result.paper),
        mode: index === 0 ? "bare-pdf" : index === 1 ? "button-window-print" : "repeat-window-print",
        includeAnswers: true,
        dom: {
          visiblePageCount: result.snapshots[index === 0 ? 0 : index === 1 ? 1 : 3].visiblePageCount,
          problemCounts: result.snapshots[index === 0 ? 0 : index === 1 ? 1 : 3].problemCounts,
          declaredCount: result.snapshots[index === 0 ? 0 : index === 1 ? 1 : 3].declaredCount,
          declaredCountMax: "",
          printArea: result.snapshots[index === 0 ? 0 : index === 1 ? 1 : 3].printArea,
          cssSupport: true,
          containSizeRule: true,
          printMedia: result.snapshots[index === 0 ? 0 : index === 1 ? 1 : 3].printMedia,
          pageRule: `@page { size: landscape; margin: 0; }`,
          childTransforms: [],
          pairsMatch: true,
          layout: "horizontal",
          operation: "divideRemainder",
          orientation: "landscape",
        },
      })));
      const measurements = runPdfMeasure(runDir);
      const failures = [];
      const expectedWidthPt = 257 * 72 / 25.4;
      const expectedHeightPt = 182 * 72 / 25.4;
      for (const item of generated) {
        const actual = measurements[path.basename(item.file)];
        if (!actual) {
          failures.push(`${item.name}: missing PDF measurement`);
          continue;
        }
        if (actual.pageCount !== 2) failures.push(`${item.name}: expected 2 pages, got ${actual.pageCount}`);
        actual.pages.forEach((page, pageIndex) => {
          assertClose(page.widthPt, expectedWidthPt, 1.0, `${item.name} page ${pageIndex + 1} width`);
          assertClose(page.heightPt, expectedHeightPt, 1.0, `${item.name} page ${pageIndex + 1} height`);
          if (page.charCount <= 0) failures.push(`${item.name}: blank page ${pageIndex + 1}`);
          if (page.charBbox && (page.charBbox[0] < -1 || page.charBbox[1] < -1
            || page.charBbox[2] > page.widthPt + 1 || page.charBbox[3] > page.heightPt + 1)) {
            failures.push(`${item.name}: clipped text bounds on page ${pageIndex + 1}`);
          }
          if (page.problemCount !== 30) failures.push(`${item.name}: PDF page ${pageIndex + 1} problem count ${page.problemCount} != 30`);
          if (!page.text.includes("30")) failures.push(`${item.name}: page ${pageIndex + 1} does not retain problem 30 text`);
        });
        if (item.dom.problemCounts.some((count) => count !== 30)) {
          failures.push(`${item.name}: DOM count changed (${item.dom.problemCounts.join("/")})`);
        }
      }
      for (const result of printPath) {
        const [before, afterButton, afterCancel, afterRepeat] = result.snapshots;
        for (const snapshot of [before, afterButton, afterCancel, afterRepeat]) {
          if (snapshot.visiblePageCount !== 2 || snapshot.problemCounts.some((count) => count !== 30)) {
            failures.push(`${result.appId}/${snapshot.stage}: page/count state ${snapshot.visiblePageCount} ${snapshot.problemCounts.join("/")}`);
          }
        }
        const beforeStyle = JSON.stringify(before.pageMetrics.map((page) => [page.problemFont, page.rowGap, page.problemBlockHeight]));
        const afterStyle = JSON.stringify(afterButton.pageMetrics.map((page) => [page.problemFont, page.rowGap, page.problemBlockHeight]));
        if (beforeStyle !== afterStyle) failures.push(`${result.appId}: button print path changed fitted grid metrics`);
        const cancelStyle = JSON.stringify(afterCancel.pageMetrics.map((page) => [page.problemFont, page.rowGap, page.problemBlockHeight]));
        const repeatStyle = JSON.stringify(afterRepeat.pageMetrics.map((page) => [page.problemFont, page.rowGap, page.problemBlockHeight]));
        if (cancelStyle !== afterStyle || repeatStyle !== afterStyle) failures.push(`${result.appId}: cancel/repeat did not restore fitted grid metrics`);
      }
      const summary = { chrome: chromePath(), appUrl: baseUrl, runDir, generatedPdfCount: generated.length, printPath, measurements, failures };
      fs.writeFileSync(path.join(runDir, "print-path-summary.json"), JSON.stringify(summary, null, 2), "utf8");
      console.log(`Paper autofit print-path regression generated ${generated.length} PDFs in ${runDir}`);
      console.log(JSON.stringify(printPath, null, 2));
      if (failures.length) {
        failures.forEach((failure) => console.error(`FAIL ${failure}`));
        throw new Error(`Paper autofit print-path regression failed with ${failures.length} failure(s).`);
      }
      console.log("Paper autofit print-path regression passed: bare PDF, button/window.print, cancel restoration, and repeat retained 30/30 paired pages.");
      return;
    }
    const generated = [];
    const matrixCounts = {};
    for (const app of apps) {
      const result = await runApp(client, app);
      generated.push(...result.generated);
      matrixCounts[app.id] = result.matrixCount;
    }
    const measurements = runPdfMeasure(runDir);
    const validation = validateResults(generated, measurements);
    const summary = {
      chrome: chromePath(),
      appUrl: baseUrl,
      runDir,
      generatedPdfCount: generated.length,
      matrixCounts,
      papers: papers.map((paper) => ({ id: paper.id, widthMm: paper.widthMm, heightMm: paper.heightMm })),
      validation,
    };
    fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
    console.log(`Paper autofit regression generated ${generated.length} PDFs in ${runDir}`);
    console.table(validation.rows.filter((row) => row.mode === "matrix" && row.orientation === "portrait" && row.layout === "horizontal"));
    if (validation.failures.length) {
      validation.failures.forEach((failure) => console.error(`FAIL ${failure}`));
      throw new Error(`Paper autofit regression failed with ${validation.failures.length} failure(s).`);
    }
    console.log("Paper autofit regression passed: A4/A3/A5/JIS B4/JIS B5/215x330, all layouts, both orientations, answer-off, multisets, and repeated preparation.");
  } finally {
    client?.close();
    await stopChrome(chromeHandle);
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
