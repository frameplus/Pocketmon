const assert=require('node:assert/strict');

module.exports=async function testRecap(browser,url){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 try{
  await page.addInitScript(()=>{
    sessionStorage.setItem('arena.pair','[25,292]');
    // Android browsers may list no Korean voice, or list one which then fails.
    let broken=false;
    Object.defineProperty(window,'speechSynthesis',{value:{
      getVoices:()=>broken?[{lang:'ko-KR'}]:[],cancel(){},
      speak(u){queueMicrotask(()=>u.onerror?.({error:'synthesis-failed'}))}
    }});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text}}});
    window.useBrokenVoice=()=>{broken=true};
    window.audibleBuffers=0;
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const data=this.buffer?.getChannelData(0);
      if(data?.some(sample=>Math.abs(sample)>.01))window.audibleBuffers++;
      return start.apply(this,args);
    };
  });
  const speech=[];
  page.on('request',r=>{if(r.url().endsWith('/api/narration'))speech.push(r.postDataJSON().text)});
  await page.goto(url);await page.locator('#start').click();
  await page.locator('#result h2').waitFor({timeout:60000});
  assert.match(await page.locator('#result').innerText(),/불가사의부적/);
  await page.waitForFunction(()=>document.querySelector('#read-result').getAttribute('aria-pressed')==='true'&&!document.querySelector('#read-status').textContent);
  const beforeReplay=await page.evaluate(()=>window.audibleBuffers);
  assert.ok(speech.some(s=>s.includes('승리')&&s.includes('불가사의부적')));
  await page.locator('#read-result').click();assert.match(await page.locator('#read-result').getAttribute('aria-label'),/다시 듣기/);
  await page.evaluate(()=>window.useBrokenVoice());
  await page.locator('#read-result').click();
  await page.waitForFunction(n=>window.audibleBuffers>n,beforeReplay);
  assert.equal(speech.filter(s=>s.includes('불가사의부적')).length,2);
  await page.locator('#settings').click();await page.locator('#sound').click();await page.locator('#close').click();
  const count=speech.length;
  await page.locator('#read-result').click();assert.match(await page.locator('#read-status').innerText(),/꺼져/);
  assert.equal(speech.length,count);
  console.log('PASS Korean recap, silent-device fallback, audible PCM, replay, broken native voice and mute');
 }finally{await page.close()}
};
