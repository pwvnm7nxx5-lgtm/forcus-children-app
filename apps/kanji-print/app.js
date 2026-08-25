const els = {
  sourceText: document.querySelector("#sourceText"),
  markGuideTextBtn: document.querySelector("#markGuideTextBtn"),
  addReadings: document.querySelector("#addReadings"),
  readingPanel: document.querySelector("#readingPanel"),
  extractReadingsBtn: document.querySelector("#extractReadingsBtn"),
  readingProgress: document.querySelector("#readingProgress"),
  readingStatusText: document.querySelector("#readingStatusText"),
  annotationSummary: document.querySelector("#annotationSummary"),
  readingAnnotations: document.querySelector("#readingAnnotations"),
  clearReadingCorrectionsBtn: document.querySelector("#clearReadingCorrectionsBtn"),
  rubyFontSize: document.querySelector("#rubyFontSize"),
  rubyOpacity: document.querySelector("#rubyOpacity"),
  rubySpacing: document.querySelector("#rubySpacing"),
  studentName: document.querySelector("#studentName"),
  worksheetDate: document.querySelector("#worksheetDate"),
  cols: document.querySelector("#cols"),
  rows: document.querySelector("#rows"),
  sheetCount: document.querySelector("#sheetCount"),
  punchGuide: document.querySelector("#punchGuide"),
  fontSize: document.querySelector("#fontSize"),
  smallFontSize: document.querySelector("#smallFontSize"),
  punctuationScale: document.querySelector("#punctuationScale"),
  fontFamily: document.querySelector("#fontFamily"),
  fontWeight: document.querySelector("#fontWeight"),
  letterSpacing: document.querySelector("#letterSpacing"),
  opacity: document.querySelector("#opacity"),
  stripSpaces: document.querySelector("#stripSpaces"),
  spaceAsBlank: document.querySelector("#spaceAsBlank"),
  autoKanjiBlank: document.querySelector("#autoKanjiBlank"),
  blankKanji: document.querySelector("#blankKanji"),
  autoNonKanjiBlank: document.querySelector("#autoNonKanjiBlank"),
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
const readingState = {
  annotations: [],
  sourceText: "",
  status: "idle",
  error: "",
  enginePromise: null,
};
const readingModeFocusState = {
  annotationId: null,
  returnDescriptor: null,
};
const readingAlignment = window.KANJI_READING_ALIGNMENT;
const readingWordMap = window.KANJI_READING_WORD_MAP;
const readingDictionaryApi = window.KANJI_READING_DICTIONARY;
const readingCorrectionsApi = window.KANJI_READING_CORRECTIONS;
const readingLookupApi = window.KANJI_READING_LOOKUP;
const readingLayoutApi = window.KANJI_READING_LAYOUT;
const readingKeyboard = window.KANJI_READING_KEYBOARD;
const readingInputState = window.KANJI_READING_INPUT_STATE;
let readingDictionary = null;
let readingDictionaryInitError = null;
try {
  readingDictionary = readingDictionaryApi?.createRuntimeDictionary() || null;
} catch (error) {
  readingDictionaryInitError = error;
}
const readingCorrections = readingCorrectionsApi?.createStore();
const readingLookup = readingLookupApi?.createExactLookup({
  corrections: readingCorrections,
  overrides: readingWordMap,
  generated: readingDictionary,
  isReviewSurface: readingWordMap?.isReviewWordSurface,
});
window.__KANJI_READING_DICTIONARY_RUNTIME = readingDictionary;
window.__KANJI_READING_CORRECTIONS_RUNTIME = readingCorrections;
const fontStacks = {
  kyokasho: '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "BIZ UDPGothic", "Yu Gothic", sans-serif',
  kyokashoBold: '"UD Digi Kyokasho N-B", "UD デジタル 教科書体 N-B", "BIZ UDPGothic", "Yu Gothic", sans-serif',
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

function getTraceFontStack(weightStyle = normalizeFontWeight()) {
  if (els.fontFamily.value === "kyokasho" && weightStyle.value === "bold") {
    return fontStacks.kyokashoBold;
  }
  return fontStacks[els.fontFamily.value] || fontStacks.kyokasho;
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  els.status.textContent = message;
  statusTimer = window.setTimeout(() => {
    els.status.textContent = "";
  }, 2800);
}

function setReadingStatus(message, status = "idle") {
  readingState.status = status;
  readingState.error = status === "error" ? message : "";
  if (els.readingStatusText) {
    els.readingStatusText.textContent = message;
  }
}

function toHiragana(text) {
  return readingAlignment.toHiragana(text);
}

function getReadingCandidates(char) {
  const candidates = window.KANJI_READING_CANDIDATES?.[char] || [];
  return [...new Set(candidates.map(toHiragana).filter(Boolean))];
}

function getReadingExactMatch(surface, reading) {
  return readingLookup?.lookup(surface, reading) || null;
}

function getReadingExactPieces(surface, reading) {
  return getReadingExactMatch(surface, reading)?.pieces || null;
}

function splitReadingByCandidates(surface, reading) {
  return readingAlignment.splitReadingByCandidates(
    surface,
    reading,
    getReadingCandidates,
    getReadingExactPieces,
  );
}

function makeReadingAnnotations(surface, reading, sourceIndices, options = {}) {
  const exactWordReading = Array.isArray(options.exactPieces)
    ? () => options.exactPieces
    : getReadingExactPieces;
  return readingAlignment.alignSurfaceReading(surface, reading, {
    sourceIndices,
    getCandidates: getReadingCandidates,
    getExactWordReading: exactWordReading,
    ...options,
  });
}

function getReadingInputUnits(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  return parseMarkedCharacters(normalized).map((entry, inputIndex) => ({
    ...entry,
    inputIndex: entry.sourceIndex ?? inputIndex,
  }));
}

async function loadReadingEngine(onProgress = () => {}) {
  if (readingState.enginePromise) {
    return readingState.enginePromise;
  }

  readingState.enginePromise = (async () => {
    onProgress("読み仮名辞書を読み込んでいます…", 10);
    const KuroshiroConstructor = window.Kuroshiro?.default || window.Kuroshiro;
    if (typeof KuroshiroConstructor !== "function" || typeof window.KuromojiAnalyzer !== "function") {
      throw new Error("読み仮名辞書のスクリプトを読み込めませんでした。");
    }

    const analyzer = new window.KuromojiAnalyzer({ dictPath: "vendor/dict/" });
    const kuroshiro = new KuroshiroConstructor();
    onProgress("読み仮名辞書を準備しています…", 35);
    await kuroshiro.init(analyzer);
    onProgress("読み仮名辞書の準備ができました。", 60);
    return { analyzer, kuroshiro };
  })();

  try {
    return await readingState.enginePromise;
  } catch (error) {
    readingState.enginePromise = null;
    throw error;
  }
}

async function generateReadingAnnotations(sourceText, onProgress = () => {}) {
  const units = getReadingInputUnits(sourceText);
  const analysisText = units.map((entry) => entry.char).join("");
  if (!analysisText.trim()) {
    return { sourceText, annotations: [] };
  }

  const engine = await loadReadingEngine(onProgress);
  onProgress("本文を解析しています…", 70);
  const tokens = await engine.analyzer.parse(analysisText);
  let dictionaryWarning = "";
  const dictionaryFallbackMessage = "単語辞書を使えないため、候補読みで続けています。";
  if (readingDictionaryInitError) {
    dictionaryWarning = dictionaryFallbackMessage;
    onProgress(dictionaryFallbackMessage, 72);
  }
  if (readingDictionary) {
    onProgress("単語の読み分け辞書を読み込んでいます…", 72);
    try {
      const dictionaryPreparation = await readingDictionary.prepareForTokens(tokens);
      if (dictionaryPreparation?.available === false) {
        dictionaryWarning = dictionaryFallbackMessage;
        onProgress(dictionaryFallbackMessage, 72);
      }
    } catch {
      dictionaryWarning = dictionaryFallbackMessage;
      onProgress(dictionaryFallbackMessage, 72);
    }
  }
  const annotations = [];

  const tokenAlignment = readingAlignment.alignTokenPositions(units, tokens);
  let dictionaryMatches = [];
  if (readingDictionary && !dictionaryWarning) {
    try {
      dictionaryMatches = readingDictionary.findExactSurfaceMatches(analysisText, {
        tokenSpans: tokenAlignment.items
          .filter((item) => item.type === "token")
          .map((item) => ({
            start: item.start,
            end: item.end,
            pos: item.token?.pos,
          })),
      });
    } catch {
      dictionaryWarning = dictionaryFallbackMessage;
    }
  }
  const alignedTokenItems = readingAlignment.insertExactSurfaceMatches(
    tokenAlignment.items,
    units,
    dictionaryMatches,
  );
  const readingItems = readingAlignment.mergeReadingTokenItems(
    alignedTokenItems,
    (surface, reading) => {
      const exactMatch = getReadingExactMatch(surface, reading);
      if (exactMatch) {
        return { kind: exactMatch.forceReview ? "review" : "exact" };
      }
      return null;
    },
  );
  for (const item of readingItems) {
    if (item.type === "fallback") {
      annotations.push(...item.annotations);
      continue;
    }

    const { token, surface, start: tokenStart, end: tokenEnd } = item;
    if (!Array.from(surface).some(isKanji)) {
      continue;
    }

    const dictionaryMatch = item.dictionaryMatch || token.dictionaryMatch || null;
    const sourceReading = dictionaryMatch?.reading || token.reading || "";
    const exactMatch = getReadingExactMatch(surface, sourceReading);
    let reading = toHiragana(
      exactMatch?.source === "learned" ? exactMatch.reading : sourceReading,
    );
    if (!reading || reading === surface) {
      reading = toHiragana(await engine.kuroshiro.convert(surface, {
        to: "hiragana",
        mode: "normal",
      }));
    }

    const resolvedExactMatch = getReadingExactMatch(surface, reading);
    const matchForAnnotation = exactMatch || resolvedExactMatch;

    const sourceIndices = units
      .slice(tokenStart, tokenEnd)
      .map((entry) => entry.inputIndex);
    annotations.push(...makeReadingAnnotations(
      surface,
      reading,
      sourceIndices,
      (item.readingKind === "review" || matchForAnnotation?.forceReview)
        ? {
          exactPieces: matchForAnnotation?.source === "learned" ? matchForAnnotation.pieces : null,
          forceReview: true,
          reviewReason: matchForAnnotation?.source === "learned" ? "learned-review" : "word-review",
        }
        : matchForAnnotation?.source === "learned"
          ? { exactPieces: matchForAnnotation.pieces }
          : {},
    ));
  }

  annotations.forEach((annotation) => {
    if (!annotation.correctionReading) {
      annotation.correctionReading = annotation.reading;
    }
  });
  onProgress("読み仮名を作りました。", 100);
  return { sourceText, annotations, warning: dictionaryWarning };
}

function normalizeText(text, cols, rows) {
  let source = text.replace(/\r\n?/g, "\n");
  const stripSpaces = !els.spaceAsBlank.checked
    && !els.autoNonKanjiBlank.checked
    && els.stripSpaces.checked;

  const cells = [];
  let position = 0;
  let columnStart = 0;

  function pushCell(char, practice = false, guide = false, sourceIndex = null, originalChar = char) {
    cells.push({ char, originalChar, practice, guide, sourceIndex });
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

    const columnKanji = getUniqueKanji(cells
      .slice(columnStart, position)
      .filter((cell) => !cell.guide)
      .map((cell) => cell.char)
      .join(""));
    const blanksToBottom = rows - remainder;
    const bottomBlanks = clampNumber(els.extraBlankCount.value, 0, rows - 1, 2);
    const practiceSlots = Math.max(0, blanksToBottom - bottomBlanks);

    for (let index = 0; index < practiceSlots; index += 1) {
      pushCell(columnKanji.length ? columnKanji[index % columnKanji.length] : "", true);
    }

    fillColumnWithBlanks(true);
  }

  let previousWasLineBreak = false;
  for (const { char, guide, sourceIndex } of parseMarkedCharacters(source)) {
    if (char === "\n") {
      if (els.lineBreakColumn.checked && !previousWasLineBreak) {
        fillColumnWithBlanks();
      }
      previousWasLineBreak = true;
      continue;
    }
    previousWasLineBreak = false;

    if (stripSpaces && /[ \t\u3000]/u.test(char)) {
      continue;
    }

    const isBlankSpace = els.spaceAsBlank.checked && /[ \t\u3000]/u.test(char);
    const isAutoKanjiBlank = shouldBlankKanji(char);
    const isAutoNonKanjiBlank = els.autoNonKanjiBlank.checked && !isKanji(char) && !isNumber(char);
    pushCell(
      isBlankSpace || isAutoKanjiBlank || isAutoNonKanjiBlank ? "" : char,
      false,
      guide,
      sourceIndex,
      char,
    );
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

function parseMarkedCharacters(source) {
  const characters = [];
  let index = 0;
  let closingMarker = "";

  while (index < source.length) {
    if (!closingMarker && source[index] === "'" && source.indexOf("'", index + 1) !== -1) {
      closingMarker = "'";
      index += 1;
      continue;
    }
    if (!closingMarker && source.startsWith("[[", index) && source.indexOf("]]", index + 2) !== -1) {
      closingMarker = "]]";
      index += 2;
      continue;
    }
    if (closingMarker && source.startsWith(closingMarker, index)) {
      index += closingMarker.length;
      closingMarker = "";
      continue;
    }

    const codePoint = source.codePointAt(index);
    const char = String.fromCodePoint(codePoint);
    characters.push({ char, guide: Boolean(closingMarker), sourceIndex: index });
    index += char.length;
  }

  return characters;
}

function isKanji(char) {
  return /[\u3400-\u9fff々]/u.test(char);
}

function isNumber(char) {
  return /\p{Number}/u.test(char);
}

function shouldBlankKanji(char) {
  if (!els.autoKanjiBlank.checked || !isKanji(char)) {
    return false;
  }

  const targetText = els.blankKanji.value.trim();
  if (!targetText) {
    return true;
  }

  const targets = Array.from(targetText).filter(isKanji);
  return targets.includes(char);
}

function syncAutoKanjiBlank() {
  els.blankKanji.disabled = !els.autoKanjiBlank.checked;
}

function getUniqueKanji(text) {
  return [...new Set(Array.from(text).filter(isKanji))];
}

function isSentenceEndChar(char) {
  return ["\u3002", "\uff0e", ".", "\uff01", "!", "\uff1f", "?"].includes(char);
}

function getActiveReadingAnnotations() {
  if (!els.addReadings.checked || readingState.sourceText !== els.sourceText.value) {
    return [];
  }
  return Array.isArray(readingState.annotations) ? readingState.annotations : [];
}

function getAnnotationSourceIndices(annotation) {
  const length = Array.from(annotation.surface).length;
  const stored = Array.isArray(annotation.sourceIndices)
    ? annotation.sourceIndices.map((value) => Number(value))
    : [];
  if (stored.length === length && stored.every((value) => Number.isFinite(value))) {
    return stored;
  }
  return Array.from({ length }, (_, index) => annotation.sourceStart + index);
}

function makeSplitPieces(annotation) {
  const sourceIndices = getAnnotationSourceIndices(annotation);
  const pieces = splitReadingByCandidates(annotation.surface, annotation.reading);
  if (!pieces) {
    return Array.from(annotation.surface).map((surface, index) => ({
      surface,
      reading: "",
      sourceStart: sourceIndices[index],
      sourceEnd: sourceIndices[index] + 1,
    }));
  }

  const splitPieces = [];
  let surfaceIndex = 0;
  for (const piece of pieces) {
    const pieceChars = Array.from(piece.surface);
    if (pieceChars.length === 1) {
      splitPieces.push({
        ...piece,
        sourceIndices: sourceIndices.slice(surfaceIndex, surfaceIndex + 1),
        sourceStart: sourceIndices[surfaceIndex],
        sourceEnd: sourceIndices[surfaceIndex] + 1,
      });
    } else {
      pieceChars.forEach((surface, offset) => {
        splitPieces.push({
          surface,
          reading: "",
          sourceIndices: sourceIndices.slice(surfaceIndex + offset, surfaceIndex + offset + 1),
          sourceStart: sourceIndices[surfaceIndex + offset],
          sourceEnd: sourceIndices[surfaceIndex + offset] + 1,
        });
      });
    }
    surfaceIndex += pieceChars.length;
  }
  return splitPieces;
}

function normalizeReadingAnnotation(entry, index) {
  const annotation = {
    id: String(entry?.id || `reading-${index}`),
    surface: String(entry?.surface || ""),
    reading: toHiragana(String(entry?.reading || "")),
    mode: entry?.mode === "split" ? "split" : "group",
    pieces: Array.isArray(entry?.pieces) ? entry.pieces.map((piece) => ({
      surface: String(piece?.surface || ""),
      reading: toHiragana(String(piece?.reading || "")),
      sourceStart: Number(piece?.sourceStart),
      sourceEnd: Number(piece?.sourceEnd),
    })) : [],
    sourceIndices: Array.isArray(entry?.sourceIndices)
      ? entry.sourceIndices.map((value) => Number(value))
      : [],
    sourceStart: Number(entry?.sourceStart),
    sourceEnd: Number(entry?.sourceEnd),
    correctionReading: toHiragana(String(entry?.correctionReading || entry?.reading || "")),
    needsReview: Boolean(entry?.needsReview),
    manual: Boolean(entry?.manual),
    reviewReason: String(entry?.reviewReason || ""),
  };
  if (!Number.isFinite(annotation.sourceStart)) annotation.sourceStart = 0;
  if (!Number.isFinite(annotation.sourceEnd)) annotation.sourceEnd = annotation.sourceStart + Array.from(annotation.surface).length;
  annotation.sourceIndices = getAnnotationSourceIndices(annotation);
  if (annotation.mode === "split" && !annotation.pieces.length) {
    annotation.pieces = makeSplitPieces(annotation);
  }
  if (!annotation.correctionReading) {
    annotation.correctionReading = annotation.reading;
  }
  return annotation;
}

function isMixedReadingSurface(surface) {
  const chars = Array.from(surface);
  return chars.some(isKanji) && chars.some((char) => readingAlignment.isKana(char));
}

function normalizeReadingAnnotations(entries) {
  return entries.flatMap((entry, index) => {
    const annotation = normalizeReadingAnnotation(entry, index);
    if (!annotation.manual && isMixedReadingSurface(annotation.surface)) {
      const migrated = makeReadingAnnotations(
        annotation.surface,
        annotation.reading,
        getAnnotationSourceIndices(annotation),
      );
      if (migrated.length) {
        return migrated;
      }
    }
    return [annotation];
  });
}

function getReadingFocusSequence() {
  return readingKeyboard.getReadingFocusSequence(readingState.annotations);
}

function getReadingInputDescriptor(input) {
  const row = input?.closest(".annotation-row");
  if (!row?.dataset.annotationId) {
    return null;
  }
  const role = input.dataset.readingRole === "piece" ? "piece" : "word";
  return {
    annotationId: row.dataset.annotationId,
    role,
    pieceIndex: role === "piece" ? Number(input.dataset.pieceIndex) : -1,
  };
}

function getAdjacentReadingFocus(descriptor, direction) {
  return readingKeyboard.getAdjacentReadingFocus(
    readingState.annotations,
    descriptor,
    direction,
  );
}

function findReadingInput(descriptor) {
  const rows = Array.from(els.readingAnnotations?.querySelectorAll(".annotation-row") || []);
  const row = rows.find((entry) => entry.dataset.annotationId === descriptor.annotationId);
  if (!row) {
    return null;
  }
  if (descriptor.role === "piece") {
    return row.querySelector(`input[data-reading-role="piece"][data-piece-index="${descriptor.pieceIndex}"]`);
  }
  return row.querySelector('input[data-reading-role="word"]');
}

function commitReadingInput(input) {
  const descriptor = getReadingInputDescriptor(input);
  if (!descriptor) {
    return false;
  }
  const annotation = readingState.annotations.find((entry) => entry.id === descriptor.annotationId);
  if (!annotation) {
    return false;
  }

  const changed = readingInputState.applyReadingInputValue(
    annotation,
    descriptor,
    input.value,
    toHiragana,
  );
  if (!changed) {
    return false;
  }

  if (descriptor.role === "piece") {
    annotation.needsReview = annotation.pieces.some((entry) => !entry.reading);
  } else {
    if (annotation.mode === "split") {
      annotation.pieces = makeSplitPieces(annotation);
      annotation.needsReview = annotation.pieces.some((entry) => !entry.reading);
    } else {
      annotation.needsReview = false;
    }
  }
  readingCorrections?.record(annotation, annotation.correctionReading || annotation.reading);
  return true;
}

function handleReadingInputChange(input) {
  if (commitReadingInput(input)) {
    render();
  }
}

function focusReadingInput(descriptor) {
  const input = findReadingInput(descriptor);
  if (!input) {
    return;
  }
  input.focus({ preventScroll: true });
  input.select();
  input.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function getModeButtons(row) {
  return Array.from(row?.querySelectorAll(".annotation-mode button") || []);
}

function focusReadingModeButton(annotationId, modeValue = "") {
  const rows = Array.from(els.readingAnnotations?.querySelectorAll(".annotation-row") || []);
  const row = rows.find((entry) => entry.dataset.annotationId === annotationId);
  const buttons = getModeButtons(row);
  const button = buttons.find((entry) => entry.dataset.modeValue === modeValue)
    || buttons.find((entry) => entry.classList.contains("active"))
    || buttons[0];
  if (!button) {
    return false;
  }
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function getReadingModeReturnDescriptor() {
  const descriptor = readingModeFocusState.returnDescriptor;
  if (!descriptor) {
    return null;
  }
  if (findReadingInput(descriptor)) {
    return descriptor;
  }
  return {
    annotationId: descriptor.annotationId,
    role: "word",
    pieceIndex: -1,
  };
}

function clearReadingModeFocusState() {
  readingModeFocusState.annotationId = null;
  readingModeFocusState.returnDescriptor = null;
}

function enterReadingModeControls(input) {
  const descriptor = getReadingInputDescriptor(input);
  const row = input?.closest(".annotation-row");
  const buttons = getModeButtons(row);
  const annotation = readingState.annotations.find((entry) => entry.id === descriptor?.annotationId);
  const activeButton = buttons.find((button) => button.classList.contains("active"))
    || buttons[0];
  if (!descriptor || !annotation || !activeButton) {
    return;
  }

  const changed = commitReadingInput(input);
  readingModeFocusState.annotationId = descriptor.annotationId;
  readingModeFocusState.returnDescriptor = descriptor;
  if (changed) {
    render();
    focusReadingModeButton(descriptor.annotationId, annotation.mode);
    return;
  }
  activeButton.focus({ preventScroll: true });
  activeButton.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function returnFromReadingModeControls() {
  const descriptor = getReadingModeReturnDescriptor();
  clearReadingModeFocusState();
  if (descriptor) {
    focusReadingInput(descriptor);
  }
}

function handleReadingModeKeydown(event) {
  const action = readingKeyboard.getModeKeyAction(event.key, event.shiftKey);
  if (!action) {
    return;
  }

  const button = event.currentTarget;
  const row = button.closest(".annotation-row");
  const buttons = getModeButtons(row);
  if (!buttons.length) {
    return;
  }

  if (action.type === "move") {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const currentIndex = buttons.indexOf(button);
    const targetIndex = readingKeyboard.getModeButtonIndex(
      currentIndex,
      action.direction,
      buttons.length,
    );
    const target = buttons[targetIndex];
    if (!target) {
      return;
    }
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  if (action.type === "return") {
    event.preventDefault();
    returnFromReadingModeControls();
    return;
  }

  if (action.type === "activate") {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    button.click();
    return;
  }

  if (action.type === "reading") {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const descriptor = getReadingModeReturnDescriptor();
    const target = descriptor
      ? getAdjacentReadingFocus(descriptor, action.direction)
      : null;
    if (!target) {
      return;
    }
    event.preventDefault();
    clearReadingModeFocusState();
    focusReadingInput(target);
  }
}

function handleReadingInputKeydown(event) {
  if (event.isComposing || event.ctrlKey || event.metaKey) {
    return;
  }

  if (
    (event.key === "ArrowDown" && event.altKey)
    || (event.key === "F2" && !event.altKey && !event.shiftKey)
  ) {
    event.preventDefault();
    enterReadingModeControls(event.currentTarget);
    return;
  }

  if (
    !["Tab", "Enter"].includes(event.key)
    || event.altKey
  ) {
    return;
  }

  const descriptor = getReadingInputDescriptor(event.currentTarget);
  if (!descriptor) {
    return;
  }
  const target = getAdjacentReadingFocus(descriptor, event.shiftKey ? -1 : 1);
  if (!target) {
    commitReadingInput(event.currentTarget);
    saveState();
    return;
  }

  event.preventDefault();
  clearReadingModeFocusState();
  commitReadingInput(event.currentTarget);
  render();
  focusReadingInput(target);
}

function updateReadingAnnotation(id, update) {
  const annotation = readingState.annotations.find((entry) => entry.id === id);
  if (!annotation) {
    return;
  }
  Object.assign(annotation, update, { manual: true });
  if (annotation.mode === "split") {
    annotation.pieces = makeSplitPieces(annotation);
    annotation.needsReview = annotation.pieces.some((piece) => !piece.reading);
  }
  readingCorrections?.record(annotation, annotation.correctionReading || annotation.reading);
  render();
}

function renderReadingAnnotations() {
  if (!els.annotationSummary || !els.readingAnnotations) {
    return;
  }

  els.readingAnnotations.textContent = "";
  const annotations = Array.isArray(readingState.annotations) ? readingState.annotations : [];
  if (!els.addReadings.checked) {
    els.annotationSummary.textContent = "読み仮名を付けるを選ぶと、ここで読みを確認できます。";
    return;
  }
  if (readingState.sourceText && readingState.sourceText !== els.sourceText.value) {
    els.annotationSummary.textContent = "本文を変更しました。読み仮名を作り直してください。";
  } else if (!annotations.length) {
    els.annotationSummary.textContent = "「読み仮名を作る」を押すと、本文から読みを作成します。";
  } else {
    const reviewCount = annotations.filter((entry) => entry.needsReview).length;
    els.annotationSummary.textContent = reviewCount
      ? `${annotations.length}件の読みを作成しました。黄色の項目を確認してください。`
      : `${annotations.length}件の読みを作成しました。必要なら読み方を修正できます。`;
  }

  annotations.forEach((annotation, index) => {
    const row = document.createElement("div");
    row.className = "annotation-row";
    row.classList.toggle("needs-review", Boolean(annotation.needsReview));
    row.dataset.annotationId = annotation.id;

    const heading = document.createElement("div");
    heading.className = "annotation-heading";
    const number = document.createElement("span");
    number.className = "annotation-index";
    number.textContent = String(index + 1);
    const surface = document.createElement("strong");
    surface.className = "annotation-surface";
    surface.textContent = annotation.surface;
    heading.append(number, surface);

    const badge = document.createElement("span");
    badge.className = `annotation-badge${annotation.needsReview ? " review" : ""}`;
    badge.textContent = annotation.needsReview ? "要確認" : annotation.mode === "split" ? "分けて表示" : "まとめて表示";
    heading.append(badge);
    if (annotation.manual) {
      const manualBadge = document.createElement("span");
      manualBadge.className = "annotation-badge manual";
      manualBadge.textContent = "修正済み";
      heading.append(manualBadge);
    }

    const edit = document.createElement("div");
    edit.className = "annotation-edit";
    const readingLabel = document.createElement("label");
    readingLabel.className = "annotation-reading-label";
    readingLabel.append(document.createTextNode("読み"));
    const readingInput = document.createElement("input");
    readingInput.className = "annotation-reading-input";
    readingInput.dataset.readingRole = "word";
    readingInput.type = "text";
    readingInput.value = annotation.reading || "";
    readingInput.inputMode = "kana";
    readingInput.setAttribute("aria-describedby", "readingModeKeyboardHint");
    readingInput.setAttribute("aria-keyshortcuts", "Alt+ArrowDown F2");
    readingInput.setAttribute("aria-label", `${annotation.surface}の読み`);
    readingInput.addEventListener("change", () => {
      handleReadingInputChange(readingInput);
    });
    readingInput.addEventListener("keydown", handleReadingInputKeydown);
    readingLabel.append(readingInput);
    edit.append(readingLabel);

    const mode = document.createElement("div");
    mode.className = "annotation-mode";
    mode.setAttribute("role", "group");
    mode.setAttribute("aria-label", annotation.surface + "の表示方法");
    [
      ["split", "分ける"],
      ["group", "まとめる"],
    ].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.modeValue = value;
      button.tabIndex = -1;
      button.classList.toggle("active", annotation.mode === value);
      button.setAttribute("aria-pressed", String(annotation.mode === value));
      button.addEventListener("keydown", handleReadingModeKeydown);
      button.addEventListener("click", () => {
        const keepModeFocus = readingModeFocusState.annotationId === annotation.id;
        const pieces = value === "split" ? makeSplitPieces(annotation) : [];
        updateReadingAnnotation(annotation.id, {
          mode: value,
          pieces,
          needsReview: value === "split" && pieces.some((piece) => !piece.reading),
        });
        if (keepModeFocus) {
          focusReadingModeButton(annotation.id, value);
        }
      });
      mode.append(button);
    });
    edit.append(mode);
    row.append(heading, edit);

    if (annotation.mode === "split") {
      const pieces = document.createElement("div");
      pieces.className = "annotation-pieces";
      annotation.pieces.forEach((piece, pieceIndex) => {
        const label = document.createElement("label");
        label.className = "annotation-piece-label";
        label.append(document.createTextNode(piece.surface));
        const input = document.createElement("input");
        input.className = "annotation-piece-input";
        input.dataset.readingRole = "piece";
        input.dataset.pieceIndex = String(pieceIndex);
        input.type = "text";
        input.value = piece.reading || "";
        input.inputMode = "kana";
        input.setAttribute("aria-describedby", "readingModeKeyboardHint");
        input.setAttribute("aria-keyshortcuts", "Alt+ArrowDown F2");
        input.setAttribute("aria-label", `${piece.surface}の読み`);
        input.addEventListener("change", () => {
          handleReadingInputChange(input);
        });
        input.addEventListener("keydown", handleReadingInputKeydown);
        label.append(input);
        pieces.append(label);
      });
      row.append(pieces);
    }

    els.readingAnnotations.append(row);
  });
}

function buildPageReadingLayout(chars, annotations, rows, cols, direction) {
  const sourceCells = new Map();
  chars.forEach((cell, index) => {
    if (cell.sourceIndex === null || cell.sourceIndex === undefined) return;
    const col = Math.floor(index / rows);
    const row = index % rows;
    const visualCol = direction === "rtl" ? cols - 1 - col : col;
    sourceCells.set(cell.sourceIndex, { row, col: visualCol, cell });
  });

  const cellReadings = new Map();
  const groups = [];
  annotations.forEach((annotation) => {
    if (annotation.mode === "split") {
      annotation.pieces.forEach((piece) => {
        if (piece.reading) cellReadings.set(piece.sourceStart, piece.reading);
      });
      return;
    }

    const annotationSourceIndices = new Set(getAnnotationSourceIndices(annotation));
    const positions = [];
    for (const [sourceIndex, position] of sourceCells) {
      if (
        annotationSourceIndices.has(Number(sourceIndex))
        && (position.cell.originalChar || position.cell.char)
      ) {
        positions.push({ ...position, sourceIndex: Number(sourceIndex) });
      }
    }
    if (annotation.reading) {
      const fragments = readingLayoutApi.buildReadingFragments(positions);
      fragments.forEach((fragment) => {
        groups.push({ annotation, ...fragment });
      });
    }
  });

  return { cellReadings, groups };
}

function createGroupedRubyLayer(cols, rows, groups) {
  if (!groups.length) return null;
  const layer = document.createElement("div");
  layer.className = "ruby-group-layer";
  layer.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w) var(--ruby-w))`;
  layer.style.gridTemplateRows = `repeat(${rows}, var(--cell-h))`;
  groups.forEach(({ annotation, positions, row, col, span, orientation }) => {
    const physicalFragments = orientation === "horizontal"
      ? readingLayoutApi.buildReadingFragments(positions)
      : [{ row, col, span, orientation, positions }];
    physicalFragments.forEach((fragment) => {
      const group = document.createElement("div");
      group.className = "grouped-ruby-cell grouped-ruby-vertical";
      group.dataset.sourceIndices = fragment.positions
        ? fragment.positions.map((position) => position.sourceIndex).join(",")
        : "";
      group.style.gridColumn = String(fragment.col * 2 + 2);
      group.style.gridRow = `${fragment.row + 1} / span ${fragment.span}`;
      const text = document.createElement("span");
      text.className = "ruby-text";
      text.textContent = annotation.reading;
      group.append(text);
      layer.append(group);
    });
  });
  return layer;
}

function syncReadingPanel() {
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
  renderReadingAnnotations();
  syncAutoKanjiBlank();
  const cols = clampNumber(els.cols.value, 6, 14, 10);
  const rows = clampNumber(els.rows.value, 8, 20, 14);
  const fontSize = clampNumber(els.fontSize.value, 18, 72, 34);
  const smallFontSize = clampNumber(els.smallFontSize.value, 14, 56, 30);
  const punctuationScale = clampNumber(els.punctuationScale.value, 35, 90, 58);
  const weightStyle = normalizeFontWeight(els.fontWeight.value);
  const letterSpacing = clampNumber(els.letterSpacing.value, -2, 6, 0);
  const opacity = clampNumber(els.opacity.value, 8, 45, 24) / 100;
  const rubyFontSize = clampNumber(els.rubyFontSize.value, 5, 14, 7);
  const rubyOpacity = clampNumber(els.rubyOpacity.value, 20, 100, 80) / 100;
  const rubySpacing = clampNumber(els.rubySpacing.value, 0, 4, 0);
  const sheetCount = clampNumber(els.sheetCount.value, 1, 30, 1);
  const direction = getDirection();
  const pageData = normalizeText(els.sourceText.value, cols, rows);
  const activeAnnotations = getActiveReadingAnnotations();
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
  document.documentElement.style.setProperty("--trace-font-family", getTraceFontStack(weightStyle));
  document.documentElement.style.setProperty("--trace-font-weight", weightStyle.weight);
  document.documentElement.style.setProperty("--trace-weight-opacity", weightStyle.opacity);
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
    const cells = Array.from({ length: cols * rows }, () => ({
      char: "",
      originalChar: "",
      practice: false,
      guide: false,
      reading: "",
    }));
    const readingLayout = buildPageReadingLayout(chars, activeAnnotations, rows, cols, direction);
    chars.forEach((sourceCell, index) => {
      const col = Math.floor(index / rows);
      const row = index % rows;
      const visualCol = direction === "rtl" ? cols - 1 - col : col;
      const char = sourceCell.char || "";
      const sourceChar = sourceCell.originalChar || char;
      cells[row * cols + visualCol] = {
        ...sourceCell,
        reading: els.addReadings.checked && !sourceCell.practice && isKanji(sourceChar)
          ? readingLayout.cellReadings.get(sourceCell.sourceIndex) || ""
          : "",
      };
    });

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell = cells[row * cols + col];
        grid.append(createTextCell(cell.char, cell.guide));
        grid.append(createRubyCell(cell.reading));
      }
    }

    const groupedRubyLayer = createGroupedRubyLayer(cols, rows, readingLayout.groups);
    if (groupedRubyLayer) {
      grid.append(groupedRubyLayer);
    }

    applyPunchGuide(page);
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

function createTextCell(char, guide = false) {
  const cell = document.createElement("div");
  cell.className = "cell text-cell";
  cell.classList.toggle("guide-cell", guide);
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
    span.textContent = char;
    cell.append(span);
  }
  return cell;
}

function markSelectedTextAsGuide() {
  const start = els.sourceText.selectionStart ?? els.sourceText.value.length;
  const end = els.sourceText.selectionEnd ?? start;
  const selected = els.sourceText.value.slice(start, end);
  const marked = `'${selected}'`;

  els.sourceText.setRangeText(marked, start, end, "end");
  const selectionStart = start + 1;
  const selectionEnd = selectionStart + selected.length;
  els.sourceText.setSelectionRange(selectionStart, selectionEnd);
  els.sourceText.focus();
  render();
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

function getPunchGuide() {
  return ["left", "top"].includes(els.punchGuide.value) ? els.punchGuide.value : "none";
}

function applyPunchGuide(page) {
  const position = getPunchGuide();
  if (position === "none") {
    return;
  }

  const guide = document.createElement("span");
  guide.className = `punch-guide punch-guide-${position}`;
  guide.setAttribute("aria-hidden", "true");
  guide.textContent = position === "left" ? "◀" : "▲";
  page.append(guide);
}

async function extractReadingsFromText() {
  els.addReadings.checked = true;
  syncReadingPanel();
  const sourceText = els.sourceText.value;
  els.extractReadingsBtn.disabled = true;
  if (els.readingProgress) {
    els.readingProgress.hidden = false;
    els.readingProgress.value = 0;
  }
  setReadingStatus("読み仮名を準備しています…", "working");
  try {
    const result = await generateReadingAnnotations(sourceText, (message, progress) => {
      setReadingStatus(message, "working");
      if (els.readingProgress && Number.isFinite(progress)) {
        els.readingProgress.value = progress;
      }
    });
    readingState.sourceText = result.sourceText;
    readingState.annotations = result.annotations;
    const statusSuffix = result.warning ? " 単語辞書は使えないため候補読みです。" : "";
    setReadingStatus(`${result.annotations.length}件の読みを作りました。${statusSuffix}`, result.warning ? "warning" : "ready");
    render();
    setStatus("読み仮名を作成しました。");
  } catch (error) {
    readingState.annotations = [];
    readingState.sourceText = "";
    setReadingStatus(`読み仮名を作れませんでした: ${error.message || "辞書を確認してください"}`, "error");
    render();
    setStatus("読み仮名の作成に失敗しました。");
  } finally {
    els.extractReadingsBtn.disabled = false;
    if (els.readingProgress) {
      els.readingProgress.hidden = true;
    }
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeFontWeight(value) {
  if (value === "thin") {
    return { value: "thin", weight: 200, opacity: 0.55 };
  }
  if (value === "bold") {
    return { value: "bold", weight: 700, opacity: 1 };
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    if (parsed < 300) return { value: "thin", weight: 200, opacity: 0.55 };
    if (parsed >= 700) return { value: "bold", weight: 700, opacity: 1 };
  }
  return { value: "normal", weight: 300, opacity: 1 };
}

function getState() {
  return {
    text: els.sourceText.value,
    addReadings: els.addReadings.checked,
    readingAnnotations: readingState.annotations,
    readingSourceText: readingState.sourceText,
    name: els.studentName.value,
    date: els.worksheetDate.value,
    cols: els.cols.value,
    rows: els.rows.value,
    sheetCount: els.sheetCount.value,
    punchGuide: getPunchGuide(),
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
    spaceAsBlank: els.spaceAsBlank.checked,
    autoKanjiBlank: els.autoKanjiBlank.checked,
    blankKanji: els.blankKanji.value,
    autoNonKanjiBlank: els.autoNonKanjiBlank.checked,
    lineBreakColumn: els.lineBreakColumn.checked,
    fillExtraKanji: els.fillExtraKanji.checked,
    extraBlankCount: els.extraBlankCount.value,
    direction: getDirection(),
  };
}

function getTemplateSettings() {
  return {
    addReadings: els.addReadings.checked,
    readingAnnotations: readingState.annotations,
    readingSourceText: readingState.sourceText,
    cols: els.cols.value,
    rows: els.rows.value,
    sheetCount: els.sheetCount.value,
    punchGuide: getPunchGuide(),
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
    spaceAsBlank: els.spaceAsBlank.checked,
    autoKanjiBlank: els.autoKanjiBlank.checked,
    blankKanji: els.blankKanji.value,
    autoNonKanjiBlank: els.autoNonKanjiBlank.checked,
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
    ["studentName", "name"],
    ["worksheetDate", "date"],
    ["cols", "cols"],
    ["rows", "rows"],
    ["sheetCount", "sheetCount"],
    ["punchGuide", "punchGuide"],
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
    ["blankKanji", "blankKanji"],
  ];
  assignments.forEach(([elementKey, stateKey]) => {
    if (state[stateKey] !== undefined) {
      els[elementKey].value = state[stateKey];
    }
  });

  if (state.fontWeight !== undefined) {
    els.fontWeight.value = normalizeFontWeight(state.fontWeight).value;
  }

  if (state.fontFamily === "maru") {
    els.fontFamily.value = "gothic";
  }

  if (state.stripSpaces !== undefined) {
    els.stripSpaces.checked = Boolean(state.stripSpaces);
  }
  if (state.spaceAsBlank !== undefined) {
    els.spaceAsBlank.checked = Boolean(state.spaceAsBlank);
  }
  if (state.autoKanjiBlank !== undefined) {
    els.autoKanjiBlank.checked = Boolean(state.autoKanjiBlank);
  }
  const nonKanjiBlankState = state.autoNonKanjiBlank ?? state.autoHiraganaBlank;
  if (nonKanjiBlankState !== undefined) {
    els.autoNonKanjiBlank.checked = Boolean(nonKanjiBlankState);
  }
  syncAutoKanjiBlank();
  if (els.spaceAsBlank.checked) {
    els.stripSpaces.checked = false;
  }
  if (state.lineBreakColumn !== undefined) {
    els.lineBreakColumn.checked = Boolean(state.lineBreakColumn);
  }
  if (state.addReadings !== undefined) {
    els.addReadings.checked = Boolean(state.addReadings);
  }
  if (Array.isArray(state.readingAnnotations)) {
    readingState.annotations = normalizeReadingAnnotations(state.readingAnnotations);
  }
  if (typeof state.readingSourceText === "string") {
    readingState.sourceText = state.readingSourceText;
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
    els.studentName,
    els.worksheetDate,
    els.cols,
    els.rows,
    els.sheetCount,
    els.punchGuide,
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
    els.autoKanjiBlank,
    els.blankKanji,
    els.autoNonKanjiBlank,
    els.lineBreakColumn,
    els.fillExtraKanji,
    els.extraBlankCount,
    ...document.querySelectorAll('input[name="direction"]'),
  ];

  controls.forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  els.spaceAsBlank.addEventListener("change", () => {
    if (els.spaceAsBlank.checked) {
      els.stripSpaces.checked = false;
    } else {
      els.stripSpaces.checked = true;
    }
    render();
  });
  els.stripSpaces.addEventListener("change", () => {
    if (els.stripSpaces.checked) {
      els.spaceAsBlank.checked = false;
    }
    render();
  });

  els.printBtn.addEventListener("click", async () => {
    render();
    await waitForPrintReady();
    window.print();
  });

  els.copyLinkBtn.addEventListener("click", copyShareUrl);
  els.markGuideTextBtn.addEventListener("click", markSelectedTextAsGuide);
  els.extractReadingsBtn.addEventListener("click", extractReadingsFromText);
  els.clearReadingCorrectionsBtn?.addEventListener("click", () => {
    readingCorrections?.clear();
    setStatus("学習した読みを消去しました。");
  });
  els.addReadings.addEventListener("change", () => {
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
