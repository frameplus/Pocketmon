const assert=require('node:assert/strict');

module.exports=async function testTeamFinisher(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  const ids=[25,6],event={i:0,j:1,kind:'move',move:85,round:2,damage:24,hp:[40,0],max:[110,153],effect:'strong',matchup:{type:13,defender:[10,3],factor:2},finisher:true};
  const round={ids,result:{winner:0,initial:[110,153],events:[event]}};
  await page.route('**/api/team-battle',route=>route.fulfill({json:{winner:0,score:[3,0],rounds:[round,round,round]}}));
  await page.addInitScript(()=>{
   localStorage.setItem('arena.mute','true');
   new MutationObserver(()=>{
    const field=document.querySelector('#battlefield[data-finisher]');if(!field)return;
    window.specialSeen={caption:field.querySelector('.move-call').dataset.caption,cutinHidden:field.querySelector('.special-cutin').hidden};
   }).observe(document,{attributes:true,attributeFilter:['data-finisher'],subtree:true});
  });
  await page.goto(url+'/teams.html?lang=ko');await page.locator('#launch').click();
  const element=await page.locator('#stage iframe').elementHandle(),frame=await element.contentFrame();
  await frame.waitForFunction(()=>window.specialSeen);
  assert.deepEqual(await frame.evaluate(()=>window.specialSeen),{caption:'필살기 · 전기',cutinHidden:true});
  await page.locator('#finish').click();await page.locator('#verdict').waitFor();
  assert.equal(await page.locator('iframe').count(),0);
  console.log('PASS shared team replay special, reduced-motion caption and exiting during a move');
 }finally{await page.close()}
};
