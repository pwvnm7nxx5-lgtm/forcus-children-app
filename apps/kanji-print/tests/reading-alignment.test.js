const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const alignment = require("../reading-alignment.js");
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

test("kana-only, punctuation, and line-break input produce no annotations", () => {
  assert.deepEqual(align("ひらがなだけ", "ひらがなだけ"), []);
  assert.deepEqual(align("。", "。"), []);
  assert.deepEqual(align("\n", "\n"), []);
});
