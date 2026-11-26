const assert=require('node:assert/strict');

module.exports=async function testNarrationWords(browser,url){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
    await page.addInitScript(()=>{
      const synth=new EventTarget();
      const english={lang:'en-US',name:'English'};
      const korean={lang:'ko-KR',name:'Korean'};
      let voices=[english];
      window.spoken=[];
      synth.getVoices=()=>voices;
      synth.cancel=()=>{};
      synth.speak=u=>{
        window.spoken.push([u.text,u.voice.name]);u.onstart?.();queueMicrotask(()=>u.onend?.());
      };
      window.loadKoreanVoice=()=>{voices=[english,korean];synth.dispatchEvent(new Event('voiceschanged'))};
      Object.defineProperty(window,'speechSynthesis',{value:synth});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text}}});
    });
    await page.goto(url);
    const searches=page.locator('#chooser').getByPlaceholder('검색',{exact:true});
    await searches.first().waitFor();
    assert.equal(await searches.count(),2);
    await searches.nth(1).fill('메가리자몽X');
    await page.locator('#slot1 .suggest button').first().click();
    await page.evaluate(()=>window.loadKoreanVoice());
    await page.waitForFunction(()=>window.spoken.length>0);
    assert.deepEqual(await page.evaluate(()=>window.spoken[0]),['메가리자몽 엑스!','Korean']);
    assert.equal(await page.locator('#slot1 .poke-name').innerText(),'메가리자몽X');
    const heard=await page.evaluate(async()=>{
      const narrator=createNarrator('ko',()=>{});
      await narrator.speak('10만볼트! 2번 맞혀서 HP가 25만큼 줄었어.');
      await narrator.speak('니드런♀, 폴리곤2, 1000만볼트, 0.25배.');
      await createNarrator('en',()=>{}).speak('Porygon2 wins!');
      return window.spoken.slice(1);
    });
    assert.deepEqual(heard,[
      ['십만볼트!','Korean'],['두 번 맞혀서 체력이 이십오만큼 줄었어.','Korean'],
      ['니드런 암컷, 폴리곤 투, 천만볼트, 영 점 이 오배.','Korean'],['Porygon2 wins!','English']
    ]);
    console.log('PASS both search labels, delayed Korean voice, spoken names, moves and counts');
  }finally{await page.close()}
};
