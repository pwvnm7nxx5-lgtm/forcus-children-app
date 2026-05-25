const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  difficulty: document.querySelector("#difficulty"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  includeZero: document.querySelector("#includeZero"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "math-print-grade1-state";
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
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, 40);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "1年生 計算プリント",
    type: clampChoice(els.problemType.value, ["add", "sub", "mix"], "mix"),
    difficulty: clampChoice(els.difficulty.value, ["ten", "twenty", "bridge"], "bridge"),
    count: getProblemCount(),
    columns: Number.parseInt(clampChoice(els.columns.value, ["2", "3"], "3"), 10),
    includeZero: els.includeZero.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }

  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "1年生 計算プリント";
  els.problemType.value = clampChoice(settings.type, ["add", "sub", "mix"], "mix");
  els.difficulty.value = clampChoice(settings.difficulty, ["ten", "twenty", "bridge"], "bridge");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, 40));
  els.problemCountPreset.value = "";
  els.columns.value = clampChoice(settings.columns, ["2", "3"], "3");
  els.includeZero.checked = Boolean(settings.includeZero);
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
  setStatus("設定を変えました。問題を変えるには「作り直す」を押してください。");
}

function makeCandidatePool(settings) {
  const ops = settings.type === "mix" ? ["+", "-"] : [settings.type === "add" ? "+" : "-"];
  const candidates = [];
  ops.forEach((op) => {
    if (op === "+") {
      candidates.push(...makeAdditionCandidates(settings));
    } else {
      candidates.push(...makeSubtractionCandidates(settings));
    }
  });
  return candidates;
}

function makeAdditionCandidates(settings) {
  const min = settings.includeZero ? 0 : 1;
  const max = settings.difficulty === "ten" ? 10 : 20;
  const candidates = [];

  for (let a = min; a <= max; a += 1) {
    for (let b = min; b <= max; b += 1) {
      const answer = a + b;
      if (settings.difficulty === "ten" && answer > 10) {
        continue;
      }
      if (answer > 20) {
        continue;
      }
      if (settings.difficulty === "bridge" && (a % 10) + (b % 10) < 10) {
        continue;
      }
      candidates.push({ a, b, op: "+", answer });
    }
  }

  return candidates;
}

function makeSubtractionCandidates(settings) {
  const minAnswer = settings.includeZero ? 0 : 1;
  const max = settings.difficulty === "ten" ? 10 : 20;
  const candidates = [];

  for (let a = 0; a <= max; a += 1) {
    for (let b = 0; b <= a; b += 1) {
      const answer = a - b;
      if (!settings.includeZero && (a === 0 || b === 0)) {
        continue;
      }
      if (answer < minAnswer) {
        continue;
      }
      if (settings.difficulty === "bridge") {
        const borrows = a > 10 && b > (a % 10) && b < 10;
        if (!borrows) {
          continue;
        }
      }
      candidates.push({ a, b, op: "-", answer });
    }
  }

  return candidates;
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
  return `${problem.a}${problem.op}${problem.b}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    difficulty: settings.difficulty,
    count: settings.count,
    includeZero: settings.includeZero,
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
  setStatus("もんだいをつくりなおしました。");
}

function makeFormula(problem, showAnswer) {
  const span = document.createElement("span");
  span.className = "formula";
  const answer = showAnswer ? `<span class="answer-value">${problem.answer}</span>` : '<span class="blank">□</span>';
  span.innerHTML = `<span>${problem.a} ${problem.op} ${problem.b} =</span>${answer}`;
  return span;
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

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  let rowGap = 8;
  let problemMin = 13;
  let fontSize = 21;
  let blankWidth = 12;
  let blankHeight = 9;

  if (rows > 24) {
    rowGap = 1.5;
    problemMin = 5.8;
    fontSize = 16;
    blankWidth = 8;
    blankHeight = 5.5;
  } else if (rows > 18) {
    rowGap = 3;
    problemMin = 8.2;
    fontSize = 18;
    blankWidth = 10;
    blankHeight = 7;
  } else if (rows > 14) {
    rowGap = 5;
    problemMin = 10.5;
    fontSize = 19;
    blankWidth = 11;
    blankHeight = 8;
  }

  list.style.setProperty("--row-gap", `${rowGap}mm`);
  list.style.setProperty("--problem-min", `${problemMin}mm`);
  list.style.setProperty("--problem-font", `${fontSize}px`);
  list.style.setProperty("--blank-w", `${blankWidth}mm`);
  list.style.setProperty("--blank-h", `${blankHeight}mm`);
}

function render() {
  if (!problems.length) {
    problems = makeCandidatePool(getSettings()).slice(0, getSettings().count);
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

  [els.problemType, els.difficulty, els.problemCount, els.includeZero].forEach((control) => {
    control.addEventListener("change", markProblemsStale);
  });
  els.columns.addEventListener("change", render);
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
