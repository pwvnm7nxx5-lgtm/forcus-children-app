const APP = {
  id: "clock-print-grade1",
  title: "1年生 とけいプリント",
  accent: "#2563eb",
  stateVersion: 4,
  defaultCount: 6,
  defaultCols: 2,
};

document.documentElement.style.setProperty("--accent", APP.accent);

const els = {
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  worksheetTitle: document.querySelector("#worksheetTitle"),
  problemType: document.querySelector("#problemType"),
  range: document.querySelector("#range"),
  minuteLabelMode: document.querySelector("#minuteLabelMode"),
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
const problemCountMax = 24;
const columnsMin = 1;
const columnsMax = 6;
let statusTimer;
let problems = [];
let sheetProblemSets = [];
let sheetSetSignature = "";
let selectionRepeatNotice = false;
let logicalSheetCount = 1;
let logicalIncludeAnswers = true;
let paginationState = {
  dirty: true,
  physical: false,
  signature: "",
  physicalPageCount: 0,
  sheetCount: 1,
  includeAnswers: true,
};

function clampChoice(value, allowed, fallback) {
  return allowed.includes(String(value)) ? String(value) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[rand(0, items.length - 1)];
}

function getProblemCount() {
  return clampNumber(els.problemCount.value, problemCountMin, problemCountMax, APP.defaultCount);
}

function getColumns() {
  return clampNumber(els.columns.value, columnsMin, columnsMax, APP.defaultCols);
}

function getSettings() {
  return {
    name: els.studentName.value,
    date: els.worksheetDate.value,
    title: els.worksheetTitle.value || APP.title,
    type: clampChoice(els.problemType.value, ["read", "draw", "mix"], "read"),
    range: clampChoice(els.range.value, ["hour", "half"], "hour"),
    minuteLabelMode: clampChoice(els.minuteLabelMode.value, ["none", "five", "ten", "thirty"], "none"),
    count: getProblemCount(),
    columns: getColumns(),
  };
}

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  els.studentName.value = settings.name || "";
  els.worksheetDate.value = settings.date || "";
  els.worksheetTitle.value = settings.title || APP.title;
  els.problemType.value = clampChoice(settings.type, ["read", "draw", "mix"], "read");
  els.range.value = clampChoice(settings.range, ["hour", "half"], "hour");
  els.minuteLabelMode.value = clampChoice(
    settings.minuteLabelMode ?? (settings.minuteLabels === true ? "thirty" : "none"),
    ["none", "five", "ten", "thirty"],
    "none"
  );
  els.problemCount.value = String(clampNumber(settings.count, problemCountMin, problemCountMax, APP.defaultCount));
  els.problemCountPreset.value = "";
  els.columns.value = String(clampNumber(settings.columns, columnsMin, columnsMax, APP.defaultCols));
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function timeText(hour, minute) {
  return minute === 30 ? `${hour}じはん` : `${hour}じ`;
}

function makeProblemKey({ type, hour, minute }) {
  return `clock-v1:${type}:${hour}:${minute}`;
}

function getAllowedProblemTypes(settings) {
  return settings.type === "mix" ? ["read", "draw"] : [settings.type];
}

function getAllowedMinutes(settings) {
  return settings.range === "half" ? [0, 30] : [0];
}

function minuteLabelEntries(mode) {
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

function minuteLabelMarks(mode) {
  return minuteLabelEntries(mode).map(({ minute: labelMinute, label }) => {
    const angle = (labelMinute * 6 - 90) * Math.PI / 180;
    const x = 64 + Math.cos(angle) * 70;
    const y = 67 + Math.sin(angle) * 70;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="8" font-weight="700" text-anchor="middle" fill="#1d4ed8" stroke="#fff" stroke-width="3" paint-order="stroke">${label}</text>`;
  }).join("");
}

function clockSvg(hour, minute, handMode = "both", minuteLabelMode = "none") {
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
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    return `<text x="${(64 + Math.cos(angle) * 42).toFixed(1)}" y="${(68 + Math.sin(angle) * 42).toFixed(1)}" font-size="11" text-anchor="middle">${n}</text>`;
  }).join("");
  const minuteAngle = (minute * 6 - 90) * Math.PI / 180;
  const hourAngle = (((hour % 12) + minute / 60) * 30 - 90) * Math.PI / 180;
  const mode = handMode === true ? "both" : handMode === false ? "none" : handMode;
  const hands = [];
  if (mode === "both" || mode === "hour") {
    hands.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(hourAngle) * 28).toFixed(1)}" y2="${(64 + Math.sin(hourAngle) * 28).toFixed(1)}" stroke="#111827" stroke-width="5" stroke-linecap="round"/>`);
  }
  if (mode === "both" || mode === "minute") {
    hands.push(`<line x1="64" y1="64" x2="${(64 + Math.cos(minuteAngle) * 43).toFixed(1)}" y2="${(64 + Math.sin(minuteAngle) * 43).toFixed(1)}" stroke="#111827" stroke-width="3" stroke-linecap="round"/>`);
  }
  hands.push(`<circle cx="64" cy="64" r="3" fill="#111827"/>`);
  return `<svg class="clock" viewBox="-14 -14 156 156" width="132" height="132" role="img" aria-label="時計"><circle cx="64" cy="64" r="59" fill="#fff" stroke="#344054" stroke-width="3"/>${marks}${nums}${minuteLabelMarks(minuteLabelMode)}${hands.join("")}</svg>`;
}

function makeProblem(settings, identity = null) {
  const hour = identity?.hour ?? rand(1, 12);
  const minute = identity?.minute ?? (settings.range === "half" ? pick([0, 30]) : 0);
  const type = identity?.type ?? (settings.type === "mix" ? pick(["read", "draw"]) : settings.type);
  const minuteLabelMode = settings.minuteLabelMode;
  if (type === "draw") {
    return {
      key: makeProblemKey({ type, hour, minute }),
      type,
      hour,
      minute,
      minuteLabelMode,
      prompt: `${timeText(hour, minute)} の ながいはりをかきましょう。`,
      answer: timeText(hour, minute),
      visual: clockSvg(hour, minute, "hour", minuteLabelMode),
      answerVisual: clockSvg(hour, minute, "both", minuteLabelMode),
    };
  }
  return {
    key: makeProblemKey({ type, hour, minute }),
    type,
    hour,
    minute,
    minuteLabelMode,
    prompt: "なんじですか。",
    answer: timeText(hour, minute),
    visual: clockSvg(hour, minute, "both", minuteLabelMode),
  };
}

function buildFiniteCandidatePool(settings) {
  const pool = [];
  getAllowedMinutes(settings).forEach((minute) => {
    for (let hour = 1; hour <= 12; hour += 1) {
      getAllowedProblemTypes(settings).forEach((type) => {
        pool.push(makeProblem(settings, { type, hour, minute }));
      });
    }
  });
  return pool;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = rand(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function parseProblemTime(answer) {
  const match = /^(1[0-2]|[1-9])じ(はん)?$/u.exec(String(answer || ""));
  if (!match) return null;
  return { hour: Number(match[1]), minute: match[2] ? 30 : 0 };
}

function getProblemIdentity(problem) {
  if (!problem || typeof problem !== "object") return null;

  const keyMatch = /^clock-v1:(read|draw):(1[0-2]|[1-9]):(0|30)$/u.exec(String(problem.key || ""));
  const answerTime = parseProblemTime(problem.answer);
  const hour = Number.isInteger(Number(problem.hour)) ? Number(problem.hour) : keyMatch ? Number(keyMatch[2]) : answerTime?.hour;
  const minute = Number.isInteger(Number(problem.minute)) ? Number(problem.minute) : keyMatch ? Number(keyMatch[3]) : answerTime?.minute;
  const type = ["read", "draw"].includes(problem.type)
    ? problem.type
    : keyMatch?.[1] || (/ながいはり/u.test(String(problem.prompt || "")) ? "draw" : "read");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || !["read", "draw"].includes(type)) return null;
  if (hour < 1 || hour > 12 || ![0, 30].includes(minute)) return null;
  if (problem.answer !== undefined && String(problem.answer) !== timeText(hour, minute)) return null;
  return { type, hour, minute };
}

function isAllowedProblemIdentity(settings, identity) {
  return getAllowedProblemTypes(settings).includes(identity.type)
    && getAllowedMinutes(settings).includes(identity.minute);
}

function normalizeProblem(problem, settings) {
  const identity = getProblemIdentity(problem);
  return identity && isAllowedProblemIdentity(settings, identity)
    ? makeProblem(settings, identity)
    : null;
}

function problemKey(problem) {
  const identity = getProblemIdentity(problem);
  return identity ? makeProblemKey(identity) : JSON.stringify(problem);
}

function sheetSignature(settings) {
  return JSON.stringify({
    type: settings.type,
    range: settings.range,
    minuteLabelMode: settings.minuteLabelMode,
    count: settings.count,
  });
}

function markPaginationDirty() {
  paginationState.dirty = true;
  paginationState.physical = false;
  paginationState.physicalPageCount = 0;
}

function getPageConfig() {
  const shared = typeof window.__printAdjustmentsGetSettings === "function"
    ? window.__printAdjustmentsGetSettings()
    : null;
  return {
    sheetCount: clampNumber(shared?.sheetCount ?? logicalSheetCount, 1, 30, logicalSheetCount),
    includeAnswers: shared?.includeAnswers ?? logicalIncludeAnswers,
  };
}

function selectProblemSet(settings, usedKeys = new Set()) {
  const pool = buildFiniteCandidatePool(settings);
  const selected = [];
  if (!pool.length) return selected;

  const poolKeys = new Set(pool.map(problemKey));
  [...usedKeys].forEach((key) => {
    if (!poolKeys.has(key)) usedKeys.delete(key);
  });

  let cycle = shuffle(pool);
  const selectedKeys = new Set();
  while (selected.length < settings.count) {
    let candidate = cycle.find((problem) => {
      const key = problemKey(problem);
      return !usedKeys.has(key) && !selectedKeys.has(key);
    });

    if (!candidate) {
      candidate = cycle.find((problem) => !usedKeys.has(problemKey(problem)));
    }

    if (!candidate) {
      usedKeys.clear();
      selectionRepeatNotice = true;
      cycle = shuffle(pool);
      candidate = cycle.find((problem) => !selectedKeys.has(problemKey(problem))) || cycle[0];
    }

    if (!candidate) break;
    const key = problemKey(candidate);
    selected.push(candidate);
    usedKeys.add(key);
    selectedKeys.add(key);
  }
  return selected;
}

function reconcileProblems(settings, sourceProblems) {
  const restored = [];
  (Array.isArray(sourceProblems) ? sourceProblems : []).forEach((problem) => {
    if (restored.length >= settings.count) return;
    const normalized = normalizeProblem(problem, settings);
    if (normalized) restored.push(normalized);
  });

  if (restored.length < settings.count) {
    const usedKeys = new Set(restored.map(problemKey));
    restored.push(...selectProblemSet(settings, usedKeys).slice(0, settings.count - restored.length));
  }
  return restored.slice(0, settings.count);
}

function beginSelectionBatch() {
  selectionRepeatNotice = false;
}

function showSelectionStatus(fallback = "") {
  if (selectionRepeatNotice) {
    setStatus("候補を使い切ったため、同じ時刻が再登場します。");
  } else if (fallback) {
    setStatus(fallback);
  }
  selectionRepeatNotice = false;
}

function generateProblems(options = {}) {
  if (options.normalizeCount !== false) els.problemCount.value = String(getProblemCount());
  const settings = getSettings();
  beginSelectionBatch();
  problems = selectProblemSet(settings);
  sheetProblemSets = [];
  sheetSetSignature = "";
  render();
  showSelectionStatus("もんだいをつくりなおしました。");
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

function applyPageHint(page, hintText) {
  if (!hintText) return;
  const hint = document.createElement("div");
  hint.className = "page-hint";
  hint.textContent = hintText;
  page.querySelector(".sheet-header").after(hint);
}

function renderPage(kind, showAnswer, pageProblems = problems, options = {}) {
  const settings = getSettings();
  const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
  page.classList.toggle("answer-page", showAnswer);
  page.dataset.logicalSheetIndex = String(options.sheetIndex ?? 0);
  page.dataset.logicalKind = showAnswer ? "answer" : "problem";
  page.dataset.pageChunkIndex = String(options.chunkIndex ?? 0);
  page.dataset.pageChunkCount = String(options.chunkCount ?? 1);
  page.dataset.pagePair = options.pagePair || "";
  if (options.overflow) page.classList.add("pagination-overflow");
  page.querySelector("[data-name]").textContent = settings.name;
  page.querySelector("[data-date]").textContent = settings.date;
  page.querySelector("[data-title]").textContent = settings.title;
  const kindLabel = page.querySelector("[data-kind]");
  kindLabel.textContent = kind;
  if (showAnswer) kindLabel.classList.add("answer");
  applyPageHint(page, options.hintText);
  const list = page.querySelector("[data-problems]");
  const layoutCount = pageProblems.length;
  list.style.setProperty("--cols", settings.columns);
  list.style.setProperty("--row-gap", layoutCount <= 6 ? "10mm" : layoutCount > 12 ? "4mm" : "7mm");
  list.style.setProperty("--problem-min", layoutCount <= 6 ? "57mm" : layoutCount > 12 ? "30mm" : "39mm");
  list.style.setProperty("--visual-min", layoutCount <= 6 ? "38mm" : "24mm");
  list.style.setProperty("--clock-width", layoutCount <= 6 ? "150px" : "132px");
  list.style.counterReset = `problem ${Math.max(0, Number(options.startIndex) || 0)}`;
  pageProblems.forEach((problem, index) => {
    const item = document.createElement("li");
    item.className = "problem";
    item.dataset.problemKey = problemKey(problem);
    item.dataset.questionNumber = String((Number(options.startIndex) || 0) + index + 1);
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
    sheetProblemSets.push(reconcileProblems(settings, problems));
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

function renderLogicalPages(sets, sheetCount, includeAnswers) {
  const pages = [];
  sets.forEach((set, index) => {
    const suffix = sheetCount > 1 ? ` ${index + 1}/${sheetCount}` : "";
    pages.push(renderPage(`もんだい${suffix}`, false, set, {
      sheetIndex: index,
      chunkIndex: 0,
      chunkCount: 1,
      startIndex: 0,
    }));
    if (includeAnswers) {
      pages.push(renderPage(`こたえ${suffix}`, true, set, {
        sheetIndex: index,
        chunkIndex: 0,
        chunkCount: 1,
        startIndex: 0,
      }));
    }
  });
  logicalSheetCount = sheetCount;
  logicalIncludeAnswers = includeAnswers;
  markPaginationDirty();
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  return pages;
}

function renderLogicalSheets(sheetCount, includeAnswers, { persist = true } = {}) {
  const count = clampNumber(sheetCount, 1, 30, 1);
  const sets = ensureSheetProblemSets(count);
  renderLogicalPages(sets, count, includeAnswers);
  if (persist) saveState();
  return sets;
}

function renderSheetPages(sheetCount, includeAnswers) {
  const count = clampNumber(sheetCount, 1, 30, 1);
  beginSelectionBatch();
  renderLogicalSheets(count, includeAnswers);
  showSelectionStatus();
}

function render() {
  if (!problems.length) {
    const settings = getSettings();
    problems = reconcileProblems(settings, problems);
  }
  const pageConfig = getPageConfig();
  renderLogicalSheets(pageConfig.sheetCount, pageConfig.includeAnswers);
}

function parsePixelValue(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function packProblemRanges(itemHeights, columns, capacity, rowGap) {
  const heights = Array.isArray(itemHeights) ? itemHeights : [];
  if (!heights.length) return [];
  const safeColumns = Math.max(1, Number.parseInt(columns, 10) || 1);
  const safeCapacity = Math.max(0, Number(capacity) || 0);
  const safeRowGap = Math.max(0, Number(rowGap) || 0);
  const ranges = [];
  let start = 0;

  while (start < heights.length) {
    let end = start;
    let used = 0;
    let overflow = false;
    while (end < heights.length) {
      const rowEnd = Math.min(heights.length, end + safeColumns);
      const rowHeight = Math.max(1, ...heights.slice(end, rowEnd).map((height) => Math.max(1, Number(height) || 1)));
      const nextHeight = used ? used + safeRowGap + rowHeight : rowHeight;
      if (end > start && nextHeight > safeCapacity + 0.5) break;
      if (end === start && nextHeight > safeCapacity + 0.5) overflow = true;
      used = nextHeight;
      end = rowEnd;
    }
    if (end <= start) end = start + 1;
    ranges.push({ start, end, overflow });
    start = end;
  }
  return ranges;
}

function readPageLayoutMetrics(page) {
  const grid = page?.querySelector("[data-problems]");
  if (!grid) return null;
  const style = window.getComputedStyle(grid);
  const pageHeight = Number(page.clientHeight || page.offsetHeight || parsePixelValue(window.getComputedStyle(page).height));
  const gridTop = Number(grid.offsetTop) || 0;
  const itemHeights = Array.from(grid.querySelectorAll(":scope > .problem")).map((item) => (
    Math.max(Number(item.offsetHeight) || 0, Number(item.scrollHeight) || 0, 1)
  ));
  return {
    itemHeights,
    capacity: Math.max(0, pageHeight - gridTop),
    rowGap: parsePixelValue(style.rowGap, parsePixelValue(style.gap)),
    contentHeight: Math.max(Number(grid.offsetHeight) || 0, Number(grid.scrollHeight) || 0),
  };
}

function combinePageLayoutMetrics(pages) {
  const metrics = pages.filter(Boolean).map(readPageLayoutMetrics).filter(Boolean);
  if (!metrics.length) return null;
  const itemCount = Math.max(...metrics.map((metric) => metric.itemHeights.length));
  const itemHeights = Array.from({ length: itemCount }, (_, index) => Math.max(
    1,
    ...metrics.map((metric) => Number(metric.itemHeights[index]) || 1)
  ));
  return {
    itemHeights,
    capacity: Math.min(...metrics.map((metric) => metric.capacity)),
    rowGap: Math.max(...metrics.map((metric) => metric.rowGap)),
  };
}

function findPage(sheetIndex, kind) {
  return Array.from(els.pages.querySelectorAll(".print-page")).find((page) => (
    page.dataset.logicalSheetIndex === String(sheetIndex)
      && page.dataset.logicalKind === kind
  )) || null;
}

function logicalRangesForSets(sets, includeAnswers, columns) {
  return sets.map((set, sheetIndex) => {
    const problemPage = findPage(sheetIndex, "problem");
    const answerPage = includeAnswers ? findPage(sheetIndex, "answer") : null;
    const metrics = combinePageLayoutMetrics([problemPage, answerPage]);
    if (!metrics || metrics.itemHeights.length !== set.length) {
      return [{ start: 0, end: set.length, overflow: false }];
    }
    return packProblemRanges(metrics.itemHeights, columns, metrics.capacity, metrics.rowGap);
  });
}

function physicalRangesForSets(sets, includeAnswers, columns) {
  return sets.map((set, sheetIndex) => {
    const pages = Array.from(els.pages.querySelectorAll(".print-page"))
      .filter((page) => page.dataset.logicalSheetIndex === String(sheetIndex));
    const sources = pages.filter((page) => includeAnswers || page.dataset.logicalKind !== "answer");
    const itemHeights = Array.from({ length: set.length }, () => 1);
    const capacities = [];
    const rowGaps = [];
    sources.forEach((page) => {
      const metrics = readPageLayoutMetrics(page);
      if (!metrics) return;
      capacities.push(metrics.capacity);
      rowGaps.push(metrics.rowGap);
      page.querySelectorAll(":scope [data-question-number]").forEach((item) => {
        const index = Number(item.dataset.questionNumber) - 1;
        if (index >= 0 && index < itemHeights.length) {
          itemHeights[index] = Math.max(itemHeights[index], Number(item.offsetHeight) || 1, Number(item.scrollHeight) || 1);
        }
      });
    });
    return packProblemRanges(
      itemHeights,
      columns,
      capacities.length ? Math.min(...capacities) : 0,
      rowGaps.length ? Math.max(...rowGaps) : 0
    );
  });
}

function currentPaginationFit() {
  const overflowPages = [];
  document.querySelectorAll(".print-page:not([hidden])").forEach((page) => {
    const metrics = readPageLayoutMetrics(page);
    if (metrics && metrics.contentHeight > metrics.capacity + 0.5) {
      overflowPages.push({
        page,
        tooTall: metrics.itemHeights.length === 1,
      });
    }
  });
  return {
    fits: overflowPages.length === 0,
    tooTall: overflowPages.some(({ tooTall }) => tooTall),
    overflowPages,
  };
}

function rangesSignature(rangesBySheet) {
  return JSON.stringify(rangesBySheet.map((ranges) => ranges.map(({ start, end }) => `${start}-${end}`)));
}

function paginationHint(showAnswer, sheetIndex, sheetCount, setLength, chunkIndex, chunkCount, overflow) {
  const sheetLabel = sheetCount > 1 ? `${sheetIndex + 1}枚目の` : "";
  if (overflow) {
    return `${sheetLabel}${showAnswer ? "答え" : "問題"}の1問がA4の高さを超えています。問題を隠さず表示しています。`;
  }
  if (chunkCount <= 1) return "";
  return `${sheetLabel}${setLength}問を${chunkCount}ページに自動分割（${showAnswer ? "答え" : "問題"} ${chunkIndex + 1}/${chunkCount}）`;
}

function renderPhysicalPages(sets, rangesBySheet, includeAnswers) {
  const sheetCount = sets.length;
  const pages = [];
  sets.forEach((set, sheetIndex) => {
    const ranges = rangesBySheet[sheetIndex] || [{ start: 0, end: set.length, overflow: false }];
    const suffix = sheetCount > 1 ? ` ${sheetIndex + 1}/${sheetCount}` : "";
    ranges.forEach((range, chunkIndex) => {
      const chunkSuffix = ranges.length > 1 ? `（${chunkIndex + 1}/${ranges.length}）` : "";
      const pagePair = `${sheetIndex}:${chunkIndex}`;
      pages.push(renderPage(`もんだい${suffix}${chunkSuffix}`, false, set.slice(range.start, range.end), {
        sheetIndex,
        chunkIndex,
        chunkCount: ranges.length,
        startIndex: range.start,
        pagePair,
        overflow: range.overflow,
        hintText: paginationHint(false, sheetIndex, sheetCount, set.length, chunkIndex, ranges.length, range.overflow),
      }));
    });
    if (includeAnswers) {
      ranges.forEach((range, chunkIndex) => {
        const chunkSuffix = ranges.length > 1 ? `（${chunkIndex + 1}/${ranges.length}）` : "";
        const pagePair = `${sheetIndex}:${chunkIndex}`;
        pages.push(renderPage(`こたえ${suffix}${chunkSuffix}`, true, set.slice(range.start, range.end), {
          sheetIndex,
          chunkIndex,
          chunkCount: ranges.length,
          startIndex: range.start,
          pagePair,
          overflow: range.overflow,
          hintText: paginationHint(true, sheetIndex, sheetCount, set.length, chunkIndex, ranges.length, range.overflow),
        }));
      });
    }
  });
  els.pages.replaceChildren(...pages);
  els.pageCount.textContent = `${pages.length}枚`;
  return pages;
}

function paginationSignature(settings, includeAnswers, sheetCount) {
  const appSettings = getSettings();
  return JSON.stringify({
    sheetCount,
    includeAnswers,
    app: {
      type: appSettings.type,
      range: appSettings.range,
      minuteLabelMode: appSettings.minuteLabelMode,
      count: appSettings.count,
      columns: appSettings.columns,
      name: appSettings.name,
      date: appSettings.date,
      title: appSettings.title,
    },
    print: {
      scalePct: settings?.scalePct ?? null,
      orientation: settings?.orientation ?? "portrait",
    },
    sets: sheetProblemSets.map((set) => set.map(problemKey)),
  });
}

function getExpectedPhysicalPageCount({ sheetCount, includeAnswers, logicalPageCount }) {
  const count = clampNumber(sheetCount, 1, 30, 1);
  if (
    paginationState.dirty
    || paginationState.sheetCount !== count
    || paginationState.includeAnswers !== Boolean(includeAnswers)
    || !paginationState.physical
  ) {
    return logicalPageCount;
  }
  return paginationState.physicalPageCount || logicalPageCount;
}

function paginateAfterLayout({ settings = {}, reapplyScale } = {}) {
  const pageConfig = {
    sheetCount: clampNumber(settings.sheetCount, 1, 30, logicalSheetCount),
    includeAnswers: settings.includeAnswers !== false,
  };
  const signature = paginationSignature(settings, pageConfig.includeAnswers, pageConfig.sheetCount);
  if (!paginationState.dirty && paginationState.signature === signature) {
    return { changed: false, physicalPageCount: paginationState.physicalPageCount, fits: true };
  }

  let changed = false;
  if (
    paginationState.physical
    || logicalSheetCount !== pageConfig.sheetCount
    || logicalIncludeAnswers !== pageConfig.includeAnswers
  ) {
    renderLogicalSheets(pageConfig.sheetCount, pageConfig.includeAnswers, { persist: false });
    reapplyScale?.();
    changed = true;
  }

  const sets = ensureSheetProblemSets(pageConfig.sheetCount);
  let rangesBySheet = logicalRangesForSets(sets, pageConfig.includeAnswers, getColumns());
  let previousRanges = "";
  let fit = { fits: true, tooTall: false, overflowPages: [] };

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const nextRanges = rangesSignature(rangesBySheet);
    const needsPhysicalRender = rangesBySheet.some((ranges, sheetIndex) => (
      ranges.length > 1
      || ranges[0]?.start !== 0
      || ranges[0]?.end !== sets[sheetIndex].length
    ));
    if (needsPhysicalRender) {
      renderPhysicalPages(sets, rangesBySheet, pageConfig.includeAnswers);
      reapplyScale?.();
      changed = true;
    }
    fit = currentPaginationFit();
    if (fit.fits || fit.tooTall || nextRanges === previousRanges) break;
    previousRanges = nextRanges;
    rangesBySheet = physicalRangesForSets(sets, pageConfig.includeAnswers, getColumns());
  }

  const physicalPageCount = document.querySelectorAll(".print-page:not([hidden])").length;
  paginationState = {
    dirty: false,
    physical: true,
    signature,
    physicalPageCount,
    sheetCount: pageConfig.sheetCount,
    includeAnswers: pageConfig.includeAnswers,
  };
  els.pageCount.textContent = `${physicalPageCount}枚`;
  if (fit.tooTall) {
    setStatus("A4の高さを超える問題があります。問題を隠さず表示しています。");
  }
  return { changed, physicalPageCount, fits: fit.fits, tooTall: fit.tooTall };
}

function refreshProblemsForSettings() {
  const settings = getSettings();
  beginSelectionBatch();
  const existingSets = sheetProblemSets.length ? sheetProblemSets : [problems];
  sheetProblemSets = existingSets.map((set) => reconcileProblems(settings, set));
  problems = sheetProblemSets[0] || reconcileProblems(settings, problems);
  sheetSetSignature = sheetSignature(settings);
  render();
  showSelectionStatus();
}

function getShareState() {
  return { version: APP.stateVersion, settings: getSettings(), problems };
}

function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
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

function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded?.settings) {
      applySettings(decoded.settings);
      problems = decoded.version === APP.stateVersion && Array.isArray(decoded.problems) ? decoded.problems : [];
      return;
    }
  }
  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      applySettings(parsed.settings);
      if (parsed.version === APP.stateVersion && Array.isArray(parsed.problems)) problems = parsed.problems;
    }
  } catch {}
}

async function copyShareUrl() {
  const encoded = encodeState(getShareState());
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("URL欄に共有用データを入れました。");
  }
}

function bindEvents() {
  [els.studentName, els.worksheetDate, els.worksheetTitle].forEach((control) => control.addEventListener("input", render));
  [els.problemType, els.range].forEach((control) => control.addEventListener("change", generateProblems));
  els.problemCount.addEventListener("change", generateProblems);
  els.minuteLabelMode.addEventListener("change", refreshProblemsForSettings);
  els.columns.addEventListener("change", render);
  els.columns.addEventListener("input", render);
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
}

function initializeApp() {
  loadInitialState();
  bindEvents();
  window.__printAdjustmentsExpectedPageCount = getExpectedPhysicalPageCount;
  window.__printAdjustmentsAfterLayout = paginateAfterLayout;
  window.__printAdjustmentsGenerateSheets = ({ sheetCount, includeAnswers }) => {
    renderSheetPages(sheetCount, includeAnswers);
    return true;
  };
  if (!problems.length) generateProblems();
  else {
    beginSelectionBatch();
    problems = reconcileProblems(getSettings(), problems);
    sheetProblemSets = [];
    sheetSetSignature = "";
    render();
    showSelectionStatus();
  }
}

if (!globalThis.__CLOCK_PRINT_TEST__) {
  initializeApp();
}
