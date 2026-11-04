// Dedicated playwright-cli session; validates v1 -> generated-art migration and atlas viewports.
async(page)=>{
 const context=await page.context().browser().newContext();
 const check=(ok,label)=>{if(!ok)throw Error(label);};
 try{
  const p=await context.newPage();await p.goto('http://127.0.0.1:4192/apps/picture-word-matching/');
  const settle=()=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);await Promise.all([...document.querySelectorAll('#pages img')].map(img=>img.decode()));});
  const legacy={settings:{scriptMode:'mixed',pairCount:'4'},excluded:['1F438','1FA84'],sheets:[{ids:['1F34E','1F34C','1F408','1F697'],words:['1F697','1F408','1F34C','1F34E']}]};
  await p.evaluate(state=>localStorage.setItem('picture-word-matching:v1',JSON.stringify(state)),legacy);
  await p.reload();await settle();
  let state=await p.evaluate(()=>window.PictureWordApp.getState());
  check(JSON.stringify(state.sheets[0].ids)===JSON.stringify(['apple','banana','cat','car']),'legacy order not preserved');
  check(JSON.stringify(state.sheets[0].words)===JSON.stringify(['car','cat','banana','apple']),'legacy answers not preserved');
  check(state.excluded.includes('frog')&&!state.excluded.includes('1FA84'),'legacy exclusions');
  check(await p.locator('#catalogNotice').isVisible(),'missing migration notice');
  await p.reload();await settle();check(await p.locator('#catalogNotice').isHidden(),'notice persisted after successful migration');
  // Unsupported fantasy objects and homonyms must be discarded rather than re-labelled.
  for(const ids of [['1FA84','1F34E'],['1F577','1F9AA']]){
   await p.evaluate(ids=>localStorage.setItem('picture-word-matching:v1',JSON.stringify({settings:{pairCount:'2'},sheets:[{ids,words:[...ids].reverse()}]})),ids);
   await p.reload();await settle();state=await p.evaluate(()=>window.PictureWordApp.getState());
   check(state.sheets[0].ids.length===2&&state.sheets[0].ids.every(id=>!ids.includes(id)),'unsupported legacy object restored');
  }
  await p.evaluate(()=>localStorage.setItem('picture-word-matching:v1',JSON.stringify({settings:{pairCount:'2'},sheets:[{ids:['1FA84','1F34E'],words:['1F34E','1FA84']},{ids:['1F34C','1F408'],words:['1F408','1F34C']}]})));
  await p.reload();await settle();state=await p.evaluate(()=>window.PictureWordApp.getState());
  check(JSON.stringify(state.sheets[1].ids)===JSON.stringify(['banana','cat']),'a replaced legacy sheet shifted another page');
  // Last atlas: the slide crosses a nominal tile boundary; neither crop may show its neighbour.
  await p.evaluate(()=>localStorage.setItem('picture-word-matching:v1',JSON.stringify({catalogVersion:2,settings:{pairCount:'2'},sheets:[{ids:['jump-rope','slide'],words:['slide','jump-rope']}]})));
  await p.reload();await settle();
  const geometry=await p.evaluate(()=>[...document.querySelectorAll('#pages .illustration')].map(frame=>{
   const img=frame.querySelector('img'),f=frame.getBoundingClientRect(),i=img.getBoundingClientRect();
   return{ratio:i.width/i.height,natural:img.naturalWidth/img.naturalHeight,width:f.width,height:f.height};
  }));
  check(geometry.every(g=>Math.abs(g.ratio-g.natural)<.015&&g.width>30&&g.height>30),'distorted corrected atlas crops');
  const channel=(await p.evaluate(()=>navigator.userAgent)).includes('Edg/')?'edge':'chrome';
  await p.locator('.print-page').first().screenshot({path:`output/playwright/matching-crop-${channel}.png`});
  await p.pdf({path:`output/playwright/matching-crop-${channel}.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
  check(await p.evaluate(()=>[...document.querySelectorAll('#pages img')].every(img=>img.src.includes('/assets/illustrations/')&&img.naturalWidth>=1400)),'old artwork fallback');
  return{channel,migration:true,exclusions:true,noFantasyFallback:true,noHomonymSwap:true,stableSheetPositions:true,atlasCropGeometry:true};
 }finally{await context.close();}
}
