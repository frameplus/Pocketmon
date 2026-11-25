const assert=require('node:assert/strict');
module.exports=async function testBattleAction(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 try{
  await page.addInitScript(()=>{sessionStorage.setItem('arena.pair','[25,6]');localStorage.setItem('arena.mute','true')});
  // Replay a known pair of turns to test exactly when the numbers and visual effects change.
  const strike=(i,move,damage,hp,type,defender,factor)=>({i,j:1-i,move,kind:'move',hit:true,round:1,damage,hp,max:[110,153],effect:factor>1?'strong':'',matchup:{type,defender,factor}});
  const events=[strike(1,53,106,[4,153],10,[13],1),strike(0,85,80,[4,73],13,[10,3],2),{...strike(1,53,4,[0,73],10,[13],1),round:2}];
  await page.route('**/api/battle/25/6',r=>r.fulfill({json:{winner:1,initial:[110,153],events}}));
  await page.goto(url);const start=page.locator('#start'),field=page.locator('#battlefield');
  await field.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.mesh0==='25'&&document.querySelector('#battlefield').dataset.mesh1==='6');
  // Inspect actual rendered objects through Three's scene callback, across consecutive ranged moves.
  await page.evaluate(async()=>{
   const {Scene}=await import('three'),original=Scene.prototype.onBeforeRender;
   window.tilt={peak:[0,0],latest:[null,null],startX:[],stride:[0,0]};
   Scene.prototype.onBeforeRender=function(...args){
    original.apply(this,args);
    for(let i=0;i<2;i++){
     const fighter=this.getObjectByName('fighter-'+i);if(!fighter)continue;
     window.tilt.startX[i]??=fighter.position.x;
     window.tilt.stride[i]=Math.max(window.tilt.stride[i],Math.abs(fighter.position.x-window.tilt.startX[i]));
     const angle=Math.abs(fighter.rotation.z);
     window.tilt.peak[i]=Math.max(window.tilt.peak[i],angle);
     window.tilt.latest[i]=angle;
    }
   };
  });
  await start.click();
  const phase=(style,phase)=>page.waitForFunction(([s,p])=>{const f=document.querySelector('#battlefield');return f.dataset.technique===s&&f.dataset.phase===p},[style,phase]);
  await phase('flame','windup');assert.equal(await page.locator('#hp0').innerText(),'110/110');
  assert.match(await page.locator('#a0 img').evaluate(el=>el.currentSrc),/fighters\/front\/25.gif/);
  assert.match(await page.locator('#a1 img').evaluate(el=>el.currentSrc),/fighters\/front\/6.gif/);
  await phase('flame','impact');assert.equal(await page.locator('#hp0').innerText(),'4/110');
  assert.equal(await field.locator('.hit-points').innerText(),'−106');
  await phase('lightning','windup');assert.equal(await page.locator('#hp1').innerText(),'153/153');
  await phase('lightning','impact');assert.equal(await page.locator('#hp1').innerText(),'73/153');
  await page.waitForFunction(()=>document.querySelector('#round').textContent==='승부가 났어!');
  assert.equal(await page.locator('#hp0').innerText(),'0/110');
  assert.ok(await page.locator('#result').isHidden());
  await page.waitForFunction(()=>window.tilt.latest.every(v=>v===0));
  assert.ok(await page.evaluate(()=>window.tilt.stride.every(x=>x>.35)),'both ranged attackers step out onto the field');
  const peaks=await page.evaluate(()=>window.tilt.peak);
  assert.ok(peaks.every(v=>v>0&&v<=0.055001),'each move leans briefly by at most 3.2 degrees');
  await page.locator('#result h2').waitFor();
  assert.match(await page.locator('#result').innerText(),/화염방사.*106[\s\S]*위력이 90/);
  assert.equal(await page.locator('#hit-lesson,#continue-hit').count(),0);
  await start.click();await phase('flame','windup');await page.locator('#draw0').click();
  assert.equal(await field.getAttribute('data-phase'),null);assert.ok(await field.locator('.hit-points').isHidden());
  console.log('PASS animated battle sprites, fire/lightning timings, impact HP, uninterrupted battle, result explanation, cancellation');
 }finally{await page.close()}
};
