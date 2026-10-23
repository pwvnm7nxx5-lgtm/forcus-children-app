// Run with playwright-cli in an isolated Chrome/Edge session at the builder.
async(page)=>{
 const check=(ok,label)=>{if(!ok)throw new Error(label);};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const channel=(await page.evaluate(()=>navigator.userAgent)).includes('Edg/')?'edge':'chrome';
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});
 const state=()=>page.evaluate(()=>window.__calculationProblemBuilderApi.getLibraryState());
 async function configure(operation='add',layout='horizontal',extra={}){
  await page.evaluate(({operation,layout,extra})=>{
   window.__calculationProblemBuilderApi.applyLibraryState({settings:{operation,layout,creationMode:'hybrid',digitsA:2,digitsB:2,decimalPlacesA:1,decimalPlacesB:1,count:2,columns:1,carryMode:'any',resultRange:'any',...extra}});
   window.__printAdjustmentsApplySettings({sheetCount:3,includeAnswers:true});
  },{operation,layout,extra});await settle();
  check(await page.locator('.print-page:not(.answer-page) .manual-entry-input').count()===12,`${operation}/${layout}: not all pages editable`);
 }
 async function input(index,operand,value){
  await page.locator(`.manual-entry-input[data-problem-index="${index}"][data-operand="${operand}"]`).fill(value);await settle();
 }
 const cases=[['add','horizontal','42','13',55],['add','horizontal-workspace','42','13',55],['add','vertical','42','13',55],
 ['sub','vertical','42','13',29],['multiply','vertical','12','13',156],['divide','vertical','36','12',3],['divideRemainder','vertical','37','12',3],
 ['decimalAdd','horizontal','12','13',2.5,{digitsA:1,digitsB:1}],['decimalMultiply','vertical','12','13',1.56,{digitsA:1,digitsB:1}],
 ['decimalDivideDecimal','vertical','36','30',1.2,{digitsA:1,digitsB:1}]];
 for(const[operation,layout,a,b,answer,extra]of cases){
  await configure(operation,layout,extra);
  await input(2,'a',a);await input(2,'b',b);
  await input(4,'a',a);await input(4,'b',b);
  const s=await state();
  check(s.sheetProblemSets[0][0].a===''&&s.sheetProblemSets[1][0].a===a&&s.sheetProblemSets[2][0].a===a,`${operation}: wrong page updated`);
  check(Math.abs(Number(s.sheetProblemSets[1][0].answer)-answer)<.00001,`${operation}: wrong answer ${s.sheetProblemSets[1][0].answer}`);
  if(operation==='divideRemainder')check(s.sheetProblemSets[2][0].remainder===1,'remainder mismatch');
  check(await page.locator('.answer-page .manual-entry-input').count()===0,'answers are editable');
 }
 await configure();await input(0,'a','23');await input(0,'b','14');
 await input(2,'a','42');await input(2,'b','13');await input(4,'a','76');await input(4,'b','12');
 // Typing one character at a time must retain focus on page two after redraws.
 await input(2,'a','');
 await page.locator('.manual-entry-input[data-problem-index="2"][data-operand="a"]').press('4');await settle();
 check(await page.evaluate(()=>document.activeElement.dataset.problemIndex==='2'),'focus jumped to another page');
 await page.keyboard.press('2');await settle();check((await state()).sheetProblemSets[1][0].a==='42','sequential typing lost a digit');
 await page.locator('#fillRemainingBtn').click();await settle();
 let saved=await state();
 check(saved.sheetProblemSets.every(set=>set.every(p=>p.a&&p.b)),'fill did not reach all pages');
 const entered=JSON.stringify([saved.sheetProblemSets[0][0],saved.sheetProblemSets[1][0],saved.sheetProblemSets[2][0]]);
 await page.locator('#regenerateBtn').click();await settle();saved=await state();
 check(JSON.stringify([saved.sheetProblemSets[0][0],saved.sheetProblemSets[1][0],saved.sheetProblemSets[2][0]])===entered,'reroll erased manual entries');
 await page.locator('#includeAnswers').uncheck();await settle();
 check(await page.locator('.print-page:visible').count()===3,'answer OFF page count');
 await page.locator('#includeAnswers').check();await settle();
 check(await page.locator('.print-page:visible').count()===6,'answer ON page count');
 await page.reload();await settle();saved=await state();
 check(saved.sheetCount===3&&saved.sheetProblemSets[1][0].a==='42'&&saved.sheetProblemSets[2][0].a==='76','reload lost later pages');
 // Incomplete later-page problems must block the normal app print handler.
 await input(4,'a','7');
 await page.evaluate(()=>{window.__testPrintCalls=0;window.print=()=>{window.__testPrintCalls++;};});
 await page.locator('#printBtn').click();await settle();
 check(await page.evaluate(()=>window.__testPrintCalls)===0,'incomplete later page printed');
 check(await page.locator('.print-page[data-sheet-index="2"]:not(.answer-page) .manual-problem-attention').count()===1,'wrong invalid page highlighted');
 await input(4,'a','76');
 // Named save and restore also need the full set, not just problems[0].
 await page.locator('#savedWorksheetsBtn').click();await page.locator('#savedWorksheetName').fill(`multi-page-${channel}`);
 await page.locator('#saveWorksheetBtn').click();
 await page.waitForFunction(()=>document.querySelector('#savedWorksheetMessage').textContent.includes('保存しました'));
 await page.locator('#savedWorksheetsClose').click();
 await input(2,'a','91');
 await page.locator('#savedWorksheetsBtn').click();
 await page.locator('.saved-worksheet-item').filter({hasText:`multi-page-${channel}`}).getByRole('button',{name:'呼び出す',exact:true}).click();await settle();
 check((await state()).sheetProblemSets[1][0].a==='42','named restore lost page two');
 const url=await page.evaluate(()=>`${location.origin}${location.pathname}#data=${encodeState(getShareState())}`);
 const context=await page.context().browser().newContext();
 try{
  const shared=await context.newPage();await shared.goto(url);await shared.waitForTimeout(250);
  check(await shared.locator('.print-page:not(.answer-page) .manual-entry-input').count()===12,'shared URL did not restore all pages');
  check(await shared.evaluate(()=>window.__calculationProblemBuilderApi.getLibraryState().sheetProblemSets[2][0].a)==='76','shared URL lost third page');
 }finally{await context.close();}
 for(const answers of [true,false]){
  await page.locator('#includeAnswers').setChecked(answers);await settle();
  const pdf=await page.pdf({path:`output/playwright/calculation-manual-pages-${channel}-${answers?'answers':'questions'}.pdf`,format:'A4',preferCSSPageSize:true});
  check((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length===(answers?6:3),'wrong PDF page count');
 }
 await configure('add','horizontal',{creationMode:'manual'});await input(4,'a','73');
 check((await state()).sheetProblemSets[0][0].a===''&&(await state()).sheetProblemSets[2][0].a==='73','manual-only mode page routing failed');
 check(!errors.length,errors.join('\n'));
 await page.screenshot({path:`output/playwright/calculation-manual-pages-${channel}.png`,fullPage:true});
 return{channel,cases:cases.length,checks:['all three pages editable','independent values/answers','typing focus','all-page fill and preserved reroll','reload and named save','cross-context shared URL','later-page print validation','question/answer PDFs','manual-only mode'],errors};
}
