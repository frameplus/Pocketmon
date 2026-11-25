const assert=require('node:assert/strict');
module.exports=async function testEntrance(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 try{
  await page.addInitScript(()=>{localStorage.setItem('arena.mute','true');sessionStorage.setItem('arena.pair','[25,6]')});
  await page.goto(url);
  const field=page.locator('#battlefield'),start=page.locator('#start');
  await start.waitFor();
  for(const asset of ['bg-meadow','red','brendan']){
   assert.ok(await page.evaluate(async n=>{const img=new Image();img.src='/stage/'+n+'.png';await img.decode();return img.naturalWidth>0},asset));
  }
  const enter=stage=>page.waitForFunction(stage=>document.querySelector('#battlefield').dataset.scene===stage,stage);
  // Save frames at every phase even if the runner's screenshot takes longer than the phase.
  await page.evaluate(()=>{window.stages=[];new MutationObserver(()=>{
    const field=document.querySelector('#battlefield'),stage=field.dataset.scene;
    const images=[...field.querySelectorAll('.actor img')];
    window.stages.push({stage,src:images.map(i=>i.getAttribute('src')),hp:document.querySelector('#hp0').textContent,
      hidden:images.every(i=>getComputedStyle(i).opacity==='0'),trainers:[...field.querySelectorAll('.throw-rig')].every(el=>getComputedStyle(el).display!=='none')});
  }).observe(document.querySelector('#battlefield'),{attributes:true,attributeFilter:['data-scene']})});
  await start.click();await enter('release');await enter('battle');await page.locator('#result h2').waitFor({timeout:60000});
  const stages=await page.evaluate(()=>window.stages);
  assert.deepEqual(stages.slice(0,3).map(s=>s.stage),['throw','release','battle']);
  assert.ok(stages[0].hidden&&stages[0].trainers);
  assert.equal(stages[1].hp,'110/110');assert.deepEqual(stages[1].src,['/art/25','/art/6']);
  await page.locator('#rematch').click();await enter('throw');await page.locator('#exit').click();await enter('ready');
  await page.waitForTimeout(2650);assert.equal(await field.getAttribute('data-scene'),'ready');assert.ok(await page.locator('#result').isHidden());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/battle/*/*',r=>r.fulfill({status:503,body:'unavailable'}));
  await start.click();await page.waitForFunction(()=>document.querySelector('#speech').textContent.includes('연결'));await enter('ready');
  assert.ok(await start.isEnabled());await page.unroute('**/api/battle/*/*');
  await start.click();await enter('battle');assert.equal(await field.locator('.throw-rig:visible').count(),0);
  console.log('PASS textured stage assets, staggered Master Ball entrance, selected Pokémon, rematch, interrupted throw, failed request and reduced motion');
 }finally{await page.close()}
};
