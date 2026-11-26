const assert=require('node:assert/strict');
module.exports=async function elementalFighters(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 try{
  await page.addInitScript(()=>{sessionStorage.setItem('arena.pair','[6,9]');localStorage.setItem('arena.mute','true')});
  // A Normal move isolates each species' effects from the projectile's element.
  const strike=(i,hp,round=1,damage=20)=>({i,j:1-i,kind:'move',move:33,hit:true,round,damage,hp,max:[153,154],effect:'',matchup:{type:1,factor:1,defender:i?[10,3]:[11]}});
  await page.route('**/api/battle/6/9',r=>r.fulfill({json:{winner:0,initial:[153,154],events:[strike(1,[133,154]),strike(0,[133,134]),strike(1,[113,134],2),strike(0,[113,0],2,134)]}}));
  await page.route('**/stadium.js',r=>r.abort());
  await page.goto(url);
  const fx=page.locator('.element-fx');
  await page.locator('#start').click();assert.ok(await fx.isHidden());
  await fx.waitFor();
  await page.waitForFunction(()=>{
   const canvas=document.querySelector('.element-fx'),w=canvas.width,h=canvas.height;
   const p=canvas.getContext('2d').getImageData(0,0,w,h).data;
   let flame=0,water=0;
   for(let i=0;i<p.length;i+=4){
    if(p[i+3]<125)continue;
    if(p[i]>200&&p[i+2]<100)flame++;
    if(p[i]<130&&p[i+1]>130&&p[i+2]>200)water++;
   }
   const flying=getComputedStyle(document.querySelector('#a0 .flight-rig')).transform;
   return flame>20&&water>20&&flying!=='none'&&new DOMMatrix(flying).m42 < -10;
  });
  assert.equal(await page.locator('#a1 .flight-rig').evaluate(el=>getComputedStyle(el).transform),'none');
  await page.locator('#speed').click();await page.locator('#skip').click();await page.locator('#result h2').waitFor();
  assert.ok(await fx.isHidden());assert.equal(await page.locator('#a0 .flight-rig').evaluate(el=>el.style.transform),'');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#rematch').click();
  await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.technique==='rush');
  assert.ok(await fx.isHidden());assert.equal(await page.locator('#a0 .flight-rig').evaluate(el=>el.style.transform),'');
  await page.locator('#exit').click();
  console.log('PASS fire, water and flight during a Normal move, grounded opponent, skip cleanup and reduced-motion rematch');
 }finally{await page.close()}
};
