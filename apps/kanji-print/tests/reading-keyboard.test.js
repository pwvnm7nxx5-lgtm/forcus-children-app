const assert = require("node:assert/strict");
const test = require("node:test");

const keyboard = require("../reading-keyboard.js");

const annotations = [
  {
    id: "word-1",
    mode: "split",
    sourceIndices: [4, 5, 6],
    pieces: [
      { sourceStart: 4, sourceEnd: 5 },
      { sourceIndices: [5] },
      { sourceStart: 6, sourceEnd: 7 },
    ],
  },
  {
    id: "word-2",
    mode: "group",
    sourceStart: 10,
    sourceEnd: 12,
    pieces: [],
  },
];

test("reading fields keep the fast split-piece and next-word sequence", () => {
  const sequence = keyboard.getReadingFocusSequence(annotations);
  assert.deepEqual(sequence, [
    { annotationId: "word-1", role: "piece", pieceIndex: 0 },
    { annotationId: "word-1", role: "piece", pieceIndex: 1 },
    { annotationId: "word-1", role: "piece", pieceIndex: 2 },
    { annotationId: "word-2", role: "word", pieceIndex: -1 },
  ]);
  assert.deepEqual(
    keyboard.getAdjacentReadingFocus(annotations, sequence[0], 1),
    sequence[1],
  );
  assert.deepEqual(
    keyboard.getAdjacentReadingFocus(annotations, sequence[2], 1),
    sequence[3],
  );
  assert.deepEqual(
    keyboard.getAdjacentReadingFocus(annotations, sequence[3], -1),
    sequence[2],
  );
});

test("preview kanji targets the matching split piece or grouped word", () => {
  assert.deepEqual(keyboard.getReadingFocusForSourceIndex(annotations, 5), {
    annotationId: "word-1",
    role: "piece",
    pieceIndex: 1,
  });
  assert.deepEqual(keyboard.getReadingFocusForSourceIndex(annotations, 11), {
    annotationId: "word-2",
    role: "word",
    pieceIndex: -1,
  });
  assert.equal(keyboard.getReadingFocusForSourceIndex(annotations, 99), null);
  assert.equal(keyboard.getReadingFocusForSourceIndex(annotations, "not-a-number"), null);
});

test("mode controls have an explicit keyboard entry, movement, activation, and return path", () => {
  assert.deepEqual(keyboard.getModeKeyAction("ArrowDown", false), null);
  assert.deepEqual(keyboard.getModeKeyAction("ArrowLeft"), { type: "move", direction: -1 });
  assert.deepEqual(keyboard.getModeKeyAction("ArrowRight"), { type: "move", direction: 1 });
  assert.deepEqual(keyboard.getModeKeyAction("Enter"), { type: "activate" });
  assert.deepEqual(keyboard.getModeKeyAction(" "), { type: "activate" });
  assert.deepEqual(keyboard.getModeKeyAction("Escape"), { type: "return" });
  assert.deepEqual(keyboard.getModeKeyAction("Tab"), { type: "reading", direction: 1 });
  assert.deepEqual(keyboard.getModeKeyAction("Tab", true), { type: "reading", direction: -1 });
  assert.equal(keyboard.getModeButtonIndex(0, 1, 2), 1);
  assert.equal(keyboard.getModeButtonIndex(1, 1, 2), 0);
  assert.equal(keyboard.getModeButtonIndex(0, -1, 2), 1);
});
