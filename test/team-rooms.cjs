const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');

module.exports=async function teamRooms(browser,url){
 const host=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const guest=await browser.newContext({viewport:{width:1200,height:900},reducedMotion:'reduce'});
 try{
  const a=await host.newPage(),b=await guest.newPage(),errors=[];
  for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  await a.goto(url);await a.locator('.team-entry').click();
  await a.locator('#friends').click();await a.locator('.member').first().click();
  await a.locator('#query').fill('이브이');await a.locator('#choices button').first().click();
  await a.locator('#launch').click();await a.locator('#invite').waitFor();
  const invite=await a.locator('#invite').inputValue();assert.ok(new URL(invite).searchParams.get('room'));
  await a.reload();await a.locator('#locked-team').getByText('이브이').waitFor();
  await b.goto(invite);await b.locator('#launch').waitFor();assert.equal(await b.locator('.member').count(),3);
  await b.locator('.member').first().click();await b.locator('#query').fill('리자몽');await b.locator('#choices button').first().click();
  const response=b.waitForResponse(r=>r.url().includes('/api/team-rooms/')&&r.request().method()==='POST');
  await b.locator('#launch').click();const state=await (await response).json();
  assert.equal(state.side,1);assert.equal(state.match.rounds.length,3);assert.deepEqual(state.match.rounds[0].ids,[133,6]);
  await a.getByText('1차전 · 이브이 vs 리자몽').waitFor();await b.locator('#finish').click();
  for(let i=0;i<3;i++){
   await a.locator('#round-title').getByText(new RegExp('^'+(i+1)+'차전')).waitFor();
   await a.frameLocator('iframe').locator('#skip').click();
  }
  await a.locator('#verdict').waitFor();await b.locator('#verdict').waitFor();
  assert.equal(await a.locator('#rounds').innerText(),await b.locator('#rounds').innerText());
  const [x,y]=state.match.score;
  assert.equal(await a.locator('#score').innerText(),`우리 팀 ${x} : ${y} 상대 팀`);
  assert.equal(await b.locator('#score').innerText(),`우리 팀 ${y} : ${x} 상대 팀`);
  await b.reload();await b.locator('#finish').click();
  assert.equal(await a.locator('#rounds').innerText(),await b.locator('#rounds').innerText());
  const api=url+'/api/team-rooms/'+new URL(invite).searchParams.get('room');
  const headers={Authorization:'Bearer '+randomBytes(32).toString('hex'),'Content-Type':'application/json'};
  assert.deepEqual(await (await b.request.get(api,{headers})).json(),{available:false});
  assert.equal((await b.request.post(api,{headers,data:{action:'join',team:[1,2,3]}})).status(),409);
  assert.equal((await b.request.post(url+'/api/team-battle',{data:{team:[25,25,6],opponent:[1,2,3]}})).status(),400);
  await a.getByRole('link',{name:'새 팀 대결'}).click();
  await a.getByRole('button',{name:'랜덤 뽑기'}).first().click();
  await a.locator('#launch').click();await a.locator('#finish').click();assert.equal(await a.locator('.duel').count(),3);
  assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS 3v3 practice and friend invite, cross-device rosters, all three replays, consistent scores, seat ownership and reconnect');
 }finally{await host.close();await guest.close()}
};
