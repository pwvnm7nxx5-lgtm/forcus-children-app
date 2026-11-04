// Run at the app in a dedicated playwright-cli Chrome/Edge session.
async(page)=>{
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const channel=(await page.evaluate(()=>navigator.userAgent)).includes('Edg/')?'edge':'chrome';
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);await Promise.all([...document.querySelectorAll('#pages img')].map(img=>img.decode()));});
 const shapes=()=>page.evaluate(()=>JSON.stringify(window.PictureWordApp.getState().sheets));
 await page.evaluate(()=>{localStorage.removeItem('picture-word-matching:v1');localStorage.removeItem(`print-adjustments:${location.pathname}`);});
 await page.reload();await settle();
 check(await page.locator('.print-page').count()===2,'default page count');
 check(await page.locator('#printSheetCount').count()===1,'missing shared sheet count');
 const original=await shapes();
 for(const mode of ['katakana','mixed','hiragana']){
  await page.locator('#scriptMode').selectOption(mode);await settle();
  check(await shapes()===original,'script toggle changed shapes');
  const texts=await page.locator('.print-page:not(.answer-page) .word-frame span').allTextContents();
  if(mode==='hiragana')check(texts.every(t=>/^[ぁ-ゖー]+$/.test(t)),'hiragana mode');
  if(mode==='katakana')check(texts.every(t=>/^[ァ-ヶー]+$/.test(t)),'katakana mode');
  if(mode==='mixed')check(texts.some(t=>/[ぁ-ゖ]/.test(t))&&texts.some(t=>/[ァ-ヶ]/.test(t)),'mixed mode missing a script');
 }
 await page.locator('#fontSize').selectOption('150');await page.locator('#printProblemScaleNumber').fill('140');await settle();
 check(await shapes()===original,'size toggle regenerated');
 for(const count of [1,2,3]){
  await page.locator('#printSheetCount').fill(String(count));await settle();
  check(await page.locator('.print-page').count()===count*2,'multiple page count');
 }
 let saved=await shapes();await page.reload();await settle();check(await shapes()===saved,'reload lost pages');
 check(await page.locator('#printSheetCount').inputValue()==='3','sheet count reload');
 await page.locator('#includeAnswers').uncheck();await settle();check(await shapes()===saved,'answer toggle regenerated');
 check(await page.locator('.print-page').count()===3,'answer off');
 await page.locator('#includeAnswers').check();await settle();
 check(await page.locator('.print-page').count()===6,'answer on');
 for(const category of ['animals','food','life','tools','transport','nature','play','all']){
  await page.locator('#category').selectOption(category);await settle();
  const ok=await page.evaluate(()=>{const s=window.PictureWordApp.getState();const map=new Map(window.PictureWordVocabulary.vocabulary.map(w=>[w.id,w]));return s.sheets.every(sheet=>sheet.ids.every(id=>s.settings.category==='all'||map.get(id).category===s.settings.category));});
  check(ok,`category mismatch ${category}`);
 }
 async function geometry(){
  return page.evaluate(()=>{
   const issues=[];
   document.querySelectorAll('.word-frame span').forEach(span=>{const r=span.getBoundingClientRect(),p=span.parentElement.getBoundingClientRect();if(r.width>p.width+1||r.height>p.height+1)issues.push('word clipping');});
   document.querySelectorAll('.answer-connection').forEach(line=>{
    const board=line.closest('.matching-board');
    for(const[end,kind]of [[1,'picture'],[2,'word']]){
     const point=new DOMPoint(Number(line.getAttribute(`x${end}`)),Number(line.getAttribute(`y${end}`))).matrixTransform(line.getScreenCTM());
     const dot=board.querySelector(`.${kind}-dot[data-word-id="${line.dataset.wordId}"]`).getBoundingClientRect();
     if(Math.hypot(point.x-dot.x-dot.width/2,point.y-dot.y-dot.height/2)>1.5)issues.push(`wrong ${kind} endpoint`);
    }
   });
   document.querySelectorAll('.matching-board').forEach(board=>{if(board.getBoundingClientRect().height<80)issues.push('too little writing space');});
   return issues;
  });
 }
 for(const orientation of ['portrait','landscape'])for(const count of ['2','3','4','6']){
  await page.locator('#printOrientation').selectOption(orientation);await page.locator('#pairCount').selectOption(count);await settle();
  check((await geometry()).length===0,`${orientation}/${count}: ${await geometry()}`);
  check(await page.locator('.print-page:not(.answer-page) .picture-frame').count()===3*Number(count),'pair count');
 }
 // Exclusions, kana search, impossible conditions and recovery via the real bank UI.
 await page.locator('#pairCount').selectOption('4');await page.locator('#wordBank').evaluate(el=>{el.open=true;});await settle();
 await page.locator('#wordSearch').fill('リンゴ');
 check(await page.locator('#bankList input').count()===1,'katakana search');
 const removed=await page.locator('#bankList input').getAttribute('data-word-id');
 await page.locator('#bankList input').uncheck();await settle();
 check(await page.evaluate(id=>window.PictureWordApp.getState().sheets.every(s=>!s.ids.includes(id)),removed),'excluded word generated');
 await page.locator('#wordSearch').fill('');await page.locator('#excludeVisible').click();await settle();
 check(await page.locator('#printBtn').isDisabled(),'impossible condition print enabled');
 check(await page.locator('.print-page').count()===0,'stale sheets shown for impossible settings');
 check((await page.locator('#status').textContent()).includes('0語'),'missing impossible reason');
 await page.locator('#resetSelection').click();await settle();check(await page.locator('.print-page').count()===6,'recovery failed');
 // Stable, recognisable demo: apple, banana, cat and car; no internal API mutation.
 await page.locator('#excludeVisible').click();await settle();
 for(const word of ['りんご','ばなな','ねこ','くるま']){
  await page.locator('#wordSearch').fill(word);
  await page.locator('#bankList .bank-word').filter({hasText:new RegExp(`^${word}$`)}).locator('input').check();await settle();
 }
 await page.locator('#wordSearch').fill('');await page.locator('#wordBank').evaluate(el=>{el.open=false;});
 await page.locator('#scriptMode').selectOption('mixed');await page.locator('#fontSize').selectOption('100');
 await page.locator('#printProblemScaleNumber').fill('100');await page.locator('#printOrientation').selectOption('portrait');await settle();
 saved=await shapes();
 for(const size of ['A4','B5','Letter']){
  const paper=size==='B5'?{width:'182mm',height:'257mm'}:{format:size};
  await page.pdf({path:`output/playwright/matching-${channel}-${size}.pdf`,...paper,preferCSSPageSize:true,printBackground:true});
  check(await shapes()===saved,'printing regenerated shapes');
 }
 await page.locator('#includeAnswers').uncheck();await settle();
 await page.pdf({path:`output/playwright/matching-${channel}-questions.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
 await page.locator('#printSheetCount').fill('1');await settle();
 await page.locator('.print-page').first().screenshot({path:`output/playwright/matching-${channel}-preview.png`});
 check(!errors.length,errors.join('\n'));
 return{channel,bank:await page.evaluate(()=>window.PictureWordVocabulary.vocabulary.length),modes:3,categories:7,counts:[2,3,4,6],sheets:[1,2,3],outputs:['A4','B5','Letter','answers off'],errors};
}
