const assert = require("node:assert/strict");
const test = require("node:test");

const inputState = require("../reading-input-state.js");

function normalize(value) {
  return Array.from(String(value), (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : char;
  }).join("");
}

test("a no-op mode-entry commit cannot suppress a later real edit", () => {
  const annotation = {
    reading: "がっきゅうかい",
    manual: false,
    mode: "group",
    pieces: [],
  };
  const descriptor = { role: "word", pieceIndex: -1 };

  assert.equal(inputState.applyReadingInputValue(
    annotation,
    descriptor,
    "ガッキュウカイ",
    normalize,
  ), false);
  assert.equal(annotation.reading, "がっきゅうかい");
  assert.equal(annotation.manual, false);

  assert.equal(inputState.applyReadingInputValue(
    annotation,
    descriptor,
    "がっこうかい",
    normalize,
  ), true);
  assert.equal(annotation.reading, "がっこうかい");
  assert.equal(annotation.manual, true);

  assert.equal(inputState.applyReadingInputValue(
    annotation,
    descriptor,
    "がっこうかい",
    normalize,
  ), false);
  assert.equal(annotation.reading, "がっこうかい");
});

test("piece edits also commit once and ignore repeated blur values", () => {
  const annotation = {
    reading: "しんこう",
    manual: false,
    mode: "split",
    pieces: [
      { reading: "しん" },
      { reading: "こう" },
    ],
  };
  const descriptor = { role: "piece", pieceIndex: 1 };

  assert.equal(inputState.applyReadingInputValue(annotation, descriptor, "こう", normalize), false);
  assert.equal(inputState.applyReadingInputValue(annotation, descriptor, "コー", normalize), true);
  assert.equal(annotation.pieces[1].reading, "こー");
  assert.equal(inputState.applyReadingInputValue(annotation, descriptor, "こー", normalize), false);
});
