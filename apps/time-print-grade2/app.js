const APP = {
  id: "time-print-grade2",
  title: "2年生 時刻・時間",
  accent: "#2563eb",
  stateVersion: 3,
  defaultType: "read",
  defaultDifficulty: "normal",
  defaultCount: 6,
  defaultCols: 2,
};

document.documentElement.style.setProperty("--accent", APP.accent);

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  difficulty: document.querySelector("#difficulty"),
  minuteNumberMode: document.querySelector("#minuteNumberMode"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
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
const problemCountMax = 6;
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";

function clampChoice(value, allowed, fallback) { return allowed.includes(String(value)) ? String(value) : fallback; }
function clampNumber(value, min, max, fallback) { const parsed = Number.parseInt(value, 10); return Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed)); }
function getProblemCount() { return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, APP.defaultCount); }
function typeValues() { return [...els.problemType.options].map((option) => option.value); }
function difficultyValues() { return [...els.difficulty.options].map((option) => option.value); }
function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || APP.title,
    type: clampChoice(els.problemType.value, typeValues(), APP.defaultType),
    difficulty: clampChoice(els.difficulty.value, difficultyValues(), APP.defaultDifficulty),
    minuteNumberMode: clampChoice(els.minuteNumberMode.value, ["none", "five", "ten", "thirty"], "none"),
    count: getProblemCount(),
    columns: clampNumber(els.columns.value, 1, 6, APP.defaultCols),
  };
}
function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || APP.title;
  els.problemType.value = clampChoice(settings.type, typeValues(), APP.defaultType);
  els.difficulty.value = clampChoice(settings.difficulty, difficultyValues(), APP.defaultDifficulty);
  els.minuteNumberMode.value = clampChoice(
    settings.minuteNumberMode ?? (settings.minuteNumbers === true ? "five" : "none"),
    ["none", "five", "ten", "thirty"],
    "none"
  );
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, APP.defaultCount));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, 1, 6, APP.defaultCols));
}
function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => { els.status.textContent = ""; }, 2800);
}
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(items) { return items[rand(0, items.length - 1)]; }
function pad(value) { return String(value).padStart(2, "0"); }
function timeText(totalMinutes) {
  const minutes = ((totalMinutes % 720) + 720) % 720;
  const hour = Math.floor(minutes / 60) || 12;
  const minute = minutes % 60;
  return minute === 0 ? `${hour}じ` : `${hour}じ${minute}ふん`;
}
function minuteNumberEntries(mode) {
  if (mode === "five") {
    return [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 0].map((minute) => ({
      minute,
      label: minute === 0 ? "0" : String(minute),
    }));
  }
  if (mode === "ten") {
    return [10, 20, 30, 40, 50, 0].map((minute) => ({
      minute,
      label: minute === 0 ? "0" : String(minute),
    }));
  }
  if (mode === "thirty") {
    return [
      { minute: 0, label: "0" },
      { minute: 30, label: "30" },
    ];
  }
  return [];
}

function minuteNumberMarks(mode) {
  return minuteNumberEntries(mode).map(({ minute, label }) => {
    const angle = (minute * 6 - 90) * Math.PI / 180;
    const x = 64 + Math.cos(angle) * 70;
    const y = 67 + Math.sin(angle) * 70;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="7.5" font-weight="700" text-anchor="middle" fill="#1d4ed8" stroke="#fff" stroke-width="3" paint-order="stroke">${label}</text>`;
  }).join("");
}

function clockSvg(totalMinutes, handMode = "both", minuteNumberMode = "none") {
  const minutes = ((totalMinutes % 720) + 720) % 720;
  const minute = minutes % 60;
  const hour = Math.floor(minutes / 60) || 12;
  const marks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 - 90) * Math.PI / 180;
    const outer = 56;
    const inner = i % 5 === 0 ? 50 : 53;
    const x1 = 64 + Math.cos(angle) * outer;
    const y1 = 64 + Math.sin(angle) * outer;
    const x2 = 64 + Math.cos(angle) * inner;
    const y2 = 64 + Math.sin(angle) * inner;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#344054" stroke-width="${i % 5 === 0 ? 2 : 1}"/>`;
  }).join("");
  const nums = [1,2,3,4,5,6,7,8,9,10,11,12].map((n) => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    return `<text x="${(64 + Math.cos(angle) * 42).toFixed(1)}" y="${(68 + Math.sin(angle) * 42).toFixed(1)}" font-size="11" text-anchor="middle">${n}</text>`;
  }).join("");
  const minuteAngle = (minute * 6 - 90) * Math.PI / 180;
  const hourAngle = (((hour % 12) + minute / 60) * 30 - 90) * Math.PI / 180;
  const mode = handMode === true ? "both" : handMode === false ? "none" : handMode;
  const parts = [];
  if (mode === "both" || mode === "hour") {
    parts.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(hourAngle) * 28).toFixed(1)}" y2="${(64 + Math.sin(hourAngle) * 28).toFixed(1)}" stroke="#111827" stroke-width="5" stroke-linecap="round"/>`);
  }
  if (mode === "both" || mode === "minute") {
    parts.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(minuteAngle) * 43).toFixed(1)}" y2="${(64 + Math.sin(minuteAngle) * 43).toFixed(1)}" stroke="#111827" stroke-width="3" stroke-linecap="round"/>`);
  }
  parts.push(`<circle cx="64" cy="64" r="3" fill="#111827"/>`);
  return `<svg class="clock" viewBox="-14 -14 156 156" width="132" height="132" role="img" aria-label="時計"><circle cx="64" cy="64" r="59" fill="#fff" stroke="#344054" stroke-width="3"/>${marks}${nums}${minuteNumberMarks(minuteNumberMode)}${parts.join("")}</svg>`;
}
function rulerSvg(mm, showMark = true) {
  const width = 170;
  const step = width / 10;
  const marks = Array.from({ length: 11 }, (_, i) => `<line x1="${10 + i * step}" y1="22" x2="${10 + i * step}" y2="${i % 5 === 0 ? 48 : 39}" stroke="#344054" stroke-width="${i % 5 === 0 ? 2 : 1}"/><text x="${10 + i * step}" y="62" font-size="10" text-anchor="middle">${i}</text>`).join("");
  const marker = showMark ? `<line x1="10" y1="16" x2="${10 + (mm / 100) * width}" y2="16" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/><circle cx="${10 + (mm / 100) * width}" cy="16" r="4" fill="#2563eb"/>` : "";
  return `<svg class="ruler" viewBox="0 0 190 72" width="190" height="72"><rect x="8" y="20" width="174" height="32" rx="4" fill="#fff" stroke="#344054"/>${marks}${marker}<text x="96" y="70" font-size="9" text-anchor="middle">cm</text></svg>`;
}
function beakerSvg(ml, showLevel = true) {
  const h = Math.min(92, Math.max(8, ml / 10));
  const y = 110 - h;
  const marks = [200,400,600,800,1000].map((v) => `<line x1="82" y1="${110 - v / 10}" x2="95" y2="${110 - v / 10}" stroke="#344054"/><text x="100" y="${114 - v / 10}" font-size="9">${v}</text>`).join("");
  const water = showLevel ? `<rect x="34" y="${y}" width="45" height="${h}" fill="#93c5fd" opacity=".8"/>` : "";
  return `<svg viewBox="0 0 132 128" width="130" height="126"><path d="M30 16h54l-6 98a10 10 0 0 1-10 9H46a10 10 0 0 1-10-9z" fill="#fff" stroke="#344054" stroke-width="3"/>${water}${marks}<text x="104" y="20" font-size="9">mL</text></svg>`;
}
function barGraphSvg(labels, values, showBars = true) {
  const max = Math.max(5, ...values);
  const bars = values.map((v, i) => {
    const x = 38 + i * 34;
    const h = 80 * v / max;
    return `${showBars ? `<rect x="${x}" y="${100 - h}" width="22" height="${h}" fill="#f97316"/>` : `<rect x="${x}" y="20" width="22" height="80" fill="transparent" stroke="#cfd8e3" stroke-dasharray="3 3"/>`}<text x="${x + 11}" y="116" font-size="10" text-anchor="middle">${labels[i]}</text>`;
  }).join("");
  const grid = Array.from({ length: 6 }, (_, i) => `<line x1="28" y1="${20 + i * 16}" x2="176" y2="${20 + i * 16}" stroke="#d8e0e8"/><text x="22" y="${24 + i * 16}" font-size="8" text-anchor="end">${Math.round(max - max * i / 5)}</text>`).join("");
  return `<svg class="graph" viewBox="0 0 190 125" width="190" height="125"><line x1="28" y1="100" x2="180" y2="100" stroke="#344054"/><line x1="28" y1="18" x2="28" y2="100" stroke="#344054"/>${grid}${bars}</svg>`;
}
function shapeSvg(shape, mode) {
  const grid = Array.from({ length: 8 }, (_, i) => `<line class="grid-line" x1="${16 + i * 18}" y1="16" x2="${16 + i * 18}" y2="142"/><line class="grid-line" x1="16" y1="${16 + i * 18}" x2="142" y2="${16 + i * 18}"/>`).join("");
  const paths = {
    triangle: "M38 118 L86 32 L130 118 Z",
    quadrilateral: "M36 44 L124 34 L136 112 L50 124 Z",
    rectangle: "M36 46 H132 V112 H36 Z",
    square: "M46 38 H122 V114 H46 Z",
    rightTriangle: "M42 116 H126 V40 Z",
  };
  const label = { triangle: "三角形", quadrilateral: "四角形", rectangle: "長方形", square: "正方形", rightTriangle: "直角三角形" }[shape];
  const cls = mode === "trace" ? "trace-shape" : "solid-shape";
  return `<svg viewBox="0 0 160 160" width="150" height="150" aria-label="${label}">${mode === "draw" ? grid : ""}<path class="${cls}" d="${paths[shape]}"/>${shape === "rightTriangle" ? `<path d="M106 116 V96 H126" fill="none" stroke="#344054" stroke-width="2"/>` : ""}</svg>`;
}
function makeProblem(settings) {
  if (APP.id === "time-print-grade2") return makeTimeProblem(settings);
  if (APP.id === "length-print-grade2") return makeLengthProblem(settings);
  if (APP.id === "capacity-print-grade2") return makeCapacityProblem(settings);
  if (APP.id === "shape-print-grade2") return makeShapeProblem(settings);
  return makeGraphProblem(settings);
}
function makeTimeProblem(settings) {
  const step = settings.difficulty === "easy" ? 30 : settings.difficulty === "hard" ? 1 : 5;
  const base = rand(1, 11) * 60 + rand(0, Math.floor(59 / step)) * step;
  if (settings.type === "draw") return { prompt: `${timeText(base)} のながいはりをかきましょう。`, answer: timeText(base), visual: clockSvg(base, "hour", settings.minuteNumberMode), answerVisual: clockSvg(base, "both", settings.minuteNumberMode) };
  if (settings.type === "beforeAfter") {
    const delta = pick(settings.difficulty === "easy" ? [30, 60] : settings.difficulty === "hard" ? [10, 15, 25, 35, 45, 50] : [5, 10, 15, 30]);
    const dir = pick(["あと", "まえ"]);
    const ans = dir === "あと" ? base + delta : base - delta;
    return { prompt: `${timeText(base)} の ${delta}ふん${dir} はいつですか。`, answer: timeText(ans), visual: clockSvg(base, true, settings.minuteNumberMode) };
  }
  return { prompt: "とけいのじこくをかきましょう。", answer: timeText(base), visual: clockSvg(base, true, settings.minuteNumberMode) };
}
function makeLengthProblem(settings) {
  const mm = settings.difficulty === "easy" ? rand(2, 10) * 10 : rand(15, 98);
  if (settings.type === "convert") {
    const cm = rand(1, 9); const extra = rand(1, 9);
    return { prompt: `${cm}cm${extra}mm はなんmmですか。`, answer: `${cm * 10 + extra}mm`, visual: rulerSvg(cm * 10 + extra, true) };
  }
  if (settings.type === "compare") {
    const a = rand(20, 90); const b = rand(20, 90);
    return { prompt: `${Math.floor(a / 10)}cm${a % 10}mm と ${Math.floor(b / 10)}cm${b % 10}mm、おおきいほうをかきましょう。`, answer: a === b ? "おなじ" : (a > b ? `${Math.floor(a / 10)}cm${a % 10}mm` : `${Math.floor(b / 10)}cm${b % 10}mm`), visual: "" };
  }
  return { prompt: "あおいしるしのながさをかきましょう。", answer: `${Math.floor(mm / 10)}cm${mm % 10 ? `${mm % 10}mm` : ""}`, visual: rulerSvg(mm, true) };
}
function makeCapacityProblem(settings) {
  const ml = settings.difficulty === "easy" ? rand(1, 9) * 100 : rand(2, 20) * 50;
  if (settings.type === "convert") {
    const dl = rand(1, 9); const extra = rand(0, 9);
    return { prompt: `${dl}dL${extra ? `${extra * 10}mL` : ""} はなんmLですか。`, answer: `${dl * 100 + extra * 10}mL`, visual: beakerSvg(dl * 100 + extra * 10, true) };
  }
  if (settings.type === "compare") {
    const a = rand(2, 10); const b = rand(2, 10);
    return { prompt: `${a}dL と ${b * 100}mL、おおきいほうをかきましょう。`, answer: a * 100 === b * 100 ? "おなじ" : (a > b ? `${a}dL` : `${b * 100}mL`), visual: "" };
  }
  return { prompt: "みずのかさをよみましょう。", answer: ml >= 1000 ? "1L" : `${ml}mL`, visual: beakerSvg(ml, true) };
}
function makeShapeProblem(settings) {
  const shapes = ["triangle", "quadrilateral", "rectangle", "square", "rightTriangle"];
  const shape = pick(shapes);
  const names = { triangle: "三角形", quadrilateral: "四角形", rectangle: "長方形", square: "正方形", rightTriangle: "直角三角形" };
  if (settings.type === "trace") return { prompt: "せんをなぞりましょう。", answer: names[shape], visual: shapeSvg(shape, "trace"), answerVisual: shapeSvg(shape, "solid") };
  if (settings.type === "draw") return { prompt: `${names[shape]} をほうがんにかきましょう。`, answer: names[shape], visual: shapeSvg(shape, "draw"), answerVisual: shapeSvg(shape, "solid") };
  if (settings.type === "classify") return { prompt: "このかたちのなかまをかきましょう。", answer: names[shape], visual: shapeSvg(shape, "solid") };
  return { prompt: "このかたちのなまえをかきましょう。", answer: names[shape], visual: shapeSvg(shape, "solid") };
}
function makeGraphProblem(settings) {
  const labels = ["りんご", "みかん", "ぶどう", "なし"];
  const values = labels.map(() => rand(1, settings.difficulty === "easy" ? 5 : 9));
  const i = rand(0, labels.length - 1);
  if (settings.type === "makeGraph") return { prompt: "ひょうをみて、ぼうグラフをかんせいさせましょう。", answer: labels.map((l, idx) => `${l}:${values[idx]}`).join("、"), visual: makeTable(labels, values) + barGraphSvg(labels, values, false), answerVisual: makeTable(labels, values) + barGraphSvg(labels, values, true) };
  if (settings.type === "table") return { prompt: `${labels[i]} はいくつですか。`, answer: `${values[i]}`, visual: makeTable(labels, values) };
  return { prompt: `${labels[i]} はいくつですか。`, answer: `${values[i]}`, visual: barGraphSvg(labels, values, true) };
}
function makeTable(labels, values) {
  const rows = labels.map((label, i) => `<tr><th>${label}</th><td>${values[i]}</td></tr>`).join("");
  return `<table style="border-collapse:collapse;background:#fff;font-size:14px"><tbody>${rows}</tbody></table><style>td,th{border:1px solid #98a2b3;padding:4px 10px}</style>`;
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
  prompt.className = "prompt";
  prompt.textContent = problem.prompt;
  const visual = document.createElement("div");
  visual.className = "visual";
  visual.innerHTML = showAnswer && problem.answerVisual ? problem.answerVisual : problem.visual;
  const answerLine = document.createElement("div");
  answerLine.className = "answer-line";
  answerLine.innerHTML = showAnswer ? `<span class="answer-value">${problem.answer}</span>` : `<span class="blank">□</span><span class="small-note">こたえ</span>`;
  card.append(prompt, visual, answerLine);
  return card;
}
function normalizeProblems() {
  const settings = getSettings();
  if (problems.length > settings.count) problems = problems.slice(0, settings.count);
  if (problems.length < settings.count) problems = selectProblemSet(settings);
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
  list.style.setProperty("--cols", settings.columns);
  list.style.setProperty("--row-gap", settings.count >= 6 ? "6mm" : "8mm");
  list.style.setProperty("--problem-min", settings.count >= 6 ? "54mm" : "64mm");
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
  normalizeProblems();
  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
  els.pageCount.textContent = "2枚";
  saveState();
}
function getShareState() { return { version: APP.stateVersion, settings: getSettings(), problems }; }
function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeState(value) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
function saveState() { try { localStorage.setItem(stateStorageKey, JSON.stringify(getShareState())); } catch {} }
function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded?.settings) {
      applySettings(decoded.settings);
      problems = decoded.version === APP.stateVersion && Array.isArray(decoded.problems) ? decoded.problems.slice(0, getSettings().count) : [];
      return;
    }
  }
  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      applySettings(parsed.settings);
      if (parsed.version === APP.stateVersion && Array.isArray(parsed.problems)) problems = parsed.problems.slice(0, getSettings().count);
    }
  } catch {}
}
async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  try { await navigator.clipboard.writeText(url); setStatus("共有URLをコピーしました。"); }
  catch { window.location.hash = `data=${encoded}`; setStatus("URL欄に共有用データを入れました。"); }
}
function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  [els.problemType, els.difficulty].forEach((control) => control.addEventListener("change", generateProblems));
  els.problemCount.addEventListener("change", generateProblems);
  [els.minuteNumberMode, els.columns].forEach((control) => control.addEventListener("change", render));
  els.columns.addEventListener("input", render);
  els.problemCount.addEventListener("input", () => { if (els.problemCount.value === "") return; els.problemCountPreset.value = ""; generateProblems({ normalizeCount: false }); });
  els.problemCountPreset.addEventListener("change", () => { if (!els.problemCountPreset.value) return; els.problemCount.value = els.problemCountPreset.value; generateProblems(); els.problemCountPreset.value = ""; });
  els.printBtn.addEventListener("click", () => { render(); window.print(); });
  els.regenerateBtn.addEventListener("click", generateProblems);
  els.copyLinkBtn.addEventListener("click", copyShareUrl);
}
loadInitialState();
bindEvents();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
if (!problems.length) generateProblems(); else render();



