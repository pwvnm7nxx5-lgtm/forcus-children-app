window.__printAdjustmentsOptions = {
  ...(window.__printAdjustmentsOptions || {}),
  forceAutoFit: true,
  showAutoFitControl: false,
};

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

const stateStorageKey = "calculation-problem-set-state-v3";
const problemCountMin = 1;
const horizontalProblemCountMax = 60;
const verticalProblemCountMax = 30;
const longDivisionProblemCountMax = 9;
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
  3: [
    ["add", "たし算"],
    ["sub", "ひき算"],
    ["mix", "たし算・ひき算ミックス"],
    ["multiply", "かけ算"],
    ["divide", "わり算（あまりなし）"],
  ],
  4: [
    ["add", "たし算"],
    ["sub", "ひき算"],
    ["mix", "たし算・ひき算ミックス"],
    ["multiply", "かけ算"],
    ["divide", "わり算（あまりなし）"],
  ],
  5: [
    ["decimalAdd", "小数のたし算"],
    ["decimalSub", "小数のひき算"],
    ["decimalMix", "小数計算ミックス"],
    ["decimalMultiply", "小数のかけ算"],
    ["decimalDivide", "小数のわり算"],
  ],
  6: [
    ["fractionMultiply", "分数のかけ算"],
    ["fractionDivide", "分数のわり算"],
    ["fractionMix", "分数計算ミックス"],
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
  return clampChoice(els.grade.value, ["1", "2", "3", "4", "5"], "2");
}

function allowedOperations(grade = getGrade()) {
  return operationOptions[grade].map(([value]) => value);
}

function getOperation() {
  const options = allowedOperations();
  return clampChoice(els.operation.value, options, options[0]);
}

function digitOptions(grade = getGrade(), operation = getOperation()) {
  if (grade === "5") return [["tenths", "小数第1位まで"]];
  if (grade === "6") return [["proper-fractions", "真分数どうし"]];
  if (operation === "multiply") {
    if (grade === "2") return [["one-one", "1桁 × 1桁"]];
    if (grade === "3") return [["one-one", "1桁 × 1桁"], ["two-one", "2桁 × 1桁"]];
    return [["three-two", "3桁 × 2桁"], ["four-two", "4桁 × 2桁"], ["three-three", "3桁 × 3桁"]];
  }
  if (operation === "divide") {
    if (grade === "3") return [["two-one", "2桁 ÷ 1桁"], ["three-one", "3桁 ÷ 1桁"]];
    return [["three-one", "3桁 ÷ 1桁"]];
  }
  if (grade === "1") {
    return [
      ["one-one", "1桁と1桁"],
      ["two-one", "2桁と1桁"],
    ];
  }
  if (grade === "3") {
    return [["three-two", "3桁と2桁"], ["three-three", "3桁と3桁"], ["four-three", "4桁と3桁"]];
  }
  if (grade === "4") {
    return [["four-three", "4桁と3桁"], ["four-four", "4桁と4桁"], ["five-four", "5桁と4桁"]];
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

function supportsStandardVerticalLayout() {
  return Number(getGrade()) <= 4 && ["add", "sub", "mix"].includes(getOperation());
}

function supportsLongDivisionLayout() {
  return (Number(getGrade()) >= 3 && Number(getGrade()) <= 4 && getOperation() === "divide")
    || (getGrade() === "5" && getOperation() === "decimalDivide");
}

function getActiveLayout() {
  return supportsStandardVerticalLayout() || supportsLongDivisionLayout()
    ? clampChoice(els.layoutMode.value, ["horizontal", "vertical"], "horizontal")
    : "horizontal";
}

function isLongDivisionLayout() {
  return getActiveLayout() === "vertical" && supportsLongDivisionLayout();
}

function getProblemCountMax(layout = getActiveLayout()) {
  if (layout === "vertical" && supportsLongDivisionLayout()) return longDivisionProblemCountMax;
  return layout === "vertical" ? verticalProblemCountMax : horizontalProblemCountMax;
}

function getProblemCount() {
  const count = clampNumber(els.problemCount.value, problemCountMin, getProblemCountMax(), 30);
  els.problemCount.value = String(count);
  return count;
}

function getColumnsMax() {
  if (isLongDivisionLayout()) return 3;
  return Number(getGrade()) >= 5 ? 2 : columnsMax;
}

function getColumns() {
  const columns = clampNumber(els.columns.value, columnsMin, getColumnsMax(), 3);
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

  const standardVertical = supportsStandardVerticalLayout();
  const layoutSupported = standardVertical || supportsLongDivisionLayout();
  const carrySupported = standardVertical && !(
    getGrade() === "1" && getDigits() === "one-one" && getOperation() !== "add"
  );
  const carryOption = els.carryMode.querySelector('option[value="with"]');
  carryOption.disabled = !carrySupported;
  carryOption.hidden = !carrySupported;
  els.carryMode.disabled = !carrySupported;
  if (!carrySupported && els.carryMode.value === "with") els.carryMode.value = "any";
  if (!standardVertical) els.carryMode.value = "any";

  els.layoutMode.disabled = !layoutSupported;
  if (!layoutSupported) els.layoutMode.value = "horizontal";
  els.showCarryBoxes.disabled = !standardVertical || getActiveLayout() !== "vertical";

  const max = getProblemCountMax();
  els.columns.max = String(getColumnsMax());
  getColumns();
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
  els.grade.value = clampChoice(settings.grade, ["1", "2", "3", "4", "5"], "2");
  syncSettingsControls();
  els.operation.value = clampChoice(settings.operation, allowedOperations(), allowedOperations()[0]);
  syncSettingsControls();
  els.digits.value = clampChoice(settings.digits, digitOptions().map(([value]) => value), digitOptions()[0][0]);
  els.carryMode.value = clampChoice(settings.carryMode, ["any", "with", "without"], "any");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "vertical"], "horizontal");
  els.difficulty.value = clampChoice(settings.difficulty, ["standard", "easy"], "standard");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, getProblemCountMax(), 30));
  els.columns.value = String(clampNumber(settings.columns, columnsMin, getColumnsMax(), 3));
  els.showCarryBoxes.checked = settings.showCarryBoxes === true;
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
  if (settings.grade === "2" && settings.digits === "two-one") {
    return position === "a" ? { min: 10, max: easy ? 49 : 99 } : { min: 1, max: easy ? 5 : 9 };
  }
  if (settings.grade === "2") return { min: 10, max: easy ? 49 : 99 };

  const digitWord = settings.digits.split("-")[position === "a" ? 0 : 1];
  const digitCount = { one: 1, two: 2, three: 3, four: 4, five: 5 }[digitWord] || 1;
  const min = digitCount === 1 ? 1 : 10 ** (digitCount - 1);
  const max = 10 ** digitCount - 1;
  return { min, max: easy ? Math.floor(max / 2) : max };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hasCarry(a, b) {
  while (a > 0 || b > 0) {
    if ((a % 10) + (b % 10) >= 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

function hasBorrow(a, b) {
  while (a > 0 || b > 0) {
    if (a % 10 < b % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

function matchesCarryMode(problem, settings) {
  if (settings.carryMode === "any") return true;
  const carries = problem.op === "+"
    ? hasCarry(problem.a, problem.b)
    : hasBorrow(problem.a, problem.b);
  return settings.carryMode === "with" ? carries : !carries;
}

function buildRandomPool(settings, makeProblem) {
  const target = Math.max(240, settings.count * 8);
  const candidates = [];
  const keys = new Set();
  for (let attempt = 0; attempt < target * 80 && candidates.length < target; attempt += 1) {
    const problem = makeProblem();
    if (!problem) continue;
    const key = problemKey(problem);
    if (keys.has(key)) continue;
    keys.add(key);
    candidates.push(problem);
  }
  return candidates;
}

function makeAddCandidates(settings) {
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const a = randomInt(aBounds.min, aBounds.max);
    const b = randomInt(bBounds.min, bBounds.max);
    const problem = { a, b, op: "+", answer: a + b };
    if (settings.grade === "1" && problem.answer > 20) return null;
    return matchesCarryMode(problem, settings) ? problem : null;
  });
}

function makeSubCandidates(settings) {
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const a = randomInt(aBounds.min, aBounds.max);
    const b = randomInt(bBounds.min, Math.min(bBounds.max, a));
    const problem = { a, b, op: "-", answer: a - b };
    return matchesCarryMode(problem, settings) ? problem : null;
  });
}

function makeMultiplyCandidates(settings) {
  if (settings.digits === "one-one") {
    const max = settings.difficulty === "easy" ? 5 : 9;
    return buildRandomPool(settings, () => {
      const a = randomInt(1, max);
      const b = randomInt(1, max);
      return { a, b, op: "×", answer: a * b };
    });
  }
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const a = randomInt(aBounds.min, aBounds.max);
    const b = randomInt(bBounds.min, bBounds.max);
    return { a, b, op: "×", answer: a * b };
  });
}

function makeDivideCandidates(settings) {
  const dividendBounds = numberBounds(settings, "a");
  const maxDivisor = settings.difficulty === "easy" ? 5 : 9;
  return buildRandomPool(settings, () => {
    const divisor = randomInt(2, maxDivisor);
    const maxQuotient = Math.floor(dividendBounds.max / divisor);
    if (maxQuotient < 2) return null;
    const quotient = randomInt(2, maxQuotient);
    const dividend = divisor * quotient;
    if (dividend < dividendBounds.min) return null;
    const problem = { a: dividend, b: divisor, op: "÷", answer: quotient };
    if (settings.layout === "vertical") {
      problem.longDivision = {
        divisor,
        dividend,
        quotient,
        divisorDigits: String(divisor).length,
        dividendDecimalAfterIndex: -1,
        quotientDecimalAfterIndex: -1,
      };
    }
    return problem;
  });
}

function formatDecimal(value, places, trim = false) {
  const text = (value / (10 ** places)).toFixed(places);
  return trim ? text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1") : text;
}

function makeDecimalCandidates(settings) {
  const easy = settings.difficulty === "easy";
  const max = easy ? 499 : 999;
  const maxMultiplier = easy ? 49 : 99;
  return buildRandomPool(settings, () => {
    const type = settings.operation === "decimalMix"
      ? ["decimalAdd", "decimalSub", "decimalMultiply", "decimalDivide"][randomInt(0, 3)]
      : settings.operation;

    if (type === "decimalAdd" || type === "decimalSub") {
      let a = randomInt(10, max);
      let b = randomInt(10, max);
      if (type === "decimalSub" && b > a) [a, b] = [b, a];
      return {
        a: formatDecimal(a, 1),
        b: formatDecimal(b, 1),
        op: type === "decimalAdd" ? "+" : "-",
        answer: formatDecimal(type === "decimalAdd" ? a + b : a - b, 1),
      };
    }

    if (type === "decimalMultiply") {
      const a = randomInt(10, max);
      const b = randomInt(2, maxMultiplier);
      return {
        a: formatDecimal(a, 1),
        b: formatDecimal(b, 1),
        op: "×",
        answer: formatDecimal(a * b, 2),
      };
    }

    if (settings.layout === "vertical") {
      const divisor = randomInt(2, easy ? 5 : 9);
      const quotient = randomInt(10, easy ? 99 : 299);
      const dividend = divisor * quotient;
      return {
        a: formatDecimal(dividend, 1),
        b: String(divisor),
        op: "÷",
        answer: formatDecimal(quotient, 1),
        longDivision: {
          divisor,
          dividend,
          quotient,
          divisorDigits: 1,
          dividendDecimalAfterIndex: String(dividend).length - 2,
          quotientDecimalAfterIndex: String(quotient).length - 2,
        },
      };
    }

    const divisor = randomInt(10, maxMultiplier);
    const quotient = randomInt(10, easy ? 99 : 299);
    const dividend = divisor * quotient;
    return {
      a: formatDecimal(dividend, 2, true),
      b: formatDecimal(divisor, 1),
      op: "÷",
      answer: formatDecimal(quotient, 1, true),
    };
  });
}

function greatestCommonDivisor(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function simplifyFraction(numerator, denominator) {
  const divisor = greatestCommonDivisor(Math.abs(numerator), Math.abs(denominator));
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function fractionText({ numerator, denominator }) {
  return `${numerator}/${denominator}`;
}

function randomProperFraction(maxDenominator) {
  const denominator = randomInt(2, maxDenominator);
  return { numerator: randomInt(1, denominator - 1), denominator };
}

function makeFractionCandidates(settings) {
  const maxDenominator = settings.difficulty === "easy" ? 6 : 12;
  return buildRandomPool(settings, () => {
    const type = settings.operation === "fractionMix"
      ? (Math.random() < 0.5 ? "fractionMultiply" : "fractionDivide")
      : settings.operation;
    const a = randomProperFraction(maxDenominator);
    const b = randomProperFraction(maxDenominator);
    const result = type === "fractionMultiply"
      ? simplifyFraction(a.numerator * b.numerator, a.denominator * b.denominator)
      : simplifyFraction(a.numerator * b.denominator, a.denominator * b.numerator);
    return {
      a: fractionText(a),
      b: fractionText(b),
      op: type === "fractionMultiply" ? "×" : "÷",
      answer: fractionText(result),
    };
  });
}

function makeCandidatePool(settings) {
  if (settings.operation.startsWith("decimal")) return makeDecimalCandidates(settings);
  if (settings.operation.startsWith("fraction")) return makeFractionCandidates(settings);
  if (settings.operation === "multiply") return makeMultiplyCandidates(settings);
  if (settings.operation === "divide") return makeDivideCandidates(settings);
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

function buildLongDivisionTrace(details) {
  const dividendDigits = String(details.dividend).split("").map(Number);
  const quotientDigits = String(details.quotient).split("").map(Number);
  const quotientOffset = dividendDigits.length - quotientDigits.length;
  const rows = [];
  let remainder = 0;
  let started = false;

  dividendDigits.forEach((digit, index) => {
    const current = remainder * 10 + digit;
    const quotientDigit = Math.floor(current / details.divisor);
    if (!started && quotientDigit === 0) {
      remainder = current;
      return;
    }

    started = true;
    const product = quotientDigit * details.divisor;
    rows.push({ value: product, endIndex: index, lineAfter: true });
    remainder = current - product;
    rows.push({
      value: index < dividendDigits.length - 1 ? remainder * 10 + dividendDigits[index + 1] : remainder,
      endIndex: index < dividendDigits.length - 1 ? index + 1 : index,
    });
  });

  return { dividendDigits, quotientDigits, quotientOffset, rows };
}

function addDivisionBoardCell(board, row, column) {
  const cell = document.createElement("span");
  cell.className = "division-board-cell";
  cell.style.gridRow = String(row);
  cell.style.gridColumn = String(column);
  board.append(cell);
}

function addDivisionBoardDigit(board, value, row, column, className = "") {
  const digit = document.createElement("span");
  digit.className = `division-board-digit ${className}`.trim();
  digit.textContent = String(value);
  digit.style.gridRow = String(row);
  digit.style.gridColumn = String(column);
  board.append(digit);
}

function addDivisionBoardDecimal(board, row, column, answer = false) {
  const decimal = document.createElement("span");
  decimal.className = `division-board-decimal${answer ? " answer-point" : ""}`;
  decimal.textContent = "●";
  decimal.style.gridRow = String(row);
  decimal.style.gridColumn = String(column);
  board.append(decimal);
}

function addDivisionBoardValue(board, value, row, startColumn, decimalAfterIndex, className) {
  String(value).split("").forEach((digit, index) => {
    addDivisionBoardDigit(board, digit, row, startColumn + index, className);
  });
  if (decimalAfterIndex >= 0) addDivisionBoardDecimal(board, row, startColumn + decimalAfterIndex);
}

function addAlignedDivisionNumber(board, value, row, endIndex, divisorDigits, className) {
  const digits = String(value).split("");
  const startIndex = endIndex - digits.length + 1;
  digits.forEach((digit, index) => {
    addDivisionBoardDigit(board, digit, row, divisorDigits + startIndex + index + 1, className);
  });
}

function addDivisionFrame(board, divisorDigits, boardColumns) {
  const frame = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  frame.classList.add("division-frame");
  frame.setAttribute("viewBox", `0 0 ${boardColumns * 100} 100`);
  frame.setAttribute("preserveAspectRatio", "none");
  frame.setAttribute("aria-hidden", "true");
  const boundary = divisorDigits * 100;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${boardColumns * 100} 1 H ${boundary - 24} C ${boundary - 4} 13, ${boundary - 4} 87, ${boundary - 24} 99`);
  path.setAttribute("vector-effect", "non-scaling-stroke");
  frame.append(path);
  board.append(frame);
}

function makeLongDivisionBoard(problem, showAnswer, boardRows, boardColumns) {
  const details = problem.longDivision;
  const trace = buildLongDivisionTrace(details);
  const board = document.createElement("span");
  board.className = "long-division-board";
  board.style.setProperty("--division-board-rows", String(boardRows));
  board.style.setProperty("--division-board-columns", String(boardColumns));

  for (let row = 1; row <= boardRows; row += 1) {
    for (let column = 1; column <= boardColumns; column += 1) addDivisionBoardCell(board, row, column);
  }

  addDivisionFrame(board, details.divisorDigits, boardColumns);
  addDivisionBoardValue(board, details.divisor, 2, 1, -1, "given-digit");
  addDivisionBoardValue(
    board,
    details.dividend,
    2,
    details.divisorDigits + 1,
    details.dividendDecimalAfterIndex,
    "given-digit",
  );

  if (showAnswer) {
    trace.quotientDigits.forEach((digit, index) => {
      addDivisionBoardDigit(board, digit, 1, details.divisorDigits + trace.quotientOffset + index + 1, "answer-digit");
    });
    if (details.quotientDecimalAfterIndex >= 0) {
      addDivisionBoardDecimal(
        board,
        1,
        details.divisorDigits + trace.quotientOffset + details.quotientDecimalAfterIndex + 1,
        true,
      );
    }
    trace.rows.slice(0, boardRows - 2).forEach((traceRow, index) => {
      const row = index + 3;
      addAlignedDivisionNumber(board, traceRow.value, row, traceRow.endIndex, details.divisorDigits, "answer-digit");
      if (traceRow.lineAfter) {
        const line = document.createElement("span");
        line.className = "division-work-line";
        line.style.gridRow = String(row);
        line.style.gridColumn = `${details.divisorDigits + 1} / ${boardColumns + 1}`;
        board.append(line);
      }
    });
  }
  return board;
}

function getLongDivisionBoardSize(pageProblems) {
  return pageProblems.reduce((size, problem) => {
    const trace = buildLongDivisionTrace(problem.longDivision);
    return {
      rows: Math.max(size.rows, trace.rows.length + 2, 6),
      columns: Math.max(
        size.columns,
        problem.longDivision.divisorDigits + String(problem.longDivision.dividend).length,
        4,
      ),
    };
  }, { rows: 6, columns: 4 });
}

function getVerticalDigitCount(problems) {
  return Math.max(2, ...problems.map((problem) => Math.max(String(problem.a).length, String(problem.b).length, String(problem.answer).length)));
}

function makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize) {
  if (settings.layout === "vertical" && problem.longDivision) {
    return makeLongDivisionBoard(problem, showAnswer, longDivisionBoardSize.rows, longDivisionBoardSize.columns);
  }
  return settings.layout === "vertical"
    ? makeVerticalFormula(problem, showAnswer, settings, verticalDigitCount)
    : makeHorizontalFormula(problem, showAnswer);
}

function applyGridDensity(list, settings, longDivisionBoardSize = null) {
  const rows = Math.ceil(settings.count / settings.columns);
  const vertical = settings.layout === "vertical";
  let rowGap = vertical ? 6 : 8;
  let problemMin = vertical ? 28 : 13;
  let fontSize = vertical ? 24 : 21;
  let blankWidth = 12;
  let blankHeight = 9;
  if (longDivisionBoardSize) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2) / longDivisionBoardSize.rows;
    const widthCellSize = availableWidth / longDivisionBoardSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * longDivisionBoardSize.rows + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--division-cell-size", `${cellSize.toFixed(2)}mm`);
  } else if (!vertical && rows > 24) {
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
  const longDivisionBoardSize = settings.layout === "vertical" && pageProblems.some((problem) => problem.longDivision)
    ? getLongDivisionBoardSize(pageProblems)
    : null;
  applyGridDensity(list, settings, longDivisionBoardSize);
  const verticalDigitCount = settings.layout === "vertical" ? getVerticalDigitCount(pageProblems) : 0;
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize));
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
  els.layoutMode.addEventListener("change", () => {
    if (isLongDivisionLayout() && Number(els.columns.value) === 2) els.columns.value = "3";
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
