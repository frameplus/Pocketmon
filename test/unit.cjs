const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../public/game.js'),d=require('../public/dex.json'),by=new Map(d.pokemon.map(p=>[p.id,p])),idx=G.index(d);
test('1025 species and 48 distinct Mega forms have cached art, official names, stats and moves',()=>{
 assert.equal(by.size,1073);
 for(let i=1;i<=1025;i++)assert.ok(by.has(i));
 for(const p of d.pokemon){assert.match(p.name,/[가-힣]/);assert.ok(p.en&&p.types.length&&p.stats.length===6&&p.stats.every(n=>n>0));assert.ok(p.moves.length>0&&p.moves.length<=4);for(const id of p.moves)assert.ok(d.moves[id].name);assert.equal(fs.readFileSync(path.join(__dirname,'../public/art',p.id+'.png')).subarray(1,4).toString(),'PNG')}
 assert.equal(G.search(idx,'Charizard')[0].name,'리자몽');assert.equal(G.search(idx,'ㅍㅋㅊ')[0].id,25);assert.equal(G.search(idx,'Mega Charizard X')[0].id,10034);assert.deepEqual(G.heard(idx,'피카츄랑 메가리자몽X가 싸우면?').map(p=>p.id),[25,10034]);assert.equal(G.similar(idx,'피카추').id,25);
 assert.notDeepEqual(by.get(6).stats,by.get(10034).stats);assert.notDeepEqual(by.get(10034).types,by.get(10035).types)
});
const {makeSimulator}=require('../simulator.js');
const sim=makeSimulator(d),seed=[1,2,3,4];
function fixture(ids,moves){
 const pokemon=ids.map((id,i)=>({...by.get(id),moves:moves[i]}));
 return makeSimulator({...d,pokemon});
}
test('base HP and level-50 HP are distinct, including Shedinja and Mega forms',()=>{
 for(const [id,base,max] of [[25,35,110],[6,78,153],[10034,78,153],[129,20,95],[292,1,1],[1024,90,170]]){
  assert.equal(by.get(id).stats[0],base);
  assert.equal(G.hp(by.get(id)),max);
  assert.equal(sim.simulate([id,7],{seed}).initial[0],max);
 }
});
test('all cached forms match simulator HP and yield valid battle replays',()=>{
 for(const p of d.pokemon){
  const pair=[p,by.get(1+(p.dex*37)%1025)],ids=pair.map(x=>x.id);
  const result=sim.simulate(ids,{seed});
  assert.deepEqual(result.initial,pair.map(G.hp));
  assert.ok([-1,0,1].includes(result.winner));assert.ok(result.events.length);
  if(result.winner>=0)assert.equal(result.events.at(-1).hp[1-result.winner],0);
  for(const event of result.events)assert.ok(event.hp.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=event.max[i]));
 }
});
test('type chart and independently calculated level-50 Thunderbolt damage',()=>{
 assert.equal(d.chart.length,18);assert.equal(G.effect(13,by.get(27),d),0);assert.equal(G.effect(6,by.get(6),d),4);assert.equal(G.effect(12,by.get(6),d),.25);
 const ids=[25,9],controlled=fixture(ids,[[85],[150]]);
 // Smogon damage calculator, neutral 0 EV / 31 IV Pikachu vs Blastoise, no items.
 const rolls=new Set();
 for(let i=1;i<=64;i++){
  const hit=controlled.simulate(ids,{seed:[i,2,3,i*347]}).events.find(e=>e.move===85);
  assert.equal(hit.effect,'strong');
  if(!hit.crit){assert.ok(hit.damage>=60&&hit.damage<=72);rolls.add(hit.damage)}
 }
 assert.ok(rolls.size>1);
});
test('Magikarp only uses its chosen game learnset; forecast plays that battle',()=>{
 assert.deepEqual(by.get(129).moves,[33,175,150]);assert.equal(by.get(129).learnsetGroup,25);
 const draws=sim.forecast([129,4],80);assert.deepEqual(draws,{wins:[0,80,0],count:80});
});
test('immunities, charging, priority, interruption and expired PP change the outcome',()=>{
 const moves=(ids,m)=>fixture(ids,m).simulate(ids,{seed}).events;
 const guard=sim.simulate([25,292],{seed});
 assert.equal(guard.winner,1);assert.ok(guard.events.some(e=>e.reason==='ability: Wonder Guard'&&!e.damage));
 const immune=moves([25,27],[[85],[33]]).find(e=>e.move===85);assert.equal(immune.effect,'immune');assert.equal(immune.damage,0);
 const beam=moves([3,9],[[76],[150]]).filter(e=>e.move===76);
 assert.equal(beam[0].effect,'prepare');assert.equal(beam[0].damage,0);assert.ok(beam[1].damage>0);assert.equal(beam[1].round,beam[0].round+1);
 const priority=moves([25,7],[[33],[453]]);assert.equal(priority[0].i,1);
 const focus=moves([25,68],[[33],[264]]);assert.ok(focus.some(e=>e.kind==='cant'&&e.i===1));
 const mirror=sim.simulate([132,132],{seed});assert.ok(mirror.events.some(e=>e.move===165));assert.ok(mirror.events.some(e=>e.reason==='recoil'));
});
test('origin and special categories carry over to Mega forms; equal power totals share one rank',()=>{
  assert.equal(by.get(10034).region,'kanto');assert.equal(by.get(905).region,'hisui');
  assert.equal(by.get(808).region,'unknown');assert.equal(by.get(1025).region,'kitakami');
  assert.ok(by.get(150).legendary);assert.ok(by.get(151).mythical);
  const ranks=G.powerRanks(d.pokemon);assert.equal(ranks.get(10034),ranks.get(10035));assert.ok(ranks.get(10034)<ranks.get(6));
  for(const p of d.pokemon)for(const m of p.moves)assert.ok(d.moves[m].en);
});
test('daily visits are distinct by browser, persisted on restart, and roll over at midnight in Seoul',()=>{
  const {openCounter,dayInSeoul}=require('../visitors.js');
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'arena-test-')),file=path.join(dir,'counter.db');
  let time=Date.parse('2026-11-25T14:59:59Z'),counter=openCounter(file,()=>time);
  try{
    const visit={day:dayInSeoul(time),token:require('node:crypto').randomUUID()};assert.equal(counter.snapshot().count,0);
    assert.equal(counter.snapshot(visit).count,1);assert.equal(counter.snapshot(visit).count,1);
    assert.equal(counter.snapshot({...visit,token:require('node:crypto').randomUUID()}).count,2);
    counter.close();counter=openCounter(file,()=>time);assert.equal(counter.snapshot().count,2);
    time+=1000;assert.deepEqual(counter.snapshot(visit),{day:'2026-11-26',count:0});
    assert.equal(counter.snapshot({...visit,day:'2026-11-26'}).count,1);
  }finally{counter.close();fs.rmSync(dir,{recursive:true,force:true})}
});
