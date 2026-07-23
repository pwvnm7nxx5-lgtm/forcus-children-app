(function () {
  const app = window.DECIMAL_WORKSHEET_APP;
  if (!app) throw new Error("DECIMAL_WORKSHEET_APP is required");
  const els = {
    studentName: document.querySelector("#studentName"), worksheetDate: document.querySelector("#worksheetDate"),
    worksheetTitle: document.querySelector("#worksheetTitle"), problemType: document.querySelector("#problemType"),
    layoutMode: document.querySelector("#layoutMode"), problemCount: document.querySelector("#problemCount"),
    problemCountPreset: document.querySelector("#problemCountPreset"), columns: document.querySelector("#columns"),
    showCarryBoxes: document.querySelector("#showCarryBoxes"), showAnswerDecimalPoint: document.querySelector("#showAnswerDecimalPoint"),
    includeAnswers: document.querySelector("#includeAnswers"),
    printBtn: document.querySelector("#printBtn"), regenerateBtn: document.querySelector("#regenerateBtn"),
    copyLinkBtn: document.querySelector("#copyLinkBtn"), pageCount: document.querySelector("#pageCount"),
    pages: document.querySelector("#pages"), pageTemplate: document.querySelector("#pageTemplate"), status: document.querySelector("#status"),
  };
  const types = app.types.map((type) => type.value);
  const verticalTypes = app.verticalTypes || [];
  const storageKey = `${app.id}-state-v1`;
  const digitCount = app.digitCount || 7;
  let problems = [];
  let sheetSets = [];
  let sheetSignature = "";
  let statusTimer;

  document.documentElement.style.setProperty("--digit-count", digitCount);

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }
  function clampChoice(value, choices, fallback) { return choices.includes(String(value)) ? String(value) : fallback; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function choice(values) { return values[randomInt(0, values.length - 1)]; }
  function formatScaled(value, places) { return (value / (10 ** places)).toFixed(places); }
  function getSettings() {
    return {
      name: els.studentName.value, date: els.worksheetDate.value, title: els.worksheetTitle.value || app.title,
      type: clampChoice(els.problemType.value, types, app.defaultType || types[0]),
      layout: clampChoice(els.layoutMode.value, ["horizontal", "vertical"], "horizontal"),
      count: clampNumber(els.problemCount.value, 1, app.countMax || 60, app.defaultCount || 24),
      columns: clampNumber(els.columns.value, 1, 6, app.defaultColumns || 3),
      showCarryBoxes: els.showCarryBoxes.checked,
      showAnswerDecimalPoint: els.showAnswerDecimalPoint?.checked !== false,
    };
  }
  function verticalAllowed(type) { return verticalTypes.includes(type); }
  function updateLayoutAvailability() {
    const allowed = verticalAllowed(els.problemType.value);
    const verticalOption = els.layoutMode.querySelector('option[value="vertical"]');
    verticalOption.disabled = !allowed;
    if (!allowed && els.layoutMode.value === "vertical") els.layoutMode.value = "horizontal";
    els.showCarryBoxes.disabled = els.layoutMode.value !== "vertical";
    if (els.showAnswerDecimalPoint) els.showAnswerDecimalPoint.disabled = els.layoutMode.value !== "vertical";
  }
  function applySettings(settings) {
    if (!settings) return;
    els.studentName.value = settings.name || ""; els.worksheetDate.value = settings.date || "";
    els.worksheetTitle.value = settings.title || app.title;
    els.problemType.value = clampChoice(settings.type, types, app.defaultType || types[0]);
    els.layoutMode.value = clampChoice(settings.layout, ["horizontal", "vertical"], "horizontal");
    els.problemCount.value = String(clampNumber(settings.count, 1, app.countMax || 60, app.defaultCount || 24));
    els.columns.value = String(clampNumber(settings.columns, 1, 6, app.defaultColumns || 3));
    els.showCarryBoxes.checked = settings.showCarryBoxes !== false;
    if (els.showAnswerDecimalPoint) els.showAnswerDecimalPoint.checked = settings.showAnswerDecimalPoint !== false;
    updateLayoutAvailability();
  }
  function setStatus(message) {
    clearTimeout(statusTimer); els.status.textContent = message;
    statusTimer = setTimeout(() => { els.status.textContent = ""; }, 2800);
  }
  function makeProblem(settings) { return app.generate(settings.type, { randomInt, choice, formatScaled }, settings); }
  function problemKey(problem) { return problem.key || `${problem.a}${problem.op}${problem.b}`; }
  function selectProblems(settings, used = new Set()) {
    const selected = []; const local = new Set(); let attempts = 0;
    while (selected.length < settings.count && attempts < settings.count * 160) {
      attempts += 1; const problem = makeProblem(settings); const key = problemKey(problem);
      if (!local.has(key) && !used.has(key)) { selected.push(problem); local.add(key); used.add(key); }
    }
    while (selected.length < settings.count) selected.push(makeProblem(settings));
    return selected;
  }
  function formatDigitData(value, width = digitCount) {
    const [whole, fraction] = String(value).split(".");
    const digits = `${whole}${fraction || ""}`.padStart(width, " ").slice(-width).split("");
    return { digits, decimalAfterIndex: fraction === undefined ? -1 : width - fraction.length - 1 };
  }
  function blankDigitData(decimalPlaces = 0, width = digitCount) {
    return {
      digits: Array(width).fill(" "),
      decimalAfterIndex: decimalPlaces > 0 ? width - decimalPlaces - 1 : -1,
    };
  }
  function formatDivisionDigitData(value, width = digitCount) {
    const [whole, fraction] = String(value).split(".");
    const rawDigits = `${whole}${fraction || ""}`.slice(0, width);
    return {
      digits: rawDigits.padEnd(width, " ").split(""),
      decimalAfterIndex: fraction === undefined ? -1 : Math.min(width - 1, whole.length - 1),
    };
  }
  function blankDivisionDigitData(value, width, showDecimalPoint) {
    const data = formatDivisionDigitData(value, width);
    return {
      digits: Array(width).fill(" "),
      decimalAfterIndex: showDecimalPoint ? data.decimalAfterIndex : -1,
    };
  }
  function getDisplayDigitCount(problems) {
    const lengths = problems.flatMap((problem) => [problem.a, problem.b, problem.answer]
      .map((value) => String(value).replace(/\D/g, "").length));
    return Math.max(app.minDigitCount || 4, ...lengths);
  }
  function getDivisionTrace(problem, width) {
    const dividendDigits = String(problem.a).replace(/\D/g, "");
    const divisor = Number.parseInt(String(problem.b).replace(/\D/g, ""), 10);
    if (!dividendDigits || !Number.isFinite(divisor) || divisor <= 0) return [];

    const startIndex = 0;
    const steps = [];
    let partial = 0;
    let hasStarted = false;

    Array.from(dividendDigits).forEach((digit, index) => {
      partial = partial * 10 + Number.parseInt(digit, 10);
      if (!hasStarted && partial < divisor) return;

      hasStarted = true;
      const product = Math.floor(partial / divisor) * divisor;
      const remainder = partial - product;
      steps.push({ partial, product, remainder, endIndex: startIndex + index });
      partial = remainder;
    });

    const rows = [];
    steps.forEach((step, index) => {
      rows.push({ value: step.product, endIndex: step.endIndex, lineAfter: true });
      const nextStep = steps[index + 1];
      rows.push(nextStep
        ? { value: nextStep.partial, endIndex: nextStep.endIndex, lineAfter: false }
        : { value: step.remainder, endIndex: step.endIndex, lineAfter: false });
    });
    return rows;
  }
  function getDivisionWorkRowCount(problems, width) {
    const counts = problems.filter((problem) => problem.op === "÷")
      .map((problem) => getDivisionTrace(problem, width).length);
    return Math.max(4, ...counts);
  }
  function getDivisionDivisorCellCount(problems) {
    const counts = problems.filter((problem) => problem.op === "÷")
      .map((problem) => String(problem.b).replace(/\D/g, "").length);
    return Math.max(1, ...counts);
  }
  function formatAlignedIntegerData(value, width, endIndex) {
    const digits = Array(width).fill(" ");
    const valueDigits = Array.from(String(value));
    const startIndex = Math.max(0, endIndex - valueDigits.length + 1);
    valueDigits.forEach((digit, index) => {
      const position = startIndex + index;
      if (position >= 0 && position < width) digits[position] = digit;
    });
    return { digits, decimalAfterIndex: -1 };
  }
  function operatorShift(digits) {
    const index = digits.findIndex((digit) => digit !== " ");
    return index > 0 ? Array(index).fill("var(--digit-size)").join(" + ") : "0mm";
  }
  function makeCell(digit, carry, blank, hasDecimalAfter) {
    const cell = document.createElement("span"); cell.className = "digit-cell";
    if (carry) { const helper = document.createElement("span"); helper.className = "helper-box"; cell.append(helper); }
    if (!blank && digit !== " ") { const value = document.createElement("span"); value.className = "digit-value"; value.textContent = digit; cell.append(value); }
    if (hasDecimalAfter) { const decimal = document.createElement("span"); decimal.className = "decimal-mark"; decimal.textContent = "."; cell.append(decimal); }
    return cell;
  }
  function appendDigitCells(row, digitData, carry, blank = false) {
    digitData.digits.forEach((digit, index) => row.append(makeCell(digit, carry, blank, index === digitData.decimalAfterIndex)));
  }
  function appendDivisionEntry(board, {
    row,
    column,
    columnCount,
    digitData,
    blank = false,
    answer = false,
    className = "",
  }) {
    const entry = document.createElement("span");
    entry.className = `division-entry ${className}`.trim();
    entry.style.gridRow = String(row);
    entry.style.gridColumn = `${column} / span ${columnCount}`;
    entry.style.setProperty("--division-entry-columns", String(columnCount));
    if (answer) entry.classList.add("division-answer");
    digitData.digits.forEach((digit, index) => {
      const value = document.createElement("span");
      value.className = "division-entry-value";
      if (!blank && digit !== " ") value.textContent = digit;
      if (index === digitData.decimalAfterIndex) {
        const decimal = document.createElement("span");
        decimal.className = "division-decimal-mark";
        value.append(decimal);
      }
      entry.append(value);
    });
    board.append(entry);
  }
  function appendDivisionLine(board, row, column, columnCount) {
    const line = document.createElement("span");
    line.className = "division-work-line";
    line.style.gridRow = String(row);
    line.style.gridColumn = `${column} / span ${columnCount}`;
    board.append(line);
  }
  function makeRow(digitData, operator, carry, blank = false, operatorAnchorData = digitData) {
    const row = document.createElement("span"); row.className = "digit-row"; row.style.setProperty("--operator-shift", operatorShift(operatorAnchorData.digits));
    const op = document.createElement("span"); op.className = "operator"; op.textContent = operator; row.append(op);
    appendDigitCells(row, digitData, carry, blank); return row;
  }
  function makeDivisionVertical(problem, showAnswer, settings) {
    const formula = document.createElement("span"); formula.className = "vertical-formula division-formula";
    const width = settings.displayDigitCount;
    const trace = getDivisionTrace(problem, width);
    const prefixColumns = settings.divisionDivisorCells + 1;
    const boardColumns = prefixColumns + width;
    const boardRows = settings.divisionWorkRows + 2;
    const board = document.createElement("span");
    board.className = "division-board";
    board.style.setProperty("--division-board-columns", String(boardColumns));
    board.style.setProperty("--division-board-rows", String(boardRows));
    for (let row = 1; row <= boardRows; row += 1) {
      for (let column = 1; column <= boardColumns; column += 1) {
        const cell = document.createElement("span");
        cell.className = "division-board-cell";
        cell.style.gridRow = String(row);
        cell.style.gridColumn = String(column);
        board.append(cell);
      }
    }

    appendDivisionEntry(board, {
      row: 1,
      column: prefixColumns + 1,
      columnCount: width,
      digitData: showAnswer ? formatDivisionDigitData(problem.answer, width) : blankDivisionDigitData(problem.answer, width, settings.showAnswerDecimalPoint),
      blank: !showAnswer,
      answer: showAnswer,
      className: "division-quotient",
    });
    appendDivisionEntry(board, {
      row: 2,
      column: 1,
      columnCount: settings.divisionDivisorCells,
      digitData: formatDivisionDigitData(problem.b, settings.divisionDivisorCells),
      className: "division-divisor",
    });
    const sign = document.createElement("span");
    sign.className = "division-sign";
    sign.textContent = ")";
    sign.style.gridRow = "2";
    sign.style.gridColumn = String(prefixColumns);
    board.append(sign);
    appendDivisionEntry(board, {
      row: 2,
      column: prefixColumns + 1,
      columnCount: width,
      digitData: formatDivisionDigitData(problem.a, width),
      className: "division-dividend",
    });
    const bracket = document.createElement("span");
    bracket.className = "division-bracket";
    bracket.style.gridRow = "2";
    bracket.style.gridColumn = `${prefixColumns + 1} / span ${width}`;
    board.append(bracket);

    for (let index = 0; index < settings.divisionWorkRows; index += 1) {
      const traceRow = showAnswer ? trace[index] : null;
      const row = index + 3;
      appendDivisionEntry(board, {
        row,
        column: prefixColumns + 1,
        columnCount: width,
        digitData: traceRow ? formatAlignedIntegerData(traceRow.value, width, traceRow.endIndex) : blankDigitData(0, width),
        blank: !traceRow,
        answer: Boolean(traceRow),
        className: "division-work-row",
      });
      if ((traceRow?.lineAfter ?? index % 2 === 0) && index + 1 < settings.divisionWorkRows) appendDivisionLine(board, row, prefixColumns + 1, width);
    }
    formula.append(board);
    return formula;
  }
  function makeVertical(problem, showAnswer, settings) {
    if (problem.op === "÷") return makeDivisionVertical(problem, showAnswer, settings);
    const formula = document.createElement("span"); formula.className = "vertical-formula";
    const firstRow = formatDigitData(problem.a, settings.displayDigitCount);
    const secondRow = formatDigitData(problem.b, settings.displayDigitCount);
    formula.append(makeRow(firstRow, "", settings.showCarryBoxes));
    formula.append(makeRow(secondRow, problem.op, settings.showCarryBoxes, false, problem.op === "×" ? firstRow : secondRow));
    const line = document.createElement("span"); line.className = "vertical-line"; formula.append(line);
    const blankAnswerPlaces = settings.showAnswerDecimalPoint ? problem.answerPlaces : 0;
    formula.append(showAnswer ? makeRow(formatDigitData(problem.answer, settings.displayDigitCount), "", settings.showCarryBoxes) : makeRow(blankDigitData(blankAnswerPlaces, settings.displayDigitCount), "", settings.showCarryBoxes, true));
    return formula;
  }
  function makeHorizontal(problem, showAnswer) {
    const formula = document.createElement("span"); formula.className = "horizontal-formula";
    formula.append(document.createTextNode(`${problem.a} ${problem.op} ${problem.b} =`));
    const answer = document.createElement("span"); answer.className = showAnswer ? "horizontal-answer-value answer-value" : "horizontal-answer-space";
    answer.textContent = showAnswer ? problem.answer : "□"; formula.append(answer); return formula;
  }
  function applyDensity(list, settings, problemsForPage) {
    const rows = Math.ceil(settings.count / settings.columns); let rowGap = 5; let min = settings.layout === "vertical" ? 38 : 22; let font = 20;
    if (rows > 12) { rowGap = 2; min = settings.layout === "vertical" ? 27 : 14; font = 15; }
    else if (rows > 8) { rowGap = 3; min = settings.layout === "vertical" ? 32 : 18; font = 17; }
    const hasLongDivision = settings.layout === "vertical" && problemsForPage.some((problem) => problem.op === "÷");
    if (hasLongDivision && rows > 5) { rowGap = 1.5; min = 33; font = 16; list.style.setProperty("--vertical-digit-size", "4.8mm"); }
    else if (hasLongDivision && rows > 4) { rowGap = 2; min = 36; font = 17; list.style.setProperty("--vertical-digit-size", "5.6mm"); }
    else if (hasLongDivision) list.style.setProperty("--vertical-digit-size", "6.5mm");
    list.style.setProperty("--row-gap", `${rowGap}mm`); list.style.setProperty("--problem-min", `${min}mm`); list.style.setProperty("--problem-font", `${font}px`);
  }
  function renderPage(kind, showAnswer, set) {
    const displayDigitCount = getDisplayDigitCount(set);
    const divisionDivisorCells = getDivisionDivisorCellCount(set);
    const settings = { ...getSettings(), displayDigitCount, divisionWorkRows: getDivisionWorkRowCount(set, displayDigitCount), divisionDivisorCells };
    const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
    page.style.setProperty("--digit-count", String(settings.displayDigitCount));
    page.style.setProperty("--division-divisor-cells", String(settings.divisionDivisorCells));
    page.classList.toggle("answer-page", showAnswer); page.classList.toggle("vertical-layout", settings.layout === "vertical");
    page.querySelector("[data-name]").textContent = settings.name; page.querySelector("[data-date]").textContent = settings.date; page.querySelector("[data-title]").textContent = settings.title;
    const label = page.querySelector("[data-kind]"); label.textContent = kind; label.classList.toggle("answer", showAnswer);
    const list = page.querySelector("[data-problems]"); list.style.setProperty("--cols", settings.columns); applyDensity(list, settings, set);
    set.forEach((problem) => { const item = document.createElement("li"); item.className = "problem"; const card = document.createElement("span"); card.className = "problem-card"; card.append(settings.layout === "vertical" ? makeVertical(problem, showAnswer, settings) : makeHorizontal(problem, showAnswer)); item.append(card); list.append(item); });
    return page;
  }
  function signature(settings) { return JSON.stringify({ type: settings.type, layout: settings.layout, count: settings.count, columns: settings.columns }); }
  function ensureSets(count) {
    const settings = getSettings(); const current = signature(settings);
    if (current !== sheetSignature) { sheetSets = []; sheetSignature = current; }
    if (!sheetSets.length) sheetSets.push(problems.slice());
    const used = new Set(sheetSets.flat().map(problemKey)); while (sheetSets.length < count) sheetSets.push(selectProblems(settings, used)); sheetSets = sheetSets.slice(0, count);
  }
  function renderSheets(count = 1, includeAnswers = true) {
    ensureSets(count); const pages = [];
    sheetSets.forEach((set, index) => pages.push(renderPage(count > 1 ? `もんだい ${index + 1}` : "もんだい", false, set)));
    if (includeAnswers) sheetSets.forEach((set, index) => pages.push(renderPage(count > 1 ? `こたえ ${index + 1}` : "こたえ", true, set)));
    els.pages.replaceChildren(...pages); els.pageCount.textContent = `${pages.length}枚`; window.__printAdjustmentsRefresh?.();
  }
  function state() { return { settings: getSettings(), problems }; }
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(state())); } catch {} }
  function render() {
    updateLayoutAvailability(); const settings = getSettings();
    if (problems.length !== settings.count) problems = selectProblems(settings);
    sheetSets = [problems.slice()]; sheetSignature = signature(settings); renderSheets(1, els.includeAnswers.checked); save();
  }
  function generate() { updateLayoutAvailability(); problems = selectProblems(getSettings()); sheetSets = []; sheetSignature = ""; render(); setStatus("もんだいを作り直しました。"); }
  function encode(value) { const bytes = new TextEncoder().encode(JSON.stringify(value)); let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function decode(value) { try { const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="); return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))); } catch { return null; } }
  function load() {
    const hash = location.hash.replace(/^#data=/, ""); const shared = hash ? decode(hash) : null;
    try { const saved = shared || JSON.parse(localStorage.getItem(storageKey) || "null"); if (saved?.settings) applySettings(saved.settings); if (Array.isArray(saved?.problems)) problems = saved.problems; } catch {}
  }
  async function copyUrl() { const url = `${location.origin}${location.pathname}#data=${encode(state())}`; try { await navigator.clipboard.writeText(url); setStatus("共有URLをコピーしました。"); } catch { location.hash = url.split("#")[1]; } }
  function bind() {
    [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
    els.problemType.addEventListener("change", generate); els.layoutMode.addEventListener("change", generate);
    els.problemCount.addEventListener("input", () => { if (els.problemCount.value !== "") generate(); });
    els.problemCountPreset.addEventListener("change", () => { if (els.problemCountPreset.value) { els.problemCount.value = els.problemCountPreset.value; els.problemCountPreset.value = ""; generate(); } });
    els.columns.addEventListener("input", () => { if (els.columns.value !== "") render(); }); els.showCarryBoxes.addEventListener("change", render);
    els.showAnswerDecimalPoint?.addEventListener("change", render); els.includeAnswers.addEventListener("change", render);
    els.printBtn.addEventListener("click", () => { render(); window.print(); }); els.regenerateBtn.addEventListener("click", generate); els.copyLinkBtn.addEventListener("click", copyUrl);
  }
  load(); bind(); window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => { renderSheets(sheetCount, includeAnswers); return true; };
  if (!problems.length) generate(); else render();
})();
