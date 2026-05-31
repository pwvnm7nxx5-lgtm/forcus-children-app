const APP = {
  id: "weight-print-grade3",
  title: "3年生 重さプリント",
  accent: "#8b5cf6",
  stateVersion: 1,
  defaultType: "conversion",
  defaultCount: 12,
  defaultCols: 2,
};

document.documentElement.style.setProperty("--accent", APP.accent);

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  showHint: document.querySelector("#showHint"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = `${APP.id}-state`;
const problemCountMin = 1;
const problemCountMax = 36;
const columnsMin = 1;
const columnsMax = 6;
const problemTypes = ["conversion", "addition", "subtraction", "comparison", "mixed"];
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
}

function getProblemCount() {
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, APP.defaultCount);
}

function getColumns() {
  return clampNumber(els.columns.value, columnsMin, columnsMax, APP.defaultCols);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || APP.title,
    type: clampChoice(els.problemType.value, problemTypes, APP.defaultType),
    count: getProblemCount(),
    columns: getColumns(),
    showHint: els.showHint.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || APP.title;
  els.problemType.value = clampChoice(settings.type, problemTypes, APP.defaultType);
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, APP.defaultCount));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, APP.defaultCols));
  els.showHint.checked = Boolean(settings.showHint);
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[rand(0, items.length - 1)];
}

function formatKgG(totalG) {
  const kg = Math.floor(totalG / 1000);
  const g = totalG % 1000;
  if (kg === 0) return `${g}g`;
  if (g === 0) return `${kg}kg`;
  return `${kg}kg ${g}g`;
}

function makeWeight({ minKg = 0, maxKg = 5, allowZeroKg = true } = {}) {
  const kg = rand(minKg, maxKg);
  const grams = rand(0, 9) * 100;
  const total = kg * 1000 + grams;
  if (!allowZeroKg && total === 0) return makeWeight({ minKg: 1, maxKg, allowZeroKg });
  return total;
}

function makeConversionProblem() {
  const patterns = [
    () => {
      const totalG = makeWeight({ minKg: 1, maxKg: 6, allowZeroKg: false });
      return {
        prompt: `${formatKgG(totalG)} = □g`,
        answer: `${totalG}g`,
        type: "conversion",
      };
    },
    () => {
      const totalG = rand(11, 69) * 100;
      return {
        prompt: `${totalG}g = □kg □g`,
        answer: formatKgG(totalG),
        type: "conversion",
      };
    },
    () => {
      const kg = rand(1, 9);
      return {
        prompt: `${kg}kg = □g`,
        answer: `${kg * 1000}g`,
        type: "conversion",
      };
    },
  ];
  return pick(patterns)();
}

function makeAdditionProblem() {
  const a = makeWeight({ minKg: 0, maxKg: 4, allowZeroKg: false });
  const b = makeWeight({ minKg: 0, maxKg: 3, allowZeroKg: false });
  return {
    prompt: `${formatKgG(a)} + ${formatKgG(b)} = □`,
    answer: formatKgG(a + b),
    type: "addition",
  };
}

function makeSubtractionProblem() {
  const b = makeWeight({ minKg: 0, maxKg: 4, allowZeroKg: false });
  const diff = rand(2, 35) * 100;
  const a = b + diff;
  return {
    prompt: `${formatKgG(a)} - ${formatKgG(b)} = □`,
    answer: formatKgG(a - b),
    type: "subtraction",
  };
}

function makeComparisonProblem() {
  let a = makeWeight({ minKg: 0, maxKg: 6, allowZeroKg: false });
  let b = makeWeight({ minKg: 0, maxKg: 6, allowZeroKg: false });
  if (a === b) b += 100;
  const answer = a > b ? ">" : a < b ? "<" : "=";
  return {
    prompt: `${formatKgG(a)} □ ${formatKgG(b)}`,
    answer,
    type: "comparison",
  };
}

function makeProblem(settings) {
  const type = settings.type === "mixed" ? pick(["conversion", "addition", "subtraction", "comparison"]) : settings.type;
  if (type === "addition") return makeAdditionProblem();
  if (type === "subtraction") return makeSubtractionProblem();
  if (type === "comparison") return makeComparisonProblem();
  return makeConversionProblem();
}

function problemKey(problem) {
  return `${problem.type}:${problem.prompt}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    count: settings.count,
  });
}

function selectProblemSet(settings, usedKeys = new Set()) {
  const selected = [];
  const seen = new Set();
  let attempts = 0;
  while (selected.length < settings.count && attempts < settings.count * 80) {
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key) && !usedKeys.has(key)) {
      selected.push(problem);
      seen.add(key);
      usedKeys.add(key);
    }
    attempts += 1;
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
  if (options.normalizeCount !== false) els.problemCount.value = String(getProblemCount());
  const settings = getSettings();
  problems = selectProblemSet(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("もんだいをつくりなおしました。");
}

function renderProblem(problem, showAnswer) {
  const card = document.createElement("div");
  card.className = "problem-card";
  const prompt = document.createElement("div");
  prompt.className = "prompt conversion-prompt";
  prompt.textContent = problem.prompt;
  const answerLine = document.createElement("div");
  answerLine.className = "answer-line";
  answerLine.innerHTML = showAnswer
    ? `<span class="answer-value">${problem.answer}</span>`
    : `<span class="blank">□</span><span class="small-note">こたえ</span>`;
  card.append(prompt, answerLine);
  return card;
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) kindLabel.classList.add("answer");
  if (!showAnswer && settings.showHint) {
    const hint = document.createElement("div");
    hint.className = "page-hint";
    hint.textContent = "ヒント: 1kg = 1000g";
    Object.assign(hint.style, {
      margin: "-3mm 0 6mm",
      padding: "2.5mm 4mm",
      border: "1px solid #cfd8e3",
      borderRadius: "6px",
      background: "#f8fafc",
      color: "#344054",
      fontSize: "14px",
      fontWeight: "700",
    });
    page.querySelector(".sheet-header").after(hint);
  }
  const list = page.querySelector("[data-problems]");
  list.style.setProperty("--cols", settings.columns);
  list.style.setProperty("--row-gap", settings.count > 24 ? "4mm" : "7mm");
  list.style.setProperty("--problem-min", settings.count > 24 ? "24mm" : "31mm");
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(renderProblem(problem, showAnswer));
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
    sheetProblemSets.push(problems.length ? problems.slice(0, settings.count) : selectProblemSet(settings));
  }
  const usedKeys = new Set(sheetProblemSets.flat().map(problemKey));
  while (sheetProblemSets.length < sheetCount) {
    sheetProblemSets.push(selectProblemSet(settings, usedKeys));
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
    problems = selectProblemSet(getSettings());
  }
  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
  els.pageCount.textContent = "2枚";
  saveState();
}

function getShareState() {
  return { version: APP.stateVersion, settings: getSettings(), problems };
}

function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
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
  } catch {}
}

function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded?.settings) {
      applySettings(decoded.settings);
      problems = decoded.version === APP.stateVersion && Array.isArray(decoded.problems) ? decoded.problems : [];
      return;
    }
  }
  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      applySettings(parsed.settings);
      if (parsed.version === APP.stateVersion && Array.isArray(parsed.problems)) problems = parsed.problems;
    }
  } catch {}
}

async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("URL欄に共有用データを入れました。");
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  els.problemType.addEventListener("change", generateProblems);
  els.problemCount.addEventListener("change", generateProblems);
  els.columns.addEventListener("input", () => {
    if (els.columns.value !== "") render();
  });
  els.columns.addEventListener("change", render);
  els.showHint.addEventListener("change", render);
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") return;
    els.problemCountPreset.value = "";
    generateProblems({ normalizeCount: false });
  });
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
}

loadInitialState();
bindEvents();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
if (!problems.length) generateProblems();
else render();
