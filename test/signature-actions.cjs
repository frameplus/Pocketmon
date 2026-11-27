const assert=require('node:assert/strict');
module.exports=async function signatureActions(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 try{
  await page.addInitScript(()=>{localStorage.setItem('arena.mute','true');sessionStorage.setItem('arena.pair','[68,448]')});
  const moves=[223,396,89,304,242,24],initial=[165,145],hp=initial.slice();
  const events=moves.map((move,n)=>{
   const i=n%2,j=1-i,damage=n===1?0:n===5?hp[j]:8;hp[j]-=damage;
   return {i,j,kind:'move',move,round:1+Math.floor(n/2),damage,max:initial,hp:hp.slice(),effect:n===1?'immune':'',finisher:n<2};
  });
  await page.route('**/api/battle/68/448',r=>r.fulfill({json:{initial,events,winner:1}}));
  await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('#battlefield')?.dataset.mesh0==='68'&&document.querySelector('#battlefield')?.dataset.mesh1==='448');
  await page.evaluate(async()=>{
   const {Scene}=await import('three'),original=Scene.prototype.onAfterRender;
   const report=window.strikeMotion={arm:0,flinch:0,zoom:1,finite:true};let armRest,spineRest;
   Scene.prototype.onAfterRender=function(...args){
    original.apply(this,args);
    const field=document.querySelector('#battlefield'),a=this.getObjectByName('fighter-0'),b=this.getObjectByName('fighter-1');
    if(!a||!b)return;
    const elbow=a.getObjectByName('RForeArm'),spine=b.getObjectByName('Spine1');
    armRest??=elbow.quaternion.clone();spineRest??=spine.quaternion.clone();
    if(field.dataset.technique!=='punch')return;
    report.finite&&=[a,b,elbow,spine].every(o=>o.matrixWorld.elements.every(Number.isFinite));
    report.arm=Math.max(report.arm,armRest.angleTo(elbow.quaternion));
    report.flinch=Math.max(report.flinch,spineRest.angleTo(spine.quaternion));
    report.zoom=Math.max(report.zoom,document.querySelector('.battle-camera').getBoundingClientRect().width/field.clientWidth);
   };
  });
  await page.evaluate(()=>{
   const field=document.querySelector('#battlefield');window.styles=[];window.specials=[];
   new MutationObserver(()=>{
    const style=field.dataset.technique;
    if(style&&window.styles.at(-1)!==style){
     window.styles.push(style);
     if(field.dataset.finisher)window.specials.push(field.querySelector('.move-call').dataset.side);
    }
   }).observe(field,{attributes:true,attributeFilter:['data-technique']});
  });
  await page.locator('#start').click();await page.locator('#speed').click();await page.locator('#result h2').waitFor({timeout:60000});
  assert.deepEqual(await page.evaluate(()=>window.styles),['punch','orb','quake','echo','fang','leap']);
  assert.deepEqual(await page.evaluate(()=>window.specials),['0','1']);
  const motion=await page.evaluate(()=>window.strikeMotion);
  assert.ok(motion.finite&&motion.arm>.25&&motion.flinch>.12&&motion.zoom>1.1,JSON.stringify(motion));
  console.log('PASS six move actions and two special cut-ins including an immune target');
 }finally{await page.close()}
};
