const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const alignment = require("../reading-alignment.js");
const wordMap = require("../reading-word-map.js");
const candidateContext = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "reading-candidates.js"), "utf8"),
  candidateContext,
);
const candidates = candidateContext.window.KANJI_READING_CANDIDATES;
const getCandidates = (char) => candidates[char] || [];

function align(surface, reading, sourceIndices) {
  return alignment.alignSurfaceReading(surface, reading, {
    sourceIndices,
    getCandidates,
    getExactWordReading: wordMap.lookupExactWordReading,
  });
}

function summarize(annotations) {
  return annotations.map((annotation) => ({
    surface: annotation.surface,
    reading: annotation.reading,
    mode: annotation.mode,
    needsReview: annotation.needsReview,
  }));
}

test("mixed tokens attach only the residual reading to each kanji run", () => {
  assert.deepEqual(summarize(align("遠く", "とおく")), [
    { surface: "遠", reading: "とお", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("通う", "かよう")), [
    { surface: "通", reading: "かよ", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("学きゅう会", "がくきゅうかい")), [
    { surface: "学", reading: "がく", mode: "split", needsReview: false },
    { surface: "会", reading: "かい", mode: "split", needsReview: false },
  ]);
});

test("all-kanji 学級会 uses safe character candidates and preserves the促音", () => {
  const annotations = align("学級会", "がっきゅうかい");
  assert.deepEqual(summarize(annotations), [
    { surface: "学級会", reading: "がっきゅうかい", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(annotations[0].pieces.map((piece) => piece.reading), ["がっ", "きゅう", "かい"]);
});

test("exact surface and reading lookup takes precedence over generic candidates", () => {
  assert.deepEqual(wordMap.exactWordEntries.map((entry) => entry.surface), ["学級", "学級会", "学校", "進行"]);
  assert.deepEqual(wordMap.lookupExactWordReading("学級", "ガッキュウ"), [
    { surface: "学", reading: "がっ" },
    { surface: "級", reading: "きゅう" },
  ]);
  assert.equal(wordMap.lookupExactWordReading("学級", "がくきゅう"), null);
  for (const [surface, reading, expected] of [
    ["学級会", "がっきゅうかい", ["がっ", "きゅう", "かい"]],
    ["学校", "がっこう", ["がっ", "こう"]],
    ["進行", "しんこう", ["しん", "こう"]],
  ]) {
    assert.deepEqual(
      wordMap.lookupExactWordReading(surface, reading).map((piece) => piece.reading),
      expected,
    );
  }

  const pieces = alignment.splitReadingByCandidates(
    "学級",
    "がっきゅう",
    () => ["がく", "きゅう"],
    wordMap.lookupExactWordReading,
  );
  assert.deepEqual(pieces, [
    { surface: "学", reading: "がっ" },
    { surface: "級", reading: "きゅう" },
  ]);
});

test("real token boundaries merge 学級会 and keep ambiguous 一日 reviewable", () => {
  const source = "学級会の進行";
  const units = Array.from(source).map((char, inputIndex) => ({ char, inputIndex }));
  const items = alignment.alignTokenPositions(units, [
    { surface_form: "学級", reading: "ガッキュウ" },
    { surface_form: "会", reading: "カイ" },
    { surface_form: "の", reading: "ノ" },
    { surface_form: "進行", reading: "シンコウ" },
  ]).items;
  const merged = alignment.mergeReadingTokenItems(items, (surface, reading) => {
    if (wordMap.lookupExactWordReading(surface, reading)) return { kind: "exact" };
    if (wordMap.isReviewWordSurface(surface)) return { kind: "review" };
    return null;
  });

  assert.deepEqual(
    merged.filter((item) => item.type === "token").map((item) => [item.surface, item.readingKind]),
    [["学級会", "exact"], ["の", undefined], ["進行", undefined]],
  );
  assert.deepEqual(
    merged
      .filter((item) => item.type === "token" && /[\u3400-\u9fff々]/u.test(item.surface))
      .flatMap((item) => align(item.surface, item.token.reading)),
    align("学級会", "がっきゅうかい").concat(align("進行", "しんこう")),
  );

  const reviewUnits = Array.from("一日").map((char, inputIndex) => ({ char, inputIndex }));
  const reviewItems = alignment.alignTokenPositions(reviewUnits, [
    { surface_form: "一", reading: "イチ" },
    { surface_form: "日", reading: "ニチ" },
  ]).items;
  const mergedReview = alignment.mergeReadingTokenItems(reviewItems, (surface) => (
    wordMap.isReviewWordSurface(surface) ? { kind: "review" } : null
  ));
  assert.deepEqual(mergedReview.map((item) => [item.surface, item.readingKind, item.token.reading]), [
    ["一日", "review", "いちにち"],
  ]);
  assert.deepEqual(summarize(alignment.alignSurfaceReading("一日", "いちにち", {
    getCandidates,
    getExactWordReading: wordMap.lookupExactWordReading,
    forceReview: true,
  })), [
    { surface: "一日", reading: "いちにち", mode: "group", needsReview: true },
  ]);
});

test("target phrases keep word boundaries and residual kana anchors", () => {
  assert.deepEqual(summarize(align("学級会の進行", "がっきゅうかいのしんこう")), [
    { surface: "学級会", reading: "がっきゅうかい", mode: "split", needsReview: false },
    { surface: "進行", reading: "しんこう", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(align("学級会の進行", "がっきゅうかいのしんこう").map((annotation) => (
    annotation.pieces.map((piece) => piece.reading)
  )), [
    ["がっ", "きゅう", "かい"],
    ["しん", "こう"],
  ]);

  const kanaAnchored = align("遠くまで通う", "とおくまでかよう");
  assert.deepEqual(kanaAnchored.map((annotation) => [annotation.surface, annotation.reading]), [
    ["遠", "とお"],
    ["通", "かよ"],
  ]);
  assert.equal(kanaAnchored.some((annotation) => annotation.reading.includes("くく") || annotation.reading.includes("うう")), false);
});

test("other inflected and compound examples align by kana anchors", () => {
  assert.deepEqual(summarize(align("行った", "いった")), [
    { surface: "行", reading: "い", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("食べる", "たべる")), [
    { surface: "食", reading: "た", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("申し込む", "もうしこむ")), [
    { surface: "申", reading: "もう", mode: "split", needsReview: false },
    { surface: "込", reading: "こ", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("学校", "がっこう")), [
    { surface: "学校", reading: "がっこう", mode: "split", needsReview: false },
  ]);
  assert.deepEqual(summarize(align("進行", "しんこう")), [
    { surface: "進行", reading: "しんこう", mode: "split", needsReview: false },
  ]);
});

test("ambiguous or unavailable candidate splits become reviewed groups", () => {
  for (const [surface, reading] of [
    ["今日", "きょう"],
    ["大人", "おとな"],
    ["一日", "ついたち"],
  ]) {
    const annotations = align(surface, reading);
    assert.equal(annotations.length, 1);
    assert.equal(annotations[0].mode, "group");
    assert.equal(annotations[0].needsReview, true);
  }

  const ambiguousAnchor = align("行き", "いきき");
  assert.equal(ambiguousAnchor.length, 1);
  assert.equal(ambiguousAnchor[0].mode, "group");
  assert.equal(ambiguousAnchor[0].needsReview, true);
});

test("source indices follow the original text even when characters are separated", () => {
  const annotations = align("学級", "がっきゅう", [1, 4]);
  assert.equal(annotations[0].sourceStart, 1);
  assert.equal(annotations[0].sourceEnd, 5);
  assert.equal(annotations[0].pieces[0].sourceStart, 1);
  assert.equal(annotations[0].pieces[0].sourceEnd, 2);
  assert.equal(annotations[0].pieces[1].sourceStart, 4);
  assert.equal(annotations[0].pieces[1].sourceEnd, 5);
});

test("token position mismatches keep reviewed fallback groups and continue later tokens", () => {
  const units = Array.from("学校安全進行").map((char, index) => ({
    char,
    inputIndex: index * 2,
  }));
  const result = alignment.alignTokenPositions(units, [
    { surface_form: "学校", reading: "がっこう" },
    { surface_form: "存在しない", reading: "そんざいしない" },
    { surface_form: "進行", reading: "しんこう" },
  ]);
  const fallbackItems = result.items.filter((item) => item.type === "fallback");
  const tokenItems = result.items.filter((item) => item.type === "token");

  assert.equal(fallbackItems.length, 1);
  assert.deepEqual(summarize(fallbackItems[0].annotations), [
    { surface: "安全", reading: "", mode: "group", needsReview: true },
  ]);
  assert.equal(fallbackItems[0].annotations[0].reviewReason, "token-position-mismatch");
  assert.deepEqual(fallbackItems[0].annotations[0].sourceIndices, [4, 6]);
  assert.deepEqual(tokenItems.map((item) => [item.surface, item.start, item.end]), [
    ["学校", 0, 2],
    ["進行", 4, 6],
  ]);
  assert.equal(result.cursor, units.length);
});

test("exact compound matches can replace a truncated token span without losing source indices", () => {
  const source = "長ぐつをはく";
  const units = Array.from(source).map((char, inputIndex) => ({ char, inputIndex }));
  const items = alignment.alignTokenPositions(units, [
    { surface_form: "長", reading: "チョウ", pos: "接頭詞" },
    { surface_form: "ぐつをはく", reading: "", pos: "名詞" },
  ]).items;
  const exact = alignment.insertExactSurfaceMatches(items, units, [{
    start: 0,
    end: 3,
    surface: "長ぐつ",
    reading: "ながぐつ",
  }]);

  assert.deepEqual(exact.map((item) => [item.surface, item.start, item.end]), [
    ["長ぐつ", 0, 3],
    ["をはく", 3, 6],
  ]);
  assert.equal(exact[0].start, 0);
  assert.equal(exact[0].dictionaryMatch.reading, "ながぐつ");
  assert.deepEqual(exact[0].token.reading, "ながぐつ");
  assert.deepEqual(exact[1].token.reading, "");
  assert.deepEqual(exact[0].token.pos, "接頭詞");
});

test("an exact match embedded in a token keeps its original source offset", () => {
  const source = "文章";
  const units = Array.from(source).map((char, inputIndex) => ({ char, inputIndex }));
  const items = alignment.alignTokenPositions(units, [
    { surface_form: "文章", reading: "ブンショウ", pos: "名詞" },
  ]).items;
  const exact = alignment.insertExactSurfaceMatches(items, units, [{
    start: 1,
    end: 2,
    surface: "章",
    reading: "しょう",
  }]);

  assert.deepEqual(exact.map((item) => [item.surface, item.start, item.end]), [
    ["文", 0, 1],
    ["章", 1, 2],
  ]);
  assert.equal(exact[1].dictionaryMatch.start, 1);
  assert.deepEqual(exact[1].sourceIndices, [1]);
});

test("legacy token merging never crosses particles or punctuation", () => {
  const units = Array.from("将来の夢。もっと").map((char, inputIndex) => ({ char, inputIndex }));
  const items = alignment.alignTokenPositions(units, [
    { surface_form: "将来", reading: "ショウライ", pos: "名詞" },
    { surface_form: "の", reading: "ノ", pos: "助詞" },
    { surface_form: "夢", reading: "ユメ", pos: "名詞" },
    { surface_form: "。", reading: "。", pos: "記号" },
    { surface_form: "もっと", reading: "モット", pos: "副詞" },
  ]).items;
  const merged = alignment.mergeReadingTokenItems(items, (surface, reading) => (
    surface === "将来の夢" && reading === "しょうらいのゆめ"
      ? { kind: "exact" }
      : null
  ));
  assert.deepEqual(merged.map((item) => item.surface), ["将来", "の", "夢", "。", "もっと"]);
});

test("kana-only, punctuation, and line-break input produce no annotations", () => {
  assert.deepEqual(align("ひらがなだけ", "ひらがなだけ"), []);
  assert.deepEqual(align("。", "。"), []);
  assert.deepEqual(align("\n", "\n"), []);
});
