const assert=require('node:assert/strict');
module.exports=async function testStadium(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 try{
  await page.addInitScript(()=>localStorage.setItem('arena.mute','true'));
  await page.goto(url);const field=page.locator('#battlefield');await field.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const f=document.querySelector('#battlefield');return f?.dataset.mesh0==='25'&&f.dataset.mesh1==='6'},{},{timeout:40000});
  assert.ok(await field.locator('.world').isVisible());
  assert.equal(await field.locator('#a0 img').evaluate(i=>getComputedStyle(i).opacity),'0');
  await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.technique==='flame');
  await page.locator('#result h2').waitFor({timeout:60000});assert.match(await page.locator('#hp0').innerText(),/\/110$/);
  await page.evaluate(()=>{const c=document.querySelector('.world');c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()});
  await page.waitForFunction(()=>!document.querySelector('#battlefield').dataset.mesh0);
  assert.match(await field.locator('#a0 img').evaluate(i=>i.currentSrc),/fighters\/front\/25.gif/);
  assert.notEqual(await field.locator('#a0 img').evaluate(i=>getComputedStyle(i).opacity),'0');
  console.log('PASS real WebGL stadium, Pikachu and Charizard meshes, attacks, result and front-facing context-loss fallback');
 }finally{await page.close()}
};
