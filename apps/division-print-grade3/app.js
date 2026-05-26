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
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "division-print-grade3-state-v1";
const problemCountMin = 1;
const problemCountMax = 60;
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
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, 20);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "3年生 わり算プリント",
    type: clampChoice(els.problemType.value, ["basic", "noRemainder", "withRemainder"], "basic"),
    count: getProblemCount(),
    columns: Number.parseInt(clampChoice(els.columns.value, ["1", "2", "3"], "2"), 10),
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }

  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "3年生 わり算プリント";
  els.problemType.value = clampChoice(settings.type, ["basic", "noRemainder", "withRemainder"], "basic");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, 20));
  els.problemCountPreset.value = "";
  els.columns.value = clampChoice(settings.columns, ["1", "2", "3"], "2");
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function markProblemsStale() {
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("問題数を変えました。問題を変えるには「作り直す」を押してください。");
}

function makeBasicCandidates() {
  const candidates = [];
  for (let divisor = 2; divisor <= 9; divisor += 1) {
    for (let quotient = 1; quotient <= 9; quotient += 1) {
      candidates.push({
        dividend: divisor * quotient,
        divisor,
        quotient,
        remainder: 0,
      });
    }
  }
  return candidates;
}

function makeNoRemainderCandidates() {
  const candidates = [];
  for (let divisor = 2; divisor <= 9; divisor += 1) {
    for (let quotient = 2; quotient <= 12; quotient += 1) {
      candidates.push({
        dividend: divisor * quotient,
        divisor,
        quotient,
        remainder: 0,
      });
    }
  }
  return candidates;
}

function makeWithRemainderCandidates() {
  const candidates = [];
  for (let divisor = 2; divisor <= 9; divisor += 1) {
    for (let quotient = 2; quotient <= 12; quotient += 1) {
      for (let remainder = 1; remainder < divisor; remainder += 1) {
        candidates.push({
          dividend: divisor * quotient + remainder,
          divisor,
          quotient,
          remainder,
        });
      }
    }
  }
  return candidates;
}

function makeCandidatePool(settings) {
  if (settings.type === "withRemainder") {
    return makeWithRemainderCandidates();
  }
  if (settings.type === "noRemainder") {
    return makeNoRemainderCandidates();
  }
  return makeBasicCandidates();
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
  return `${problem.dividend}/${problem.divisor}`;
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

function formatAnswer(problem) {
  if (problem.remainder > 0) {
    return `${problem.quotient} あまり ${problem.remainder}`;
  }
  return String(problem.quotient);
}

function makeFormula(problem, showAnswer) {
  const card = document.createElement("span");
  card.className = "problem-card";

  const formula = document.createElement("span");
  formula.className = "formula";
  formula.textContent = `${problem.dividend} ÷ ${problem.divisor} =`;
  card.append(formula);

  const answerLine = document.createElement("span");
  answerLine.className = "answer-line";
  if (problem.remainder > 0) {
    answerLine.classList.add("has-remainder");
  }
  if (showAnswer) {
    const answer = document.createElement("span");
    answer.className = "answer-value";
    answer.textContent = formatAnswer(problem);
    answerLine.append(answer);
  } else {
    const blank = document.createElement("span");
    blank.className = "blank";
    blank.textContent = "答え";
    answerLine.append(blank);
    if (problem.remainder > 0) {
      const note = document.createElement("span");
      note.className = "answer-note";
      note.textContent = "あまり";
      answerLine.append(note);
      const remainderBlank = document.createElement("span");
      remainderBlank.className = "blank remainder-blank";
      remainderBlank.textContent = "あまり";
      answerLine.append(remainderBlank);
    }
  }
  card.append(answerLine);
  return card;
}

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  let rowGap = 7;
  let problemMin = 30;
  let fontSize = 21;
  let blankWidth = 28;
  let blankHeight = 8;

  if (rows > 24) {
    rowGap = 2;
    problemMin = 14;
    fontSize = 16;
    blankWidth = 20;
    blankHeight = 6;
  } else if (rows > 18) {
    rowGap = 3;
    problemMin = 18;
    fontSize = 17;
    blankWidth = 22;
    blankHeight = 7;
  } else if (rows > 12) {
    rowGap = 4;
    problemMin = 23;
    fontSize = 19;
    blankWidth = 24;
    blankHeight = 7.5;
  }

  list.style.setProperty("--row-gap", `${rowGap}mm`);
  list.style.setProperty("--problem-min", `${problemMin}mm`);
  list.style.setProperty("--problem-font", `${fontSize}px`);
  list.style.setProperty("--blank-width", `${blankWidth}mm`);
  list.style.setProperty("--blank-height", `${blankHeight}mm`);
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
    kindLabel.classList.add("answer");
  }

  const list = page.querySelector("[data-problems]");
  list.style.setProperty("--cols", settings.columns);
  applyGridDensity(list, settings);

  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeFormula(problem, showAnswer));
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
  els.problemCount.addEventListener("change", markProblemsStale);
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") {
      return;
    }
    els.problemCountPreset.value = "";
    markProblemsStale();
  });
  els.problemCountPreset.addEventListener("change", () => {
    if (!els.problemCountPreset.value) {
      return;
    }
    els.problemCount.value = els.problemCountPreset.value;
    markProblemsStale();
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
