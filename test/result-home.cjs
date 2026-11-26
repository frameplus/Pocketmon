const assert=require('node:assert/strict');

module.exports=async function testResultHome(browser,url){
 for(const [width,lang] of [[390,'ko'],[1366,'en']]){
  const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
  try{
   await page.addInitScript(()=>localStorage.setItem('arena.mute','true'));
   const hit={kind:'move',i:0,j:1,move:85,round:2,damage:58,hp:[12,0],max:[110,153],effect:'strong',matchup:{type:13,defender:[10,3],factor:2}};
   let battles=0;
   await page.route('**/api/battle/25/6',route=>{battles++;return route.fulfill({json:{winner:0,initial:[110,153],events:[hit]}})});
   await page.goto(url+'/?lang='+lang+'#battle');
   const result=page.locator('#result'),brand=page.locator('header .brand');
   const home=()=>page.locator('#chooser').waitFor({state:'visible'});
   const finish=async button=>{
    await button.click();await page.locator('#skip').click();await result.waitFor({state:'visible'});
   };
   await finish(page.locator('#start'));
   const reason=await result.locator('p').innerText();
   assert.match(reason,lang==='ko'?/10만볼트.*전기.*리자몽.*비행.*2배/:/Thunderbolt.*Charizard.*Flying.*Electric.*2 times/);
   assert.match(await result.locator('.finish-line').innerText(),/58 → 0/);
   await finish(result.getByRole('button',{name:'RETRY',exact:true}));
   await result.getByRole('button',{name:'HOME',exact:true}).click();await home();
   assert.equal(battles,2);
   await finish(page.locator('#start'));await brand.click();await home();
   await finish(page.locator('#start'));
   await page.locator('nav a[href="#dex"]').click();await brand.click();await home();
   assert.equal(new URL(page.url()).hash,'#battle');
   assert.equal(await page.locator('#slot0 .poke-name').innerText(),lang==='ko'?'피카츄':'Pikachu');
   assert.equal(await page.locator('#slot1 .poke-name').innerText(),lang==='ko'?'리자몽':'Charizard');
  }finally{await page.close()}
 }
 console.log('PASS RETRY, HOME, brand from result/dex, preserved pair, type multiplier and final HP');
};
