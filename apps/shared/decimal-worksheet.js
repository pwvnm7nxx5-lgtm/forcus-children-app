(function () {
  const app = window.DECIMAL_WORKSHEET_APP;
  if (!app) throw new Error("DECIMAL_WORKSHEET_APP is required");
  const els = {
    studentName: document.querySelector("#studentName"), worksheetDate: document.querySelector("#worksheetDate"),
    worksheetTitle: document.querySelector("#worksheetTitle"), problemType: document.querySelector("#problemType"),
    layoutMode: document.querySelector("#layoutMode"), problemCount: document.querySelector("#problemCount"),
    problemCountPreset: document.querySelector("#problemCountPreset"), columns: document.querySelector("#columns"),
    showCarryBoxes: document.querySelector("#showCarryBoxes"), includeAnswers: document.querySelector("#includeAnswers"),
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
    };
  }
  function verticalAllowed(type) { return verticalTypes.includes(type); }
  function updateLayoutAvailability() {
    const allowed = verticalAllowed(els.problemType.value);
    const verticalOption = els.layoutMode.querySelector('option[value="vertical"]');
    verticalOption.disabled = !allowed;
    if (!allowed && els.layoutMode.value === "vertical") els.layoutMode.value = "horizontal";
    els.showCarryBoxes.disabled = els.layoutMode.value !== "vertical";
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
  function formatDigitData(value) {
    const [whole, fraction] = String(value).split(".");
    const rawDigits = `${whole}${fraction || ""}`;
    return {
      digits: rawDigits.padStart(digitCount, " ").slice(-digitCount).split(""),
      decimalIndex: fraction === undefined ? -1 : digitCount - fraction.length - 1,
    };
  }
  function blankDigitData(decimalPlaces = 0) {
    return {
      digits: Array(digitCount).fill(" "),
      decimalIndex: decimalPlaces > 0 ? digitCount - decimalPlaces - 1 : -1,
    };
  }
  function operatorShift(digits) {
    const index = digits.findIndex((digit) => digit !== " ");
    return index > 0 ? Array(index).fill("var(--digit-size)").join(" + ") : "0mm";
  }
  function makeCell(digit, carry, blank, hasDecimalAfter) {
    const cell = document.createElement("span"); cell.className = "digit-cell";
    cell.classList.toggle("has-decimal-after", hasDecimalAfter);
    if (carry) { const helper = document.createElement("span"); helper.className = "helper-box"; cell.append(helper); }
    if (!blank && digit !== " ") { const value = document.createElement("span"); value.className = "digit-value"; value.textContent = digit; cell.append(value); }
    return cell;
  }
  function makeRow(digitData, operator, carry, blank = false, operatorAnchorData = digitData) {
    const row = document.createElement("span"); row.className = "digit-row"; row.style.setProperty("--operator-shift", operatorShift(operatorAnchorData.digits));
    const op = document.createElement("span"); op.className = "operator"; op.textContent = operator; row.append(op);
    digitData.digits.forEach((digit, index) => row.append(makeCell(digit, carry, blank, index === digitData.decimalIndex))); return row;
  }
  function makeVertical(problem, showAnswer, settings) {
    const formula = document.createElement("span"); formula.className = "vertical-formula";
    const firstRow = formatDigitData(problem.a);
    const secondRow = formatDigitData(problem.b);
    formula.append(makeRow(firstRow, "", settings.showCarryBoxes));
    formula.append(makeRow(secondRow, problem.op, settings.showCarryBoxes, false, problem.op === "×" ? firstRow : secondRow));
    const line = document.createElement("span"); line.className = "vertical-line"; formula.append(line);
    formula.append(showAnswer ? makeRow(formatDigitData(problem.answer), "", settings.showCarryBoxes) : makeRow(blankDigitData(problem.answerPlaces), "", settings.showCarryBoxes, true));
    return formula;
  }
  function makeHorizontal(problem, showAnswer) {
    const formula = document.createElement("span"); formula.className = "horizontal-formula";
    formula.append(document.createTextNode(`${problem.a} ${problem.op} ${problem.b} =`));
    const answer = document.createElement("span"); answer.className = showAnswer ? "horizontal-answer-value answer-value" : "horizontal-answer-space";
    answer.textContent = showAnswer ? problem.answer : "□"; formula.append(answer); return formula;
  }
  function applyDensity(list, settings) {
    const rows = Math.ceil(settings.count / settings.columns); let rowGap = 5; let min = settings.layout === "vertical" ? 38 : 22; let font = 20;
    if (rows > 12) { rowGap = 2; min = settings.layout === "vertical" ? 27 : 14; font = 15; }
    else if (rows > 8) { rowGap = 3; min = settings.layout === "vertical" ? 32 : 18; font = 17; }
    list.style.setProperty("--row-gap", `${rowGap}mm`); list.style.setProperty("--problem-min", `${min}mm`); list.style.setProperty("--problem-font", `${font}px`);
  }
  function renderPage(kind, showAnswer, set) {
    const settings = getSettings(); const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
    page.classList.toggle("answer-page", showAnswer); page.classList.toggle("vertical-layout", settings.layout === "vertical");
    page.querySelector("[data-name]").textContent = settings.name; page.querySelector("[data-date]").textContent = settings.date; page.querySelector("[data-title]").textContent = settings.title;
    const label = page.querySelector("[data-kind]"); label.textContent = kind; label.classList.toggle("answer", showAnswer);
    const list = page.querySelector("[data-problems]"); list.style.setProperty("--cols", settings.columns); applyDensity(list, settings);
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
    els.columns.addEventListener("input", () => { if (els.columns.value !== "") render(); }); els.showCarryBoxes.addEventListener("change", render); els.includeAnswers.addEventListener("change", render);
    els.printBtn.addEventListener("click", () => { render(); window.print(); }); els.regenerateBtn.addEventListener("click", generate); els.copyLinkBtn.addEventListener("click", copyUrl);
  }
  load(); bind(); window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => { renderSheets(sheetCount, includeAnswers); return true; };
  if (!problems.length) generate(); else render();
})();
