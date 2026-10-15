// Focused regression check: no shared app source is changed by dot-copy-print.
// Run in a disposable Chrome playwright-cli session on this local server.
async (page) => {
  const base = new URL("/", page.url()).href;
  const errors = [];
  const results = [];
  page.on("pageerror", error => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  for (const id of ["custom-calculation-problem-builder", "calculation-problem-set"]) {
    await page.goto(`${base}apps/${id}/`);
    await page.locator("#printSheetCount").waitFor();
    await page.locator("#printSheetCount").fill("2");
    await page.locator("#includeAnswers").check();
    await page.locator("#printPunchGuide").selectOption("left");
    await page.waitForTimeout(150);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const includeAnswers of [true, false]) {
      await page.locator("#includeAnswers").setChecked(includeAnswers);
      await page.waitForTimeout(150);
      const expected = includeAnswers ? 4 : 2;
      const visible = await page.locator(".print-page").evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== "none").length);
      assert(visible === expected, `${id} preview pages ${visible}, expected ${expected}`);
      const before = await page.locator("#pages").innerText();
      const pdf = await page.pdf({ path: `output/playwright/dot-regression-${id}-${includeAnswers ? "answers" : "no-answers"}.pdf`, preferCSSPageSize: true });
      const count = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
      assert(count === expected, `${id}: PDF ${count}, expected ${expected}`);
      assert(await page.locator("#pages").innerText() === before, `${id}: print changed problem content`);
      results.push({ id, includeAnswers, count });
    }
  }
  await page.goto(`${base}apps/kanji-print/`);
  await page.locator("#sourceText").fill("山へ行く。");
  await page.locator("#sheetCount").fill("2");
  await page.locator("#sheetCount").dispatchEvent("input");
  await page.evaluate(() => document.fonts.ready);
  const expected = await page.locator(".print-page").count();
  const pdf = await page.pdf({ path: "output/playwright/dot-regression-kanji-two.pdf", preferCSSPageSize: true });
  const count = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  assert(count === expected && count === 2, `kanji: PDF ${count}, expected ${expected}`);
  results.push({ id: "kanji-print", count });
  assert(!errors.length, errors.join("\n"));
  return { results, errors };
}
