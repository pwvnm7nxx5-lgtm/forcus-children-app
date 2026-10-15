// playwright-cli run-code --filename scripts/verify-dot-euler.js
async (page) => {
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const errors=[]; page.on("pageerror",error=>errors.push(error.message));
  const channel=(await page.evaluate(()=>navigator.userAgent)).includes("Edg/")?"edge":"chrome";
  const appUrl=page.url();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("dot-copy-print-state-v1")));
  const keys=async()=>JSON.stringify((await state()).problems.map(problem=>problem.edges));
  const wait=()=>page.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
  async function settings(values) {
    for(const [key,value] of Object.entries(values)) {
      const node=page.locator(`#${key}`);
      if(typeof value==="boolean")await node.setChecked(value);
      else await node.fill(String(value));
    }
    const numbers=Object.keys(values).filter(key=>typeof values[key]==="number");
    if(numbers.length)await page.locator(`#${numbers.at(-1)}`).blur();
    await wait();
  }
  const edit=index=>page.locator(`[aria-label="問題${index+1}のお手本を手動で編集"]`).click();
  const draw=async ids=>{for(const id of ids)await page.locator(`#manualGrid [data-point="${id}"]`).click();};
  async function saveModel(index,ids) {
    await edit(index);await page.locator("#manualClear").click();await draw(ids);
    check(await page.locator("#manualSave").isEnabled(),await page.locator("#manualStatus").textContent());
    await page.locator("#manualSave").click();await page.locator("#manualEditor").waitFor({state:"hidden"});
  }
  await page.evaluate(()=>localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload();await wait();
  check(!await page.locator("#easyOneStroke").isChecked(),"ordinary mode must be default");
  await settings({easyOneStroke:true});
  check((await state()).applied.easyOneStroke,"easy mode did not regenerate automatically");
  check((await state()).problems.every(problem=>new Set(problem.strokes[0]).size===problem.edges.length+1),"easy generated a revisit");
  await settings({oneStroke:false});
  check(await page.locator("#easyOneStroke").isDisabled(),"easy mode usable without oneStroke");
  await settings({oneStroke:true});
  check(await page.locator("#easyOneStroke").isChecked()&&await page.locator("#easyOneStroke").isEnabled(),"easy preference not retained");
  await settings({easyOneStroke:false,rows:3,columns:3,lineCount:6});
  await saveModel(0,[3,4,1,2,5,4,7]);
  await saveModel(1,[0,1,4,3,0]);
  await saveModel(2,[0,1,4,5,8,7,4,3,0]);
  const saved=await state();
  check(saved.problems[0].strokes[0].filter(id=>id===4).length===2,"reported model has no central revisit");
  check(saved.problems.slice(0,3).every(problem=>problem.strokes.length===1),"manual Euler model split into strokes");
  for(const key of ["hintUsed","hintTrace","hintStart","hintGoal"])await page.locator(`#${key}`).check();
  check(await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    return [...document.querySelectorAll(".dot-problem")].every((card,index)=>{
      const p=saved.problems[index],s=p.strokes[0];
      if(window.DotCopyManual.worksheetProblemErrors(p,saved.applied).length)return false;
      return [...card.querySelectorAll("svg")].every(svg=>
        svg.querySelector(`[data-start="${s[0]}"]`)&&svg.querySelector(`[data-goal="${s[s.length-1]}"]`));
    });
  }),"start/goal does not match the complete Euler trail");
  const stable=await keys();await page.reload();await wait();
  check(await keys()===stable,"reload changed saved Euler models");
  await page.locator("#easyOneStroke").check();
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("保護しています"));
  check(await keys()===stable,"mode switch overwrote manual shapes without confirmation");
  await page.locator("#restoreConditionsBtn").click();await wait();
  for(const perPage of [1,2,4]) {
    await page.locator("#perPage").selectOption(String(perPage));
    await page.emulateMedia({media:"print"});
    check(await page.locator("#easyOneStroke").isHidden(),"easy checkbox prints");
    const pdf=await page.pdf({path:`output/playwright/dot-euler-${channel}-${perPage}.pdf`,preferCSSPageSize:true,scale:1.1});
    check((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length===4/perPage,"extra PDF pages");
    await page.emulateMedia({media:null});
  }
  await page.locator("#perPage").selectOption("4");
  await page.screenshot({path:`output/playwright/dot-euler-${channel}.png`,fullPage:true});

  // Upgrade saved pre-mode data without changing its existing shape or fields.
  await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
    delete saved.applied.easyOneStroke;saved.problems.forEach(problem=>delete problem.easyOneStroke);
    saved.title="保存済みのお手本";saved.name="なまえ";
    localStorage.setItem("dot-copy-print-state-v1",JSON.stringify(saved));
  });
  await page.reload();await wait();
  check(await keys()===stable&&!(await state()).applied.easyOneStroke,"old saved shapes changed on mode upgrade");
  check(await page.locator("#worksheetTitle").inputValue()==="保存済みのお手本","old saved title lost");

  // A fresh easy editor rejects the same reported shape, but can save a simple path.
  await page.evaluate(()=>localStorage.removeItem("dot-copy-print-state-v1"));await page.reload();await wait();
  await settings({rows:3,columns:3,lineCount:6,easyOneStroke:true});
  await edit(0);await page.locator("#manualClear").click();await draw([3,4,1,2,5,4,7]);
  check(await page.locator("#manualSave").isDisabled()&&(await page.locator("#manualStatus").textContent()).includes("やさしい一筆書き"),"easy mode accepted the reported revisit");
  await page.locator("#manualClear").click();await draw([0,1,2,5,4,3,6]);
  await page.locator("#manualSave").click();await page.locator("#manualEditor").waitFor({state:"hidden"});
  await page.reload();await wait();
  check((await state()).applied.easyOneStroke&&await page.locator("#easyOneStroke").isChecked(),"easy mode not restored");

  const context=await page.context().browser().newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  try {
    const mobile=await context.newPage();await mobile.addInitScript(()=>{window.Worker=undefined;});await mobile.goto(appUrl);
    mobile.on("pageerror",error=>errors.push(error.message));
    await mobile.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
    for(const [id,value]of [["rows",3],["columns",3],["lineCount",6]])await mobile.locator(`#${id}`).fill(String(value));
    await mobile.locator("#lineCount").blur();await mobile.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
    await mobile.locator('[aria-label="問題1のお手本を手動で編集"]').click();await mobile.locator("#manualClear").click();
    for(const id of [3,4,1,2,5,4,7]) {
      const box=await mobile.locator(`#manualGrid [data-point="${id}"]`).boundingBox();
      await mobile.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    }
    check(await mobile.locator("#manualSave").isEnabled(),"mobile reported model cannot save");
    await mobile.screenshot({path:`output/playwright/dot-euler-${channel}-mobile.png`});
    await mobile.locator("#manualSave").click();
    await mobile.reload();await mobile.waitForFunction(()=>!document.querySelector("#printBtn").disabled);
    check(await mobile.evaluate(()=>JSON.parse(localStorage.getItem("dot-copy-print-state-v1")).problems[0].strokes.length===1),"mobile Euler save/reload failed");
  } finally {await context.close();}
  check(!errors.length,errors.join("\n"));
  return {channel,checks:["normal/easy automatic generation and OFF interaction","reported model, loop and figure-eight save as one stroke","matching start/goal hints, restore and no overwrite","A4 1/2/4 per page at 110%","old saved state compatibility","easy rejection and preference persistence","390px touch drawing without Worker"],errors};
}
