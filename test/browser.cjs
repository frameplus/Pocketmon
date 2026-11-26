const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs');
(async()=>{
const url=process.env.ARENA_URL||'http://127.0.0.1:3100',server=process.env.ARENA_URL?null:spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3100'},stdio:'inherit'});
let browser;
try{
 for(let i=0;i<30;i++){try{if((await fetch(url+'/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream']});
 await require('./narration-words.cjs')(browser,url);
 await require('./dex-layout.cjs')(browser,url);
 await require('./result-home.cjs')(browser,url);
 await require('./team-rooms.cjs')(browser,url);
 await require('./team-finisher.cjs')(browser,url);
 await require('./stadium.cjs')(browser,url);
 await require('./transitions.cjs')(browser,url);
 await require('./entrance.cjs')(browser,url);
 await require('./hit-lesson.cjs')(browser,url);
 await require('./recap.cjs')(browser,url);
 for(const [width,height] of [[390,844],[768,1024],[1366,900]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];
  const el=s=>page.locator(s);
  const menu=name=>el('nav a[href="#'+name+'"]').click();
  const name=i=>el('#slot'+i+' .poke-name').innerText();
  const slot=i=>el('#slot'+i);
  const search=async(i,query)=>{await slot(i).locator('.pick-query').fill(query);await slot(i).locator('.suggest button').first().click()};
  const shot=async stage=>{if(process.env.SCREENSHOTS){fs.mkdirSync('screenshots',{recursive:true});await page.screenshot({path:`screenshots/${stage}-${width}.png`})}};
  page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await el('#start').waitFor();assert.equal(await name(0),'피카츄');assert.equal(await el('#slot0 .card-hp').innerText(),'110');
  assert.ok(await el('#language').isHidden());assert.equal(await el('#prediction').count(),0);
  assert.deepEqual(await slot(0).locator('.stats b').allTextContents(),['110','75','60','70','70','110']);
  assert.match(await slot(0).locator('.ability').innerText(),/정전기/);
  assert.equal(await el('.compare-row').count(),6);
  assert.deepEqual(await el('.sheet-heading').first().locator('small b').allTextContents(),['495','709']);
  assert.equal(await el('.match-move').filter({hasText:'10만볼트'}).locator('strong').innerText(),'×2');
  if(width===390){
   const layout=await page.evaluate(()=>{
    const card=document.querySelector('#slot0 .card'),art=card.querySelector('.art');
    return [card.offsetWidth,card.offsetHeight,art.offsetHeight,document.querySelector('.compare-sheet').getBoundingClientRect().top];
   });
   assert.deepEqual(layout.slice(0,3),[172,282,178]);
   assert.ok(Math.abs(layout[3]-510)<=2,'the comparison sheet starts at the design board position');
   for(const i of [0,1]){
    await slot(i).locator('.face-toggle').click();
    assert.ok(await slot(i).locator('.ability').isVisible());
    assert.equal(await slot(i).locator('.stats b:visible').count(),6);
    assert.equal(await slot(i).locator('.moves .move:visible').count(),4);
    await slot(i).locator('.face-toggle').click();assert.ok(await slot(i).locator('.front').isVisible());
   }
  }
  for(const i of [0,1]){
   assert.ok(await slot(i).locator('.badge').count()>0);assert.ok(await slot(i).locator('.move').count()>=3);
   const card=await slot(i).locator('.card').boundingBox(),input=await slot(i).locator('.pick-query').boundingBox(),draw=await slot(i).locator('.draw').boundingBox();
   assert.ok(input.y>=card.y+card.height-1&&draw.y>=input.y-1);
   assert.ok(draw.y+draw.height<=height);
   assert.ok(await slot(i).locator('.draw').evaluate(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'draw button is reachable without scrolling');
  }
  await shot('choose');
  await el('#start').click();
  assert.ok(await el('nav').isHidden());assert.ok(await el('#start').isHidden());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);
  assert.equal(await el('#hp0').innerText(),'110/110');
  const field=await el('#battlefield').boundingBox();
  const expectedRatio=width>height?16/9:width<=600?390/372:.8;
  assert.ok(Math.abs(field.width/field.height-expectedRatio)<.01);
  await el('#speed').click();assert.equal(await el('#speed').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>document.querySelector('#battlefield').dataset.scene==='battle');await shot('battle');
  await el('#skip').click();await el('#result h2').waitFor();await shot('result');
  await el('#rematch').click();await el('#skip').click();await el('#result h2').waitFor();await el('#different').click();
  await menu('history');assert.equal(await el('.record').count(),2);assert.equal(await el('.record small').first().innerText(),'오늘');
  assert.equal(await el('.record-summary div').count(),3);
  await el('.record button').first().click();await el('#exit').click();await menu('history');assert.equal(await el('.record').count(),2);
  await menu('battle');await el('#settings').click();await el('#trainer0').fill('번개 팀');await el('#trainer1').fill('별빛 팀');
  await el('[name=ground][value=snow]').check();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('arena.ground'))),'snow');
  await el('#newpin').fill('1357');await el('#setpin button').click();await page.waitForFunction(()=>document.querySelector('#pinmsg').textContent.includes('저장'));
  await el('#close').click();assert.match(await el('#slot1 .serial').innerText(),/별빛 팀/);
  for(const i of [0,1]){const old=await name(i),other=await name(1-i);await slot(i).locator('.draw').click();assert.notEqual(await name(i),old);assert.equal(await name(1-i),other)}
  await search(0,'Charizard');await el('#slot0 .front').click();assert.equal(await el('#modal .stats span').count(),6);assert.ok(await el('#modal .move').count()>=3);
  await el('[data-form="10034"]').click();assert.equal(await name(0),'메가리자몽X');await search(1,'ㅍㅋㅊ');assert.equal(await name(1),'피카츄');
  await slot(0).locator('.front').click();await el('#browse').click();await el('#dexquery').fill('Terapagos');await el('#catalog button').first().click();assert.equal(await name(0),'테라파고스');
  await menu('friend');await el('#examples button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#talk').textContent.includes('물대포'));
  await page.context().grantPermissions(['microphone'],{origin:new URL(url).origin});
  assert.ok(await page.evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ok=stream.getAudioTracks().some(t=>t.readyState==='live');stream.getTracks().forEach(t=>t.stop());return ok}));
  await page.evaluate(()=>{window.SpeechRecognition=class{start(){this.onstart()}stop(){this.onend()}abort(){}constructor(){window.testMic=this}}});
  await el('#friend [data-mic]').click();assert.match(await el('#speech').innerText(),/듣고 있어요/);
  await page.evaluate(()=>window.testMic.onresult({results:[Object.assign([{transcript:'피카츄'}],{isFinal:false})]}));assert.match(await el('#speech').innerText(),/피카츄/);
  await page.evaluate(()=>{window.testMic.onerror({error:'not-allowed'});window.testMic.onend()});assert.match(await el('#speech').innerText(),/허용/);
  await el('#settings').click();assert.ok(await el('#parentExtras').isHidden());await el('#pin').fill('1357');await el('#unlock button').click();
  await el('#language').click();await page.waitForFunction(()=>document.documentElement.lang==='en');await menu('battle');
  await el('#slot0 .front').click();assert.equal(await el('.region-tag').innerText(),'Paldea');assert.match(await el('#modal .stats').innerText(),/Attack/);await el('#close').click();
  await el('#start').click();await el('#skip').click();await el('#result h2').waitFor();assert.doesNotMatch(await el('#result').innerText(),/[가-힣]/);
  await menu('dex');await el('#dexquery').fill('');await el('.advanced summary').click();await el('#regionFilter').selectOption('kanto');await el('#kindFilter').selectOption('mega');await el('[data-type="10"]').click();await el('#powerOrder').click();
  assert.equal(await el('#catalog button').count(),2);assert.match(await el('#catalog').innerText(),/Mega Charizard X/);
  assert.equal(await el('#catalog .place').nth(0).innerText(),await el('#catalog .place').nth(1).innerText());
  await el('#kindFilter').selectOption('legendary');await el('[data-type="14"]').click();assert.match(await el('#catalog').innerText(),/Mewtwo/);
  await el('[data-card="150"]').click();await el('#theirs').click();assert.equal(await name(1),'Mewtwo');
  await menu('friend');await el('#examples button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#talk').innerText.includes('Water Gun'));
  await page.waitForFunction(()=>/Visitors today · [0-9]/.test(document.getElementById('visits').textContent));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await page.close();console.log('PASS',width,height,'one tap, zero scroll, ratio, skip/rematch, cards, filters, voice controls, PIN and language');
 }
if(process.env.ARENA_URL||process.env.FRIEND_BINARY){const a=await fetch(url+'/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pair:[25,7],focus:25,lastIntent:'strength',text:'이 친구를 한 문장으로 설명해 줄래?'})});assert.equal(a.status,200);const reply=await a.json();assert.equal(reply.model,true,'self-hosted model processes an unscripted question');assert.match(reply.reply,/[가-힣]/);console.log('PASS live local Korean inference')}
}finally{await browser?.close();server?.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
