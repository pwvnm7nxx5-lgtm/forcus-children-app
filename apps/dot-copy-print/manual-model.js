(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./generator.js"));
  else root.DotCopyManual = factory(root.DotCopyGenerator);
})(typeof globalThis === "object" ? globalThis : this, function (G) {
  "use strict";

  function validPoint(id, config) {
    return Number.isInteger(id) && id >= 0 && id < config.rows * config.columns;
  }

  // Drafts may temporarily be disconnected or not one-stroke. Geometry is
  // checked while drawing; all worksheet constraints are checked before save.
  function toggleLine(config, edges, from, to) {
    if (!validPoint(from, config) || !validPoint(to, config) || from === to) {
      throw new Error("異なる2つの点を選んでください。");
    }
    const edge = [from, to], key = G.edgeKey(edge);
    const existing = edges.findIndex(other => G.edgeKey(other) === key);
    if (existing !== -1) return edges.filter((_, index) => index !== existing).map(other => [...other]);
    const level = G.edgeLevel(edge, config.columns);
    if (!level || level > config.level) {
      throw new Error(`レベル${config.level}で使える向き・長さの線を選んでください。長い直線は間の点を順に選びます。`);
    }
    if (edges.length >= G.LIMITS.lines[1]) throw new Error(`線は最大${G.LIMITS.lines[1]}本までです。`);
    if (edges.some(other => G.edgesConflict(edge, other, config.columns))) {
      throw new Error("線が交差・重複するため引けません。別の点を選んでください。");
    }
    return [...edges.map(other => [...other]), edge];
  }

  function makeProblem(config, edges) {
    if (!Array.isArray(edges) || !edges.length) throw new Error("線を1本以上引いてください。");
    if (edges.length > G.LIMITS.lines[1]) throw new Error(`線は最大${G.LIMITS.lines[1]}本までです。`);
    if (edges.some(edge => !Array.isArray(edge) || edge.length !== 2 || edge.some(id => !validPoint(id, config)))) {
      throw new Error("点番号が不正です。");
    }
    const copied = edges.map(edge => [...edge]);
    const trail = config.oneStroke ? G.eulerTrail(copied) : null;
    if (config.oneStroke && !trail) throw new Error("この形は一筆書きできません。同じ線を重ねず全ての線が描けるように繋ぎ方を変えるか、「一筆書き」をOFFにしてください。");
    const problem = { ...config, lineCount: copied.length, manual: true, edges: copied,
      strokes: config.oneStroke ? [trail] : G.drawingStrokes(copied) };
    const errors = G.problemErrors(problem);
    if (errors.length) throw new Error([...new Set(errors)].join("\n"));
    return problem;
  }

  function draftErrors(config, edges) {
    try { makeProblem(config, edges); return []; }
    catch (error) { return [error.message]; }
  }

  // Automatic problems still use the exact configured line count. Only an
  // explicitly hand-made problem stores its own verified actual line count.
  function worksheetProblemErrors(problem, config) {
    return G.problemErrors(problem, problem.manual === true ? { ...config, lineCount: problem.lineCount } : config);
  }

  return { toggleLine, makeProblem, draftErrors, worksheetProblemErrors };
});
