const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
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

const stateStorageKey = "length-print-grade2-state";
const problemCountMin = 1;
const problemCountMax = 36;
const columnsMin = 1;
const columnsMax = 6;
const typeLabels = {
  reading: "よみとり",
  conversion: "たんいへんかん",
  compare: "ながさくらべ",
  arithmetic: "たしざん・ひきざん",
  ruler: "めもり",
  mix: "ながさミックス",
};
const ns = "http://www.w3.org/2000/svg";
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
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, 12);
}

function getColumns() {
  return clampNumber(els.columns.value, columnsMin, columnsMax, 2);
}

function getSettings() {
  const problemType = normalizeProblemType(els.problemType.value);
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "2年生 長さプリント",
    type: clampChoice(problemType, ["reading", "conversion", "compare", "arithmetic", "ruler", "mix"], "reading"),
    difficulty: clampChoice(els.difficulty.value, ["easy", "normal", "hard"], "easy"),
    count: getProblemCount(),
    columns: getColumns(),
    showHint: els.showHint.checked,
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    return;
  }
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "2年生 長さプリント";
  els.problemType.value = clampChoice(normalizeProblemType(settings.type), ["reading", "conversion", "compare", "arithmetic", "ruler", "mix"], "reading");
  els.difficulty.value = clampChoice(settings.difficulty, ["easy", "normal", "hard"], "easy");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, 12));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, 2));
  els.showHint.checked = Boolean(settings.showHint);
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(items) {
  return items[randomInt(0, items.length - 1)];
}

function normalizeProblemType(value) {
  const aliases = {
    read: "reading",
    convert: "conversion",
  };
  return aliases[value] || value;
}

function formatLength(mm, options = {}) {
  const compact = options.compact === true;
  if (mm >= 1000) {
    const meters = Math.floor(mm / 1000);
    const restCm = Math.round((mm % 1000) / 10);
    if (restCm === 0) {
      return `${meters}m`;
    }
    return compact ? `${meters}m${restCm}cm` : `${meters}m ${restCm}cm`;
  }
  if (mm >= 10) {
    const cm = Math.floor(mm / 10);
    const restMm = mm % 10;
    if (restMm === 0) {
      return `${cm}cm`;
    }
    return compact ? `${cm}cm${restMm}mm` : `${cm}cm ${restMm}mm`;
  }
  return `${mm}mm`;
}

function makeReadingProblem(difficulty) {
  const max = difficulty === "easy" ? 100 : difficulty === "normal" ? 150 : 200;
  const step = difficulty === "easy" ? 10 : 5;
  const value = randomInt(1, Math.floor(max / step)) * step;
  return {
    kind: "reading",
    prompt: "やじるしまでのながさをよみましょう。",
    answer: formatLength(value),
    figure: { type: "ruler", start: 0, end: value, max },
  };
}

function makeConversionProblem(difficulty) {
  const patterns = difficulty === "easy"
    ? ["cmToMm", "cmMmToMm", "mToCm"]
    : difficulty === "normal"
      ? ["cmToMm", "cmMmToMm", "mmToCmMm", "mToCm", "cmToMCm"]
      : ["cmMmToMm", "mmToCmMm", "mCmToCm", "cmToMCm"];
  const pattern = choice(patterns);

  if (pattern === "cmToMm") {
    const cm = randomInt(2, difficulty === "easy" ? 12 : 25);
    return { kind: "conversion", prompt: `${cm}cm =`, unitAfterBlank: "mm", answer: `${cm * 10}mm` };
  }
  if (pattern === "cmMmToMm") {
    const cm = randomInt(1, difficulty === "easy" ? 9 : 18);
    const mm = randomInt(1, 9);
    return { kind: "conversion", prompt: `${cm}cm ${mm}mm =`, unitAfterBlank: "mm", answer: `${cm * 10 + mm}mm` };
  }
  if (pattern === "mmToCmMm") {
    const value = randomInt(12, difficulty === "normal" ? 99 : 199);
    return { kind: "conversion", prompt: `${value}mm =`, unitAfterBlank: "cm mm", answer: formatLength(value) };
  }
  if (pattern === "mToCm") {
    const meters = randomInt(1, difficulty === "easy" ? 3 : 6);
    return { kind: "conversion", prompt: `${meters}m =`, unitAfterBlank: "cm", answer: `${meters * 100}cm` };
  }
  if (pattern === "mCmToCm") {
    const meters = randomInt(1, 4);
    const cm = randomInt(5, 95);
    return { kind: "conversion", prompt: `${meters}m ${cm}cm =`, unitAfterBlank: "cm", answer: `${meters * 100 + cm}cm` };
  }
  const cm = randomInt(110, difficulty === "normal" ? 250 : 520);
  return { kind: "conversion", prompt: `${cm}cm =`, unitAfterBlank: "m cm", answer: formatLength(cm * 10) };
}

function makeCompareProblem(difficulty) {
  const max = difficulty === "easy" ? 120 : difficulty === "normal" ? 450 : 2200;
  let a = randomInt(2, max / 10) * 10;
  let b = randomInt(2, max / 10) * 10;
  if (difficulty !== "easy") {
    a += randomInt(0, 9);
    b += randomInt(0, 9);
  }
  if (Math.random() < 0.18) {
    b = a;
  }
  const sign = a === b ? "=" : a > b ? ">" : "<";
  return {
    kind: "compare",
    prompt: `どちらがながいか、>、<、=でかきましょう。 ${formatLength(a)}  □  ${formatLength(b)}`,
    answer: sign,
    compactAnswer: true,
  };
}

function makeArithmeticProblem(difficulty) {
  const maxCm = difficulty === "easy" ? 9 : difficulty === "normal" ? 18 : 35;
  const makeAmount = () => randomInt(1, maxCm) * 10 + randomInt(1, 9);
  let a = makeAmount();
  let b = makeAmount();
  const useSubtraction = difficulty !== "easy" && Math.random() < 0.45;
  if (useSubtraction && b > a) {
    [a, b] = [b, a];
  }
  const answer = useSubtraction ? a - b : a + b;
  return {
    kind: "arithmetic",
    prompt: `${formatLength(a)} ${useSubtraction ? "-" : "+"} ${formatLength(b)} =`,
    unitAfterBlank: "cm mm",
    answer: formatLength(answer),
  };
}

function makeRulerProblem(difficulty) {
  const max = difficulty === "easy" ? 100 : difficulty === "normal" ? 150 : 200;
  const startStep = difficulty === "easy" ? 10 : 5;
  const endStep = difficulty === "easy" ? 10 : 5;
  const start = randomInt(0, Math.floor(max / 2 / startStep)) * startStep;
  const minLength = difficulty === "easy" ? 20 : 15;
  const rawEnd = randomInt(Math.ceil((start + minLength) / endStep), Math.floor(max / endStep)) * endStep;
  const end = Math.min(max, rawEnd);
  return {
    kind: "ruler",
    prompt: "アからイまでのながさはなんcmなんmmですか。",
    answer: formatLength(end - start),
    figure: { type: "ruler", start, end, max, labels: ["ア", "イ"] },
  };
}

function makeProblem(settings) {
  const type = settings.type === "mix" ? choice(["reading", "conversion", "compare", "arithmetic", "ruler"]) : settings.type;
  if (type === "reading") {
    return makeReadingProblem(settings.difficulty);
  }
  if (type === "conversion") {
    return makeConversionProblem(settings.difficulty);
  }
  if (type === "compare") {
    return makeCompareProblem(settings.difficulty);
  }
  if (type === "arithmetic") {
    return makeArithmeticProblem(settings.difficulty);
  }
  return makeRulerProblem(settings.difficulty);
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
  if (options.normalizeCount !== false) {
    els.problemCount.value = String(getProblemCount());
  }
  const settings = getSettings();
  problems = selectProblemSet(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("もんだいをつくりなおしました。");
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(ns, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function addText(svg, x, y, text, attrs = {}) {
  const node = svgEl("text", { x, y, ...attrs });
  node.textContent = text;
  svg.append(node);
}

function makeRulerSvg(figure) {
  const width = 300;
  const height = 92;
  const left = 22;
  const right = 278;
  const y = 46;
  const scale = (right - left) / figure.max;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "ものさし" });
  svg.append(svgEl("rect", { x: 10, y: 18, width: 280, height: 42, rx: 6, fill: "#fff7ed", stroke: "#d6a36e" }));
  svg.append(svgEl("line", { x1: left, y1: y, x2: right, y2: y, stroke: "#344054", "stroke-width": 1.5 }));

  for (let mm = 0; mm <= figure.max; mm += 5) {
    const x = left + mm * scale;
    const big = mm % 10 === 0;
    svg.append(svgEl("line", { x1: x, y1: y, x2: x, y2: big ? 24 : 31, stroke: "#344054", "stroke-width": big ? 1.3 : 0.8 }));
    if (big) {
      addText(svg, x, 72, String(mm / 10), { "text-anchor": "middle", "font-size": 9, fill: "#344054" });
    }
  }
  addText(svg, right + 6, 72, "cm", { "font-size": 9, fill: "#667085" });

  const x1 = left + figure.start * scale;
  const x2 = left + figure.end * scale;
  svg.append(svgEl("line", { x1, y1: 12, x2, y2: 12, stroke: "#b85c38", "stroke-width": 3, "stroke-linecap": "round" }));
  [x1, x2].forEach((x, index) => {
    svg.append(svgEl("line", { x1: x, y1: 12, x2: x, y2: 46, stroke: "#b85c38", "stroke-width": 1.7 }));
    const label = figure.labels?.[index] || (index === 0 ? "0" : "?" );
    addText(svg, x, 10, label, { "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "#8a3f24" });
  });
  return svg;
}

function makeFigure(figure) {
  if (!figure) {
    return null;
  }
  return makeRulerSvg(figure);
}

function makeAnswer(problem, showAnswer) {
  const wrap = document.createElement("div");
  wrap.className = "answer-line";
  if (showAnswer) {
    const value = document.createElement("span");
    value.className = "answer-value";
    value.textContent = problem.answer;
    wrap.append("こたえ ", value);
    return wrap;
  }

  if (problem.kind === "compare") {
    wrap.append(document.createTextNode("こたえ "));
    const blank = document.createElement("span");
    blank.className = "blank compare-blank";
    blank.textContent = "□";
    wrap.append(blank);
    return wrap;
  }

  const blank = document.createElement("span");
  blank.className = "blank";
  blank.textContent = "□";
  wrap.append("こたえ ", blank);
  if (problem.unitAfterBlank) {
    const unit = document.createElement("span");
    unit.textContent = problem.unitAfterBlank;
    wrap.append(unit);
  }
  return wrap;
}

function makeProblemNode(problem, showAnswer) {
  const body = document.createElement("div");
  body.className = "problem-body";
  const prompt = document.createElement("div");
  prompt.className = "prompt";
  prompt.textContent = problem.prompt;
  body.append(prompt);

  const figure = makeFigure(problem.figure);
  if (figure) {
    const figureWrap = document.createElement("div");
    figureWrap.className = "figure";
    figureWrap.append(figure);
    body.append(figureWrap);
  }

  body.append(makeAnswer(problem, showAnswer));
  return body;
}

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  let rowGap = 7;
  let problemMin = 28;
  let fontSize = 18;
  if (rows > 18) {
    rowGap = 2.6;
    problemMin = 15;
    fontSize = 14;
  } else if (rows > 12) {
    rowGap = 4;
    problemMin = 20;
    fontSize = 16;
  } else if (rows > 8) {
    rowGap = 5.2;
    problemMin = 24;
    fontSize = 17;
  }
  list.style.setProperty("--cols", settings.columns);
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
    kindLabel.classList.add("answer");
  }
  if (!showAnswer && settings.showHint) {
    const hint = document.createElement("div");
    hint.className = "page-hint";
    hint.textContent = "ヒント: 1cm = 10mm、1m = 100cm";
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
  applyGridDensity(list, settings);
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeProblemNode(problem, showAnswer));
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
  const settings = getSettings();
  const label = typeLabels[settings.type] || "もんだい";
  const pages = [];
  sets.forEach((set, index) => {
    const suffix = count > 1 ? ` ${index + 1}` : "";
    pages.push(renderPage(`${label}${suffix}`, false, set));
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
  const settings = getSettings();
  const label = typeLabels[settings.type] || "もんだい";
  els.pages.replaceChildren(renderPage(label, false), renderPage("こたえ", true));
  els.pageCount.textContent = "2枚";
  saveState();
}

function getShareState() {
  return { settings: getSettings(), problems };
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

function containsRemovedMeterProblem(items) {
  return items.some((problem) => problem?.kind === "reading" && problem.figure?.type === "meter");
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
      if (!containsRemovedMeterProblem(decoded.problems)) {
        problems = decoded.problems;
      }
      return;
    }
  }
  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      applySettings(parsed.settings);
      if (Array.isArray(parsed.problems) && !containsRemovedMeterProblem(parsed.problems)) {
        problems = parsed.problems;
      }
    }
  } catch {
    // Ignore broken saved state.
  }
}

async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const url = new URL(window.location.href);
  url.hash = `data=${encoded}`;
  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("URL欄に共有データを入れました。");
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => {
    control.addEventListener("input", render);
  });
  [els.problemType, els.difficulty].forEach((control) => {
    control.addEventListener("change", generateProblems);
  });
  els.columns.addEventListener("change", render);
  els.showHint.addEventListener("change", render);
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
