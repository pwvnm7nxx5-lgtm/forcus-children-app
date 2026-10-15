(function () {
  "use strict";
  const G = window.DotCopyGenerator;
  const storageKey = "dot-copy-print-state-v1";
  const generationKeys = ["rows", "columns", "lineCount", "level", "oneStroke", "connectAll", "problemCount"];
  const hintKeys = ["hintUsed", "hintTrace", "hintStart"];
  const els = Object.fromEntries([...generationKeys, ...hintKeys, "perPage", "printPunchGuide", "worksheetTitle", "studentName",
    "generationFields", "pageCount", "pages", "printBtn", "regenerateBtn", "pendingNotice",
    "sizeWarning", "levelDescription", "status"].map(id => [id, document.getElementById(id)]));
  let problems = [];
  let applied = null;
  let busy = false;
  let activeWorker = null;
  let activeGeneration = null;
  let autoTimer = 0;
  let autoQueued = false;
  const ns = "http://www.w3.org/2000/svg";

  function setStatus(message, error = false) {
    els.status.textContent = message;
    els.status.classList.toggle("error", error);
  }
  function readGeneration() {
    return Object.fromEntries(generationKeys.map(key => [key, els[key].type === "checkbox" ? els[key].checked : Number(els[key].value)]));
  }
  function isPending() { return applied && JSON.stringify(readGeneration()) !== JSON.stringify(applied); }
  function inputErrors(settings) {
    const errors = G.configurationErrors(settings);
    const [min, max] = G.LIMITS.problems;
    if (!Number.isInteger(settings.problemCount) || settings.problemCount < min || settings.problemCount > max) {
      errors.push(`作成する問題数は${min}〜${max}の整数で指定してください。`);
    }
    return errors;
  }
  function updateControls() {
    const pending = Boolean(isPending());
    els.pendingNotice.hidden = !pending;
    els.regenerateBtn.disabled = busy;
    els.printBtn.disabled = busy || pending || !problems.length;
    els.pages.querySelectorAll(".reroll-btn").forEach(button => { button.disabled = busy || pending; });
    const descriptions = {
      1: "たて・よこに1区間ずつ結びます。長い直線は複数本として数えます。",
      2: "たて・よこと45度のななめ。45度の線を必ず1本以上含めます。",
      3: "縦1・横2、または縦2・横1のななめを必ず1本以上含めます。",
    };
    els.levelDescription.textContent = descriptions[els.level.value];
  }
  function runAutomaticRegeneration() {
    autoTimer = 0;
    if (busy) { autoQueued = true; return; }
    if (applied && !isPending()) return;
    regenerate();
  }
  function scheduleRegeneration(delay) {
    window.clearTimeout(autoTimer); autoTimer = 0; autoQueued = false;
    activeGeneration?.abort();
    updateControls();
    if (generationKeys.some(key => els[key].type === "number" && els[key].value === "")) {
      setStatus("条件の数値を入力すると、自動で問題を作り直します。");
      return;
    }
    const errors = inputErrors(readGeneration());
    if (errors.length) { setStatus(errors.join("\n"), true); return; }
    if (applied && !isPending()) { setStatus("現在の条件の問題を表示しています。"); return; }
    setStatus("条件に合わせて問題を作り直します…");
    autoTimer = window.setTimeout(runAutomaticRegeneration, delay);
  }
  function save() {
    if (!applied || !problems.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ applied, problems, perPage: Number(els.perPage.value),
        hints: Object.fromEntries(hintKeys.map(key => [key, els[key].checked])),
        name: els.studentName.value, title: els.worksheetTitle.value, punchGuide: els.printPunchGuide.value }));
    } catch { /* The current worksheet remains usable if storage is unavailable. */ }
  }
  function restore() {
    try {
      const text = localStorage.getItem(storageKey);
      if (!text || text.length > 250000) return false;
      const saved = JSON.parse(text);
      if (!saved.applied || inputErrors(saved.applied).length || !Array.isArray(saved.problems) ||
          saved.problems.length !== saved.applied.problemCount ||
          saved.problems.some(problem => G.problemErrors(problem, saved.applied).length)) return false;
      const legacy = saved.applied.connectAll === undefined;
      // Keep old shapes when already connected. Otherwise retain the old preview
      // and display settings until automatic regeneration succeeds with default ON.
      const connectAll = legacy ? saved.problems.every(problem => G.linesConnected(problem.edges)) : saved.applied.connectAll;
      applied = Object.fromEntries(generationKeys.map(key => [key, key === "connectAll" ? connectAll : saved.applied[key]]));
      problems = saved.problems.map(problem => ({ ...problem, connectAll }));
      for (const key of generationKeys) {
        if (els[key].type === "checkbox") els[key].checked = legacy && key === "connectAll" ? G.DEFAULTS.connectAll : applied[key];
        else els[key].value = String(applied[key]);
      }
      for (const key of hintKeys) els[key].checked = saved.hints?.[key] === true;
      if (G.LIMITS.perPage.includes(saved.perPage)) els.perPage.value = String(saved.perPage);
      if (["none", "left", "top"].includes(saved.punchGuide)) els.printPunchGuide.value = saved.punchGuide;
      els.studentName.value = typeof saved.name === "string" ? saved.name.slice(0, 24) : "";
      els.worksheetTitle.value = typeof saved.title === "string" ? saved.title.slice(0, 32) : "点つなぎ";
      return true;
    } catch { return false; }
  }

  // Match the CSS dimensions in mm; leave 4mm around grid extrema for start rings.
  function geometry(config) {
    const perPage = Number(els.perPage.value);
    const panelWidth = (186 - 6 - 0.5 - 8) / 2;
    const panelHeight = (241 - (perPage - 1) * 3) / perPage - 12.5;
    const spacing = Math.min((panelWidth - 8) / Math.max(1, config.columns - 1),
      (panelHeight - 8) / Math.max(1, config.rows - 1));
    return { spacing, width: (config.columns - 1) * spacing + 8, height: (config.rows - 1) * spacing + 8 };
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svgElement(tag, attributes) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  function makeDiagram(problem, model) {
    const { spacing, width, height } = geometry(problem);
    const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, width: `${width}mm`, height: `${height}mm`,
      role: "img", "aria-label": model ? "お手本の線と点" : "線を写す点の並び", "data-role": model ? "model" : "drawing" });
    const coords = id => {
      const p = G.point(id, problem.columns);
      return { x: 4 + p.x * spacing, y: 4 + p.y * spacing };
    };
    if (model || els.hintTrace.checked) {
      for (const edge of problem.edges) {
        const a = coords(edge[0]), b = coords(edge[1]);
        svg.append(svgElement("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          class: model ? "dot-model-line" : "dot-trace-line", "data-edge": G.edgeKey(edge) }));
      }
    }
    const used = new Set(problem.edges.flat());
    const starts = new Set(problem.strokes.map(stroke => stroke[0]));
    for (let id = 0; id < problem.rows * problem.columns; id += 1) {
      const { x, y } = coords(id);
      const isStart = els.hintStart.checked && starts.has(id);
      const r = isStart ? 1.05 : !model && els.hintUsed.checked && used.has(id) ? 1 : 0.65;
      svg.append(svgElement("circle", { cx: x, cy: y, r, class: "dot-point", "data-point": id }));
      if (isStart) svg.append(svgElement("circle", { cx: x, cy: y, r: 1.65, class: "dot-start-ring", "data-start": id }));
    }
    return svg;
  }
  function makeProblem(problem, index) {
    const card = element("section", "dot-problem");
    card.dataset.index = String(index);
    card.dataset.fingerprint = G.fingerprint(problem);
    card.setAttribute("aria-label", `問題${index + 1}`);
    const reroll = element("button", "reroll-btn", "この問題を作り直す");
    reroll.type = "button";
    reroll.setAttribute("aria-label", `問題${index + 1}だけ作り直す`);
    reroll.addEventListener("click", () => regenerate(index));
    const pair = element("div", "dot-pair");
    for (const model of [true, false]) {
      const panel = element("div", "dot-panel");
      const label = element("div", "dot-panel-label", model ? `${index + 1}　おてほん` : "かく ところ");
      const canvas = element("div", "dot-canvas");
      canvas.append(makeDiagram(problem, model));
      panel.append(label, canvas); pair.append(panel);
    }
    card.append(reroll, pair);
    return card;
  }
  function render() {
    const perPage = Number(els.perPage.value);
    const totalPages = Math.ceil(problems.length / perPage);
    const fragment = document.createDocumentFragment();
    for (let offset = 0; offset < problems.length; offset += perPage) {
      const page = element("section", "print-page");
      const content = element("div", "dot-page-content");
      page.append(content);
      if (els.printPunchGuide.value !== "none") {
        const position = els.printPunchGuide.value;
        const guide = element("div", `punch-guide punch-guide-${position}`, position === "left" ? "◀" : "▲");
        guide.setAttribute("aria-hidden", "true");
        content.append(guide);
      }
      const header = element("header", "dot-sheet-header");
      const heading = element("div", "dot-heading");
      const title = element("h2", "", els.worksheetTitle.value.trim() || "点つなぎ");
      if ([...title.textContent].length > 16) title.style.fontSize = "16px";
      const name = element("div", "dot-name", "なまえ ");
      const nameValue = element("span", "", els.studentName.value);
      nameValue.style.fontSize = `${Math.min(16, 260 / Math.max(1, [...els.studentName.value].length))}px`;
      name.append(nameValue);
      heading.append(title, name);
      header.append(heading, element("p", "dot-instruction", "おてほんと おなじように せんを ひこう"));
      if (els.hintStart.checked) header.append(element("p", "dot-start-note", "○は かきはじめの めじるし"));
      const list = element("div", "dot-problems");
      list.style.setProperty("--per-page", String(perPage));
      problems.slice(offset, offset + perPage).forEach((problem, i) => list.append(makeProblem(problem, offset + i)));
      const footer = element("footer", "dot-sheet-footer");
      footer.append(element("span", "", `たて${applied.rows}点 × よこ${applied.columns}点 / 線${applied.lineCount}本 / レベル${applied.level}`),
        element("span", "", `${offset / perPage + 1} / ${totalPages}`));
      content.append(header, list, footer); fragment.append(page);
    }
    els.pages.replaceChildren(fragment);
    els.pageCount.textContent = `${totalPages}枚`;
    const spacing = applied ? geometry(applied).spacing : Infinity;
    els.sizeWarning.hidden = spacing >= G.LIMITS.minimumSpacingMm;
    els.sizeWarning.textContent = `点の間隔が約${spacing.toFixed(1)}mmと小さめです。1ページの問題数を減らすと書きやすくなります。`;
    updateControls();
    fitPreview();
  }
  function fitPreview() {
    const firstPage = els.pages.firstElementChild;
    if (!firstPage) return;
    const available = els.pages.parentElement.clientWidth - 40;
    els.pages.style.zoom = String(Math.min(1, Math.max(0.2, available / firstPage.offsetWidth)));
  }
  function generateInWorker(config, count, exclude, signal) {
    function checkCancelled() {
      if (signal.aborted) throw new DOMException("作成を中止しました。", "AbortError");
    }
    checkCancelled();
    // The launcher can also be opened directly from disk. File URLs cannot
    // load an external Worker in Chrome/Edge; yield between bounded searches.
    if (location.protocol === "file:" || typeof Worker !== "function") {
      return (async () => {
        const result = [];
        for (let i = 0; i < count; i += 1) {
          await new Promise(resolve => window.setTimeout(resolve, 16));
          checkCancelled();
          result.push(G.generateProblem(config, { exclude: exclude[i] }));
          setStatus(`問題を作成中… ${i + 1} / ${count}問`);
        }
        return result;
      })();
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker("worker.js?v=20261015-4");
      activeWorker = worker;
      let finished = false;
      const onAbort = () => finish(new DOMException("作成を中止しました。", "AbortError"));
      const timeout = window.setTimeout(() => finish(new Error("作成が時間内に終わりませんでした。線を減らすか、点を増やしてお試しください。")), count * (G.LIMITS.durationMs + 200) + 5000);
      function finish(error, result) {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", onAbort);
        window.clearTimeout(timeout); worker.terminate();
        if (activeWorker === worker) activeWorker = null;
        if (error) reject(error); else resolve(result);
      }
      signal.addEventListener("abort", onAbort, { once: true });
      worker.onmessage = ({ data }) => {
        if (finished) return;
        if (data.type === "progress") setStatus(`問題を作成中… ${data.completed} / ${data.total}問`);
        if (data.type === "result") finish(null, data.problems);
        if (data.type === "error") finish(new Error(data.message));
      };
      worker.onerror = () => finish(new Error("作成処理を読み込めませんでした。ページを再読み込みしてください。"));
      worker.postMessage({ config, count, exclude });
    });
  }
  async function regenerate(index = null) {
    if (busy || (index !== null && isPending())) return;
    window.clearTimeout(autoTimer); autoTimer = 0; autoQueued = false;
    const config = readGeneration();
    const errors = inputErrors(config);
    if (errors.length) { setStatus(errors.join("\n"), true); updateControls(); return; }
    const controller = new AbortController();
    activeGeneration = controller;
    busy = true; updateControls(); setStatus("問題を作成中…");
    try {
      const exclude = index === null ? problems.map(problem => G.fingerprint(problem)) : [G.fingerprint(problems[index])];
      const matching = applied && JSON.stringify(config) === JSON.stringify(applied);
      const result = await generateInWorker(config, index === null ? config.problemCount : 1, matching ? exclude : [], controller.signal);
      if (controller.signal.aborted) return;
      if (result.some(problem => G.problemErrors(problem, config).length)) throw new Error("問題の検証に失敗しました。もう一度作成してください。");
      if (index === null) { problems = result; applied = config; }
      else problems[index] = result[0];
      render(); save();
      setStatus(index === null ? `${problems.length}問を作成しました。` : `問題${index + 1}だけ作り直しました。`);
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error.message + (problems.length ? "\n作成済みの問題は残しています。" : ""), true);
    } finally {
      if (activeGeneration === controller) activeGeneration = null;
      busy = false; updateControls();
      if (autoQueued && !autoTimer) { autoQueued = false; runAutomaticRegeneration(); }
    }
  }

  for (const [key, range] of [["rows", G.LIMITS.dots], ["columns", G.LIMITS.dots],
    ["lineCount", G.LIMITS.lines], ["problemCount", G.LIMITS.problems]]) {
    els[key].min = String(range[0]); els[key].max = String(range[1]); els[key].value = String(G.DEFAULTS[key]);
  }
  els.level.value = String(G.DEFAULTS.level); els.oneStroke.checked = G.DEFAULTS.oneStroke;
  els.connectAll.checked = G.DEFAULTS.connectAll;
  for (const key of hintKeys) els[key].checked = G.DEFAULTS[key];
  for (const count of G.LIMITS.perPage) {
    const option = element("option", "", `${count}問`); option.value = String(count); els.perPage.append(option);
  }
  els.perPage.value = String(G.DEFAULTS.perPage);
  for (const key of generationKeys) {
    els[key].addEventListener("input", () => scheduleRegeneration(els[key].type === "number" ? 300 : 0));
    els[key].addEventListener("change", () => {
      if (autoTimer) { window.clearTimeout(autoTimer); runAutomaticRegeneration(); }
    });
  }
  for (const key of [...hintKeys, "perPage", "printPunchGuide"]) els[key].addEventListener("change", () => { render(); save(); });
  for (const key of ["studentName", "worksheetTitle"]) els[key].addEventListener("input", () => { render(); save(); });
  els.regenerateBtn.addEventListener("click", () => regenerate());
  els.printBtn.addEventListener("click", () => { if (!els.printBtn.disabled) window.print(); });
  window.addEventListener("resize", fitPreview);
  window.addEventListener("pagehide", () => {
    window.clearTimeout(autoTimer); autoTimer = 0; autoQueued = false;
    activeGeneration?.abort();
    activeWorker?.terminate();
  });
  if (restore()) {
    render(); setStatus("前回の問題を表示しています。");
    if (isPending()) scheduleRegeneration(0);
    else save();
  }
  else regenerate();
})();
