const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  layoutMode: document.querySelector("#layoutMode"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  showCarryBoxes: document.querySelector("#showCarryBoxes"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "math-print-grade3-state-v1";
const problemCountMin = 1;
const horizontalProblemCountMax = 60;
const verticalProblemCountMax = 30;
const columnsMin = 1;
const columnsMax = 6;
const problemTypes = ["add3", "sub3", "mix3", "add4", "sub4", "mixLarge"];
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getActiveLayout() {
  return clampChoice(els.layoutMode.value, ["horizontal", "vertical"], "horizontal");
}

function getProblemCountMax(layout = getActiveLayout()) {
  return layout === "vertical" ? verticalProblemCountMax : horizontalProblemCountMax;
}

function updateProblemCountAvailability(layout = getActiveLayout()) {
  const max = getProblemCountMax(layout);
  els.problemCount.max = String(max);
  Array.from(els.problemCountPreset.options).forEach((option) => {
    if (!option.value) return;
    const disabled = Number.parseInt(option.value, 10) > max;
    option.disabled = disabled;
    option.hidden = disabled;
  });
}

function normalizeProblemCount({ notify = false } = {}) {
  if (els.problemCount.value === "") {
    return 30;
  }
  const max = getProblemCountMax();
  const before = Number.parseInt(els.problemCount.value, 10);
  const count = clampNumber(els.problemCount.value, problemCountMin, max, 30);
  els.problemCount.value = String(count);
  if (notify && Number.isFinite(before) && before > max) {
    setStatus(`筆算は${max}問までにしました。`);
  }
  return count;
}

function getProblemCount() {
  return normalizeProblemCount();
}

function getColumns() {
  return clampNumber(els.columns.value, columnsMin, columnsMax, 3);
}

function normalizeColumns() {
  const columns = getColumns();
  els.columns.value = String(columns);
  return columns;
}

function getSettings() {
  const type = clampChoice(els.problemType.value, problemTypes, "add3");
  const layout = clampChoice(els.layoutMode.value, ["horizontal", "vertical"], "horizontal");

  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "3年生 計算プリント",
    type,
    layout,
    count: getProblemCount(),
    columns: getColumns(),
    showCarryBoxes: els.showCarryBoxes.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }

  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "3年生 計算プリント";
  els.problemType.value = clampChoice(settings.type, problemTypes, "add3");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "vertical"], "horizontal");
  updateLayoutAvailability();
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, getProblemCountMax(), 30));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, 3));
  els.showCarryBoxes.checked = settings.showCarryBoxes !== false;
  updateLayoutAvailability();
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function updateLayoutAvailability() {
  els.showCarryBoxes.disabled = els.layoutMode.value !== "vertical";
  updateProblemCountAvailability();
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeAdditionProblem(digits) {
  const min = digits === 4 ? 1000 : 100;
  const max = digits === 4 ? 9999 : 999;
  const a = rand(min, max);
  const b = rand(min, max);
  return { a, b, op: "+", answer: a + b };
}

function makeSubtractionProblem(digits) {
  const min = digits === 4 ? 1000 : 100;
  const max = digits === 4 ? 9999 : 999;
  const a = rand(min, max);
  const b = rand(min, a);
  return { a, b, op: "-", answer: a - b };
}

function makeProblem(settings) {
  switch (settings.type) {
    case "sub3":
      return makeSubtractionProblem(3);
    case "mix3":
      return Math.random() < 0.5 ? makeAdditionProblem(3) : makeSubtractionProblem(3);
    case "add4":
      return makeAdditionProblem(4);
    case "sub4":
      return makeSubtractionProblem(4);
    case "mixLarge": {
      const maker = [
        () => makeAdditionProblem(3),
        () => makeSubtractionProblem(3),
        () => makeAdditionProblem(4),
        () => makeSubtractionProblem(4),
      ][rand(0, 3)];
      return maker();
    }
    case "add3":
    default:
      return makeAdditionProblem(3);
  }
}

function problemKey(problem) {
  return `${problem.a}${problem.op}${problem.b}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    layout: settings.layout,
    count: settings.count,
  });
}

function selectProblems(settings, usedKeys = new Set()) {
  const selected = [];
  const seen = new Set();
  let attempts = 0;

  while (selected.length < settings.count && attempts < settings.count * 120) {
    attempts += 1;
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key) && !usedKeys.has(key)) {
      selected.push(problem);
      seen.add(key);
      usedKeys.add(key);
    }
  }

  while (selected.length < settings.count) {
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key)) {
      selected.push(problem);
      seen.add(key);
    }
  }

  return selected;
}

function generateProblems(options = {}) {
  const max = getProblemCountMax();
  const countBeforeNormalize = Number.parseInt(els.problemCount.value, 10);
  const countClamped = options.normalizeCount !== false && Number.isFinite(countBeforeNormalize) && countBeforeNormalize > max;
  if (options.normalizeCount !== false) {
    normalizeProblemCount();
  }
  updateLayoutAvailability();
  const settings = getSettings();
  problems = selectProblems(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus(countClamped ? `筆算は${max}問までにしました。` : "もんだいをつくりなおしました。");
}

function makeHorizontalFormula(problem, showAnswer) {
  const span = document.createElement("span");
  span.className = "formula";
  const answer = showAnswer ? `<span class="answer-value">${problem.answer}</span>` : '<span class="blank">□</span>';
  span.innerHTML = `<span>${problem.a} ${problem.op} ${problem.b} =</span>${answer}`;
  return span;
}

function formatDigits(value, width) {
  return String(value).padStart(width, " ").slice(-width).split("");
}

function makeDigitCell(digit, showCarryBoxes, isBlank = false) {
  const cell = document.createElement("span");
  cell.className = "digit-cell";
  if (showCarryBoxes) {
    const helper = document.createElement("span");
    helper.className = "helper-box";
    cell.append(helper);
  }
  if (!isBlank && digit !== " ") {
    const value = document.createElement("span");
    value.className = "digit-value";
    value.textContent = digit;
    cell.append(value);
  }
  return cell;
}

function makeDigitRow(digits, operator = "", showCarryBoxes = true, blank = false) {
  const row = document.createElement("span");
  row.className = "digit-row";

  const op = document.createElement("span");
  op.className = "operator";
  op.textContent = operator;
  row.append(op);

  digits.forEach((digit) => {
    row.append(makeDigitCell(digit, showCarryBoxes, blank));
  });

  return row;
}

function makeVerticalFormula(problem, showAnswer, settings) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const width = Math.max(
    String(problem.a).length,
    String(problem.b).length,
    String(problem.answer).length,
    3,
  );
  formula.append(makeDigitRow(formatDigits(problem.a, width), "", settings.showCarryBoxes));
  formula.append(makeDigitRow(formatDigits(problem.b, width), problem.op, settings.showCarryBoxes));

  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);

  if (showAnswer) {
    formula.append(makeDigitRow(formatDigits(problem.answer, width), "", settings.showCarryBoxes));
  } else {
    formula.append(makeDigitRow(formatDigits("", width), "", settings.showCarryBoxes, true));
  }

  return formula;
}

function makeFormula(problem, showAnswer, settings) {
  if (settings.layout === "vertical") {
    return makeVerticalFormula(problem, showAnswer, settings);
  }
  return makeHorizontalFormula(problem, showAnswer);
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  page.classList.toggle("vertical-layout", settings.layout === "vertical");
  page.classList.toggle("answer-page", showAnswer);

  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) {
    kindLabel.classList.add("answer");
  }

  const list = page.querySelector("[data-problems]");
  list.style.setProperty("--cols", settings.columns);
  applyGridDensity(list, settings);

  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeFormula(problem, showAnswer, settings));
    list.append(item);
  });

  return page;
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
  if (sheetProblemSets.length > sheetCount) {
    sheetProblemSets = sheetProblemSets.slice(0, sheetCount);
  }
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
    if (includeAnswers) {
      pages.push(renderPage(`こたえ${suffix}`, true, set));
    }
  });
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  saveState();
}

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  const vertical = settings.layout === "vertical";
  let rowGap = vertical ? 6 : 8;
  let problemMin = vertical ? 28 : 13;
  let fontSize = vertical ? 24 : 21;
  let blankWidth = 12;
  let blankHeight = 9;

  if (!vertical && rows > 24) {
    rowGap = 1.5;
    problemMin = 5.8;
    fontSize = 16;
    blankWidth = 8;
    blankHeight = 5.5;
  } else if (!vertical && rows > 18) {
    rowGap = 3;
    problemMin = 8.2;
    fontSize = 18;
    blankWidth = 10;
    blankHeight = 7;
  } else if (!vertical && rows > 14) {
    rowGap = 5;
    problemMin = 10.5;
    fontSize = 19;
    blankWidth = 11;
    blankHeight = 8;
  } else if (vertical && rows > 20) {
    rowGap = 3;
    problemMin = 20;
    fontSize = 19;
  } else if (vertical && rows > 14) {
    rowGap = 4;
    problemMin = 23;
    fontSize = 21;
  }

  list.style.setProperty("--row-gap", `${rowGap}mm`);
  list.style.setProperty("--problem-min", `${problemMin}mm`);
  list.style.setProperty("--problem-font", `${fontSize}px`);
  list.style.setProperty("--blank-w", `${blankWidth}mm`);
  list.style.setProperty("--blank-h", `${blankHeight}mm`);
}

function render() {
  updateLayoutAvailability();
  const settings = getSettings();
  if (!problems.length || problems.length < settings.count) {
    problems = selectProblems(settings);
  } else if (problems.length > settings.count) {
    problems = problems.slice(0, settings.count);
  }

  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
  els.pageCount.textContent = "2枚";
  saveState();
}

function getShareState() {
  return {
    settings: getSettings(),
    problems,
  };
}

function encodeState(state) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(value) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(stateStorageKey, JSON.stringify(getShareState()));
  } catch {
    // Local storage can be disabled; the app still works without it.
  }
}

function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded?.settings && Array.isArray(decoded.problems)) {
      applySettings(decoded.settings);
      problems = decoded.problems;
      return;
    }
  }

  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      applySettings(parsed.settings);
      if (Array.isArray(parsed.problems)) {
        problems = parsed.problems;
      }
    }
  } catch {
    // Ignore broken saved state.
  }
}

async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#data=${encoded}`;

  try {
    await navigator.clipboard.writeText(url);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("URL欄に共有用データを入れました。");
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => {
    control.addEventListener("input", render);
  });

  els.problemType.addEventListener("change", generateProblems);
  els.problemCount.addEventListener("change", generateProblems);
  els.layoutMode.addEventListener("change", () => {
    updateLayoutAvailability();
    generateProblems();
  });
  els.columns.addEventListener("input", () => {
    if (els.columns.value === "") {
      return;
    }
    render();
  });
  els.columns.addEventListener("change", () => {
    normalizeColumns();
    render();
  });
  els.showCarryBoxes.addEventListener("change", render);
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") {
      return;
    }
    els.problemCountPreset.value = "";
    generateProblems({ normalizeCount: false });
  });
  els.problemCountPreset.addEventListener("change", () => {
    if (!els.problemCountPreset.value) {
      return;
    }
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
}

loadInitialState();
bindEvents();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
if (!problems.length) {
  generateProblems();
} else {
  render();
}
