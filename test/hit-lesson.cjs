const assert=require('node:assert/strict');
module.exports=async function testHitLesson(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 try{
  await page.addInitScript(()=>{
   sessionStorage.setItem('arena.pair','[25,7]');
   let current;
   window.lessonSpeech=[];
   Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text}}});
   Object.defineProperty(window,'speechSynthesis',{value:{
    getVoices:()=>[{lang:'ko-KR'}],cancel(){clearTimeout(current)},
    speak(u){window.lessonSpeech.push(u.text);u.onstart?.();current=setTimeout(()=>u.onend?.(),u.text.includes('약점')?4300:30)}
   }});
  });
  await page.goto(url);const start=page.locator('#start'),panel=page.locator('#hit-lesson');
  await start.click();await panel.waitFor();assert.match(await panel.innerText(),/전기.*물 타입.*2배/);
  const hp=await page.locator('#hp1').innerText();
  assert.ok(parseInt(hp)<60);await page.waitForTimeout(3400);
  assert.ok(await panel.isVisible());assert.equal(await page.locator('#hp1').innerText(),hp);
  await page.waitForFunction(()=>window.lessonSpeech.some(s=>s.includes('물 타입')));
  await page.locator('#result h2').waitFor();assert.ok(await panel.isHidden());
  await start.click();await panel.waitFor();await page.locator('#continue-hit').click();assert.ok(await panel.isHidden());await page.locator('#result h2').waitFor();
  await start.click();await panel.waitFor();await page.locator('#draw0').click();assert.ok(await panel.isHidden());assert.ok(await page.locator('#result').isHidden());assert.ok(await start.isEnabled());
  // A muted game still displays the lesson, then advances without a tap.
  await page.evaluate(()=>localStorage.setItem('arena.mute','true'));await page.reload();
  await start.click();await panel.waitFor();await page.locator('#result h2').waitFor();assert.deepEqual(await page.evaluate(()=>window.lessonSpeech),[]);
  console.log('PASS first big hit: actual type, stable HP, narration, auto-resume, skip, card change and mute');
 }finally{await page.close()}
};
