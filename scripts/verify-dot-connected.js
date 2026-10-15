// Run in a disposable playwright-cli Chrome/Edge session opened at this app.
async (page) => {
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const channel = (await page.evaluate(() => navigator.userAgent)).includes("Edg/") ? "edge" : "chrome";
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("dot-copy-print-state-v1")));
  const shapes = async () => (await state()).problems.map(problem => problem.edges);
  const wait = async () => {
    await page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
    check(!await page.locator("#status").evaluate(node => node.classList.contains("error")), await page.locator("#status").textContent());
  };
  const connected = async () => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    return saved.applied.connectAll && saved.problems.every(problem =>
      window.DotCopyGenerator.linesConnected(problem.edges) && !window.DotCopyGenerator.problemErrors(problem, saved.applied).length);
  });
  await page.evaluate(() => localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload(); await wait();
  check(await page.locator("#connectAll").isChecked(), "default must be ON");
  check(await page.locator("#connectAll").evaluate(node => Boolean(
    document.querySelector("#oneStroke").compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)), "checkbox must follow oneStroke");
  await page.locator("#oneStroke").uncheck(); await wait();
  check(await connected(), "OFF oneStroke should still be connected");
  check((await state()).problems.every(problem => problem.edges.length === 5), "line count changed");
  for (const level of [2, 3, 1]) {
    await page.locator("#level").selectOption(String(level)); await wait();
    check(await connected(), `level ${level} disconnected`);
  }
  const before = await shapes();
  for (const key of ["hintUsed", "hintTrace", "hintStart"]) await page.locator(`#${key}`).check();
  check(JSON.stringify(await shapes()) === JSON.stringify(before), "hints changed shapes");
  check(await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    return [...document.querySelectorAll(".dot-problem")].every((card, i) => {
      const problem = saved.problems[i];
      const starts = [...new Set(problem.strokes.map(stroke => stroke[0]))].sort((a,b) => a-b);
      return [...card.querySelectorAll("svg")].every(svg => {
        const rings = [...svg.querySelectorAll(".dot-start-ring")].map(node => Number(node.dataset.start)).sort((a,b) => a-b);
        const edges = [...svg.querySelectorAll("line")].map(node => node.dataset.edge).sort();
        return JSON.stringify(rings) === JSON.stringify(starts) &&
          JSON.stringify(edges) === JSON.stringify(problem.edges.map(window.DotCopyGenerator.edgeKey).sort());
      });
    });
  }), "connected hint geometry or stroke starts do not match");
  await page.locator('[aria-label="問題2だけ作り直す"]').click(); await wait();
  const after = await shapes();
  check(after.every((edges, i) => i === 1 ? JSON.stringify(edges) !== JSON.stringify(before[i]) : JSON.stringify(edges) === JSON.stringify(before[i])), "single reroll affected other shapes");
  check(await connected(), "reroll disconnected");
  await page.reload(); await wait();
  check(JSON.stringify(await shapes()) === JSON.stringify(after), "reload changed shapes");
  await page.locator("#connectAll").uncheck(); await wait();
  check(!(await state()).applied.connectAll, "opt-out not applied");
  await page.reload(); await wait();
  check(!await page.locator("#connectAll").isChecked(), "explicit OFF not restored");

  // Upgrade an old disconnected worksheet without losing the teacher's fields.
  await page.evaluate(() => {
    const config = { rows: 5, columns: 5, lineCount: 5, level: 1, oneStroke: false, problemCount: 4 };
    const edges = [[0,1],[1,2],[10,11],[11,16],[16,17]];
    localStorage.setItem("dot-copy-print-state-v1", JSON.stringify({ applied: config,
      problems: Array.from({length:4}, () => ({...config, edges, strokes: window.DotCopyGenerator.drawingStrokes(edges)})),
      title: "保存済み教材", name: "なまえ", hints: {hintStart:true}, perPage:4, punchGuide:"left" }));
  });
  await page.reload(); await wait();
  check(await connected(), "legacy disconnected worksheet not regenerated");
  check(await page.locator("#worksheetTitle").inputValue() === "保存済み教材" && await page.locator("#studentName").inputValue() === "なまえ", "legacy fields lost");
  check(await page.locator("#hintStart").isChecked() && await page.locator("#printPunchGuide").inputValue() === "left", "legacy hints/punch lost");
  const legacyShapes = await shapes();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    delete saved.applied.connectAll;
    saved.problems.forEach(problem => { delete problem.connectAll; });
    localStorage.setItem("dot-copy-print-state-v1", JSON.stringify(saved));
  });
  await page.reload(); await wait();
  check(await connected() && JSON.stringify(await shapes()) === JSON.stringify(legacyShapes), "legacy connected shapes were not preserved");

  // Exercise the same new option without Worker, as used for direct-file apps.
  await page.addInitScript(() => { window.Worker = undefined; });
  await page.reload(); await wait();
  await page.locator("#connectAll").uncheck(); await wait();
  await page.locator("#connectAll").check(); await wait();
  check(await connected(), "workerless connected generation failed");
  const stable = await shapes();
  for (const count of [4, 8]) {
    await page.locator("#problemCount").fill(String(count)); await page.locator("#problemCount").blur(); await wait();
    await page.emulateMedia({ media: "print" });
    check(await page.locator("#connectAll").isHidden(), "new control appears in print");
    const pdf = await page.pdf({ path: `output/playwright/dot-connected-${channel}-${count}.pdf`, preferCSSPageSize:true, scale:1.1 });
    check((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length === count / 4, "extra PDF page");
    check(await connected(), "printing invalid shapes");
    await page.emulateMedia({ media:null });
  }
  check(stable.length === 4 && errors.length === 0, errors.join("\n"));
  await page.screenshot({ path:`output/playwright/dot-connected-${channel}.png`, fullPage:true });
  return {channel, checks:["default and automatic changes", "levels and exact counts", "hints and single reroll", "reload and explicit OFF", "legacy migrations", "workerless generation", "4/8 questions print without extra pages"], errors};
}
