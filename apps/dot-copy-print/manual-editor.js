(function () {
  "use strict";
  const G = window.DotCopyGenerator, M = window.DotCopyManual;
  const ns = "http://www.w3.org/2000/svg";

  window.DotCopyManualEditor = function (dialog) {
    const find = id => dialog.querySelector(`#${id}`);
    const grid = find("manualGrid"), title = find("manualTitle"), summary = find("manualSummary");
    const count = find("manualCount"), notice = find("manualStatus"), error = find("manualError");
    const undo = find("manualUndo"), clear = find("manualClear"), separate = find("manualSeparate"), save = find("manualSave");
    let config, edges = [], history = [], selected = null, focused = 0, onSave;

    function svg(tag, attributes) {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      return node;
    }
    function setError(message = "") { error.textContent = message; }
    function draw() {
      const coords = id => ({ x: 24 + id % config.columns * 48, y: 24 + Math.floor(id / config.columns) * 48 });
      const hadFocus = grid.contains(document.activeElement);
      grid.setAttribute("viewBox", `0 0 ${config.columns * 48} ${config.rows * 48}`);
      const fragment = document.createDocumentFragment();
      for (const edge of edges) {
        const a = coords(edge[0]), b = coords(edge[1]);
        fragment.append(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "manual-line" }));
      }
      for (let id = 0; id < config.rows * config.columns; id += 1) {
        const { x, y } = coords(id);
        const point = svg("g", { role: "button", tabindex: id === focused ? 0 : -1, "data-point": id,
          "aria-label": `${Math.floor(id / config.columns) + 1}行${id % config.columns + 1}列の点`,
          "aria-pressed": id === selected, class: "manual-point" });
        point.append(svg("circle", { cx: x, cy: y, r: 21, class: "manual-hit" }),
          svg("circle", { cx: x, cy: y, r: 12, class: "manual-selection" }),
          svg("circle", { cx: x, cy: y, r: 3.5, class: "manual-dot" }));
        point.addEventListener("click", () => choose(id));
        point.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(id); return; }
          const row = Math.floor(id / config.columns), col = id % config.columns;
          const moves = { ArrowLeft: col > 0 ? id - 1 : id, ArrowRight: col < config.columns - 1 ? id + 1 : id,
            ArrowUp: row > 0 ? id - config.columns : id, ArrowDown: row < config.rows - 1 ? id + config.columns : id,
            Home: row * config.columns, End: (row + 1) * config.columns - 1 };
          if (moves[event.key] !== undefined) {
            event.preventDefault(); focused = moves[event.key];
            grid.querySelectorAll(".manual-point").forEach(node => node.setAttribute("tabindex", Number(node.dataset.point) === focused ? "0" : "-1"));
            grid.querySelector(`[data-point="${focused}"]`).focus();
          }
        });
        fragment.append(point);
      }
      grid.replaceChildren(fragment);
      count.textContent = `線 ${edges.length}本（最大${G.LIMITS.lines[1]}本）`;
      const errors = M.draftErrors(config, edges);
      notice.textContent = errors.length ? errors.join("\n") : "このお手本を保存できます。";
      notice.classList.toggle("error", Boolean(errors.length));
      save.disabled = Boolean(errors.length);
      undo.disabled = !history.length; clear.disabled = !edges.length; separate.disabled = selected === null;
      if (hadFocus) grid.querySelector(`[data-point="${focused}"]`).focus();
    }
    function remember() {
      history.push(edges.map(edge => [...edge]));
      if (history.length > 100) history.shift();
    }
    function choose(id) {
      focused = id; setError();
      if (selected === null || selected === id) { selected = selected === id ? null : id; draw(); return; }
      try {
        const next = M.toggleLine(config, edges, selected, id);
        remember(); edges = next; selected = id; draw();
      } catch (failure) { setError(failure.message); }
    }
    undo.addEventListener("click", () => {
      if (!history.length) return;
      edges = history.pop(); selected = null; setError(); draw();
    });
    clear.addEventListener("click", () => {
      if (!edges.length) return;
      remember(); edges = []; selected = null; setError(); draw();
    });
    separate.addEventListener("click", () => { selected = null; setError(); draw(); });
    find("manualCancel").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { edges = []; history = []; onSave = null; });
    save.addEventListener("click", () => {
      try {
        const problem = M.makeProblem(config, edges);
        onSave(problem); dialog.close();
      } catch (failure) { setError(failure.message); }
    });
    return {
      open(problem, settings, index, commit) {
        config = { ...settings }; edges = problem.edges.map(edge => [...edge]);
        history = []; selected = null; focused = 0; onSave = commit;
        title.textContent = `問題${index + 1}のお手本を手動で作る`;
        summary.textContent = `縦${config.rows}×横${config.columns}点 ／ レベル${config.level} ／ 一筆書き${config.oneStroke ? config.easyOneStroke ? "ON（やさしい）" : "ON（通常）" : "OFF"} ／ ひとまとまり${config.connectAll ? "ON" : "OFF"}`;
        setError(); draw(); dialog.showModal(); find("manualCancel").focus();
      },
    };
  };
})();
