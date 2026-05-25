const els = {
  sourceText: document.querySelector("#sourceText"),
  addReadings: document.querySelector("#addReadings"),
  readingPanel: document.querySelector("#readingPanel"),
  readingText: document.querySelector("#readingText"),
  extractReadingsBtn: document.querySelector("#extractReadingsBtn"),
  rubyFontSize: document.querySelector("#rubyFontSize"),
  rubyOpacity: document.querySelector("#rubyOpacity"),
  rubySpacing: document.querySelector("#rubySpacing"),
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  cols: document.querySelector("#cols"),
  rows: document.querySelector("#rows"),
  sheetCount: document.querySelector("#sheetCount"),
  fontSize: document.querySelector("#fontSize"),
  smallFontSize: document.querySelector("#smallFontSize"),
  punctuationScale: document.querySelector("#punctuationScale"),
  fontFamily: document.querySelector("#fontFamily"),
  fontWeight: document.querySelector("#fontWeight"),
  letterSpacing: document.querySelector("#letterSpacing"),
  opacity: document.querySelector("#opacity"),
  stripSpaces: document.querySelector("#stripSpaces"),
  lineBreakColumn: document.querySelector("#lineBreakColumn"),
  fillExtraKanji: document.querySelector("#fillExtraKanji"),
  extraBlankCount: document.querySelector("#extraBlankCount"),
  pages: document.querySelector("#pages"),
  pageTemplate: document.querySelector("#pageTemplate"),
  pageCount: document.querySelector("#pageCount"),
  printBtn: document.querySelector("#printBtn"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  templateName: document.querySelector("#templateName"),
  templateSelect: document.querySelector("#templateSelect"),
  saveTemplateBtn: document.querySelector("#saveTemplateBtn"),
  applyTemplateBtn: document.querySelector("#applyTemplateBtn"),
  deleteTemplateBtn: document.querySelector("#deleteTemplateBtn"),
  status: document.querySelector("#status"),
};

const punctuation = new Set(["。", "、", "，", "．", ".", ",", "」", "』", "）", ")", "】", "〕"]);
const verticalLineMarks = new Set(["ー", "－", "−", "―"]);
const smallKana = new Set([
  "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "っ", "ゃ", "ゅ", "ょ", "ゎ", "ゕ", "ゖ",
  "ァ", "ィ", "ゥ", "ェ", "ォ", "ッ", "ャ", "ュ", "ョ", "ヮ", "ヵ", "ヶ",
]);
let statusTimer;
const stateStorageKey = "kanji-tracing-print";
const templateStorageKey = "kanji-tracing-templates";
const fontStacks = {
  kyokasho: '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "BIZ UDPGothic", "Yu Gothic", sans-serif',
  gothic: '"BIZ UDPGothic", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif',
  mincho: '"Yu Mincho", "BIZ UDMincho", "MS Mincho", "Noto Serif JP", serif',
};
const wordReadings = [
  ["木曜日", ["もく", "よう", "び"]],
  ["日曜日", ["にち", "よう", "び"]],
  ["月曜日", ["げつ", "よう", "び"]],
  ["火曜日", ["か", "よう", "び"]],
  ["水曜日", ["すい", "よう", "び"]],
  ["金曜日", ["きん", "よう", "び"]],
  ["土曜日", ["ど", "よう", "び"]],
  ["大好き", ["だい", "す"]],
  ["大き", ["おお"]],
  ["大陸", ["たい", "りく"]],
  ["横断", ["おう", "だん"]],
  ["九州", ["きゅう", "しゅう"]],
  ["中央", ["ちゅう", "おう"]],
  ["早起", ["はや", "お"]],
  ["学習", ["がく", "しゅう"]],
  ["練習", ["れん", "しゅう"]],
];
const kanjiReadingFallback = {
  一: "いち",
  二: "に",
  三: "さん",
  四: "よん",
  五: "ご",
  六: "ろく",
  七: "なな",
  八: "はち",
  九: "きゅう",
  十: "じゅう",
  百: "ひゃく",
  千: "せん",
  上: "うえ",
  下: "した",
  左: "ひだり",
  右: "みぎ",
  中: "なか",
  大: "だい",
  小: "しょう",
  山: "やま",
  川: "かわ",
  田: "た",
  日: "にち",
  月: "つき",
  火: "ひ",
  水: "みず",
  木: "き",
  金: "きん",
  土: "つち",
  人: "ひと",
  子: "こ",
  女: "おんな",
  男: "おとこ",
  目: "め",
  口: "くち",
  耳: "みみ",
  手: "て",
  足: "あし",
  花: "はな",
  草: "くさ",
  虫: "むし",
  犬: "いぬ",
  王: "おう",
  玉: "たま",
  空: "そら",
  雨: "あめ",
  糸: "いと",
  車: "くるま",
  学: "がく",
  校: "こう",
  先: "せん",
  生: "せい",
  年: "ねん",
  時: "じ",
  分: "ふん",
  半: "はん",
  曜: "よう",
  好: "す",
  陸: "りく",
  横: "おう",
  断: "だん",
  練: "れん",
  習: "しゅう",
};

function getDirection() {
  return document.querySelector('input[name="direction"]:checked')?.value || "ltr";
}

function getTraceFontStack() {
  return fontStacks[els.fontFamily.value] || fontStacks.kyokasho;
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function normalizeText(text, cols, rows) {
  const columnBreak = "\uE000";
  let source = text.replace(/\r\n?/g, "\n");

  if (els.stripSpaces.checked) {
    source = source.replace(/[ \t　]/g, "");
  }

  if (els.lineBreakColumn.checked) {
    source = source.replace(/\n+/g, columnBreak);
  } else {
    source = source.replace(/\n+/g, "");
  }

  const cells = [];
  let position = 0;
  let columnStart = 0;

  function pushCell(char, practice = false) {
    cells.push({ char, practice });
    position += 1;
  }

  function fillColumnWithBlanks(practice = false) {
    const remainder = position % rows;
    if (remainder === 0) {
      columnStart = position;
      return;
    }

    const blanks = rows - remainder;
    for (let index = 0; index < blanks; index += 1) {
      pushCell("", practice);
    }
    columnStart = position;
  }

  function addPracticeToColumn() {
    if (!els.fillExtraKanji.checked) {
      return;
    }

    const remainder = position % rows;
    if (remainder === 0) {
      columnStart = position;
      return;
    }

    const columnKanji = getUniqueKanji(cells.slice(columnStart, position).map((cell) => cell.char).join(""));
    const blanksToBottom = rows - remainder;
    const bottomBlanks = clampNumber(els.extraBlankCount.value, 0, rows - 1, 2);
    const practiceSlots = Math.max(0, blanksToBottom - bottomBlanks);

    for (let index = 0; index < practiceSlots; index += 1) {
      pushCell(columnKanji.length ? columnKanji[index % columnKanji.length] : "", true);
    }

    fillColumnWithBlanks(true);
  }

  for (const char of Array.from(source)) {
    if (char === columnBreak) {
      fillColumnWithBlanks();
      continue;
    }

    pushCell(char);
    if (isSentenceEndChar(char)) {
      addPracticeToColumn();
    }
  }

  const perPage = cols * rows;
  const pages = [];
  for (let i = 0; i < Math.max(cells.length, 1); i += perPage) {
    pages.push(cells.slice(i, i + perPage));
  }
  return pages;
}

function isKanji(char) {
  return /[\u3400-\u9fff々]/u.test(char);
}

function getUniqueKanji(text) {
  return [...new Set(Array.from(text).filter(isKanji))];
}

function isSentenceEndChar(char) {
  return ["\u3002", "\uff0e", ".", "\uff01", "!", "\uff1f", "?"].includes(char);
}

function parseReadingQueues() {
  const queues = new Map();
  els.readingText.value.split(/\n+/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const separatorIndex = trimmed.search(/[=\uff1d:\uff1a\s\u3000]/u);
    const rawKanji = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
    const reading = separatorIndex >= 0
      ? trimmed.slice(separatorIndex + 1).replace(/^[=\uff1d:\uff1a\s\u3000]+/u, "").trim()
      : "";
    const kanji = Array.from(rawKanji || "").find(isKanji);
    if (kanji) {
      if (!queues.has(kanji)) {
        queues.set(kanji, []);
      }
      queues.get(kanji).push(reading);
    }
  });
  return queues;
}

function makeReadingResolver() {
  const queues = parseReadingQueues();
  const used = new Map();

  return (char) => {
    const readings = queues.get(char);
    if (!readings || !readings.length) {
      return "";
    }

    if (readings.length === 1) {
      return readings[0];
    }

    const index = used.get(char) || 0;
    used.set(char, index + 1);
    return readings[index] || "";
  };
}

function makeAutoReadingLines(text) {
  const chars = Array.from(text);
  const readings = Array.from({ length: chars.length }, () => "");
  let index = 0;

  while (index < chars.length) {
    const matched = wordReadings.find(([word]) => text.startsWith(word, index));
    if (matched) {
      const [word, wordReading] = matched;
      const readingsForWord = [...wordReading];
      Array.from(word).forEach((char, offset) => {
        if (isKanji(char)) {
          readings[index + offset] = readingsForWord.shift() || kanjiReadingFallback[char] || "";
        }
      });
      index += Array.from(word).length;
      continue;
    }

    const char = chars[index];
    if (isKanji(char)) {
      readings[index] = kanjiReadingFallback[char] || "";
    }
    index += 1;
  }

  return chars
    .map((char, charIndex) => (isKanji(char) ? `${char}=${readings[charIndex] || ""}` : ""))
    .filter(Boolean)
    .join("\n");
}

function syncReadingPanel() {
  if (els.addReadings.disabled) {
    els.addReadings.checked = false;
  }
  els.readingPanel.hidden = !els.addReadings.checked;
}

function makeReadingMarks(cols, direction) {
  return Array.from({ length: cols }, (_, index) => {
    const number = direction === "rtl" ? cols - index : index + 1;
    return String(number);
  });
}

function render() {
  syncReadingPanel();
  const cols = clampNumber(els.cols.value, 6, 14, 10);
  const rows = clampNumber(els.rows.value, 8, 20, 14);
  const fontSize = clampNumber(els.fontSize.value, 18, 72, 34);
  const smallFontSize = clampNumber(els.smallFontSize.value, 14, 56, 30);
  const punctuationScale = clampNumber(els.punctuationScale.value, 35, 90, 58);
  const fontWeight = clampNumber(els.fontWeight.value, 300, 700, 500);
  const letterSpacing = clampNumber(els.letterSpacing.value, -2, 6, 0);
  const opacity = clampNumber(els.opacity.value, 8, 45, 24) / 100;
  const rubyFontSize = clampNumber(els.rubyFontSize.value, 5, 14, 7);
  const rubyOpacity = clampNumber(els.rubyOpacity.value, 20, 100, 80) / 100;
  const rubySpacing = clampNumber(els.rubySpacing.value, 0, 4, 0);
  const sheetCount = clampNumber(els.sheetCount.value, 1, 30, 1);
  const direction = getDirection();
  const pageData = normalizeText(els.sourceText.value, cols, rows);
  const resolveReading = els.addReadings.checked ? makeReadingResolver() : () => "";
  const pageTotal = pageData.length;
  const layout = calculateSheetLayout(cols, rows);

  document.documentElement.style.setProperty("--cols", cols);
  document.documentElement.style.setProperty("--rows", rows);
  document.documentElement.style.setProperty("--cell-w", `${layout.cellSize}mm`);
  document.documentElement.style.setProperty("--cell-h", `${layout.cellSize}mm`);
  document.documentElement.style.setProperty("--ruby-w", `${layout.rubyWidth}mm`);
  document.documentElement.style.setProperty("--grid-width", `${layout.gridWidth}mm`);
  document.documentElement.style.setProperty("--grid-height", `${layout.gridHeight}mm`);
  document.documentElement.style.setProperty("--trace-size", `${fontSize}px`);
  document.documentElement.style.setProperty("--small-trace-size", `${smallFontSize}px`);
  document.documentElement.style.setProperty("--punctuation-size", `${Math.round(fontSize * punctuationScale) / 100}px`);
  document.documentElement.style.setProperty("--trace-font-family", getTraceFontStack());
  document.documentElement.style.setProperty("--trace-font-weight", fontWeight);
  document.documentElement.style.setProperty("--letter-spacing", `${letterSpacing}px`);
  document.documentElement.style.setProperty("--trace-opacity", opacity.toFixed(2));
  document.documentElement.style.setProperty("--ruby-font-size", `${rubyFontSize}px`);
  document.documentElement.style.setProperty("--ruby-opacity", rubyOpacity.toFixed(2));
  document.documentElement.style.setProperty("--ruby-spacing", `${rubySpacing}px`);

  els.pages.textContent = "";
  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    pageData.forEach((chars, pageIndex) => {
    const page = els.pageTemplate.content.firstElementChild.cloneNode(true);
    page.querySelector("[data-name]").textContent = els.studentName.value;
    page.querySelector("[data-date]").textContent = els.worksheetDate.value;
    page.querySelector("[data-page-number]").textContent = `${pageIndex + 1} / ${pageTotal}`;

    const readings = page.querySelector("[data-readings]");
    makeReadingMarks(cols, direction).forEach((mark) => {
      const div = document.createElement("div");
      div.className = "reading-mark";
      div.style.gridColumn = `${readings.children.length * 2 + 1}`;
      div.textContent = mark;
      readings.append(div);
    });

    const grid = page.querySelector("[data-grid]");
    const cells = Array.from({ length: cols * rows }, () => ({ char: "", practice: false, reading: "" }));
    chars.forEach((sourceCell, index) => {
      const col = Math.floor(index / rows);
      const row = index % rows;
      const visualCol = direction === "rtl" ? cols - 1 - col : col;
      const char = sourceCell.char || "";
      cells[row * cols + visualCol] = {
        ...sourceCell,
        reading: els.addReadings.checked && !sourceCell.practice && isKanji(char) ? resolveReading(char) : "",
      };
    });

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell = cells[row * cols + col];
        grid.append(createTextCell(cell.char));
        grid.append(createRubyCell(cell.reading));
      }
    }

    els.pages.append(page);
    });
  }

  els.pageCount.textContent = `${pageTotal * sheetCount}枚`;
  saveState();
}

function calculateSheetLayout(cols, rows) {
  const pageWidth = 210;
  const pageHeight = 297;
  const horizontalPadding = 4;
  const verticalPadding = 5;
  const headerAndMarks = 22;
  const rubyWidth = 3.6;
  const availableWidth = pageWidth - horizontalPadding * 2;
  const availableHeight = pageHeight - verticalPadding * 2 - headerAndMarks;
  const widthLimitedSize = (availableWidth - cols * rubyWidth) / cols;
  const heightLimitedSize = availableHeight / rows;
  const cellSize = Math.max(10, Math.min(widthLimitedSize, heightLimitedSize));

  return {
    cellSize: roundMm(cellSize),
    rubyWidth,
    gridWidth: roundMm(cols * (cellSize + rubyWidth)),
    gridHeight: roundMm(rows * cellSize),
  };
}

function roundMm(value) {
  return Math.round(value * 1000) / 1000;
}

function createTextCell(char) {
  const cell = document.createElement("div");
  cell.className = "cell text-cell";
  if (punctuation.has(char)) {
    cell.classList.add("punctuation-mark");
  } else if (verticalLineMarks.has(char)) {
    cell.classList.add("vertical-line-mark");
  } else if (smallKana.has(char)) {
    cell.classList.add("small-kana");
  }
  if (char) {
    const span = document.createElement("span");
    span.className = "trace-char";
    span.textContent = verticalLineMarks.has(char) ? "" : char;
    cell.append(span);
  }
  return cell;
}

function createRubyCell(reading = "") {
  const cell = document.createElement("div");
  cell.className = "ruby-cell";
  if (reading) {
    const span = document.createElement("span");
    span.className = "ruby-text";
    span.textContent = reading;
    cell.append(span);
  }
  return cell;
}

function extractReadingsFromText() {
  if (els.addReadings.disabled) {
    syncReadingPanel();
    setStatus("読み仮名は現在利用できません。");
    return;
  }
  els.addReadings.checked = true;
  syncReadingPanel();

  els.readingText.value = makeAutoReadingLines(els.sourceText.value);
  render();
  setStatus("本文中の漢字を読み仮名欄に出しました。");
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getState() {
  return {
    text: els.sourceText.value,
    addReadings: !els.addReadings.disabled && els.addReadings.checked,
    readings: els.readingText.value,
    name: els.studentName.value,
    date: els.worksheetDate.value,
    cols: els.cols.value,
    rows: els.rows.value,
    sheetCount: els.sheetCount.value,
    fontSize: els.fontSize.value,
    smallFontSize: els.smallFontSize.value,
    punctuationScale: els.punctuationScale.value,
    fontFamily: els.fontFamily.value,
    fontWeight: els.fontWeight.value,
    letterSpacing: els.letterSpacing.value,
    opacity: els.opacity.value,
    rubyFontSize: els.rubyFontSize.value,
    rubyOpacity: els.rubyOpacity.value,
    rubySpacing: els.rubySpacing.value,
    stripSpaces: els.stripSpaces.checked,
    lineBreakColumn: els.lineBreakColumn.checked,
    fillExtraKanji: els.fillExtraKanji.checked,
    extraBlankCount: els.extraBlankCount.value,
    direction: getDirection(),
  };
}

function getTemplateSettings() {
  return {
    cols: els.cols.value,
    rows: els.rows.value,
    sheetCount: els.sheetCount.value,
    fontSize: els.fontSize.value,
    smallFontSize: els.smallFontSize.value,
    punctuationScale: els.punctuationScale.value,
    fontFamily: els.fontFamily.value,
    fontWeight: els.fontWeight.value,
    letterSpacing: els.letterSpacing.value,
    opacity: els.opacity.value,
    rubyFontSize: els.rubyFontSize.value,
    rubyOpacity: els.rubyOpacity.value,
    rubySpacing: els.rubySpacing.value,
    stripSpaces: els.stripSpaces.checked,
    lineBreakColumn: els.lineBreakColumn.checked,
    fillExtraKanji: els.fillExtraKanji.checked,
    extraBlankCount: els.extraBlankCount.value,
    direction: getDirection(),
  };
}

function applyState(state) {
  if (!state || typeof state !== "object") {
    return;
  }

  const assignments = [
    ["sourceText", "text"],
    ["readingText", "readings"],
    ["studentName", "name"],
    ["worksheetDate", "date"],
    ["cols", "cols"],
    ["rows", "rows"],
    ["sheetCount", "sheetCount"],
    ["fontSize", "fontSize"],
    ["smallFontSize", "smallFontSize"],
    ["punctuationScale", "punctuationScale"],
    ["fontFamily", "fontFamily"],
    ["fontWeight", "fontWeight"],
    ["letterSpacing", "letterSpacing"],
    ["opacity", "opacity"],
    ["rubyFontSize", "rubyFontSize"],
    ["rubyOpacity", "rubyOpacity"],
    ["rubySpacing", "rubySpacing"],
    ["extraBlankCount", "extraBlankCount"],
  ];
  assignments.forEach(([elementKey, stateKey]) => {
    if (state[stateKey] !== undefined) {
      els[elementKey].value = state[stateKey];
    }
  });

  if (Number(state.fontWeight) > 700) {
    els.fontWeight.value = "700";
  }

  if (state.fontFamily === "maru") {
    els.fontFamily.value = "gothic";
  }

  if (state.stripSpaces !== undefined) {
    els.stripSpaces.checked = Boolean(state.stripSpaces);
  }
  if (state.lineBreakColumn !== undefined) {
    els.lineBreakColumn.checked = Boolean(state.lineBreakColumn);
  }
  if (state.addReadings !== undefined && !els.addReadings.disabled) {
    els.addReadings.checked = Boolean(state.addReadings);
  }
  if (state.fillExtraKanji !== undefined) {
    els.fillExtraKanji.checked = Boolean(state.fillExtraKanji);
  }
  if (state.direction) {
    const direction = document.querySelector(`input[name="direction"][value="${state.direction}"]`);
    if (direction) {
      direction.checked = true;
    }
  }
}

function encodeState(state) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
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
    localStorage.setItem(stateStorageKey, JSON.stringify(getState()));
  } catch {
    // Local storage can be disabled; the app still works without it.
  }
}

function loadInitialState() {
  const hash = window.location.hash.replace(/^#data=/, "");
  if (hash) {
    const decoded = decodeState(hash);
    if (decoded) {
      applyState(decoded);
      return;
    }
  }

  try {
    const saved = localStorage.getItem(stateStorageKey);
    if (saved) {
      applyState(JSON.parse(saved));
    }
  } catch {
    // Ignore broken saved state.
  }
}

function loadTemplates() {
  try {
    const saved = localStorage.getItem(templateStorageKey);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveTemplates(templates) {
  localStorage.setItem(templateStorageKey, JSON.stringify(templates));
}

function refreshTemplateList(selectedName = "") {
  const templates = loadTemplates();
  const names = Object.keys(templates).sort((a, b) => a.localeCompare(b, "ja"));
  els.templateSelect.textContent = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = names.length ? "選択してください" : "保存されたテンプレートはありません";
  els.templateSelect.append(empty);

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.templateSelect.append(option);
  });

  if (selectedName && templates[selectedName]) {
    els.templateSelect.value = selectedName;
  }
}

function saveTemplate() {
  const name = els.templateName.value.trim();
  if (!name) {
    setStatus("保存名を入力してください。");
    els.templateName.focus();
    return;
  }

  const templates = loadTemplates();
  templates[name] = getTemplateSettings();
  saveTemplates(templates);
  refreshTemplateList(name);
  setStatus("テンプレートを保存しました。");
}

function applyTemplate() {
  const name = els.templateSelect.value;
  const templates = loadTemplates();
  if (!name || !templates[name]) {
    setStatus("テンプレートを選んでください。");
    return;
  }

  applyState(templates[name]);
  render();
  setStatus("テンプレートを適用しました。");
}

function deleteTemplate() {
  const name = els.templateSelect.value;
  const templates = loadTemplates();
  if (!name || !templates[name]) {
    setStatus("削除するテンプレートを選んでください。");
    return;
  }

  if (!window.confirm(`テンプレート「${name}」を削除しますか？`)) {
    return;
  }

  delete templates[name];
  saveTemplates(templates);
  refreshTemplateList();
  setStatus("テンプレートを削除しました。");
}

async function copyShareUrl() {
  const encoded = encodeState(getState());
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#data=${encoded}`;

  try {
    await navigator.clipboard.writeText(url);
    setStatus("共有URLをコピーしました。");
  } catch {
    window.location.hash = `data=${encoded}`;
    setStatus("URL欄に共有用データを入れました。");
  }
}

function waitForPrintReady() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fontsReady = document.fonts?.ready || Promise.resolve();
        Promise.race([
          fontsReady,
          new Promise((timeoutResolve) => setTimeout(timeoutResolve, 250)),
        ]).finally(resolve);
      });
    });
  });
}

function bindEvents() {
  const controls = [
    els.sourceText,
    els.addReadings,
    els.readingText,
    els.studentName,
    els.worksheetDate,
    els.cols,
    els.rows,
    els.sheetCount,
    els.fontSize,
    els.smallFontSize,
    els.punctuationScale,
    els.fontFamily,
    els.fontWeight,
    els.letterSpacing,
    els.opacity,
    els.rubyFontSize,
    els.rubyOpacity,
    els.rubySpacing,
    els.stripSpaces,
    els.lineBreakColumn,
    els.fillExtraKanji,
    els.extraBlankCount,
    ...document.querySelectorAll('input[name="direction"]'),
  ];

  controls.forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  els.printBtn.addEventListener("click", async () => {
    render();
    await waitForPrintReady();
    window.print();
  });

  els.copyLinkBtn.addEventListener("click", copyShareUrl);
  els.extractReadingsBtn.addEventListener("click", extractReadingsFromText);
  els.addReadings.addEventListener("change", () => {
    if (els.addReadings.checked && !els.readingText.value.trim()) {
      els.readingText.value = makeAutoReadingLines(els.sourceText.value);
    }
    render();
  });
  els.saveTemplateBtn.addEventListener("click", saveTemplate);
  els.applyTemplateBtn.addEventListener("click", applyTemplate);
  els.deleteTemplateBtn.addEventListener("click", deleteTemplate);
  els.templateSelect.addEventListener("change", () => {
    if (els.templateSelect.value) {
      els.templateName.value = els.templateSelect.value;
    }
  });

  els.clearBtn.addEventListener("click", () => {
    els.sourceText.value = "";
    render();
    els.sourceText.focus();
  });
}

loadInitialState();
bindEvents();
refreshTemplateList();
render();
