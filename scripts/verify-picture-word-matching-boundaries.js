// Run in a dedicated playwright-cli Chrome/Edge session with the local server on 4192.
async(page)=>{
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const context=await page.context().browser().newContext();
 try{
  const p=await context.newPage();await p.goto('http://127.0.0.1:4192/apps/picture-word-matching/');
  const settle=()=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);await Promise.all([...document.querySelectorAll('#pages img')].map(i=>i.decode()));});
  // Only a generic fish and a puffer fish: enough words but no unambiguous worksheet.
  await p.locator('#pairCount').selectOption('2');await p.locator('#wordBank').evaluate(el=>{el.open=true;});await settle();
  await p.locator('#excludeVisible').click();
  for(const word of ['さかな','ふぐ']){
   await p.locator('#wordSearch').fill(word);
   await p.locator('.bank-word').filter({hasText:new RegExp(`^${word}$`)}).locator('input').check();
  }await settle();
  check((await p.locator('#status').textContent()).includes('曖昧'),'ambiguous pool reason');
  check(await p.locator('#printBtn').isDisabled(),'ambiguous pool printed');
  await p.locator('#printSheetCount').fill('3');await settle();
  check(await p.locator('.print-page').count()===0,'ambiguous pool stale pages');
  const before=await p.evaluate(()=>performance.now());await p.waitForTimeout(100);
  check((await p.evaluate(()=>performance.now()))-before<1000,'ambiguous pool blocked event loop');
  await p.locator('#resetSelection').click();await p.locator('#wordBank').evaluate(el=>{el.open=false;});
  await p.locator('#pairCount').selectOption('6');await p.locator('#printSheetCount').fill('30');await settle();
  check(await p.locator('.print-page').count()===60,'30 sheets');
  check(await p.evaluate(()=>new Set(window.PictureWordApp.getState().sheets.flatMap(s=>s.ids)).size)===180,'unseen word priority');
  await p.locator('#printSheetCount').fill('3');await p.locator('#printOrientation').selectOption('landscape');await settle();
  const channel=(await p.evaluate(()=>navigator.userAgent)).includes('Edg/')?'edge':'chrome';
  await p.pdf({path:`output/playwright/matching-${channel}-landscape-six.pdf`,format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true});
  // Print button waits for image decoding and must retain the exact same worksheet.
  const stable=await p.evaluate(()=>JSON.stringify(window.PictureWordApp.getState().sheets));
  await p.evaluate(()=>{window.__testPrint=0;window.print=()=>{window.__testPrint++;};});
  await p.locator('#printBtn').click();await settle();
  check(await p.evaluate(()=>window.__testPrint)===1,'print button route');
  check(await p.evaluate(()=>JSON.stringify(window.PictureWordApp.getState().sheets))===stable,'button print regenerated');
  // Phone controls remain usable; the paper preview can scroll independently.
  await p.setViewportSize({width:390,height:844});await p.locator('#scriptMode').selectOption('katakana');await settle();
  check(await p.locator('#printBtn').isEnabled(),'mobile controls');
  await p.screenshot({path:`output/playwright/matching-${channel}-mobile.png`});
  // Launcher search, grade/category filters, entry and return navigation.
  await p.goto('http://127.0.0.1:4192/');await p.locator('#searchInput').fill('マッチング');
  check(await p.locator('.app-card:visible').count()===1,'launcher search');
  await p.getByRole('button',{name:'教材',exact:true}).click();
  await p.getByRole('button',{name:'1年',exact:true}).click();
  check(await p.locator('.app-card:visible').count()===1,'launcher grade/category filters');
  await p.getByRole('link',{name:'マッチングを作る'}).click();await settle();
  check(p.url().includes('picture-word-matching'),'launcher entry');
  await p.getByRole('link',{name:'入口に戻る'}).click();
  check(!p.url().includes('/apps/'),'home link');
  return{channel,checks:['ambiguous pool bounded and recovery','30 sheets with 180 unique images','A4 landscape 6 pairs','real print button','390px controls','launcher grade/category entry and home']};
 }finally{await context.close();}
}
