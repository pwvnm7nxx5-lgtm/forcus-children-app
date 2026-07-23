const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "division-print-grade4-state-v2";
const divisionTypeConfig = {
  zeroQuotient: { digits: 3, mode: "zeroQuotient" },
  noRemainder: { digits: 3, mode: "noRemainder" },
  withRemainder: { digits: 3, mode: "withRemainder" },
  mixed: { mixedTypes: ["zeroQuotient", "noRemainder", "withRemainder"] },
  twoDigitNoRemainder: { digits: 2, mode: "noRemainder" },
  twoDigitWithRemainder: { digits: 2, mode: "withRemainder" },
  twoDigitMixed: { mixedTypes: ["twoDigitNoRemainder", "twoDigitWithRemainder"] },
};
const allowedTypes = Object.keys(divisionTypeConfig);
const problemCountMin = 1;
const problemCountMax = 24;
const columnsMin = 1;
const columnsMax = 6;
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "4年生 わり算の筆算",
    type: clampChoice(els.problemType.value, allowedTypes, "twoDigitNoRemainder"),
    count: clampNumber(els.problemCount.value, problemCountMin, problemCountMax, 9),
    columns: clampNumber(els.columns.value, columnsMin, columnsMax, 3),
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "4年生 わり算の筆算";
  els.problemType.value = clampChoice(settings.type, allowedTypes, "twoDigitNoRemainder");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, 9));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, 3));
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function makeCandidates(type) {
  const config = divisionTypeConfig[type];
  if (!config?.digits) return [];

  const candidates = [];
  const minDividend = 10 ** (config.digits - 1);
  const maxDividend = 10 ** config.digits - 1;
  const minQuotient = config.digits === 2 ? 10 : 100;
  for (let divisor = 2; divisor <= 9; divisor += 1) {
    const maxQuotient = Math.floor(maxDividend / divisor);
    for (let quotient = minQuotient; quotient <= maxQuotient; quotient += 1) {
      const tensDigit = Math.floor(quotient / 10) % 10;
      if (tensDigit === 0) continue;

      if (config.mode === "zeroQuotient") {
        if (quotient % 10 !== 0) continue;
        for (let remainder = 1; remainder < divisor; remainder += 1) {
          const dividend = divisor * quotient + remainder;
          if (dividend >= minDividend && dividend <= maxDividend) candidates.push({ dividend, divisor, quotient, remainder, type });
        }
      } else if (config.mode === "noRemainder") {
        const dividend = divisor * quotient;
        if (dividend >= minDividend && dividend <= maxDividend) candidates.push({ dividend, divisor, quotient, remainder: 0, type });
      } else {
        for (let remainder = 1; remainder < divisor; remainder += 1) {
          const dividend = divisor * quotient + remainder;
          if (dividend >= minDividend && dividend <= maxDividend) candidates.push({ dividend, divisor, quotient, remainder, type });
        }
      }
    }
  }
  return candidates;
}

function makeCandidatePool(type) {
  const config = divisionTypeConfig[type];
  if (!config?.mixedTypes) return makeCandidates(type);
  const groups = config.mixedTypes.map(makeCandidates);
  const mixed = [];
  const maxLength = Math.max(...groups.map((group) => group.length));
  for (let index = 0; index < maxLength; index += 1) {
    groups.forEach((group) => {
      if (group[index]) mixed.push(group[index]);
    });
  }
  return mixed;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function problemKey(problem) {
  return `${problem.dividend}/${problem.divisor}`;
}

function selectProblems(settings, usedKeys = new Set()) {
  const pool = shuffle(makeCandidatePool(settings.type));
  const selected = [];
  const localKeys = new Set();

  for (const problem of pool) {
    if (selected.length >= settings.count) break;
    const key = problemKey(problem);
    if (usedKeys.has(key) || localKeys.has(key)) continue;
    selected.push(problem);
    usedKeys.add(key);
    localKeys.add(key);
  }

  for (const problem of pool) {
    if (selected.length >= settings.count) break;
    const key = problemKey(problem);
    if (localKeys.has(key)) continue;
    selected.push(problem);
    localKeys.add(key);
  }
  return selected;
}

function buildLongDivisionTrace(problem) {
  const dividendDigits = String(problem.dividend).split("").map(Number);
  const quotientDigits = String(problem.quotient).split("").map(Number);
  const quotientOffset = dividendDigits.length - quotientDigits.length;
  const rows = [];
  let remainder = 0;
  let started = false;

  dividendDigits.forEach((digit, index) => {
    const current = remainder * 10 + digit;
    const quotientDigit = Math.floor(current / problem.divisor);
    if (!started && quotientDigit === 0) {
      remainder = current;
      return;
    }
    started = true;

    if (quotientDigit === 0) {
      const previous = rows.at(-1);
      if (index === dividendDigits.length - 1 && previous?.kind === "partial" && previous.endIndex === index) {
        previous.kind = "remainder";
      } else {
        rows.push({ value: current, endIndex: index, kind: index === dividendDigits.length - 1 ? "remainder" : "partial" });
      }
      remainder = current;
      return;
    }

    const product = quotientDigit * problem.divisor;
    rows.push({ value: product, endIndex: index, kind: "product", lineAfter: true });
    remainder = current - product;

    if (index < dividendDigits.length - 1) {
      rows.push({ value: remainder * 10 + dividendDigits[index + 1], endIndex: index + 1, kind: "partial" });
    } else {
      rows.push({ value: remainder, endIndex: index, kind: "remainder" });
    }
  });

  return { dividendDigits, quotientDigits, quotientOffset, rows };
}

function addGridCells(board, rowCount, boardColumns) {
  for (let row = 1; row <= rowCount; row += 1) {
    for (let column = 1; column <= boardColumns; column += 1) {
      const cell = document.createElement("span");
      cell.className = "board-cell";
      cell.style.gridRow = String(row);
      cell.style.gridColumn = String(column);
      board.append(cell);
    }
  }
}

function addDigit(board, value, row, column, className) {
  const digit = document.createElement("span");
  digit.className = `board-digit ${className}`;
  digit.textContent = String(value);
  digit.style.gridRow = String(row);
  digit.style.gridColumn = String(column);
  board.append(digit);
}

function addAlignedNumber(board, value, row, endIndex, className) {
  const digits = String(value).split("");
  const startIndex = endIndex - digits.length + 1;
  digits.forEach((digit, index) => {
    addDigit(board, digit, row, startIndex + index + 2, className);
  });
}

function addDivisionFrame(board, boardColumns) {
  const frame = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  frame.classList.add("division-frame");
  frame.setAttribute("viewBox", `0 0 ${boardColumns * 100} 100`);
  frame.setAttribute("preserveAspectRatio", "none");
  frame.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${boardColumns * 100} 1 H 76 C 96 13, 96 87, 76 99`);
  path.setAttribute("vector-effect", "non-scaling-stroke");
  frame.append(path);
  board.append(frame);
}

function makeLongDivisionBoard(problem, showAnswer, boardRows) {
  const trace = buildLongDivisionTrace(problem);
  const boardColumns = trace.dividendDigits.length + 1;
  const board = document.createElement("span");
  board.className = "vertical-formula long-division-board";
  board.style.setProperty("--board-rows", String(boardRows));
  board.style.setProperty("--board-columns", String(boardColumns));
  addGridCells(board, boardRows, boardColumns);
  addDivisionFrame(board, boardColumns);

  addDigit(board, problem.divisor, 2, 1, "given-digit divisor-digit");
  trace.dividendDigits.forEach((digit, index) => addDigit(board, digit, 2, index + 2, "given-digit"));

  if (showAnswer) {
    trace.quotientDigits.forEach((digit, index) => {
      addDigit(board, digit, 1, trace.quotientOffset + index + 2, "answer-digit quotient-digit");
    });

    trace.rows.forEach((traceRow, index) => {
      const row = index + 3;
      addAlignedNumber(board, traceRow.value, row, traceRow.endIndex, "answer-digit work-digit");
      if (traceRow.lineAfter) {
        const line = document.createElement("span");
        line.className = "work-line";
        line.style.gridRow = String(row);
        line.style.gridColumn = `2 / ${boardColumns + 1}`;
        board.append(line);
      }
    });
  }
  return board;
}

function getBoardRows(pageProblems) {
  return Math.max(6, ...pageProblems.map((problem) => buildLongDivisionTrace(problem).rows.length + 2));
}

function applyGridDensity(list, settings, boardRows, boardColumns) {
  const problemRows = Math.ceil(settings.count / settings.columns);
  const landscape = document.querySelector("#printOrientation")?.value === "landscape";
  const contentWidth = landscape ? 273 : 186;
  const contentHeight = landscape ? 156 : 235;
  const problemWidth = (contentWidth - Math.max(0, settings.columns - 1) * 6) / settings.columns;
  const widthCell = (problemWidth - 7) / boardColumns;
  const heightCell = (contentHeight - Math.max(0, problemRows - 1) * 5) / Math.max(1, problemRows) / boardRows;
  const layoutCellCap = Math.max(4.2, Math.min(widthCell, heightCell));
  const cellSize = Math.min(12.5, layoutCellCap);
  list.style.setProperty("--cols", String(settings.columns));
  list.style.setProperty("--digit-size", `${cellSize.toFixed(2)}mm`);
  list.style.setProperty("--layout-cell-cap", `${layoutCellCap.toFixed(2)}mm`);
  list.style.setProperty("--problem-row-gap", `${problemRows > 3 ? 3 : 5}mm`);
  list.dataset.columns = String(settings.columns);
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.classList.toggle("answer-page", showAnswer);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) kindLabel.classList.add("answer");

  const boardRows = getBoardRows(pageProblems);
  const boardColumns = Math.max(...pageProblems.map((problem) => String(problem.dividend).length + 1));
  const list = page.querySelector("[data-problems]");
  applyGridDensity(list, settings, boardRows, boardColumns);
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeLongDivisionBoard(problem, showAnswer, boardRows));
    list.append(item);
  });
  return page;
}

function sheetSignature(settings) {
  return JSON.stringify({ type: settings.type, count: settings.count });
}

function ensureSheetProblemSets(sheetCount) {
  const settings = getSettings();
  const signature = sheetSignature(settings);
  if (sheetSetSignature !== signature) {
    sheetProblemSets = [];
    sheetSetSignature = signature;
  }
  if (!sheetProblemSets.length) {
    sheetProblemSets.push(problems.length ? problems.slice(0, settings.count) : selectProblems(settings));
  }
  const usedKeys = new Set(sheetProblemSets.flat().map(problemKey));
  while (sheetProblemSets.length < sheetCount) {
    sheetProblemSets.push(selectProblems(settings, usedKeys));
  }
  sheetProblemSets = sheetProblemSets.slice(0, sheetCount);
  problems = sheetProblemSets[0] || problems;
  return sheetProblemSets;
}

function renderSheetPages(sheetCount, includeAnswers) {
  const count = clampNumber(sheetCount, 1, 30, 1);
  const sets = ensureSheetProblemSets(count);
  const pages = [];
  sets.forEach((set, index) => {
    const suffix = count > 1 ? ` ${index + 1}` : "";
    pages.push(renderPage(`もんだい${suffix}`, false, set));
    if (includeAnswers) pages.push(renderPage(`こたえ${suffix}`, true, set));
  });
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  saveState();
}

function render() {
  if (!problems.length) problems = selectProblems(getSettings());
  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
  els.pageCount.textContent = "2枚";
  saveState();
  window.__printAdjustmentsRefresh?.();
}

function generateProblems(options = {}) {
  if (options.normalizeCount !== false) {
    els.problemCount.value = String(getSettings().count);
  }
  problems = selectProblems(getSettings());
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("問題を作り直しました。");
}

function getShareState() {
  return { settings: getSettings(), problems };
}

function encodeShareState(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeShareState(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

function saveState() {
  try {
    localStorage.setItem(stateStorageKey, JSON.stringify(getShareState()));
  } catch {
    // The app remains usable when storage is unavailable.
  }
}

function loadInitialState() {
  try {
    const shared = new URLSearchParams(location.search).get("state");
    const parsed = shared ? decodeShareState(shared) : JSON.parse(localStorage.getItem(stateStorageKey) || "null");
    if (!parsed) return;
    applySettings(parsed.settings);
    if (Array.isArray(parsed.problems)) problems = parsed.problems;
  } catch {
    // Ignore invalid saved or shared state.
  }
}

async function copyShareUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("state", encodeShareState(getShareState()));
  try {
    await navigator.clipboard.writeText(url.href);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.prompt("共有URL", url.href);
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  els.problemType.addEventListener("change", generateProblems);
  els.columns.addEventListener("input", render);
  els.columns.addEventListener("change", render);
  els.problemCount.addEventListener("input", () => {
    if (!els.problemCount.value) return;
    els.problemCountPreset.value = "";
    generateProblems({ normalizeCount: false });
  });
  els.problemCount.addEventListener("change", generateProblems);
  els.problemCountPreset.addEventListener("change", () => {
    if (!els.problemCountPreset.value) return;
    els.problemCount.value = els.problemCountPreset.value;
    generateProblems();
    els.problemCountPreset.value = "";
  });
  els.printBtn.addEventListener("click", () => {
    render();
    window.print();
  });
  els.regenerateBtn.addEventListener("click", generateProblems);
  els.copyLinkBtn.addEventListener("click", copyShareUrl);
  window.addEventListener("load", () => {
    document.querySelector("#printOrientation")?.addEventListener("change", () => window.requestAnimationFrame(render));
  });
}

loadInitialState();
bindEvents();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
window.__grade4DivisionTest = { buildLongDivisionTrace, makeCandidatePool, divisionTypeConfig };
if (!problems.length) generateProblems();
else render();
