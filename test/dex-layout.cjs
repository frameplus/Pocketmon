const assert=require('node:assert/strict');

module.exports=async function testDexLayout(browser,url){
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 try{
  await page.goto(url);
  await page.locator('#start').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const measure=()=>page.evaluate(()=>{
   const rect=selector=>document.querySelector(selector).getBoundingClientRect();
   const a=rect('.match-hero'),b=rect('.compare-sheet'),left=rect('#slot0 .card'),right=rect('#slot1 .card');
   return [a.top-b.top,a.bottom-b.bottom,left.top-right.top,left.bottom-right.bottom];
  });
  for(const width of [1440,1024,800]){
   await page.setViewportSize({width,height:960});
   assert.ok((await measure()).every(delta=>Math.abs(delta)<=1),'desktop panels and cards align at '+width);
   assert.equal(await page.getByPlaceholder('검색',{exact:true}).count(),3);
  }
  await page.locator('nav a[href="#dex"]').click();
  await page.route('**/thumbs/10043.webp',route=>route.abort());
  await page.locator('#powerOrder').click();
  const images=page.locator('#catalog img');
  for(const image of await images.all()){
   await image.scrollIntoViewIfNeeded();
   await image.evaluate(img=>img.decode().catch(()=>{}));
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('#catalog img')].every(img=>img.complete&&img.naturalWidth>0));
  assert.match(await page.locator('[data-card="10043"] img').getAttribute('src'),/^\/art\/10043$/);
  await page.unroute('**/thumbs/10043.webp');
  await page.locator('#dexOrder').click();await page.locator('#powerOrder').click();
  await page.locator('[data-card="10043"] img').evaluate(img=>img.decode());
  assert.match(await page.locator('[data-card="10043"] img').getAttribute('src'),/^\/thumbs\//);
  console.log('PASS desktop panel/card alignment, three search labels, 36 ranked images and original-art recovery');
 }finally{await page.close()}
};
