const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const controlSelectors = [
  "#studentName",
  "#worksheetDate",
  "#worksheetTitle",
  "#problemType",
  "#range",
  "#minuteLabelMode",
  "#problemCount",
  "#problemCountPreset",
  "#columns",
  "#pageCount",
  "#pages",
  "#pageTemplate",
  "#status",
];

function makeElement() {
  return {
    value: "",
    checked: false,
    textContent: "",
    style: { setProperty() {} },
    classList: { add() {}, toggle() {} },
    addEventListener() {},
  };
}

function makeContext({ storageValue = null, hash = "" } = {}) {
  const controls = new Map(controlSelectors.map((selector) => [selector, makeElement()]));
  const document = {
    documentElement: { style: { setProperty() {} } },
    querySelector(selector) {
      return controls.get(selector) || makeElement();
    },
  };
  const localStorage = {
    getItem() {
      return storageValue;
    },
    setItem() {},
  };
  const context = vm.createContext({
    console,
    document,
    window: { location: { hash } },
    localStorage,
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

function evaluate(context, expression) {
  return vm.runInContext(expression, context);
}

function evaluateJson(context, expression) {
  return JSON.parse(evaluate(context, `JSON.stringify(${expression})`));
}

function settings(type, range, count, minuteLabelMode = "none") {
  return {
    name: "",
    date: "",
    title: "1年生 とけいプリント",
    type,
    range,
    minuteLabelMode,
    count,
    columns: 2,
  };
}

function problemIdentity(problem) {
  return `${problem.type}:${problem.hour}:${problem.minute}`;
}

test("finite pools honor every supported count, mode, and range", () => {
  for (const type of ["read", "draw", "mix"]) {
    for (const range of ["hour", "half"]) {
      const poolSize = (range === "half" ? 24 : 12) * (type === "mix" ? 2 : 1);
      for (const count of [1, 6, 12, 24]) {
        const context = makeContext();
        const config = settings(type, range, count);
        const result = evaluateJson(context, `(() => {
          const config = ${JSON.stringify(config)};
          beginSelectionBatch();
          const selected = selectProblemSet(config, new Set());
          return { selected, repeated: selectionRepeatNotice };
        })()`);

        assert.equal(result.selected.length, count, `${type}/${range}/${count}`);
        assert.equal(result.repeated, count > poolSize, `${type}/${range}/${count} notice`);
        const firstCycle = result.selected.slice(0, Math.min(count, poolSize));
        assert.equal(new Set(firstCycle.map(problemIdentity)).size, firstCycle.length, `${type}/${range}/${count} variety`);
        result.selected.forEach((problem) => {
          assert.equal(problem.answer, problem.minute === 30 ? `${problem.hour}じはん` : `${problem.hour}じ`);
          assert.ok(["read", "draw"].includes(problem.type));
          if (problem.type === "draw") assert.ok(problem.answerVisual);
        });

        const secondContext = makeContext();
        const second = evaluateJson(secondContext, `(() => {
          beginSelectionBatch();
          return selectProblemSet(${JSON.stringify(config)}, new Set());
        })()`);
        assert.deepEqual(result.selected, second, `${type}/${range}/${count} deterministic constant RNG`);
      }
    }
  }
});

test("multi-sheet selection returns exact sets and supports the full sheet-count range", () => {
  const context = makeContext();
  const spread = evaluateJson(context, `(() => {
    const config = ${JSON.stringify(settings("read", "half", 12))};
    const used = new Set();
    beginSelectionBatch();
    const first = selectProblemSet(config, used).map((problem) => problem.key);
    const second = selectProblemSet(config, used).map((problem) => problem.key);
    return { first, second };
  })()`);
  assert.equal(spread.first.filter((key) => spread.second.includes(key)).length, 0);

  const config = settings("read", "hour", 24);
  const result = evaluateJson(context, `(() => {
    const config = ${JSON.stringify(config)};
    els.problemType.value = config.type;
    els.range.value = config.range;
    els.minuteLabelMode.value = config.minuteLabelMode;
    els.problemCount.value = String(config.count);
    els.columns.value = String(config.columns);
    problems = selectProblemSet(config, new Set());
    sheetProblemSets = [];
    sheetSetSignature = "";
    beginSelectionBatch();
    return ensureSheetProblemSets(3).map((set) => set.map((problem) => problem.key));
  })()`);
  assert.equal(result.length, 3);
  result.forEach((set) => assert.equal(set.length, 24));

  const thirtySheets = evaluateJson(context, `(() => {
    const config = ${JSON.stringify(settings("mix", "half", 1))};
    els.problemType.value = config.type;
    els.range.value = config.range;
    els.minuteLabelMode.value = config.minuteLabelMode;
    els.problemCount.value = String(config.count);
    els.columns.value = String(config.columns);
    problems = selectProblemSet(config, new Set());
    sheetProblemSets = [];
    sheetSetSignature = "";
    beginSelectionBatch();
    return ensureSheetProblemSets(30).map((set) => set.length);
  })()`);
  assert.deepEqual(thirtySheets, Array(30).fill(1));
});

test("undersized legacy saved and shared states preserve their valid prefix and fill the count", () => {
  const config = settings("read", "half", 24);
  const sourceContext = makeContext();
  const legacyProblems = evaluateJson(sourceContext, `buildFiniteCandidatePool(${JSON.stringify(config)}).slice(0, 6).map(({ prompt, answer, visual, answerVisual }) => ({ prompt, answer, visual, answerVisual }))`);
  const expectedPrefix = legacyProblems.map((problem) => problem.answer);
  const savedState = JSON.stringify({ version: 4, settings: config, problems: legacyProblems });

  const savedContext = makeContext({ storageValue: savedState });
  const savedRestored = evaluateJson(savedContext, `(() => {
    loadInitialState();
    beginSelectionBatch();
    problems = reconcileProblems(getSettings(), problems);
    return problems;
  })()`);
  assert.equal(savedRestored.length, 24);
  assert.deepEqual(savedRestored.slice(0, 6).map((problem) => problem.answer), expectedPrefix);

  const encoded = evaluate(sourceContext, `encodeState(${savedState})`);
  const sharedContext = makeContext({ hash: `#data=${encoded}` });
  const sharedRestored = evaluateJson(sharedContext, `(() => {
    loadInitialState();
    beginSelectionBatch();
    problems = reconcileProblems(getSettings(), problems);
    return problems;
  })()`);
  assert.equal(sharedRestored.length, 24);
  assert.deepEqual(sharedRestored.slice(0, 6).map((problem) => problem.answer), expectedPrefix);
});

test("changing minute labels preserves clock identities while rebuilding the visual", () => {
  const context = makeContext();
  const result = evaluateJson(context, `(() => {
    const original = makeProblem(${JSON.stringify(settings("read", "half", 1, "none"))}, { type: "read", hour: 7, minute: 30 });
    const relabeled = normalizeProblem(original, ${JSON.stringify(settings("read", "half", 1, "five"))});
    return { original, relabeled, sameKey: problemKey(original) === problemKey(relabeled) };
  })()`);
  assert.equal(result.sameKey, true);
  assert.equal(result.original.hour, result.relabeled.hour);
  assert.equal(result.original.minute, result.relabeled.minute);
  assert.equal(result.original.answer, result.relabeled.answer);
  assert.notEqual(result.original.visual, result.relabeled.visual);
});
