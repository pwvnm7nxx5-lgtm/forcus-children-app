const assert = require("node:assert/strict");
const test = require("node:test");

const layout = require("../reading-layout.js");

function position(row, col, sourceIndex) {
  return { row, col, sourceIndex };
}

function summarize(fragments) {
  return fragments.map((fragment) => ({
    row: fragment.row,
    col: fragment.col,
    span: fragment.span,
    orientation: fragment.orientation,
    sourceIndices: fragment.positions.map((entry) => entry.sourceIndex),
  }));
}

test("contiguous horizontal and vertical positions become one full-span fragment", () => {
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(2, 1, 10),
    position(2, 2, 11),
    position(2, 3, 12),
  ])), [
    { row: 2, col: 1, span: 3, orientation: "horizontal", sourceIndices: [10, 11, 12] },
  ]);
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(1, 4, 20),
    position(2, 4, 21),
    position(3, 4, 22),
  ])), [
    { row: 1, col: 4, span: 3, orientation: "vertical", sourceIndices: [20, 21, 22] },
  ]);
});

test("noncontiguous positions become safe fragments instead of a first-cell fallback", () => {
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(0, 0, 30),
    position(0, 2, 32),
  ])), [
    { row: 0, col: 0, span: 1, orientation: "horizontal", sourceIndices: [30] },
    { row: 0, col: 2, span: 1, orientation: "horizontal", sourceIndices: [32] },
  ]);
});

test("each contiguous run keeps its full span when a lane is fragmented", () => {
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(4, 1, 60),
    position(4, 2, 61),
    position(4, 4, 63),
    position(4, 5, 64),
  ])), [
    { row: 4, col: 1, span: 2, orientation: "horizontal", sourceIndices: [60, 61] },
    { row: 4, col: 4, span: 2, orientation: "horizontal", sourceIndices: [63, 64] },
  ]);
});

test("mixed boundary positions remain present in safe contiguous fragments", () => {
  const fragments = layout.buildReadingFragments([
    position(0, 0, 70),
    position(1, 0, 71),
    position(1, 1, 72),
    position(3, 1, 74),
  ]);
  assert.deepEqual(fragments.flatMap((fragment) => fragment.positions.map((entry) => entry.sourceIndex)), [70, 71, 72, 74]);
  assert.deepEqual(summarize(fragments), [
    { row: 0, col: 0, span: 2, orientation: "vertical", sourceIndices: [70, 71] },
    { row: 1, col: 1, span: 1, orientation: "vertical", sourceIndices: [72] },
    { row: 3, col: 1, span: 1, orientation: "vertical", sourceIndices: [74] },
  ]);
});

test("a page fragment remains renderable when only part of a word is visible", () => {
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(13, 2, 41),
  ])), [
    { row: 13, col: 2, span: 1, orientation: "vertical", sourceIndices: [41] },
  ]);
  assert.deepEqual(summarize(layout.buildReadingFragments([
    position(7, 0, 50),
    position(0, 1, 51),
  ])), [
    { row: 7, col: 0, span: 1, orientation: "vertical", sourceIndices: [50] },
    { row: 0, col: 1, span: 1, orientation: "vertical", sourceIndices: [51] },
  ]);
});
