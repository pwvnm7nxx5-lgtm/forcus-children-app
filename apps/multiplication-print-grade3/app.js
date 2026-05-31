const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  showCarryBoxes: document.querySelector("#showCarryBoxes"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "multiplication-print-grade3-state-v3";
const problemCountMin = 1;
const problemCountMax = 40;
const verticalDigitWidth = 4;
const columnsMin = 1;
const columnsMax = 6;
const problemTypes = ["twoByOne", "threeByOne", "twoByTwo", "mixed"];
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

function getProblemCount() {
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, 16);
}

function getColumns() {
  return clampNumber(els.columns.value, columnsMin, columnsMax, 2);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "3年生 かけ算の筆算プリント",
    type: clampChoice(els.problemType.value, problemTypes, "twoByOne"),
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
  els.worksheetTitle.value = settings.title || "3年生 かけ算の筆算プリント";
  els.problemType.value = clampChoice(settings.type, problemTypes, "twoByOne");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, 16));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, 2));
  els.showCarryBoxes.checked = settings.showCarryBoxes !== false;
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function createProblem(a, b, type) {
  return {
    a,
    b,
    type,
    answer: a * b,
  };
}

function makeTwoByOneCandidates() {
  const candidates = [];
  for (let a = 12; a <= 99; a += 1) {
    for (let b = 2; b <= 9; b += 1) {
      candidates.push(createProblem(a, b, "twoByOne"));
    }
  }
  return candidates;
}

function makeThreeByOneCandidates() {
  const candidates = [];
  for (let a = 101; a <= 999; a += 1) {
    for (let b = 2; b <= 9; b += 1) {
      candidates.push(createProblem(a, b, "threeByOne"));
    }
  }
  return candidates;
}

function makeTwoByTwoCandidates() {
  const candidates = [];
  for (let a = 12; a <= 99; a += 1) {
    for (let b = 11; b <= 99; b += 1) {
      candidates.push(createProblem(a, b, "twoByTwo"));
    }
  }
  return candidates;
}

function makeCandidatePool(settings) {
  if (settings.type === "threeByOne") {
    return makeThreeByOneCandidates();
  }
  if (settings.type === "twoByTwo") {
    return makeTwoByTwoCandidates();
  }
  if (settings.type === "mixed") {
    return [
      ...makeTwoByOneCandidates(),
      ...makeThreeByOneCandidates(),
      ...makeTwoByTwoCandidates(),
    ];
  }
  return makeTwoByOneCandidates();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function problemKey(problem) {
  return `${problem.a}x${problem.b}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    count: settings.count,
  });
}

function selectProblems(settings, usedKeys = new Set()) {
  const pool = shuffle(makeCandidatePool(settings));
  const selected = [];
  const seen = new Set();

  pool.forEach((problem) => {
    if (selected.length >= settings.count) {
      return;
    }
    const key = problemKey(problem);
    if (!seen.has(key) && !usedKeys.has(key)) {
      selected.push(problem);
      seen.add(key);
      usedKeys.add(key);
    }
  });

  pool.forEach((problem) => {
    if (selected.length >= settings.count) {
      return;
    }
    const key = problemKey(problem);
    if (!seen.has(key)) {
      selected.push(problem);
      seen.add(key);
    }
  });

  while (selected.length < settings.count && pool.length > 0) {
    selected.push(pool[selected.length % pool.length]);
  }

  return selected;
}

function generateProblems(options = {}) {
  if (options.normalizeCount !== false) {
    els.problemCount.value = String(getProblemCount());
  }
  const settings = getSettings();
  problems = selectProblems(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("問題を作り直しました。");
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

function makeDigitRow(digits, operator, showCarryBoxes, blank = false) {
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

function problemWidth(settings) {
  return verticalDigitWidth;
}

function multiplierDigits(problem) {
  return String(problem.b).split("").reverse().map((digit) => Number.parseInt(digit, 10));
}

function makeVerticalFormula(problem, showAnswer, settings) {
  const width = problemWidth(settings);
  const steps = multiplierDigits(problem);
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  formula.style.setProperty("--step-count", String(steps.length));
  formula.style.setProperty("--digit-count", String(width));

  formula.append(makeDigitRow(formatDigits(problem.a, width), "", settings.showCarryBoxes));
  formula.append(makeDigitRow(formatDigits(problem.b, width), "×", settings.showCarryBoxes));

  const line = document.createElement("span");
  line.className = steps.length > 1 ? "vertical-line subtotal-line" : "vertical-line answer-line";
  formula.append(line);

  if (steps.length > 1) {
    steps.forEach((digit) => {
      const value = problem.a * digit;
      formula.append(makeDigitRow(formatDigits(showAnswer ? value : "", width), "", settings.showCarryBoxes, !showAnswer));
    });

    const answerLine = document.createElement("span");
    answerLine.className = "vertical-line answer-line";
    formula.append(answerLine);
  }

  if (showAnswer) {
    formula.append(makeDigitRow(formatDigits(problem.answer, width), "", settings.showCarryBoxes));
  } else {
    formula.append(makeDigitRow(formatDigits("", width), "", settings.showCarryBoxes, true));
  }

  return formula;
}

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  let rowGap = 5;
  let problemMin = 35;
  let fontSize = 18;

  if (rows > 16) {
    rowGap = 2;
    problemMin = 25;
    fontSize = 14;
  } else if (rows > 12) {
    rowGap = 3;
    problemMin = 29;
    fontSize = 15;
  } else if (rows > 8) {
    rowGap = 4;
    problemMin = 32;
    fontSize = 16;
  }

  list.style.setProperty("--row-gap", `${rowGap}mm`);
  list.style.setProperty("--problem-min", `${problemMin}mm`);
  list.style.setProperty("--problem-font", `${fontSize}px`);
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;

  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) {
    page.classList.add("answer-page");
    kindLabel.classList.add("answer");
  }

  const list = page.querySelector("[data-problems]");
  list.style.setProperty("--cols", settings.columns);
  applyGridDensity(list, settings);

  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeVerticalFormula(problem, showAnswer, settings));
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

function render() {
  if (!problems.length) {
    problems = selectProblems(getSettings());
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

function saveState() {
  try {
    localStorage.setItem(stateStorageKey, JSON.stringify(getShareState()));
  } catch {
    // The app still works without localStorage.
  }
}

function loadInitialState() {
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

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => {
    control.addEventListener("input", render);
  });

  els.problemType.addEventListener("change", generateProblems);
  els.columns.addEventListener("change", render);
  els.columns.addEventListener("input", render);
  els.showCarryBoxes.addEventListener("change", render);
  els.problemCount.addEventListener("change", generateProblems);
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
