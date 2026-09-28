const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const shared = fs.readFileSync(path.join(__dirname, "../print-adjustments.js"), "utf8");
const builder = fs.readFileSync(path.join(__dirname, "../../custom-calculation-problem-builder/app.js"), "utf8");
function sharedFunction(name) {
  const start = shared.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1);
  return shared.slice(start, shared.indexOf("\n  function ", start + 1));
}

function blockHarness({ fail = false } = {}) {
  const events = [];
  const pages = { style: { zoom: "0.62" } };
  const makeGrid = (id, heights) => ({
    classList: { remove() { events.push(`reset:${id}`); }, add() { events.push(`apply:${id}`); } },
    style: { removeProperty() {}, setProperty(key, value) { this[key] = value; } },
    querySelectorAll() {
      return heights.map(([height, scroll]) => ({
        get offsetHeight() {
          events.push(`read:${id}`);
          assert.equal(pages.style.zoom, "");
          if (fail) throw new Error("measurement failed");
          return height;
        },
        scrollHeight: scroll,
      }));
    },
  });
  const grids = [makeGrid("a", [[21, 24.2], [30, 28]]), makeGrid("b", [[18, 41.2]]), makeGrid("empty", [])];
  const hidden = makeGrid("hidden", [[999, 999]]);
  const allPages = [
    { hidden: false, classList: { contains: () => false }, querySelectorAll: () => grids },
    { hidden: false, classList: { contains: () => true }, querySelectorAll: () => [hidden] },
  ];
  const context = vm.createContext({ document: {
    querySelector: () => pages,
    querySelectorAll: () => allPages,
  } });
  vm.runInContext(sharedFunction("visiblePrintPages") + sharedFunction("syncProblemBlocks"), context);
  return { context, events, grids, pages };
}

test("all grids reset, then measure, then apply without per-page layout thrashing", () => {
  const { context, events, grids, pages } = blockHarness();
  context.syncProblemBlocks();
  assert.deepEqual(events, ["reset:a", "reset:b", "read:a", "read:a", "read:b", "apply:a", "apply:b"]);
  assert.equal(grids[0].style["--problem-block-height"], "30px");
  assert.equal(grids[1].style["--problem-block-height"], "42px");
  assert.equal(pages.style.zoom, "0.62");
});

test("a failed measurement still restores preview zoom", () => {
  const { context, pages } = blockHarness({ fail: true });
  assert.throws(() => context.syncProblemBlocks(), /measurement failed/);
  assert.equal(pages.style.zoom, "0.62");
});

test("paper-area fitting keeps zoom stable and restores it on success or failure", () => {
  for (const enabled of [true, false]) {
    for (const fail of [true, false]) {
      const pages = { style: { zoom: "0.62" } };
      const settings = { scalePct: 100 };
      const context = vm.createContext({
        paperAreaAutoFit: enabled,
        document: { querySelector: () => pages },
        fitProblemScale(actual) {
          assert.equal(actual, settings);
          assert.equal(pages.style.zoom, enabled ? "" : "0.62");
          if (fail) throw new Error("fit failed");
        },
      });
      vm.runInContext(sharedFunction("applyAutoFit"), context);
      if (fail) assert.throws(() => context.applyAutoFit(settings), /fit failed/);
      else context.applyAutoFit(settings);
      assert.equal(pages.style.zoom, "0.62");
    }
  }
});

test("horizontal fitting coalesces requests but preserves page synchronization for all layouts", () => {
  const start = builder.indexOf("let horizontalFormulaFitPending = false;");
  const source = builder.slice(start, builder.indexOf('\nwindow.addEventListener("print-adjustments:applied"', start));
  const queue = [];
  const fitted = [];
  let refreshes = 0;
  let hasFormula = false;
  const grid = { querySelector: () => hasFormula };
  const context = vm.createContext({
    window: { requestAnimationFrame: (fn) => queue.push(fn), __printAdjustmentsRefresh: () => refreshes++ },
    els: { pages: { querySelectorAll: () => [grid] } },
    fitHorizontalFormulas: (value) => fitted.push(value),
  });
  vm.runInContext(source, context);
  context.scheduleHorizontalFormulaFit();
  context.scheduleHorizontalFormulaFit();
  assert.equal(queue.length, 1);
  while (queue.length) queue.shift()();
  assert.equal(refreshes, 1);
  hasFormula = true;
  context.scheduleHorizontalFormulaFit();
  context.scheduleHorizontalFormulaFit();
  while (queue.length) queue.shift()();
  assert.deepEqual(fitted, [grid]);
  assert.equal(refreshes, 2);
});
