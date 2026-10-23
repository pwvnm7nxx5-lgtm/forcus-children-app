const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("\nfunction ", start + 1));
}
function harness(mode = "hybrid") {
  const settings = { creationMode: mode, count: 2 };
  const print = { sheetCount: 3 };
  const blank = () => ({ manualEntry: true, manualSource: "blank", a: "", b: "" });
  const ctx = vm.createContext({
    settings, print, problems: [blank(), blank()], sheetProblemSets: [], sheetSetSignature: "", restoredSheetCount: null,
    window: { __printAdjustmentsGetSettings: () => print }, document: { querySelector: () => null },
    clampNumber: (n, min, max, fallback) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback,
    getSettings: () => settings, sheetSignature: value => JSON.stringify(value),
    isManualInputActive: value => value.creationMode !== "auto",
    isManualEntryProblem: p => p.manualEntry === true,
    createManualProblem: blank, createManualProblems: () => [blank(), blank()],
    makeManualProblemsForSettings: () => [blank(), blank()],
    selectProblems: () => [{ a: 14, b: 12 }, { a: 25, b: 13 }], problemKey: p => `${p.a}+${p.b}`,
    makeEditableProblem: p => ({ ...p, manualEntry: true, manualSource: "auto" }),
    isCompleteManualProblem: p => Boolean(p.a && p.b),
    normalizeProblems: values => Array.isArray(values) ? plain(values) : [],
    normalizeDivisionProblem: value => value,
    render() {}, syncSettingsControls() {}, setStatus() {}, noSolutionMessage: () => "no solution",
    generateEditableProblems: (_settings, count) => Array.from({ length: count }, (_, i) => ({ a: String(i + 11), b: "12", manualEntry: true, manualSource: "auto" })),
  });
  for (const name of ["currentSheetCount", "knownProblemSets", "activeProblemEntries", "problemAtInputIndex", "ensureSheetProblemSets",
    "fillRemainingProblems", "regenerateProblemsByMode", "incompleteManualProblemNumbers", "getShareState", "restoreWorksheetProblems"]) {
    vm.runInContext(fn(name), ctx);
  }
  return ctx;
}

for (const mode of ["manual", "hybrid"]) test(`${mode}: every sheet starts editable, independent and addressable`, () => {
  const ctx = harness(mode), sets = ctx.ensureSheetProblemSets(3);
  assert.equal(sets.length, 3);
  assert.ok(sets.every(set => set.length === 2 && set.every(p => p.manualEntry && p.manualSource === "blank")));
  ctx.problemAtInputIndex(2).a = "42";
  ctx.problemAtInputIndex(4).a = "73";
  assert.equal(sets[0][0].a, "");
  assert.equal(sets[1][0].a, "42");
  assert.equal(sets[2][0].a, "73");
  assert.equal(ctx.problemAtInputIndex(-1), null);
  assert.equal(ctx.problemAtInputIndex(6), null);
  ctx.ensureSheetProblemSets(1);
  assert.equal(ctx.ensureSheetProblemSets(3)[1][0].a, "42", "temporary sheet-count changes lost entered values");
});

test("hybrid fill and reroll operate on all active sheets and preserve partial/manual entries", () => {
  const ctx = harness();ctx.ensureSheetProblemSets(3);
  Object.assign(ctx.problemAtInputIndex(2), { a: "42", b: "13", manualSource: "manual" });
  Object.assign(ctx.problemAtInputIndex(4), { a: "7", b: "", manualSource: "manual" });
  ctx.fillRemainingProblems();
  assert.equal(ctx.problemAtInputIndex(2).a, "42");
  assert.equal(ctx.problemAtInputIndex(4).a, "7");
  assert.ok(ctx.activeProblemEntries().every(({ problem }) => problem.manualSource !== "blank"));
  const before = plain(ctx.sheetProblemSets);
  ctx.regenerateProblemsByMode();
  assert.deepEqual(plain(ctx.sheetProblemSets[1][0]), before[1][0]);
  assert.deepEqual(plain(ctx.sheetProblemSets[2][0]), before[2][0]);
  assert.deepEqual(plain(ctx.incompleteManualProblemNumbers()), [5]);
});

test("automatic sheets remain ordinary generated problems, not editable placeholders", () => {
  const ctx=harness("auto");ctx.problems=[];
  ctx.makeManualProblemsForSettings=ctx.selectProblems;
  assert.ok(ctx.ensureSheetProblemSets(3).every(set=>set.every(p=>!p.manualEntry)));
});

test("worksheet state preserves all pages, and legacy first-page-only data still works", () => {
  const ctx=harness();ctx.ensureSheetProblemSets(3);
  Object.assign(ctx.problemAtInputIndex(4),{a:"76",b:"12",manualSource:"manual"});
  const saved=plain(ctx.getShareState());
  assert.equal(saved.sheetCount,3);assert.equal(saved.sheetProblemSets[2][0].a,"76");
  const restored=harness();restored.restoreWorksheetProblems(saved);
  assert.equal(restored.currentSheetCount(),3);
  assert.equal(restored.problemAtInputIndex(4).a,"76");
  const legacy=harness();legacy.print.sheetCount=1;
  legacy.restoreWorksheetProblems({problems:[{a:"23",b:"14",manualEntry:true,manualSource:"manual"}]});
  assert.equal(legacy.problems[0].a,"23");assert.equal(legacy.restoredSheetCount,null);
});

test("rendered question and answer pages receive the same stable logical sheet address", () => {
  const ctx=harness(), pages=[];
  ctx.renderPage=(kind,answer,values,index)=>({kind,answer,index,values});
  ctx.els={pages:{replaceChildren:(...items)=>pages.push(...items)},pageCount:{}};
  ctx.scheduleHorizontalFormulaFit=()=>{};ctx.saveState=()=>{};
  vm.runInContext(fn("renderSheetPages"),ctx);
  ctx.renderSheetPages(3,true);
  assert.deepEqual(pages.map(p=>[p.index,p.answer]),[[0,false],[0,true],[1,false],[1,true],[2,false],[2,true]]);
});
