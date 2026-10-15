const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../generator.js");

function rng(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const config = changes => ({ rows: 5, columns: 5, lineCount: 5, level: 1, oneStroke: true, ...changes });

test("connectivity distinguishes a single figure from separate figures, independently of stroke count", () => {
  assert.equal(G.linesConnected([[0, 1]]), true);
  assert.equal(G.linesConnected([[0, 1], [1, 2], [1, 5]]), true, "a branching figure is connected");
  assert.equal(G.linesConnected([[0, 1], [1, 5], [5, 4], [4, 0]]), true, "a closed figure is connected");
  assert.equal(G.linesConnected([[0, 1], [8, 9]]), false, "separate lines are disconnected");
  assert.equal(G.linesConnected([[0, 1], [1, 2], [8, 9], [9, 13]]), false, "separate figures are disconnected");
  assert.equal(G.linesConnected([]), false);
});

// An independent intersection oracle using parametric segment intersection.
function forbiddenIntersection(first, second, columns) {
  const xy = id => [id % columns, Math.floor(id / columns)];
  const [a, b] = first.map(xy), [c, d] = second.map(xy);
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const determinant = (u, v) => u[0] * v[1] - u[1] * v[0];
  const q = [c[0] - a[0], c[1] - a[1]], denominator = determinant(r, s);
  if (denominator !== 0) {
    const t = determinant(q, s) / denominator, u = determinant(q, r) / denominator;
    const intersects = t >= 0 && t <= 1 && u >= 0 && u <= 1;
    return intersects && !first.some(id => second.includes(id));
  }
  if (determinant(q, r) !== 0) return false;
  const axis = r[0] ? 0 : 1;
  const overlap = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
    Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
  return overlap > 0 || (overlap === 0 && !first.some(id => second.includes(id)));
}

function inspect(problem, settings) {
  assert.equal(problem.rows, settings.rows);
  assert.equal(problem.columns, settings.columns);
  assert.equal(problem.edges.length, settings.lineCount);
  const degree = new Map();
  const key = edge => [...edge].sort((a, b) => a - b).join("-");
  assert.equal(new Set(problem.edges.map(key)).size, settings.lineCount);
  const levels = [];
  for (const edge of problem.edges) {
    for (const id of edge) {
      assert.ok(Number.isInteger(id) && id >= 0 && id < settings.rows * settings.columns);
      degree.set(id, (degree.get(id) || 0) + 1);
    }
    const dx = Math.abs(edge[0] % settings.columns - edge[1] % settings.columns);
    const dy = Math.abs(Math.floor(edge[0] / settings.columns) - Math.floor(edge[1] / settings.columns));
    const kind = dx + dy === 1 ? 1 : dx === 1 && dy === 1 ? 2 :
      (dx === 1 && dy === 2) || (dx === 2 && dy === 1) ? 3 : 0;
    assert.ok(kind > 0 && kind <= settings.level, `invalid direction ${dx},${dy}`);
    levels.push(kind);
  }
  assert.ok(levels.includes(settings.level), "new level must appear");
  for (let i = 0; i < problem.edges.length; i += 1) for (let j = 0; j < i; j += 1) {
    assert.equal(forbiddenIntersection(problem.edges[i], problem.edges[j], settings.columns), false);
  }
  const walked = problem.strokes.flatMap(stroke => stroke.slice(1).map((id, i) => key([stroke[i], id])));
  assert.deepEqual(walked.sort(), problem.edges.map(key).sort(), "drawing strokes traverse every edge exactly once");
  if (settings.connectAll) {
    // Independent union-find check, rather than relying on the engine's BFS.
    const parent = new Map([...degree.keys()].map(id => [id, id]));
    const root = id => parent.get(id) === id ? id : root(parent.get(id));
    for (const [a, b] of problem.edges) parent.set(root(a), root(b));
    assert.equal(new Set([...parent.keys()].map(root)).size, 1, "all used points form one component");
  }
  if (settings.oneStroke) {
    assert.equal(problem.strokes.length, 1);
    const path = problem.strokes[0];
    assert.equal(path.length, settings.lineCount + 1);
    const odd = [...degree.keys()].filter(id => degree.get(id) % 2);
    assert.ok(odd.length === 0 || odd.length === 2);
    if (odd.length === 0) assert.equal(path[0], path.at(-1));
    else assert.deepEqual([path[0], path.at(-1)].sort((a,b) => a-b), odd.sort((a,b) => a-b));
    if (settings.easyOneStroke) {
      assert.equal(new Set(path).size, settings.lineCount + 1);
      assert.equal(degree.get(path[0]), 1); assert.equal(degree.get(path.at(-1)), 1);
      assert.ok([...degree.values()].every(value => value <= 2));
    }
  }
  assert.deepEqual(G.problemErrors(problem, settings), []);
  return degree;
}

for (const level of [1, 2, 3]) for (const oneStroke of [true, false]) {
  test(`level ${level}, oneStroke ${oneStroke}: direction/count/geometry/trails over 80 seeds`, () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const settings = config({ level, oneStroke, rows: 3 + seed % 5, columns: 3 + (seed * 3) % 5, lineCount: 1 + seed % 8 });
      inspect(G.generateProblem(settings, { rng: rng(seed) }), settings);
    }
  });
}

test("OFF produces branches, disconnected groups, cycles and multiple strokes", () => {
  let branch = false, disconnected = false, cycle = false, multiple = false;
  const settings = config({ rows: 4, columns: 4, lineCount: 10, oneStroke: false });
  for (let seed = 1; seed <= 100; seed += 1) {
    const problem = G.generateProblem(settings, { rng: rng(seed) });
    const degree = inspect(problem, settings);
    branch ||= [...degree.values()].some(value => value >= 3);
    multiple ||= problem.strokes.length > 1;
    const parent = new Map([...degree.keys()].map(id => [id, id]));
    const root = id => parent.get(id) === id ? id : root(parent.get(id));
    for (const [a, b] of problem.edges) {
      if (root(a) === root(b)) cycle = true;
      else parent.set(root(a), root(b));
    }
    disconnected ||= new Set([...parent.keys()].map(root)).size > 1;
  }
  assert.ok(branch && disconnected && cycle && multiple, JSON.stringify({ branch, disconnected, cycle, multiple }));
});

test("boundary grids and maximum line count preserve conditions", () => {
  for (const settings of [config({ rows: 1, columns: 12, lineCount: 11 }),
    config({ rows: 12, columns: 1, lineCount: 11 }),
    config({ rows: 2, columns: 2, lineCount: 3 }),
    config({ rows: 2, columns: 2, lineCount: 4, oneStroke: false }),
    config({ rows: 12, columns: 12, lineCount: 60, level: 3, oneStroke: false }),
    config({ rows: 12, columns: 12, lineCount: 60, level: 2 }),
    config({ rows: 12, columns: 12, lineCount: 60, level: 3 }),
    config({ rows: 12, columns: 12, lineCount: 60, level: 3, easyOneStroke: true }),
    config({ rows: 12, columns: 12, lineCount: 60 })]) {
    inspect(G.generateProblem(settings, { rng: rng(57) }), settings);
  }
});

for (const level of [1, 2, 3]) for (const oneStroke of [true, false]) {
  test(`connected mode, level ${level}, oneStroke ${oneStroke}: exact counts and geometry over 80 seeds`, () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const settings = config({ connectAll: true, level, oneStroke, rows: 3 + seed % 5,
        columns: 3 + (seed * 3) % 5, lineCount: 1 + seed % 8 });
      inspect(G.generateProblem(settings, { rng: rng(seed) }), settings);
    }
  });
}

test("connected OFF mode still permits branches, cycles and multiple drawing strokes", () => {
  let branch = false, cycle = false, multiple = false;
  const settings = config({ connectAll: true, rows: 4, columns: 4, lineCount: 10, oneStroke: false });
  for (let seed = 1; seed <= 100; seed += 1) {
    const problem = G.generateProblem(settings, { rng: rng(seed) });
    const degree = inspect(problem, settings);
    branch ||= [...degree.values()].some(value => value >= 3);
    cycle ||= problem.edges.length >= degree.size;
    multiple ||= problem.strokes.length > 1;
  }
  assert.ok(branch && cycle && multiple, JSON.stringify({ branch, cycle, multiple }));
});

test("connected boundaries, opt-out, validation and distinct rerolls", () => {
  assert.equal(G.DEFAULTS.connectAll, true);
  assert.equal(G.DEFAULTS.hintGoal, false);
  for (const settings of [config({ rows: 1, columns: 12, lineCount: 11 }),
    config({ rows: 12, columns: 1, lineCount: 11 }),
    config({ rows: 2, columns: 2, lineCount: 4, oneStroke: false }),
    ...[1, 2, 3].map(level => config({ rows: 12, columns: 12, lineCount: 60, level, oneStroke: false }))]) {
    const connected = { ...settings, connectAll: true };
    inspect(G.generateProblem(connected, { rng: rng(57) }), connected);
  }
  const settings = config({ oneStroke: false, lineCount: 2, connectAll: true });
  const disconnected = { ...settings, edges: [[0, 1], [8, 9]], strokes: [[0, 1], [8, 9]] };
  assert.ok(G.problemErrors(disconnected, settings).some(message => message.includes("ひとまとまり")));
  assert.deepEqual(G.problemErrors(disconnected, { ...settings, connectAll: false }), []);
  assert.throws(() => G.generateProblem({ ...settings, connectAll: "true" }), /設定/);
  const first = G.generateProblem(settings, { rng: rng(10) });
  const second = G.generateProblem(settings, { rng: rng(10), exclude: G.fingerprint(first) });
  inspect(second, settings);
  assert.notEqual(G.fingerprint(first), G.fingerprint(second));
  const impossible = { ...settings, rows: 1, columns: 2, lineCount: 2 };
  const started = Date.now();
  assert.throws(() => G.generateProblem(impossible), /本/);
  assert.ok(Date.now() - started < 1000);
});

test("invalid/impossible settings fail explicitly without mutation", () => {
  for (const settings of [config({ rows: 1, columns: 1 }), config({ rows: 1, level: 2 }),
    config({ rows: 2, columns: 2, level: 3 }), config({ rows: 2, columns: 2, lineCount: 4, easyOneStroke: true }),
    config({ rows: 1, columns: 2, lineCount: 2, oneStroke: false }), config({ lineCount: 2.5 }), config({ rows: 13 })]) {
    const before = JSON.stringify(settings);
    assert.throws(() => G.generateProblem(settings), /点|整数|レベル|本/);
    assert.equal(JSON.stringify(settings), before);
  }
});

for (const level of [1,2,3]) {
  test(`easy one-stroke level ${level} retains the original open simple paths over 80 seeds`, () => {
    for (let seed=1; seed<=80; seed+=1) {
      const settings = config({level,easyOneStroke:true,rows:3+seed%5,columns:3+(seed*3)%5,lineCount:1+seed%8});
      inspect(G.generateProblem(settings,{rng:rng(seed)}),settings);
    }
  });
}

test("ordinary generation actually produces revisits, shared-point branches and closed trails", () => {
  let revisit=false, branch=false, closed=false;
  for (let seed=1; seed<=160; seed+=1) {
    const settings = config({rows:3,columns:3,lineCount:seed%2?6:4,connectAll:false});
    const problem = G.generateProblem(settings,{rng:rng(seed)});
    const degree = inspect(problem,settings), path=problem.strokes[0];
    revisit ||= new Set(path).size < path.length;
    branch ||= [...degree.values()].some(value=>value>2);
    closed ||= path[0]===path.at(-1);
    assert.ok(G.linesConnected(problem.edges), "one-stroke remains connected even when connectAll is OFF");
  }
  assert.ok(revisit && branch && closed,JSON.stringify({revisit,branch,closed}));
});

test("ordinary one-stroke can exceed point-count minus one, but easy mode cannot", () => {
  assert.equal(G.DEFAULTS.easyOneStroke,false);
  for (const settings of [config({rows:2,columns:2,lineCount:4}),
    config({rows:2,columns:2,lineCount:5,level:2}),
    config({rows:3,columns:3,lineCount:10})]) {
    inspect(G.generateProblem(settings,{rng:rng(57)}),settings);
    assert.ok(G.configurationErrors({...settings,easyOneStroke:true}).some(error=>error.includes("やさしい")));
  }
  assert.ok(G.configurationErrors(config({easyOneStroke:"true"})).length);
  inspect(G.generateProblem(config({oneStroke:false,easyOneStroke:true})),config({oneStroke:false,easyOneStroke:true}));
});

test("search exhaustion is bounded and distinct rerolls never silently repeat", () => {
  const settings = config({ rows: 1, columns: 2, lineCount: 1 });
  const problem = G.generateProblem(settings);
  const started = Date.now();
  assert.throws(() => G.generateProblem(settings, { exclude: G.fingerprint(problem) }), /別の形/);
  assert.ok(Date.now() - started < 1000);
  const regular = config();
  const first = G.generateProblem(regular, { rng: rng(10) });
  const second = G.generateProblem(regular, { rng: rng(10), exclude: G.fingerprint(first) });
  assert.notEqual(G.fingerprint(first), G.fingerprint(second));
});

test("intersection predicate agrees with independent oracle for every pair on a 4x4 level3 grid", () => {
  const edges = G.candidates(config({ rows: 4, columns: 4, level: 3 }));
  for (const first of edges) for (const second of edges) {
    assert.equal(G.edgesConflict(first, second, 4), forbiddenIntersection(first, second, 4), `${first} / ${second}`);
  }
  assert.equal(G.edgesConflict([0, 1], [1, 2], 4), false, "adjacent intervals form a longer line");
  assert.equal(G.edgesConflict([0, 5], [1, 4], 4), true, "diagonals cross");
});
