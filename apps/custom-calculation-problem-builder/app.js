window.__printAdjustmentsOptions = {
  ...(window.__printAdjustmentsOptions || {}),
  forceAutoFit: true,
  showAutoFitControl: false,
};

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  operation: document.querySelector("#operation"),
  digitsA: document.querySelector("#digitsA"),
  digitsB: document.querySelector("#digitsB"),
  digitsALabel: document.querySelector("#digitsALabel"),
  digitsBLabel: document.querySelector("#digitsBLabel"),
  carryMode: document.querySelector("#carryMode"),
  layoutMode: document.querySelector("#layoutMode"),
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

const stateStorageKey = "custom-calculation-problem-builder-state-v1";
const problemCountMin = 1;
const horizontalProblemCountMax = 60;
const verticalProblemCountMax = 30;
const longDivisionProblemCountMax = 6;
const multiplicationProblemCountMax = 6;
const calculationWorkspaceRowsPerColumn = 4;
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

const customOperationOptions = [
  ["add", "たし算"],
  ["sub", "ひき算"],
  ["multiply", "かけ算"],
  ["divide", "わり算（あまりなし）"],
  ["decimalAdd", "小数のたし算"],
  ["decimalSub", "小数のひき算"],
  ["decimalMultiply", "小数のかけ算"],
  ["decimalDivideInteger", "小数 ÷ 整数"],
  ["integerDivideDecimal", "整数 ÷ 小数"],
  ["decimalDivideDecimal", "小数 ÷ 小数"],
];

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getGrade() {
  return "custom";
}

function allowedOperations() {
  return customOperationOptions.map(([value]) => value);
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

function getOperandDigits(position) {
  const control = position === "a" ? els.digitsA : els.digitsB;
  return clampNumber(control.value, 1, 5, position === "a" ? 2 : 3);
}

function isDecimalOperation(operation = getOperation()) {
  return operation.startsWith("decimal") || operation === "integerDivideDecimal";
}

function supportsSimpleVerticalLayout() {
  return ["add", "sub", "decimalAdd", "decimalSub"].includes(getOperation());
}

function supportsMultiplicationVerticalLayout() {
  return ["multiply", "decimalMultiply"].includes(getOperation());
}

function supportsLongDivisionLayout() {
  return ["divide", "decimalDivideInteger", "integerDivideDecimal", "decimalDivideDecimal"].includes(getOperation());
}

function getActiveLayout() {
  return supportsSimpleVerticalLayout() || supportsMultiplicationVerticalLayout() || supportsLongDivisionLayout()
    ? clampChoice(els.layoutMode.value, ["horizontal", "horizontal-workspace", "vertical"], "horizontal")
    : "horizontal";
}

function isCalculationWorkspaceLayout() {
  return getActiveLayout() === "horizontal-workspace";
}

function usesVerticalProblemData(settings) {
  return ["vertical", "horizontal-workspace"].includes(settings.layout);
}

function isLongDivisionLayout() {
  return getActiveLayout() === "vertical" && supportsLongDivisionLayout();
}

function isMultiplicationVerticalLayout() {
  return getActiveLayout() === "vertical" && supportsMultiplicationVerticalLayout();
}

function getProblemCountMax(layout = getActiveLayout()) {
  if (layout === "horizontal-workspace") return getWorkspaceProblemCountMax();
  if (layout === "vertical" && supportsLongDivisionLayout()) return longDivisionProblemCountMax;
  if (layout === "vertical" && supportsMultiplicationVerticalLayout()) return multiplicationProblemCountMax;
  return layout === "vertical" ? verticalProblemCountMax : horizontalProblemCountMax;
}

function getWorkspaceProblemCountMax() {
  if (supportsLongDivisionLayout()) return longDivisionProblemCountMax;
  if (supportsMultiplicationVerticalLayout()) return multiplicationProblemCountMax;
  const columns = clampNumber(els.columns.value, columnsMin, 3, 3);
  return columns * calculationWorkspaceRowsPerColumn;
}

function getProblemCount() {
  const count = clampNumber(els.problemCount.value, problemCountMin, getProblemCountMax(), 30);
  els.problemCount.value = String(count);
  return count;
}

function getColumnsMax() {
  if (isCalculationWorkspaceLayout()) return 3;
  if (isLongDivisionLayout() || isMultiplicationVerticalLayout()) return 2;
  return columnsMax;
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
    title: els.worksheetTitle.value || "計算問題作成",
    operation: getOperation(),
    digitsA: getOperandDigits("a"),
    digitsB: getOperandDigits("b"),
    carryMode: clampChoice(els.carryMode.value, ["any", "with", "without"], "any"),
    layout: getActiveLayout(),
    difficulty: "standard",
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
  if (!els.operation.options.length) {
    replaceOptions(els.operation, customOperationOptions, "add");
  }
  els.operation.value = clampChoice(els.operation.value, allowedOperations(), "add");

  const operation = getOperation();
  const decimalDivisionOperations = ["decimalDivideInteger", "integerDivideDecimal", "decimalDivideDecimal"];
  const decimalDivision = decimalDivisionOperations.includes(operation);
  const orderedOperands = ["sub", "divide", ...decimalDivisionOperations].includes(operation);
  const division = operation === "divide";
  if (isDecimalOperation(operation)) {
    els.digitsALabel.textContent = decimalDivision && operation === "integerDivideDecimal" ? "わられる数の桁数" : "1つ目の整数部分の桁数";
    els.digitsBLabel.textContent = decimalDivision && operation === "decimalDivideInteger" ? "わる数の桁数" : "2つ目の整数部分の桁数";
  } else {
    els.digitsALabel.textContent = division ? "わられる数の桁数" : (orderedOperands ? "大きい数の桁数" : "1つ目の桁数");
    els.digitsBLabel.textContent = division ? "わる数の桁数" : (orderedOperands ? "小さい数の桁数" : "2つ目の桁数");
  }
  Array.from(els.digitsB.options).forEach((option) => {
    option.disabled = orderedOperands && Number(option.value) > getOperandDigits("a");
  });
  if (orderedOperands && getOperandDigits("b") > getOperandDigits("a")) {
    els.digitsB.value = String(getOperandDigits("a"));
  }

  const simpleVertical = supportsSimpleVerticalLayout();
  const multiplicationVertical = supportsMultiplicationVerticalLayout();
  const layoutSupported = simpleVertical || multiplicationVertical || supportsLongDivisionLayout();
  const carryModeSupported = ["add", "sub", "decimalAdd", "decimalSub"].includes(getOperation());
  const carryOption = els.carryMode.querySelector('option[value="with"]');
  carryOption.disabled = !carryModeSupported;
  carryOption.hidden = !carryModeSupported;
  els.carryMode.disabled = !carryModeSupported;
  if (!carryModeSupported && els.carryMode.value === "with") els.carryMode.value = "any";
  if (!carryModeSupported) els.carryMode.value = "any";

  els.layoutMode.disabled = !layoutSupported;
  if (!layoutSupported) els.layoutMode.value = "horizontal";
  els.showCarryBoxes.disabled = !(simpleVertical || multiplicationVertical) || getActiveLayout() !== "vertical";

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
  els.worksheetTitle.value = settings.title || "計算問題作成";
  syncSettingsControls();
  els.operation.value = clampChoice(settings.operation, allowedOperations(), allowedOperations()[0]);
  syncSettingsControls();
  els.digitsA.value = String(clampNumber(settings.digitsA, 1, 5, 2));
  els.digitsB.value = String(clampNumber(settings.digitsB, 1, 5, 3));
  els.carryMode.value = clampChoice(settings.carryMode, ["any", "with", "without"], "any");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "horizontal-workspace", "vertical"], "horizontal");
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
  const digits = position === "a" ? settings.digitsA : settings.digitsB;
  const min = digits === 1 ? 1 : 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return { min, max: easy ? Math.floor((min + max) / 2) : max };
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
  const a = problem.carryA ?? problem.a;
  const b = problem.carryB ?? problem.b;
  const carries = problem.op === "+"
    ? hasCarry(a, b)
    : hasBorrow(a, b);
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
  const divisorBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const divisor = randomInt(divisorBounds.min, divisorBounds.max);
    const minQuotient = Math.max(1, Math.ceil(dividendBounds.min / divisor));
    const maxQuotient = Math.floor(dividendBounds.max / divisor);
    if (maxQuotient < minQuotient) return null;
    const quotient = randomInt(minQuotient, maxQuotient);
    const dividend = divisor * quotient;
    if (dividend < dividendBounds.min || dividend > dividendBounds.max) return null;
    const problem = { a: dividend, b: divisor, op: "÷", answer: quotient };
    if (usesVerticalProblemData(settings)) {
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
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  const scaledMin = (bounds) => bounds.min * 10;
  const scaledMax = (bounds) => bounds.max * 10 + 9;

  return buildRandomPool(settings, () => {
    const type = settings.operation;

    if (type === "decimalAdd" || type === "decimalSub") {
      let a = randomInt(scaledMin(aBounds), scaledMax(aBounds));
      let b = randomInt(scaledMin(bBounds), scaledMax(bBounds));
      if (type === "decimalSub" && b > a) [a, b] = [b, a];
      const problem = {
        a: formatDecimal(a, 1),
        b: formatDecimal(b, 1),
        op: type === "decimalAdd" ? "+" : "-",
        answer: formatDecimal(type === "decimalAdd" ? a + b : a - b, 1),
        carryA: a,
        carryB: b,
      };
      return matchesCarryMode(problem, settings) ? problem : null;
    }

    if (type === "decimalMultiply") {
      const a = randomInt(scaledMin(aBounds), scaledMax(aBounds));
      const b = randomInt(scaledMin(bBounds), scaledMax(bBounds));
      return {
        a: formatDecimal(a, 1),
        b: formatDecimal(b, 1),
        op: "×",
        answer: formatDecimal(a * b, 2),
      };
    }

    if (type === "decimalDivideInteger") {
      const divisor = randomInt(bBounds.min, bBounds.max);
      const minQuotient = Math.max(1, Math.ceil(scaledMin(aBounds) / divisor));
      const maxQuotient = Math.floor(scaledMax(aBounds) / divisor);
      if (maxQuotient < minQuotient) return null;
      const quotient = randomInt(minQuotient, maxQuotient);
      const dividend = divisor * quotient;
      const problem = {
        a: formatDecimal(dividend, 1),
        b: String(divisor),
        op: "÷",
        answer: formatDecimal(quotient, 1),
      };
      if (usesVerticalProblemData(settings)) {
        problem.longDivision = {
          divisor,
          dividend,
          quotient,
          divisorDigits: String(divisor).length,
          dividendDecimalAfterIndex: String(dividend).length - 2,
          quotientDecimalAfterIndex: String(quotient).length - 2,
        };
      }
      return problem;
    }

    if (type === "integerDivideDecimal") {
      const divisor = randomInt(scaledMin(bBounds), scaledMax(bBounds));
      const minQuotient = Math.ceil((aBounds.min * 10) / divisor);
      const maxQuotient = Math.floor((aBounds.max * 10) / divisor);
      const quotients = [];
      for (let quotient = Math.max(1, minQuotient); quotient <= maxQuotient; quotient += 1) {
        if ((divisor * quotient) % 10 === 0) quotients.push(quotient);
      }
      if (!quotients.length) return null;
      const quotient = quotients[randomInt(0, quotients.length - 1)];
      const dividend = (divisor * quotient) / 10;
      const problem = {
        a: String(dividend),
        b: formatDecimal(divisor, 1),
        op: "÷",
        answer: String(quotient),
      };
      if (usesVerticalProblemData(settings)) {
        problem.longDivision = {
          divisor,
          dividend: dividend * 10,
          quotient,
          divisorDigits: String(divisor).length,
          divisorDecimalAfterIndex: String(divisor).length - 2,
          displayDivisor: String(divisor),
          displayDividend: String(dividend),
          dividendDecimalAfterIndex: -1,
          quotientDecimalAfterIndex: -1,
        };
      }
      return problem;
    }

    if (type === "decimalDivideDecimal") {
      const divisor = randomInt(scaledMin(bBounds), scaledMax(bBounds));
      const minQuotient = Math.max(1, Math.ceil(scaledMin(aBounds) / divisor));
      const maxQuotient = Math.floor(scaledMax(aBounds) / divisor);
      if (maxQuotient < minQuotient) return null;
      const quotient = randomInt(minQuotient, maxQuotient);
      const dividend = divisor * quotient;
      const problem = {
        a: formatDecimal(dividend, 1),
        b: formatDecimal(divisor, 1),
        op: "÷",
        answer: String(quotient),
      };
      if (usesVerticalProblemData(settings)) {
        problem.longDivision = {
          divisor,
          dividend,
          quotient,
          divisorDigits: String(divisor).length,
          divisorDecimalAfterIndex: String(divisor).length - 2,
          displayDivisor: String(divisor),
          dividendDecimalAfterIndex: String(dividend).length - 2,
          quotientDecimalAfterIndex: -1,
        };
      }
      return problem;
    }

    return null;
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
  if (isDecimalOperation(settings.operation)) return makeDecimalCandidates(settings);
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
    operation: settings.operation,
    digitsA: settings.digitsA,
    digitsB: settings.digitsB,
    carryMode: settings.carryMode,
    layout: settings.layout,
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
  const expression = document.createElement("span");
  expression.className = "formula-expression";
  expression.textContent = `${problem.a} ${problem.op} ${problem.b} =`;
  const answer = document.createElement("span");
  answer.className = showAnswer ? "answer-value" : "blank";
  answer.textContent = showAnswer ? problem.answer : "\u25a1";
  formula.append(expression, answer);
  return formula;
}

function workspaceDigitCount(value) {
  return String(value).replaceAll(".", "").length;
}

function getCalculationWorkspaceSize(pageProblems) {
  const operandDigits = Math.max(1, ...pageProblems.map((problem) => Math.max(
    workspaceDigitCount(problem.a),
    workspaceDigitCount(problem.b),
  )));
  const answerDigits = Math.max(1, ...pageProblems.map((problem) => workspaceDigitCount(problem.answer)));
  return { columns: Math.max(operandDigits + 1, answerDigits), rows: 3 };
}

function makeWorkspaceDigitRow(digitData, totalColumns, operator = "", showCarryBoxes = false, blank = false, resultRow = false) {
  const { digits, decimalAfterIndex = -1 } = Array.isArray(digitData)
    ? { digits: digitData }
    : digitData;
  const row = document.createElement("span");
  row.className = "digit-row workspace-digit-row";
  if (resultRow) {
    row.classList.add("workspace-result-row");
    row.style.setProperty("--workspace-result-count", String(totalColumns));
  } else {
    row.style.setProperty("--digit-count", String(Math.max(1, totalColumns - 1)));
    const operatorElement = document.createElement("span");
    operatorElement.className = "operator operator-cell";
    operatorElement.textContent = operator;
    row.append(operatorElement);
  }
  digits.forEach((digit, index) => {
    row.append(makeDigitCell(digit, showCarryBoxes, blank, decimalAfterIndex === index));
  });
  return row;
}

function makeWorkspaceSimpleFormula(problem, settings, totalColumns) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula calculation-workspace-board";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const digitColumns = Math.max(1, totalColumns - 1);
  formula.append(makeWorkspaceDigitRow(formatDigitData("", digitColumns), totalColumns, "", false, true));
  formula.append(makeWorkspaceDigitRow(formatDigitData("", digitColumns), totalColumns, problem.op, false, true));
  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);
  formula.append(makeWorkspaceDigitRow(formatDigitData("", totalColumns), totalColumns, "", false, true, true));
  return formula;
}

function makeCalculationWorkspace(problem, showAnswer, settings, size) {
  const workspace = document.createElement("span");
  workspace.className = "calculation-workspace";
  workspace.append(makeHorizontalFormula(problem, showAnswer));
  if (showAnswer) return workspace;

  if (supportsLongDivisionLayout()) {
    workspace.append(makeLongDivisionBoard(problem, false, size.rows, size.columns, false));
    return workspace;
  }

  if (supportsMultiplicationVerticalLayout()) {
    workspace.append(makeMultiplicationVerticalFormula(problem, false, {
      ...settings,
      showCarryBoxes: false,
    }, size.columns, true, size.columns));
    return workspace;
  }

  workspace.append(makeWorkspaceSimpleFormula(problem, settings, size.columns));
  return workspace;
}

function digitCount(value) {
  return String(value).replaceAll(".", "").length;
}

function formatDigitData(value, width) {
  const text = String(value);
  const decimalIndex = text.indexOf(".");
  const rawDigits = text.replaceAll(".", "");
  const padding = Math.max(0, width - rawDigits.length);
  const digits = rawDigits.padStart(width, " ").slice(-width).split("");
  return {
    digits,
    decimalAfterIndex: decimalIndex < 0 ? -1 : padding + decimalIndex - 1,
  };
}

function formatShiftedDigitData(value, width, shift) {
  const places = Math.max(0, shift);
  const availableWidth = Math.max(1, width - places);
  const digits = `${String(value).padStart(availableWidth, " ").slice(-availableWidth)}${" ".repeat(places)}`
    .slice(0, width)
    .split("");
  return { digits, decimalAfterIndex: -1 };
}

function makeDigitCell(digit, showCarryBoxes, blank = false, showDecimal = false) {
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
  if (showDecimal) {
    const decimal = document.createElement("span");
    decimal.className = "formula-decimal";
    decimal.textContent = ".";
    cell.append(decimal);
  }
  return cell;
}

function makeDigitRow(digitData, operator = "", showCarryBoxes = true, blank = false) {
  const { digits, decimalAfterIndex = -1 } = Array.isArray(digitData)
    ? { digits: digitData }
    : digitData;
  const row = document.createElement("span");
  row.className = "digit-row";
  const operatorElement = document.createElement("span");
  operatorElement.className = "operator";
  operatorElement.classList.toggle("operator-cell", Boolean(operator));
  operatorElement.textContent = operator;
  row.append(operatorElement);
  digits.forEach((digit, index) => {
    row.append(makeDigitCell(digit, showCarryBoxes, blank, decimalAfterIndex === index));
  });
  return row;
}

function makeVerticalFormula(problem, showAnswer, settings, width) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  formula.style.setProperty("--digit-count", String(width));
  const firstRow = formatDigitData(problem.a, width);
  const secondRow = formatDigitData(problem.b, width);
  formula.append(makeDigitRow(firstRow, "", settings.showCarryBoxes));
  formula.append(makeDigitRow(secondRow, problem.op, settings.showCarryBoxes));
  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);
  formula.append(makeDigitRow(formatDigitData(showAnswer ? problem.answer : "", width), "", settings.showCarryBoxes, !showAnswer));
  return formula;
}

function multiplicationDigits(problem) {
  return String(problem.b).replaceAll(".", "").split("").reverse().map((digit) => Number.parseInt(digit, 10));
}

function multiplicationInteger(value) {
  return Number.parseInt(String(value).replaceAll(".", ""), 10);
}

function multiplicationFormulaRows(problem) {
  const steps = multiplicationDigits(problem).length;
  return steps === 1 ? 4 : steps + 5;
}

function multiplicationFormulaWidth(problem) {
  const multiplicand = multiplicationInteger(problem.a);
  const partials = multiplicationDigits(problem).map((digit) => multiplicand * digit);
  return Math.max(2, digitCount(problem.a), digitCount(problem.b), digitCount(problem.answer), ...partials.map(digitCount));
}

function makeMultiplicationVerticalFormula(problem, showAnswer, settings, width, hideGiven = false, workspaceTotalColumns = null) {
  const steps = multiplicationDigits(problem);
  const multiplicand = multiplicationInteger(problem.a);
  const formula = document.createElement("span");
  formula.className = "vertical-formula multiplication-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const workspace = Number.isInteger(workspaceTotalColumns);
  const digitWidth = workspace ? Math.max(1, workspaceTotalColumns - 1) : width;
  const makeRow = (data, operator = "", blank = false, result = false) => workspace
    ? makeWorkspaceDigitRow(data, workspaceTotalColumns, operator, settings.showCarryBoxes, blank, result)
    : makeDigitRow(data, operator, settings.showCarryBoxes, blank);
  formula.style.setProperty("--digit-count", String(workspace ? digitWidth : width));
  formula.append(makeRow(formatDigitData(hideGiven ? "" : problem.a, digitWidth)));
  formula.append(makeRow(formatDigitData(hideGiven ? "" : problem.b, digitWidth), "×"));

  const subtotalLine = document.createElement("span");
  subtotalLine.className = "vertical-line";
  formula.append(subtotalLine);

  if (steps.length > 1) {
    steps.forEach((digit, placeIndex) => {
      const data = showAnswer
        ? formatShiftedDigitData(multiplicand * digit, digitWidth, placeIndex)
        : formatDigitData("", digitWidth);
      formula.append(makeRow(data, "", !showAnswer));
    });
    const answerLine = document.createElement("span");
    answerLine.className = "vertical-line";
    formula.append(answerLine);
  }

  formula.append(makeRow(
    formatDigitData(showAnswer ? problem.answer : "", workspace ? workspaceTotalColumns : width),
    "",
    !showAnswer,
    workspace,
  ));
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

function makeLongDivisionBoard(problem, showAnswer, boardRows, boardColumns, showGiven = true) {
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
  if (showGiven) {
    addDivisionBoardValue(
      board,
      details.displayDivisor ?? details.divisor,
      2,
      1,
      details.divisorDecimalAfterIndex ?? -1,
      "given-digit",
    );
    addDivisionBoardValue(
      board,
      details.displayDividend ?? details.dividend,
      2,
      details.divisorDigits + 1,
      details.dividendDecimalAfterIndex,
      "given-digit",
    );
  }

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
  return Math.max(2, ...problems.map((problem) => Math.max(digitCount(problem.a), digitCount(problem.b), digitCount(problem.answer))));
}

function getMultiplicationBoardSize(pageProblems) {
  return pageProblems.reduce((size, problem) => ({
    rows: Math.max(size.rows, multiplicationFormulaRows(problem)),
    columns: Math.max(size.columns, multiplicationFormulaWidth(problem)),
  }), { rows: 4, columns: 2 });
}

function getMultiplicationWorkspaceSize(pageProblems) {
  const boardSize = getMultiplicationBoardSize(pageProblems);
  const operandDigits = Math.max(1, ...pageProblems.map((problem) => Math.max(
    digitCount(problem.a),
    digitCount(problem.b),
  )));
  return {
    rows: boardSize.rows,
    columns: Math.max(operandDigits + 1, boardSize.columns),
  };
}

function makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize, multiplicationBoardSize, workspaceSize) {
  if (settings.layout === "horizontal-workspace") {
    return makeCalculationWorkspace(problem, showAnswer, settings, workspaceSize);
  }
  if (settings.layout === "vertical" && problem.longDivision) {
    return makeLongDivisionBoard(problem, showAnswer, longDivisionBoardSize.rows, longDivisionBoardSize.columns);
  }
  if (settings.layout === "vertical" && problem.op === "×") {
    return makeMultiplicationVerticalFormula(problem, showAnswer, settings, multiplicationBoardSize.columns);
  }
  return settings.layout === "vertical"
    ? makeVerticalFormula(problem, showAnswer, settings, verticalDigitCount)
    : makeHorizontalFormula(problem, showAnswer);
}

function applyGridDensity(list, settings, longDivisionBoardSize = null, multiplicationBoardSize = null, workspaceSize = null, verticalDigitCount = 0) {
  const rows = Math.ceil(settings.count / settings.columns);
  const vertical = settings.layout === "vertical";
  let rowGap = vertical ? 6 : 8;
  let problemMin = vertical ? 28 : 13;
  let fontSize = vertical ? 24 : 21;
  let blankWidth = 12;
  let blankHeight = 9;
  if (workspaceSize && supportsLongDivisionLayout()) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2) / workspaceSize.rows;
    const widthCellSize = availableWidth / workspaceSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * workspaceSize.rows + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--division-cell-size", `${cellSize.toFixed(2)}mm`);
  } else if (workspaceSize && supportsMultiplicationVerticalLayout()) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - Math.max(0, workspaceSize.rows - 1)) / workspaceSize.rows;
    const widthCellSize = availableWidth / workspaceSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * workspaceSize.rows + Math.max(0, workspaceSize.rows - 1) + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--multiplication-digit-size", `${cellSize.toFixed(2)}mm`);
  } else if (workspaceSize) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - 2) / workspaceSize.rows;
    const widthCellSize = availableWidth / workspaceSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * workspaceSize.rows + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--workspace-digit-size", `${cellSize.toFixed(2)}mm`);
  } else if (longDivisionBoardSize) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2) / longDivisionBoardSize.rows;
    const widthCellSize = availableWidth / longDivisionBoardSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * longDivisionBoardSize.rows + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--division-cell-size", `${cellSize.toFixed(2)}mm`);
  } else if (multiplicationBoardSize) {
    rowGap = 4;
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - Math.max(0, multiplicationBoardSize.rows - 1)) / multiplicationBoardSize.rows;
    const widthCellSize = availableWidth / multiplicationBoardSize.columns;
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * multiplicationBoardSize.rows + Math.max(0, multiplicationBoardSize.rows - 1) + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--multiplication-digit-size", `${cellSize.toFixed(2)}mm`);
  } else if (vertical && supportsSimpleVerticalLayout()) {
    const availableHeight = 235 - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - 2) / 3;
    const widthCellSize = availableWidth / (verticalDigitCount + 1);
    const cellSize = Math.max(5.5, Math.min(10, heightCellSize, widthCellSize));
    problemMin = cellSize * 3 + 2;
    fontSize = Math.max(15, Math.round(cellSize * 3));
    list.style.setProperty("--vertical-digit-size", `${cellSize.toFixed(2)}mm`);
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
  page.classList.toggle("calculation-workspace-layout", settings.layout === "horizontal-workspace");
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
  const multiplicationBoardSize = settings.layout === "vertical" && pageProblems.some((problem) => problem.op === "×")
    ? getMultiplicationBoardSize(pageProblems.filter((problem) => problem.op === "×"))
    : null;
  const workspaceSize = settings.layout === "horizontal-workspace"
    ? (pageProblems.some((problem) => problem.longDivision)
      ? getLongDivisionBoardSize(pageProblems)
      : pageProblems.some((problem) => problem.op === "×")
        ? getMultiplicationWorkspaceSize(pageProblems.filter((problem) => problem.op === "×"))
        : getCalculationWorkspaceSize(pageProblems))
    : null;
  const verticalDigitCount = settings.layout === "vertical" ? getVerticalDigitCount(pageProblems) : 0;
  applyGridDensity(list, settings, longDivisionBoardSize, multiplicationBoardSize, workspaceSize, verticalDigitCount);
  pageProblems.forEach((problem) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.append(makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize, multiplicationBoardSize, workspaceSize));
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
  [els.operation, els.digitsA, els.digitsB, els.carryMode, els.layoutMode].forEach((control) => {
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
