// Run in an isolated Chrome or Edge playwright-cli session opened at the app:
// playwright-cli -s=<session> run-code --filename scripts/verify-dot-copy-print.js
async (page) => {
  const checks = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = new URL("/", page.url()).href;
  const channel = (await page.evaluate(() => navigator.userAgent)).includes("Edg/") ? "edge" : "chrome";
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("dot-copy-print-state-v1")));
  const keys = () => page.locator(".dot-problem").evaluateAll(nodes => nodes.map(node => node.dataset.fingerprint));
  const wait = async () => {
    await page.waitForFunction(() => !document.querySelector("#regenerateBtn").disabled);
    check(!await page.locator("#status").evaluate(node => node.classList.contains("error")), await page.locator("#status").textContent());
  };
  async function settings(values) {
    for (const [key, value] of Object.entries(values)) {
      const node = page.locator(`#${key}`);
      if (typeof value === "boolean") await node.setChecked(value);
      else if (key === "level") await node.selectOption(String(value));
      else await node.fill(String(value));
    }
    await page.locator("#regenerateBtn").click(); await wait();
  }
  await page.emulateMedia({ media: null });
  await page.evaluate(() => localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload(); await wait();
  check((await keys()).length === 4, "default count");
  check((await snapshot()).applied.oneStroke, "default oneStroke");
  const initial = await keys();

  for (let mask = 0; mask < 8; mask += 1) {
    for (const [i, key] of ["hintUsed", "hintTrace", "hintStart"].entries()) await page.locator(`#${key}`).setChecked(Boolean(mask & (1 << i)));
    check(JSON.stringify(await keys()) === JSON.stringify(initial), "hint toggle regenerated problems");
    const result = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
      const usedHint = document.querySelector("#hintUsed").checked;
      const traceHint = document.querySelector("#hintTrace").checked;
      const startHint = document.querySelector("#hintStart").checked;
      return [...document.querySelectorAll(".dot-problem")].map((card, i) => {
        const problem = saved.problems[i];
        const model = card.querySelector('[data-role="model"]'), drawing = card.querySelector('[data-role="drawing"]');
        const dots = svg => [...svg.querySelectorAll(".dot-point")];
        const points = svg => dots(svg).map(dot => [dot.getAttribute("cx"), dot.getAttribute("cy")]);
        const starts = [...new Set(problem.strokes.map(stroke => stroke[0]))].sort((a, b) => a - b);
        const ringIds = svg => [...svg.querySelectorAll(".dot-start-ring")].map(dot => Number(dot.dataset.start)).sort((a, b) => a - b);
        const expectedLines = problem.edges.map(window.DotCopyGenerator.edgeKey).sort();
        const used = new Set(problem.edges.flat());
        const correctRadii = dots(drawing).every(dot => {
          const id = Number(dot.dataset.point);
          return Number(dot.getAttribute("r")) === (startHint && starts.includes(id) ? 1.05 : usedHint && used.has(id) ? 1 : .65);
        });
        const lineCoords = svg => [...svg.querySelectorAll("line")].map(line => ["x1", "y1", "x2", "y2"].map(attr => line.getAttribute(attr)));
        return { samePoints: JSON.stringify(points(model)) === JSON.stringify(points(drawing)),
          sameSize: model.getAttribute("viewBox") === drawing.getAttribute("viewBox") && model.getAttribute("width") === drawing.getAttribute("width") && model.getAttribute("height") === drawing.getAttribute("height"),
          dotCount: dots(drawing).length === problem.rows * problem.columns,
          correctRadii,
          trace: JSON.stringify([...drawing.querySelectorAll("line")].map(line => line.dataset.edge).sort()) === JSON.stringify(traceHint ? expectedLines : []),
          traceCoords: !traceHint || JSON.stringify(lineCoords(model)) === JSON.stringify(lineCoords(drawing)),
          starts: [model, drawing].every(svg => JSON.stringify(ringIds(svg)) === JSON.stringify(startHint ? starts : [])),
          validation: window.DotCopyGenerator.problemErrors(problem, saved.applied).length === 0 };
      });
    });
    check(result.every(row => Object.values(row).every(Boolean)), `hint geometry mask ${mask}: ${JSON.stringify(result)}`);
  }
  checks.push("all 8 hint combinations: stable shapes, matched geometry/lines/dots/start rings");

  await page.locator('[aria-label="問題2だけ作り直す"]').click(); await wait();
  const rerolled = await keys();
  check(rerolled[1] !== initial[1] && rerolled.every((key, i) => i === 1 || key === initial[i]), "single reroll changed another problem");
  await page.reload(); await wait();
  check(JSON.stringify(await keys()) === JSON.stringify(rerolled), "reload changed problems");
  checks.push("individual reroll and reload preserve other shapes");

  await page.locator("#lineCount").fill("6");
  check(await page.locator("#pendingNotice").isVisible(), "missing pending notice");
  check(await page.locator("#printBtn").isDisabled(), "pending print button is enabled");
  check(JSON.stringify(await keys()) === JSON.stringify(rerolled), "editing condition regenerated problems");
  await page.locator("#lineCount").fill("5");
  check(!await page.locator("#pendingNotice").isVisible(), "restoring condition stays pending");

  for (const values of [{ rows: 1, columns: 1, level: 1, lineCount: 5 }, { rows: 2, columns: 2, level: 3, lineCount: 1 }, { rows: 2, columns: 2, level: 1, lineCount: 4 }]) {
    for (const [key, value] of Object.entries(values)) {
      if (key === "level") await page.locator(`#${key}`).selectOption(String(value));
      else await page.locator(`#${key}`).fill(String(value));
    }
    const started = Date.now();
    await page.locator("#regenerateBtn").click();
    check(await page.locator("#status").evaluate(node => node.classList.contains("error")), "impossible condition has no error");
    check(Date.now() - started < 2000, "impossible condition froze UI");
    check(JSON.stringify(await keys()) === JSON.stringify(rerolled), "failure lost old problems");
    for (const [key, value] of Object.entries(values)) check(Number(await page.locator(`#${key}`).inputValue()) === value, "silently changed condition");
  }
  checks.push("pending and impossible conditions: clear reasons, no freezing/mutation/data loss");
  await settings({ rows: 1, columns: 2, level: 1, lineCount: 1, problemCount: 1 });
  const onlyShape = await keys();
  await page.locator('[aria-label="問題1だけ作り直す"]').click();
  await page.waitForFunction(() => !document.querySelector("#regenerateBtn").disabled);
  check(await page.locator("#status").evaluate(node => node.classList.contains("error")), "single possible shape has no reroll error");
  check(JSON.stringify(await keys()) === JSON.stringify(onlyShape), "failed reroll altered shape");
  checks.push("bounded worker failure when no alternative shape exists");

  await settings({ rows: 12, columns: 12, lineCount: 12, level: 3, oneStroke: false, problemCount: 5 });
  await page.locator("#perPage").selectOption("4");
  check(await page.locator("#sizeWarning").isVisible(), "small spacing has no warning");
  await page.locator("#perPage").selectOption("1");
  check(!await page.locator("#sizeWarning").isVisible(), "reducing per-page does not improve size");

  // OFF mode may require more than one pencil placement. Inspect actual saved
  // stroke starts and their corresponding rings on both diagrams.
  const offHints = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    return saved.problems.every((problem, i) => {
      const starts = [...new Set(problem.strokes.map(stroke => stroke[0]))].sort((a, b) => a - b);
      const card = document.querySelectorAll(".dot-problem")[i];
      return !window.DotCopyGenerator.problemErrors(problem, saved.applied).length &&
        [...card.querySelectorAll("svg")].every(svg => JSON.stringify([...svg.querySelectorAll(".dot-start-ring")].map(ring => Number(ring.dataset.start)).sort((a, b) => a - b)) === JSON.stringify(starts));
    });
  });
  check(offHints, "OFF mode start hints do not match actual drawing strokes");
  checks.push("OFF-mode start rings match the stored complete drawing strokes");

  async function geometryCheck(media) {
    await page.emulateMedia({ media });
    const result = await page.evaluate(() => {
      const close = (a, b) => Math.abs(a - b) < 1;
      return [...document.querySelectorAll(".dot-problem")].map(card => {
        const boxes = [...card.querySelectorAll("svg")].map(svg => svg.getBoundingClientRect());
        const canvases = [...card.querySelectorAll(".dot-canvas")].map(node => node.getBoundingClientRect());
        const page = card.closest(".print-page").getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        const one = card.querySelector("svg");
        const dots = one.querySelectorAll(".dot-point");
        const c = JSON.parse(localStorage.getItem("dot-copy-print-state-v1")).applied;
        const stepX = Number(dots[1].getAttribute("cx")) - Number(dots[0].getAttribute("cx"));
        const stepY = Number(dots[c.columns].getAttribute("cy")) - Number(dots[0].getAttribute("cy"));
        return { square: c.rows === 1 || c.columns === 1 || close(stepX, stepY),
          sameSize: close(boxes[0].width, boxes[1].width) && close(boxes[0].height, boxes[1].height),
          fits: boxes.every((box, i) => box.width <= canvases[i].width + 1 && box.height <= canvases[i].height + 1),
          cardFits: rect.top >= page.top && rect.bottom <= page.bottom && rect.left >= page.left && rect.right <= page.right,
          pageFits: card.closest(".print-page").scrollHeight <= card.closest(".print-page").clientHeight + 1,
          shape: one.getAttribute("viewBox") };
      });
    });
    check(result.every(row => row.square && row.sameSize && row.fits && row.cardFits && row.pageFits), `layout ${media}: ${JSON.stringify(result)}`);
    return result.map(row => row.shape);
  }
  await settings({ rows: 5, columns: 7, lineCount: 9, level: 3, oneStroke: true, problemCount: 5 });
  const stable = await keys();
  for (const perPage of [1, 2, 4]) {
    await page.locator("#perPage").selectOption(String(perPage));
    const screen = await geometryCheck(null);
    const print = await geometryCheck("print");
    check(JSON.stringify(screen) === JSON.stringify(print), "screen/print aspect changed");
    check(await page.locator("#printBtn").isHidden(), "controls are printable");
    check(await page.locator(".reroll-btn").first().isHidden(), "reroll is printable");
    const pdf = await page.pdf({ path: `output/playwright/dot-copy-${channel}-${perPage}-per-page.pdf`, preferCSSPageSize: true, printBackground: false });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    check(pages === Math.ceil(5 / perPage), `printed ${pages}, expected ${Math.ceil(5 / perPage)}`);
    check(JSON.stringify(await keys()) === JSON.stringify(stable), "printing regenerated problems");
    checks.push(`${channel} A4 ${perPage}/page: ${pages} PDF pages, matched square grids, no overflow`);
    await page.emulateMedia({ media: null });
  }
  const gridBeforeGuides = await page.locator("svg").evaluateAll(nodes => nodes.map(node => node.outerHTML));
  for (const position of ["none", "left", "top"]) {
    await page.locator("#printPunchGuide").selectOption(position);
    check(JSON.stringify(await keys()) === JSON.stringify(stable), "punch guide changed shapes");
    check(JSON.stringify(await page.locator("svg").evaluateAll(nodes => nodes.map(node => node.outerHTML))) === JSON.stringify(gridBeforeGuides), "punch guide changed grid geometry");
    await page.emulateMedia({ media: "print" });
    const guides = await page.evaluate(position => [...document.querySelectorAll(".print-page")].every(page => {
      const guide = page.querySelector(".punch-guide");
      if (position === "none") return !guide;
      if (!guide || getComputedStyle(guide).display === "none") return false;
      const paper = page.getBoundingClientRect(), mark = guide.getBoundingClientRect();
      const center = position === "left" ? Math.abs((mark.top + mark.bottom) / 2 - (paper.top + paper.bottom) / 2) :
        Math.abs((mark.left + mark.right) / 2 - (paper.left + paper.right) / 2);
      return center < 1 && mark.left >= paper.left && mark.right <= paper.right && mark.top >= paper.top && mark.bottom <= paper.bottom;
    }), position);
    check(guides, `incorrect printable punch guide ${position}`);
    const pdf = await page.pdf({ path: `output/playwright/dot-copy-${channel}-punch-${position}.pdf`, preferCSSPageSize: true, printBackground: false });
    check((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length === 2, "punch guide changed page count");
    await page.emulateMedia({ media: null });
  }
  await page.reload(); await wait();
  check(await page.locator("#printPunchGuide").inputValue() === "top", "punch setting was not restored");
  checks.push("none/left/top punch guides: correct print position, stable grids, remembered setting");
  check(JSON.stringify(await keys()) === JSON.stringify(stable), "repeated print/reload changed shapes");
  await page.setViewportSize({ width: 390, height: 844 });
  await geometryCheck(null); await geometryCheck("print"); await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1280, height: 1000 });
  checks.push("mobile preview and printing use the same undistorted geometry");
  // Verify the real app print handler calls window.print without regenerating.
  await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }; });
  await page.locator("#printBtn").click();
  check(await page.evaluate(() => window.__printCalls) === 1, "app print handler");
  check(JSON.stringify(await keys()) === JSON.stringify(stable), "app print button regenerated problems");

  await page.locator(".home-link").click();
  check(page.url().replace(/index.html$/, "") === base, "home navigation");
  const card = page.locator(".app-card").filter({ has: page.getByRole("heading", { name: "点つなぎ作成", exact: true }) });
  await card.waitFor({ state: "visible" });
  check(await card.count() === 1, "launcher missing app");
  await page.getByRole("searchbox", { name: "検索", exact: true }).fill("点つなぎ");
  await page.getByRole("button", { name: "教材", exact: true }).click();
  check(await page.locator(".app-card").count() === 1, "category/search cannot find app");
  await card.getByRole("link", { name: "点つなぎを作る" }).click(); await wait();
  check(JSON.stringify(await keys()) === JSON.stringify(stable), "launcher reopen changed problems");
  checks.push("launcher card and round-trip navigation");
  await page.screenshot({ path: `output/playwright/dot-copy-${channel}-verified.png`, fullPage: true });
  check(!errors.length, errors.join("\n"));
  return { channel, checks, errors };
}
