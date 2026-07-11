(function () {
  const app = window.WORKSHEET_APP;
  if (!app) throw new Error("WORKSHEET_APP is required");

  const els = {
    studentName: document.querySelector("#studentName"),
    worksheetDate: document.querySelector("#worksheetDate"),
    worksheetTitle: document.querySelector("#worksheetTitle"),
    problemType: document.querySelector("#problemType"),
    problemCount: document.querySelector("#problemCount"),
    problemCountPreset: document.querySelector("#problemCountPreset"),
    columns: document.querySelector("#columns"),
    includeAnswers: document.querySelector("#includeAnswers"),
    printBtn: document.querySelector("#printBtn"),
    regenerateBtn: document.querySelector("#regenerateBtn"),
    copyLinkBtn: document.querySelector("#copyLinkBtn"),
    pageCount: document.querySelector("#pageCount"),
    pages: document.querySelector("#pages"),
    pageTemplate: document.querySelector("#pageTemplate"),
    status: document.querySelector("#status"),
  };

  const problemTypes = app.types.map((item) => item.value);
  const defaultType = app.defaultType || problemTypes[0];
  const countMin = 1;
  const countMax = app.countMax || 60;
  const columnsMin = 1;
  const columnsMax = 6;
  const defaultCount = app.defaultCount || 24;
  const defaultColumns = app.defaultColumns || 3;
  const storageKey = `${app.id}-state-v${app.stateVersion || 1}`;
  let statusTimer;
  let problems = [];
  let sheetProblemSets = [];
  let sheetSetSignature = "";

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function clampChoice(value, choices, fallback) {
    return choices.includes(String(value)) ? String(value) : fallback;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function choice(values) {
    return values[randomInt(0, values.length - 1)];
  }

  function shuffle(values) {
    const copy = values.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function getSettings() {
    return {
      name: els.studentName.value,
      date: els.worksheetDate.value,
      title: els.worksheetTitle.value || app.title,
      type: clampChoice(els.problemType.value, problemTypes, defaultType),
      count: clampNumber(els.problemCount.value, countMin, countMax, defaultCount),
      columns: clampNumber(els.columns.value, columnsMin, columnsMax, defaultColumns),
    };
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== "object") return;
    els.studentName.value = settings.name || "";
    els.worksheetDate.value = settings.date || "";
    els.worksheetTitle.value = settings.title || app.title;
    els.problemType.value = clampChoice(settings.type, problemTypes, defaultType);
    els.problemCount.value = String(clampNumber(settings.count, countMin, countMax, defaultCount));
    els.problemCountPreset.value = "";
    els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, defaultColumns));
  }

  function setStatus(message) {
    window.clearTimeout(statusTimer);
    els.status.textContent = message;
    statusTimer = window.setTimeout(() => {
      els.status.textContent = "";
    }, 2800);
  }

  function problemKey(problem) {
    return problem.key || `${problem.prompt || problem.template}|${problem.answerTemplate || ""}|${(problem.answers || []).join("|")}`;
  }

  function makeProblem(type) {
    return app.generate(type, { randomInt, choice, shuffle });
  }

  function selectProblems(settings, usedKeys = new Set()) {
    const selected = [];
    const localKeys = new Set();
    let attempts = 0;
    while (selected.length < settings.count && attempts < settings.count * 160) {
      attempts += 1;
      const problem = makeProblem(settings.type);
      const key = problemKey(problem);
      if (!localKeys.has(key) && !usedKeys.has(key)) {
        selected.push(problem);
        localKeys.add(key);
        usedKeys.add(key);
      }
    }
    while (selected.length < settings.count) {
      selected.push(makeProblem(settings.type));
    }
    return selected;
  }

  function sheetSignature(settings) {
    return JSON.stringify({ type: settings.type, count: settings.count, columns: settings.columns });
  }

  function appendTemplate(container, template, answers, showAnswer) {
    const matcher = /\{(\d+)\}/g;
    let cursor = 0;
    let match;
    while ((match = matcher.exec(template))) {
      if (match.index > cursor) container.append(document.createTextNode(template.slice(cursor, match.index)));
      const answerIndex = Number.parseInt(match[1], 10);
      const slot = document.createElement("span");
      slot.className = showAnswer ? "answer-value" : "answer-space";
      slot.textContent = showAnswer ? (answers[answerIndex] ?? "") : "□";
      container.append(slot);
      cursor = match.index + match[0].length;
    }
    if (cursor < template.length) container.append(document.createTextNode(template.slice(cursor)));
  }

  function renderTemplate(problem, showAnswer) {
    const formula = document.createElement("span");
    formula.className = "practice-formula";
    const answers = (problem.answers || []).map(String);
    if (problem.prompt && problem.answerTemplate) {
      formula.classList.add("has-stacked-answer");
      const prompt = document.createElement("span");
      prompt.className = "problem-prompt";
      prompt.textContent = problem.prompt;
      const answerRow = document.createElement("span");
      answerRow.className = "problem-answer-row";
      appendTemplate(answerRow, String(problem.answerTemplate), answers, showAnswer);
      formula.append(prompt, answerRow);
    } else {
      appendTemplate(formula, String(problem.template || ""), answers, showAnswer);
    }
    if (problem.note) {
      const note = document.createElement("span");
      note.className = "problem-note";
      note.textContent = problem.note;
      formula.append(note);
    }
    return formula;
  }

  function applyDensity(list, settings) {
    const rows = Math.ceil(settings.count / settings.columns);
    let rowGap = 5;
    let problemMin = 24;
    let fontSize = 20;
    if (rows > 14) {
      rowGap = 2;
      problemMin = 14;
      fontSize = 15;
    } else if (rows > 10) {
      rowGap = 3;
      problemMin = 18;
      fontSize = 17;
    } else if (rows > 7) {
      rowGap = 4;
      problemMin = 21;
      fontSize = 18;
    }
    list.style.setProperty("--row-gap", `${rowGap}mm`);
    list.style.setProperty("--problem-min", `${problemMin}mm`);
    list.style.setProperty("--problem-font", `${fontSize}px`);
  }

  function renderPage(kind, showAnswer, pageProblems) {
    const settings = getSettings();
    const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
    page.classList.toggle("answer-page", showAnswer);
    page.querySelector("[data-name]").textContent = settings.name;
    page.querySelector("[data-date]").textContent = settings.date;
    page.querySelector("[data-title]").textContent = settings.title;
    const kindLabel = page.querySelector("[data-kind]");
    kindLabel.textContent = kind;
    kindLabel.classList.toggle("answer", showAnswer);
    const list = page.querySelector("[data-problems]");
    list.style.setProperty("--cols", settings.columns);
    applyDensity(list, settings);
    pageProblems.forEach((problem) => {
      const item = document.createElement("li");
      item.className = "problem";
      const card = document.createElement("span");
      card.className = "problem-card practice-card";
      card.append(renderTemplate(problem, showAnswer));
      item.append(card);
      list.append(item);
    });
    return page;
  }

  function ensureSheetSets(sheetCount) {
    const settings = getSettings();
    const signature = sheetSignature(settings);
    if (signature !== sheetSetSignature) {
      sheetProblemSets = [];
      sheetSetSignature = signature;
    }
    if (!sheetProblemSets.length) sheetProblemSets.push(problems.slice(0, settings.count));
    const usedKeys = new Set(sheetProblemSets.flat().map(problemKey));
    while (sheetProblemSets.length < sheetCount) {
      sheetProblemSets.push(selectProblems(settings, usedKeys));
    }
    sheetProblemSets = sheetProblemSets.slice(0, sheetCount);
  }

  function renderSheetPages(sheetCount = 1, includeAnswers = true) {
    ensureSheetSets(sheetCount);
    const pages = [];
    sheetProblemSets.forEach((set, index) => {
      pages.push(renderPage(sheetCount > 1 ? `もんだい ${index + 1}` : "もんだい", false, set));
    });
    if (includeAnswers) {
      sheetProblemSets.forEach((set, index) => {
        pages.push(renderPage(sheetCount > 1 ? `こたえ ${index + 1}` : "こたえ", true, set));
      });
    }
    els.pages.replaceChildren(...pages);
    els.pageCount.textContent = `${pages.length}枚`;
    window.__printAdjustmentsRefresh?.();
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ settings: getSettings(), problems }));
    } catch {}
  }

  function render() {
    const settings = getSettings();
    els.problemCount.value = String(settings.count);
    els.columns.value = String(settings.columns);
    if (problems.length !== settings.count) problems = selectProblems(settings);
    sheetProblemSets = [problems.slice()];
    sheetSetSignature = sheetSignature(settings);
    renderSheetPages(1, els.includeAnswers.checked);
    saveState();
  }

  function generateProblems() {
    const settings = getSettings();
    problems = selectProblems(settings);
    sheetProblemSets = [];
    sheetSetSignature = "";
    render();
    setStatus("もんだいを作り直しました。");
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
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function loadInitialState() {
    const hash = location.hash.replace(/^#data=/, "");
    const shared = hash ? decodeState(hash) : null;
    if (shared?.settings) {
      applySettings(shared.settings);
      if (Array.isArray(shared.problems)) problems = shared.problems;
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.settings) applySettings(saved.settings);
      if (Array.isArray(saved?.problems)) problems = saved.problems;
    } catch {}
  }

  async function copyShareUrl() {
    const encoded = encodeState({ settings: getSettings(), problems });
    const url = `${location.origin}${location.pathname}#data=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("共有URLをコピーしました。");
    } catch {
      location.hash = `data=${encoded}`;
      setStatus("URL欄に共有データを入れました。");
    }
  }

  function bindEvents() {
    [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
    els.problemType.addEventListener("change", generateProblems);
    els.problemCount.addEventListener("input", () => {
      if (els.problemCount.value !== "") generateProblems();
    });
    els.problemCountPreset.addEventListener("change", () => {
      if (!els.problemCountPreset.value) return;
      els.problemCount.value = els.problemCountPreset.value;
      els.problemCountPreset.value = "";
      generateProblems();
    });
    els.columns.addEventListener("input", () => {
      if (els.columns.value !== "") render();
    });
    els.includeAnswers.addEventListener("change", render);
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
  if (!problems.length) generateProblems(); else render();
})();
