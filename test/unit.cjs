const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../public/game.js'),d=require('../public/dex.json'),by=new Map(d.pokemon.map(p=>[p.id,p])),idx=G.index(d);
test('1025 species and 48 distinct Mega forms have cached art, official names, stats and moves',()=>{
 assert.equal(by.size,1073);
 for(let i=1;i<=1025;i++)assert.ok(by.has(i));
 for(const p of d.pokemon){assert.match(p.name,/[가-힣]/);assert.ok(p.en&&p.types.length&&p.stats.length===6&&p.stats.every(n=>n>0));assert.ok(p.moves.length>0&&p.moves.length<=4);for(const id of p.moves)assert.ok(d.moves[id].name);assert.equal(fs.readFileSync(path.join(__dirname,'../public/art',p.id+'.png')).subarray(1,4).toString(),'PNG')}
 assert.equal(G.search(idx,'Charizard')[0].name,'리자몽');assert.equal(G.search(idx,'ㅍㅋㅊ')[0].id,25);assert.equal(G.search(idx,'Mega Charizard X')[0].id,10034);assert.deepEqual(G.heard(idx,'피카츄랑 메가리자몽X가 싸우면?').map(p=>p.id),[25,10034]);assert.equal(G.similar(idx,'피카추').id,25);
 assert.notDeepEqual(by.get(6).stats,by.get(10034).stats);assert.notDeepEqual(by.get(10034).types,by.get(10035).types)
});
test('18 type chart, immunity, dual resistance, super-effective and defensive categories',()=>{
 assert.equal(d.chart.length,18);assert.equal(G.effect(13,by.get(27),d),0);assert.equal(G.effect(6,by.get(6),d),4);assert.equal(G.effect(12,by.get(6),d),.25);
 const plan=G.plan([by.get(25),by.get(7)],d);
 for(const m of plan.lists[0]){assert.equal(m.attack,by.get(25).stats[m.m.category===2?1:3]+20);assert.equal(m.defense,by.get(7).stats[m.m.category===2?2:4]+20)}
});
test('each species reaches a result; stage events and forecasts use the same engine',()=>{
 for(const p of d.pokemon){const pair=[p,by.get(1+(p.dex*37)%1025)],plan=G.plan(pair,d);
  const result=G.run(plan);assert.ok(result.events.at(-1).hp.includes(0));assert.ok(result.events.length<350);assert.equal(G.explain(result,pair,d).length,2);
  for(const e of result.events){assert.ok(e.hp.every(n=>n>=0));assert.ok(!e.damage||e.hit)}
 }
 const plan=G.plan([by.get(132),by.get(132)],d);assert.ok(G.run(plan).events.some(e=>e.recoil));assert.equal(G.odds(plan).reduce((a,b)=>a+b),100)
});
test('speed, miss, critical and move priority',()=>{
 const a=by.get(25),b=by.get(7),plan=G.plan([a,b],d);
 const always=G.run(plan,()=>.001);assert.equal(always.events[0].i,0);assert.ok(always.events[0].crit);
 const id=Object.keys(d.moves).find(k=>d.moves[k].power&&d.moves[k].accuracy<100);
 const slow={...b,moves:[Number(id)]},fast={...a,moves:[165]};assert.ok(G.run(G.plan([slow,fast],d),()=>.99999).events.some(e=>!e.hit));
});
test('immune targets take no damage from the original move even without coverage',()=>{
 const p={...by.get(25),moves:[85]},target={...by.get(27),moves:[85]};
 const hit=G.run(G.plan([p,target],d),()=>.1).events.find(e=>e.i===0&&e.move===85);
 assert.equal(hit.factor,0);assert.equal(hit.damage,0)
});
