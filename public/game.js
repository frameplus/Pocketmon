const Game=(()=>{
 const types=['','노말','격투','비행','독','땅','바위','벌레','고스트','강철','불꽃','물','풀','전기','에스퍼','얼음','드래곤','악','페어리'];
 const englishTypes=['','Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel','Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark','Fairy'];
 const englishStats=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'];
 const total=p=>p.stats.reduce((sum,n)=>sum+n,0);
 function powerRanks(all){
   const sorted=[...all].sort((a,b)=>total(b)-total(a)||a.dex-b.dex||a.id-b.id);
   const ranks=new Map();let previous=-1,rank=0;
   sorted.forEach((p,i)=>{const points=total(p);if(points!==previous){rank=i+1;previous=points}ranks.set(p.id,rank)});
   return ranks;
 }
 const icons=['','✦','✊','🪽','☣','▲','◆','🐞','☾','⬡','🔥','💧','🌿','ϟ','✧','❄','🐉','☽','♥'];
 const colors=['','#817360','#b4543d','#6491b3','#9b60ad','#ad824f','#95824e','#87a33e','#75619b','#65818d','#dc723f','#418ebf','#55a372','#cf9a1b','#bd618f','#4a9ba2','#7867b4','#77647b','#c57b99'];
 const statNames=['HP','공격','방어','특수공격','특수방어','스피드'];
 const norm=s=>String(s).toLowerCase().normalize('NFC').replace(/\p{Script=Latin}/gu,c=>c.normalize('NFD').replace(/\p{M}/gu,'')).replace(/♀/g,'f').replace(/♂/g,'m').replace(/[^ㄱ-ㅎ가-힣a-z0-9]/g,'');
 const index=d=>d.pokemon.map(p=>({p,ko:norm(p.name),en:norm(p.en),ini:Array.from(norm(p.name),c=>{let n=c.charCodeAt(0)-44032;return n>=0&&n<11172?'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(n/588)]:c}).join('')}));
 function search(idx,text,limit=16){
   const q=norm(text);if(!q)return idx.slice(0,limit).map(x=>x.p);
   return idx.map(x=>[x.ko===q||x.en===q||String(x.p.dex)===q?0:x.ko.startsWith(q)||x.en.startsWith(q)?1:x.ini.startsWith(q)?2:x.ko.includes(q)||x.en.includes(q)?3:4,x.p]).filter(x=>x[0]<4).sort((a,b)=>a[0]-b[0]).slice(0,limit).map(x=>x[1]);
 }
 function heard(idx,text){
   const q=norm(text),spans=[];
   const matches=idx.flatMap(x=>[x.ko,x.en].map(name=>({pos:q.indexOf(name),n:name.length,p:x.p})).filter(v=>v.pos>=0)).sort((a,b)=>b.n-a.n);
   for(const v of matches)if(!spans.some(s=>s.pos<v.pos+v.n&&v.pos<s.pos+s.n))spans.push(v);
   return spans.sort((a,b)=>a.pos-b.pos).map(v=>v.p)
 }
 function similar(idx,text){
   const q=norm(text).normalize('NFD');let best=null,score=.72;
   if(q.length<3)return null;
   for(const x of idx)for(let n of [x.ko,x.en]){
     n=n.normalize('NFD');if(Math.abs(n.length-q.length)>3)continue;
     let row=Array.from({length:n.length+1},(_,i)=>i);
     for(let i=0;i<q.length;i++){let next=[i+1];for(let j=0;j<n.length;j++)next.push(Math.min(row[j+1]+1,next[j]+1,row[j]+Number(q[i]!==n[j])));row=next}
     const similarity=1-row[n.length]/Math.max(q.length,n.length);if(similarity>score){score=similarity;best=x.p}
   }return best
 }
 // Level 50, 31 IVs, 0 EVs, neutral Nature. Species stats stay available for the Pokédex.
 function hp(p){
   if(p.dex===292)return 1;
   // Tera Shift changes Terapagos to its Terastal Form (base HP 95) on entry.
   const base=p.dex===1024?95:p.stats[0];
   return Math.floor((2*base+31)*50/100)+60;
 }
 const effect=(t,p,d)=>p.types.reduce((v,j)=>v*d.chart[t-1][j-1],1);
 function describe(e,pair,d,en=false){
   const p=pair[e.i].name,move=d.moves[e.move],name=move?(en?move.en:move.name):(en?'a move':'기술');
   if(e.kind==='cant')return en?p+' could not move this turn.':p+'는 이번 차례에 움직이지 못했어.';
   if(e.kind==='heal')return en?p+' recovered '+e.damage+' HP.':p+'의 HP가 '+e.damage+' 회복됐어.';
   if(e.kind==='indirect')return en?p+' lost '+e.damage+' HP from a battle effect.':p+'의 HP가 전투 효과로 '+e.damage+' 줄었어.';
   const lead=en?p+' used '+name+'! ':p+'의 '+name+'! ';
   const words={strong:['효과가 굉장해!','Super effective!'],weak:['효과가 약해.','It was resisted.'],miss:['빗나갔어.','It missed.'],immune:['효과가 없어.','No effect.'],prepare:['다음 공격을 준비해!','Charging up!'],fail:['이번에는 실패했어.','It failed this turn.']};
   return lead+(words[e.effect]?.[en?1:0]||'')+(e.crit?(en?' Critical hit!':' 급소에 맞았어!'):'')+(e.damage?' −'+e.damage+' HP':'');
 }
 function explain(result,pair,d,lang='ko'){
   const en=lang==='en',w=result.winner,events=result.events;
   if(w<0)return [result.capped?(en?'Both held on for 100 turns.':'두 친구 모두 100턴 동안 버텼어.'):(en?'The simulator recorded a tie.':'두 친구가 무승부를 기록했어.'),''];
   const wins=events.filter(e=>e.i===w&&e.kind==='move'&&e.damage>0);
   const strongest=wins.sort((a,b)=>b.damage-a.damage)[0];
   const other=events.filter(e=>e.i===1-w&&e.kind==='move');
   const block=other.find(e=>e.effect==='immune'),miss=other.find(e=>e.effect==='miss'),resist=other.find(e=>e.effect==='weak');
   const last=events.at(-1);
   const win=strongest?describe(strongest,pair,d,en):last?describe(last,pair,d,en):(en?'The battle ended.':'대결이 끝났어.');
   let loss;
   if(block){const wonder=block.reason==='ability: Wonder Guard';
     loss=wonder?(en?'Wonder Guard blocked a move that did not hit a weakness.':'불가사의부적 특성이 약점을 찌르지 못한 기술을 막았어.'):describe(block,pair,d,en);
   }else if(!other.length)loss=en?'The other side acted before it could use a move.':'상대가 먼저 움직여 기술을 쓸 기회를 얻지 못했어.';
   else if(last?.kind==='indirect'&&last.i===1-w)loss=describe(last,pair,d,en);
   else if(miss||resist)loss=describe(miss||resist,pair,d,en);
   else {const dealt=other.reduce((sum,e)=>sum+e.damage,0);loss=en?'Its moves dealt '+dealt+' HP of damage, but the opponent held on.':'기술로 상대의 HP를 총 '+dealt+' 줄였지만 상대가 버텼어.'}
   return [win,loss]
 }
 return {types,englishTypes,englishStats,total,powerRanks,icons,colors,statNames,norm,index,search,heard,similar,hp,effect,describe,explain}
})();
if(typeof module!=='undefined')module.exports=Game;else window.Game=Game;
