const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createServer: createNetServer } = require("node:net");

const rootDir = path.resolve(__dirname, "..");
const requestedAppPort = Number(process.env.APP_PORT || 0);
const requestedChromePort = Number(process.env.CHROME_PORT || 0);
let appPort = requestedAppPort;
let chromePort = requestedChromePort;
let baseUrl = `http://127.0.0.1:${appPort}`;

const commandTimeoutMs = 5000;
const navigationTimeoutMs = 10000;
const pdfTimeoutMs = 15000;
const shutdownTimeoutMs = 3000;

const cases = [
  {
    name: "grade2-add",
    path: "/apps/math-print-grade2/index.html",
    stateKey: "math-print-grade2-state-v2",
    scalePct: 150,
    settings: {
      title: "2 grade math",
      type: "add2",
      layout: "vertical",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
  },
  {
    name: "grade2-sub",
    path: "/apps/math-print-grade2/index.html",
    stateKey: "math-print-grade2-state-v2",
    scalePct: 150,
    settings: {
      title: "2 grade math",
      type: "sub2",
      layout: "vertical",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
  },
  {
    name: "grade3-add",
    path: "/apps/math-print-grade3/index.html",
    stateKey: "math-print-grade3-state-v3",
    scalePct: 150,
    settings: {
      title: "3 grade math",
      type: "add3",
      layout: "vertical",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
  },
  {
    name: "grade3-sub",
    path: "/apps/math-print-grade3/index.html",
    stateKey: "math-print-grade3-state-v3",
    scalePct: 150,
    settings: {
      title: "3 grade math",
      type: "sub3",
      layout: "vertical",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
  },
  {
    name: "grade3-mul-one",
    path: "/apps/multiplication-print-grade3/index.html",
    stateKey: "multiplication-print-grade3-state-v4",
    scalePct: 150,
    settings: {
      title: "3 grade multiplication",
      type: "twoByOne",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
    operatorAnchor: "multiplicand",
    negativeControlAnchor: "row",
  },
  {
    name: "grade3-mul-two",
    path: "/apps/multiplication-print-grade3/index.html",
    stateKey: "multiplication-print-grade3-state-v4",
    scalePct: 150,
    settings: {
      title: "3 grade multiplication",
      type: "twoByTwo",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
    operatorAnchor: "multiplicand",
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

function startStaticServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, baseUrl);
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

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedAppPort, "127.0.0.1", () => {
      const address = server.address();
      appPort = typeof address === "object" && address ? address.port : requestedAppPort;
      baseUrl = `http://127.0.0.1:${appPort}`;
      resolve(server);
    });
  });
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

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

function chromeCandidates() {
  return [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
}

function findChrome() {
  const found = chromeCandidates().find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Chrome or Edge was not found. Set CHROME_PATH to run this check.");
  }
  return found;
}

async function startChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vertical-layout-check-"));
  try {
    chromePort = await reservePort(requestedChromePort);
    const chrome = spawn(findChrome(), [
      "--headless=new",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${profile}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ], { stdio: "ignore" });

    return { chrome, profile };
  } catch (error) {
    fs.rmSync(profile, { recursive: true, force: true });
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, tries = 60, init) {
  let lastError = "";
  const deadline = Date.now() + navigationTimeoutMs;
  for (let i = 0; i < tries; i += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await withTimeout(fetch(url, init), Math.min(commandTimeoutMs, remaining), `Fetch ${url}`);
      if (response.ok) {
        return withTimeout(response.json(), Math.min(commandTimeoutMs, remaining), `Parse ${url}`);
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`Failed to fetch ${url}: ${lastError}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const eventWaiters = new Map();

  function rejectWaiters(error) {
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
    eventWaiters.forEach((waiters) => {
      waiters.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    eventWaiters.clear();
  }

  function waitForEvent(method, predicate = () => true, timeoutMs = navigationTimeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = eventWaiters.get(method) || [];
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) waiters.splice(index, 1);
        if (!waiters.length) eventWaiters.delete(method);
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);
      const waiters = eventWaiters.get(method) || [];
      waiters.push({ predicate, resolve, reject, timer });
      eventWaiters.set(method, waiters);
    });
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callbacks = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        callbacks.reject(new Error(JSON.stringify(message.error)));
      } else {
        callbacks.resolve(message.result);
      }
      return;
    }

    if (message.method && eventWaiters.has(message.method)) {
      const waiters = eventWaiters.get(message.method);
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        const waiter = waiters[index];
        let matches = false;
        try {
          matches = waiter.predicate(message.params || {});
        } catch (error) {
          waiters.splice(index, 1);
          clearTimeout(waiter.timer);
          waiter.reject(error);
          continue;
        }
        if (matches) {
          waiters.splice(index, 1);
          clearTimeout(waiter.timer);
          waiter.resolve(message.params || {});
        }
      }
      if (!waiters.length) eventWaiters.delete(message.method);
    }
  };

  return new Promise((resolve, reject) => {
    const connectionTimer = setTimeout(() => {
      ws.close();
      reject(new Error(`Chrome DevTools connection timed out after ${commandTimeoutMs}ms`));
    }, commandTimeoutMs);
    ws.onopen = () => {
      clearTimeout(connectionTimer);
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolve, reject) => {
            pending.set(messageId, { resolve, reject });
          });
        },
        waitForEvent,
        close() {
          rejectWaiters(new Error("Chrome DevTools WebSocket closed."));
          ws.close();
        },
      });
    };
    ws.onerror = () => {
      clearTimeout(connectionTimer);
      const error = new Error("Chrome DevTools WebSocket failed.");
      rejectWaiters(error);
      reject(error);
    };
    ws.onclose = () => {
      clearTimeout(connectionTimer);
      rejectWaiters(new Error("Chrome DevTools WebSocket closed."));
    };
  });
}

async function waitFor(client, expression, timeoutMs = navigationTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const result = await withTimeout(client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
      }), commandTimeoutMs, "Runtime.evaluate");
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || "Runtime expression failed.");
      }
      if (result.result?.value) return result.result.value;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(Math.min(100, Math.max(10, deadline - Date.now())));
  }
  const suffix = lastError ? ` (${lastError})` : "";
  let diagnostics = "";
  try {
    const result = await withTimeout(client.send("Runtime.evaluate", {
      expression: `(() => ({
        url: location.href,
        readyState: document.readyState,
        problemType: document.querySelector('#problemType')?.value || null,
        layout: document.querySelector('#layoutMode')?.value || null,
        formulas: document.querySelectorAll('.vertical-formula').length,
        pages: document.querySelectorAll('.print-page').length,
        scale: document.querySelector('#printProblemScaleNumber')?.value || null,
        storageKeys: Object.keys(localStorage),
      }))()`,
      returnByValue: true,
    }), commandTimeoutMs, "Runtime diagnostics");
    diagnostics = ` diagnostics=${JSON.stringify(result.result?.value || null)}`;
  } catch (error) {
    diagnostics = ` diagnosticsError=${error.message}`;
  }
  throw new Error(`Timed out waiting for: ${expression}${suffix}${diagnostics}`);
}

async function navigateAndWait(client, url) {
  const loaded = client.waitForEvent("Page.loadEventFired");
  try {
    const navigation = await withTimeout(client.send("Page.navigate", { url }), commandTimeoutMs, `Navigate to ${url}`);
    if (navigation.errorText) {
      throw new Error(`Navigation failed for ${url}: ${navigation.errorText}`);
    }
    await loaded;
    await waitFor(client, "document.readyState === 'complete'");
  } catch (error) {
    loaded.catch(() => {});
    throw error;
  }
}

function countPdfPages(buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

function metricsExpression(operatorAnchor = "row") {
  const intendedOperatorGap = operatorAnchor === "multiplicand" ? "item.anchorGap" : "item.rowGap";
  return String.raw`(() => {
    const visiblePages = [...document.querySelectorAll(".print-page")]
      .filter((page) => getComputedStyle(page).display !== "none" && !page.hidden);

    const formulaMetrics = [...document.querySelectorAll(".vertical-formula")].map((formula) => {
      const page = formula.closest(".print-page");
      const pageRect = page.getBoundingClientRect();
      const formulaRect = formula.getBoundingClientRect();
      const cells = [...formula.querySelectorAll(".digit-cell")].map((cell) => {
        const rect = cell.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      });

      let overlaps = 0;
      for (let i = 0; i < cells.length; i += 1) {
        for (let j = i + 1; j < cells.length; j += 1) {
          const a = cells[i];
          const b = cells[j];
          if (a.x < b.right - 0.5 && a.right > b.x + 0.5 && a.y < b.bottom - 0.5 && a.bottom > b.y + 0.5) {
            overlaps += 1;
          }
        }
      }

      return {
        overlaps,
        outsideX: Math.max(0, formulaRect.right - pageRect.right, pageRect.left - formulaRect.left),
        outsideY: Math.max(0, formulaRect.bottom - pageRect.bottom, pageRect.top - formulaRect.top),
      };
    });

    const helperMetrics = [...document.querySelectorAll(".digit-cell .helper-box")].slice(0, 40).map((helper) => {
      const cellRect = helper.closest(".digit-cell").getBoundingClientRect();
      const helperRect = helper.getBoundingClientRect();
      const style = getComputedStyle(helper);
      return {
        topGap: helperRect.top - cellRect.top,
        rightGap: cellRect.right - helperRect.right,
        onRightHalf: helperRect.left - cellRect.left >= cellRect.width / 2,
        borderLeft: style.borderLeftWidth,
        borderRight: style.borderRightWidth,
      };
    });

    const operatorMetrics = [...document.querySelectorAll(".digit-row")]
      .filter((row) => row.querySelector(".operator")?.textContent.trim())
      .map((row) => {
        const operator = row.querySelector(".operator");
        const operatorRect = operator.getBoundingClientRect();
        const cells = [...row.querySelectorAll(".digit-cell")];
        const firstDigitCell = cells.find((cell) => cell.querySelector(".digit-value")) || cells[0];
        const digitRect = firstDigitCell.getBoundingClientRect();
        const formula = row.closest(".vertical-formula");
        const multiplicandRow = formula?.querySelector(".digit-row");
        const multiplicandCells = [...(multiplicandRow?.querySelectorAll(".digit-cell") || [])];
        const firstMultiplicandCell = multiplicandCells.find((cell) => cell.querySelector(".digit-value")) || multiplicandCells[0];
        const multiplicandRect = firstMultiplicandCell.getBoundingClientRect();
        const style = getComputedStyle(operator);
        return {
          rowGap: digitRect.left - operatorRect.right,
          anchorGap: multiplicandRect.left - operatorRect.right,
          visible: operatorRect.width > 0 && operatorRect.height > 0,
          sameLine: Math.abs((operatorRect.top + operatorRect.height / 2) - (digitRect.top + digitRect.height / 2)) < digitRect.height,
          zIndex: style.zIndex,
        };
      });

    const pageMetrics = visiblePages.map((page) => {
      const pageRect = page.getBoundingClientRect();
      const elements = [...page.querySelectorAll(".sheet-header, .problem, .vertical-formula, .digit-cell")];
      const maxRight = Math.max(...elements.map((element) => element.getBoundingClientRect().right - pageRect.left), 0);
      const maxBottom = Math.max(...elements.map((element) => element.getBoundingClientRect().bottom - pageRect.top), 0);
      return {
        width: pageRect.width,
        height: pageRect.height,
        overflowX: maxRight - pageRect.width,
        overflowY: maxBottom - pageRect.height,
      };
    });

    return {
      title: document.title,
      visiblePageCount: visiblePages.length,
      formulaCount: formulaMetrics.length,
      maxCellOverlap: Math.max(0, ...formulaMetrics.map((item) => item.overlaps)),
      maxFormulaOutsideX: Math.max(0, ...formulaMetrics.map((item) => item.outsideX)),
      maxFormulaOutsideY: Math.max(0, ...formulaMetrics.map((item) => item.outsideY)),
      badOperatorRowGaps: operatorMetrics.filter((item) => item.rowGap < 1 || item.rowGap > 6).length,
      badHelpers: helperMetrics.filter((item) => (
        item.topGap > 1.5 ||
        item.rightGap > 1.5 ||
        !item.onRightHalf ||
        item.borderLeft === "0px" ||
        item.borderRight !== "0px"
      )).length,
      badOperators: operatorMetrics.filter((item) => (
        ${intendedOperatorGap} < 1 ||
        ${intendedOperatorGap} > 6 ||
        !item.visible ||
        !item.sameLine ||
        item.zIndex !== "2"
      )).length,
      maxPageOverflowX: Math.max(0, ...pageMetrics.map((item) => item.overflowX)),
      maxPageOverflowY: Math.max(0, ...pageMetrics.map((item) => item.overflowY)),
    };
  })()`;
}

async function openCase(testCase) {
  const url = `${baseUrl}${testCase.path}`;
  const created = await getJson(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent("about:blank")}`, 30, {
    method: "PUT",
  });
  const client = await withTimeout(createCdpClient(created.webSocketDebuggerUrl), commandTimeoutMs, "Connect to Chrome DevTools");
  try {
    await withTimeout(client.send("Page.enable"), commandTimeoutMs, "Page.enable");
    await withTimeout(client.send("Runtime.enable"), commandTimeoutMs, "Runtime.enable");
    await withTimeout(client.send("Emulation.setDeviceMetricsOverride", {
      width: 1400,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }), commandTimeoutMs, "Emulation.setDeviceMetricsOverride");

    await navigateAndWait(client, url);

    const printSettings = {
      scalePct: testCase.scalePct,
      sheetCount: 1,
      includeAnswers: true,
      autoFitEnabled: false,
      orientation: "portrait",
      punchGuide: "none",
    };
    const appState = JSON.stringify({ settings: testCase.settings, problems: [] });
    const adjustments = JSON.stringify(printSettings);
    await withTimeout(client.send("Runtime.evaluate", {
      expression: `
        localStorage.setItem(${JSON.stringify(testCase.stateKey)}, ${JSON.stringify(appState)});
        localStorage.setItem(${JSON.stringify(`print-adjustments:${testCase.path}`)}, ${JSON.stringify(adjustments)});
      `,
      returnByValue: true,
    }), commandTimeoutMs, "Initialize browser storage");

    await navigateAndWait(client, url);
    await waitFor(client, "document.querySelectorAll('.vertical-formula').length > 0");
    await waitFor(client, "document.querySelector('#printProblemScaleNumber')?.value === String(" + testCase.scalePct + ")");
    return client;
  } catch (error) {
    await closeCase(client);
    throw error;
  }
}

function assertMetrics(testCase, phase, metrics) {
  const { name } = testCase;
  const failures = [];
  if (metrics.visiblePageCount <= 0) failures.push("no visible pages");
  if (metrics.formulaCount <= 0) failures.push("no vertical formulas");
  if (metrics.maxCellOverlap > 0) failures.push(`cell overlaps=${metrics.maxCellOverlap}`);
  if (metrics.maxFormulaOutsideX > 2) failures.push(`formula outside x=${metrics.maxFormulaOutsideX.toFixed(1)}`);
  if (metrics.maxFormulaOutsideY > 2) failures.push(`formula outside y=${metrics.maxFormulaOutsideY.toFixed(1)}`);
  if (metrics.badHelpers > 0) failures.push(`bad helper boxes=${metrics.badHelpers}`);
  if (metrics.badOperators > 0) failures.push(`bad operators=${metrics.badOperators}`);
  if (metrics.maxPageOverflowX > 2) failures.push(`page overflow x=${metrics.maxPageOverflowX.toFixed(1)}`);
  if (metrics.maxPageOverflowY > 2) failures.push(`page overflow y=${metrics.maxPageOverflowY.toFixed(1)}`);
  if (phase === "screen" && testCase.negativeControlAnchor === "row" && metrics.badOperatorRowGaps <= 0) {
    failures.push("negative control: row-anchor gap unexpectedly passed");
  }
  if (failures.length) {
    throw new Error(`${name} ${phase}: ${failures.join(", ")}`);
  }
}

async function runCase(testCase) {
  const client = await openCase(testCase);
  try {
    const screen = await withTimeout(client.send("Runtime.evaluate", {
      expression: metricsExpression(testCase.operatorAnchor),
      returnByValue: true,
    }), commandTimeoutMs, `${testCase.name} screen metrics`);
    const screenMetrics = screen.result.value;
    assertMetrics(testCase, "screen", screenMetrics);

    await withTimeout(client.send("Emulation.setEmulatedMedia", { media: "print" }), commandTimeoutMs, `${testCase.name} print media`);
    await sleep(100);
    const print = await withTimeout(client.send("Runtime.evaluate", {
      expression: metricsExpression(testCase.operatorAnchor),
      returnByValue: true,
    }), commandTimeoutMs, `${testCase.name} print metrics`);
    const printMetrics = print.result.value;
    assertMetrics(testCase, "print", printMetrics);

    const pdf = await withTimeout(client.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    }), pdfTimeoutMs, `${testCase.name} PDF generation`);
    const pdfPages = countPdfPages(Buffer.from(pdf.data, "base64"));
    if (pdfPages !== printMetrics.visiblePageCount) {
      throw new Error(`${testCase.name} print: pdfPages=${pdfPages}, visiblePages=${printMetrics.visiblePageCount}`);
    }

    return {
      name: testCase.name,
      formulas: screenMetrics.formulaCount,
      pages: printMetrics.visiblePageCount,
      pdfPages,
      scalePct: testCase.scalePct,
      operatorAnchor: testCase.operatorAnchor || "row",
      rowGapViolations: screenMetrics.badOperatorRowGaps,
    };
  } finally {
    await closeCase(client);
  }
}

async function closeCase(client) {
  if (!client) return;
  try {
    await withTimeout(client.send("Page.close"), shutdownTimeoutMs, "Close browser tab").catch(() => {});
  } finally {
    client.close();
  }
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

async function stopStaticServer(server) {
  if (!server) return;
  await withTimeout(new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }), shutdownTimeoutMs, "Static server shutdown").catch(() => {
    server.closeAllConnections?.();
  });
}

async function main() {
  let server;
  let chromeHandle;

  try {
    server = await startStaticServer();
    chromeHandle = await startChrome();
    await getJson(`http://127.0.0.1:${chromePort}/json/version`);
    const rows = [];
    const failures = [];
    for (const testCase of cases) {
      try {
        rows.push({ ...(await runCase(testCase)), status: "passed" });
      } catch (error) {
        failures.push({ name: testCase.name, error: error.message });
        rows.push({ name: testCase.name, status: "failed", error: error.message });
        console.error(`${testCase.name} failed: ${error.message}`);
      }
    }
    console.table(rows);
    if (failures.length) {
      throw new Error(`Vertical layout checks failed for ${failures.length} of ${cases.length} cases.`);
    }
    console.log(`Vertical layout checks passed for ${cases.length} cases.`);
  } finally {
    await stopChrome(chromeHandle);
    await stopStaticServer(server);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
