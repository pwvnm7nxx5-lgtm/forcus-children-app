const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const rootDir = path.resolve(__dirname, "..");
const appPort = Number(process.env.APP_PORT || 4273);
const chromePort = Number(process.env.CHROME_PORT || 9333);
const baseUrl = `http://127.0.0.1:${appPort}`;

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
    stateKey: "math-print-grade3-state-v1",
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
    stateKey: "math-print-grade3-state-v1",
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
    stateKey: "multiplication-print-grade3-state-v3",
    scalePct: 150,
    settings: {
      title: "3 grade multiplication",
      type: "twoByOne",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
  },
  {
    name: "grade3-mul-two",
    path: "/apps/multiplication-print-grade3/index.html",
    stateKey: "multiplication-print-grade3-state-v3",
    scalePct: 150,
    settings: {
      title: "3 grade multiplication",
      type: "twoByTwo",
      count: 8,
      columns: 2,
      showCarryBoxes: true,
    },
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
    server.listen(appPort, "127.0.0.1", () => resolve(server));
  });
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

function startChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vertical-layout-check-"));
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
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, tries = 60, init) {
  let lastError = "";
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response.json();
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(100);
  }
  throw new Error(`Failed to fetch ${url}: ${lastError}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(JSON.stringify(message.error)));
    } else {
      callbacks.resolve(message.result);
    }
  };

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolve, reject) => {
            pending.set(messageId, { resolve, reject });
          });
        },
        close() {
          ws.close();
        },
      });
    };
    ws.onerror = () => reject(new Error("Chrome DevTools WebSocket failed."));
  });
}

async function waitFor(client, expression, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.result.value) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

function countPdfPages(buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

function metricsExpression() {
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
        const style = getComputedStyle(operator);
        return {
          gap: digitRect.left - operatorRect.right,
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
      badHelpers: helperMetrics.filter((item) => (
        item.topGap > 1.5 ||
        item.rightGap > 1.5 ||
        !item.onRightHalf ||
        item.borderLeft === "0px" ||
        item.borderRight !== "0px"
      )).length,
      badOperators: operatorMetrics.filter((item) => (
        item.gap < 1 ||
        item.gap > 6 ||
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
  const created = await getJson(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(url)}`, 1, {
    method: "PUT",
  });
  const client = await createCdpClient(created.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1400,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(250);

  const printSettings = {
    scalePct: testCase.scalePct,
    sheetCount: 1,
    includeAnswers: true,
    autoFitEnabled: false,
    orientation: "portrait",
    punchGuide: "none",
  };

  await client.send("Runtime.evaluate", {
    expression: `
      localStorage.setItem(${JSON.stringify(testCase.stateKey)}, JSON.stringify({
        settings: ${JSON.stringify(testCase.settings)},
        problems: []
      }));
      localStorage.setItem(${JSON.stringify(`print-adjustments:${testCase.path}`)}, JSON.stringify(${JSON.stringify(printSettings)}));
      location.reload();
    `,
  });

  await waitFor(client, "document.querySelectorAll('.vertical-formula').length > 0");
  await waitFor(client, "document.querySelector('#printProblemScaleNumber')?.value === String(" + testCase.scalePct + ")");
  return client;
}

function assertMetrics(name, phase, metrics) {
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
  if (failures.length) {
    throw new Error(`${name} ${phase}: ${failures.join(", ")}`);
  }
}

async function runCase(testCase) {
  const client = await openCase(testCase);
  try {
    const screen = await client.send("Runtime.evaluate", {
      expression: metricsExpression(),
      returnByValue: true,
    });
    const screenMetrics = screen.result.value;
    assertMetrics(testCase.name, "screen", screenMetrics);

    await client.send("Emulation.setEmulatedMedia", { media: "print" });
    await sleep(100);
    const print = await client.send("Runtime.evaluate", {
      expression: metricsExpression(),
      returnByValue: true,
    });
    const printMetrics = print.result.value;
    assertMetrics(testCase.name, "print", printMetrics);

    const pdf = await client.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });
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
    };
  } finally {
    await client.send("Page.close").catch(() => {});
    client.close();
  }
}

async function main() {
  const server = await startStaticServer();
  const { chrome } = startChrome();

  try {
    await getJson(`http://127.0.0.1:${chromePort}/json/version`);
    const rows = [];
    for (const testCase of cases) {
      rows.push(await runCase(testCase));
    }
    console.table(rows);
    console.log(`Vertical layout checks passed for ${rows.length} cases.`);
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
