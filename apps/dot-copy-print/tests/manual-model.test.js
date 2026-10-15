const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../generator.js");
const M = require("../manual-model.js");
const settings = changes => ({ ...G.DEFAULTS, ...changes });

test("editing adds consecutive lines, toggles an existing undirected line and never mutates the source", () => {
  const config = settings(), original = [[0, 1]];
  const next = M.toggleLine(config, original, 1, 2);
  assert.deepEqual(next, [[0, 1], [1, 2]]);
  assert.deepEqual(original, [[0, 1]]);
  next[0][0] = 4;
  assert.deepEqual(original, [[0, 1]]);
  assert.deepEqual(M.toggleLine(config, original, 1, 0), []);
});

test("drawing respects direction levels, dot bounds, maximum count and intersections", () => {
  for (const level of [1, 2, 3]) {
    const config = settings({ level });
    const edges = G.candidates(config);
    for (const edge of edges) assert.deepEqual(M.toggleLine(config, [], ...edge), [edge]);
    assert.throws(() => M.toggleLine(config, [], 0, 3), /向き・長さ/);
  }
  const config = settings({ level: 2 });
  assert.throws(() => M.toggleLine(settings(), [], 0, 6), /レベル1/);
  assert.throws(() => M.toggleLine(settings({ level: 2 }), [], 0, 7), /レベル2/);
  assert.throws(() => M.toggleLine(config, [[0, 6]], 1, 5), /交差/);
  for (const pair of [[0, 0], [-1, 0], [25, 0], [0.5, 1], ["0", 1]]) {
    assert.throws(() => M.toggleLine(config, [], ...pair), /2つの点/);
  }
  const large = settings({ rows: 12, columns: 12 });
  const sixty = G.candidates(large).slice(0, 60);
  assert.throws(() => M.toggleLine(large, sixty, 130, 131), /最大60本/);
  assert.equal(M.toggleLine(large, sixty, ...sixty[0]).length, 59, "erasing remains possible at the limit");
});

test("hand-made models use actual counts without altering automatic settings", () => {
  const config = settings(), source = [[0, 1], [1, 2]];
  const before = JSON.stringify(config);
  const problem = M.makeProblem(config, source);
  assert.equal(problem.manual, true);
  assert.equal(problem.lineCount, 2);
  assert.equal(config.lineCount, 5);
  assert.equal(JSON.stringify(config), before);
  assert.deepEqual(problem.strokes, [[0, 1, 2]]);
  assert.deepEqual(M.worksheetProblemErrors(problem, config), []);
  assert.ok(G.problemErrors(problem, config).length, "automatic validation retains the exact count contract");
  source[0][0] = 20;
  assert.deepEqual(problem.edges, [[0, 1], [1, 2]]);
  assert.ok(M.worksheetProblemErrors({ ...problem, manual: false }, config).length);
  assert.ok(M.worksheetProblemErrors({ ...problem, lineCount: 3 }, config).length);
  assert.ok(M.worksheetProblemErrors(problem, { ...config, rows: 6 }).length);
});

test("save validates one-stroke, connectedness and mandatory highest-level direction", () => {
  const branch = [[0, 1], [1, 2], [1, 6]];
  const cycle = [[0, 1], [1, 6], [6, 5], [5, 0]];
  const separate = [[0, 1], [10, 11]];
  for (const edges of [branch, cycle, separate]) assert.throws(() => M.makeProblem(settings(), edges), /一筆書き/);
  for (const edges of [branch, cycle]) {
    const problem = M.makeProblem(settings({ oneStroke: false }), edges);
    assert.equal(G.linesConnected(problem.edges), true);
    const drawn = problem.strokes.flatMap(stroke => stroke.slice(1).map((id, i) => G.edgeKey([stroke[i], id])));
    assert.deepEqual(drawn.sort(), edges.map(G.edgeKey).sort());
  }
  assert.throws(() => M.makeProblem(settings({ oneStroke: false }), separate), /ひとまとまり/);
  assert.equal(M.makeProblem(settings({ oneStroke: false, connectAll: false }), separate).strokes.length, 2);
  for (const [level, edge] of [[2, [0, 6]], [3, [0, 7]]]) {
    assert.throws(() => M.makeProblem(settings({ level }), [[0, 1]]), /追加方向/);
    assert.deepEqual(M.makeProblem(settings({ level }), [edge]).edges, [edge]);
  }
});

test("empty, malformed, duplicate, long and crossing drafts cannot be saved", () => {
  for (const edges of [[], null, [[0]], [[0, 25]], [[0, 0]], [[0, 3]], [[0, 1], [1, 0]],
    [[0, 6], [1, 5]], Array.from({ length: 61 }, () => [0, 1])]) {
    assert.throws(() => M.makeProblem(settings({ level: 2 }), edges));
    assert.ok(M.draftErrors(settings({ level: 2 }), edges).length);
  }
  assert.deepEqual(M.draftErrors(settings(), [[0, 1]]), []);
});

test("automatic and hand-made models share restored worksheet validation and complete hint strokes", () => {
  for (const level of [1, 2, 3]) for (const oneStroke of [true, false]) {
    const config = settings({ level, oneStroke });
    for (let i = 0; i < 20; i += 1) {
      const automatic = G.generateProblem(config);
      const manual = M.makeProblem(config, automatic.edges);
      for (const problem of [automatic, manual]) {
        assert.deepEqual(M.worksheetProblemErrors(JSON.parse(JSON.stringify(problem)), config), []);
        assert.equal(G.fingerprint(problem), G.fingerprint(automatic));
        const walked = problem.strokes.flatMap(stroke => stroke.slice(1).map((id, index) => G.edgeKey([stroke[index], id])));
        assert.deepEqual(walked.sort(), problem.edges.map(G.edgeKey).sort());
      }
    }
  }
});
