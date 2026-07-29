const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  grade: document.querySelector("#grade"),
  operation: document.querySelector("#operation"),
  digits: document.querySelector("#digits"),
  carryMode: document.querySelector("#carryMode"),
  layoutMode: document.querySelector("#layoutMode"),
  difficulty: document.querySelector("#difficulty"),
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

const stateStorageKey = "calculation-problem-set-state-v1";
const problemCountMin = 1;
const horizontalProblemCountMax = 60;
const verticalProblemCountMax = 30;
const columnsMin = 1;
const columnsMax = 6;
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";

const operationOptions = {
  1: [
    ["add", "たし算"],
    ["sub", "ひき算"],
    ["mix", "たし算・ひき算ミックス"],
  ],
  2: [
    ["add", "たし算"],
    ["sub", "ひき算"],
    ["mix", "たし算・ひき算ミックス"],
    ["multiply", "かけ算（九九）"],
  ],
};

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getGrade() {
  return clampChoice(els.grade.value, ["1", "2"], "2");
}

function allowedOperations(grade = getGrade()) {
  return operationOptions[grade].map(([value]) => value);
}

function getOperation() {
  const options = allowedOperations();
  return clampChoice(els.operation.value, options, options[0]);
}

function digitOptions(grade = getGrade(), operation = getOperation()) {
  if (operation === "multiply") {
    return [["one-one", "1桁 × 1桁"]];
  }
  if (grade === "1") {
    return [
      ["one-one", "1桁と1桁"],
      ["two-one", "2桁と1桁"],
    ];
  }
  return [
    ["two-one", "2桁と1桁"],
    ["two-two", "2桁と2桁"],
  ];
}

function getDigits() {
  const options = digitOptions().map(([value]) => value);
  return clampChoice(els.digits.value, options, options[0]);
}

function getActiveLayout() {
  return getOperation() === "multiply" ? "horizontal" : clampChoice(els.layoutMode.value, ["horizontal", "vertical"], "horizontal");
}

function getProblemCountMax(layout = getActiveLayout()) {
  return layout === "vertical" ? verticalProblemCountMax : horizontalProblemCountMax;
}

function getProblemCount() {
  const count = clampNumber(els.problemCount.value, problemCountMin, getProblemCountMax(), 30);
  els.problemCount.value = String(count);
  return count;
}

function getColumns() {
  const columns = clampNumber(els.columns.value, columnsMin, columnsMax, 3);
  els.columns.value = String(columns);
  return columns;
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || "計算問題集",
    grade: getGrade(),
    operation: getOperation(),
    digits: getDigits(),
    carryMode: clampChoice(els.carryMode.value, ["any", "with", "without"], "any"),
    layout: getActiveLayout(),
    difficulty: clampChoice(els.difficulty.value, ["standard", "easy"], "standard"),
    count: getProblemCount(),
    columns: getColumns(),
    showCarryBoxes: els.showCarryBoxes.checked,
  };
}

function replaceOptions(select, options, selectedValue) {
  select.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }));
  select.value = options.some(([value]) => value === selectedValue) ? selectedValue : options[0][0];
}

function syncSettingsControls() {
  const currentOperation = els.operation.value;
  replaceOptions(els.operation, operationOptions[getGrade()], currentOperation);

  const currentDigits = els.digits.value;
  replaceOptions(els.digits, digitOptions(), currentDigits);

  const multiplication = getOperation() === "multiply";
  const carrySupported = !multiplication && !(
    getGrade() === "1" && getDigits() === "one-one" && getOperation() !== "add"
  );
  const carryOption = els.carryMode.querySelector('option[value="with"]');
  carryOption.disabled = !carrySupported;
  carryOption.hidden = !carrySupported;
  els.carryMode.disabled = multiplication;
  if (!carrySupported && els.carryMode.value === "with") els.carryMode.value = "any";
  if (multiplication) els.carryMode.value = "any";

  els.layoutMode.disabled = multiplication;
  if (multiplication) els.layoutMode.value = "horizontal";
  els.showCarryBoxes.disabled = getActiveLayout() !== "vertical";

  const max = getProblemCountMax();
  els.problemCount.max = String(max);
  Array.from(els.problemCountPreset.options).forEach((option) => {
    if (!option.value) return;
    const disabled = Number.parseInt(option.value, 10) > max;
    option.disabled = disabled;
    option.hidden = disabled;
  });
  getProblemCount();
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || "計算問題集";
  els.grade.value = clampChoice(settings.grade, ["1", "2"], "2");
  syncSettingsControls();
  els.operation.value = clampChoice(settings.operation, allowedOperations(), allowedOperations()[0]);
  syncSettingsControls();
  els.digits.value = clampChoice(settings.digits, digitOptions().map(([value]) => value), digitOptions()[0][0]);
  els.carryMode.value = clampChoice(settings.carryMode, ["any", "with", "without"], "any");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "vertical"], "horizontal");
  els.difficulty.value = clampChoice(settings.difficulty, ["standard", "easy"], "standard");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, getProblemCountMax(), 30));
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, 3));
  els.showCarryBoxes.checked = settings.showCarryBoxes !== false;
  syncSettingsControls();
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function numberBounds(settings, position) {
  const easy = settings.difficulty === "easy";
  if (settings.grade === "1") {
    if (settings.digits === "one-one") return { min: 1, max: easy ? 5 : 9 };
    return position === "a" ? { min: 10, max: easy ? 15 : 19 } : { min: 1, max: easy ? 5 : 9 };
  }
  if (settings.digits === "two-one") {
    return position === "a" ? { min: 10, max: easy ? 49 : 99 } : { min: 1, max: easy ? 5 : 9 };
  }
  return { min: 10, max: easy ? 49 : 99 };
}

function matchesCarryMode(problem, settings) {
  if (settings.carryMode === "any" || problem.op === "×") return true;
  const carries = problem.op === "+"
    ? (problem.a % 10) + (problem.b % 10) >= 10
    : problem.a % 10 < problem.b % 10;
  return settings.carryMode === "with" ? carries : !carries;
}

function makeAddCandidates(settings) {
  const candidates = [];
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  for (let a = aBounds.min; a <= aBounds.max; a += 1) {
    for (let b = bBounds.min; b <= bBounds.max; b += 1) {
      const answer = a + b;
      if (settings.grade === "1" && answer > 20) continue;
      const problem = { a, b, op: "+", answer };
      if (matchesCarryMode(problem, settings)) candidates.push(problem);
    }
  }
  return candidates;
}

function makeSubCandidates(settings) {
  const candidates = [];
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  for (let a = aBounds.min; a <= aBounds.max; a += 1) {
    for (let b = bBounds.min; b <= bBounds.max; b += 1) {
      if (b > a) continue;
      const problem = { a, b, op: "−", answer: a - b };
      if (matchesCarryMode(problem, settings)) candidates.push(problem);
    }
  }
  return candidates;
}

function makeMultiplyCandidates(settings) {
  const max = settings.difficulty === "easy" ? 5 : 9;
  const candidates = [];
  for (let a = 1; a <= max; a += 1) {
    for (let b = 1; b <= max; b += 1) {
      candidates.push({ a, b, op: "×", answer: a * b });
    }
  }
  return candidates;
}

function makeCandidatePool(settings) {
  if (settings.operation === "multiply") return makeMultiplyCandidates(settings);
  if (settings.operation === "add") return makeAddCandidates(settings);
  if (settings.operation === "sub") return makeSubCandidates(settings);
  return [...makeAddCandidates(settings), ...makeSubCandidates(settings)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[otherIndex]] = [copy[otherIndex], copy[index]];
  }
  return copy;
}

function problemKey(problem) {
  return `${problem.a}${problem.op}${problem.b}`;
}

function sheetSignature(settings) {
  return JSON.stringify({
    grade: settings.grade,
    operation: settings.operation,
    digits: settings.digits,
    carryMode: settings.carryMode,
    layout: settings.layout,
    difficulty: settings.difficulty,
    count: settings.count,
  });
}

function selectProblems(settings, usedKeys = new Set()) {
  const pool = shuffle(makeCandidatePool(settings));
  const selected = [];
  const seen = new Set();

  pool.forEach((problem) => {
    if (selected.length >= settings.count) return;
    const key = problemKey(problem);
    if (!seen.has(key) && !usedKeys.has(key)) {
      selected.push(problem);
      seen.add(key);
      usedKeys.add(key);
    }
  });
  pool.forEach((problem) => {
    if (selected.length >= settings.count) return;
    const key = problemKey(problem);
    if (!seen.has(key)) {
      selected.push(problem);
      seen.add(key);
    }
  });
  while (selected.length < settings.count && pool.length) {
    selected.push(pool[selected.length % pool.length]);
  }
  return selected;
}

function generateProblems() {
  syncSettingsControls();
  const settings = getSettings();
  problems = selectProblems(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("問題を作り直しました。");
}

function makeHorizontalFormula(problem, showAnswer) {
  const formula = document.createElement("span");
  formula.className = "formula";
  const answer = showAnswer ? `<span class="answer-value">${problem.answer}</span>` : '<span class="blank">□</span>';
  formula.innerHTML = `<span>${problem.a} ${problem.op} ${problem.b} =</span>${answer}`;
  return formula;
}

function formatDigits(value, width) {
  return String(value).padStart(width, " ").slice(-width).split("");
}

function makeDigitCell(digit, showCarryBoxes, blank = false) {
  const cell = document.createElement("span");
  cell.className = "digit-cell";
  if (showCarryBoxes) {
    const helper = document.createElement("span");
    helper.className = "helper-box";
    cell.append(helper);
  }
  if (!blank && digit !== " ") {
    const value = document.createElement("span");
    value.className = "digit-value";
    value.textContent = digit;
    cell.append(value);
  }
  return cell;
}

function operatorShift(digits) {
  const firstDigitIndex = digits.findIndex((digit) => digit !== " ");
  if (firstDigitIndex <= 0) return "0mm";
  return Array.from({ length: firstDigitIndex }, () => "var(--digit-size)").join(" + ");
}

function makeDigitRow(digits, operator = "", showCarryBoxes = true, blank = false, operatorAnchorDigits = digits) {
  const row = document.createElement("span");
  row.className = "digit-row";
  row.style.setProperty("--operator-shift", operatorShift(operatorAnchorDigits));
  const operatorElement = document.createElement("span");
  operatorElement.className = "operator";
  operatorElement.textContent = operator;
  row.append(operatorElement);
  digits.forEach((digit) => row.append(makeDigitCell(digit, showCarryBoxes, blank)));
  return row;
}

function makeVerticalFormula(problem, showAnswer, settings, width) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  formula.style.setProperty("--digit-count", String(width));
  const firstRow = formatDigits(problem.a, width);
  const secondRow = formatDigits(problem.b, width);
  const operatorAnchor = [firstRow, secondRow].reduce((widest, digits) => (
    digits.findIndex((digit) => digit !== " ") < widest.findIndex((digit) => digit !== " ") ? digits : widest
  ));
  formula.append(makeDigitRow(firstRow, "", settings.showCarryBoxes));
  formula.append(makeDigitRow(secondRow, problem.op, settings.showCarryBoxes, false, operatorAnchor));
  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);
  formula.append(makeDigitRow(formatDigits(showAnswer ? problem.answer : "", width), "", settings.showCarryBoxes, !showAnswer));
  return formula;
}

function getVerticalDigitCount(problems) {
  return Math.max(2, ...problems.map((problem) => Math.max(String(problem.a).length, String(problem.b).length, String(problem.answer).length)));
}

function makeFormula(problem, showAnswer, settings, verticalDigitCount) {
  return settings.layout === "vertical"
    ? makeVerticalFormula(problem, showAnswer, settings, verticalDigitCount)
    : makeHorizontalFormula(problem, showAnswer);
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
    [rowGap, problemMin, fontSize, blankWidth, blankHeight] = [1.5, 5.8, 16, 8, 5.5];
  } else if (!vertical && rows > 18) {
    [rowGap, problemMin, fontSize, blankWidth, blankHeight] = [3, 8.2, 18, 10, 7];
  } else if (!vertical && rows > 14) {
    [rowGap, problemMin, fontSize, blankWidth, blankHeight] = [5, 10.5, 19, 11, 8];
  } else if (vertical && rows > 20) {
    [rowGap, problemMin, fontSize] = [3, 20, 19];
  } else if (vertical && rows > 14) {
    [rowGap, problemMin, fontSize] = [4, 23, 21];
  }
  list.style.setProperty("--row-gap", `${rowGap}mm`);
  list.style.setProperty("--problem-min", `${problemMin}mm`);
  list.style.setProperty("--problem-font", `${fontSize}px`);
  list.style.setProperty("--blank-w", `${blankWidth}mm`);
  list.style.setProperty("--blank-h", `${blankHeight}mm`);
}

function renderPage(kind, showAnswer, pageProblems = problems) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.classList.toggle("vertical-layout", settings.layout === "vertical");
  page.classList.toggle("answer-page", showAnswer);
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  kindLabel.classList.toggle("answer", showAnswer);
  const list = page.querySelector("[data-problems]");
  list.style.setProperty("--cols", settings.columns);
  applyGridDensity(list, settings);
  const verticalDigitCount = settings.layout === "vertical" ? getVerticalDigitCount(pageProblems) : 0;
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeFormula(problem, showAnswer, settings, verticalDigitCount));
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
  if (!sheetProblemSets.length) sheetProblemSets.push(problems.length ? problems.slice(0, settings.count) : selectProblems(settings));
  const usedKeys = new Set(sheetProblemSets.flat().map(problemKey));
  while (sheetProblemSets.length < sheetCount) sheetProblemSets.push(selectProblems(settings, usedKeys));
  sheetProblemSets = sheetProblemSets.slice(0, sheetCount);
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
    if (includeAnswers) pages.push(renderPage(`こたえ${suffix}`, true, set));
  });
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  saveState();
}

function render() {
  syncSettingsControls();
  const settings = getSettings();
  if (!problems.length || problems.length < settings.count) problems = selectProblems(settings);
  if (problems.length > settings.count) problems = problems.slice(0, settings.count);
  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
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
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(value) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(stateStorageKey, JSON.stringify(getShareState()));
  } catch {
    // The worksheet works even when local storage is unavailable.
  }
}

function loadInitialState() {
  const encoded = window.location.hash.replace(/^#data=/, "");
  const sharedState = encoded ? decodeState(encoded) : null;
  if (sharedState?.settings && Array.isArray(sharedState.problems)) {
    applySettings(sharedState.settings);
    problems = sharedState.problems;
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(stateStorageKey) || "null");
    if (saved?.settings) applySettings(saved.settings);
    if (Array.isArray(saved?.problems)) problems = saved.problems;
  } catch {
    // Ignore unavailable or malformed local storage.
  }
}

async function copyShareUrl() {
  const url = `${window.location.origin}${window.location.pathname}#data=${encodeState(getShareState())}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encodeState(getShareState())}`;
    setStatus("URL欄に共有用データを入れました。");
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle, els.columns].forEach((control) => {
    control.addEventListener("input", () => {
      if (control === els.columns && control.value === "") return;
      render();
    });
  });
  [els.grade, els.operation, els.digits, els.carryMode, els.layoutMode, els.difficulty].forEach((control) => {
    control.addEventListener("change", generateProblems);
  });
  els.showCarryBoxes.addEventListener("change", render);
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") return;
    els.problemCountPreset.value = "";
    generateProblems();
  });
  els.problemCountPreset.addEventListener("change", () => {
    if (!els.problemCountPreset.value) return;
    els.problemCount.value = els.problemCountPreset.value;
    els.problemCountPreset.value = "";
    generateProblems();
  });
  els.printBtn.addEventListener("click", () => {
    render();
    window.print();
  });
  els.regenerateBtn.addEventListener("click", generateProblems);
  els.copyLinkBtn.addEventListener("click", copyShareUrl);
}

loadInitialState();
syncSettingsControls();
bindEvents();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
if (!problems.length) generateProblems();
else render();
