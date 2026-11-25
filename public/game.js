const Game=(()=>{
 const types=['','노말','격투','비행','독','땅','바위','벌레','고스트','강철','불꽃','물','풀','전기','에스퍼','얼음','드래곤','악','페어리'];
 const icons=['','✦','✊','🪽','☣','▲','◆','🐞','☾','⬡','🔥','💧','🌿','ϟ','✧','❄','🐉','☽','♥'];
 const colors=['','#817360','#b4543d','#6491b3','#9b60ad','#ad824f','#95824e','#87a33e','#75619b','#65818d','#dc723f','#418ebf','#55a372','#cf9a1b','#bd618f','#4a9ba2','#7867b4','#77647b','#c57b99'];
 const statNames=['HP','공격','방어','특수공격','특수방어','스피드'];
 const norm=s=>String(s).toLowerCase().normalize('NFC').replace(/♀/g,'f').replace(/♂/g,'m').replace(/[^ㄱ-ㅎ가-힣a-z0-9]/g,'');
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
 const hp=p=>p.dex===292?1:p.stats[0]+75;
 const effect=(t,p,d)=>p.types.reduce((v,j)=>v*d.chart[t-1][j-1],1);
 function move(a,b,id,d){
   const m=d.moves[id],physical=m.category===2,attack=a.stats[physical?1:3]+20,defense=b.stats[physical?2:4]+20;
   const factor=id===165?1:effect(m.type,b,d),stab=id!==165&&a.types.includes(m.type)?1.5:1;
   const base=(Math.floor(Math.floor(22*m.power*attack/defense)/50)+2)*factor*stab;
   return {id,m,base,attack,defense,factor,score:base*m.accuracy/100}
 }
 function plan(pair,d){
   const lists=pair.map((p,i)=>{
     const user=p.moves.includes(144)&&!p.moves.some(id=>d.moves[id].power)?pair[1-i]:p;
     return user.moves.filter(id=>d.moves[id].power).map(id=>move(user,pair[1-i],id,d)).sort((a,b)=>b.score-a.score)
   });
   return {pair,lists,struggle:pair.map((p,i)=>move(p,pair[1-i],165,d))}
 }
 function run({pair,lists,struggle},rng=Math.random,record=true){
   const h=pair.map(hp),pp=lists.map(l=>l.map(v=>v.m.pp)),events=[];
   for(let round=1;;round++){
     const picks=lists.map((l,i)=>{let k=l.findIndex((v,j)=>pp[i][j]>0&&v.factor>0);if(k<0)k=l.findIndex((v,j)=>pp[i][j]>0);return [k,k<0?struggle[i]:l[k]]});
     const first=(picks[0][1].m.priority-picks[1][1].m.priority||pair[0].stats[5]-pair[1].stats[5]||rng()-.5)>=0?0:1;
     for(const i of [first,1-first]){
       const j=1-i,[k,v]=picks[i];if(k>=0)pp[i][k]--;
       const hit=rng()<v.m.accuracy/100,crit=hit&&rng()<1/24;
       const damage=hit&&v.factor>0?Math.min(h[j],Math.max(1,Math.floor(v.base*(crit?1.5:1)*(.85+rng()*.15)))):0;
       h[j]-=damage;
       const recoil=v.id===165?Math.min(h[i],Math.max(1,Math.floor(hp(pair[i])/4))):0;h[i]-=recoil;
       if(record)events.push({i,j,move:v.id,damage,crit,hit,factor:v.factor,recoil,attack:v.attack,defense:v.defense,hp:[...h],round});
       if(!h[i]||!h[j])return {winner:h[i]?i:j,events}
     }
   }
 }
 function odds(plan,n=400){let w=0;for(let i=0;i<n;i++)if(run(plan,Math.random,false).winner===0)w++;let a=Math.round(100*w/n);return [a,100-a]}
 function explain(r,pair,d){
   const w=r.winner,l=1-w,all=r.events,top=all.filter(e=>e.i===w&&e.damage).sort((a,b)=>b.damage-a.damage)[0];
   const enemy=all.filter(e=>e.i===l),miss=enemy.find(e=>!e.hit),end=all.at(-1),weak=enemy.find(e=>e.factor<1);
   const win=top?`${d.moves[top.move].name} 기술이 ${top.factor>1?`약점을 찔러 ${top.factor}배 효과를 냈어`:top.crit?'급소에 맞았어':`체력을 한 번에 ${top.damage}만큼 줄였어`}!`:'상대가 몸부림을 쓰고 지칠 때까지 버텼어!';
   const loss=!enemy.length?(pair[w].stats[5]>pair[l].stats[5]?'상대 스피드가 더 빨랐고, ':'상대가 먼저 움직여서 ' )+'기술을 쓸 차례가 오지 않았어.':end.i===l&&end.recoil?'몸부림을 쓸 때마다 자기 체력도 줄었어.':miss?`${d.moves[miss.move].name} 기술이 빗나가서 그 차례를 놓쳤어.`:weak?`${d.moves[weak.move].name} 기술은 상대에게 ${weak.factor}배 효과만 냈어.`:top&&top.attack>top.defense?`상대의 ${d.moves[top.move].category===2?'공격이 내 방어':'특수공격이 내 특수방어'}보다 높아서 그 기술을 버티기 어려웠어.`:`기술을 ${enemy.filter(e=>e.hit).length}번 맞혔지만 상대가 버텼고, ${d.moves[end.move].name} 기술이 승부를 갈랐어.`;
   return [win,loss]
 }
 return {types,icons,colors,statNames,norm,index,search,heard,similar,hp,effect,plan,run,odds,explain}
})();
if(typeof module!=='undefined')module.exports=Game;else window.Game=Game;