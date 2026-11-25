const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs');
(async()=>{
const url=process.env.ARENA_URL||'http://127.0.0.1:3100',server=process.env.ARENA_URL?null:spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3100'},stdio:'inherit'});
let browser;
try{
 for(let i=0;i<30;i++){try{if((await fetch(url+'/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,300))}
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});
 for(const [width,height] of [[390,844],[768,1024],[1366,900]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(url);await page.locator('#slot0 h2').waitFor();assert.equal(await page.locator('#slot0 h2').innerText(),'피카츄');
  const q=page.locator('#q0');await q.fill('C');assert.ok(await page.locator('#s0 button').count()>0);await q.fill('Charizard');await page.locator('#s0 button').first().click();await page.locator('#slot0 [data-form="10034"]').click();assert.equal(await page.locator('#slot0 h2').innerText(),'메가리자몽X');
  await page.locator('#slot0 summary').click();assert.equal(await page.locator('#slot0 .stats span').count(),6);assert.ok(await page.locator('#slot0 .move').count()>=3);
  await page.locator('#q1').fill('ㅍㅋㅊ');await page.locator('#s1 button').first().click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#battle img')].every(i=>i.complete&&i.naturalWidth>0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#start').click();await page.locator('#result h2').waitFor({timeout:60000});assert.equal(await page.locator('#prediction').getAttribute('open'),null);await page.locator('#again').click();await page.locator('#result h2').waitFor({timeout:60000});
  await page.locator('nav a[href="#history"]').click();assert.equal(await page.locator('.record').count(),2);
  await page.locator('nav a[href="#dex"]').click();await page.locator('#dexquery').fill('Terapagos');await page.locator('#catalog button').first().click();await page.locator('#mine').click();assert.equal(await page.locator('#slot0 h2').innerText(),'테라파고스');
  await page.locator('nav a[href="#friend"]').click();await page.locator('#message').fill('꼬부기는 무슨 기술을 써?');await page.locator('#chat button').click();await page.waitForFunction(()=>document.querySelector('#talk').innerText.includes('물대포'));
  await page.evaluate(()=>{window.SpeechRecognition=class{start(){this.onstart()}stop(){this.onend()}abort(){}constructor(){window.testMic=this}}});await page.locator('#friend [data-mic]').click();assert.match(await page.locator('#speech').innerText(),/듣고 있어요/);
  await page.evaluate(()=>{const r=Object.assign([{transcript:'피카츄'}],{isFinal:false});window.testMic.onresult({results:[r]})});assert.match(await page.locator('#speech').innerText(),/피카츄/);
  await page.evaluate(()=>{window.testMic.onerror({error:'not-allowed'});window.testMic.onend()});assert.match(await page.locator('#speech').innerText(),/허용/);
  await page.locator('#settings').click();await page.locator('#newpin').fill('1357');await page.locator('#setpin button').click();await page.waitForFunction(()=>document.querySelector('#pinmsg').textContent.includes('저장'));await page.locator('#close').click();await page.locator('#settings').click();await page.locator('#pin').fill('1357');await page.locator('#unlock button').click();await page.locator('#newpin').waitFor();await page.locator('#close').click();
  await page.locator('nav a[href="#battle"]').click();if(process.env.SCREENSHOTS){fs.mkdirSync('screenshots',{recursive:true});await page.screenshot({path:`screenshots/arena-${width}.png`,fullPage:true})}
  assert.deepEqual(errors,[]);await page.close();console.log('PASS browser',width,height,'search/forms/stats/art/battle/replay/friend/history/PIN/mic events')
 }
}finally{await browser?.close();server?.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});