'use strict';
(async function(){
 const $=id=>document.getElementById(id),G=window.Game,{en,lang,t,region,types,stats}=Locale,esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const d=await fetch('/dex.json').then(r=>{if(!r.ok)throw Error();return r.json()}),idx=G.index(d),by=new Map(d.pokemon.map(p=>[p.id,p]));
 const ranks=G.powerRanks(d.pokemon);
 if(en){for(const p of d.pokemon)p.name=p.en;for(const m of Object.values(d.moves))m.name=m.en}
 const get=(k,def)=>{try{return JSON.parse(localStorage.getItem('arena.'+k))??def}catch{return def}};
 const put=(k,v)=>{try{localStorage.setItem('arena.'+k,JSON.stringify(v))}catch{}};
 let savedPair;try{savedPair=JSON.parse(sessionStorage.getItem('arena.pair'))}catch{}
 let pair=Array.isArray(savedPair)&&savedPair.length===2&&savedPair.every(id=>by.has(id))?savedPair.map(id=>by.get(id)):[by.get(25),by.get(6)],epoch=0,busy=false,activePage='',target=0,pageSize=36,noticeTimer,rec=null,voiceEpoch=0,focus=25,lastIntent='',suggested=null,questionEpoch=0;
 let mute=get('mute',false),history=get('history',[]);if(!Array.isArray(history))history=[];
 const savedTrainers=get('trainers',[]);
 const trainers=[0,1].map(i=>typeof savedTrainers?.[i]==='string'?savedTrainers[i].slice(0,24):'');
 let powerOrder=false;
 const badges=p=>p.types.map(t=>`<span class="badge">${G.icons[t]} ${types[t]}</span>`).join('');
 const img=(p,extra='')=>`<img src="/art/${p.id}" alt="${esc(p.name)}" ${extra}>`;
 let stadium,worldBoot;
 const combat=createCombat($('battlefield'),()=>stadium);
 let listeningSide=null;
 let readingState='idle';
 const narrator=createNarrator(lang,state=>{
   readingState=state;
   const control=$('read-result'),status=$('read-status');
   if(control){
     const active=state==='playing'||state==='loading';
     control.textContent=active?'■':'🔊';
     control.setAttribute('aria-label',active?t('읽기 멈추기','Stop reading'):t('결과 다시 듣기','Hear the result'));control.setAttribute('aria-pressed',String(active));
     if(status)status.textContent=mute?t('부모 설정에서 음성 읽기가 꺼져 있어요.','Speech is off in parent settings.'):state==='error'?t('소리가 시작되지 않았어. 다시 듣기를 눌러 줘.','Sound could not start. Tap to hear the result.'):state==='loading'?t('목소리 준비 중…','Getting the voice ready…'):'';
   }
   if(state==='error'&&(activePage!=='battle'||$('result').hidden))notify(t('음성을 재생하지 못했어. 기기 소리를 확인해 줘.','Could not play the voice. Check your device sound.'));
 });
 function say(s){if(!mute&&!rec)return narrator.speak(s)}
 function unlockSound(){if(!mute)narrator.unlock()}
 function notify(s,hold=false){if($('pickerStatus'))$('pickerStatus').textContent=s;clearTimeout(noticeTimer);$('speech').textContent=s;$('speech').hidden=false;if(!hold)noticeTimer=setTimeout(()=>$('speech').hidden=true,5500)}
 function markMic(on){
  document.querySelectorAll('.slotmic').forEach((b,i)=>{const listening=on&&activePage==='battle'&&i===listeningSide;b.classList.toggle('onair',listening);b.setAttribute('aria-pressed',String(listening))});
  document.querySelectorAll('[data-mic]').forEach(b=>{b.classList.toggle('onair',on);b.textContent=on?t('● 듣고 있어요!',"● Listening!"):b.closest('#friend')?t('🎙 말하기',"🎙 Talk"):t('🎙 이름 말하기',"🎙 Say a name")})}
 function cancelVoice(){voiceEpoch++;if(rec){let old=rec;rec=null;try{old.abort()}catch{}}narrator.stop();markMic(false);$('speech').hidden=true}
 function mic(side=target){
  if(rec&&side===listeningSide){rec.stop();return}
  questionEpoch++;unlockSound();cancelVoice();listeningSide=side;target=side;let R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R||!window.isSecureContext){notify(t('이 브라우저에서는 들을 수 없어. HTTPS 주소를 Chrome에서 열거나 이름을 입력해 줘.',"Open the secure site in Chrome to use the mic, or type a name."));return}
  const generation=voiceEpoch,r=new R();rec=r;r.lang=t('ko-KR','en-US');r.interimResults=true;r.maxAlternatives=5;let choices=[],failed=false;
  r.onstart=()=>{if(generation===voiceEpoch){markMic(true);notify(t('🔴 듣고 있어요!',"🔴 Listening!"),true)}};
  r.onresult=e=>{if(generation!==voiceEpoch)return;const rows=Array.from(e.results),last=rows.at(-1);const text=rows.map(v=>v[0].transcript).join(' ');notify(t('듣고 있어요! ',"Listening! ")+text,true);if(last.isFinal){choices=[text,...Array.from(last,v=>v.transcript)];r.stop()}};
  r.onerror=e=>{if(generation!==voiceEpoch)return;failed=true;const msg={'not-allowed':t('주소창의 사이트 설정에서 마이크를 허용해 줘.',"Allow microphone access in your browser’s site settings."),'service-not-allowed':t('브라우저에서 음성 인식을 허용해 줘.',"Allow speech recognition in your browser."),'no-speech':t('목소리가 들리지 않았어. 다시 눌러 봐.',"I didn’t hear you. Tap and try again."),'network':t('음성 인식 서버에 연결할 수 없어. 인터넷을 확인하거나 이름을 입력해 줘.',"Speech recognition could not connect. Check your connection or type a name."),'audio-capture':t('마이크가 연결됐는지 확인해 줘.',"Check your microphone connection."),'aborted':t('듣기를 멈췄어.',"Listening stopped.")};notify(msg[e.error]||t('마이크를 다시 눌러 줘.',"Tap the mic and try again."))};
  r.onend=()=>{if(generation!==voiceEpoch)return;rec=null;markMic(false);if(failed)return;if(!choices.length){notify(t('다시 누르고 말해 줘.',"Tap again and say a name."));return}const ranked=choices.map(t=>[G.heard(idx,t).length,t]).sort((a,b)=>b[0]-a[0]);notify(t('들은 말 · ',"Heard · ")+ranked[0][1]);ask(ranked[0][1],side)};
  try{notify(t('마이크 연결 중…',"Connecting microphone…"),true);r.start()}catch{rec=null;notify(t('마이크를 시작할 수 없어. 권한을 확인해 줘.',"Could not start the mic. Check permissions."))}
 }
 function card(p,side){
  const moves=p.moves.map(id=>{const m=d.moves[id];return `<div class="move"><b>${esc(m.name)}</b><small>${G.icons[m.type]} ${types[m.type]} · ${m.power?t('위력 ',"Power ")+m.power:m.category===1?t('변화 기술','Status move'):t('가변·특수 위력','Variable / special power')}</small></div>`}).join('');
  return `<article class="card" style="--t:${G.colors[p.types[0]]};--u:${G.colors[p.types[1]||p.types[0]]}"><div class="shell"><div class="cardtop"><div><small class="serial">${side ? esc(side)+" · " : ""}No. ${String(p.dex).padStart(4,'0')}</small><h2>${esc(p.name)}</h2></div><span class="hp"><small>Lv.50 · HP</small> <b class="card-hp">${G.hp(p)}</b></span></div><div class="art">${img(p)}</div><div class="meta">${badges(p)}<span class="region-tag">${esc(region(p.region))}</span><span class="height-tag">${t("도감 키","Height")} ${p.heightDm/10} m</span></div><div class="card-info"><h3 class="move-title">${t("도감 종족값","Base stats")}</h3><div class="stats">${p.stats.map((v,i)=>`<span style="--stat:${v/255*100}%">${stats[i]}<b>${v}</b></span>`).join('')}</div><h3 class="move-title">${t("대표 기술","Moves")}</h3>${moves}</div></div></article>`
 }
 let dexSide=null;
 function choose(i,p){if($('modal').open)$('modal').close();pair[i]=p;focus=p.id;target=i;refresh()}
 function sideName(i){return i?t('상대 카드','Opponent’s card'):t('내 카드','My card')}
 function slot(i){
  const p=pair[i],el=$('slot'+i);
  el.innerHTML=`<p class="team">${esc(trainers[i].trim()||sideName(i))}</p>
   <button class="front" style="--t:${G.colors[p.types[0]]};--u:${G.colors[p.types.at(-1)]}" aria-label="${esc(p.name)} ${t('카드 자세히 보기','card details')}">
   <span class="card-hp">HP ${G.hp(p)}</span><span class="art">${img(p)}</span><strong class="poke-name">${esc(p.name)}</strong><span class="meta">${badges(p)}</span></button>
   <button class="change" aria-label="${sideName(i)} ${t('바꾸기','change')}">${t('↻ 바꾸기','↻ Change')}</button>`;
  el.querySelector('.front').onclick=()=>details(i);el.querySelector('.change').onclick=()=>picker(i);
 }
 function details(i){
  const p=pair[i],forms=d.pokemon.filter(x=>x.dex===p.dex&&x.id!==p.id);
  openModal(card(p,sideName(i))+forms.map(f=>`<button data-form="${f.id}">${f.id===f.dex?t('기본 모습','Base form'):'✧ '+esc(f.name)}</button>`).join(''),'detail');
  $('modalbody').querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{unlockSound();choose(i,by.get(+b.dataset.form));say(pair[i].name+'!')});
 }
 function picker(i){
  target=i;
  openModal(`<h2>${sideName(i)} ${t('바꾸기','· Choose')}</h2>
   <input id="pickQuery" aria-label="${t('포켓몬 검색','Find Pokémon')}" placeholder="${t('이름이나 초성','Name or number')}" autocomplete="off">
   <div id="suggest" class="suggest"></div><div class="pick-tools"><button class="slotmic" data-mic>${t('🎙 이름 말하기','🎙 Say a name')}</button>
   <button id="draw">${t('랜덤 카드 뽑기','Draw random card')}</button><button id="browse">${t('도감에서 고르기','Pick from Pokédex')}</button></div><p id="pickerStatus" role="status"></p>`,'picker');
  const q=$('pickQuery'),list=$('suggest');
  q.oninput=()=>{
   const matches=q.value.trim()?G.search(idx,q.value):[];
   list.innerHTML=matches.map(p=>`<button data-id="${p.id}">${img(p)}<b>${esc(p.name)}</b><small>${p.types.map(n=>types[n]).join(' · ')}</small></button>`).join('');
   if(q.value.trim()&&!matches.length)list.textContent=t('다른 이름을 써 봐.','Try another name.');
  };
  q.onkeydown=e=>{if(e.key==='Enter')list.querySelector('button')?.click();if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button')?.focus()}};
  list.onclick=e=>{const b=e.target.closest('[data-id]');if(b){unlockSound();choose(i,by.get(+b.dataset.id));say(pair[i].name+'!')}};
  $('draw').onclick=()=>{$('modal').close();drawCards(i)};
  $('browse').onclick=()=>{$('modal').close();dexSide=i;$('dexquery').value='';activeType=0;$('kindFilter').value='';$('regionFilter').value='';pageSize=36;go('dex')};
  $('modalbody').querySelector('.slotmic').onclick=()=>mic(i);
 }
 function fighter(p,side){
  const animated=p.battleFront;
  if(!animated)return img(p);
  return `<picture class="battle-sprite"><source media="(prefers-reduced-motion: no-preference)" srcset="/fighters/front/${p.id}.gif">${img(p)}</picture>`;
 }
 // Fit the visible drawing inside the shared slot even when its source has transparent margins.
 const spriteCrops=new Map();
 $('actors').addEventListener('load',event=>{
  const image=event.target;
  if(image.tagName!=='IMG'||!CSS.supports('object-view-box','inset(1%)'))return;
  const source=image.currentSrc;
  if(!spriteCrops.has(source)){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(image,0,0,96,96);
   const pixels=ctx.getImageData(0,0,96,96).data;
   let left=96,top=96,right=-1,bottom=-1;
   for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(pixels[(y*96+x)*4+3]>35){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   }
   // Keep a little space around moving ears and tails in animated GIFs.
   const inset=right<left?'none':'inset('+[top,95-right,95-bottom,left].map(n=>Math.max(0,n-4)*100/96+'%').join(' ')+')';
   spriteCrops.set(source,inset);
  }
  image.style.objectViewBox=spriteCrops.get(source);
 },true);
 function actors(){
  const sizes=G.fieldSizes(pair);
  $('actors').innerHTML=pair.map((p,i)=>`<div class="actor ${i?'right':'left'}" id="a${i}" style="--fighter-size:${sizes[i]}">${fighter(p,i)}</div>`).join('');
  $('scoreboard').innerHTML=pair.map((p,i)=>`<div class="hud"><div class="trainer-tag">${esc(trainers[i])}</div><b>${esc(p.name)}</b><span id="hp${i}">${G.hp(p)}/${G.hp(p)}</span><div class="track"><i id="bar${i}" style="width:100%"></i></div></div>`).join('');
 }
 function phase(name){
  document.body.dataset.phase=name;
  for(const id of ['chooser','arena','result'])$(id).hidden=id!==name;
  window.scrollTo(0,0);
 }
 function refresh(){
  questionEpoch++;suggested=null;if(rec)cancelVoice();
  epoch++;playback?.stop();combat.clear();narrator.stop();busy=false;
  $('celebration').hidden=true;$('battlefield').dataset.scene='ready';
  try{sessionStorage.setItem('arena.pair',JSON.stringify(pair.map(p=>p.id)))}catch{}
  $('start').disabled=false;slot(0);slot(1);actors();phase('chooser');
  stadium?.select(pair);
 }
 async function matchRequest(route,method='GET'){
  const path='/api/'+route+'/'+pair.map(p=>p.id).join('/');
  const res=await fetch(path,{method,cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!res.ok)throw Error('Battle service unavailable');
  return res.json();
 }
 function updateHP(current,maximum){
  current.forEach((v,i)=>{
   const value=v+'/'+maximum[i];
   $('hp'+i).textContent=value;$('bar'+i).style.width=(100*v/maximum[i])+'%';
  });
 }
 let playback;
 function playbackClock(){
  let rate=1,stopped=false;
  const timers=new Set();
  return {
   get rate(){return rate},get stopped(){return stopped},
   toggle(){rate=rate===1?2:1;for(const anim of $('battlefield').getAnimations({subtree:true}))anim.updatePlaybackRate(rate);return rate},
   stop(){stopped=true;for(const finish of [...timers])finish()},
   wait(ms){
    if(stopped)return Promise.resolve();
    return new Promise(resolve=>{
     let last=performance.now(),remaining=ms,timer;
     const finish=()=>{clearTimeout(timer);timers.delete(finish);resolve()};
     const tick=()=>{const now=performance.now();remaining-=(now-last)*rate;last=now;if(remaining<=0)finish();else timer=setTimeout(tick,Math.min(remaining/rate,50))};
     timers.add(finish);tick();
    });
   }
  };
 }
 $('speed').onclick=()=>{if(busy)$('speed').setAttribute('aria-pressed',String(playback.toggle()===2))};
 $('skip').onclick=()=>{if(busy){playback.stop();combat.clear()}};
 $('exit').onclick=()=>{refresh();$('start').focus()};
 async function entrance(id){
  const field=$('battlefield'),still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  field.dataset.scene='throw';
  $('round').textContent=t('트레이너 등장','Trainers enter');
  $('log').textContent=t('트레이너들이 마스터볼을 던졌어!', 'The trainers throw their Master Balls!');
  await playback.wait(still?300:1170);
  if(id!==epoch||field.dataset.scene!=='throw')return;
  field.dataset.scene='release';
  $('round').textContent=t('포켓몬 등장','Pokémon enter');
  $('log').textContent=en?`Come on out, ${pair[0].name} and ${pair[1].name}!`:`${pair[0].name}, ${pair[1].name}! 나와라!`;
  await playback.wait(still?350:1350);
  if(id===epoch&&field.dataset.scene==='release')field.dataset.scene='battle';
 }
 async function battle(){
  if(busy)return;questionEpoch++;if(rec)cancelVoice();unlockSound();say(t('대결 시작!','Let’s battle!'));const id=++epoch;busy=true;$('celebration').hidden=true;$('start').disabled=true;
  phase('arena');$('exit').focus({preventScroll:true});
  playback=playbackClock();$('speed').setAttribute('aria-pressed','false');
  actors();updateHP(pair.map(G.hp),pair.map(G.hp));
  let result;
  try{[result]=await Promise.all([matchRequest('battle','POST'),entrance(id),
   Promise.race([initWorld().then(world=>world?.select(pair)),playback.wait(4200)])])}catch{
   if(id===epoch){refresh();notify(t('연결을 확인하고 다시 시작해 줘.','Check the connection and try again.'))}
   return
  }
  if(id!==epoch)return;
  updateHP(result.initial,result.initial);
  const events=result.events,long=events.length>22;
  const highlights=long?events.filter((e,k)=>k<3||k>=events.length-4||k%Math.ceil(events.length/12)===0):events;
  for(const e of highlights){
   if(id!==epoch)return;if(playback.stopped)break;
   const m=d.moves[e.move],description=G.describe(e,pair,d,en);
   $('round').textContent=(long?t('주요 장면 · ','Highlights · '):'')+(en?'Turn '+e.round:e.round+'턴');
   if(e.kind==='move'&&m){
    $('log').textContent=en?`${pair[e.i].name} used ${m.name}!`:`${pair[e.i].name}의 ${m.name}!`;
    await combat.play(e,m,{typeName:types[e.matchup?.type||m.type],rate:()=>playback.rate,impact(){
     if(id===epoch){
      updateHP(e.hp,e.max);$('log').textContent=description;
      if(e.damage>0&&!mute&&!rec&&readingState!=='playing'&&readingState!=='loading')narrator.impactSound(e.matchup?.type||m.type);
     }
    }});
   }else{
    $('log').textContent=description;updateHP(e.hp,e.max);await playback.wait(500);
   }
  }
  if(id!==epoch)return;
  const last=events.at(-1);if(last)updateHP(last.hp,last.max);
  stadium?.finish(result.winner);
  const w=result.winner,why=roundReason(result);
  history=[{ids:pair.map(p=>p.id),w,time:Date.now()},...history].slice(0,24);put('history',history);
  const banner=$('celebration');
  banner.dataset.side=w<0?'tie':String(w);
  $('victory-word').textContent=w<0?'DRAW!':'VICTORY!';
  $('victory-name').textContent=w<0?t('무승부!','A tie!'):pair[w].name+t(' 승리!',' wins!');
  banner.hidden=false;
  $('round').textContent=t('승부가 났어!','Match decided!');
  if(w>=0&&!mute&&!rec)narrator.victorySound();
  await playback.wait(2100);if(id!==epoch)return;
  const v=pair[w],title=v?v.name+t(' 승리!',' wins!'):t('무승부!','A tie!');
  const reading=title+' '+why;
  $('result').innerHTML=`<article class="battle-recap"><div class="winner-art" style="--t:${G.colors[(v||pair[0]).types[0]]}">${v?img(v):pair.map(p=>img(p)).join('')}</div><h2 tabindex="-1">${esc(title)}</h2><p>${esc(why)}</p><button type="button" id="read-result"></button><small id="read-status" role="status"></small></article>
  <div class="result-actions"><button id="rematch" class="mainbtn">${t('다시 대결','Rematch')}</button><button id="different">${t('다른 친구랑','Change friends')}</button></div>`;
  phase('result');$('result').querySelector('h2').focus({preventScroll:true});
  $('rematch').onclick=battle;$('different').onclick=()=>{refresh();$('slot0').querySelector('.change').focus()};
  narrator.stop();
  $('read-result').onclick=()=>{
    if(mute){notify(t('부모 설정에서 음성 읽기를 켜 주세요.','Turn speech on in parent settings.'));return}
    if(readingState==='playing'||readingState==='loading'){narrator.stop();return}
    unlockSound();say(reading);
  };
  busy=false;$('start').disabled=false;say(reading)
 }
 function roundReason(result){
  const {winner:w,events}=result;
  if(w<0)return result.capped?t('두 친구가 100턴 동안 버텼어.','Both friends lasted all 100 turns.'):t('두 친구가 같은 턴에 대결을 마쳤어.','Both friends finished on the same turn.');
  const hits=events.filter(e=>e.kind==='move'&&e.i===w&&e.damage>0);
  const guard=events.find(e=>e.i!==w&&e.reason==='ability: Wonder Guard'&&e.effect==='immune');
  if(guard)return t(`불가사의부적이 상대의 ${d.moves[guard.move].name} 공격을 막아 줬어.`,`Wonder Guard blocked the other team’s ${d.moves[guard.move].name}.`);
  const strong=hits.find(e=>e.effect==='strong'&&e.matchup?.factor>1);
  if(strong){const m=d.moves[strong.move];return t(`${types[strong.matchup.type]} 기술 ${m.name}로 상대의 약점을 찔렀어!`,`${m.name}, a ${types[strong.matchup.type]} move, hit the other team's weakness!`)}
  const critical=hits.find(e=>e.crit);
  if(critical)return t(`${d.moves[critical.move].name} 기술이 급소에 맞아서 더 강했어!`,`${d.moves[critical.move].name} landed a powerful critical hit!`);
  const best=hits.reduce((best,e)=>!best||best.damage<e.damage?e:best,null);
  if(best){const m=d.moves[best.move],count=hits.filter(e=>e.move===best.move).length;
   return count>1?t(`${m.name} 기술을 ${count}번 맞혔어!`,`${m.name} landed ${count} times!`):t(`${best.round}턴에 쓴 ${m.name} 덕분에 상대 체력이 ${best.damage}만큼 줄었어.`,`On turn ${best.round}, ${m.name} took away ${best.damage} HP.`)}
  const last=events.at(-1);
  if(last?.kind==='indirect')return t(`마지막 턴에 전투 효과로 ${pair[last.i].name}의 체력이 줄었어.`,`A battle effect took away ${pair[last.i].name}’s HP on the last turn.`);
  return t(`${pair[w].name} 쪽이 마지막 차례까지 버텼어.`,`${pair[w].name} held on through the last turn.`);
 }
 function drawCards(side){
  const oldSpecies=new Set(pair.map(p=>p.dex));
  const pool=d.pokemon.filter(p=>p.id===p.dex&&!oldSpecies.has(p.dex));
  const pick=()=>pool.splice(Math.floor(Math.random()*pool.length),1)[0];
  if(side===0||side===1){pair[side]=pick();target=side}
  else{pair=[pick(),pick()];target=0}
  focus=pair[target].id;
  cancelVoice();refresh();
 }
 function openModal(html,kind='settings'){$('parentExtras').hidden=true;$('modal').dataset.kind=kind;$('modalbody').innerHTML=html;if(!$('modal').open)$('modal').showModal()}
 function setOptions(id,options){const select=$(id);for(const [value,label] of options){select.add(new Option(label,value))}}
 let activeType=0;
 $('typeStrip').innerHTML=types.map((name,i)=>`<button data-type="${i}" aria-pressed="${i===0}">${i?G.icons[i]+' '+name:t('전체','All')}</button>`).join('');
 $('typeStrip').onclick=e=>{const b=e.target.closest('button');if(b){activeType=Number(b.dataset.type);pageSize=36;catalog()}};
 setOptions('kindFilter',[['',t('모든 포켓몬','All Pokémon')],['legendary',t('전설','Legendary')],['mythical',t('환상','Mythical')],['mega',t('메가진화','Mega')],['base',t('기본 폼','Base form')]]);
 setOptions('regionFilter',[['',t('모든 지방','All regions')],...Object.keys(Locale.regions).map(k=>[k,region(k)])]);
 function catalog(){
   for(const b of $('typeStrip').children)b.setAttribute('aria-pressed',String(+b.dataset.type===activeType));
   $('dexPick').hidden=dexSide===null;if(dexSide!==null)$('dexPick').textContent=sideName(dexSide)+t('로 쓸 친구를 골라 봐.',' · Tap a friend to choose.');
   const type=activeType,kind=$('kindFilter').value,origin=$('regionFilter').value;
   const matches=G.search(idx,$('dexquery').value,d.pokemon.length).filter(p=>
     (!type||p.types.includes(type))&&(!origin||p.region===origin)&&
     (!kind||(kind==='mega'?p.id!==p.dex:kind==='base'?p.id===p.dex:p[kind])));
   if(powerOrder)matches.sort((a,b)=>ranks.get(a.id)-ranks.get(b.id)||a.dex-b.dex||a.id-b.id);
   else if(!$('dexquery').value.trim())matches.sort((a,b)=>a.dex-b.dex||a.id-b.id);
   $('rankRule').hidden=!powerOrder;$('dexOrder').setAttribute('aria-pressed',String(!powerOrder));$('powerOrder').setAttribute('aria-pressed',String(powerOrder));
   $('found').textContent=matches.length.toLocaleString()+t('장',' cards');
   $('catalog').innerHTML=matches.slice(0,pageSize).map(p=>`<button data-card="${p.id}">${powerOrder?`<span class="place">#${ranks.get(p.id)}</span>`:''}${img(p,'loading="lazy"')}<small>No. ${p.dex} · ${esc(region(p.region))}</small><b>${esc(p.name)}</b><small>${p.types.map(i=>types[i]).join(' · ')}</small>${powerOrder?`<strong class="power">${t('파워','Power')} ${G.total(p)}</strong>`:''}</button>`).join('')||t('조건에 맞는 포켓몬이 없어. 필터를 바꿔 봐!','No matches. Try a different filter.');
   $('more').hidden=pageSize>=matches.length
 }
 for(const id of ['kindFilter','regionFilter'])$(id).onchange=()=>{pageSize=36;catalog()};
 $('powerOrder').onclick=()=>{powerOrder=true;pageSize=36;catalog()};$('dexOrder').onclick=()=>{powerOrder=false;pageSize=36;catalog()};
 const dateFormat=new Intl.DateTimeFormat(en?'en-CA':'sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 function recordDate(time){if(!Number.isFinite(time))return '';const date=dateFormat.format(time),now=Date.now();return date===dateFormat.format(now)?t('오늘','Today'):date===dateFormat.format(now-86400000)?t('어제','Yesterday'):date}
 function records(){
  $('records').replaceChildren();for(const h of history){if(!h||!Array.isArray(h.ids)||h.ids.length!==2||!h.ids.every(i=>by.has(i))||![-1,0,1].includes(h.w))continue;const pair=h.ids.map(i=>by.get(i)),el=document.createElement('article');el.className='record';el.innerHTML=`${img(pair[h.w]||pair[0])}<div><small>${esc(recordDate(h.time))}</small><b>${h.w<0?t("무승부","Tie"):esc(pair[h.w].name)+" "+t("승리","wins")}</b><p>${pair.map(x=>esc(x.name)).join(t(' 대 '," vs. "))}</p></div><button>${t("다시 대결","Rematch")}</button>`;el.lastElementChild.onclick=()=>{usePair(h.ids);go('battle');battle()};$('records').append(el)}if(!$('records').children.length)$('records').textContent=t('첫 대결을 마치면 여기에 승자가 나타나!',"Finish a battle to see the winner here!")
 }
 function usePair(ids){pair=ids.map(i=>by.get(i));refresh()}
 function go(name){
  if(!['battle','dex','friend','history'].includes(name))name='battle';
  if(activePage!==name){if(activePage==='dex')dexSide=null;questionEpoch++;cancelVoice();if(activePage==='battle'&&busy)refresh();activePage=name;window.scrollTo(0,0)}
  for(let n of ['battle','dex','friend','history'])$(n).hidden=n!==name;
  document.querySelectorAll('nav a').forEach(a=>{const current=a.hash==='#'+name;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(location.hash!=='#'+name)window.history.replaceState(null,'','#'+name);
  if(name==='dex')catalog();if(name==='history')records()
 }
 function bubble(text,you){let p=document.createElement('p');p.className='bubble'+(you?' you':'');p.textContent=text;$('talk').append(p);while($('talk').children.length>10)$('talk').firstElementChild.remove()}
 async function ask(text,askedSide=target){
  unlockSound();text=text.trim().slice(0,250);if(!text)return;const seq=++questionEpoch,prior=lastIntent,drawSide=activePage==='battle'?askedSide:undefined;
  bubble(text,true);$('message').value='';
  try{
   let reply;
   if(suggested&&/^(응|그래|좋아|붙여|해봐|yes|ok|sure)[!. ]*$/i.test(text)){reply={action:{kind:'battle',ids:suggested},reply:t('좋아! 함께 배틀 필드로 가자!',"Great! Let’s head to the battlefield!"),focus:suggested[0],intent:'battle'}}
   else{const r=await fetch('/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang,pair:pair.map(x=>x.id),focus,lastIntent:prior})});if(!r.ok)throw Error();reply=await r.json()}
   if(seq!==questionEpoch)return;focus=reply.focus;lastIntent=reply.intent;suggested=reply.suggest||null;bubble(reply.reply,false);
   if($('modal').open)$('modal').close();
   if(reply.action){go('battle');if(reply.action.kind==='battle'){usePair(reply.action.ids);battle()}else if(reply.action.kind==='random')drawCards(drawSide);else choose(askedSide,by.get(reply.action.id))}else if(activePage!=='friend')go('friend');say(reply.reply)
  }catch{if(seq===questionEpoch)notify(t('친구와 연결하지 못했어. 잠시 뒤에 다시 말해 줘.',"Could not reach your buddy. Try again in a moment."))}
 }
 async function digest(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,'0')).join('')}
 function settings(unlocked=false){
  const lock=get('pin',null);
  if(lock&&!unlocked){openModal(en?'<h2>Parent settings</h2><p>Enter the parent PIN for this device.</p><form id="unlock"><input id="pin" type="password" inputmode="numeric" maxlength="8" required aria-label="Parent PIN"><button>Unlock</button></form><p id="pinmsg"></p>':'<h2>부모 설정</h2><p>이 기기의 부모 비밀번호를 입력해 주세요.</p><form id="unlock"><input id="pin" type="password" inputmode="numeric" maxlength="8" required aria-label="부모 비밀번호"><button>열기</button></form><p id="pinmsg"></p>');$('unlock').onsubmit=async e=>{e.preventDefault();if(await digest($('pin').value,lock.salt)===lock.hash)settings(true);else $('pinmsg').textContent=t('비밀번호가 달라요.',"That PIN doesn’t match.")};return}
  openModal(en?`<h2>Parent settings</h2><p>History and preferences stay on this device. The game does not save conversations or audio recordings. Your browser handles speech recognition.</p><button id="sound">Turn speech ${mute?'on':'off'}</button><button id="clearhistory">Clear battle history</button><form id="setpin"><input id="newpin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required placeholder="4 to 8 digits" aria-label="New parent PIN"><button>${lock?'Change':'Set'} PIN</button></form><p id="pinmsg"></p>`:`<h2>부모 설정</h2><p>기록과 설정은 이 기기에 보관합니다. 대화와 마이크 녹음은 게임 서버에 저장하지 않습니다. 음성 인식은 브라우저의 음성 서비스를 사용합니다.</p><button id="sound">음성 읽기 ${mute?'켜기':'끄기'}</button><button id="clearhistory">대결 기록 지우기</button><form id="setpin"><input id="newpin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required placeholder="숫자 4~8자리" aria-label="새 부모 비밀번호"><button>비밀번호 ${lock?'변경':'설정'}</button></form><p id="pinmsg"></p>`);
  $('parentExtras').hidden=false;
  trainers.forEach((value,i)=>{const input=$('trainer'+i);input.value=value;input.oninput=()=>{trainers[i]=input.value;put('trainers',trainers);slot(i)}});
  $('sound').onclick=()=>{mute=!mute;put('mute',mute);narrator.stop();if(!mute){unlockSound();say(t('음성 읽기를 켰어요.','Speech is on.'))}settings(true)};
  $('clearhistory').onclick=()=>{history=[];put('history',history);records();$('pinmsg').textContent=t('이 기기의 기록을 지웠어요.',"History cleared on this device.")};
  $('setpin').onsubmit=async e=>{e.preventDefault();const salt=crypto.randomUUID();put('pin',{salt,hash:await digest($('newpin').value,salt)});$('newpin').value='';$('pinmsg').textContent=t('저장했어요. 다음에 열 때 비밀번호가 필요해요.',"Saved. Your PIN will be needed next time.")}
 }
 $('modal').addEventListener('close',()=>{if(rec)cancelVoice();if($('modal').dataset.kind==='picker')questionEpoch++});
 $('settings').onclick=()=>settings();$('close').onclick=()=>$('modal').close();$('start').onclick=battle;
 $('dexquery').oninput=()=>{pageSize=36;catalog()};$('more').onclick=()=>{pageSize+=36;catalog()};
 $('catalog').onclick=e=>{const btn=e.target.closest('[data-card]');if(!btn)return;const p=by.get(+btn.dataset.card);if(dexSide!==null){const side=dexSide;go('battle');choose(side,p);return}openModal(card(p,t('전국도감',"National Dex"))+`<button id="mine">${t('내 카드로','Pick for me')}</button><button id="theirs">${t('상대 카드로','Pick as opponent')}</button>`);for(let [n,i] of [['mine',0],['theirs',1]])$(n).onclick=()=>{$('modal').close();choose(i,p);go('battle')}};
 $('chat').onsubmit=e=>{e.preventDefault();ask($('message').value)};$('examples').onclick=e=>{if(e.target.tagName==='BUTTON')ask(e.target.textContent)};
 document.querySelectorAll('[data-mic]').forEach(b=>b.onclick=()=>mic());document.querySelectorAll('header a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();if(location.hash!==a.hash)window.history.pushState(null,'',a.hash);go(a.hash.slice(1))});window.onhashchange=()=>go(location.hash.slice(1));
 buildField($('battlefield'));
 const view=$('battlefield');
 const initWorld=()=>worldBoot??=import('/stadium.js').then(({createStadium})=>{
   stadium=createStadium(view);stadium.select(pair);return stadium;
 }).catch(()=>{view.dataset.world='fallback'});
 if('requestIdleCallback' in window)requestIdleCallback(initWorld,{timeout:1000});else setTimeout(initWorld,0);
 refresh();$('loading').hidden=true;go(location.hash.slice(1));bubble(t('안녕! 좋아하는 포켓몬 이름을 말해 줘.',"Hi! Tell me the name of your favorite Pokémon."),false);
})().catch(()=>{document.getElementById('loading').textContent=Locale.t('도감을 열지 못했어. 새로고침해서 다시 만나자!','Could not open the Pokédex. Please refresh to try again.')});
