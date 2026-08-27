const STORAGE_KEY = "renrakucho-maker-v1";
const TEMPLATE_EXPORT_VERSION = 1;
const BODY_FONT_SIZE_MIN = 24;
const BODY_FONT_SIZE_MAX = 44;
const BODY_FONT_SIZE_STEP = 2;
const DEFAULT_BODY_FONT_SIZE = 24;
const DEFAULT_BODY_COLUMNS = 14;
const MIN_BODY_COLUMNS = 8;

const defaultState = {
  month: "",
  day: "",
  weekday: "",
  body: "",
  opacity: 34,
  fontWeight: 400,
  letterSpacing: 4,
  bodyFontSize: DEFAULT_BODY_FONT_SIZE,
  bodyOffsetX: 0,
  bodyOffsetY: 0,
  circleTemplates: [
    { id: "circle-shi", name: "し○", token: "[丸:し]" },
    { id: "circle-te", name: "て○", token: "[丸:て]" },
  ],
  phraseTemplates: [
    { id: "phrase-page-short", text: "p." },
    { id: "phrase-page", text: "ページ" },
    { id: "phrase-reading", text: "音読" },
    { id: "phrase-math-drill", text: "計ド" },
    { id: "phrase-kanji-drill", text: "漢ド" },
    { id: "phrase-homework", text: "宿題" },
    { id: "phrase-print", text: "プリント" },
    { id: "phrase-belongings", text: "持ち物" },
    { id: "phrase-reading-card", text: "音読カード" },
    { id: "phrase-notebook", text: "連絡帳" },
  ],
  textTemplates: [],
};

const elements = {
  month: document.querySelector("#monthInput"),
  day: document.querySelector("#dayInput"),
  weekday: document.querySelector("#weekdayInput"),
  body: document.querySelector("#bodyInput"),
  opacity: document.querySelector("#opacityInput"),
  fontWeight: document.querySelector("#fontWeightInput"),
  letterSpacing: document.querySelector("#letterSpacingInput"),
  bodyFontSize: document.querySelector("#bodyFontSizeInput"),
  bodyFontSizeValue: document.querySelector("#bodyFontSizeValue"),
  bodyOffsetX: document.querySelector("#bodyOffsetXInput"),
  bodyOffsetY: document.querySelector("#bodyOffsetYInput"),
  resetBodyPosition: document.querySelector("#resetBodyPositionButton"),
  previewMonth: document.querySelector("#previewMonth"),
  previewDay: document.querySelector("#previewDay"),
  previewWeekday: document.querySelector("#previewWeekday"),
  previewText: document.querySelector("#previewText"),
  bodyOverflowWarning: document.querySelector("#bodyOverflowWarning"),
  printPage: document.querySelector("#printPage"),
  printButton: document.querySelector("#printButton"),
  circleChar: document.querySelector("#circleCharInput"),
  insertCircle: document.querySelector("#insertCircleButton"),
  circleTemplateName: document.querySelector("#circleTemplateName"),
  saveCircleTemplate: document.querySelector("#saveCircleTemplateButton"),
  circleTemplateList: document.querySelector("#circleTemplateList"),
  squareNumber: document.querySelector("#squareNumberInput"),
  insertSquareNumber: document.querySelector("#insertSquareNumberButton"),
  rangeStart: document.querySelector("#rangeStartInput"),
  rangeEnd: document.querySelector("#rangeEndInput"),
  insertRange: document.querySelector("#insertRangeButton"),
  circledNumberList: document.querySelector("#circledNumberList"),
  phraseList: document.querySelector("#phraseList"),
  phraseTemplateInput: document.querySelector("#phraseTemplateInput"),
  savePhraseTemplate: document.querySelector("#savePhraseTemplateButton"),
  textTemplateName: document.querySelector("#textTemplateName"),
  saveTextTemplate: document.querySelector("#saveTextTemplateButton"),
  textTemplateList: document.querySelector("#textTemplateList"),
  exportTemplates: document.querySelector("#exportTemplatesButton"),
  importTemplates: document.querySelector("#importTemplatesInput"),
  templateImportStatus: document.querySelector("#templateImportStatus"),
};

let state = loadState();
let overflowCheckFrame = 0;

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function normalizeBodyFontSize(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BODY_FONT_SIZE;
  }

  const steppedValue = Math.round((numericValue - BODY_FONT_SIZE_MIN) / BODY_FONT_SIZE_STEP) * BODY_FONT_SIZE_STEP
    + BODY_FONT_SIZE_MIN;
  return Math.min(BODY_FONT_SIZE_MAX, Math.max(BODY_FONT_SIZE_MIN, steppedValue));
}

function getBodyColumnCount(fontSize) {
  const normalizedSize = normalizeBodyFontSize(fontSize);
  const sizeProgress = (normalizedSize - BODY_FONT_SIZE_MIN) / (BODY_FONT_SIZE_MAX - BODY_FONT_SIZE_MIN);
  return Math.max(
    MIN_BODY_COLUMNS,
    Math.floor(DEFAULT_BODY_COLUMNS - sizeProgress * (DEFAULT_BODY_COLUMNS - MIN_BODY_COLUMNS)),
  );
}

function formatBodyFontSize(fontSize) {
  const normalizedSize = normalizeBodyFontSize(fontSize);
  return `${normalizedSize}px${normalizedSize === DEFAULT_BODY_FONT_SIZE ? "（標準）" : ""}`;
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return cloneDefaultState();
  }

  try {
    const parsed = JSON.parse(saved);
    const mergedState = {
      ...cloneDefaultState(),
      ...parsed,
      circleTemplates: parsed.circleTemplates?.length
        ? normalizeCircleTemplates(parsed.circleTemplates)
        : cloneDefaultState().circleTemplates,
      phraseTemplates: parsed.phraseTemplates?.length
        ? parsed.phraseTemplates
        : cloneDefaultState().phraseTemplates,
      textTemplates: parsed.textTemplates || [],
    };
    return {
      ...mergedState,
      bodyFontSize: normalizeBodyFontSize(mergedState.bodyFontSize),
    };
  } catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncInputs() {
  elements.month.value = state.month;
  elements.day.value = state.day;
  elements.weekday.value = state.weekday;
  elements.body.value = state.body;
  elements.opacity.value = state.opacity;
  elements.fontWeight.value = state.fontWeight;
  elements.letterSpacing.value = state.letterSpacing;
  elements.bodyFontSize.value = state.bodyFontSize;
  elements.bodyOffsetX.value = state.bodyOffsetX;
  elements.bodyOffsetY.value = state.bodyOffsetY;
}

function render() {
  state.bodyFontSize = normalizeBodyFontSize(state.bodyFontSize);
  elements.previewMonth.textContent = state.month;
  elements.previewDay.textContent = state.day;
  elements.previewWeekday.textContent = state.weekday;
  elements.previewText.replaceChildren(...parseBody(state.body));
  elements.previewText.style.setProperty("--preview-opacity", Number(state.opacity) / 100);
  elements.previewText.style.setProperty("--preview-weight", state.fontWeight);
  elements.previewText.style.setProperty("--preview-spacing", `${state.letterSpacing}px`);
  elements.previewText.style.setProperty("--body-offset-x", `${state.bodyOffsetX}mm`);
  elements.previewText.style.setProperty("--body-offset-y", `${state.bodyOffsetY}mm`);
  elements.previewText.style.setProperty("--body-font-size", `${state.bodyFontSize}px`);
  elements.printPage.style.setProperty("--body-font-size", `${state.bodyFontSize}px`);
  elements.printPage.style.setProperty("--body-columns", String(getBodyColumnCount(state.bodyFontSize)));
  elements.bodyFontSize.value = state.bodyFontSize;
  elements.bodyFontSizeValue.textContent = formatBodyFontSize(state.bodyFontSize);
  renderCircleTemplates();
  renderNumberButtons();
  renderPhraseButtons();
  renderTextTemplates();
  scheduleOverflowCheck();
  saveState();
}

function scheduleOverflowCheck() {
  if (overflowCheckFrame) {
    cancelAnimationFrame(overflowCheckFrame);
  }

  overflowCheckFrame = requestAnimationFrame(() => {
    overflowCheckFrame = 0;
    updateOverflowWarning();
  });
}

function updateOverflowWarning() {
  if (!elements.previewText.textContent.trim()) {
    elements.bodyOverflowWarning.hidden = true;
    return;
  }

  const measurePage = elements.printPage.cloneNode(true);
  measurePage.classList.add("print-measure-page");
  measurePage.removeAttribute("id");
  document.body.append(measurePage);

  try {
    const measureText = measurePage.querySelector(".preview-text");
    elements.bodyOverflowWarning.hidden = !measureText || !hasTextOverflow(measureText);
  } finally {
    measurePage.remove();
  }
}

function hasTextOverflow(element) {
  if (!element.textContent.trim()) {
    return false;
  }

  const epsilon = 1;
  if (element.scrollWidth > element.clientWidth + epsilon || element.scrollHeight > element.clientHeight + epsilon) {
    return true;
  }

  const elementRect = element.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(element);
  return [...range.getClientRects()]
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .some((rect) => (
      rect.left < elementRect.left - epsilon
      || rect.right > elementRect.right + epsilon
      || rect.top < elementRect.top - epsilon
      || rect.bottom > elementRect.bottom + epsilon
    ));
}

function parseBody(text) {
  const nodes = [];
  const tokenPattern = /\[(丸|四角):([^\]]{1,2})\]/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    appendPlainText(nodes, text.slice(lastIndex, match.index));
    const span = document.createElement("span");
    span.className = match[1] === "丸" ? "circled-char" : "square-number";
    span.textContent = match[2];
    nodes.push(span);
    lastIndex = tokenPattern.lastIndex;
  }

  appendPlainText(nodes, text.slice(lastIndex));
  return nodes.length ? nodes : [document.createTextNode("")];
}

function appendPlainText(nodes, text) {
  if (!text) {
    return;
  }
  nodes.push(document.createTextNode(text));
}

function renderCircleTemplates() {
  state.circleTemplates = normalizeCircleTemplates(state.circleTemplates);
  elements.circleTemplateList.replaceChildren();
  state.circleTemplates.forEach((template) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.dataset.id = template.id;

    const action = document.createElement("button");
    action.className = "chip-action";
    action.type = "button";

    const label = document.createElement("span");
    label.textContent = template.name;
    action.append(label);
    action.addEventListener("click", () => insertAtCursor(template.token));
    chip.append(action);

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.ariaLabel = `${template.name}を削除`;
    remove.addEventListener("click", () => {
      state.circleTemplates = state.circleTemplates.filter((item) => item.id !== template.id);
      render();
    });

    chip.append(remove);
    elements.circleTemplateList.append(chip);
  });
}

function renderNumberButtons() {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  elements.circledNumberList.replaceChildren();

  circledNumbers.forEach((number) => {
    const button = document.createElement("button");
    button.className = "symbol-button";
    button.type = "button";
    button.textContent = number;
    button.addEventListener("click", () => insertAtCursor(number));
    elements.circledNumberList.append(button);
  });
}

function renderPhraseButtons() {
  elements.phraseList.replaceChildren();

  state.phraseTemplates.forEach((phrase) => {
    const chip = document.createElement("div");
    chip.className = "phrase-chip";

    const action = document.createElement("button");
    action.className = "phrase-button";
    action.type = "button";
    action.textContent = phrase.text;
    action.addEventListener("click", () => insertAtCursor(phrase.text));
    chip.append(action);

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.ariaLabel = `${phrase.text}を削除`;
    remove.addEventListener("click", () => {
      state.phraseTemplates = state.phraseTemplates.filter((item) => item.id !== phrase.id);
      render();
    });
    chip.append(remove);

    elements.phraseList.append(chip);
  });
}

function renderTextTemplates() {
  elements.textTemplateList.replaceChildren();

  if (!state.textTemplates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "未保存";
    elements.textTemplateList.append(empty);
    return;
  }

  state.textTemplates.forEach((template) => {
    const chip = document.createElement("div");
    chip.className = "template-chip";

    const action = document.createElement("button");
    action.className = "chip-action";
    action.type = "button";

    const label = document.createElement("span");
    label.textContent = template.name;
    action.append(label);
    action.addEventListener("click", () => {
      state.body = template.body;
      elements.body.value = state.body;
      render();
    });
    chip.append(action);

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.ariaLabel = `${template.name}を削除`;
    remove.addEventListener("click", () => {
      state.textTemplates = state.textTemplates.filter((item) => item.id !== template.id);
      render();
    });

    chip.append(remove);
    elements.textTemplateList.append(chip);
  });
}

function insertAtCursor(text) {
  const input = elements.body;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);

  input.value = `${before}${text}${after}`;
  input.focus();
  input.selectionStart = start + text.length;
  input.selectionEnd = start + text.length;
  state.body = input.value;
  render();
}

function makeCircleToken(characters) {
  const clean = characters.trim();
  if (!clean) {
    return "";
  }
  return `[丸:${Array.from(clean).slice(0, 2).join("")}]`;
}

function makeSquareNumberToken(value) {
  const clean = String(value).replace(/\D/g, "").slice(0, 2);
  if (!clean) {
    return "";
  }
  return `[四角:${clean}]`;
}

function circledNumber(value) {
  const number = Number.parseInt(value, 10);
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  return circledNumbers[number - 1] || "";
}

function addCircleTemplate() {
  const token = makeCircleToken(elements.circleChar.value);
  if (!token) {
    return;
  }

  const displayChar = token.match(/\[丸:([^\]]+)\]/)?.[1] || elements.circleChar.value.trim();
  const name = elements.circleTemplateName.value.trim() || `${displayChar}○`;
  state.circleTemplates = [
    ...state.circleTemplates.filter((item) => item.name !== name),
    { id: makeId("circle"), name, token },
  ];
  elements.circleTemplateName.value = "";
  render();
}

function insertSquareNumber() {
  const token = makeSquareNumberToken(elements.squareNumber.value);
  if (token) {
    insertAtCursor(token);
  }
}

function insertRange() {
  const start = circledNumber(elements.rangeStart.value);
  const end = circledNumber(elements.rangeEnd.value);
  if (start && end) {
    insertAtCursor(`${start}～${end}`);
  }
}

function exportTemplates() {
  const exportData = {
    version: TEMPLATE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    circleTemplates: state.circleTemplates,
    phraseTemplates: state.phraseTemplates,
    textTemplates: state.textTemplates,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "renrakucho-templates.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setTemplateStatus("テンプレートを書き出しました。");
}

function importTemplates(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.circleTemplates) || !Array.isArray(data.textTemplates)) {
        throw new Error("invalid template file");
      }

      state.circleTemplates = normalizeCircleTemplates(data.circleTemplates);
      state.phraseTemplates = normalizePhraseTemplates(
        Array.isArray(data.phraseTemplates) ? data.phraseTemplates : cloneDefaultState().phraseTemplates,
      );
      state.textTemplates = normalizeTextTemplates(data.textTemplates);
      render();
      setTemplateStatus("テンプレートを読み込みました。");
    } catch {
      setTemplateStatus("読み込みできませんでした。ファイルを確認してください。");
    } finally {
      elements.importTemplates.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeCircleTemplates(templates) {
  const defaultsById = new Map(cloneDefaultState().circleTemplates.map((template) => [template.id, template]));
  return templates
    .filter((template) => template && typeof template.name === "string")
    .map((template) => {
      const fallback = defaultsById.get(template.id);
      const rawToken = typeof template.token === "string" ? template.token : "";
      const token = /^\[丸:[^\]]{1,2}\]$/.test(rawToken)
        ? rawToken
        : fallback?.token || makeCircleToken(template.name.replace("○", ""));
      return {
        id: template.id || makeId("circle"),
        name: template.name.slice(0, 40),
        token,
      };
    });
}

function normalizePhraseTemplates(templates) {
  return templates
    .filter((template) => {
      if (typeof template === "string") {
        return template.trim();
      }
      return template && typeof template.text === "string" && template.text.trim();
    })
    .map((template) => {
      const text = typeof template === "string" ? template : template.text;
      return {
        id: template.id || makeId("phrase"),
        text: text.trim().slice(0, 30),
      };
    });
}

function normalizeTextTemplates(templates) {
  return templates
    .filter((template) => template && typeof template.name === "string" && typeof template.body === "string")
    .map((template) => ({
      id: template.id || makeId("text"),
      name: template.name.slice(0, 40),
      body: template.body,
    }));
}

function setTemplateStatus(message) {
  elements.templateImportStatus.textContent = message;
}

function addTextTemplate() {
  const name = elements.textTemplateName.value.trim();
  const body = elements.body.value;
  if (!name || !body.trim()) {
    return;
  }

  state.textTemplates = [
    ...state.textTemplates.filter((item) => item.name !== name),
    { id: makeId("text"), name, body },
  ];
  elements.textTemplateName.value = "";
  render();
}

function addPhraseTemplate() {
  const text = elements.phraseTemplateInput.value.trim();
  if (!text) {
    return;
  }

  state.phraseTemplates = [
    ...state.phraseTemplates.filter((item) => item.text !== text),
    { id: makeId("phrase"), text },
  ];
  elements.phraseTemplateInput.value = "";
  render();
}

function bindInputs() {
  [
    ["month", "month"],
    ["day", "day"],
    ["weekday", "weekday"],
    ["body", "body"],
    ["opacity", "opacity"],
    ["fontWeight", "fontWeight"],
    ["letterSpacing", "letterSpacing"],
    ["bodyFontSize", "bodyFontSize"],
    ["bodyOffsetX", "bodyOffsetX"],
    ["bodyOffsetY", "bodyOffsetY"],
  ].forEach(([key, elementKey]) => {
    elements[elementKey].addEventListener("input", (event) => {
      state[key] = event.target.value;
      render();
    });
  });

  elements.insertCircle.addEventListener("click", () => {
    const token = makeCircleToken(elements.circleChar.value);
    if (token) {
      insertAtCursor(token);
    }
  });

  elements.saveCircleTemplate.addEventListener("click", addCircleTemplate);
  elements.insertSquareNumber.addEventListener("click", insertSquareNumber);
  elements.insertRange.addEventListener("click", insertRange);
  elements.resetBodyPosition.addEventListener("click", () => {
    state.bodyOffsetX = 0;
    state.bodyOffsetY = 0;
    syncInputs();
    render();
  });
  elements.saveTextTemplate.addEventListener("click", addTextTemplate);
  elements.savePhraseTemplate.addEventListener("click", addPhraseTemplate);
  elements.phraseTemplateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPhraseTemplate();
    }
  });
  elements.exportTemplates.addEventListener("click", exportTemplates);
  elements.importTemplates.addEventListener("change", importTemplates);
  elements.printButton.addEventListener("click", () => window.print());
}

window.addEventListener("resize", scheduleOverflowCheck);
window.addEventListener("beforeprint", scheduleOverflowCheck);
window.addEventListener("afterprint", scheduleOverflowCheck);
if (globalThis.ResizeObserver) {
  const layoutObserver = new ResizeObserver(scheduleOverflowCheck);
  layoutObserver.observe(elements.printPage);
}

syncInputs();
bindInputs();
render();
