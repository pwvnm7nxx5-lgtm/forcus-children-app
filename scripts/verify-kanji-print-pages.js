// Open apps/kanji-print/ in an isolated playwright-cli Chrome session, then:
// playwright-cli --session <name> run-code --filename scripts/verify-kanji-print-pages.js
// Create output/playwright before running. Close the session after verification.
async (page) => {
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ media: null });
  const originalText = await page.locator("#sourceText").inputValue();
  const settings = [
    { name: "one", copies: 1, scale: 1 },
    { name: "two", copies: 2, scale: 1 },
    { name: "one-enlarged", copies: 1, scale: 1.1 },
    { name: "two-enlarged", copies: 2, scale: 1.1 },
    { name: "two-reduced", copies: 2, scale: 0.8 },
    { name: "long-text", copies: 1, scale: 1, longText: true },
    { name: "long-text-enlarged", copies: 1, scale: 1.1, longText: true },
    { name: "dense-grid", copies: 1, scale: 1, cols: 6, rows: 20 },
  ];
  for (const scenario of settings) {
    await page.locator("#sourceText").fill(scenario.longText ? "学校で漢字を学びます。".repeat(24) : originalText);
    await page.locator("#cols").fill(String(scenario.cols || 10));
    await page.locator("#rows").fill(String(scenario.rows || 14));
    await page.locator("#sheetCount").fill(String(scenario.copies));
    await page.locator("#sheetCount").dispatchEvent("input");
    await page.evaluate(() => document.fonts.ready);
    const expected = await page.locator(".print-page").count();
    const pdf = await page.pdf({
      path: `output/playwright/kanji-${scenario.name}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
      scale: scenario.scale,
    });
    // Chrome emits uncompressed page dictionaries; exclude the /Pages tree.
    const actual = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    results.push({ name: scenario.name, expected, actual });
    if (actual !== expected) throw new Error(`${scenario.name}: expected ${expected} pages, got ${actual}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { results, errors };
}
