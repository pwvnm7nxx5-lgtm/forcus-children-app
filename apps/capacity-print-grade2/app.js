const APP = {
  id: "capacity-print-grade2",
  title: "2年生 水のかさ 単位変換プリント",
  accent: "#0284c7",
  stateVersion: 2,
  defaultDifficulty: "easy",
  defaultCount: 12,
  defaultCols: 2,
};

document.documentElement.style.setProperty("--accent", APP.accent);

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  difficulty: document.querySelector("#difficulty"),
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

function difficultyValues() {
  return [...els.difficulty.options].map((option) => option.value);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || APP.title,
    difficulty: clampChoice(els.difficulty.value, difficultyValues(), APP.defaultDifficulty),
    count: getProblemCount(),
    columns: clampNumber(els.columns.value, 1, 6, APP.defaultCols),
    showHint: els.showHint.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title && settings.title !== "2年生 水のかさプリント" ? settings.title : APP.title;
  els.difficulty.value = clampChoice(settings.difficulty, difficultyValues(), APP.defaultDifficulty);
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, APP.defaultCount));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, 1, 6, APP.defaultCols));
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

function formatMixedDlMl(totalMl) {
  const dl = Math.floor(totalMl / 100);
  const ml = totalMl % 100;
  return ml === 0 ? `${dl}dL` : `${dl}dL ${ml}mL`;
}

function formatMixedLDl(totalDl) {
  const liter = Math.floor(totalDl / 10);
  const dl = totalDl % 10;
  return dl === 0 ? `${liter}L` : `${liter}L ${dl}dL`;
}

function makeEasyConversion() {
  const patterns = [
    () => {
      const liter = rand(1, 9);
      return { prompt: `${liter}L = □dL`, answer: `${liter * 10}dL` };
    },
    () => {
      const dl = rand(1, 9);
      return { prompt: `${dl}dL = □mL`, answer: `${dl * 100}mL` };
    },
    () => {
      const liter = rand(1, 5);
      return { prompt: `${liter}L = □mL`, answer: `${liter * 1000}mL` };
    },
  ];
  return pick(patterns)();
}

function makeNormalConversion() {
  const patterns = [
    () => {
      const liter = rand(1, 6);
      const dl = rand(1, 9);
      return { prompt: `${liter}L ${dl}dL = □dL`, answer: `${liter * 10 + dl}dL` };
    },
    () => {
      const dl = rand(1, 9);
      const ml = rand(1, 9) * 10;
      return { prompt: `${dl}dL ${ml}mL = □mL`, answer: `${dl * 100 + ml}mL` };
    },
    () => {
      const totalDl = rand(11, 69);
      return { prompt: `${totalDl}dL = □L □dL`, answer: formatMixedLDl(totalDl) };
    },
    () => {
      const totalMl = rand(2, 19) * 100 + rand(1, 9) * 10;
      return { prompt: `${totalMl}mL = □dL □mL`, answer: formatMixedDlMl(totalMl) };
    },
  ];
  return pick(patterns)();
}

function makeHardConversion() {
  const patterns = [
    () => {
      const liter = rand(1, 4);
      const dl = rand(1, 9);
      const ml = rand(1, 9) * 10;
      return { prompt: `${liter}L ${dl}dL ${ml}mL = □mL`, answer: `${liter * 1000 + dl * 100 + ml}mL` };
    },
    () => {
      const totalMl = rand(12, 49) * 100 + rand(1, 9) * 10;
      const liter = Math.floor(totalMl / 1000);
      const restMl = totalMl % 1000;
      const dl = Math.floor(restMl / 100);
      const ml = restMl % 100;
      return { prompt: `${totalMl}mL = □L □dL □mL`, answer: `${liter}L ${dl}dL ${ml}mL` };
    },
    () => {
      const liter = rand(1, 8);
      return { prompt: `${liter * 1000}mL = □L`, answer: `${liter}L` };
    },
    () => {
      const totalDl = rand(12, 89);
      return { prompt: `${totalDl}dL = □mL`, answer: `${totalDl * 100}mL` };
    },
  ];
  return pick(patterns)();
}

function makeProblem(settings) {
  if (settings.difficulty === "easy") return makeEasyConversion();
  if (settings.difficulty === "hard") return makeHardConversion();
  return makeNormalConversion();
}

function problemKey(problem) {
  return JSON.stringify(problem);
}

function sheetSignature(settings) {
  return JSON.stringify(settings);
}

function selectProblemSet(settings, usedKeys = new Set()) {
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
    hint.textContent = "ヒント: 1L = 10dL、1dL = 100mL、1L = 1000mL";
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
    const settings = getSettings();
    problems = selectProblemSet(settings);
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
  [els.difficulty, els.problemCount, els.columns].forEach((control) => control.addEventListener("change", generateProblems));
  els.columns.addEventListener("input", generateProblems);
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
