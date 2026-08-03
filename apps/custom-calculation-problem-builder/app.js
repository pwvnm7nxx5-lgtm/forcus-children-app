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
  decimalPlacesALabel: document.querySelector("#decimalPlacesALabel"),
  decimalPlacesBLabel: document.querySelector("#decimalPlacesBLabel"),
  decimalPlacesA: document.querySelector("#decimalPlacesA"),
  decimalPlacesB: document.querySelector("#decimalPlacesB"),
  carryMode: document.querySelector("#carryMode"),
  layoutMode: document.querySelector("#layoutMode"),
  problemCount: document.querySelector("#problemCount"),
  columns: document.querySelector("#columns"),
  showCarryBoxes: document.querySelector("#showCarryBoxes"),
  showWorkspaceDecimalPoint: document.querySelector("#showWorkspaceDecimalPoint"),
  showAnswerDecimalPoint: document.querySelector("#showAnswerDecimalPoint"),
  showWorkspaceOperator: document.querySelector("#showWorkspaceOperator"),
  includeAnswers: document.querySelector("#includeAnswers"),
  printBtn: document.querySelector("#printBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  pageCount: document.querySelector("#pageCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  status: document.querySelector("#status"),
};

const stateStorageKey = "custom-calculation-problem-builder-state-v2";
const problemCountMin = 1;
const horizontalProblemCountMax = 60;
const verticalProblemCountMax = 30;
const longDivisionProblemCountMax = 6;
const multiplicationProblemCountMax = 15;
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
  if (control.value === "under-one") return 0;
  return clampNumber(control.value, 1, 5, position === "a" ? 2 : 3);
}

function getDecimalPlaces(position) {
  const control = position === "a" ? els.decimalPlacesA : els.decimalPlacesB;
  return clampNumber(control.value, 1, 3, 1);
}

function decimalDigitOptions() {
  return [
    ["under-one", "0（1未満）"],
    ["1", "1桁"],
    ["2", "2桁"],
    ["3", "3桁"],
    ["4", "4桁"],
    ["5", "5桁"],
  ];
}

function integerDigitOptions() {
  return [["1", "1桁"], ["2", "2桁"], ["3", "3桁"], ["4", "4桁"], ["5", "5桁"]];
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

function isLandscapePrint() {
  const orientation = document.querySelector("#printOrientation")?.value;
  if (orientation) return orientation === "landscape";
  return document.body.classList.contains("print-landscape");
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
  if (isCalculationWorkspaceLayout()) {
    if (supportsMultiplicationVerticalLayout()) return isLandscapePrint() ? 4 : 3;
    return 3;
  }
  if (isMultiplicationVerticalLayout()) return isLandscapePrint() ? 4 : 3;
  if (isLongDivisionLayout()) return isLandscapePrint() ? 3 : 2;
  return columnsMax;
}

function getColumns() {
  const max = getColumnsMax();
  const count = clampNumber(els.problemCount.value, problemCountMin, getProblemCountMax(), 30);
  const multiplicationLayout = supportsMultiplicationVerticalLayout()
    && ["vertical", "horizontal-workspace"].includes(getActiveLayout());
  const denseMinimum = multiplicationLayout && count > 12
    ? (isLandscapePrint() ? 4 : 3)
    : (multiplicationLayout && count > 9 ? 3 : columnsMin);
  const columns = clampNumber(els.columns.value, denseMinimum, max, Math.min(3, max));
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
    decimalDigitA: els.digitsA.value,
    decimalDigitB: els.digitsB.value,
    decimalPlacesA: getDecimalPlaces("a"),
    decimalPlacesB: getDecimalPlaces("b"),
    carryMode: clampChoice(els.carryMode.value, ["any", "with", "without"], "any"),
    layout: getActiveLayout(),
    difficulty: "standard",
    count: getProblemCount(),
    columns: getColumns(),
    showCarryBoxes: els.showCarryBoxes.checked,
    showWorkspaceDecimalPoint: els.showWorkspaceDecimalPoint.checked,
    showAnswerDecimalPoint: els.showAnswerDecimalPoint.checked,
    showWorkspaceOperator: els.showWorkspaceOperator.checked,
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
  // Decimal division exposes independent operand controls, so do not silently
  // force the second operand to match the first operand's digit count.
  const orderedOperands = ["sub", "divide"].includes(operation);
  const division = operation === "divide";
  const decimalOperation = isDecimalOperation(operation);
  const decimalAVisible = ["decimalAdd", "decimalSub", "decimalMultiply", "decimalDivideInteger", "decimalDivideDecimal"].includes(operation);
  const decimalBVisible = ["decimalAdd", "decimalSub", "decimalMultiply", "integerDivideDecimal", "decimalDivideDecimal"].includes(operation);
  const digitOptionsA = decimalAVisible ? decimalDigitOptions() : integerDigitOptions();
  const digitOptionsB = decimalBVisible ? decimalDigitOptions() : integerDigitOptions();
  const selectedDigitA = els.digitsA.value;
  const selectedDigitB = els.digitsB.value;
  replaceOptions(els.digitsA, digitOptionsA, selectedDigitA);
  replaceOptions(els.digitsB, digitOptionsB, selectedDigitB);
  if (isDecimalOperation(operation)) {
    els.digitsALabel.textContent = decimalDivision ? "わられる数の整数部分の桁数" : "1つ目の整数部分の桁数";
    els.decimalPlacesALabel.textContent = decimalDivision ? "わられる数の小数部分の桁数" : "1つ目の小数";
    els.digitsBLabel.textContent = decimalDivision ? "わる数の整数部分の桁数" : "2つ目の整数部分の桁数";
    els.decimalPlacesBLabel.textContent = decimalDivision ? "わる数の小数部分の桁数" : "2つ目の小数";
  } else {
    els.digitsALabel.textContent = division ? "わられる数の桁数" : (orderedOperands ? "大きい数の桁数" : "1つ目の桁数");
    els.digitsBLabel.textContent = division ? "わる数の桁数" : (orderedOperands ? "小さい数の桁数" : "2つ目の桁数");
    els.decimalPlacesALabel.textContent = "1つ目の小数";
    els.decimalPlacesBLabel.textContent = "2つ目の小数";
  }
  Array.from(els.digitsA.options).forEach((option) => { option.disabled = false; });
  Array.from(els.digitsB.options).forEach((option) => {
    if (operation === "decimalSub") {
      option.disabled = !canMakeDecimalSubtraction({
        ...getSettings(),
        operation,
        digitsB: decimalDigitValue(option.value),
      }, decimalDigitValue(option.value));
      return;
    }
    if (decimalDivision) {
      option.disabled = !canMakeExactDecimalDivision({
        ...getSettings(),
        operation,
        digitsB: decimalDigitValue(option.value),
      });
      return;
    }
    option.disabled = orderedOperands && option.value !== "under-one" && Number(option.value) > getOperandDigits("a");
  });
  if (orderedOperands && !decimalDivision && getOperandDigits("b") > getOperandDigits("a")) {
    els.digitsB.value = getOperandDigits("a") === 0 ? "under-one" : String(getOperandDigits("a"));
  }
  if (decimalDivision && els.digitsB.selectedOptions[0]?.disabled) {
    const firstEnabled = Array.from(els.digitsB.options).find((option) => !option.disabled);
    if (firstEnabled) els.digitsB.value = firstEnabled.value;
  }
  if (operation === "decimalSub" && els.digitsB.selectedOptions[0]?.disabled) {
    const firstEnabled = Array.from(els.digitsB.options).find((option) => !option.disabled);
    if (firstEnabled) els.digitsB.value = firstEnabled.value;
  }

  document.querySelectorAll(".decimal-setting").forEach((element) => {
    element.hidden = true;
  });
  els.decimalPlacesA.closest(".field").hidden = !decimalAVisible;
  els.decimalPlacesB.closest(".field").hidden = !decimalBVisible;
  const workspaceDecimalControls = decimalOperation && getActiveLayout() === "horizontal-workspace";
  const answerDecimalControls = decimalOperation && ["vertical", "horizontal-workspace"].includes(getActiveLayout());
  els.showWorkspaceDecimalPoint.closest("label").hidden = !workspaceDecimalControls;
  els.showAnswerDecimalPoint.closest("label").hidden = !answerDecimalControls;
  els.showWorkspaceOperator.closest("label").hidden = getActiveLayout() !== "horizontal-workspace";

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
  els.digitsA.value = settings.decimalDigitA || (settings.digitsA === 0 ? "under-one" : String(clampNumber(settings.digitsA, 1, 5, 2)));
  els.digitsB.value = settings.decimalDigitB || (settings.digitsB === 0 ? "under-one" : String(clampNumber(settings.digitsB, 1, 5, 3)));
  els.decimalPlacesA.value = String(clampNumber(settings.decimalPlacesA, 1, 3, 1));
  els.decimalPlacesB.value = String(clampNumber(settings.decimalPlacesB, 1, 3, 1));
  els.carryMode.value = clampChoice(settings.carryMode, ["any", "with", "without"], "any");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "horizontal-workspace", "vertical"], "horizontal");
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, getProblemCountMax(), 30));
  els.columns.value = String(clampNumber(settings.columns, columnsMin, getColumnsMax(), 3));
  els.showCarryBoxes.checked = settings.showCarryBoxes === true;
  const workspaceDecimalPoint = settings.showWorkspaceDecimalPoint ?? settings.showProblemDecimalPoint;
  els.showWorkspaceDecimalPoint.checked = workspaceDecimalPoint !== false;
  els.showAnswerDecimalPoint.checked = settings.showAnswerDecimalPoint !== false;
  els.showWorkspaceOperator.checked = settings.showWorkspaceOperator !== false;
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
  if (digits === 0) return { min: 0, max: 0 };
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

function randomFractionPart(places) {
  if (places <= 0) return 0;
  const prefix = places > 1 ? String(randomInt(0, (10 ** (places - 1)) - 1)).padStart(places - 1, "0") : "";
  return Number(`${prefix}${randomInt(1, 9)}`);
}

function decimalRawBoundsFromIntegerBounds(bounds, places) {
  const scale = 10 ** places;
  if (bounds.max === 0) return { min: 1, max: scale - 1 };
  return {
    min: bounds.min * scale + (places > 0 ? 1 : 0),
    max: bounds.max * scale + scale - 1,
  };
}

function decimalRawBounds(settings, position, places) {
  return decimalRawBoundsFromIntegerBounds(numberBounds(settings, position), places);
}

function randomDecimalScaled(settings, position, places) {
  const bounds = decimalRawBounds(settings, position, places);
  return randomInt(bounds.min, bounds.max);
}

function decimalDigitValue(value) {
  return value === "under-one" ? 0 : Number(value);
}

function canMakeDecimalSubtraction(settings, digitB = settings.digitsB) {
  const commonPlaces = Math.max(settings.decimalPlacesA, settings.decimalPlacesB);
  const aBounds = decimalRawBounds(settings, "a", settings.decimalPlacesA);
  const bBounds = decimalRawBoundsFromIntegerBounds(
    numberBoundsForDigitValue(settings, digitB),
    settings.decimalPlacesB,
  );
  const aMax = aBounds.max * (10 ** (commonPlaces - settings.decimalPlacesA));
  const bMin = bBounds.min * (10 ** (commonPlaces - settings.decimalPlacesB));
  return aMax >= bMin;
}

function numberBoundsForDigitValue(settings, digitValue) {
  if (digitValue === 0) return { min: 0, max: 0 };
  const min = digitValue === 1 ? 1 : 10 ** (digitValue - 1);
  const max = 10 ** digitValue - 1;
  return { min, max: settings.difficulty === "easy" ? Math.floor((min + max) / 2) : max };
}

function decimalDivisionParameters(settings) {
  const type = settings.operation;
  return {
    aPlaces: type === "integerDivideDecimal" ? 0 : settings.decimalPlacesA,
    bPlaces: type === "decimalDivideInteger" ? 0 : settings.decimalPlacesB,
  };
}

function hasNonZeroFractionInRange(min, max, places) {
  if (places === 0) return max >= Math.max(1, min);
  const first = min % 10 === 0 ? min + 1 : min;
  return first <= max;
}

function canMakeExactDecimalDivision(settings) {
  const { aPlaces, bPlaces } = decimalDivisionParameters(settings);
  const aBounds = decimalRawBounds(settings, "a", aPlaces);
  const bBounds = decimalRawBounds(settings, "b", bPlaces);
  const bMin = Math.max(bBounds.min, bPlaces === 0 ? 2 : 1);
  const bMax = bBounds.max;
  if (aBounds.min > aBounds.max || bMin > bMax) return false;
  const minA = aBounds.min / (10 ** aPlaces);
  const maxA = aBounds.max / (10 ** aPlaces);
  const minB = bMin / (10 ** bPlaces);
  const maxB = bMax / (10 ** bPlaces);
  for (let qPlaces = 0; qPlaces <= 3; qPlaces += 1) {
    if (bPlaces + qPlaces - aPlaces < 0) continue;
    const scale = 10 ** qPlaces;
    const minQ = Math.max(1, Math.ceil((minA / maxB) * scale));
    const maxQ = Math.min(99 * scale + scale - 1, Math.floor((maxA / minB) * scale));
    if (minQ <= maxQ && hasNonZeroFractionInRange(minQ, maxQ, qPlaces)) return true;
  }
  return false;
}

function appendDivisionTraceZeros(value, count) {
  if (count <= 0) return String(value);
  const text = String(value);
  return text.includes(".") ? `${text}${"0".repeat(count)}` : `${text}.${"0".repeat(count)}`;
}

function makeExactDecimalDivisionProblem(settings) {
  const { aPlaces, bPlaces } = decimalDivisionParameters(settings);
  const aBounds = decimalRawBounds(settings, "a", aPlaces);
  const bBounds = decimalRawBounds(settings, "b", bPlaces);
  const bMin = Math.max(bBounds.min, bPlaces === 0 ? 2 : 1);
  const bMax = bBounds.max;
  const maxAttempts = 80;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const divisor = randomInt(bMin, bMax);
    const qPlacesOptions = shuffle([0, 1, 2, 3]);
    for (const qPlaces of qPlacesOptions) {
      const traceScale = bPlaces + qPlaces - aPlaces;
      if (traceScale < 0) continue;
      const scale = 10 ** traceScale;
      const minQ = Math.max(1, Math.ceil((aBounds.min * scale) / divisor));
      const maxQ = Math.min(99 * (10 ** qPlaces) + (10 ** qPlaces) - 1, Math.floor((aBounds.max * scale) / divisor));
      if (minQ > maxQ) continue;
      for (let pick = 0; pick < 12; pick += 1) {
        let quotientRaw = randomInt(minQ, maxQ);
        if (qPlaces > 0 && quotientRaw % 10 === 0) {
          quotientRaw += quotientRaw < maxQ ? 1 : -1;
        }
        if (quotientRaw < minQ || quotientRaw > maxQ || (qPlaces > 0 && quotientRaw % 10 === 0)) continue;
        const product = divisor * quotientRaw;
        if (product % scale !== 0) continue;
        const dividend = product / scale;
        if (dividend < aBounds.min || dividend > aBounds.max) continue;
        const dividendText = formatDecimal(dividend, aPlaces);
        const divisorText = formatDecimal(divisor, bPlaces);
        const quotientText = formatDecimal(quotientRaw, qPlaces);
        const traceDividendRaw = String(dividend).padStart(aPlaces + 1, "0") + "0".repeat(traceScale);
        const quotientRawText = String(quotientRaw).padStart(qPlaces + 1, "0");
        return {
          a: dividendText,
          b: divisorText,
          op: "÷",
          answer: quotientText,
          longDivision: {
            divisor,
            dividend: Number(traceDividendRaw),
            dividendRaw: traceDividendRaw,
            quotient: quotientRaw,
            quotientRaw: quotientRawText,
            divisorDigits: String(divisor).length,
            divisorDecimalAfterIndex: decimalAfterIndex(divisorText),
            displayDivisor: divisorText,
            displayDividend: dividendText,
            answerDisplayDividend: appendDivisionTraceZeros(dividendText, traceScale),
            dividendDecimalAfterIndex: decimalAfterIndex(dividendText),
            quotientDecimalAfterIndex: qPlaces > 0 ? quotientRawText.length - qPlaces - 1 : -1,
          },
        };
      }
    }
  }
  return null;
}

function decimalAfterIndex(value) {
  const text = String(value);
  return text.includes(".") ? text.indexOf(".") - 1 : -1;
}

function decimalRawDigitLength(value) {
  return String(value).replace(".", "").length;
}

function makeDecimalCandidates(settings) {
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");

  return buildRandomPool(settings, () => {
    const type = settings.operation;
    const placesA = settings.decimalPlacesA;
    const placesB = settings.decimalPlacesB;

    if (type === "decimalAdd" || type === "decimalSub") {
      const a = randomDecimalScaled(settings, "a", placesA);
      const commonPlaces = Math.max(placesA, placesB);
      const normalizedA = a * (10 ** (commonPlaces - placesA));
      const bBounds = decimalRawBounds(settings, "b", placesB);
      const minB = bBounds.min;
      const maxB = type === "decimalSub"
        ? Math.min(bBounds.max, Math.floor(normalizedA / (10 ** (commonPlaces - placesB))))
        : bBounds.max;
      if (minB > maxB) return null;
      const b = randomInt(minB, maxB);
      const normalizedB = b * (10 ** (commonPlaces - placesB));
      const problem = {
        a: formatDecimal(a, placesA),
        b: formatDecimal(b, placesB),
        op: type === "decimalAdd" ? "+" : "-",
        answer: formatDecimal(type === "decimalAdd" ? normalizedA + normalizedB : normalizedA - normalizedB, commonPlaces),
        carryA: normalizedA,
        carryB: normalizedB,
      };
      return matchesCarryMode(problem, settings) ? problem : null;
    }

    if (type === "decimalMultiply") {
      const a = randomDecimalScaled(settings, "a", placesA);
      const b = randomDecimalScaled(settings, "b", placesB);
      return {
        a: formatDecimal(a, placesA),
        b: formatDecimal(b, placesB),
        op: "×",
        answer: formatDecimal(a * b, placesA + placesB),
      };
    }

    if (["decimalDivideInteger", "integerDivideDecimal", "decimalDivideDecimal"].includes(type)) {
      const problem = makeExactDecimalDivisionProblem(settings);
      if (problem && !usesVerticalProblemData(settings)) delete problem.longDivision;
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

function formulaValueText(value, showDecimal) {
  const text = String(value);
  return showDecimal ? text : text.replace(".", "");
}

function makeHorizontalFormula(problem, showAnswer, settings = null) {
  const formula = document.createElement("span");
  formula.className = "formula";
  const expression = document.createElement("span");
  expression.className = "formula-expression";
  expression.textContent = `${formulaValueText(problem.a, true)} ${problem.op} ${formulaValueText(problem.b, true)} =`;
  const answer = document.createElement("span");
  answer.className = showAnswer ? "answer-value" : "blank";
  answer.textContent = showAnswer ? formulaValueText(problem.answer, true) : "\u25a1";
  formula.append(expression, answer);
  return formula;
}

function workspaceDigitCount(value) {
  return String(value).replaceAll(".", "").length;
}

function integerDigitCount(value) {
  return String(value).split(".")[0].replace(/^0+(?=\d)/, "").length || 1;
}

function fractionDigitCount(value) {
  return String(value).split(".")[1]?.length || 0;
}

function isDecimalAddSub(problem) {
  return ["+", "-"].includes(problem.op) && (String(problem.a).includes(".") || String(problem.b).includes("."));
}

function getSimpleProblemLayout(problem, totalColumns) {
  if (isDecimalAddSub(problem)) {
    const integerWidth = Math.max(integerDigitCount(problem.a), integerDigitCount(problem.b));
    const fractionWidth = Math.max(fractionDigitCount(problem.a), fractionDigitCount(problem.b));
    const numericWidth = integerWidth + fractionWidth;
    const startIndex = Math.max(0, totalColumns - numericWidth);
    return {
      operatorColumn: Math.max(1, startIndex),
      first: formatAlignedDecimalData(problem.a, totalColumns, integerWidth, fractionWidth),
      second: formatAlignedDecimalData(problem.b, totalColumns, integerWidth, fractionWidth),
      answer: formatAlignedAnswerData(problem.answer, totalColumns, fractionWidth),
    };
  }
  const operandWidth = Math.max(workspaceDigitCount(problem.a), workspaceDigitCount(problem.b));
  return {
    operatorColumn: Math.max(1, totalColumns - operandWidth),
    first: formatDigitData(problem.a, totalColumns),
    second: formatDigitData(problem.b, totalColumns),
    answer: formatDigitData(problem.answer, totalColumns),
  };
}

function getSimpleBoardSize(pageProblems) {
  return pageProblems.reduce((size, problem) => {
    if (isDecimalAddSub(problem)) {
      const integerWidth = Math.max(integerDigitCount(problem.a), integerDigitCount(problem.b));
      const fractionWidth = Math.max(fractionDigitCount(problem.a), fractionDigitCount(problem.b));
      return Math.max(size, integerWidth + fractionWidth + 1);
    }
    return Math.max(size, workspaceDigitCount(problem.a) + 1, workspaceDigitCount(problem.b) + 1, workspaceDigitCount(problem.answer));
  }, 2);
}

function getCalculationWorkspaceSize(pageProblems) {
  return { columns: getSimpleBoardSize(pageProblems), rows: 3 };
}

function makeWorkspaceDigitRow(digitData, totalColumns, operator = "", showCarryBoxes = false, blank = false, resultRow = false, operatorColumn = 1, showDecimal = false) {
  const row = makeDigitRow(digitData, operator, showCarryBoxes, blank, {
    totalColumns,
    operatorColumn,
    showDecimal,
  });
  row.classList.add("workspace-digit-row");
  if (resultRow) {
    row.classList.add("workspace-result-row");
    row.style.setProperty("--workspace-result-count", String(totalColumns));
  }
  return row;
}

function makeWorkspaceSimpleFormula(problem, settings, totalColumns, showAnswer) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula calculation-workspace-board";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const layout = getSimpleProblemLayout(problem, totalColumns);
  const showOperator = settings.showWorkspaceOperator || showAnswer;
  const showProblemDecimal = showAnswer || settings.showWorkspaceDecimalPoint;
  const showAnswerDecimal = showAnswer || settings.showAnswerDecimalPoint;
  formula.append(makeWorkspaceDigitRow(layout.first, totalColumns, "", false, !showAnswer, false, layout.operatorColumn, showProblemDecimal));
  formula.append(makeWorkspaceDigitRow(layout.second, totalColumns, showOperator ? problem.op : "", false, !showAnswer, false, layout.operatorColumn, showProblemDecimal));
  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);
  formula.append(makeWorkspaceDigitRow(layout.answer, totalColumns, "", false, !showAnswer, true, layout.operatorColumn, showAnswerDecimal));
  return formula;
}

function makeCalculationWorkspace(problem, showAnswer, settings, size) {
  const workspace = document.createElement("span");
  workspace.className = "calculation-workspace";
  workspace.append(makeHorizontalFormula(problem, showAnswer, settings));

  if (supportsLongDivisionLayout()) {
    workspace.append(makeLongDivisionBoard(problem, showAnswer, size.rows, size.columns, showAnswer, settings));
    return workspace;
  }

  if (supportsMultiplicationVerticalLayout()) {
    workspace.append(makeMultiplicationVerticalFormula(problem, showAnswer, {
      ...settings,
      showCarryBoxes: false,
    }, size.columns, !showAnswer, size.columns));
    return workspace;
  }

  workspace.append(makeWorkspaceSimpleFormula(problem, settings, size.columns, showAnswer));
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

function formatAlignedDecimalData(value, totalColumns, integerWidth, fractionWidth) {
  const [integerPart, fractionPart = ""] = String(value).split(".");
  const numeric = `${integerPart.padStart(integerWidth, " ").slice(-integerWidth)}${fractionPart.padEnd(fractionWidth, " ").slice(0, fractionWidth)}`;
  const padding = Math.max(0, totalColumns - numeric.length);
  return {
    digits: `${" ".repeat(padding)}${numeric}`.slice(-totalColumns).split(""),
    decimalAfterIndex: fractionWidth > 0 ? padding + integerWidth - 1 : -1,
  };
}

function formatAlignedAnswerData(value, totalColumns, fractionWidth) {
  const [integerPart, fractionPart = ""] = String(value).split(".");
  const numeric = `${integerPart}${fractionPart.padEnd(fractionWidth, " ").slice(0, fractionWidth)}`;
  const padding = Math.max(0, totalColumns - numeric.length);
  return {
    digits: `${" ".repeat(padding)}${numeric}`.slice(-totalColumns).split(""),
    decimalAfterIndex: fractionWidth > 0 ? totalColumns - fractionWidth - 1 : -1,
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
    cell.append(decimal);
  }
  return cell;
}

function makeDigitRow(digitData, operator = "", showCarryBoxes = true, blank = false, options = {}) {
  const { digits, decimalAfterIndex = -1 } = Array.isArray(digitData)
    ? { digits: digitData }
    : digitData;
  const totalColumns = options.totalColumns || digits.length;
  const operatorColumn = options.operatorColumn || 1;
  const showDecimal = options.showDecimal === true;
  const row = document.createElement("span");
  row.className = "digit-row";
  row.style.setProperty("--digit-count", String(totalColumns));
  const normalizedDigits = [...digits].slice(-totalColumns).map((digit) => digit || " ");
  while (normalizedDigits.length < totalColumns) normalizedDigits.unshift(" ");
  normalizedDigits.forEach((digit, index) => {
    const column = index + 1;
    if (operator && column === operatorColumn) {
      const operatorElement = document.createElement("span");
      operatorElement.className = "operator operator-cell";
      operatorElement.textContent = operator;
      row.append(operatorElement);
      return;
    }
    row.append(makeDigitCell(digit, showCarryBoxes, blank, showDecimal && decimalAfterIndex === index));
  });
  return row;
}

function makeVerticalFormula(problem, showAnswer, settings, width) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const layout = getSimpleProblemLayout(problem, width);
  formula.append(makeDigitRow(layout.first, "", settings.showCarryBoxes, false, {
    totalColumns: width,
    operatorColumn: layout.operatorColumn,
    showDecimal: true,
  }));
  formula.append(makeDigitRow(layout.second, problem.op, settings.showCarryBoxes, false, {
    totalColumns: width,
    operatorColumn: layout.operatorColumn,
    showDecimal: true,
  }));
  const line = document.createElement("span");
  line.className = "vertical-line";
  formula.append(line);
  const answerData = showAnswer ? layout.answer : layout.answer;
  formula.append(makeDigitRow(answerData, "", settings.showCarryBoxes, !showAnswer, {
    totalColumns: width,
    operatorColumn: layout.operatorColumn,
    showDecimal: showAnswer || settings.showAnswerDecimalPoint,
  }));
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
  const totalColumns = workspace ? workspaceTotalColumns : width;
  const operandWidth = Math.max(workspaceDigitCount(problem.a), workspaceDigitCount(problem.b));
  const operatorColumn = Math.max(1, totalColumns - operandWidth);
  const makeRow = (data, operator = "", blank = false, result = false, showDecimal = false) => workspace
    ? makeWorkspaceDigitRow(data, totalColumns, operator, settings.showCarryBoxes, blank, result, operatorColumn, showDecimal)
    : makeDigitRow(data, operator, settings.showCarryBoxes, blank, {
      totalColumns,
      operatorColumn,
      showDecimal,
    });
  formula.style.setProperty("--digit-count", String(totalColumns));
  const showProblemDecimal = hideGiven ? settings.showWorkspaceDecimalPoint !== false : true;
  formula.append(makeRow(formatDigitData(problem.a, totalColumns), "", hideGiven, false, showProblemDecimal));
  formula.append(makeRow(formatDigitData(problem.b, totalColumns), settings.showWorkspaceOperator || showAnswer ? "×" : "", hideGiven, false, showProblemDecimal));

  const subtotalLine = document.createElement("span");
  subtotalLine.className = "vertical-line";
  formula.append(subtotalLine);

  if (steps.length > 1) {
    steps.forEach((digit, placeIndex) => {
      const data = showAnswer
        ? formatShiftedDigitData(multiplicand * digit, totalColumns, placeIndex)
        : formatDigitData("", totalColumns);
      formula.append(makeRow(data, "", !showAnswer));
    });
    const answerLine = document.createElement("span");
    answerLine.className = "vertical-line";
    formula.append(answerLine);
  }

  formula.append(makeRow(
    formatDigitData(problem.answer, totalColumns),
    "",
    !showAnswer,
    workspace,
    showAnswer || settings.showAnswerDecimalPoint,
  ));
  return formula;
}

function buildLongDivisionTrace(details) {
  const dividendDigits = String(details.dividendRaw ?? details.dividend).split("").map(Number);
  const quotientDigits = String(details.quotientRaw ?? details.quotient).split("").map(Number);
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
  decimal.style.gridRow = String(row);
  decimal.style.gridColumn = String(column);
  board.append(decimal);
}

function addDivisionBoardValue(board, value, row, startColumn, decimalAfterIndex, className) {
  const text = String(value);
  const rawValue = text.replace(".", "");
  rawValue.split("").forEach((digit, index) => {
    addDivisionBoardDigit(board, digit, row, startColumn + index, className);
  });
  if (decimalAfterIndex >= 0) addDivisionBoardDecimal(board, row, startColumn + decimalAfterIndex);
}

function divisionValueDigitLength(value) {
  return String(value).replace(".", "").length;
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

function makeLongDivisionBoard(problem, showAnswer, boardRows, boardColumns, showGiven = true, settings = null) {
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
  const showProblemDecimal = showGiven ? true : settings?.showWorkspaceDecimalPoint !== false;
  const showAnswerDecimal = showAnswer || settings?.showAnswerDecimalPoint !== false;
  if (showGiven) {
    addDivisionBoardValue(
      board,
      details.displayDivisor ?? details.divisor,
      2,
      1,
      showProblemDecimal ? (details.divisorDecimalAfterIndex ?? -1) : -1,
      "given-digit",
    );
    addDivisionBoardValue(
      board,
      showAnswer ? (details.answerDisplayDividend ?? details.displayDividend ?? details.dividend) : (details.displayDividend ?? details.dividend),
      2,
      details.divisorDigits + 1,
      showProblemDecimal
        ? decimalAfterIndex(showAnswer ? (details.answerDisplayDividend ?? details.displayDividend ?? details.dividend) : (details.displayDividend ?? details.dividend))
        : -1,
      "given-digit",
    );
  } else if (showProblemDecimal) {
    const divisorText = details.displayDivisor ?? details.divisor;
    const dividendText = details.displayDividend ?? details.dividend;
    const divisorPoint = String(divisorText).includes(".") ? String(divisorText).indexOf(".") - 1 : details.divisorDecimalAfterIndex;
    const dividendPoint = String(dividendText).includes(".") ? String(dividendText).indexOf(".") - 1 : details.dividendDecimalAfterIndex;
    if (divisorPoint >= 0) addDivisionBoardDecimal(board, 2, 1 + divisorPoint);
    if (dividendPoint >= 0) addDivisionBoardDecimal(board, 2, details.divisorDigits + 1 + dividendPoint);
  }

  if (showAnswer) {
    trace.quotientDigits.forEach((digit, index) => {
      addDivisionBoardDigit(board, digit, 1, details.divisorDigits + trace.quotientOffset + index + 1, "answer-digit");
    });
    if (showAnswerDecimal && details.quotientDecimalAfterIndex >= 0) {
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
  } else if (showAnswerDecimal && details.quotientDecimalAfterIndex >= 0) {
    addDivisionBoardDecimal(
      board,
      1,
      details.divisorDigits + trace.quotientOffset + details.quotientDecimalAfterIndex + 1,
    );
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
        problem.longDivision.divisorDigits + Math.max(
          divisionValueDigitLength(problem.longDivision.dividendRaw ?? problem.longDivision.dividend),
          divisionValueDigitLength(problem.longDivision.displayDividend ?? problem.longDivision.dividend),
          divisionValueDigitLength(problem.longDivision.answerDisplayDividend ?? problem.longDivision.dividend),
        ),
        4,
      ),
    };
  }, { rows: 6, columns: 4 });
}

function getVerticalDigitCount(problems) {
  return getSimpleBoardSize(problems);
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
    return makeLongDivisionBoard(problem, showAnswer, longDivisionBoardSize.rows, longDivisionBoardSize.columns, true, settings);
  }
  if (settings.layout === "vertical" && problem.op === "×") {
    return makeMultiplicationVerticalFormula(problem, showAnswer, settings, multiplicationBoardSize.columns);
  }
  return settings.layout === "vertical"
    ? makeVerticalFormula(problem, showAnswer, settings, verticalDigitCount)
    : makeHorizontalFormula(problem, showAnswer, settings);
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
    const denseMultiplication = settings.count > 12;
    rowGap = denseMultiplication ? 2 : 4;
    const pageHeight = isLandscapePrint() ? 164 : 235;
    const availableHeight = pageHeight - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - Math.max(0, workspaceSize.rows - 1)) / workspaceSize.rows;
    const widthCellSize = availableWidth / workspaceSize.columns;
    const cellSize = Math.max(denseMultiplication ? 3.5 : 5.5, Math.min(10, heightCellSize, widthCellSize));
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
    const denseMultiplication = settings.count > 12;
    rowGap = denseMultiplication ? 2 : 4;
    const pageHeight = isLandscapePrint() ? 164 : 235;
    const availableHeight = pageHeight - Math.max(0, rows - 1) * rowGap;
    const availableWidth = (184 - Math.max(0, settings.columns - 1) * 10) / settings.columns - 8;
    const heightCellSize = (availableHeight / rows - 2 - Math.max(0, multiplicationBoardSize.rows - 1)) / multiplicationBoardSize.rows;
    const widthCellSize = availableWidth / multiplicationBoardSize.columns;
    const cellSize = Math.max(denseMultiplication ? 3.5 : 5.5, Math.min(10, heightCellSize, widthCellSize));
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
  [els.operation, els.digitsA, els.digitsB, els.decimalPlacesA, els.decimalPlacesB, els.carryMode, els.layoutMode].forEach((control) => {
    control.addEventListener("change", generateProblems);
  });
  els.showCarryBoxes.addEventListener("change", render);
  els.showWorkspaceDecimalPoint.addEventListener("change", render);
  els.showAnswerDecimalPoint.addEventListener("change", render);
  els.showWorkspaceOperator.addEventListener("change", render);
  els.problemCount.addEventListener("input", () => {
    if (els.problemCount.value === "") return;
    generateProblems();
  });
  els.printBtn.addEventListener("click", () => {
    render();
    window.print();
  });
  els.regenerateBtn.addEventListener("click", generateProblems);
  els.copyLinkBtn.addEventListener("click", copyShareUrl);
}

function watchPrintOrientation() {
  let previousLandscape = isLandscapePrint();
  const observer = new MutationObserver(() => {
    const currentLandscape = isLandscapePrint();
    if (currentLandscape === previousLandscape) return;
    previousLandscape = currentLandscape;
    syncSettingsControls();
    render();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

loadInitialState();
syncSettingsControls();
bindEvents();
watchPrintOrientation();
window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
  renderSheetPages(sheetCount, includeAnswers);
  return true;
};
if (!problems.length) generateProblems();
else render();
