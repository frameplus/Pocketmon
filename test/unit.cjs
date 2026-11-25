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
test('all forms have a Pokédex height, and battle size follows the matchup on either side',()=>{
 assert.ok(d.pokemon.every(p=>Number.isInteger(p.heightDm)&&p.heightDm>0));
 for(const [small,big,heights] of [[25,6,[4,17]],[1,3,[7,20]],[50,321,[2,145]],[6,10035,[17,17]]]){
  const pair=[by.get(small),by.get(big)];
  assert.deepEqual(pair.map(p=>p.heightDm),heights);
  const sizes=G.fieldSizes(pair);
  assert.deepEqual(G.fieldSizes([...pair].reverse()),[sizes[1],sizes[0]]);
  assert.ok(heights[0]===heights[1]?sizes[0]===sizes[1]:sizes[0]<sizes[1]);
 }
});
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
  assert.ok(result.events.at(-1).round>=3,'both fighters get opening turns');
  assert.ok(result.events.filter(e=>e.kind==='move').length>1);
  for(const e of result.events.filter(e=>e.kind==='move')){
   assert.ok(e.damage<=Math.max(1,Math.floor(e.max[e.j]*.32)),'multi-hit moves share the turn budget');
  }
  assert.ok([-1,0,1].includes(result.winner));assert.ok(result.events.length);
  if(result.winner>=0)assert.equal(result.events.at(-1).hp[1-result.winner],0);
  for(const event of result.events)assert.ok(event.hp.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=event.max[i]));
 }
});
test('type chart and junior scaling of level-50 Thunderbolt damage',()=>{
 assert.equal(d.chart.length,18);assert.equal(G.effect(13,by.get(27),d),0);assert.equal(G.effect(6,by.get(6),d),4);assert.equal(G.effect(12,by.get(6),d),.25);
 const ids=[25,9],controlled=fixture(ids,[[85],[150]]);
 // Smogon damage calculator, neutral 0 EV / 31 IV Pikachu vs Blastoise, no items.
 const rolls=new Set();
 for(let i=1;i<=64;i++){
  const hit=controlled.simulate(ids,{seed:[i,2,3,i*347]}).events.find(e=>e.move===85);
  assert.equal(hit.effect,'strong');
  if(!hit.crit){const knee=G.hp(by.get(9))*.20;
   assert.ok(hit.damage>=Math.floor(knee+(60-knee)*.30)&&hit.damage<=Math.floor(knee+(72-knee)*.30));rolls.add(hit.damage)}
 }
 assert.ok(rolls.size>1);
});
test('prediction and playback resolve the same paced battle, including multi-hit moves and one-HP cards',()=>{
 for(const ids of [[25,6],[292,6],[91,149],[10034,1]]){
  const result=sim.simulate(ids,{seed});
  assert.equal(result.winner,sim.simulate(ids,{seed,record:false}).winner);
  for(const e of result.events.filter(e=>e.round<3))assert.ok(e.hp.every(n=>n>0));
 }
 const clash=fixture([91,149],[[333],[150]]).simulate([91,149],{seed});
 const strike=clash.events.find(e=>e.damage>0);
 assert.ok(strike&&strike.damage<=Math.floor(strike.max[strike.j]*.32));
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

test('children’s recap uses the resolved move, defender type, turn and real damage',()=>{
 const ids=[25,7],pair=ids.map(id=>by.get(id)),r=sim.simulate(ids,{seed});
 const hit=r.events[0];assert.equal(hit.matchup.factor,2);
 const ko=G.explain(r,pair,d),en=G.explain(r,pair,d,'en');
 assert.ok(ko[0].includes('10만볼트')&&ko[0].includes('전기')&&ko[0].includes('물 타입')&&ko[0].includes('2배')&&ko[0].includes(String(hit.damage)));
 assert.match(en[0],/Water type.*Electric move.*2 times/);assert.ok(ko[1].includes('냉동빔'));
 const four=fixture([76,6],[[88],[150]]).simulate([76,6],{seed});
 const both=G.explain(four,[by.get(76),by.get(6)],d).join(' ');
 assert.match(both,/불꽃·비행.*4배/);
 const guard=sim.simulate([25,292],{seed});assert.match(G.explain(guard,[by.get(25),by.get(292)],d)[1],/불가사의부적/);
 const pixilate=fixture([10051,25],[[304],[150]]).simulate([10051,25],{seed});
 assert.equal(d.moves[304].type,1);assert.equal(pixilate.events.find(e=>e.damage).matchup.type,18);
 assert.match(G.explain(pixilate,[by.get(10051),by.get(25)],d)[0],/페어리 기술/);
});

test('big-hit lessons use the defender’s full HP and only actual direct damage',()=>{
 const pair=[by.get(25),by.get(7)],result=sim.simulate([25,7],{seed});
 const hit=result.events.find(e=>e.move===85);
 assert.match(G.impactLesson(hit,pair,d,false),/전기.*물 타입.*2배/);
 assert.match(G.impactLesson({...hit,crit:true},pair,d,true),/2 times.*critical/);
 assert.equal(G.bigHit({...hit,damage:29}),false);
 assert.equal(G.bigHit({...hit,damage:30}),true);
 assert.equal(G.bigHit({...hit,kind:'indirect'}),false);
 assert.equal(G.impactLesson({...hit,damage:1},pair,d,false),'');
 const neutral={...hit,effect:'',matchup:{...hit.matchup,factor:1}};
 assert.match(G.impactLesson(neutral,pair,d,false),/위력이 90/);
});
