const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function makeContext() {
  const controls = new Map([
    ["#studentName", ""],
    ["#worksheetDate", ""],
    ["#worksheetTitle", "1年生 とけいプリント"],
    ["#problemType", "read"],
    ["#range", "hour"],
    ["#minuteLabelMode", "none"],
    ["#problemCount", "6"],
    ["#problemCountPreset", ""],
    ["#columns", "2"],
  ]);
  const document = {
    documentElement: { style: { setProperty() {} } },
    querySelector(selector) {
      const value = controls.get(selector);
      if (value === undefined) return { value: "", style: { setProperty() {} }, classList: { add() {}, toggle() {} } };
      return { value, style: { setProperty() {} }, classList: { add() {}, toggle() {} } };
    },
  };
  const context = vm.createContext({
    console,
    document,
    window: { location: { hash: "" } },
    localStorage: { getItem() { return null; }, setItem() {} },
    TextDecoder,
    TextEncoder,
    Uint8Array,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    Math: Object.create(Math),
    __CLOCK_PRINT_TEST__: true,
  });
  context.globalThis = context;
  vm.runInContext("Math.random = () => 0", context);
  vm.runInContext(appSource, context, { filename: "clock-print-grade1/app.js" });
  return context;
}

function evaluateJson(context, expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

test("packing keeps continuous bounded ranges and marks a too-tall item", () => {
  const context = makeContext();
  const result = evaluateJson(context, `(() => ({
    twoColumns: packProblemRanges([40, 40, 40, 40, 40, 40], 2, 100, 10),
    oneColumn: packProblemRanges([40, 40, 40], 1, 100, 10),
    fourColumns: packProblemRanges([40, 40, 40, 40, 40], 4, 100, 10),
    tooTall: packProblemRanges([140, 40], 2, 100, 10),
  }))()`);

  assert.deepEqual(result.twoColumns, [
    { start: 0, end: 4, overflow: false },
    { start: 4, end: 6, overflow: false },
  ]);
  assert.deepEqual(result.oneColumn, [
    { start: 0, end: 2, overflow: false },
    { start: 2, end: 3, overflow: false },
  ]);
  assert.deepEqual(result.fourColumns, [
    { start: 0, end: 5, overflow: false },
  ]);
  assert.deepEqual(result.tooTall, [
    { start: 0, end: 2, overflow: true },
  ]);
  assert.equal(result.twoColumns.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, i) => start + i)).join(","), "0,1,2,3,4,5");
});

test("the optional shared page-count contract falls back to logical pages while dirty", () => {
  const context = makeContext();
  const result = evaluateJson(context, `(() => {
    const logical = getExpectedPhysicalPageCount({ sheetCount: 2, includeAnswers: true, logicalPageCount: 4 });
    paginationState = { dirty: false, physical: true, signature: "x", physicalPageCount: 12, sheetCount: 2, includeAnswers: true };
    const physical = getExpectedPhysicalPageCount({ sheetCount: 2, includeAnswers: true, logicalPageCount: 4 });
    const changedSettings = getExpectedPhysicalPageCount({ sheetCount: 1, includeAnswers: true, logicalPageCount: 2 });
    markPaginationDirty();
    const dirty = getExpectedPhysicalPageCount({ sheetCount: 2, includeAnswers: true, logicalPageCount: 4 });
    return { logical, physical, changedSettings, dirty };
  })()`);

  assert.deepEqual(result, { logical: 4, physical: 12, changedSettings: 2, dirty: 4 });
});
