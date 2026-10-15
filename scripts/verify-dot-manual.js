// playwright-cli run-code --filename scripts/verify-dot-manual.js
async (page) => {
  try {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [], checks = [];
  page.on("pageerror", error => errors.push(error.message));
  const channel = (await page.evaluate(() => navigator.userAgent)).includes("Edg/") ? "edge" : "chrome";
  const appUrl = page.url();
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("dot-copy-print-state-v1")));
  const keys = async () => (await state()).problems.map(problem => problem.edges);
  const wait = () => page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
  const edit = index => page.locator(`[aria-label="問題${index + 1}のお手本を手動で編集"]`).click();
  const dot = id => page.locator(`#manualGrid [data-point="${id}"]`);
  const draw = async ids => { for (const id of ids) await dot(id).click(); };
  const save = async () => { await page.locator("#manualSave").click(); await page.locator("#manualEditor").waitFor({state:"hidden"}); };
  const confirm = async (selector, accept) => {
    const response = page.waitForEvent("dialog").then(dialog => accept ? dialog.accept() : dialog.dismiss());
    await page.locator(selector).click(); await response;
  };
  await page.evaluate(() => localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload(); await wait();
  const original = await keys();
  await edit(0); await page.locator("#manualClear").click();
  check(await page.locator("#manualSave").isDisabled(), "empty draft can save");
  await draw([0,1,2,7]);
  check(await page.locator("#manualCount").textContent() === "線 3本（最大60本）", "click sequence count");
  await page.locator("#manualUndo").click();
  await draw([2,7]);
  await dot(2).click();
  check((await page.locator("#manualCount").textContent()).includes("線 2本"), "same line does not erase");
  await page.locator("#manualUndo").click();
  await draw([0,4]);
  check((await page.locator("#manualError").textContent()).includes("向き・長さ"), "invalid direction not explained");
  check((await page.locator("#manualCount").textContent()).includes("線 3本"), "invalid line changed draft");
  await page.screenshot({path:`output/playwright/dot-manual-${channel}-editor.png`,fullPage:true});
  await save();
  let saved = await state();
  check(saved.applied.lineCount === 5 && saved.problems[0].lineCount === 3 && saved.problems[0].manual, "actual manual count not independent");
  check(saved.problems.slice(1).every((problem,i) => JSON.stringify(problem.edges) === JSON.stringify(original[i+1])), "manual edit changed other problems");
  const first = await keys();
  await page.reload(); await wait();
  check(JSON.stringify(await keys()) === JSON.stringify(first), "manual shape not restored");
  await edit(0); await page.locator("#manualClear").click(); await page.locator("#manualCancel").click();
  check(JSON.stringify(await keys()) === JSON.stringify(first), "cancel changed saved worksheet");
  await edit(0); await page.locator("#manualClear").click(); await page.keyboard.press("Escape");
  check(JSON.stringify(await keys()) === JSON.stringify(first), "Escape changed saved worksheet");
  checks.push("consecutive clicks, erase, undo, clear, invalid move, actual count, save, cancel, Escape and reload");

  await edit(0); await page.locator("#manualClear").click();
  await dot(0).focus(); await page.keyboard.press("Enter"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
  check((await page.locator("#manualCount").textContent()).includes("線 2本"), "keyboard drawing failed");
  await save();
  check((await state()).problems[0].lineCount === 2, "keyboard shape not saved");
  const protectedShapes = await keys();
  await page.locator("#lineCount").fill("6"); await page.locator("#lineCount").blur();
  await page.waitForFunction(() => document.querySelector("#status").textContent.includes("保護しています"));
  check(JSON.stringify(await keys()) === JSON.stringify(protectedShapes), "automatic generation erased handmade models");
  check(await page.locator("#printBtn").isDisabled(), "pending settings printable");
  await confirm("#regenerateBtn", false);
  check(JSON.stringify(await keys()) === JSON.stringify(protectedShapes), "cancelled full regeneration erased models");
  await page.locator("#restoreConditionsBtn").click(); await wait();
  check(await page.locator("#lineCount").inputValue() === "5", "restore conditions failed");
  await confirm('[aria-label="問題1だけ作り直す"]', false);
  check(JSON.stringify(await keys()) === JSON.stringify(protectedShapes), "cancelled individual reroll erased model");
  await confirm('[aria-label="問題1だけ作り直す"]', true); await wait();
  saved = await state();
  check(!saved.problems[0].manual && saved.problems[0].lineCount === 5, "accepted single reroll not automatic");
  check(saved.problems.slice(1).every((problem,i) => JSON.stringify(problem.edges) === JSON.stringify(original[i+1])), "single reroll affected others");
  checks.push("keyboard editing, protection from automatic overwrite, restore settings and confirmed individual reroll");

  // A branch is invalid with one-stroke ON, valid with it OFF.
  await edit(0); await page.locator("#manualClear").click(); await draw([0,1,2]);
  await page.locator("#manualSeparate").click(); await draw([1,6]);
  check(await page.locator("#manualSave").isDisabled(), "one-stroke branch can save");
  await page.locator("#manualCancel").click();
  await page.locator("#oneStroke").uncheck(); await wait();
  await page.locator("#level").selectOption("2"); await wait();
  await edit(1); await page.locator("#manualClear").click(); await draw([0,1]);
  check(await page.locator("#manualSave").isDisabled(), "mandatory level direction missing");
  await page.locator("#manualClear").click(); await draw([0,6]);
  await page.locator("#manualSeparate").click(); await draw([1,5]);
  check((await page.locator("#manualError").textContent()).includes("交差"), "crossing line accepted");
  check((await page.locator("#manualCount").textContent()).includes("線 1本"), "crossing altered count");
  await save();
  check((await state()).problems[1].lineCount === 1, "level2 hand model not saved");
  await confirm("#regenerateBtn", true); await wait();
  await page.locator("#level").selectOption("3"); await wait();
  await edit(0); await page.locator("#manualClear").click(); await draw([0,7]); await save();
  check((await state()).problems[0].lineCount === 1, "level3 hand model not saved");
  await confirm("#regenerateBtn", true); await wait();
  await page.locator("#level").selectOption("1"); await wait();
  await edit(0); await page.locator("#manualClear").click(); await draw([0,1,2]);
  await page.locator("#manualSeparate").click(); await draw([1,6]); await save();
  const mixed = await keys();
  for (const key of ["hintUsed","hintTrace","hintStart"]) await page.locator(`#${key}`).check();
  check(JSON.stringify(await keys()) === JSON.stringify(mixed), "hints changed manual models");
  check(await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    return state.problems.every((problem,index) => {
      if (window.DotCopyManual.worksheetProblemErrors(problem,state.applied).length) return false;
      const card = document.querySelectorAll(".dot-problem")[index];
      const expected = problem.edges.map(window.DotCopyGenerator.edgeKey).sort().join(",");
      const starts = [...new Set(problem.strokes.map(stroke => stroke[0]))].sort((a,b)=>a-b).join(",");
      return [...card.querySelectorAll("svg")].every(svg =>
        [...svg.querySelectorAll("line")].map(node=>node.dataset.edge).sort().join(",")===expected &&
        [...svg.querySelectorAll("[data-start]")].map(node=>Number(node.dataset.start)).sort((a,b)=>a-b).join(",")===starts);
    });
  }), "manual hint lines or starts mismatch");
  checks.push("one-stroke/connected constraints, branch, crossing rejection, levels 2/3 and matched hint strokes");

  await edit(0); await page.locator("#manualClear").click();
  await page.emulateMedia({media:"print"});
  check(await page.locator("#manualEditor").isHidden() && await page.locator(".manual-edit-btn").first().isHidden(), "editor prints");
  const pdf = await page.pdf({path:`output/playwright/dot-manual-${channel}.pdf`,preferCSSPageSize:true,scale:1.1});
  check((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length===1, "manual models add PDF pages");
  await page.emulateMedia({media:null}); await page.locator("#manualCancel").click();
  check(JSON.stringify(await keys()) === JSON.stringify(mixed), "printing changed manual shape");
  await page.reload(); await wait();
  check(JSON.stringify(await keys()) === JSON.stringify(mixed), "mixed worksheet reload changed shapes");
  checks.push("mixed automatic/manual worksheet, saved-model printing during a draft, no extra PDF page");
  for (const perPage of [1,2]) {
    await page.locator("#perPage").selectOption(String(perPage));
    await page.emulateMedia({media:"print"});
    const pages = await page.pdf({path:`output/playwright/dot-manual-${channel}-${perPage}-per-page.pdf`,preferCSSPageSize:true});
    check((pages.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length===4/perPage, "manual pagination failed");
    await page.emulateMedia({media:null});
    check(JSON.stringify(await keys()) === JSON.stringify(mixed), "per-page setting changed manual models");
  }
  await page.locator("#perPage").selectOption("4");
  checks.push("1/2/4 per page preserve the mixed worksheet and page boundaries");

  const context = await page.context().browser().newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  try {
    const mobile = await context.newPage(); await mobile.goto(appUrl);
    await mobile.addInitScript(() => { window.Worker = undefined; });
    await mobile.reload();
    mobile.on("pageerror", error => errors.push(error.message));
    await mobile.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
    await mobile.locator('[aria-label="問題1のお手本を手動で編集"]').click();
    await mobile.locator("#manualClear").click();
    for (const id of [0,1,6]) {
      const box = await mobile.locator(`#manualGrid [data-point="${id}"]`).boundingBox();
      await mobile.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    }
    check((await mobile.locator("#manualCount").textContent()).includes("線 2本"), "mobile tap drawing failed");
    check(await mobile.locator("#manualEditor").evaluate(node=>node.getBoundingClientRect().width<=window.innerWidth), "mobile horizontal overflow");
    await mobile.screenshot({path:`output/playwright/dot-manual-${channel}-mobile.png`});
    await mobile.locator("#manualSave").click();
    await mobile.reload();
    await mobile.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
    check(await mobile.evaluate(()=>JSON.parse(localStorage.getItem("dot-copy-print-state-v1")).problems[0].lineCount===2), "mobile save/reload failed");
  } finally { await context.close(); }
  checks.push("390px mobile touch drawing, save and reload without Worker");
  check(errors.length===0,errors.join("\n"));
  await page.screenshot({path:`output/playwright/dot-manual-${channel}-worksheet.png`,fullPage:true});
  const result = {channel,checks,errors};
  // The CLI yields early for native confirms, while this run keeps going.
  // Retain a final result so a subsequent CLI call can await completion.
  await page.evaluate(value => { window.__manualVerification = value; }, result);
  return result;
  } catch (failure) {
    await page.evaluate(message => { window.__manualVerification = {error:message}; }, failure.message);
    throw failure;
  }
}
