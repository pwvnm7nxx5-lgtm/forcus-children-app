"use strict";
importScripts("generator.js?v=20261015-8");
self.onmessage = ({ data }) => {
  try {
    const problems = [];
    for (let i = 0; i < data.count; i += 1) {
      problems.push(DotCopyGenerator.generateProblem(data.config, { exclude: data.exclude?.[i] }));
      self.postMessage({ type: "progress", completed: i + 1, total: data.count });
    }
    self.postMessage({ type: "result", problems });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
