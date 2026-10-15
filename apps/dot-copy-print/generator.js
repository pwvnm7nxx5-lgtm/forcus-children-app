(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DotCopyGenerator = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  // Defaults, ranges and search limits are intentionally kept in one place.
  const DEFAULTS = Object.freeze({ rows: 5, columns: 5, lineCount: 5, level: 1,
    oneStroke: true, easyOneStroke: false, connectAll: true, problemCount: 4, perPage: 4,
    hintUsed: false, hintTrace: false, hintStart: false, hintGoal: false });
  const LIMITS = Object.freeze({ dots: [1, 12], lines: [1, 60], problems: [1, 60],
    perPage: [1, 2, 4], attempts: 40, searchNodes: 24000, durationMs: 350,
    minimumSpacingMm: 7 });

  function point(id, columns) { return { x: id % columns, y: Math.floor(id / columns) }; }
  function edgeKey(edge) { return [...edge].sort((a, b) => a - b).join("-"); }
  function fingerprint(problem) { return problem.edges.map(edgeKey).sort().join(","); }
  function linesConnected(edges) {
    if (!edges.length) return false;
    const adjacency = new Map();
    for (const [a, b] of edges) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push(b); adjacency.get(b).push(a);
    }
    const visited = new Set([edges[0][0]]);
    const pending = [edges[0][0]];
    while (pending.length) {
      for (const next of adjacency.get(pending.pop())) {
        if (visited.has(next)) continue;
        visited.add(next); pending.push(next);
      }
    }
    return visited.size === adjacency.size;
  }
  function edgeLevel(edge, columns) {
    const a = point(edge[0], columns), b = point(edge[1], columns);
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx + dy === 1) return 1;
    if (dx === 1 && dy === 1) return 2;
    if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) return 3;
    return 0;
  }

  function candidates(config) {
    const result = [];
    const moves = [[1, 0], [0, 1]];
    if (config.level >= 2) moves.push([1, 1], [-1, 1]);
    if (config.level >= 3) moves.push([2, 1], [-2, 1], [1, 2], [-1, 2]);
    for (let y = 0; y < config.rows; y += 1) {
      for (let x = 0; x < config.columns; x += 1) {
        for (const [dx, dy] of moves) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < config.columns && ny >= 0 && ny < config.rows) {
            result.push([y * config.columns + x, ny * config.columns + nx]);
          }
        }
      }
    }
    return result;
  }

  function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
  // Touching at a shared grid point is legal. Interior crossings, T-touches,
  // collinear overlaps and duplicated undirected edges are not.
  function edgesConflict(first, second, columns) {
    const shared = first.find(id => second.includes(id));
    const a = point(first[0], columns), b = point(first[1], columns);
    const c = point(second[0], columns), d = point(second[1], columns);
    if (shared !== undefined) {
      const origin = point(shared, columns);
      const u = point(first.find(id => id !== shared) ?? shared, columns);
      const v = point(second.find(id => id !== shared) ?? shared, columns);
      return cross(origin, u, v) === 0 &&
        (u.x - origin.x) * (v.x - origin.x) + (u.y - origin.y) * (v.y - origin.y) > 0;
    }
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
        Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
    return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
  }

  function configurationErrors(config) {
    const errors = [];
    const checks = [["rows", "縦の点の数", LIMITS.dots], ["columns", "横の点の数", LIMITS.dots],
      ["lineCount", "線の本数", LIMITS.lines]];
    for (const [key, label, [min, max]] of checks) {
      if (!Number.isInteger(config[key]) || config[key] < min || config[key] > max) {
        errors.push(`${label}は${min}〜${max}の整数で指定してください。`);
      }
    }
    if (![1, 2, 3].includes(config.level)) errors.push("線のレベルは1〜3で指定してください。");
    if (typeof config.oneStroke !== "boolean") errors.push("一筆書きの設定を確認してください。");
    if (config.easyOneStroke !== undefined && typeof config.easyOneStroke !== "boolean") errors.push("やさしい一筆書きの設定を確認してください。");
    if (config.connectAll !== undefined && typeof config.connectAll !== "boolean") errors.push("全ての点を繋げる設定を確認してください。");
    if (errors.length) return errors;
    const pool = candidates(config);
    if (!pool.some(edge => edgeLevel(edge, config.columns) === config.level)) {
      const reason = config.level === 3 ? "縦1・横2、または縦2・横1の斜め線を置く点がありません。" :
        config.level === 2 ? "45度の斜め線には縦・横とも2点以上が必要です。" : "線を結ぶには2点以上が必要です。";
      errors.push(`レベル${config.level}では作成できません。${reason}`);
    }
    if (config.oneStroke && config.easyOneStroke && config.lineCount > config.rows * config.columns - 1) {
      errors.push(`やさしい一筆書きでは、${config.rows * config.columns}点に対して線は最大${config.rows * config.columns - 1}本です。同じ点を2度通れません。`);
    }
    const planarBound = config.rows === 1 || config.columns === 1 ? config.rows * config.columns - 1 :
      config.level === 1 ? pool.length : 3 * config.rows * config.columns - 6;
    if (config.lineCount > Math.min(pool.length, planarBound)) {
      errors.push("この点の配置とレベルでは、交差・重複なしで指定本数の線を置けません。線の本数を減らすか、点を増やしてください。");
    }
    return errors;
  }

  function shuffle(items, rng) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Hierholzer's algorithm: splice loops into one trail, instead of ending
  // early when a greedy choice reaches a dead end. Vertex revisits are legal.
  function eulerTrail(edges) {
    if (!edges.length || !linesConnected(edges)) return null;
    const adjacency = new Map();
    edges.forEach(([a, b], index) => {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push({ next: b, index }); adjacency.get(b).push({ next: a, index });
    });
    const odd = [...adjacency.keys()].filter(id => adjacency.get(id).length % 2);
    if (odd.length !== 0 && odd.length !== 2) return null;
    const used = new Set(), stack = [odd[0] ?? edges[0][0]], path = [];
    while (stack.length) {
      const choices = adjacency.get(stack[stack.length - 1]);
      while (choices.length && used.has(choices[choices.length - 1].index)) choices.pop();
      if (!choices.length) path.push(stack.pop());
      else {
        const edge = choices.pop(); used.add(edge.index); stack.push(edge.next);
      }
    }
    return used.size === edges.length ? path.reverse() : null;
  }

  // OFF mode can use several trails; every edge is consumed once.
  // These are example drawing strokes, not prescribed student stroke orders.
  function drawingStrokes(edges) {
    const remaining = new Map(edges.map(edge => [edgeKey(edge), edge]));
    const strokes = [];
    while (remaining.size) {
      const degree = new Map();
      for (const edge of remaining.values()) for (const id of edge) degree.set(id, (degree.get(id) || 0) + 1);
      let current = [...degree.keys()].find(id => degree.get(id) % 2 === 1) ?? degree.keys().next().value;
      const stroke = [current];
      while (true) {
        const next = [...remaining.entries()].find(([, edge]) => edge.includes(current));
        if (!next) break;
        remaining.delete(next[0]);
        current = next[1][0] === current ? next[1][1] : next[1][0];
        stroke.push(current);
      }
      strokes.push(stroke);
    }
    return strokes;
  }

  function generateProblem(config, options = {}) {
    const errors = configurationErrors(config);
    if (errors.length) throw new Error(errors.join("\n"));
    const rng = options.rng || Math.random;
    const pool = candidates(config);
    const required = pool.filter(edge => edgeLevel(edge, config.columns) === config.level);
    const deadline = Date.now() + LIMITS.durationMs;
    let nodes = 0;
    let rejectedSame = false;
    const adjacency = Array.from({ length: config.rows * config.columns }, () => []);
    for (const edge of pool) for (const id of edge) adjacency[id].push(edge);
    function hasBudget() { nodes += 1; return nodes <= LIMITS.searchNodes && Date.now() <= deadline; }
    function fits(edge, chosen) { return !chosen.some(other => edgesConflict(edge, other, config.columns)); }
    function accept(edges, strokes) {
      const problem = { ...config, edges: edges.map(edge => [...edge]), strokes: strokes.map(stroke => [...stroke]) };
      if (options.exclude && fingerprint(problem) === options.exclude) { rejectedSame = true; return null; }
      return problem;
    }

    for (let attempt = 0; attempt < LIMITS.attempts && hasBudget(); attempt += 1) {
      let seed = required[Math.floor(rng() * required.length)];
      if (rng() < 0.5) seed = [seed[1], seed[0]];
      if (config.oneStroke) {
        const easy = config.easyOneStroke === true;
        const path = [...seed], edges = [seed], used = new Set(path);
        function extend() {
          if (!hasBudget()) return null;
          if (edges.length === config.lineCount) return accept(edges, [path]);
          // Grow either end: a mandatory diagonal may need to lie inside the
          // final path, especially on small grids with many requested lines.
          const choices = shuffle([true, false].flatMap(atHead => {
            const end = atHead ? path[0] : path[path.length - 1];
            return adjacency[end].map(edge => ({ edge, atHead, next: edge[0] === end ? edge[1] : edge[0] }));
          }), rng);
          for (const { edge, atHead, next } of choices) {
            if ((easy && used.has(next)) || !fits(edge, edges)) continue;
            if (atHead) path.unshift(next); else path.push(next);
            if (easy) used.add(next);
            edges.push(edge);
            const result = extend();
            if (result) return result;
            edges.pop(); if (easy) used.delete(next);
            if (atHead) path.shift(); else path.pop();
            if (nodes > LIMITS.searchNodes || Date.now() > deadline) break;
          }
          return null;
        }
        const result = extend();
        if (result) return result;
      } else if (config.connectAll) {
        const edges = [seed], used = new Set(seed);
        // Grow a single component. Recompute the frontier after each addition:
        // edges that were separate may become reachable as the figure grows.
        while (edges.length < config.lineCount && hasBudget()) {
          const frontier = pool.filter(edge => edge.some(id => used.has(id)) && fits(edge, edges));
          if (!frontier.length) break;
          const edge = frontier[Math.floor(rng() * frontier.length)];
          edges.push(edge); edge.forEach(id => used.add(id));
        }
        if (edges.length === config.lineCount) {
          const result = accept(edges, drawingStrokes(edges));
          if (result) return result;
        }
      } else {
        const edges = [seed];
        const order = shuffle(pool, rng);
        const mode = Math.floor(rng() * 3);
        // Encourage branches or disconnected strokes where the settings allow.
        // The third mode leaves closures to random planar edge selection.
        if (mode === 0 && config.lineCount >= 3) {
          for (const center of shuffle([...adjacency.keys()], rng)) {
            const branch = shuffle(adjacency[center], rng).filter(edge => edgeKey(edge) !== edgeKey(seed));
            const trial = [...edges];
            for (const edge of branch) {
              if (trial.length >= config.lineCount || trial.filter(e => e.includes(center)).length >= 3) break;
              if (fits(edge, trial)) trial.push(edge);
            }
            if (trial.filter(edge => edge.includes(center)).length >= 3) { edges.splice(0, edges.length, ...trial); break; }
          }
        } else if (mode === 1 && config.lineCount >= 2) {
          const separate = order.find(edge => !edge.some(id => seed.includes(id)) && fits(edge, edges));
          if (separate) edges.push(separate);
        }
        for (const edge of order) {
          if (edges.length === config.lineCount || !hasBudget()) break;
          if (fits(edge, edges)) edges.push(edge);
        }
        if (edges.length === config.lineCount) {
          const result = accept(edges, drawingStrokes(edges));
          if (result) return result;
        }
      }
    }
    throw new Error(rejectedSame ? "この条件で別の形を作成できませんでした。点や線の数を変えるか、もう一度作り直してください。" :
      "交差・重複を避けて指定条件を満たす形を、探索上限内に見つけられませんでした。同じ条件でもう一度試すか、線を減らす・点を増やす方法をお試しください。条件は変更していません。");
  }

  function problemErrors(problem, config = problem) {
    const errors = configurationErrors(config);
    if (errors.length) return errors;
    if (!Array.isArray(problem.edges) || !Array.isArray(problem.strokes)) return ["問題データが不正です。"];
    const total = config.rows * config.columns;
    if (problem.edges.length !== config.lineCount) errors.push("線の本数が一致しません。");
    if (problem.rows !== config.rows || problem.columns !== config.columns) errors.push("点の配置が一致しません。");
    const degree = new Map();
    for (const edge of problem.edges) {
      if (!Array.isArray(edge) || edge.length !== 2 || edge.some(id => !Number.isInteger(id) || id < 0 || id >= total)) return ["点番号が不正です。"];
      const level = edgeLevel(edge, config.columns);
      if (!level || level > config.level) errors.push("許可されていない方向の線です。");
      for (const id of edge) degree.set(id, (degree.get(id) || 0) + 1);
    }
    if (!problem.edges.some(edge => edgeLevel(edge, config.columns) === config.level)) errors.push("指定レベルの追加方向がありません。");
    if (config.connectAll && !linesConnected(problem.edges)) errors.push("使う点と線がひとまとまりに繋がっていません。");
    for (let i = 0; i < problem.edges.length; i += 1) for (let j = 0; j < i; j += 1) {
      if (edgesConflict(problem.edges[i], problem.edges[j], config.columns)) errors.push("線が交差または重複しています。");
    }
    const walked = [];
    for (const stroke of problem.strokes) {
      if (!Array.isArray(stroke) || stroke.length < 2 || stroke.some(id => !Number.isInteger(id) || id < 0 || id >= total)) return ["描画順が不正です。"];
      for (let i = 1; i < stroke.length; i += 1) walked.push(edgeKey([stroke[i - 1], stroke[i]]));
    }
    if (walked.sort().join(",") !== problem.edges.map(edgeKey).sort().join(",")) errors.push("描画順が全線を1回ずつ通りません。");
    if (config.oneStroke) {
      const stroke = problem.strokes[0] || [];
      if (!eulerTrail(problem.edges) || problem.strokes.length !== 1 || stroke.length !== config.lineCount + 1) {
        errors.push("同じ線を重ねずに一筆で全ての線を描ける形と描画順にしてください。");
      }
      if (config.easyOneStroke && (new Set(stroke).size !== config.lineCount + 1 ||
          [...degree.values()].some(value => value > 2) || degree.get(stroke[0]) !== 1 || degree.get(stroke[stroke.length - 1]) !== 1)) {
        errors.push("やさしい一筆書きでは、同じ点を2度通らない開いた一本道にしてください。");
      }
    }
    return errors;
  }

  return { DEFAULTS, LIMITS, point, edgeKey, fingerprint, linesConnected, edgeLevel, candidates, edgesConflict,
    configurationErrors, generateProblem, eulerTrail, drawingStrokes, problemErrors };
});
