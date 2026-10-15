// Verify the bounded non-Worker path and the longest allowed header fields.
async (page) => {
  await page.emulateMedia({ media: null });
  const client = await page.context().newCDPSession(page);
  await client.send("Network.clearBrowserCache");
  await client.detach();
  await page.addInitScript(() => { window.Worker = undefined; });
  await page.goto("http://127.0.0.1:4190/apps/dot-copy-print/");
  await page.evaluate(() => localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".dot-problem").length === 4 && !document.querySelector("#regenerateBtn").disabled);
  if (!await page.evaluate(() => typeof Worker === "undefined")) throw new Error("Worker was not disabled for fallback test");
  await page.locator("#worksheetTitle").fill("点つなぎの練習とても長い教材名を印刷して確かめるテストプリント");
  await page.locator("#studentName").fill("あいうえおかきくけこさしすせそたちつてとなにぬね");
  await page.locator("#hintStart").check();
  await page.locator("#printPunchGuide").selectOption("top");
  const stable = await page.locator(".dot-problem").evaluateAll(nodes => nodes.map(node => node.dataset.fingerprint));
  await page.locator('[aria-label="問題2だけ作り直す"]').click();
  await page.waitForFunction(() => !document.querySelector("#regenerateBtn").disabled);
  const changed = await page.locator(".dot-problem").evaluateAll(nodes => nodes.map(node => node.dataset.fingerprint));
  if (changed[1] === stable[1] || !changed.every((key, i) => i === 1 || key === stable[i])) throw new Error("fallback reroll");
  await page.emulateMedia({ media: "print" });
  const layout = await page.evaluate(() => {
    const header = document.querySelector(".dot-sheet-header");
    const h = header.getBoundingClientRect();
    const children = [...header.children].map(node => node.getBoundingClientRect());
    const name = document.querySelector(".dot-name span");
    return { headerFits: children.every(child => child.bottom <= h.bottom), nameFits: name.scrollWidth <= name.clientWidth + 1,
      points: document.querySelectorAll(".dot-point").length };
  });
  const pdf = await page.pdf({ path: "output/playwright/dot-copy-fallback-long-header.pdf", preferCSSPageSize: true });
  if (!layout.headerFits || !layout.nameFits) throw new Error(JSON.stringify(layout));
  if ((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length !== 1) throw new Error("unexpected page count");
  return { fallbackGenerated: true, fallbackReroll: true, layout };
}
