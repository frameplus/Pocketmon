const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs');
(async()=>{
const url=process.env.ARENA_URL||'http://127.0.0.1:3100',server=process.env.ARENA_URL?null:spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3100'},stdio:'inherit'});
let browser;
try{
 for(let i=0;i<30;i++){try{if((await fetch(url+'/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox','--use-fake-device-for-media-stream']});
 for(const [width,height] of [[390,844],[768,1024],[1366,900]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(url);await page.locator('#slot0 h2').waitFor();assert.equal(await page.locator('#slot0 h2').innerText(),'피카츄');
  if(width<680){
    const brand=await page.locator('.brand').boundingBox(),lang=await page.locator('#language').boundingBox();
    assert.ok(brand.x+brand.width<=lang.x,'Brand stays on the left of language settings');
  }
  await page.locator('#trainer0').fill('번개 팀');await page.locator('#trainer1').fill('별빛 팀');
  for(const i of [0,1]){
    const card=await page.locator('#slot'+i+' .card').boundingBox();
    const search=await page.locator('#q'+i).boundingBox(),draw=await page.locator('#draw'+i).boundingBox();
    assert.ok(search.y>=card.y+card.height-1&&draw.y>=search.y+search.height-1);
  }
  const currentCards=()=>page.locator('.pair .art img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')));
  let previousCards=await currentCards();
  for(let draw=0;draw<2;draw++){
    await page.locator('#draw'+draw).click();
    const next=await currentCards();
    assert.equal(new Set(next).size,2);
    assert.ok(!previousCards.includes(next[draw]));assert.equal(next[1-draw],previousCards[1-draw]);
    assert.equal(await page.locator('#trainer0').inputValue(),'번개 팀');assert.equal(await page.locator('#trainer-tag1').innerText(),'별빛 팀');
    assert.deepEqual(await page.locator('#actors img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src'))),next);
    assert.equal(await page.locator('#round').innerText(),'준비 완료');
    assert.ok(await page.locator('#start').isEnabled());
    assert.ok(await page.locator('#result').isHidden());
    previousCards=next;
  }
  await page.locator('nav a[href="#history"]').click();await page.locator('#history').waitFor();
  assert.equal(await page.locator('.record').count(),0);await page.locator('nav a[href="#battle"]').click();
  const q=page.locator('#q0');await q.fill('C');assert.ok(await page.locator('#s0 button').count()>0);await q.fill('Charizard');await page.locator('#s0 button').first().click();await page.locator('#slot0 [data-form="10034"]').click();assert.equal(await page.locator('#slot0 h2').innerText(),'메가리자몽X');
  assert.ok(await page.locator('#slot0 .stats').isVisible());assert.ok(await page.locator('#slot0 .move').first().isVisible());assert.equal(await page.locator('#slot0 .stats span').count(),6);assert.ok(await page.locator('#slot0 .move').count()>=3);
  await page.locator('#q1').fill('ㅍㅋㅊ');await page.locator('#s1 button').first().click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#battle img')].every(i=>i.complete&&i.naturalWidth>0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#start').click();await page.locator('#result h2').waitFor({timeout:60000});assert.equal(await page.locator('#prediction').getAttribute('open'),null);await page.locator('#start').click();await page.locator('#result h2').waitFor({timeout:60000});
  await page.locator('nav a[href="#history"]').click();await page.locator('#history .record').nth(1).waitFor();assert.equal(await page.locator('.record').count(),2);
  await page.locator('nav a[href="#dex"]').click();await page.locator('#dexquery').fill('Terapagos');await page.locator('#catalog button').first().click();await page.locator('#mine').click();assert.equal(await page.locator('#slot0 h2').innerText(),'테라파고스');
  await page.locator('nav a[href="#friend"]').click();await page.locator('#message').fill('꼬부기는 무슨 기술을 써?');await page.locator('#chat button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#talk').innerText.includes('물대포'));
  await page.context().grantPermissions(['microphone'],{origin:new URL(url).origin});assert.ok(await page.evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ok=stream.getAudioTracks().some(t=>t.readyState==='live');stream.getTracks().forEach(t=>t.stop());return ok}));
  await page.evaluate(()=>{window.SpeechRecognition=class{start(){this.onstart()}stop(){this.onend()}abort(){}constructor(){window.testMic=this}}});await page.locator('#friend [data-mic]').click();assert.match(await page.locator('#speech').innerText(),/듣고 있어요/);
  await page.evaluate(()=>{const r=Object.assign([{transcript:'피카츄'}],{isFinal:false});window.testMic.onresult({results:[r]})});assert.match(await page.locator('#speech').innerText(),/피카츄/);
  await page.evaluate(()=>{window.testMic.onerror({error:'not-allowed'});window.testMic.onend()});assert.match(await page.locator('#speech').innerText(),/허용/);
  await page.locator('#settings').click();await page.locator('#newpin').fill('1357');await page.locator('#setpin button').click();await page.waitForFunction(()=>document.querySelector('#pinmsg').textContent.includes('저장'));await page.locator('#close').click();await page.locator('#settings').click();await page.locator('#pin').fill('1357');await page.locator('#unlock button').click();await page.locator('#newpin').waitFor();await page.locator('#close').click();
  await page.locator('nav a[href="#battle"]').click();if(process.env.SCREENSHOTS){fs.mkdirSync('screenshots',{recursive:true});await page.screenshot({path:`screenshots/arena-${width}.png`,fullPage:true})}
  await page.locator('#language').click();await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#slot0 h2')?.textContent==='Terapagos');
  assert.equal(await page.locator('#slot0 .region-tag').innerText(),'Paldea');assert.match(await page.locator('#slot0 .stats').innerText(),/Attack/);assert.equal(await page.locator('#draw1').innerText(),'Draw random card');assert.equal(await page.locator('#trainer1').inputValue(),'별빛 팀');assert.ok(await page.locator('#slot0 .move').first().isVisible());
  await page.locator('#start').click();await page.locator('#result h2').waitFor({timeout:60000});assert.match(await page.locator('#result').innerText(),/wins!/);assert.doesNotMatch(await page.locator('#result').innerText(),/[가-힣]/);
  await page.locator('nav a[href="#dex"]').click();await page.locator('#regionFilter').selectOption('kanto');await page.locator('#kindFilter').selectOption('mega');await page.locator('#typeFilter').selectOption('10');await page.locator('#powerOrder').click();
  assert.equal(await page.locator('#catalog button').count(),2);assert.match(await page.locator('#catalog').innerText(),/Mega Charizard X/);
  assert.equal(await page.locator('#catalog .place').nth(0).innerText(),await page.locator('#catalog .place').nth(1).innerText());
  await page.locator('#kindFilter').selectOption('legendary');await page.locator('#typeFilter').selectOption('14');assert.match(await page.locator('#catalog').innerText(),/Mewtwo/);
  await page.locator('#dexquery').fill('doesnotexist');assert.match(await page.locator('#catalog').innerText(),/No matches/);
  await page.locator('nav a[href="#friend"]').click();await page.locator('#examples button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#talk').innerText.includes('Water Gun'));
  await page.waitForFunction(()=>/Visitors today · [0-9]/.test(document.getElementById('visits').textContent));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await page.close();console.log('PASS browser',width,height,'search/forms/stats/art/battle/replay/friend/history/PIN/mic events')
 }
if(process.env.ARENA_URL||process.env.FRIEND_BINARY){const a=await fetch(url+'/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pair:[25,7],focus:25,lastIntent:'strength',text:'이 친구를 한 문장으로 설명해 줄래?'})});assert.equal(a.status,200);const reply=await a.json();assert.equal(reply.model,true,'self-hosted model processes an unscripted question');assert.match(reply.reply,/[가-힣]/);console.log('PASS live local Korean inference')}
}finally{await browser?.close();server?.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
