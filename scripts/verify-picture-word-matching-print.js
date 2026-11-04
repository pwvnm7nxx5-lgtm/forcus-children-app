// Run in a dedicated playwright-cli Chrome/Edge session with the local server on 4192.
async(page)=>{
 const context=await page.context().browser().newContext();
 try{
  await context.addInitScript(()=>{window.__nativePrintCalls=0;window.print=()=>window.__nativePrintCalls++;});
  const p=await context.newPage();await p.goto('http://127.0.0.1:4192/apps/picture-word-matching/');
  const settle=()=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);await Promise.all([...document.querySelectorAll('#pages img')].map(img=>img.decode()));});
  await settle();await p.keyboard.press('Control+p');
  if(await p.evaluate(()=>window.__nativePrintCalls)!==1)throw Error('valid Ctrl+P blocked');
  await p.waitForTimeout(1100);
  await p.locator('#wordBank').evaluate(el=>{el.open=true;});await settle();
  await p.locator('#excludeVisible').click();await settle();await p.keyboard.press('Control+p');
  if(await p.evaluate(()=>window.__nativePrintCalls)!==1)throw Error('invalid Ctrl+P printed empty sheet');
  await p.locator('#resetSelection').click();await p.locator('#printSheetCount').fill('2.5');await settle();
  if(await p.locator('.print-page').count()!==4)throw Error('fractional sheet count did not normalise');
  // Corrupted persisted shapes must not crash the app.
  await p.evaluate(()=>{localStorage.setItem('picture-word-matching:v1',JSON.stringify({settings:{scriptMode:'mixed',pairCount:'4'},sheets:[null,{ids:['bad'],words:['bad']}]}));});
  await p.reload();await settle();
  if(await p.locator('.print-page').count()!==4)throw Error('malformed saved state did not recover');
  // Failed image downloads must not produce an incomplete printed worksheet.
  await p.route('**/assets/illustrations/*.webp',route=>route.abort());
  await p.reload();await p.waitForFunction(()=>document.querySelector('#printBtn').disabled&&document.querySelector('#status').textContent.includes('絵を読み込めません'));
  await p.keyboard.press('Control+p');
  if(await p.evaluate(()=>window.__nativePrintCalls)!==0)throw Error('missing images reached native print');
  return{nativeCtrlP:true,emptyPrintBlocked:true,fractionalCount:true,malformedStorage:true,missingImagesBlocked:true};
 }finally{await context.close();}
}
