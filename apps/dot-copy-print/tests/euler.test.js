const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../generator.js");
const M = require("../manual-model.js");
const config = overrides => ({...G.DEFAULTS,rows:3,columns:3,lineCount:6,...overrides});
const report = [[3,4],[4,1],[1,2],[2,5],[5,4],[4,7]];

function inspectTrail(edges,path) {
  assert.ok(path);
  assert.equal(path.length,edges.length+1);
  assert.deepEqual(path.slice(1).map((next,i)=>G.edgeKey([path[i],next])).sort(),edges.map(G.edgeKey).sort());
}

test("reported shared-point shape is one ordinary stroke with valid start/goal and is not easy", () => {
  const problem=M.makeProblem(config(),report);
  assert.deepEqual(G.problemErrors(problem),[]);
  assert.equal(problem.strokes.length,1);
  inspectTrail(report,problem.strokes[0]);
  assert.deepEqual([problem.strokes[0][0],problem.strokes[0].at(-1)].sort((a,b)=>a-b),[3,7]);
  assert.equal(problem.strokes[0].filter(id=>id===4).length,2);
  assert.throws(()=>M.makeProblem(config({easyOneStroke:true}),report),/やさしい一筆書き/);
});

test("loop insertion works even when a greedy stroke would stop early", () => {
  const trap=[[3,4],[4,7],[4,1],[1,2],[2,5],[5,4]];
  assert.ok(G.drawingStrokes(trap).length>1,"fixture must expose the old greedy traversal");
  inspectTrail(trap,G.eulerTrail(trap));
  assert.equal(M.makeProblem(config(),trap).strokes.length,1);
  function* permutations(items) {
    if (!items.length) { yield []; return; }
    for (let i=0;i<items.length;i+=1) for (const rest of permutations(items.filter((_,j)=>j!==i))) yield [items[i],...rest];
  }
  for (const edges of permutations(report)) inspectTrail(edges,G.eulerTrail(edges.map((edge,i)=>i%2?[edge[1],edge[0]]:edge)));
});

test("Euler existence agrees with an independent oracle on every nonempty 3x3 grid edge subset", () => {
  const pool=G.candidates(config({level:1}));
  for (let mask=1;mask<1<<pool.length;mask+=1) {
    const edges=pool.filter((_,i)=>mask&(1<<i));
    const degree=new Map(), parent=new Map();
    const root=id=>parent.get(id)===id?id:root(parent.get(id));
    for (const [a,b] of edges) {
      for (const id of [a,b]) { degree.set(id,(degree.get(id)||0)+1); if(!parent.has(id))parent.set(id,id); }
      parent.set(root(a),root(b));
    }
    const components=new Set([...parent.keys()].map(root)).size;
    const odd=[...degree.values()].filter(value=>value%2).length;
    const expected=components===1&&(odd===0||odd===2);
    const trail=G.eulerTrail(edges);
    assert.equal(trail!==null,expected,`edge mask ${mask}`);
    if (expected) {
      inspectTrail(edges,trail);
      const problem=M.makeProblem(config({lineCount:edges.length}),edges);
      assert.deepEqual(G.problemErrors(problem),[]);
    } else assert.throws(()=>M.makeProblem(config({lineCount:edges.length}),edges),/一筆書き/);
  }
});

test("closed loops, figure eight and a degree-three endpoint are legal; disconnected/odd branching is not", () => {
  const square=[[0,1],[1,4],[4,3],[3,0]];
  const eight=[...square,[4,5],[5,8],[8,7],[7,4]];
  const endpoint=[...square,[3,6]];
  for (const edges of [square,eight]) {
    const problem=M.makeProblem(config(),edges);
    inspectTrail(edges,problem.strokes[0]);
    assert.equal(problem.strokes[0][0],problem.strokes[0].at(-1));
    assert.throws(()=>M.makeProblem(config({easyOneStroke:true}),edges),/やさしい一筆書き/);
  }
  inspectTrail(endpoint,G.eulerTrail(endpoint));
  inspectTrail(endpoint,M.makeProblem(config(),endpoint).strokes[0]);
  assert.equal(G.eulerTrail([[0,1],[4,5]]),null);
  assert.equal(G.eulerTrail([[0,1],[1,2],[1,4]]),null);
  assert.equal(G.eulerTrail([]),null);
  const crossing=[[0,4],[4,1],[1,3],[3,0]];
  assert.ok(G.eulerTrail(crossing),"crossing has a graph trail but invalid worksheet geometry");
  assert.throws(()=>M.makeProblem(config({level:2}),crossing),/交差/);
});

test("Euler-impossible automatic settings terminate within the search budget", () => {
  // All 12 edges of the 3x3 square grid have four odd-degree vertices.
  const started=Date.now();
  assert.throws(()=>G.generateProblem(config({lineCount:12})),/探索上限/);
  assert.ok(Date.now()-started<1200);
});
