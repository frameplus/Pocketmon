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
 function typeLesson(e,pair,d,en){
     const typeNames=en?englishTypes:types;
     const m=e.matchup;if(!m||!m.defender?.length||m.defender.some(id=>!typeNames[id]))return '';
     const t=typeNames[m.type],name=en?pair[e.j].en:pair[e.j].name,def=m.defender.map(id=>typeNames[id]).join(en?'/':'·');
     const weaknesses=m.defender.filter(id=>d.chart[m.type-1][id-1]>1);
     const ordinary=m.defender.reduce((value,id)=>value*d.chart[m.type-1][id-1],1);
     const vulnerable=ordinary===m.factor&&weaknesses.length===1?typeNames[weaknesses[0]]:def;
     if(e.effect==='strong'&&m.factor>1)return en?
       `Against ${name}’s ${vulnerable} type, that ${t} move had ${m.factor} times its usual effect.`:
       `${t} 기술은 ${name}의 ${vulnerable} 타입 약점을 찔러서 효과가 평소의 ${m.factor}배였어.`;
     if(e.effect==='weak'&&m.factor<1&&m.factor>0)return en?
       `${name}’s ${def} type resisted that ${t} move. Its type effect was only 1/${1/m.factor} of normal.`:
       `${name}의 ${def} 타입은 그 ${t} 기술을 잘 견뎌. 타입 효과가 평소의 ${m.factor===.5?'절반':(1/m.factor)+'분의 1'}이었어.`;
     if(e.effect==='immune'&&!e.reason&&m.defender.some(id=>d.chart[m.type-1][id-1]===0))return en?
       `${name}’s ${def} type was immune to that ${t} move, so it dealt no damage.`:
       `${name}의 ${def} 타입에는 그 ${t} 기술이 통하지 않아. 그래서 체력이 그대로였어.`;
     if(e.damage&&m.factor===1&&!e.effect)return en?
       `That ${t} move did not hit a weakness of ${name}’s ${def} type.`:
       `${name}의 ${def} 타입에는 이 ${t} 기술이 보통 세기로 통해.`;
     return '';
   }
 function bigHit(e){
   return e.kind==='move' && e.damage>0 && e.damage*2>=e.max[e.j];
 }
 function impactLesson(e,pair,d,en){
   if(!bigHit(e))return '';
   const move=d.moves[e.move],name=en?move?.en:move?.name;
   const facts=[];
   if(e.effect==='strong'||e.effect==='weak')facts.push(typeLesson(e,pair,d,en));
   if(e.crit)facts.push(en?'It struck a critical spot, so the hit was stronger!':'급소에 맞아서 더 강했어!');
   if(!facts.filter(Boolean).length && move?.power>=80){
     const type=(en?englishTypes:types)[e.matchup?.type||move.type];
     facts.push(en?`${name} is a ${type} move with ${move.power} base power. It can hit hard even without a type advantage!`:`${name}은 기본 위력이 ${move.power}인 ${type} 기술이야. 약점을 찌르지 않아도 강하게 맞을 수 있어!`);
   }
   if(!facts.filter(Boolean).length){
     const target=en?pair[e.j].en:pair[e.j].name;
     facts.push(en?`${target} has ${e.max[e.j]} HP when full. This move took away ${e.damage} in one go!`:`${target}의 체력은 가득 차면 ${e.max[e.j]}야. 이 기술 한 번에 ${e.damage}만큼 줄었어!`);
   }
   return facts.filter(Boolean).join(' ');
 }
 function explain(result,pair,d,lang='ko'){
   const en=lang==='en',w=result.winner,events=result.events;
   if(w<0)return [result.capped?(en?'Both friends lasted all 100 turns. Under our rules that makes a tie.':'두 친구가 100턴 동안 버텼어. 이 게임에서는 그때까지 승부가 안 나면 무승부야.'):(en?'Both friends finished on the same turn.':'두 친구가 같은 턴에 대결을 마쳤어.'),''];
   const l=1-w, names=pair.map(p=>en?p.en:p.name);
   const moveName=e=>(en?d.moves[e.move]?.en:d.moves[e.move]?.name)||(en?'a move':'기술');
   const moves=i=>events.filter(e=>e.i===i&&e.kind==='move');
   const best=xs=>xs.reduce((a,e)=>!a||e.damage>a.damage?e:a,null);
   const won=moves(w),lost=moves(l),big=best(won.filter(e=>e.damage)),reply=best(lost.filter(e=>e.damage));
   function hit(e){
     const lead=en?`On turn ${e.round}, ${names[e.i]} used ${moveName(e)} and took away ${e.damage} HP.`:
       `${e.round}턴에 ${names[e.i]}의 ${moveName(e)}! 상대 체력이 한 번에 ${e.damage}만큼 줄었어.`;
     if(bigHit(e))return lead+' '+impactLesson(e,pair,d,en);
     const critical=e.crit?(en?' It also landed a critical hit, which made it stronger.':' 급소에도 맞아서 더 강했어.'):'';
     return [lead,typeLesson(e,pair,d,en)].filter(Boolean).join(' ')+critical;
   }
   const last=events.at(-1),wonByEffect=last?.kind==='indirect'&&last.i===l&&last.hp[l]===0;
   let whyWon=big?hit(big):en?`${names[w]} stayed in the battle through turn ${last?.round||1}.`:`${names[w]} 쪽은 ${last?.round||1}턴까지 버텼어.`;
   if(big&&!big.crit&&big.matchup?.factor===1){
     const hits=won.filter(e=>e.move===big.move&&e.damage>0);
     const hitsTotal=hits.reduce((total,e)=>total+e.damage,0);
     if(hits.length>1)whyWon+=en?` It landed ${moveName(big)} on ${hits.length} turns for ${hitsTotal} HP in all.`:` ${moveName(big)} 기술이 ${hits.length}번 통해서 모두 ${hitsTotal}만큼 줄였어.`;
   }
   let whyLost;
   const immune=lost.find(e=>e.effect==='immune'),miss=lost.find(e=>e.effect==='miss');
   const resisted=best(lost.filter(e=>e.effect==='weak'&&e.damage));
   if(wonByEffect){
     const causes={recoil:['자기가 쓴 기술의 반동','recoil from its own move'],brn:['화상','its burn'],psn:['독','poison'],tox:['독','poison'],confusion:['혼란','confusion']};
     const cause=causes[last.reason]?.[en?1:0]||(en?'a battle effect':'전투 효과');
     whyLost=en?`On turn ${last.round}, ${names[l]} lost its last ${last.damage} HP to ${cause}.`:`${last.round}턴에는 ${cause} 때문에 ${names[l]}의 마지막 체력 ${last.damage}가 줄었어.`;
   }else if(immune){
     whyLost=en?`${names[l]} tried ${moveName(immune)} on turn ${immune.round}. `:`${immune.round}턴에 ${names[l]} 쪽은 ${moveName(immune)} 기술을 썼어. `;
     whyLost+=immune.reason==='ability: Wonder Guard'?(en?'Wonder Guard only lets moves that hit a weakness through. This move was blocked.':'상대의 불가사의부적은 약점을 찌르는 공격만 통하게 해. 이 기술은 막혔어.'):
       typeLesson(immune,pair,d,en)||(en?'The move was blocked, so that attack took away no HP.':'이 공격은 막혀서 상대 체력을 하나도 줄이지 못했어.');
   }else if(!lost.length){
     whyLost=en?`${names[w]} moved first, so ${names[l]} never got to use a move.`:`${names[w]} 쪽이 먼저 공격해서 ${names[l]}에게는 기술을 쓸 차례가 오지 않았어.`;
   }else if(resisted){whyLost=hit(resisted)}
   else if(miss){
     whyLost=en?`On turn ${miss.round}, ${names[l]} tried ${moveName(miss)}, but it missed. The opponent kept its HP on that attack.`:`${miss.round}턴에 ${names[l]}의 ${moveName(miss)} 기술이 빗나갔어. 그 공격으로는 상대 체력을 줄일 수 없었어.`;
   }else if(reply){
     const remaining=reply.hp[w];
     whyLost=en?`Even its biggest hit, ${moveName(reply)} on turn ${reply.round}, left ${names[w]} with ${remaining} HP.`:
       `${names[l]}의 가장 큰 공격은 ${reply.round}턴에 쓴 기술, ${moveName(reply)}! 그때도 ${names[w]}에게는 체력이 ${remaining} 남아서 계속 싸울 수 있었어.`;
     if(reply.effect==='strong')whyLost+=' '+typeLesson(reply,pair,d,en);
   }else{
     const e=lost.find(e=>e.effect==='prepare')||lost[0];
     whyLost=en?`On turn ${e.round}, ${names[l]} used ${moveName(e)}. ${e.effect==='prepare'?'It needed a turn to charge.':'None of its moves dealt direct damage in this battle.'}`:
       `${e.round}턴에 ${names[l]} 쪽은 ${moveName(e)} 기술을 썼어. ${e.effect==='prepare'?'힘을 모으는 데 한 차례가 필요했어.':'이번 대결에서는 상대에게 직접 피해를 준 기술이 없었어.'}`;
   }
   const firstBig=events.find(bigHit);
   if(firstBig&&firstBig!==big){
     // Include the first big hit on the results screen even if the other player ultimately won.
     if(firstBig===reply&&!wonByEffect&&!immune&&!resisted&&!miss){
       if(reply.effect!=='strong')whyLost+=' '+impactLesson(reply,pair,d,en);
       else if(reply.crit)whyLost+=en?' It also hit a critical spot.':' 급소에도 맞았어.';
     }else if(firstBig!==resisted){
       if(firstBig.i===w)whyWon+=' '+hit(firstBig);
       else whyLost+=' '+hit(firstBig);
     }
   }
   return [whyWon,whyLost]
 }
 return {types,englishTypes,englishStats,total,powerRanks,icons,colors,statNames,norm,index,search,heard,similar,hp,effect,describe,explain,bigHit,impactLesson}
})();
if(typeof module!=='undefined')module.exports=Game;else window.Game=Game;
