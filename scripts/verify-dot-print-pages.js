// Test the reported 3x3 / 2-line / 4-question footer spill under print scaling.
// Run in a disposable Chrome / Edge playwright-cli session on dot-copy-print.
async page => {
  await page.emulateMedia({ media: null });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
  await page.evaluate(() => {
    for (const [key, value] of Object.entries({ rows: 3, columns: 3, lineCount: 2, level: 1, problemCount: 4 })) document.getElementById(key).value = String(value);
    document.querySelector("#oneStroke").checked = true;
    document.querySelector("#perPage").value = "4";
    document.querySelector("#lineCount").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#perPage").dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
  const channel = (await page.evaluate(() => navigator.userAgent)).includes("Edg/") ? "edge" : "chrome";
  const results = [];
  const scenarios = [
    { id: "normal", scale: 1 }, { id: "reduced", scale: .9 },
    { id: "enlarged", scale: 1.1 }, { id: "large", scale: 1.25 },
    { id: "margins", scale: 1, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } },
    { id: "enlarged-margins", scale: 1.1, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } },
  ];
  // Override @page only for these two cases to represent printer-supplied margins.
  for (const count of [4, 8]) {
    await page.locator("#problemCount").fill(String(count));
    await page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
    const shapes = await page.locator(".dot-problem").evaluateAll(nodes => nodes.map(node => node.dataset.fingerprint));
    for (const scenario of scenarios) {
      const marginStyle = scenario.margin ? await page.addStyleTag({ content: "@page { size: A4 portrait; margin: 10mm; }" }) : null;
      const pdf = await page.pdf({ path: `output/playwright/dot-tail-${channel}-${count}-${scenario.id}.pdf`, preferCSSPageSize: true, scale: scenario.scale });
      if (marginStyle) await marginStyle.evaluate(node => node.remove());
      const expected = count / 4;
      const actual = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
      if (actual !== expected) throw new Error(`${channel} ${count} ${scenario.id}: expected ${expected}, got ${actual}`);
      if (JSON.stringify(await page.locator(".dot-problem").evaluateAll(nodes => nodes.map(node => node.dataset.fingerprint))) !== JSON.stringify(shapes)) throw new Error("Print changed problem data");
      results.push({ count, scenario: scenario.id, pages: actual });
    }
  }
  return { channel, results };
}
