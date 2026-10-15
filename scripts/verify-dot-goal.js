// playwright-cli run-code --filename scripts/verify-dot-goal.js
async (page) => {
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const channel = (await page.evaluate(() => navigator.userAgent)).includes("Edg/") ? "edge" : "chrome";
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("dot-copy-print-state-v1")));
  const keys = async () => (await state()).problems.map(problem => windowKey(problem));
  const windowKey = problem => problem.edges.map(edge => [...edge].sort((a,b)=>a-b).join("-")).sort().join(",");
  const hints = ["hintUsed","hintTrace","hintStart","hintGoal"];
  const wait = () => page.waitForFunction(() => !document.querySelector("#printBtn").disabled);
  await page.evaluate(() => localStorage.removeItem("dot-copy-print-state-v1"));
  await page.reload(); await wait();
  check(!await page.locator("#hintGoal").isChecked(), "goal default must be OFF");
  check(await page.locator("#hintStart").evaluate(node => Boolean(node.closest("label").nextElementSibling?.querySelector("#hintGoal"))), "goal must be immediately below start");

  async function combinations() {
    const stable = await keys();
    for (let mask=0; mask<16; mask+=1) {
      for (const [i,key] of hints.entries()) await page.locator(`#${key}`).setChecked(Boolean(mask & (1<<i)));
      check(JSON.stringify(await keys())===JSON.stringify(stable), "hint toggles changed shapes");
      const valid = await page.evaluate(() => {
        const saved=JSON.parse(localStorage.getItem("dot-copy-print-state-v1"));
        const hint = Object.fromEntries(["hintUsed","hintTrace","hintStart","hintGoal"].map(key=>[key,document.querySelector(`#${key}`).checked]));
        return [...document.querySelectorAll(".dot-problem")].every((card,index)=>{
          const problem=saved.problems[index], used=new Set(problem.edges.flat());
          const starts=[...new Set(problem.strokes.map(stroke=>stroke[0]))].sort((a,b)=>a-b);
          const goals=[...new Set(problem.strokes.map(stroke=>stroke[stroke.length-1]))].sort((a,b)=>a-b);
          const same = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
          return [...card.querySelectorAll("svg")].every(svg=>{
            const model=svg.dataset.role==="model";
            const points=[...svg.querySelectorAll(".dot-point")];
            const ids=selector=>[...svg.querySelectorAll(selector)].map(node=>Number(node.dataset.start ?? node.dataset.goal)).sort((a,b)=>a-b);
            if (!same(ids("[data-start]"),hint.hintStart?starts:[]) || !same(ids("[data-goal]"),hint.hintGoal?goals:[])) return false;
            if (points.length!==problem.rows*problem.columns) return false;
            if (!points.every(dot=>{
              const id=Number(dot.dataset.point);
              const marked=hint.hintStart&&starts.includes(id)||hint.hintGoal&&goals.includes(id);
              return Number(dot.getAttribute("r"))===(marked?1.05:!model&&hint.hintUsed&&used.has(id)?1:.65);
            })) return false;
            const goalMarks=[...svg.querySelectorAll("[data-goal]")];
            if (!goalMarks.every(mark=>{
              const dot=svg.querySelector(`[data-point="${mark.dataset.goal}"]`);
              return mark.tagName==="rect" && getComputedStyle(mark).fill==="none" &&
                Math.abs(Number(mark.getAttribute("x"))+1.8-Number(dot.getAttribute("cx")))<.001 &&
                Math.abs(Number(mark.getAttribute("y"))+1.8-Number(dot.getAttribute("cy")))<.001;
            })) return false;
            const lines=[...svg.querySelectorAll("line")].map(line=>line.dataset.edge).sort();
            return same(lines,model||hint.hintTrace?problem.edges.map(window.DotCopyGenerator.edgeKey).sort():[]);
          });
        });
      });
      check(valid, `${channel}: hint mask ${mask} mismatch`);
    }
    return stable;
  }
  await combinations();
  const auto = await keys(); await page.reload(); await wait();
  check(await page.locator("#hintGoal").isChecked() && JSON.stringify(await keys())===JSON.stringify(auto), "goal hint not restored or shape changed");

  // Include a branch, a closed loop (start=goal) and an endpoint at a grid corner.
  await page.evaluate(() => {
    const config={rows:5,columns:5,lineCount:5,level:1,oneStroke:false,connectAll:true,problemCount:4};
    const problems=[window.DotCopyGenerator.generateProblem(config),
      window.DotCopyManual.makeProblem(config,[[0,1],[1,2],[1,6]]),
      window.DotCopyManual.makeProblem(config,[[0,1],[1,6],[6,5],[5,0]]),
      window.DotCopyManual.makeProblem(config,[[22,23],[23,24]])];
    localStorage.setItem("dot-copy-print-state-v1",JSON.stringify({applied:config,problems,perPage:4,title:"点つなぎ",punchGuide:"left",hints:{hintStart:true}}));
  });
  await page.reload(); await wait();
  check(!await page.locator("#hintGoal").isChecked(), "old saved hints must default goal OFF");
  const mixed=await combinations();
  check(await page.locator('.dot-problem[data-index="2"] [data-role="model"] [data-start="0"]').count()===1 &&
    await page.locator('.dot-problem[data-index="2"] [data-role="model"] [data-goal="0"]').count()===1, "closed-loop dual markers missing");
  for (const perPage of [1,2,4]) {
    await page.locator("#perPage").selectOption(String(perPage));
    await page.emulateMedia({media:"print"});
    check(await page.locator("#hintGoal").isHidden(), "goal checkbox printed");
    const pdf=await page.pdf({path:`output/playwright/dot-goal-${channel}-${perPage}.pdf`,preferCSSPageSize:true,scale:1.1});
    check((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length===4/perPage, "goal hint changed pagination");
    await page.emulateMedia({media:null});
    check(JSON.stringify(await keys())===JSON.stringify(mixed), "printing changed models");
  }
  await page.locator("#perPage").selectOption("4");
  await page.setViewportSize({width:390,height:844});
  check(await page.locator("#hintGoal").isChecked(), "mobile goal missing");
  await page.locator("#hintGoal").uncheck(); await page.locator("#hintGoal").check();
  check(JSON.stringify(await keys())===JSON.stringify(mixed), "mobile toggle changed models");
  await page.setViewportSize({width:1280,height:1000});
  await page.screenshot({path:`output/playwright/dot-goal-${channel}.png`,fullPage:true});
  check(!errors.length,errors.join("\n"));
  return {channel,checks:["goal below start and default OFF", "16 hint combinations for automatic + mixed manual models", "matching starts/goals/radii on both sides", "branch stroke ends and closed-loop dual markers", "saved hints + old state compatibility", "A4 1/2/4 per page at 110%", "stable models on mobile/print"],errors};
}
