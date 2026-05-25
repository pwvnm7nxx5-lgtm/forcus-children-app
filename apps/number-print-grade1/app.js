const APP = {
  id: "number-print-grade1",
  title: "1年生 かずプリント",
  accent: "#0f766e",
  stateVersion: 2,
  defaultCount: 12,
  defaultCols: 2,
};

document.documentElement.style.setProperty("--accent", APP.accent);

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  range: document.querySelector("#range"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  problemScale: document.querySelector("#problemScale"),
  problemSpacing: document.querySelector("#problemSpacing"),
  includeAnswers: document.querySelector("#includeAnswers"),
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

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[rand(0, items.length - 1)];
}

function getProblemCount() {
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, APP.defaultCount);
}

function getMaxNumber(range) {
  if (range === "hundred") return 100;
  if (range === "twenty") return 20;
  return 10;
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || APP.title,
    type: clampChoice(els.problemType.value, ["count", "order", "compare"], "count"),
    range: clampChoice(els.range.value, ["ten", "twenty", "hundred"], "ten"),
    count: getProblemCount(),
    columns: Number.parseInt(clampChoice(els.columns.value, ["1", "2", "3"], String(APP.defaultCols)), 10),
    problemScale: clampChoice(els.problemScale.value, ["compact", "normal", "large"], "normal"),
    problemSpacing: clampChoice(els.problemSpacing.value, ["tight", "normal", "wide"], "normal"),
    includeAnswers: els.includeAnswers.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || APP.title;
  els.problemType.value = clampChoice(settings.type, ["count", "order", "compare"], "count");
  els.range.value = clampChoice(settings.range, ["ten", "twenty", "hundred"], "ten");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, APP.defaultCount));
  els.problemCountPreset.value = "";
  els.columns.value = clampChoice(settings.columns, ["1", "2", "3"], String(APP.defaultCols));
  els.problemScale.value = clampChoice(settings.problemScale, ["compact", "normal", "large"], "normal");
  els.problemSpacing.value = clampChoice(settings.problemSpacing, ["tight", "normal", "wide"], "normal");
  els.includeAnswers.checked = settings.includeAnswers !== false;
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

function dotVisual(count) {
  const rows = [];
  for (let start = 0; start < count; start += 5) {
    const dots = Array.from({ length: Math.min(5, count - start) }, () => `<span class="dot"></span>`).join("");
    rows.push(`<span class="dot-group">${dots}</span>`);
  }
  return `<div class="dot-row" aria-label="${count}こ">${rows.join("")}</div>`;
  const dots = Array.from({ length: count }, () => `<span class="dot"></span>`).join("");
  return `<div class="dot-row" aria-label="${count}こ">${dots}</div>`;
}

function makeCountProblem(settings) {
  const max = settings.range === "hundred" ? 99 : getMaxNumber(settings.range);
  const value = rand(1, max);
  if (value <= 20) {
    return { prompt: "いくつありますか。", answer: `${value}`, visual: dotVisual(value) };
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return {
    prompt: `10のまとまりが ${tens}こ、ばらが ${ones}こ。いくつですか。`,
    answer: `${value}`,
    visual: "",
  };
}

function makeOrderProblem(settings) {
  const max = getMaxNumber(settings.range);
  const value = rand(2, max - 1);
  const pattern = pick(["before", "middle", "after"]);
  if (pattern === "before") return { prompt: `□、${value}、${value + 1}`, answer: `${value - 1}`, visual: "" };
  if (pattern === "after") return { prompt: `${value - 1}、${value}、□`, answer: `${value + 1}`, visual: "" };
  return { prompt: `${value - 1}、□、${value + 1}`, answer: `${value}`, visual: "" };
}

function makeCompareProblem(settings) {
  const max = getMaxNumber(settings.range);
  let a = rand(1, max);
  let b = rand(1, max);
  while (a === b) {
    b = rand(1, max);
  }
  return {
    prompt: `${a} と ${b} をくらべて、おおきいほうをかきましょう。`,
    answer: `${Math.max(a, b)}`,
    visual: "",
  };
}

function makeProblem(settings) {
  const type = settings.type;
  if (type === "order") return makeOrderProblem(settings);
  if (type === "compare") return makeCompareProblem(settings);
  return makeCountProblem(settings);
}

function problemKey(problem) {
  return `${problem.prompt}|${problem.answer}|${problem.visual || ""}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    range: settings.range,
    count: settings.count,
    columns: settings.columns,
    problemScale: settings.problemScale,
  });
}

function selectProblems(settings, usedKeys = new Set()) {
  const selected = [];
  const seen = new Set();
  let attempts = 0;
  while (selected.length < settings.count && attempts < settings.count * 30) {
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key) && !usedKeys.has(key)) {
      selected.push(problem);
      seen.add(key);
      usedKeys.add(key);
    }
    attempts += 1;
  }
  while (selected.length < settings.count && attempts < settings.count * 60) {
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key)) {
      selected.push(problem);
      seen.add(key);
    }
    attempts += 1;
  }
  return selected;
}

function generateProblems(options = {}) {
  if (options.normalizeCount !== false) els.problemCount.value = String(getProblemCount());
  const settings = getSettings();
  problems = selectProblems(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("もんだいをつくりなおしました。");
}

function renderProblem(problem, showAnswer) {
  const card = document.createElement("div");
  card.className = "problem-card";
  const prompt = document.createElement("div");
  prompt.className = "prompt";
  prompt.textContent = problem.prompt;
  const visual = document.createElement("div");
  visual.className = "visual";
  visual.innerHTML = problem.visual || "";
  const answerLine = document.createElement("div");
  answerLine.className = "answer-line";
  answerLine.innerHTML = showAnswer ? `<span class="answer-value">${problem.answer}</span>` : `<span class="blank">□</span><span class="small-note">こたえ</span>`;
  card.append(prompt, visual, answerLine);
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
  const list = page.querySelector("[data-problems]");
  const scaleMap = { compact: 0.88, normal: 1, large: 1.18 };
  const spacingMap = { tight: 0.72, normal: 1, wide: 1.35 };
  const scale = scaleMap[settings.problemScale] || 1;
  const spacing = spacingMap[settings.problemSpacing] || 1;
  const baseRowGap = settings.count > 24 ? 4 : 7;
  const baseProblemMin = settings.count > 24 ? 28 : 35;
  list.style.setProperty("--cols", settings.columns);
  list.style.setProperty("--row-gap", `${(baseRowGap * spacing).toFixed(1)}mm`);
  list.style.setProperty("--problem-min", `${(baseProblemMin * scale).toFixed(1)}mm`);
  list.style.setProperty("--problem-font", `${Math.round(18 * scale)}px`);
  list.style.setProperty("--visual-min", `${(24 * scale).toFixed(1)}mm`);
  list.style.setProperty("--dot-size", `${Math.round(10 * scale)}px`);
  list.style.setProperty("--card-gap", `${(3 * spacing).toFixed(1)}mm`);
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
    const settings = getSettings();
    problems = Array.from({ length: settings.count }, () => makeProblem(settings));
  }
  const pages = [renderPage("もんだい", false)];
  if (getSettings().includeAnswers) {
    pages.push(renderPage("こたえ", true));
  }
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  saveState();
  return;
  if (!problems.length) {
    const settings = getSettings();
    problems = Array.from({ length: settings.count }, () => makeProblem(settings));
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
  els.includeAnswers.disabled = false;
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  [els.problemType, els.range, els.problemCount].forEach((control) => control.addEventListener("change", markProblemsStale));
  els.columns.addEventListener("change", render);
  [els.problemScale, els.problemSpacing, els.includeAnswers].forEach((control) => control.addEventListener("change", render));
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") return;
    els.problemCountPreset.value = "";
    markProblemsStale();
  });
  els.problemCountPreset.addEventListener("change", () => {
    if (!els.problemCountPreset.value) return;
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
if (!problems.length) generateProblems();
else render();
