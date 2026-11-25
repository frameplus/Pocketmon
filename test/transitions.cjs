const assert=require('node:assert/strict');

module.exports=async function testTransitions(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  await page.addInitScript(()=>localStorage.setItem('arena.mute','true'));
  let attempts=0;
  await page.route('**/models/25.glb',route=>++attempts===1
   ?route.fulfill({status:503,body:'temporarily unavailable'}):route.continue());
  await page.goto(url);
  await page.locator('#battlefield').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.mesh1==='6');
  await page.locator('#start').click();
  await page.locator('#celebration').waitFor({timeout:60000});
  const recovered=await page.locator('#battlefield').getAttribute('data-mesh0');
  const winningSide=Number(await page.locator('#celebration').getAttribute('data-side'));
  await page.locator('nav a[href="#history"]').click();
  const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('arena.history')||'[]'));
  const visibleRecords=await page.locator('#records .record').count();

  let release;
  const ready=new Promise(resolve=>{
   page.route('**/api/friend',async route=>{
    await new Promise(done=>{release=done;resolve()});
    await route.fulfill({json:{intent:'battle',focus:25,reply:'대결을 시작하자!',action:{kind:'battle',ids:[25,6]}}});
   });
  });
  await page.locator('nav a[href="#friend"]').click();
  await page.locator('#message').fill('대결해 줘');
  await page.locator('#chat button[type=submit]').click();
  await ready;
  await page.locator('nav a[href="#dex"]').click();
  const processed=page.waitForResponse(r=>r.url().endsWith('/api/friend'));
  release();await (await processed).finished();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const active=await page.locator('nav a[aria-current="page"]').getAttribute('href');

  console.log('Transition checks:',{attempts,recovered,visibleRecords,active});
  assert.equal(recovered,'25','a temporary model failure can recover when starting the battle');
  assert.equal(visibleRecords,1,'the decided battle is immediately available in history');
  assert.equal(history[0].w,winningSide);
  assert.deepEqual(history[0].ids,[25,6]);
  assert.equal(active,'#dex','a late answer must not take the child away from the Pokédex');

  await page.unroute('**/api/friend');
  await page.route('**/api/friend',route=>route.fulfill({json:{focus:7,intent:'select',reply:'꼬부기!',action:{kind:'select',id:7}}}));
  await page.evaluate(()=>{
   window.SpeechRecognition=class{
    start(){window.recording=this;this.onstart()}
    stop(){this.onend()}
    abort(){this.onend()}
   }
  });
  await page.locator('nav a[href="#battle"]').click();
  await page.locator('#slot1 .slotmic').click();
  await page.locator('#q0').focus();
  await page.evaluate(()=>{
   const row=Object.assign([{transcript:'꼬부기'}],{isFinal:true});
   window.recording.onresult({results:[row]});
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.pair h2')].some(h=>h.textContent==='꼬부기'));
  assert.equal(await page.locator('#slot1 h2').innerText(),'꼬부기','use the card whose microphone received the name');
  assert.equal(await page.locator('#slot0 h2').innerText(),'피카츄');
 }finally{await page.close()}
};
