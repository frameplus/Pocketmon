const assert=require('node:assert/strict');
module.exports=async function testStadium(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 try{
  await page.addInitScript(()=>{
   localStorage.setItem('arena.mute','true');
   const NativeObserver=window.IntersectionObserver;
   window.IntersectionObserver=class extends NativeObserver{
    constructor(callback,options){
     super((entries,observer)=>{
      // A short scroll out and back can deliver both observations in one batch.
      if(entries.at(-1).isIntersecting&&entries.at(-1).target.id==='battlefield')
       callback([{target:entries.at(-1).target,isIntersecting:false},...entries],observer);
      else callback(entries,observer);
     },options);
    }
   };
  });
  await page.goto(url);const field=page.locator('#battlefield');await field.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const f=document.querySelector('#battlefield');return f?.dataset.mesh0==='25'&&f.dataset.mesh1==='6'},{},{timeout:40000});
  assert.ok(await field.locator('.world').isVisible());
  await page.evaluate(async()=>{
   const {Scene}=await import('three'),original=Scene.prototype.onAfterRender;
   window.paintedFrames=0;
   Scene.prototype.onAfterRender=function(...args){window.paintedFrames++;original.apply(this,args)};
  });
  await page.waitForFunction(()=>window.paintedFrames>=3);
  assert.equal(await field.locator('#a0 img').evaluate(i=>getComputedStyle(i).opacity),'0');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/battle/25/6')&&r.request().method()==='POST');
  await page.locator('#start').click();
  const {events,winner}=await (await response).json();
  assert.ok(events.at(-1).round>=4);
  assert.deepEqual(new Set(events.filter(e=>e.kind==='move').map(e=>e.i)),new Set([0,1]));
  await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.technique==='flame');
  await page.locator('#celebration').waitFor();
  assert.equal(await page.locator('#victory-word').innerText(),'VICTORY!');
  assert.equal(await page.locator('#victory-name').innerText(),['피카츄 승리!','리자몽 승리!'][winner]);
  await page.locator('#result h2').waitFor({timeout:60000});assert.match(await page.locator('#hp0').innerText(),/\/110$/);
  await page.evaluate(()=>{const c=document.querySelector('.world');c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()});
  await page.waitForFunction(()=>!document.querySelector('#battlefield').dataset.mesh0);
  const sizes=await field.locator('.actor img').evaluateAll(imgs=>imgs.map(img=>[img.offsetWidth,img.offsetHeight]));
  assert.ok(sizes[1][0]>sizes[0][0]*1.5&&sizes[1][1]>sizes[0][1]*1.5,'Charizard stays larger after a switch to sprites');
  assert.match(await field.locator('#a0 img').evaluate(i=>i.currentSrc),/fighters\/front\/25.gif/);
  assert.notEqual(await field.locator('#a0 img').evaluate(i=>getComputedStyle(i).opacity),'0');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/battle/25/6',route=>route.fulfill({json:{winner:-1,initial:[110,153],events:[],capped:true}}));
  await page.locator('#start').click();
  assert.ok(await page.locator('#celebration').isHidden());
  await page.getByText('DRAW!',{exact:true}).waitFor();
  assert.equal(await page.locator('#victory-name').innerText(),'무승부!');
  await page.locator('#draw1').click();
  assert.ok(await page.locator('#celebration').isHidden());
  console.log('PASS real WebGL stadium, Pikachu and Charizard meshes, attacks, result and front-facing context-loss fallback');
 }finally{await page.close()}
};
