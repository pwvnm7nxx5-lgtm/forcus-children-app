// Run in an isolated playwright-cli session opened on the custom builder:
// playwright-cli --session <name> run-code --filename scripts/measure-calculation-print-performance.js
// Measures a settled preview (including deferred work), not just DOM creation.
async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const results = [];
  const changeCount = async (count) => page.evaluate(async (value) => {
    const start = performance.now();
    const input = document.querySelector("#printSheetCount");
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
    return performance.now() - start;
  }, count);
  try {
    for (const layout of ["horizontal", "vertical"]) {
      await changeCount(1);
      await page.locator("#layoutMode").selectOption(layout);
      for (const count of [1, 10, 30]) {
        const before = await cdp.send("Performance.getMetrics");
        const ms = await changeCount(count);
        const after = await cdp.send("Performance.getMetrics");
        const metric = (report, name) => report.metrics.find((item) => item.name === name).value;
        const delta = (name) => metric(after, name) - metric(before, name);
        const pages = await page.locator(".print-page:not(.print-adjust-answer-hidden)").count();
        if (pages !== count * 2) throw new Error(`Expected ${count * 2} pages, got ${pages}`);
        results.push({ layout, count, ms: Math.round(ms), pages, layoutCount: delta("LayoutCount"), layoutMs: Math.round(delta("LayoutDuration") * 1000) });
      }
    }
    return results;
  } finally {
    await cdp.detach();
  }
}
