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
  operandALabel: document.querySelector("#operandALabel"),
  operandBLabel: document.querySelector("#operandBLabel"),
  operandAFields: document.querySelector("#operandAFields"),
  operandBFields: document.querySelector("#operandBFields"),
  digitsALabel: document.querySelector("#digitsALabel"),
  digitsBLabel: document.querySelector("#digitsBLabel"),
  decimalPlacesALabel: document.querySelector("#decimalPlacesALabel"),
  decimalPlacesBLabel: document.querySelector("#decimalPlacesBLabel"),
  decimalPlacesA: document.querySelector("#decimalPlacesA"),
  decimalPlacesB: document.querySelector("#decimalPlacesB"),
  resultRangeField: document.querySelector("#resultRangeField"),
  resultRange: document.querySelector("#resultRange"),
  carryMode: document.querySelector("#carryMode"),
  layoutMode: document.querySelector("#layoutMode"),
  creationModeField: document.querySelector("#creationModeField"),
  creationMode: document.querySelector("#creationMode"),
  problemCount: document.querySelector("#problemCount"),
  columns: document.querySelector("#columns"),
  showCarryBoxes: document.querySelector("#showCarryBoxes"),
  showWorkspaceDecimalPoint: document.querySelector("#showWorkspaceDecimalPoint"),
  showAnswerDecimalPoint: document.querySelector("#showAnswerDecimalPoint"),
  showWorkspaceOperator: document.querySelector("#showWorkspaceOperator"),
  includeAnswers: document.querySelector("#includeAnswers"),
  fillRemainingBtn: document.querySelector("#fillRemainingBtn"),
  manualInputHint: document.querySelector("#manualInputHint"),
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
let lastGeneratedSettings = null;
let manualFocusTarget = null;
let generationMessage = "";

const manualCreationModes = ["auto", "manual", "hybrid"];

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
    ["divideRemainder", "わり算（あまりあり）"],
  ],
  4: [
    ["add", "たし算"],
    ["sub", "ひき算"],
    ["mix", "たし算・ひき算ミックス"],
    ["multiply", "かけ算"],
    ["divide", "わり算（あまりなし）"],
    ["divideRemainder", "わり算（あまりあり）"],
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
  ["divideRemainder", "わり算（あまりあり）"],
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

function isRemainderDivisionOperation(operation = getOperation()) {
  return operation === "divideRemainder";
}

function isRemainderDivisionProblem(problem, settings = null) {
  return problem?.op === "÷" && (problem?.divisionType === "remainder" || settings?.operation === "divideRemainder");
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

function supportsResultRange() {
  return !isDecimalOperation()
    && ["add", "sub", "multiply", "divide", "divideRemainder"].includes(getOperation())
    && getOperandDigits("a") === 1
    && getOperandDigits("b") === 1;
}

function getResultRange() {
  return supportsResultRange()
    ? clampChoice(els.resultRange.value, ["any", "ten"], "any")
    : "any";
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
  return supportsLongDivisionLayoutForOperation(getOperation());
}

function supportsLongDivisionLayoutForOperation(operation) {
  return ["divide", "divideRemainder", "decimalDivideInteger", "integerDivideDecimal", "decimalDivideDecimal"].includes(operation);
}

function supportsManualInteger(settings = null) {
  const operation = settings?.operation ?? getOperation();
  const layout = settings?.layout ?? getActiveLayout();
  return [
    "add",
    "sub",
    "multiply",
    "divide",
    "divideRemainder",
    "decimalAdd",
    "decimalSub",
    "decimalMultiply",
    "decimalDivideInteger",
    "integerDivideDecimal",
    "decimalDivideDecimal",
  ].includes(operation)
    && ["vertical", "horizontal", "horizontal-workspace"].includes(layout);
}

function getCreationMode() {
  if (!els.creationMode || !supportsManualInteger()) return "auto";
  return clampChoice(els.creationMode.value, manualCreationModes, "auto");
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
    resultRange: getResultRange(),
    carryMode: clampChoice(els.carryMode.value, ["any", "with", "without"], "any"),
    layout: getActiveLayout(),
    creationMode: getCreationMode(),
    difficulty: "standard",
    count: getProblemCount(),
    columns: getColumns(),
    showCarryBoxes: supportsMultiplicationVerticalLayout() && els.showCarryBoxes.checked,
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
  const division = ["divide", "divideRemainder"].includes(operation);
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
  els.operandALabel.textContent = decimalDivision || division ? "わられる数" : "1つ目の数";
  els.operandBLabel.textContent = decimalDivision || division ? "わる数" : "2つ目の数";
  els.digitsALabel.textContent = isDecimalOperation(operation) ? "整数部分の桁数" : "桁数";
  els.digitsBLabel.textContent = isDecimalOperation(operation) ? "整数部分の桁数" : "桁数";
  els.decimalPlacesALabel.textContent = "小数部分の桁数";
  els.decimalPlacesBLabel.textContent = "小数部分の桁数";
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
  els.operandAFields.classList.toggle("has-decimal", decimalAVisible);
  els.operandBFields.classList.toggle("has-decimal", decimalBVisible);
  const resultRangeAvailable = supportsResultRange();
  els.resultRangeField.hidden = !resultRangeAvailable;
  if (!resultRangeAvailable) els.resultRange.value = "any";
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
  const carryBoxesVisible = multiplicationVertical && ["vertical", "horizontal-workspace"].includes(getActiveLayout());
  els.showCarryBoxes.closest("label").hidden = !carryBoxesVisible;
  els.showCarryBoxes.disabled = !carryBoxesVisible;
  if (!multiplicationVertical) els.showCarryBoxes.checked = false;

  const manualInputVisible = supportsManualInteger({ operation, layout: getActiveLayout() });
  els.creationModeField.hidden = !manualInputVisible;
  if (!manualInputVisible) els.creationMode.value = "auto";
  const creationMode = manualInputVisible ? clampChoice(els.creationMode.value, manualCreationModes, "auto") : "auto";
  els.creationMode.value = creationMode;
  els.fillRemainingBtn.hidden = !(manualInputVisible && creationMode === "hybrid");
  els.manualInputHint.hidden = !(manualInputVisible && creationMode !== "auto");

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
  els.resultRange.value = clampChoice(settings.resultRange, ["any", "ten"], "any");
  els.carryMode.value = clampChoice(settings.carryMode, ["any", "with", "without"], "any");
  els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "horizontal-workspace", "vertical"], "horizontal");
  els.creationMode.value = clampChoice(settings.creationMode, manualCreationModes, "auto");
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

function manualExpectedDigits(problem, position, fallback = 1) {
  if (problem?.manualDecimal) {
    return manualIntegerDigitCount(problem, position) + manualFractionDigitCount(problem, position);
  }
  const key = position === "a" ? "manualDigitsA" : "manualDigitsB";
  return clampNumber(problem?.[key], 1, 5, fallback);
}

function manualIntegerDigitCount(problem, position) {
  if (!problem?.manualDecimal) return manualExpectedDigits(problem, position);
  const key = position === "a" ? "manualIntegerDigitsA" : "manualIntegerDigitsB";
  return clampNumber(problem?.[key], 0, 5, 0);
}

function manualFractionDigitCount(problem, position) {
  if (!problem?.manualDecimal) return 0;
  const key = position === "a" ? "manualFractionDigitsA" : "manualFractionDigitsB";
  return clampNumber(problem?.[key], 1, 3, 1);
}

function manualDisplayDigitCount(problem, position) {
  return problem?.manualDecimal
    ? Math.max(1, manualIntegerDigitCount(problem, position)) + manualFractionDigitCount(problem, position)
    : manualExpectedDigits(problem, position);
}

function manualPreservesLeadingZeros(problem) {
  return problem?.manualDecimal === true;
}

function manualOperandValue(problem, position) {
  const value = problem?.[position];
  return value === null || value === undefined ? "" : String(value);
}

function sanitizeManualValue(value, maxDigits, preserveLeadingZeros = false) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, maxDigits);
  if (preserveLeadingZeros) return digits;
  if (digits && maxDigits === 1 && /^0+$/.test(digits)) return "0";
  return digits.replace(/^0+/, "").slice(0, maxDigits);
}

function manualOperandDisplayText(problem, position, blank = false) {
  if (!problem?.manualDecimal) return manualOperandValue(problem, position);
  const integerDigits = manualIntegerDigitCount(problem, position);
  const fractionDigits = manualFractionDigitCount(problem, position);
  const raw = sanitizeManualValue(
    manualOperandValue(problem, position),
    manualExpectedDigits(problem, position),
    true,
  );
  const padded = blank || raw === ""
    ? ""
    : raw.padEnd(manualExpectedDigits(problem, position), " ");
  const integerPart = integerDigits === 0
    ? "0"
    : (blank || raw === "" ? " ".repeat(integerDigits) : padded.slice(0, integerDigits));
  const fractionPart = blank || raw === ""
    ? " ".repeat(fractionDigits)
    : padded.slice(integerDigits, integerDigits + fractionDigits);
  return `${integerPart}.${fractionPart}`;
}

function manualRawFromValue(value, problem, position) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return problem?.manualDecimal
    ? digits.slice(-manualExpectedDigits(problem, position))
    : sanitizeManualValue(digits, manualExpectedDigits(problem, position));
}

function manualDecimalScaledValue(problem, position) {
  const fractionDigits = manualFractionDigitCount(problem, position);
  const raw = manualRawFromValue(manualOperandValue(problem, position), problem, position);
  const padded = raw.padStart(manualExpectedDigits(problem, position), "0");
  return {
    numerator: Number(padded || 0),
    scale: 10 ** fractionDigits,
    places: fractionDigits,
  };
}

function manualOperandNumber(problem, position) {
  if (problem?.manualDecimal) {
    const value = manualDecimalScaledValue(problem, position);
    return value.numerator / value.scale;
  }
  return Number(manualOperandValue(problem, position));
}

function getManualDecimalDivisionResult(problem) {
  if (!problem?.manualDecimal || problem.op !== "÷") return null;
  if (!isManualOperandComplete(problem, "a") || !isManualOperandComplete(problem, "b")) return null;

  const dividend = manualDecimalScaledValue(problem, "a");
  const divisor = manualDecimalScaledValue(problem, "b");
  if (divisor.numerator === 0) return null;

  const numerator = dividend.numerator * (10 ** divisor.places);
  const denominator = divisor.numerator * (10 ** dividend.places);
  for (let places = 0; places <= 3; places += 1) {
    const scaledNumerator = numerator * (10 ** places);
    if (scaledNumerator % denominator !== 0) continue;
    let quotientRaw = scaledNumerator / denominator;
    let answerPlaces = places;
    while (answerPlaces > 0 && quotientRaw % 10 === 0) {
      quotientRaw /= 10;
      answerPlaces -= 1;
    }
    const traceExponent = divisor.places + answerPlaces - dividend.places;
    const traceDividend = dividend.numerator * (10 ** Math.max(0, traceExponent));
    const traceDivisor = divisor.numerator * (10 ** Math.max(0, -traceExponent));
    const quotientText = formatDecimal(quotientRaw, answerPlaces);
    const quotientRawText = String(quotientRaw).padStart(answerPlaces + 1, "0");
    return {
      answer: quotientText,
      longDivision: {
        divisor: traceDivisor,
        dividend: traceDividend,
        dividendRaw: String(traceDividend),
        quotient: quotientRaw,
        quotientRaw: quotientRawText,
        divisorDigits: String(traceDivisor).length,
        divisorDecimalAfterIndex: decimalAfterIndex(manualOperandDisplayText(problem, "b")),
        displayDivisor: manualOperandDisplayText(problem, "b"),
        displayDividend: manualOperandDisplayText(problem, "a"),
        answerDisplayDividend: String(traceDividend),
        dividendDecimalAfterIndex: decimalAfterIndex(manualOperandDisplayText(problem, "a")),
        quotientDecimalAfterIndex: answerPlaces > 0 ? quotientRawText.length - answerPlaces - 1 : -1,
      },
    };
  }
  return null;
}

function isManualOperandComplete(problem, position) {
  const value = manualOperandValue(problem, position);
  const expectedDigits = manualExpectedDigits(problem, position);
  if (value.length !== expectedDigits) return false;
  if (problem?.manualDecimal) {
    const integerDigits = manualIntegerDigitCount(problem, position);
    return integerDigits === 0 || !value.startsWith("0");
  }
  return expectedDigits === 1 || !value.startsWith("0");
}

function manualProblemStatus(problem) {
  if (!isManualEntryProblem(problem)) return { state: "complete", complete: true, message: "" };

  const valueA = manualOperandValue(problem, "a");
  const valueB = manualOperandValue(problem, "b");
  const operandsComplete = isManualOperandComplete(problem, "a") && isManualOperandComplete(problem, "b");
  if (valueA === "" && valueB === "") {
    return { state: "blank", complete: false, message: "上下の数を入力してください。" };
  }
  if (!operandsComplete) {
    return { state: "partial", complete: false, message: "上下の数を最後まで入力してください。" };
  }

  const numberA = manualOperandNumber(problem, "a");
  const numberB = manualOperandNumber(problem, "b");
  if (problem.op === "-" && numberA < numberB) {
    return { state: "invalid", complete: false, message: "ひき算は上の数を下の数以上にしてください。" };
  }
  if (problem.op === "÷") {
    if (numberB === 0) {
      return { state: "invalid", complete: false, message: "わる数は0以外にしてください。" };
    }
    if (problem.manualDecimal) {
      if (!getManualDecimalDivisionResult(problem)) {
        return { state: "invalid", complete: false, message: "小数のわり算は、有限小数になる組み合わせにしてください。" };
      }
    } else if (isRemainderDivisionProblem(problem)) {
      if (numberA < numberB || numberA % numberB === 0) {
        return { state: "invalid", complete: false, message: "わり算は、商が1以上で、余りが0より大きくわる数未満になるようにしてください。" };
      }
    } else if (numberA < numberB || numberA % numberB !== 0) {
      return { state: "invalid", complete: false, message: "わり算は、0で割らず、余りなしで割り切れる数にしてください。" };
    }
  }
  if (!problem.manualDecimal && (problem.resultRange ?? getResultRange()) === "ten") {
    const answer = problem.op === "+"
      ? numberA + numberB
      : problem.op === "-"
        ? numberA - numberB
        : problem.op === "×"
          ? numberA * numberB
          : isRemainderDivisionProblem(problem)
            ? Math.floor(numberA / numberB)
            : numberA / numberB;
    if (answer > 10) {
      return { state: "invalid", complete: false, message: "答えが10以下になるようにしてください。" };
    }
  }
  return { state: "complete", complete: true, message: "" };
}

function isCompleteManualProblem(problem) {
  return manualProblemStatus(problem).complete;
}

function manualProblemNeedsAttention(problem) {
  const status = manualProblemStatus(problem);
  return status.state === "partial" || status.state === "invalid" || (status.state === "blank" && problem.manualErrorVisible === true);
}

function hasManualInput(problem) {
  return isManualEntryProblem(problem)
    && (manualOperandValue(problem, "a") !== "" || manualOperandValue(problem, "b") !== "");
}

function updateManualProblemAnswer(problem) {
  const status = manualProblemStatus(problem);
  if (!status.complete) {
    problem.answer = "";
    if (problem.op === "÷" && !problem.manualDecimal) {
      delete problem.quotient;
      delete problem.remainder;
    }
  } else if (problem.manualDecimal && (problem.op === "+" || problem.op === "-")) {
    const a = manualDecimalScaledValue(problem, "a");
    const b = manualDecimalScaledValue(problem, "b");
    const places = Math.max(a.places, b.places);
    const normalizedA = a.numerator * (10 ** (places - a.places));
    const normalizedB = b.numerator * (10 ** (places - b.places));
    problem.answer = formatDecimal(problem.op === "+" ? normalizedA + normalizedB : normalizedA - normalizedB, places);
  } else if (problem.manualDecimal && problem.op === "×") {
    const a = manualDecimalScaledValue(problem, "a");
    const b = manualDecimalScaledValue(problem, "b");
    problem.answer = formatDecimal(a.numerator * b.numerator, a.places + b.places);
  } else if (problem.manualDecimal && problem.op === "÷") {
    problem.answer = getManualDecimalDivisionResult(problem)?.answer || "";
  } else if (problem.op === "+") {
    problem.answer = manualOperandNumber(problem, "a") + manualOperandNumber(problem, "b");
  } else if (problem.op === "-") {
    problem.answer = manualOperandNumber(problem, "a") - manualOperandNumber(problem, "b");
  } else if (problem.op === "×") {
    problem.answer = manualOperandNumber(problem, "a") * manualOperandNumber(problem, "b");
  } else if (problem.op === "÷") {
    const numberA = manualOperandNumber(problem, "a");
    const numberB = manualOperandNumber(problem, "b");
    problem.quotient = Math.floor(numberA / numberB);
    problem.remainder = numberA % numberB;
    problem.answer = problem.quotient;
  }
  problem.manualErrorVisible = manualProblemNeedsAttention(problem);
  if (problem.op === "÷") problem.longDivision = makeManualLongDivisionDetails(problem);
  return problem;
}

function isManualEntryProblem(problem) {
  return problem?.manualEntry === true;
}

function createManualProblem(settings, source = "blank") {
  const problem = {
    a: "",
    b: "",
    op: {
      add: "+",
      sub: "-",
      multiply: "×",
      divide: "÷",
      divideRemainder: "÷",
      decimalAdd: "+",
      decimalSub: "-",
      decimalMultiply: "×",
      decimalDivideInteger: "÷",
      integerDivideDecimal: "÷",
      decimalDivideDecimal: "÷",
    }[settings.operation] || "+",
    answer: "",
    manualEntry: true,
    manualSource: source,
    manualDigitsA: settings.digitsA,
    manualDigitsB: settings.digitsB,
    resultRange: settings.resultRange,
    manualDecimal: isDecimalOperation(settings.operation),
    manualIntegerDigitsA: settings.digitsA,
    manualIntegerDigitsB: settings.digitsB,
    manualFractionDigitsA: settings.decimalPlacesA,
    manualFractionDigitsB: settings.decimalPlacesB,
  };
  if (isRemainderDivisionOperation(settings.operation)) problem.divisionType = "remainder";
  if (supportsLongDivisionLayoutForOperation(settings.operation)) {
    problem.longDivision = makeManualLongDivisionDetails(problem);
  }
  return problem;
}

function createManualProblems(settings, source = "blank") {
  return Array.from({ length: settings.count }, () => createManualProblem(settings, source));
}

function makeManualLongDivisionDetails(problem) {
  if (problem?.manualDecimal) {
    const result = getManualDecimalDivisionResult(problem);
    if (result) return result.longDivision;
  }
  const displayDivisor = manualOperandValue(problem, "b");
  const displayDividend = manualOperandValue(problem, "a");
  const divisor = Number(displayDivisor) > 0 ? Number(displayDivisor) : 1;
  const dividend = Number(displayDividend) > 0 ? Number(displayDividend) : 1;
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend % divisor;
  return {
    divisor,
    dividend,
    quotient,
    remainder,
    dividendRaw: String(dividend),
    quotientRaw: String(quotient),
    divisorDigits: problem?.manualDecimal ? manualDisplayDigitCount(problem, "b") : manualExpectedDigits(problem, "b"),
    displayDivisor: problem?.manualDecimal ? manualOperandDisplayText(problem, "b") : displayDivisor,
    displayDividend: problem?.manualDecimal ? manualOperandDisplayText(problem, "a") : displayDividend,
    divisorDecimalAfterIndex: problem?.manualDecimal ? decimalAfterIndex(manualOperandDisplayText(problem, "b")) : -1,
    dividendDecimalAfterIndex: problem?.manualDecimal ? decimalAfterIndex(manualOperandDisplayText(problem, "a")) : -1,
    quotientDecimalAfterIndex: -1,
  };
}

function makeEditableProblem(problem, settings, source = "auto") {
  const editable = {
    ...problem,
    a: String(problem.a),
    b: String(problem.b),
    manualEntry: true,
    manualSource: source,
    manualDigitsA: settings.digitsA,
    manualDigitsB: settings.digitsB,
    resultRange: settings.resultRange,
    manualDecimal: isDecimalOperation(settings.operation),
    manualIntegerDigitsA: settings.digitsA,
    manualIntegerDigitsB: settings.digitsB,
    manualFractionDigitsA: settings.decimalPlacesA,
    manualFractionDigitsB: settings.decimalPlacesB,
  };
  if (editable.manualDecimal) {
    editable.a = manualRawFromValue(problem.a, editable, "a");
    editable.b = manualRawFromValue(problem.b, editable, "b");
  }
  if (editable.op === "÷") editable.longDivision = makeManualLongDivisionDetails(editable);
  if (isRemainderDivisionOperation(settings.operation)) editable.divisionType = "remainder";
  return editable;
}

function isManualInputActive(settings = getSettings()) {
  return supportsManualInteger(settings) && settings.creationMode !== "auto";
}

function hasEnteredManualProblems() {
  return problems.some((problem) => hasManualInput(problem));
}

function isProblemSettingsChanged(previous, next) {
  if (!previous) return false;
  return ["operation", "digitsA", "digitsB", "decimalPlacesA", "decimalPlacesB", "resultRange", "layout", "creationMode"]
    .some((key) => previous[key] !== next[key]);
}

function restoreSettingsControls(settings) {
  applySettings(settings);
  render();
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

function matchesResultRange(problem, settings) {
  return settings.resultRange !== "ten" || Number(problem.answer) <= 10;
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
    return matchesCarryMode(problem, settings) && matchesResultRange(problem, settings) ? problem : null;
  });
}

function makeSubCandidates(settings) {
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const a = randomInt(aBounds.min, aBounds.max);
    const b = randomInt(bBounds.min, Math.min(bBounds.max, a));
    const problem = { a, b, op: "-", answer: a - b };
    return matchesCarryMode(problem, settings) && matchesResultRange(problem, settings) ? problem : null;
  });
}

function makeMultiplyCandidates(settings) {
  const aBounds = numberBounds(settings, "a");
  const bBounds = numberBounds(settings, "b");
  return buildRandomPool(settings, () => {
    const a = randomInt(aBounds.min, aBounds.max);
    const b = randomInt(bBounds.min, bBounds.max);
    const problem = { a, b, op: "×", answer: a * b };
    return matchesResultRange(problem, settings) ? problem : null;
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
    const problem = { a: dividend, b: divisor, op: "÷", answer: quotient, quotient, remainder: 0, divisionType: "exact" };
    if (!matchesResultRange(problem, settings)) return null;
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

function canMakeRemainderDivision(settings) {
  const dividendBounds = numberBounds(settings, "a");
  const divisorBounds = numberBounds(settings, "b");
  const divisorMin = Math.max(2, divisorBounds.min, dividendBounds.min > 0 ? 2 : 2);
  const divisorMax = Math.min(divisorBounds.max, dividendBounds.max);
  if (divisorMin > divisorMax) return false;
  const dividendMin = Math.max(dividendBounds.min, divisorMin);
  for (let divisor = divisorMin; divisor <= divisorMax; divisor += 1) {
    let candidate = Math.max(dividendMin, divisor);
    if (candidate % divisor === 0) candidate += 1;
    if (candidate <= dividendBounds.max) return true;
  }
  return false;
}

function makeDivideRemainderCandidates(settings) {
  const dividendBounds = numberBounds(settings, "a");
  const divisorBounds = numberBounds(settings, "b");
  const divisorMin = Math.max(2, divisorBounds.min);
  const divisorMax = divisorBounds.max;
  return buildRandomPool(settings, () => {
    if (divisorMin > divisorMax) return null;
    const divisor = randomInt(divisorMin, divisorMax);
    const dividendMin = Math.max(dividendBounds.min, divisor);
    if (dividendMin > dividendBounds.max) return null;
    const dividend = randomInt(dividendMin, dividendBounds.max);
    const quotient = Math.floor(dividend / divisor);
    const remainder = dividend % divisor;
    if (quotient < 1 || remainder <= 0 || remainder >= divisor) return null;
    const problem = {
      a: dividend,
      b: divisor,
      op: "÷",
      answer: quotient,
      quotient,
      remainder,
      divisionType: "remainder",
    };
    if (!matchesResultRange(problem, settings)) return null;
    if (usesVerticalProblemData(settings)) {
      problem.longDivision = {
        divisor,
        dividend,
        quotient,
        remainder,
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
  if (settings.operation === "divideRemainder") return makeDivideRemainderCandidates(settings);
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
  const left = String(problem.a);
  const right = String(problem.b);
  if (["+", "×"].includes(problem.op)) {
    const operands = [left, right].sort();
    return `${operands[0]}${problem.op}${operands[1]}`;
  }
  return `${left}${problem.op}${right}`;
}

function problemDigits(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "") || "0";
}

function problemRawDigits(value) {
  return String(value).replace(/\D/g, "") || "0";
}

function problemOperandInteger(problem, position) {
  const carryValue = problem[position === "a" ? "carryA" : "carryB"];
  if (carryValue !== undefined && carryValue !== null && carryValue !== "") {
    return Math.abs(Math.trunc(Number(carryValue)));
  }
  return Math.abs(Number(problemRawDigits(problem[position])) || 0);
}

function arithmeticCarrySignature(problem) {
  if (!["+", "-"].includes(problem.op)) return "none";
  let left = problemOperandInteger(problem, "a");
  let right = problemOperandInteger(problem, "b");
  const positions = [];
  let position = 0;
  while (left > 0 || right > 0) {
    const leftDigit = left % 10;
    const rightDigit = right % 10;
    const hasCarryOrBorrow = problem.op === "+"
      ? leftDigit + rightDigit >= 10
      : leftDigit < rightDigit;
    if (hasCarryOrBorrow) positions.push(position);
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
    position += 1;
  }
  return positions.length ? positions.join(",") : "none";
}

function multiplicationCarrySignature(problem) {
  if (problem.op !== "×") return "none";
  const leftDigits = problemDigits(problem.a).split("").reverse().map(Number);
  const rightDigits = problemDigits(problem.b).split("").reverse().map(Number);
  const positions = new Set();
  rightDigits.forEach((rightDigit, rightIndex) => {
    let carry = 0;
    leftDigits.forEach((leftDigit, leftIndex) => {
      const value = leftDigit * rightDigit + carry;
      if (value >= 10) positions.add(leftIndex + rightIndex);
      carry = Math.floor(value / 10);
    });
    if (carry > 0) positions.add(leftDigits.length + rightIndex);
  });
  return positions.size
    ? [...positions].sort((left, right) => left - right).join(",")
    : "none";
}

function divisionBalanceMeta(problem) {
  if (problem.op !== "÷") return null;
  const quotient = String(problem.longDivision?.quotientRaw ?? problem.quotient ?? problem.answer);
  const digits = problemRawDigits(quotient);
  const remainder = problem.remainder ?? problem.longDivision?.remainder;
  return {
    length: String(digits.length),
    zero: digits.includes("0") ? "with-zero" : "without-zero",
    remainderLength: remainder === undefined ? "none" : String(problemRawDigits(remainder).length),
  };
}

function problemBalanceMeta(problem) {
  const carryProfile = problem.op === "×"
    ? multiplicationCarrySignature(problem)
    : arithmeticCarrySignature(problem);
  const carryClass = carryProfile === "none" ? "without" : "with";
  const division = divisionBalanceMeta(problem);
  const zeroCount = (problemRawDigits(problem.a) + problemRawDigits(problem.b))
    .split("")
    .filter((digit) => digit === "0")
    .length;
  const family = [
    problemDigits(problem.a).length,
    problemDigits(problem.b).length,
    carryClass,
    carryProfile,
    zeroCount > 0 ? "zero" : "no-zero",
    division?.length || "no-division",
  ].join("|");
  return {
    carryClass,
    carryProfile,
    divisionLength: division?.length || "none",
    divisionZero: division?.zero || "none",
    divisionRemainderLength: division?.remainderLength || "none",
    zeroCount,
    family,
  };
}

function makeBucketTargets(candidates, count, getBucket) {
  const availability = new Map();
  candidates.forEach((problem) => {
    const bucket = getBucket(problem);
    availability.set(bucket, (availability.get(bucket) || 0) + 1);
  });
  const buckets = shuffle([...availability.keys()]);
  const targets = new Map();
  for (let index = 0; index < count; index += 1) {
    const availableBuckets = buckets.filter((bucket) =>
      (targets.get(bucket) || 0) < availability.get(bucket));
    if (!availableBuckets.length) break;
    const minimum = Math.min(...availableBuckets.map((bucket) => targets.get(bucket) || 0));
    const choices = availableBuckets.filter((bucket) => (targets.get(bucket) || 0) === minimum);
    const bucket = choices[randomInt(0, choices.length - 1)];
    targets.set(bucket, (targets.get(bucket) || 0) + 1);
  }
  return targets;
}

function bucketBalanceScore(bucket, targets, counts, weight) {
  if (!targets.has(bucket)) return 0;
  const target = targets.get(bucket);
  const current = counts.get(bucket) || 0;
  if (current < target) return weight + (target - current) * 2;
  return -weight;
}

function sheetSignature(settings) {
  return JSON.stringify({
    operation: settings.operation,
    digitsA: settings.digitsA,
    digitsB: settings.digitsB,
    decimalPlacesA: settings.decimalPlacesA,
    decimalPlacesB: settings.decimalPlacesB,
    resultRange: settings.resultRange,
    carryMode: settings.carryMode,
    layout: settings.layout,
    creationMode: settings.creationMode,
    count: settings.count,
  });
}

function selectProblems(settings, usedKeys = new Set()) {
  const requestedCount = Math.max(0, Number(settings.count) || 0);
  if (!requestedCount) return [];

  const pool = shuffle(makeCandidatePool(settings));
  const uniquePool = [];
  const poolKeys = new Set();
  pool.forEach((problem) => {
    const key = problemKey(problem);
    if (poolKeys.has(key)) return;
    poolKeys.add(key);
    uniquePool.push(problem);
  });

  const eligiblePool = uniquePool.filter((problem) => !usedKeys.has(problemKey(problem)));
  const selectionPool = eligiblePool.length >= requestedCount ? eligiblePool : uniquePool;
  if (!selectionPool.length) return [];

  const metaCache = new Map();
  const getMeta = (problem) => {
    if (!metaCache.has(problem)) metaCache.set(problem, problemBalanceMeta(problem));
    return metaCache.get(problem);
  };
  const standardArithmetic = !String(settings.operation).startsWith("fraction");
  const isArithmetic = standardArithmetic && selectionPool.some((problem) =>
    ["+", "-", "×"].includes(problem.op));
  const isDivision = standardArithmetic && selectionPool.some((problem) => problem.op === "÷");
  const carryClassTargets = isArithmetic
    ? makeBucketTargets(selectionPool, requestedCount, (problem) => getMeta(problem).carryClass)
    : new Map();
  const carryProfileTargets = isArithmetic
    ? makeBucketTargets(selectionPool, requestedCount, (problem) => getMeta(problem).carryProfile)
    : new Map();
  const divisionLengthTargets = isDivision
    ? makeBucketTargets(selectionPool, requestedCount, (problem) => getMeta(problem).divisionLength)
    : new Map();
  const divisionZeroTargets = isDivision
    ? makeBucketTargets(selectionPool, requestedCount, (problem) => getMeta(problem).divisionZero)
    : new Map();
  const divisionRemainderLengthTargets = isDivision
    ? makeBucketTargets(selectionPool, requestedCount, (problem) => getMeta(problem).divisionRemainderLength)
    : new Map();
  const zeroCap = Math.floor(requestedCount * 0.2);
  const selected = [];
  const selectedKeys = new Set();
  const bucketCounts = {
    carryClass: new Map(),
    carryProfile: new Map(),
    divisionLength: new Map(),
    divisionZero: new Map(),
    divisionRemainderLength: new Map(),
  };
  let zeroCount = 0;
  let previousMeta = null;

  while (selected.length < requestedCount) {
    const available = selectionPool.filter((problem) => !selectedKeys.has(problemKey(problem)));
    if (!available.length) break;
    const hasZeroFreeAlternative = available.some((problem) => getMeta(problem).zeroCount === 0);
    const scored = available.map((problem) => {
      const meta = getMeta(problem);
      let score = Math.random() * 8;
      score += bucketBalanceScore(meta.carryClass, carryClassTargets, bucketCounts.carryClass, 26);
      score += bucketBalanceScore(meta.carryProfile, carryProfileTargets, bucketCounts.carryProfile, 7);
      score += bucketBalanceScore(meta.divisionLength, divisionLengthTargets, bucketCounts.divisionLength, 16);
      score += bucketBalanceScore(meta.divisionZero, divisionZeroTargets, bucketCounts.divisionZero, 7);
      score += bucketBalanceScore(meta.divisionRemainderLength, divisionRemainderLengthTargets, bucketCounts.divisionRemainderLength, 6);
      if (meta.zeroCount > 0 && zeroCount >= zeroCap && hasZeroFreeAlternative) score -= 100;
      if (meta.zeroCount === 0 && zeroCount < zeroCap) score += 3;
      if (previousMeta?.family === meta.family) score -= 18;
      if (previousMeta?.carryProfile === meta.carryProfile) score -= 2;
      return { problem, meta, score };
    });
    scored.sort((left, right) => right.score - left.score);
    const top = scored.slice(0, Math.min(6, scored.length));
    const chosen = top[randomInt(0, top.length - 1)];
    const key = problemKey(chosen.problem);
    selected.push(chosen.problem);
    selectedKeys.add(key);
    usedKeys.add(key);
    previousMeta = chosen.meta;
    if (chosen.meta.zeroCount > 0) zeroCount += 1;
    [
      ["carryClass", chosen.meta.carryClass],
      ["carryProfile", chosen.meta.carryProfile],
      ["divisionLength", chosen.meta.divisionLength],
      ["divisionZero", chosen.meta.divisionZero],
      ["divisionRemainderLength", chosen.meta.divisionRemainderLength],
    ].forEach(([name, bucket]) => {
      bucketCounts[name].set(bucket, (bucketCounts[name].get(bucket) || 0) + 1);
    });
  }

  const fallbackPool = uniquePool.length ? uniquePool : pool;
  while (selected.length < requestedCount && fallbackPool.length) {
    selected.push(fallbackPool[selected.length % fallbackPool.length]);
  }
  return selected;
}

function normalizeDivisionProblem(problem, settings) {
  if (!problem || typeof problem !== "object") return problem;
  if (settings?.operation !== "divideRemainder") return problem;
  const normalized = { ...problem, op: "÷", divisionType: "remainder" };
  const numericDividend = typeof normalized.a === "number"
    ? normalized.a
    : /^\d+$/.test(String(normalized.a ?? "")) ? Number(normalized.a) : null;
  const numericDivisor = typeof normalized.b === "number"
    ? normalized.b
    : /^\d+$/.test(String(normalized.b ?? "")) ? Number(normalized.b) : null;
  const hasIntegerOperands = Number.isSafeInteger(numericDividend)
    && Number.isSafeInteger(numericDivisor)
    && numericDivisor > 0;
  const quotientValue = hasIntegerOperands
    ? Math.floor(numericDividend / numericDivisor)
    : normalized.quotient ?? normalized.longDivision?.quotient ?? normalized.answer;
  const remainderValue = hasIntegerOperands
    ? numericDividend % numericDivisor
    : normalized.remainder ?? normalized.longDivision?.remainder;
  const answerText = typeof normalized.answer === "string" ? normalized.answer.match(/^(\d+)\s*あまり\s*(\d+)$/) : null;
  const quotient = Number(answerText?.[1] ?? quotientValue);
  const remainder = Number(answerText?.[2] ?? remainderValue);
  if (!Number.isFinite(quotient) || !Number.isFinite(remainder)) return normalized;
  normalized.answer = quotient;
  normalized.quotient = quotient;
  normalized.remainder = remainder;
  if (normalized.longDivision && typeof normalized.longDivision === "object") {
    normalized.longDivision = {
      ...normalized.longDivision,
      quotient,
      remainder,
    };
  }
  return normalized;
}

function normalizeProblems(values, settings) {
  return Array.isArray(values)
    ? values.map((problem) => normalizeDivisionProblem(problem, settings)).filter(Boolean)
    : [];
}

function noSolutionMessage(settings) {
  if (settings.operation === "divideRemainder") {
    return "この桁数では、商1以上・余りありのわり算を作れません。わられる数の桁数を大きくするか、わる数の桁数を小さくしてください。";
  }
  if (settings.operation === "divide") {
    return "この桁数では、商1以上のわり算を作れません。わられる数の桁数を大きくするか、わる数の桁数を小さくしてください。";
  }
  return "この条件で作れる問題がありません。設定を組み合わせ直してください。";
}

function makeManualProblemsForSettings(settings) {
  if (settings.creationMode === "manual" || settings.creationMode === "hybrid") {
    return createManualProblems(settings);
  }
  return selectProblems(settings);
}

function getManualFillIndexes() {
  return problems.reduce((indexes, problem, index) => {
    if (isManualEntryProblem(problem) && problem.manualSource === "blank") indexes.push(index);
    return indexes;
  }, []);
}

function getManualPreservedIndexes() {
  return problems.reduce((indexes, problem, index) => {
    if (isManualEntryProblem(problem) && problem.manualSource === "manual") indexes.push(index);
    return indexes;
  }, []);
}

function generateEditableProblems(settings, count, usedKeys = new Set()) {
  const generatedSettings = { ...settings, count };
  return selectProblems(generatedSettings, usedKeys)
    .map((problem) => makeEditableProblem(problem, settings, "auto"));
}

function generateProblems() {
  syncSettingsControls();
  const settings = getSettings();
  generationMessage = "";
  problems = makeManualProblemsForSettings(settings);
  if (!problems.length) generationMessage = noSolutionMessage(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  lastGeneratedSettings = { ...settings };
  render();
  setStatus(generationMessage || "問題を作り直しました。");
}

function fillRemainingProblems() {
  syncSettingsControls();
  const settings = getSettings();
  if (!isManualInputActive(settings) || settings.creationMode !== "hybrid") return;

  const fillIndexes = getManualFillIndexes();
  if (!fillIndexes.length) {
    setStatus("自動生成する空の問題がありません。");
    return;
  }
  const usedKeys = new Set(problems.filter(isCompleteManualProblem).map(problemKey));
  const generated = generateEditableProblems(settings, fillIndexes.length, usedKeys);
  fillIndexes.forEach((problemIndex, index) => {
    problems[problemIndex] = generated[index] || createManualProblem(settings);
  });
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  const incomplete = problems.filter((problem) => !isCompleteManualProblem(problem)).length;
  setStatus(!generated.length
    ? noSolutionMessage(settings)
    : incomplete ? `${incomplete}問は入力途中です。` : "空の問題を自動生成しました。");
}

function regenerateProblemsByMode() {
  syncSettingsControls();
  const settings = getSettings();
  if (!isManualInputActive(settings)) {
    generateProblems();
    return;
  }
  if (settings.creationMode === "manual") {
    generateProblems();
    return;
  }

  const preservedIndexes = new Set(getManualPreservedIndexes());
  const generatedIndexes = problems.map((_, index) => index).filter((index) => !preservedIndexes.has(index));
  const usedKeys = new Set([...preservedIndexes].map((index) => problems[index]).filter(isCompleteManualProblem).map(problemKey));
  const generated = generateEditableProblems(settings, generatedIndexes.length, usedKeys);
  generatedIndexes.forEach((problemIndex, index) => {
    problems[problemIndex] = generated[index] || createManualProblem(settings);
  });
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  setStatus("自動生成の問題を作り直しました。");
}

function formulaValueText(value, showDecimal) {
  const text = String(value);
  return showDecimal ? text : text.replace(".", "");
}

function divisionAnswerParts(problem) {
  const quotientValue = problem?.quotient ?? problem?.longDivision?.quotient ?? problem?.answer;
  const remainderValue = problem?.remainder ?? problem?.longDivision?.remainder ?? 0;
  return {
    quotient: Number(quotientValue),
    remainder: Number(remainderValue),
  };
}

function divisionAnswerDigitWidth(problem, part) {
  const { quotient, remainder } = divisionAnswerParts(problem);
  return String(part === "quotient" ? quotient : remainder).length;
}

function makeHorizontalManualOperand(problem, operand, problemIndex, editable) {
  const inputDigits = manualExpectedDigits(problem, operand);
  const integerDigits = manualIntegerDigitCount(problem, operand);
  const fractionDigits = manualFractionDigitCount(problem, operand);
  const value = sanitizeManualValue(
    manualOperandValue(problem, operand),
    inputDigits,
    manualPreservesLeadingZeros(problem),
  ).padEnd(inputDigits, " ").slice(0, inputDigits);
  const wrapper = document.createElement("span");
  wrapper.className = "horizontal-manual-operand";
  wrapper.style.setProperty("--manual-digit-count", String(manualDisplayDigitCount(problem, operand)));
  wrapper.style.setProperty("--manual-integer-digit-count", String(Math.max(1, integerDigits)));
  const appendCell = (digit, fixed = false) => {
    const cell = document.createElement("span");
    cell.className = fixed ? "horizontal-manual-cell horizontal-manual-fixed-zero" : "horizontal-manual-cell";
    if (digit.trim()) cell.textContent = digit;
    wrapper.append(cell);
  };
  if (problem.manualDecimal && integerDigits === 0) appendCell("0", true);
  value.split("").forEach((digit, index) => {
    if (problem.manualDecimal && fractionDigits > 0 && index === integerDigits) {
      const decimal = document.createElement("span");
      decimal.className = "horizontal-manual-decimal";
      decimal.textContent = ".";
      wrapper.append(decimal);
    }
    appendCell(digit);
  });
  if (problem.manualDecimal && fractionDigits > 0 && integerDigits === inputDigits) {
    const decimal = document.createElement("span");
    decimal.className = "horizontal-manual-decimal";
    decimal.textContent = ".";
    wrapper.append(decimal);
  }
  if (editable) {
    wrapper.append(makeManualEntryInput({
      problemIndex,
      operand,
      digits: inputDigits,
      value: manualOperandValue(problem, operand),
      preserveLeadingZeros: manualPreservesLeadingZeros(problem),
    }));
  }
  return wrapper;
}

function makeHorizontalFormula(problem, showAnswer, settings = null, problemIndex = null) {
  const formula = document.createElement("span");
  const manualProblem = isManualEntryProblem(problem);
  formula.className = manualProblem ? "formula horizontal-manual-formula" : "formula";
  const activeSettings = settings || getSettings();
  const editable = !showAnswer
    && isManualInputActive(activeSettings)
    && manualProblem
    && Number.isInteger(problemIndex);
  const answerVisible = showAnswer && (!manualProblem || isCompleteManualProblem(problem));

  if (editable) {
    const operator = document.createElement("span");
    operator.className = "horizontal-formula-operator";
    operator.textContent = problem.op;
    const equals = document.createElement("span");
    equals.className = "horizontal-formula-equals";
    equals.textContent = "=";
    formula.append(
      makeHorizontalManualOperand(problem, "a", problemIndex, true),
      operator,
      makeHorizontalManualOperand(problem, "b", problemIndex, true),
      equals,
    );
  } else {
    const expression = document.createElement("span");
    expression.className = "formula-expression";
    const valueA = manualProblem
      ? (manualOperandDisplayText(problem, "a") || "□")
      : problem.a;
    const valueB = manualProblem
      ? (manualOperandDisplayText(problem, "b") || "□")
      : problem.b;
    const displayValueA = manualProblem && !manualOperandValue(problem, "a") ? "□" : valueA;
    const displayValueB = manualProblem && !manualOperandValue(problem, "b") ? "□" : valueB;
    expression.textContent = `${formulaValueText(manualProblem && !manualOperandValue(problem, "a") ? "\u25a1" : valueA, true)} ${problem.op} ${formulaValueText(manualProblem && !manualOperandValue(problem, "b") ? "\u25a1" : valueB, true)} =`;
    formula.append(expression);
  }
  const answer = document.createElement("span");
  if (isRemainderDivisionProblem(problem, activeSettings)) {
    answer.className = "division-answer";
    ["quotient", "remainder"].forEach((part, index) => {
      if (index > 0) {
        const label = document.createElement("span");
        label.className = "division-answer-label";
        label.textContent = " あまり ";
        answer.append(label);
      }
      const value = document.createElement("span");
      value.className = answerVisible ? "answer-value division-answer-part" : "blank division-answer-part";
      value.style.setProperty("--division-answer-digits", String(divisionAnswerDigitWidth(problem, part)));
      value.textContent = answerVisible ? String(divisionAnswerParts(problem)[part]) : "\u25a1";
      answer.append(value);
    });
  } else {
    answer.className = answerVisible ? "answer-value" : "blank";
    answer.textContent = answerVisible ? formulaValueText(problem.answer, true) : "\u25a1";
  }
  formula.append(answer);
  return formula;
}

function fitHorizontalFormulas(list) {
  list.querySelectorAll(".horizontal-manual-formula, .calculation-workspace > .formula").forEach((formula) => {
    formula.style.width = "100%";
    formula.style.maxWidth = "100%";
    formula.style.removeProperty("font-size");
    const defaultFontSize = Number.parseFloat(getComputedStyle(formula).fontSize);
    if (!Number.isFinite(defaultFontSize)) return;
    const availableWidth = formula.clientWidth;
    let fontSize = defaultFontSize;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      formula.style.fontSize = `${fontSize}px`;
      const contentWidth = formula.scrollWidth;
      if (contentWidth <= availableWidth + 0.5 || availableWidth <= 0) break;
      fontSize = Math.max(10, fontSize * (availableWidth / contentWidth) * 0.98);
    }
  });
}

function scheduleHorizontalFormulaFit() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      els.pages.querySelectorAll(".problem-grid").forEach(fitHorizontalFormulas);
      window.__printAdjustmentsRefresh?.({ autoFit: false, notify: false });
    });
  });
}

window.addEventListener("print-adjustments:applied", scheduleHorizontalFormulaFit);

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
  return ["+", "-"].includes(problem.op)
    && (problem.manualDecimal === true || String(problem.a).includes(".") || String(problem.b).includes("."));
}

function getSimpleProblemLayout(problem, totalColumns) {
  if (isDecimalAddSub(problem)) {
    const integerWidth = problem.manualDecimal
      ? Math.max(manualIntegerDigitCount(problem, "a"), manualIntegerDigitCount(problem, "b"), 1)
      : Math.max(integerDigitCount(problem.a), integerDigitCount(problem.b));
    const fractionWidth = problem.manualDecimal
      ? Math.max(manualFractionDigitCount(problem, "a"), manualFractionDigitCount(problem, "b"))
      : Math.max(fractionDigitCount(problem.a), fractionDigitCount(problem.b));
    const numericWidth = integerWidth + fractionWidth;
    const startIndex = Math.max(0, totalColumns - numericWidth);
    return {
      operatorColumn: Math.max(1, startIndex),
      first: problem.manualDecimal
        ? formatManualAlignedDecimalData(problem, "a", totalColumns, integerWidth, fractionWidth)
        : formatAlignedDecimalData(problem.a, totalColumns, integerWidth, fractionWidth),
      second: problem.manualDecimal
        ? formatManualAlignedDecimalData(problem, "b", totalColumns, integerWidth, fractionWidth)
        : formatAlignedDecimalData(problem.b, totalColumns, integerWidth, fractionWidth),
      answer: formatAlignedAnswerData(problem.answer, totalColumns, fractionWidth),
    };
  }
  const operandWidth = isManualEntryProblem(problem)
    ? Math.max(manualExpectedDigits(problem, "a"), manualExpectedDigits(problem, "b"))
    : Math.max(workspaceDigitCount(problem.a), workspaceDigitCount(problem.b));
  const first = isManualEntryProblem(problem)
    ? formatManualDigitData(problem.a, totalColumns, manualExpectedDigits(problem, "a"))
    : formatDigitData(problem.a, totalColumns);
  const second = isManualEntryProblem(problem)
    ? formatManualDigitData(problem.b, totalColumns, manualExpectedDigits(problem, "b"))
    : formatDigitData(problem.b, totalColumns);
  return {
    operatorColumn: Math.max(1, totalColumns - operandWidth),
    first,
    second,
    answer: formatDigitData(problem.answer, totalColumns),
  };
}

function getSimpleBoardSize(pageProblems) {
  return pageProblems.reduce((size, problem) => {
    if (isDecimalAddSub(problem)) {
      const integerWidth = problem.manualDecimal
        ? Math.max(manualIntegerDigitCount(problem, "a"), manualIntegerDigitCount(problem, "b"), 1)
        : Math.max(integerDigitCount(problem.a), integerDigitCount(problem.b));
      const fractionWidth = problem.manualDecimal
        ? Math.max(manualFractionDigitCount(problem, "a"), manualFractionDigitCount(problem, "b"))
        : Math.max(fractionDigitCount(problem.a), fractionDigitCount(problem.b));
      return Math.max(size, integerWidth + fractionWidth + 1);
    }
    if (isManualEntryProblem(problem)) {
      const operandWidth = Math.max(manualDisplayDigitCount(problem, "a"), manualDisplayDigitCount(problem, "b"));
      return Math.max(size, operandWidth + 1, workspaceDigitCount(problem.answer));
    }
    return Math.max(size, workspaceDigitCount(problem.a) + 1, workspaceDigitCount(problem.b) + 1, workspaceDigitCount(problem.answer));
  }, 2);
}

function getCalculationWorkspaceSize(pageProblems) {
  return { columns: getSimpleBoardSize(pageProblems), rows: 3 };
}

function makeWorkspaceDigitRow(digitData, totalColumns, operator = "", showCarryBoxes = false, blank = false, resultRow = false, operatorColumn = 1, showDecimal = false, helperDigits = null) {
  const row = makeDigitRow(digitData, operator, showCarryBoxes, blank, {
    totalColumns,
    operatorColumn,
    showDecimal,
    helperDigits,
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

function makeCalculationWorkspace(problem, showAnswer, settings, size, problemIndex = null) {
  const workspace = document.createElement("span");
  workspace.className = "calculation-workspace";
  workspace.append(makeHorizontalFormula(problem, showAnswer, settings, problemIndex));

  if (supportsLongDivisionLayout()) {
    workspace.append(makeLongDivisionBoard(problem, showAnswer, size.rows, size.columns, showAnswer, settings));
    return workspace;
  }

  if (supportsMultiplicationVerticalLayout()) {
    workspace.append(makeMultiplicationVerticalFormula(problem, showAnswer, settings, size.columns, !showAnswer, size.columns));
    return workspace;
  }

  workspace.append(makeWorkspaceSimpleFormula(problem, settings, size.columns, showAnswer));
  return workspace;
}

function digitCount(value) {
  return String(value).replaceAll(".", "").length;
}

function formatDigitData(value, width) {
  const text = String(value ?? "");
  const decimalIndex = text.indexOf(".");
  const rawDigits = text.replaceAll(".", "");
  const padding = Math.max(0, width - rawDigits.length);
  const digits = rawDigits.padStart(width, " ").slice(-width).split("");
  return {
    digits,
    decimalAfterIndex: decimalIndex < 0 ? -1 : padding + decimalIndex - 1,
  };
}

function formatManualDigitData(value, totalColumns, operandWidth) {
  const text = sanitizeManualValue(value, operandWidth).padEnd(operandWidth, " ");
  const padding = Math.max(0, totalColumns - operandWidth);
  return {
    digits: `${" ".repeat(padding)}${text}`.slice(-totalColumns).split(""),
    decimalAfterIndex: -1,
  };
}

function formatManualOperandData(problem, operand, totalColumns) {
  const integerDigits = manualIntegerDigitCount(problem, operand);
  const fractionDigits = manualFractionDigitCount(problem, operand);
  const inputDigits = manualExpectedDigits(problem, operand);
  const raw = sanitizeManualValue(
    manualOperandValue(problem, operand),
    inputDigits,
    manualPreservesLeadingZeros(problem),
  ).padEnd(inputDigits, " ");
  const integerPart = integerDigits === 0 ? "0" : raw.slice(0, integerDigits);
  const fractionPart = fractionDigits > 0 ? raw.slice(integerDigits, integerDigits + fractionDigits) : "";
  const numeric = `${integerPart}${fractionPart}`;
  const padding = Math.max(0, totalColumns - numeric.length);
  return {
    digits: `${" ".repeat(padding)}${numeric}`.slice(-totalColumns).split(""),
    decimalAfterIndex: fractionDigits > 0 ? padding + integerPart.length - 1 : -1,
  };
}

function formatManualAlignedDecimalData(problem, operand, totalColumns, integerWidth, fractionWidth) {
  const sourceIntegerDigits = manualIntegerDigitCount(problem, operand);
  const sourceFractionDigits = manualFractionDigitCount(problem, operand);
  const inputDigits = manualExpectedDigits(problem, operand);
  const raw = sanitizeManualValue(
    manualOperandValue(problem, operand),
    inputDigits,
    manualPreservesLeadingZeros(problem),
  ).padEnd(inputDigits, " ");
  const integerPart = sourceIntegerDigits === 0 ? "0" : raw.slice(0, sourceIntegerDigits);
  const fractionPart = sourceFractionDigits > 0 ? raw.slice(sourceIntegerDigits, sourceIntegerDigits + sourceFractionDigits) : "";
  const numeric = `${integerPart.padStart(integerWidth, " ")}${fractionPart.padEnd(fractionWidth, " ")}`;
  const padding = Math.max(0, totalColumns - numeric.length);
  return {
    digits: `${" ".repeat(padding)}${numeric}`.slice(-totalColumns).split(""),
    decimalAfterIndex: fractionWidth > 0 ? padding + integerWidth - 1 : -1,
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

function makeDigitCell(digit, showCarryBoxes, blank = false, showDecimal = false, helperValue = "") {
  const cell = document.createElement("span");
  cell.className = "digit-cell";
  if (showCarryBoxes) {
    const helper = document.createElement("span");
    helper.className = "helper-box";
    if (!blank && helperValue !== "") {
      const value = document.createElement("span");
      value.className = "helper-value";
      value.textContent = helperValue;
      helper.append(value);
    }
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

function makeManualEntryInput(config) {
  const input = document.createElement("input");
  input.className = "manual-entry-input";
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = config.digits;
  input.value = sanitizeManualValue(config.value, config.digits, config.preserveLeadingZeros === true);
  input.setAttribute("aria-label", `${config.problemIndex + 1}番 ${config.operand === "a" ? "上の数" : "下の数"}`);
  input.title = "数字を入力";
  input.dataset.manualEntry = "true";
  input.dataset.problemIndex = String(config.problemIndex);
  input.dataset.operand = config.operand;
  input.dataset.digits = String(config.digits);
  input.dataset.preserveLeadingZeros = config.preserveLeadingZeros === true ? "true" : "false";
  return input;
}

function makeDigitRow(digitData, operator = "", showCarryBoxes = true, blank = false, options = {}) {
  const { digits, decimalAfterIndex = -1 } = Array.isArray(digitData)
    ? { digits: digitData }
    : digitData;
  const totalColumns = options.totalColumns || digits.length;
  const operatorColumn = options.operatorColumn || 1;
  const showDecimal = options.showDecimal === true;
  const helperDigits = Array.isArray(options.helperDigits) ? options.helperDigits : [];
  const manualInput = options.manualInput || null;
  const row = document.createElement("span");
  row.className = "digit-row";
  if (manualInput) row.classList.add("manual-entry-row");
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
    row.append(makeDigitCell(digit, showCarryBoxes, blank, showDecimal && decimalAfterIndex === index, helperDigits[index] || ""));
  });
  if (manualInput) row.append(makeManualEntryInput(manualInput));
  return row;
}

function makeVerticalFormula(problem, showAnswer, settings, width, problemIndex = null) {
  const formula = document.createElement("span");
  formula.className = "vertical-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const layout = getSimpleProblemLayout(problem, width);
  const editable = !showAnswer && isManualInputActive(settings) && isManualEntryProblem(problem) && Number.isInteger(problemIndex);
  formula.append(makeDigitRow(layout.first, "", settings.showCarryBoxes, false, {
    totalColumns: width,
    operatorColumn: layout.operatorColumn,
    showDecimal: true,
    manualInput: editable ? {
      problemIndex,
      operand: "a",
      digits: manualExpectedDigits(problem, "a"),
      value: manualOperandValue(problem, "a"),
      preserveLeadingZeros: manualPreservesLeadingZeros(problem),
    } : null,
  }));
  formula.append(makeDigitRow(layout.second, problem.op, settings.showCarryBoxes, false, {
    totalColumns: width,
    operatorColumn: layout.operatorColumn,
    showDecimal: true,
    manualInput: editable ? {
      problemIndex,
      operand: "b",
      digits: manualExpectedDigits(problem, "b"),
      value: manualOperandValue(problem, "b"),
      preserveLeadingZeros: manualPreservesLeadingZeros(problem),
    } : null,
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
  const raw = isManualEntryProblem(problem)
    ? manualOperandValue(problem, "b")
    : String(problem.b).replaceAll(".", "").replace(/^0+(?=\d)/, "");
  return raw.split("").filter((digit) => /\d/.test(digit)).reverse().map((digit) => Number.parseInt(digit, 10));
}

function multiplicationStepCount(problem) {
  return isManualEntryProblem(problem)
    ? manualExpectedDigits(problem, "b")
    : multiplicationDigits(problem).length;
}

function multiplicationInteger(value) {
  const raw = String(value).replaceAll(".", "").replace(/^0+(?=\d)/, "");
  return Number.parseInt(raw || "0", 10);
}

function multiplicationCarryDigits(problem, multiplierDigit, totalColumns, shift = 0) {
  const helperDigits = Array(totalColumns).fill("");
  const multiplicandDigits = String(multiplicationInteger(problem.a)).split("").map(Number);
  let carry = 0;

  for (let sourceIndex = multiplicandDigits.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
    const total = multiplicandDigits[sourceIndex] * multiplierDigit + carry;
    carry = Math.floor(total / 10);
    const distanceFromRight = multiplicandDigits.length - sourceIndex + shift;
    const targetIndex = totalColumns - 1 - distanceFromRight;
    if (carry > 0 && targetIndex >= 0 && targetIndex < totalColumns) {
      helperDigits[targetIndex] = String(carry);
    }
  }

  return helperDigits;
}

function multiplicationAdditionCarryDigits(problem, totalColumns) {
  const helperDigits = Array(totalColumns).fill("");
  const multiplicand = multiplicationInteger(problem.a);
  const addends = multiplicationDigits(problem).map((digit, placeIndex) => ({
    digits: String(multiplicand * digit).split("").reverse().map(Number),
    shift: placeIndex,
  }));
  let carry = 0;

  for (let columnFromRight = 0; columnFromRight < totalColumns; columnFromRight += 1) {
    const sum = carry + addends.reduce((total, addend) => {
      const digitIndex = columnFromRight - addend.shift;
      return total + (digitIndex >= 0 ? addend.digits[digitIndex] || 0 : 0);
    }, 0);
    carry = Math.floor(sum / 10);
    const targetIndex = totalColumns - 2 - columnFromRight;
    if (carry > 0 && targetIndex >= 0) helperDigits[targetIndex] = String(carry);
  }

  return helperDigits;
}

function multiplicationFormulaRows(problem) {
  const steps = multiplicationStepCount(problem);
  return steps === 1 ? 4 : steps + 5;
}

function multiplicationFormulaWidth(problem) {
  if (isManualEntryProblem(problem)) {
    const expectedA = manualDisplayDigitCount(problem, "a");
    const expectedB = manualDisplayDigitCount(problem, "b");
    const answerWidth = isCompleteManualProblem(problem) ? digitCount(problem.answer) : 0;
    return Math.max(2, expectedA, expectedB, expectedA + expectedB, answerWidth);
  }
  const multiplicand = multiplicationInteger(problem.a);
  const partials = multiplicationDigits(problem).map((digit) => multiplicand * digit);
  return Math.max(2, digitCount(problem.a), digitCount(problem.b), digitCount(problem.answer), ...partials.map(digitCount));
}

function makeMultiplicationVerticalFormula(problem, showAnswer, settings, width, hideGiven = false, workspaceTotalColumns = null, problemIndex = null) {
  const manualProblem = isManualEntryProblem(problem);
  const answerVisible = showAnswer && (!manualProblem || isCompleteManualProblem(problem));
  const stepCount = multiplicationStepCount(problem);
  const steps = manualProblem && !isCompleteManualProblem(problem)
    ? Array.from({ length: stepCount }, () => 0)
    : multiplicationDigits(problem);
  const multiplicand = multiplicationInteger(problem.a);
  const formula = document.createElement("span");
  formula.className = "vertical-formula multiplication-formula";
  formula.classList.toggle("with-carry-boxes", settings.showCarryBoxes);
  const workspace = Number.isInteger(workspaceTotalColumns);
  const totalColumns = workspace ? workspaceTotalColumns : width;
  const operandWidth = manualProblem
    ? Math.max(manualDisplayDigitCount(problem, "a"), manualDisplayDigitCount(problem, "b"))
    : Math.max(workspaceDigitCount(problem.a), workspaceDigitCount(problem.b));
  const operatorColumn = Math.max(1, totalColumns - operandWidth);
  const makeRow = (data, operator = "", blank = false, result = false, showDecimal = false, helperDigits = null) => workspace
    ? makeWorkspaceDigitRow(data, totalColumns, operator, settings.showCarryBoxes, blank, result, operatorColumn, showDecimal, helperDigits)
    : makeDigitRow(data, operator, settings.showCarryBoxes, blank, {
      totalColumns,
      operatorColumn,
      showDecimal,
      helperDigits,
    });
  const formatOperand = (value, operand) => manualProblem && problem.manualDecimal
    ? formatManualOperandData(problem, operand, totalColumns)
    : manualProblem
      ? formatManualDigitData(value, totalColumns, manualExpectedDigits(problem, operand))
    : formatDigitData(value, totalColumns);
  const editable = !showAnswer && !workspace && isManualInputActive(settings) && manualProblem && Number.isInteger(problemIndex);
  formula.style.setProperty("--digit-count", String(totalColumns));
  const showProblemDecimal = hideGiven ? settings.showWorkspaceDecimalPoint !== false : true;
  formula.append(makeRow(formatOperand(problem.a, "a"), "", hideGiven, false, showProblemDecimal));
  formula.append(makeRow(formatOperand(problem.b, "b"), settings.showWorkspaceOperator || showAnswer ? "×" : "", hideGiven, false, showProblemDecimal));
  if (editable) {
    const rows = formula.querySelectorAll(":scope > .digit-row");
    rows[0]?.append(makeManualEntryInput({
      problemIndex,
      operand: "a",
      digits: manualExpectedDigits(problem, "a"),
      value: manualOperandValue(problem, "a"),
      preserveLeadingZeros: manualPreservesLeadingZeros(problem),
    }));
    rows[0]?.classList.add("manual-entry-row");
    rows[1]?.append(makeManualEntryInput({
      problemIndex,
      operand: "b",
      digits: manualExpectedDigits(problem, "b"),
      value: manualOperandValue(problem, "b"),
      preserveLeadingZeros: manualPreservesLeadingZeros(problem),
    }));
    rows[1]?.classList.add("manual-entry-row");
  }

  const subtotalLine = document.createElement("span");
  subtotalLine.className = "vertical-line";
  formula.append(subtotalLine);

  if (steps.length > 1) {
    steps.forEach((digit, placeIndex) => {
      const data = answerVisible
        ? formatShiftedDigitData(multiplicand * digit, totalColumns, placeIndex)
        : formatDigitData("", totalColumns);
      const helperDigits = answerVisible
        ? multiplicationCarryDigits(problem, digit, totalColumns, placeIndex)
        : null;
      formula.append(makeRow(data, "", !answerVisible, false, false, helperDigits));
    });
    const answerLine = document.createElement("span");
    answerLine.className = "vertical-line";
    formula.append(answerLine);
  }

  const answerHelperDigits = answerVisible
    ? steps.length === 1
      ? multiplicationCarryDigits(problem, steps[0], totalColumns)
      : multiplicationAdditionCarryDigits(problem, totalColumns)
    : null;
  formula.append(makeRow(
    formatDigitData(answerVisible ? problem.answer : "", totalColumns),
    "",
    !answerVisible,
    workspace,
    answerVisible || settings.showAnswerDecimalPoint,
    answerHelperDigits,
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

function addDivisionManualEntryInput(board, config) {
  const input = makeManualEntryInput(config);
  input.classList.add("division-manual-entry-input");
  input.style.gridRow = "2";
  input.style.gridColumn = `${config.startColumn} / span ${config.digits}`;
  board.append(input);
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

function makeDivisionRemainderLabel(problem) {
  const label = document.createElement("span");
  label.className = "division-remainder-label answer-value";
  label.textContent = `あまり ${divisionAnswerParts(problem).remainder}`;
  return label;
}

function makeLongDivisionBoard(problem, showAnswer, boardRows, boardColumns, showGiven = true, settings = null, problemIndex = null) {
  const details = problem.longDivision;
  const trace = buildLongDivisionTrace(details);
  const manualProblem = isManualEntryProblem(problem);
  const answerVisible = showAnswer && (!manualProblem || isCompleteManualProblem(problem));
  const editable = !showAnswer && isManualInputActive(settings) && manualProblem && Number.isInteger(problemIndex);
  const board = document.createElement("span");
  board.className = "long-division-board";
  board.style.setProperty("--division-board-rows", String(boardRows));
  board.style.setProperty("--division-board-columns", String(boardColumns));

  for (let row = 1; row <= boardRows; row += 1) {
    for (let column = 1; column <= boardColumns; column += 1) addDivisionBoardCell(board, row, column);
  }

  addDivisionFrame(board, details.divisorDigits, boardColumns);
  const showProblemDecimal = showGiven ? true : settings?.showWorkspaceDecimalPoint !== false;
  const showAnswerDecimal = answerVisible || settings?.showAnswerDecimalPoint !== false;
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
    if (editable) {
      addDivisionManualEntryInput(board, {
        problemIndex,
        operand: "b",
        digits: manualExpectedDigits(problem, "b"),
        value: manualOperandValue(problem, "b"),
        startColumn: 1,
        preserveLeadingZeros: manualPreservesLeadingZeros(problem),
      });
      addDivisionManualEntryInput(board, {
        problemIndex,
        operand: "a",
        digits: manualExpectedDigits(problem, "a"),
        value: manualOperandValue(problem, "a"),
        startColumn: details.divisorDigits + 1,
        preserveLeadingZeros: manualPreservesLeadingZeros(problem),
      });
    }
  } else if (showProblemDecimal) {
    const divisorText = details.displayDivisor ?? details.divisor;
    const dividendText = details.displayDividend ?? details.dividend;
    const divisorPoint = String(divisorText).includes(".") ? String(divisorText).indexOf(".") - 1 : details.divisorDecimalAfterIndex;
    const dividendPoint = String(dividendText).includes(".") ? String(dividendText).indexOf(".") - 1 : details.dividendDecimalAfterIndex;
    if (divisorPoint >= 0) addDivisionBoardDecimal(board, 2, 1 + divisorPoint);
    if (dividendPoint >= 0) addDivisionBoardDecimal(board, 2, details.divisorDigits + 1 + dividendPoint);
  }

  if (answerVisible) {
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
  if (answerVisible && isRemainderDivisionProblem(problem, settings)) {
    const wrapper = document.createElement("span");
    wrapper.className = "division-board-wrap";
    wrapper.append(board, makeDivisionRemainderLabel(problem));
    return wrapper;
  }
  return board;
}

function getLongDivisionBoardSize(pageProblems) {
  return pageProblems.reduce((size, problem) => {
    const trace = buildLongDivisionTrace(problem.longDivision);
    const divisorDigits = isManualEntryProblem(problem)
      ? Math.max(manualDisplayDigitCount(problem, "b"), problem.longDivision.divisorDigits || 0)
      : problem.longDivision.divisorDigits;
    const dividendDigits = isManualEntryProblem(problem)
      ? Math.max(manualDisplayDigitCount(problem, "a"), divisionValueDigitLength(problem.longDivision.answerDisplayDividend ?? problem.longDivision.dividend))
      : Math.max(
        divisionValueDigitLength(problem.longDivision.dividendRaw ?? problem.longDivision.dividend),
        divisionValueDigitLength(problem.longDivision.displayDividend ?? problem.longDivision.dividend),
        divisionValueDigitLength(problem.longDivision.answerDisplayDividend ?? problem.longDivision.dividend),
      );
    return {
      rows: Math.max(size.rows, trace.rows.length + 2, 6),
      columns: Math.max(
        size.columns,
        divisorDigits + dividendDigits,
        problem.longDivision.divisorDigits + dividendDigits,
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
    isManualEntryProblem(problem) ? manualDisplayDigitCount(problem, "a") : digitCount(problem.a),
    isManualEntryProblem(problem) ? manualDisplayDigitCount(problem, "b") : digitCount(problem.b),
  )));
  return {
    rows: boardSize.rows,
    columns: Math.max(operandDigits + 1, boardSize.columns),
  };
}

function makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize, multiplicationBoardSize, workspaceSize, problemIndex = null) {
  if (settings.layout === "horizontal-workspace") {
    return makeCalculationWorkspace(problem, showAnswer, settings, workspaceSize, problemIndex);
  }
  if (settings.layout === "vertical" && problem.longDivision) {
    return makeLongDivisionBoard(problem, showAnswer, longDivisionBoardSize.rows, longDivisionBoardSize.columns, true, settings, problemIndex);
  }
  if (settings.layout === "vertical" && problem.op === "×") {
    return makeMultiplicationVerticalFormula(problem, showAnswer, settings, multiplicationBoardSize.columns, false, null, problemIndex);
  }
  return settings.layout === "vertical"
    ? makeVerticalFormula(problem, showAnswer, settings, verticalDigitCount, problemIndex)
    : makeHorizontalFormula(problem, showAnswer, settings, problemIndex);
}

function setDivisionCellSizing(list, cellSize, fontSize) {
  list.style.setProperty(
    "--division-cell-font-ratio",
    String((cellSize * 96 / 25.4 / Math.max(1, fontSize)).toFixed(4)),
  );
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
    setDivisionCellSizing(list, cellSize, fontSize);
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
    setDivisionCellSizing(list, cellSize, fontSize);
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
  pageProblems.forEach((problem, problemIndex) => {
    const item = document.createElement("li");
    item.className = "problem";
    if (!showAnswer && manualProblemNeedsAttention(problem)) item.classList.add("manual-problem-attention");
    item.append(makeFormula(problem, showAnswer, settings, verticalDigitCount, longDivisionBoardSize, multiplicationBoardSize, workspaceSize, problemIndex));
    list.append(item);
  });
  fitHorizontalFormulas(list);
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
  scheduleHorizontalFormulaFit();
  els.pageCount.textContent = `${pages.length}枚`;
  saveState();
}

function render() {
  syncSettingsControls();
  const settings = getSettings();
  if (!problems.length && !generationMessage) problems = makeManualProblemsForSettings(settings);
  if (problems.length < settings.count) {
    if (isManualInputActive(settings)) {
      while (problems.length < settings.count) problems.push(createManualProblem(settings));
    } else {
      problems = selectProblems(settings);
    }
  }
  if (problems.length > settings.count) problems = problems.slice(0, settings.count);
  els.pages.replaceChildren(renderPage("もんだい", false), renderPage("こたえ", true));
  scheduleHorizontalFormulaFit();
  els.pageCount.textContent = "2枚";
  lastGeneratedSettings = { ...settings };
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
    problems = normalizeProblems(sharedState.problems, getSettings());
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(stateStorageKey) || "null");
    if (saved?.settings) applySettings(saved.settings);
    if (Array.isArray(saved?.problems)) problems = normalizeProblems(saved.problems, getSettings());
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

function restoreManualEntryFocus() {
  if (!manualFocusTarget) return;
  const target = manualFocusTarget;
  manualFocusTarget = null;
  window.requestAnimationFrame(() => {
    const input = els.pages.querySelector(`.manual-entry-input[data-problem-index="${target.problemIndex}"][data-operand="${target.operand}"]`);
    if (!input) return;
    input.focus();
    input.setSelectionRange(target.position, target.position);
  });
}

function updateManualEntry(input, value) {
  const problemIndex = Number(input.dataset.problemIndex);
  const operand = input.dataset.operand;
  const problem = problems[problemIndex];
  if (!problem || !["a", "b"].includes(operand)) return;

  const digits = manualExpectedDigits(problem, operand, Number(input.dataset.digits));
  const sanitized = sanitizeManualValue(
    value,
    digits,
    problem.manualDecimal || input.dataset.preserveLeadingZeros === "true",
  );
  problem[operand] = sanitized;
  problem.manualSource = manualOperandValue(problem, "a") === "" && manualOperandValue(problem, "b") === ""
    ? "blank"
    : "manual";
  updateManualProblemAnswer(problem);
  sheetProblemSets = [];
  sheetSetSignature = "";
  manualFocusTarget = {
    problemIndex,
    operand,
    position: sanitized.length,
  };
  render();
  restoreManualEntryFocus();
}

function handleManualEntryInput(event) {
  const input = event.target.closest(".manual-entry-input");
  if (!input) return;
  updateManualEntry(input, input.value);
}

function handleManualEntryPaste(event) {
  const input = event.target.closest(".manual-entry-input");
  if (!input) return;
  event.preventDefault();
  const pasted = event.clipboardData?.getData("text") || "";
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  updateManualEntry(input, `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`);
}

function handleManualEntryPointerDown(event) {
  const input = event.target.closest(".manual-entry-input");
  if (!input || document.activeElement === input) return;
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function incompleteManualProblemNumbers(settings = getSettings()) {
  if (!isManualInputActive(settings)) return [];
  return problems.reduce((numbers, problem, index) => {
    if (!isCompleteManualProblem(problem)) numbers.push(index + 1);
    return numbers;
  }, []);
}

function handleProblemSettingsChange() {
  const previous = lastGeneratedSettings;
  syncSettingsControls();
  const next = getSettings();
  if (previous && isProblemSettingsChanged(previous, next) && hasEnteredManualProblems()) {
    const confirmed = window.confirm("設定を変更すると、入力した問題を作り直します。続けますか？");
    if (!confirmed) {
      restoreSettingsControls(previous);
      return;
    }
  }
  generateProblems();
}

function handleCreationModeChange() {
  const previous = lastGeneratedSettings;
  syncSettingsControls();
  const next = getSettings();
  if (previous && previous.creationMode !== next.creationMode && hasEnteredManualProblems()) {
    const confirmed = window.confirm("問題の作り方を変更すると、入力した問題を作り直します。続けますか？");
    if (!confirmed) {
      restoreSettingsControls(previous);
      return;
    }
  }
  generateProblems();
}

function handleProblemCountInput() {
  if (els.problemCount.value === "") return;
  syncSettingsControls();
  const settings = getSettings();
  if (!isManualInputActive(settings)) {
    generateProblems();
    return;
  }

  if (settings.count < problems.length && problems.slice(settings.count).some(hasManualInput)) {
    const confirmed = window.confirm("減らした問題数より後ろの入力内容が削除されます。続けますか？");
    if (!confirmed) {
      els.problemCount.value = String(lastGeneratedSettings?.count || problems.length);
      render();
      return;
    }
  }
  problems = problems.slice(0, settings.count);
  while (problems.length < settings.count) problems.push(createManualProblem(settings));
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
}

function handlePrint() {
  const settings = getSettings();
  const incomplete = incompleteManualProblemNumbers(settings);
  if (incomplete.length) {
    incomplete.forEach((number) => {
      if (problems[number - 1]) problems[number - 1].manualErrorVisible = true;
    });
    render();
    setStatus(`${incomplete.join("、")}番の問題を確認してください。`);
    return;
  }
  render();
  window.print();
}

function handlePrintClickCapture(event) {
  const button = event.target.closest?.("#printBtn");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  handlePrint();
}

function handlePrintShortcutCapture(event) {
  const key = event.key?.toLowerCase();
  if (!(event.ctrlKey || event.metaKey) || key !== "p" || event.altKey) return;
  const incomplete = incompleteManualProblemNumbers(getSettings());
  if (!incomplete.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  incomplete.forEach((number) => {
    if (problems[number - 1]) problems[number - 1].manualErrorVisible = true;
  });
  render();
  setStatus(`${incomplete.join("、")}番の問題を確認してください。`);
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle, els.columns].forEach((control) => {
    control.addEventListener("input", () => {
      if (control === els.columns && control.value === "") return;
      render();
    });
  });
  [els.operation, els.digitsA, els.digitsB, els.decimalPlacesA, els.decimalPlacesB, els.resultRange, els.carryMode, els.layoutMode].forEach((control) => {
    control.addEventListener("change", handleProblemSettingsChange);
  });
  els.creationMode.addEventListener("change", handleCreationModeChange);
  els.showCarryBoxes.addEventListener("change", render);
  els.showWorkspaceDecimalPoint.addEventListener("change", render);
  els.showAnswerDecimalPoint.addEventListener("change", render);
  els.showWorkspaceOperator.addEventListener("change", render);
  els.problemCount.addEventListener("input", handleProblemCountInput);
  els.printBtn.addEventListener("click", handlePrint);
  els.fillRemainingBtn.addEventListener("click", fillRemainingProblems);
  els.regenerateBtn.addEventListener("click", regenerateProblemsByMode);
  els.copyLinkBtn.addEventListener("click", copyShareUrl);
  els.pages.addEventListener("input", handleManualEntryInput);
  els.pages.addEventListener("paste", handleManualEntryPaste);
  els.pages.addEventListener("pointerdown", handleManualEntryPointerDown);
  document.addEventListener("click", handlePrintClickCapture, true);
  document.addEventListener("keydown", handlePrintShortcutCapture, true);
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

function cloneStateValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function getLibraryState() {
  const settings = getSettings();
  settings.name = "";
  settings.date = "";
  return {
    settings,
    problems: cloneStateValue(problems) || [],
  };
}

function applyLibraryState(state) {
  if (!state?.settings || typeof state.settings !== "object") return false;

  const settings = {
    ...state.settings,
    name: "",
    date: "",
  };
  if (state.printAdjustments && typeof window.__printAdjustmentsApplySettings === "function") {
    window.__printAdjustmentsApplySettings(state.printAdjustments);
  }
  applySettings(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  generationMessage = "";

  if (Array.isArray(state.problems)) {
    problems = normalizeProblems(cloneStateValue(state.problems) || [], getSettings());
    render();
  } else {
    problems = [];
    generateProblems();
  }
  return true;
}

window.__calculationProblemBuilderApi = {
  getLibraryState,
  applyLibraryState,
};

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
