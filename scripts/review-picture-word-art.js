// Captures every artwork as actually clipped by the app, with its Japanese name.
async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:1120,height:1900}});
 try{
  const p=await context.newPage();await p.goto('http://127.0.0.1:4192/apps/picture-word-matching/');
  await p.locator('#wordBank').evaluate(el=>{el.open=true;});
  await p.waitForFunction(()=>document.querySelectorAll('.bank-word').length===240);
  const records=await p.locator('.bank-word').evaluateAll(labels=>labels.map(label=>({name:label.textContent,id:label.querySelector('input').dataset.wordId,html:label.querySelector('.illustration').outerHTML})));
  for(let start=0;start<records.length;start+=60){
   const items=records.slice(start,start+60);
   await p.setContent(`<html lang="ja"><style>body{font:15px Meiryo;background:white;margin:10px}h1{font-size:18px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.card{border:1px solid #ccd;padding:5px;text-align:center;height:166px}.illustration{width:140px;display:block;position:relative;overflow:hidden;aspect-ratio:var(--art-aspect);margin:auto}.illustration img{position:absolute;max-width:none;max-height:none;object-fit:fill}.card small{display:block;font-size:10px;color:#567}</style><h1>教材用イラスト ${start+1}〜${start+items.length}</h1><div class="grid">${items.map(w=>`<div class="card">${w.html.replace(/src="assets\//g,'src="http://127.0.0.1:4192/apps/picture-word-matching/assets/')}${w.name}<small>${w.id}</small></div>`).join('')}</div></html>`);
   await p.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
   await p.screenshot({path:`output/playwright/matching-reviewed-${start/60+1}.png`,fullPage:true});
  }
  return{pictures:records.length,reviewSheets:4};
 }finally{await context.close();}
}
