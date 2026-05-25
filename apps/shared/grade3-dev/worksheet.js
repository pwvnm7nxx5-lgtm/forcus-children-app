const config = window.GRADE3_APP_CONFIG;

document.documentElement.style.setProperty("--accent", config.accent || "#475569");

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  problemCount: document.querySelector("#problemCount"),
  problemCountPreset: document.querySelector("#problemCountPreset"),
  columns: document.querySelector("#columns"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printButton"),
  regenerateBtn: document.querySelector("#regenerateButton"),
  copyLinkBtn: document.querySelector("#copyLinkButton"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = `${config.id}-state-v2`;
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function clampInt(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[rand(0, items.length - 1)];
}

function problemKey(problem) {
  return [
    problem.prompt,
    problem.answer,
    problem.clockTotal ?? "",
    problem.visual ?? "",
  ].join("|");
}

function sheetSignature(settings) {
  return JSON.stringify({
    kind: config.kind,
    type: settings.type,
    count: settings.count,
  });
}

function getProblemCount() {
  return clampInt(els.problemCount.value, problemCountMin, problemCountMax, config.defaultCount || 12);
}

function typeValues() {
  return config.types.map((type) => type.value);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || config.title,
    type: clampChoice(els.problemType.value, typeValues(), config.types[0].value),
    count: getProblemCount(),
    columns: clampInt(els.columns.value, 1, 3, config.defaultColumns || 2),
    includeAnswers: els.includeAnswers?.checked !== false,
    problemScale: clampInt(document.querySelector("#problemScale")?.value, 70, 150, 100),
    problemSpacing: clampInt(document.querySelector("#problemSpacing")?.value, 2, 20, 7),
    pageMarginY: clampInt(document.querySelector("#pageMarginY")?.value, 5, 28, 14),
    pageMarginX: clampInt(document.querySelector("#pageMarginX")?.value, 5, 28, 13),
    answerGap: clampInt(document.querySelector("#answerGap")?.value, 0, 12, 0),
    minuteNumberMode: config.kind === "clock"
      ? clampChoice(document.querySelector("#minuteNumberMode")?.value || "none", ["none", "five", "ten"], "none")
      : "none",
  };
}

function setRangeValue(id, value) {
  const range = document.querySelector(`#${id}`);
  const number = document.querySelector(`#${id}Number`);
  if (range) range.value = String(value);
  if (number) number.value = String(value);
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || config.title;
  els.problemType.value = clampChoice(settings.type, typeValues(), config.types[0].value);
  els.problemCount.value = String(clampInt(settings.count, problemCountMin, problemCountMax, config.defaultCount || 12));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampInt(settings.columns, 1, 3, config.defaultColumns || 2));
  if (els.includeAnswers) els.includeAnswers.checked = settings.includeAnswers !== false;
  setRangeValue("problemScale", clampInt(settings.problemScale, 70, 150, 100));
  setRangeValue("problemSpacing", clampInt(settings.problemSpacing, 2, 20, 7));
  setRangeValue("pageMarginY", clampInt(settings.pageMarginY, 5, 28, 14));
  setRangeValue("pageMarginX", clampInt(settings.pageMarginX, 5, 28, 13));
  setRangeValue("answerGap", clampInt(settings.answerGap, 0, 12, 0));
  const minuteNumberMode = document.querySelector("#minuteNumberMode");
  if (minuteNumberMode) {
    minuteNumberMode.value = clampChoice(settings.minuteNumberMode, ["none", "five", "ten"], "none");
  }
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function timeText(totalMinutes) {
  const minutes = ((totalMinutes % 720) + 720) % 720;
  const hour = Math.floor(minutes / 60) || 12;
  const minute = minutes % 60;
  return minute === 0 ? `${hour}時` : `${hour}時${pad(minute)}分`;
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
  const hourNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    return `<text x="${(64 + Math.cos(angle) * 42).toFixed(1)}" y="${(68 + Math.sin(angle) * 42).toFixed(1)}" font-size="11" text-anchor="middle">${n}</text>`;
  }).join("");
  const minuteNumbers = minuteNumberMode === "none" ? "" : [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
    .filter((value) => minuteNumberMode === "five" || value % 10 === 0)
    .map((value) => {
      const angle = (value * 6 - 90) * Math.PI / 180;
      return `<text class="minute-number" x="${(64 + Math.cos(angle) * 70).toFixed(1)}" y="${(67 + Math.sin(angle) * 70).toFixed(1)}" font-size="8" text-anchor="middle">${value}</text>`;
    }).join("");
  const minuteAngle = (minute * 6 - 90) * Math.PI / 180;
  const hourAngle = (((hour % 12) + minute / 60) * 30 - 90) * Math.PI / 180;
  const hands = [];
  if (handMode === "both" || handMode === "hour") {
    hands.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(hourAngle) * 28).toFixed(1)}" y2="${(64 + Math.sin(hourAngle) * 28).toFixed(1)}" stroke="#111827" stroke-width="5" stroke-linecap="round"/>`);
  }
  if (handMode === "both" || handMode === "minute") {
    hands.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(minuteAngle) * 43).toFixed(1)}" y2="${(64 + Math.sin(minuteAngle) * 43).toFixed(1)}" stroke="#111827" stroke-width="3" stroke-linecap="round"/>`);
  }
  hands.push(`<circle cx="64" cy="64" r="3" fill="#111827"/>`);
  return `<svg class="clock" viewBox="-24 -24 176 176" width="132" height="132" role="img" aria-label="時計"><circle cx="64" cy="64" r="59" fill="#fff" stroke="#344054" stroke-width="3"/>${marks}${hourNumbers}${minuteNumbers}${hands.join("")}</svg>`;
}

function scaleSvg(grams) {
  const max = 3000;
  const angle = -120 + Math.min(grams, max) / max * 240;
  const rad = (angle - 90) * Math.PI / 180;
  const x = 70 + Math.cos(rad) * 43;
  const y = 70 + Math.sin(rad) * 43;
  const marks = [0, 500, 1000, 1500, 2000, 2500, 3000].map((value) => {
    const a = (-120 + value / max * 240 - 90) * Math.PI / 180;
    const mx = 70 + Math.cos(a) * 51;
    const my = 70 + Math.sin(a) * 51;
    return `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="8" text-anchor="middle">${value / 1000}</text>`;
  }).join("");
  return `<svg class="scale" viewBox="0 0 140 120" width="150" height="126" role="img" aria-label="はかり"><circle cx="70" cy="70" r="58" fill="#fff" stroke="#344054" stroke-width="3"/><text x="70" y="24" font-size="10" text-anchor="middle">kg</text>${marks}<line x1="70" y1="70" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#111827" stroke-width="4" stroke-linecap="round"/><circle cx="70" cy="70" r="4" fill="#111827"/></svg>`;
}

function makeClockProblem(settings) {
  const step = settings.type === "minute" ? 1 : settings.type === "five" ? 5 : 15;
  const total = rand(1, 11) * 60 + rand(0, Math.floor(59 / step)) * step;
  if (settings.type === "draw") {
    return {
      prompt: `${timeText(total)} の針を書きましょう。`,
      answer: timeText(total),
      clockTotal: total,
      handMode: "none",
      answerHandMode: "both",
      visual: clockSvg(total, "none", settings.minuteNumberMode),
      answerVisual: clockSvg(total, "both", settings.minuteNumberMode),
    };
  }
  return {
    prompt: "時計の時刻を読みましょう。",
    answer: timeText(total),
    clockTotal: total,
    handMode: "both",
    visual: clockSvg(total, "both", settings.minuteNumberMode),
  };
}

function makeTimeProblem(settings) {
  const base = rand(1, 11) * 60 + rand(0, 11) * 5;
  const delta = pick(settings.type === "hourMinute" ? [40, 45, 50, 75, 90, 105, 120] : [10, 15, 20, 25, 30, 35]);
  if (settings.type === "duration") {
    return {
      prompt: `${timeText(base)} から ${timeText(base + delta)} までは何分ですか。`,
      answer: `${delta}分`,
      visual: clockSvg(base, "both"),
    };
  }
  const dir = pick(["後", "前"]);
  const answer = dir === "後" ? base + delta : base - delta;
  return {
    prompt: `${timeText(base)} の ${delta}分${dir} はいつですか。`,
    answer: timeText(answer),
    visual: clockSvg(base, "both"),
  };
}

function makeDivisionProblem(settings) {
  const divisor = rand(2, 9);
  if (settings.type === "remainder") {
    const quotient = rand(2, 9);
    const remainder = rand(1, divisor - 1);
    const dividend = divisor * quotient + remainder;
    return { prompt: `${dividend} ÷ ${divisor} =`, answer: `${quotient} あまり ${remainder}` };
  }
  const quotient = rand(2, 12);
  return { prompt: `${divisor * quotient} ÷ ${divisor} =`, answer: `${quotient}` };
}

function makeBigNumberProblem(settings) {
  const number = rand(1000, 99999);
  const places = [["一万", 10000], ["千", 1000], ["百", 100], ["十", 10], ["一", 1]];
  const place = pick(places);
  if (settings.type === "place") {
    return {
      prompt: `${number.toLocaleString("ja-JP")} の ${place[0]} の位の数字は何ですか。`,
      answer: `${Math.floor(number / place[1]) % 10}`,
    };
  }
  if (settings.type === "compare") {
    const other = rand(1000, 99999);
    const sign = number === other ? "=" : number > other ? ">" : "<";
    return { prompt: `${number.toLocaleString("ja-JP")} □ ${other.toLocaleString("ja-JP")}`, answer: sign };
  }
  return { prompt: `${number.toLocaleString("ja-JP")} を数字で書きましょう。`, answer: String(number) };
}

function makeDecimalProblem(settings) {
  const a = rand(1, 99) / 10;
  const b = rand(1, 99) / 10;
  if (settings.type === "compare") {
    const sign = a === b ? "=" : a > b ? ">" : "<";
    return { prompt: `${a.toFixed(1)} □ ${b.toFixed(1)}`, answer: sign };
  }
  if (settings.type === "sub") {
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    return { prompt: `${big.toFixed(1)} - ${small.toFixed(1)} =`, answer: `${(big - small).toFixed(1)}` };
  }
  return { prompt: `${a.toFixed(1)} + ${b.toFixed(1)} =`, answer: `${(a + b).toFixed(1)}` };
}

function makeWeightProblem(settings) {
  const grams = rand(1, 30) * 100;
  if (settings.type === "read") {
    return {
      prompt: "はかりの重さを読みましょう。",
      answer: grams >= 1000 ? `${Math.floor(grams / 1000)}kg${grams % 1000 ? ` ${grams % 1000}g` : ""}` : `${grams}g`,
      visual: scaleSvg(grams),
    };
  }
  if (settings.type === "compare") {
    const a = rand(1, 30) * 100;
    const b = rand(1, 30) * 100;
    const sign = a === b ? "=" : a > b ? ">" : "<";
    return { prompt: `${a}g □ ${b}g`, answer: sign };
  }
  const kg = rand(1, 5);
  const g = rand(1, 9) * 100;
  return { prompt: `${kg}kg ${g}g =`, answer: `${kg * 1000 + g}g` };
}

function makeProblem(settings) {
  if (config.kind === "clock") return makeClockProblem(settings);
  if (config.kind === "time") return makeTimeProblem(settings);
  if (config.kind === "division") return makeDivisionProblem(settings);
  if (config.kind === "bigNumber") return makeBigNumberProblem(settings);
  if (config.kind === "decimal") return makeDecimalProblem(settings);
  return makeWeightProblem(settings);
}

function selectProblemSet(settings, usedKeys = new Set()) {
  const selected = [];
  const seen = new Set(usedKeys);
  const maxAttempts = settings.count * 80 + 120;
  let attempts = 0;
  while (selected.length < settings.count && attempts < maxAttempts) {
    const problem = makeProblem(settings);
    const key = problemKey(problem);
    if (!seen.has(key)) {
      selected.push(problem);
      seen.add(key);
    }
    attempts += 1;
  }
  while (selected.length < settings.count) {
    selected.push(makeProblem(settings));
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
  setStatus("問題を作り直しました。");
}

function renderProblem(problem, showAnswer, settings) {
  const card = document.createElement("div");
  card.className = "problem-card";
  const prompt = document.createElement("div");
  prompt.className = "prompt";
  prompt.textContent = problem.prompt;
  card.append(prompt);

  if (problem.visual) {
    const visual = document.createElement("div");
    visual.className = "visual";
    if (typeof problem.clockTotal === "number") {
      const handMode = showAnswer && problem.answerHandMode ? problem.answerHandMode : problem.handMode || "both";
      visual.innerHTML = clockSvg(problem.clockTotal, handMode, settings.minuteNumberMode);
    } else {
      visual.innerHTML = showAnswer && problem.answerVisual ? problem.answerVisual : problem.visual;
    }
    card.append(visual);
  }

  const answerLine = document.createElement("div");
  answerLine.className = "answer-line";
  if (showAnswer) {
    const answerValue = document.createElement("span");
    answerValue.className = "answer-value";
    answerValue.textContent = problem.answer;
    answerLine.append(answerValue);
  } else {
    const blank = document.createElement("span");
    blank.className = "blank";
    blank.textContent = "□";
    const note = document.createElement("span");
    note.className = "small-note";
    note.textContent = "こたえ";
    answerLine.append(blank, note);
  }
  card.append(answerLine);
  return card;
}

function applyGridDensity(list, settings) {
  const rows = Math.ceil(settings.count / settings.columns);
  const scale = settings.problemScale / 100;
  let problemMin = problemHasVisual() ? 42 : 20;
  let fontSize = 18;
  if (rows > 12) {
    problemMin = problemHasVisual() ? 25 : 12;
    fontSize = 15;
  } else if (rows > 8) {
    problemMin = problemHasVisual() ? 32 : 16;
    fontSize = 16;
  }
  list.style.setProperty("--cols", settings.columns);
  list.style.setProperty("--row-gap", `${settings.problemSpacing}mm`);
  list.style.setProperty("--problem-min", `${(problemMin * scale).toFixed(1)}mm`);
  list.style.setProperty("--problem-font", `${Math.round(fontSize * scale)}px`);
  list.style.setProperty("--card-gap", `${Math.max(2, settings.problemSpacing / 2).toFixed(1)}mm`);
  list.style.setProperty("--visual-min", `${(22 * scale).toFixed(1)}mm`);
  list.style.setProperty("--visual-width", `${Math.round(132 * scale)}px`);
  list.style.setProperty("--blank-width", `${(28 * scale).toFixed(1)}mm`);
  list.style.setProperty("--blank-height", `${(8 * scale).toFixed(1)}mm`);
  list.style.setProperty("--answer-gap", `${settings.answerGap}mm`);
}

function problemHasVisual() {
  return config.kind === "clock" || config.kind === "time" || config.kind === "weight";
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.style.setProperty("--page-margin-y", `${settings.pageMarginY}mm`);
  page.style.setProperty("--page-margin-x", `${settings.pageMarginX}mm`);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) kindLabel.classList.add("answer");
  const list = page.querySelector("[data-problems]");
  applyGridDensity(list, settings);
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(renderProblem(problem, showAnswer, settings));
    list.append(item);
  });
  return page;
}

function normalizeProblems() {
  const settings = getSettings();
  if (problems.length > settings.count) {
    problems = problems.slice(0, settings.count);
  }
  while (problems.length < settings.count) {
    problems.push(makeProblem(settings));
  }
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
    const set = selectProblemSet(settings, usedKeys);
    set.forEach((problem) => usedKeys.add(problemKey(problem)));
    sheetProblemSets.push(set);
  }
  if (sheetProblemSets.length > sheetCount) {
    sheetProblemSets = sheetProblemSets.slice(0, sheetCount);
  }
  problems = sheetProblemSets[0] || problems;
  return sheetProblemSets;
}

function renderSheetPages(sheetCount, includeAnswers) {
  normalizeProblems();
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
  updateLayoutWarning(getSettings());
  saveState();
}

function render() {
  normalizeProblems();
  const pages = [renderPage("もんだい", false)];
  if (getSettings().includeAnswers) {
    pages.push(renderPage("こたえ", true));
  }
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  updateLayoutWarning(getSettings());
  saveState();
}

function getShareState() {
  return { version: 2, settings: getSettings(), problems };
}

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
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(stateStorageKey, JSON.stringify(getShareState()));
  } catch {}
}

function isCompatibleProblem(problem) {
  if (!problem || typeof problem.prompt !== "string" || typeof problem.answer !== "string") return false;
  if (config.kind === "clock") return typeof problem.clockTotal === "number";
  return true;
}

function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded?.version === 2 && decoded.settings && Array.isArray(decoded.problems)) {
      applySettings(decoded.settings);
      problems = decoded.problems.filter(isCompatibleProblem);
      return;
    }
  }
  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.version !== 2) return;
      applySettings(parsed.settings);
      if (Array.isArray(parsed.problems)) {
        problems = parsed.problems.filter(isCompatibleProblem);
      }
    }
  } catch {}
}

async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("同じプリントを開くリンクをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("リンク用のデータをURLに入れました。");
  }
}

function createRangeField(id, label, min, max, step, value) {
  const field = document.createElement("label");
  field.className = "field range-field";
  field.innerHTML = `<span>${label}</span><span class="range-control"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><input id="${id}Number" type="number" min="${min}" max="${max}" step="${step}" value="${value}" inputmode="decimal"></span>`;
  return field;
}

function createSelectField(id, label, options) {
  const field = document.createElement("label");
  field.className = "field";
  const text = document.createElement("span");
  text.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    if (option.selected) item.selected = true;
    select.append(item);
  });
  field.append(text, select);
  return field;
}

function syncRange(id, callback = render) {
  const range = document.querySelector(`#${id}`);
  const number = document.querySelector(`#${id}Number`);
  const sync = (source, target) => {
    const value = clampNumber(source.value, Number(source.min), Number(source.max), Number(source.value));
    source.value = String(value);
    target.value = String(value);
    callback();
  };
  range.addEventListener("input", () => sync(range, number));
  number.addEventListener("input", () => sync(number, range));
}

function resetSettings() {
  try {
    localStorage.removeItem(stateStorageKey);
  } catch {}
  problems = [];
  els.studentName.value = "";
  els.worksheetDate.value = "";
  els.worksheetTitle.value = config.title;
  els.problemType.value = config.types[0].value;
  els.problemCount.value = String(config.defaultCount || 12);
  els.columns.value = String(config.defaultColumns || 2);
  if (els.includeAnswers) els.includeAnswers.checked = true;
  setRangeValue("problemScale", 100);
  setRangeValue("problemSpacing", 7);
  setRangeValue("pageMarginY", 14);
  setRangeValue("pageMarginX", 13);
  setRangeValue("answerGap", 0);
  const minuteNumberMode = document.querySelector("#minuteNumberMode");
  if (minuteNumberMode) minuteNumberMode.value = "none";
  generateProblems();
  setStatus("初期設定に戻しました。");
}

function setupControls() {
  const firstLabel = document.querySelector(".settings-grid .field span");
  if (firstLabel) firstLabel.textContent = "問題の種類";
  els.includeAnswers.disabled = false;
  document.querySelector(".settings-grid").append(
    createRangeField("problemScale", "問題の大きさ（%）", 70, 150, 5, 100),
    createRangeField("problemSpacing", "問題の間隔（mm）", 2, 20, 1, 7),
    createRangeField("pageMarginY", "上下の余白（mm）", 5, 28, 1, 14),
    createRangeField("pageMarginX", "左右の余白（mm）", 5, 28, 1, 13),
    createRangeField("answerGap", "解答欄との間隔（mm）", 0, 12, 1, 0),
  );
  if (config.kind === "clock") {
    document.querySelector(".settings-grid").append(createSelectField("minuteNumberMode", "分の数字", [
      { value: "none", label: "表示しない", selected: true },
      { value: "five", label: "5分ごと" },
      { value: "ten", label: "10分ごと" },
    ]));
  }
  const layoutWarning = document.createElement("p");
  layoutWarning.id = "layoutWarning";
  layoutWarning.className = "layout-warning";
  layoutWarning.setAttribute("role", "status");
  layoutWarning.hidden = true;
  document.querySelector(".settings-grid").after(layoutWarning);
  const resetButton = document.createElement("button");
  resetButton.id = "resetSettingsButton";
  resetButton.type = "button";
  resetButton.textContent = "初期設定に戻す";
  document.querySelector(".actions").append(resetButton);
}

function updateLayoutWarning(settings) {
  const warning = document.querySelector("#layoutWarning");
  if (!warning) return;
  const hasManyProblems = settings.count >= 24;
  const isLargeVisual = problemHasVisual() && settings.problemScale >= 125 && settings.count >= 12;
  const isTight = settings.problemSpacing <= 3 || settings.pageMarginY <= 7 || settings.pageMarginX <= 7;
  const mayOverflow = (settings.problemScale >= 130 && hasManyProblems) || isLargeVisual;
  if (!mayOverflow && !isTight) {
    warning.hidden = true;
    warning.textContent = "";
    return;
  }
  warning.hidden = false;
  warning.textContent = mayOverflow
    ? "大きめの設定です。印刷前に1枚に収まるか確認してください。"
    : "余白や間隔が狭めです。書き込みやすさを確認してください。";
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  [els.problemType, els.problemCount, els.columns].forEach((control) => control.addEventListener("change", generateProblems));
  els.includeAnswers.addEventListener("change", render);
  ["problemScale", "problemSpacing", "pageMarginY", "pageMarginX", "answerGap"].forEach((id) => syncRange(id, render));
  document.querySelector("#minuteNumberMode")?.addEventListener("change", render);
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
  document.querySelector("#resetSettingsButton").addEventListener("click", resetSettings);
}

function makeSelectControl(id, label, options) {
  const field = document.createElement("label");
  field.className = "field";
  const text = document.createElement("span");
  text.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    if (option.selected) item.selected = true;
    select.append(item);
  });
  field.append(text, select);
  return field;
}

function setupPrintControls() {
  const grid = document.querySelector(".settings-grid");
  if (config.kind === "clock" && !document.querySelector("#minuteNumberMode")) {
    grid.append(makeSelectControl("minuteNumberMode", "分の数字", [
      { value: "none", label: "表示しない", selected: true },
      { value: "five", label: "5分ごと" },
      { value: "ten", label: "10分ごと" },
    ]));
  }
  els.minuteNumberMode = document.querySelector("#minuteNumberMode");
  els.includeAnswers = document.querySelector("#includeAnswers");
  els.includeAnswers.disabled = false;
  return;
  if (!document.querySelector("#problemScale")) {
    grid.append(makeSelectControl("problemScale", "問題の大きさ", [
      { value: "compact", label: "小さめ" },
      { value: "normal", label: "ふつう", selected: true },
      { value: "large", label: "大きめ" },
    ]));
  }
  if (!document.querySelector("#problemSpacing")) {
    grid.append(makeSelectControl("problemSpacing", "問題の間隔", [
      { value: "tight", label: "せまい" },
      { value: "normal", label: "ふつう", selected: true },
      { value: "wide", label: "広い" },
    ]));
  }
  els.problemScale = document.querySelector("#problemScale");
  els.problemSpacing = document.querySelector("#problemSpacing");
  els.includeAnswers = document.querySelector("#includeAnswers");
  els.includeAnswers.disabled = false;
}

function setup() {
  setupPrintControls();
  document.title = config.title;
  document.querySelector("[data-app-title]").textContent = config.title;
  document.querySelector("[data-app-notice]").textContent = config.notice || `${config.title}は開発中です。印刷はできますが、内容はあとで調整します。`;
  els.worksheetTitle.value = config.title;
  config.types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.value;
    option.textContent = type.label;
    els.problemType.append(option);
  });
  setupControls();
}

setup();
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
