'use strict';
(async function(){
 const $=id=>document.getElementById(id),G=window.Game,{en,lang,t,region,types,stats}=Locale,esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const d=await fetch('/dex.json').then(r=>{if(!r.ok)throw Error();return r.json()}),idx=G.index(d),by=new Map(d.pokemon.map(p=>[p.id,p]));
 const ranks=G.powerRanks(d.pokemon);
 if(en){for(const p of d.pokemon)p.name=p.en;for(const m of Object.values(d.moves))m.name=m.en}
 const get=(k,def)=>{try{return JSON.parse(localStorage.getItem('arena.'+k))??def}catch{return def}};
 const put=(k,v)=>{try{localStorage.setItem('arena.'+k,JSON.stringify(v))}catch{}};
 let savedPair;try{savedPair=JSON.parse(sessionStorage.getItem('arena.pair'))}catch{}
 let pair=Array.isArray(savedPair)&&savedPair.length===2&&savedPair.every(id=>by.has(id))?savedPair.map(id=>by.get(id)):[by.get(25),by.get(6)],forecastVersion=-1,epoch=0,busy=false,activePage='',target=0,pageSize=36,noticeTimer,rec=null,voiceEpoch=0,focus=25,lastIntent='',suggested=null,questionEpoch=0;
 let mute=get('mute',false),history=get('history',[]);if(!Array.isArray(history))history=[];
 const savedTrainers=get('trainers',[]);
 const trainers=[0,1].map(i=>typeof savedTrainers?.[i]==='string'?savedTrainers[i].slice(0,24):'');
 let powerOrder=false;
 const badges=p=>p.types.map(t=>`<span class="badge">${G.icons[t]} ${types[t]}</span>`).join('');
 const img=(p,extra='')=>`<img src="/art/${p.id}" alt="${esc(p.name)}" ${extra}>`;
 function say(s){if(mute||rec||!window.speechSynthesis)return;try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(s);u.lang=t('ko-KR','en-US');u.rate=.95;const ko=speechSynthesis.getVoices().find(v=>v.lang.startsWith(lang));if(ko)u.voice=ko;speechSynthesis.speak(u)}catch{}}
 function notify(s,hold=false){clearTimeout(noticeTimer);$('speech').textContent=s;$('speech').hidden=false;if(!hold)noticeTimer=setTimeout(()=>$('speech').hidden=true,5500)}
 function markMic(on){
  document.querySelectorAll('.slotmic').forEach((b,i)=>{const listening=on&&activePage==='battle'&&i===target;b.classList.toggle('onair',listening);b.setAttribute('aria-pressed',String(listening))});
  document.querySelectorAll('[data-mic]').forEach(b=>{b.classList.toggle('onair',on);b.textContent=on?t('● 듣고 있어요!',"● Listening!"):b.closest('#friend')?t('🎙 말하기',"🎙 Talk"):t('🎙 이름 말하기',"🎙 Say a name")})}
 function cancelVoice(){voiceEpoch++;if(rec){let old=rec;rec=null;try{old.abort()}catch{}}window.speechSynthesis?.cancel();markMic(false);$('speech').hidden=true}
 function mic(){
  if(rec){rec.stop();return}cancelVoice();let R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R||!window.isSecureContext){notify(t('이 브라우저에서는 들을 수 없어. HTTPS 주소를 Chrome에서 열거나 이름을 입력해 줘.',"Open the secure site in Chrome to use the mic, or type a name."));return}
  const generation=voiceEpoch,r=new R();rec=r;r.lang=t('ko-KR','en-US');r.interimResults=true;r.maxAlternatives=5;let choices=[],failed=false;
  r.onstart=()=>{if(generation===voiceEpoch){markMic(true);notify(t('🔴 듣고 있어요!',"🔴 Listening!"),true)}};
  r.onresult=e=>{if(generation!==voiceEpoch)return;const rows=Array.from(e.results),last=rows.at(-1);const text=rows.map(v=>v[0].transcript).join(' ');notify(t('듣고 있어요! ',"Listening! ")+text,true);if(last.isFinal){choices=[text,...Array.from(last,v=>v.transcript)];r.stop()}};
  r.onerror=e=>{if(generation!==voiceEpoch)return;failed=true;const msg={'not-allowed':t('주소창의 사이트 설정에서 마이크를 허용해 줘.',"Allow microphone access in your browser’s site settings."),'service-not-allowed':t('브라우저에서 음성 인식을 허용해 줘.',"Allow speech recognition in your browser."),'no-speech':t('목소리가 들리지 않았어. 다시 눌러 봐.',"I didn’t hear you. Tap and try again."),'network':t('음성 인식 서버에 연결할 수 없어. 인터넷을 확인하거나 이름을 입력해 줘.',"Speech recognition could not connect. Check your connection or type a name."),'audio-capture':t('마이크가 연결됐는지 확인해 줘.',"Check your microphone connection."),'aborted':t('듣기를 멈췄어.',"Listening stopped.")};notify(msg[e.error]||t('마이크를 다시 눌러 줘.',"Tap the mic and try again."))};
  r.onend=()=>{if(generation!==voiceEpoch)return;rec=null;markMic(false);if(failed)return;if(!choices.length){notify(t('다시 누르고 말해 줘.',"Tap again and say a name."));return}const ranked=choices.map(t=>[G.heard(idx,t).length,t]).sort((a,b)=>b[0]-a[0]);notify(t('들은 말 · ',"Heard · ")+ranked[0][1]);ask(ranked[0][1])};
  try{notify(t('마이크 연결 중…',"Connecting microphone…"),true);r.start()}catch{rec=null;notify(t('마이크를 시작할 수 없어. 권한을 확인해 줘.',"Could not start the mic. Check permissions."))}
 }
 function card(p,side){
  const moves=p.moves.map(id=>{const m=d.moves[id];return `<div class="move"><b>${esc(m.name)}</b><small>${G.icons[m.type]} ${types[m.type]} · ${m.power?t('위력 ',"Power ")+m.power:m.category===1?t('변화 기술','Status move'):t('가변·특수 위력','Variable / special power')}</small></div>`}).join('');
  return `<article class="card" style="--t:${G.colors[p.types[0]]};--u:${G.colors[p.types[1]||p.types[0]]}"><div class="shell"><div class="cardtop"><div><small class="serial">${side ? esc(side)+" · " : ""}No. ${String(p.dex).padStart(4,'0')}</small><h2>${esc(p.name)}</h2></div><span class="hp"><small>Lv.50 · HP</small> <b class="card-hp">${G.hp(p)}</b></span></div><div class="art">${img(p)}</div><div class="meta">${badges(p)}<span class="region-tag">${esc(region(p.region))}</span></div><div class="card-info"><h3 class="move-title">${t("도감 종족값","Base stats")}</h3><div class="stats">${p.stats.map((v,i)=>`<span>${stats[i]}<b>${v}</b></span>`).join('')}</div><h3 class="move-title">${t("대표 기술","Moves")}</h3>${moves}</div></div></article>`
 }
 function choose(i,p){pair[i]=p;focus=p.id;target=i;refresh()}
 function slot(i){
  const p=pair[i],el=$('slot'+i),forms=d.pokemon.filter(x=>x.dex===p.dex&&x.id!==x.dex),label=i?t('상대',"Opponent"):t('내 포켓몬',"My Pokémon");
  const side=i?t('상대 카드','Opponent’s card'):t('내 카드','My card');
  const drawLabel=i?t('상대 카드 뽑기','Draw opponent’s card'):t('내 카드 뽑기','Draw my card');
  el.innerHTML=`<div class="trainer-head">
    <label class="slot-label" for="trainer${i}">${side}</label>
    <input id="trainer${i}" type="text" maxlength="24" autocomplete="off" spellcheck="false" aria-label="${side} ${t('유저네임','username')}" placeholder="${t('유저네임','Username')}">
  </div>
  ${card(p,'')}
  <div class="pick-controls">
    <div class="searchbox"><input id="q${i}" autocomplete="off" aria-label="${en?label+' search':label+' 검색'}" placeholder="${t('포켓몬 검색','Find Pokémon')}"><button class="slotmic" aria-label="${label} ${t('이름 말하기','voice search')}" type="button">🎙</button><div id="s${i}" class="suggest"></div></div>
    <button type="button" class="draw-card" id="draw${i}" aria-label="${drawLabel}"><i class="deck-icon" aria-hidden="true"></i>${t('랜덤 카드 뽑기','Draw random card')}</button>
  </div>${forms.length?`<div class="mega">${(p.id!==p.dex?[by.get(p.dex),...forms]:forms).map(f=>`<button data-form="${f.id}" aria-pressed="${f.id===p.id}">${f.id===p.dex?t('↶ 기본 모습',"↶ Base form"):'✧ '+esc(f.name)}</button>`).join('')}</div>`:''}`;
  const trainer=$('trainer'+i);
  trainer.value=trainers[i];
  trainer.oninput=()=>{
    trainers[i]=trainer.value;put('trainers',trainers);
    const tag=$('trainer-tag'+i);tag.textContent=trainer.value.trim();tag.hidden=!tag.textContent;
  };
  $('draw'+i).onclick=()=>{drawCards(i);$('draw'+i).focus({preventScroll:true})};
  const q=$('q'+i),s=$('s'+i);
  el.querySelector('.slotmic').onclick=()=>{target=i;mic()};q.onfocus=()=>{target=i};
  q.oninput=()=>{s.replaceChildren();if(!q.value.trim())return;const found=G.search(idx,q.value);for(const f of found){let b=document.createElement('button');b.type='button';b.innerHTML=img(f)+`<b>${esc(f.name)}</b><small>${f.types.map(t=>types[t]).join('·')}</small>`;b.onclick=()=>choose(i,f);s.append(b)}if(!found.length)s.textContent=t('찾는 친구가 없어. 다른 이름을 써 봐.',"No match. Try another name.")};
  q.onkeydown=e=>{if(e.key==='Enter')s.querySelector('button')?.click();if(e.key==='Escape')s.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();s.querySelector('button')?.focus()}};
  el.querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{choose(i,by.get(+b.dataset.form));say(pair[i].name+'!')})
 }
 function actors(){return pair.map((p,i)=>`<div class="actor ${i?'right':'left'}" id="a${i}">${img(p)}<div class="hud"><div class="trainer-tag" id="trainer-tag${i}" ${trainers[i].trim()?'':'hidden'}>${esc(trainers[i].trim())}</div><div class="row"><span>${esc(p.name)}</span><small id="hp${i}">${G.hp(p)}/${G.hp(p)}</small></div><div class="track"><i id="bar${i}" style="width:100%"></i></div></div></div>`).join('')}
 function refresh(){
  epoch++;busy=false;try{sessionStorage.setItem('arena.pair',JSON.stringify(pair.map(p=>p.id)))}catch{}$('start').disabled=false;$('start').textContent=t('▶ 대결 시작',"▶ Start battle");$('result').hidden=true;$('prediction').open=false;
  slot(0);slot(1);$('odds').replaceChildren();forecastVersion=-1;
  $('actors').innerHTML=actors();$('round').textContent=t('준비 완료',"Ready");$('log').textContent=pair.map(x=>x.name).join(t(' 대 '," vs. "))+'!';$('fx').textContent='';$('fx').className='';
 }
 async function matchRequest(route,method='GET'){
  const path='/api/'+route+'/'+pair.map(p=>p.id).join('/');
  const res=await fetch(path,{method,cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!res.ok)throw Error('Battle service unavailable');
  return res.json();
 }
 $('prediction').ontoggle=async()=>{
  if(!$('prediction').open||forecastVersion===epoch)return;
  const id=epoch;forecastVersion=id;
  $('odds').textContent=t('같은 규칙으로 연습 대결 중…','Running practice battles…');
  try{
   const {wins,count}=await matchRequest('forecast');if(id!==epoch)return;
   const pct=wins.map(w=>100*w/count);
   const note=wins[0]===wins[1]?t('양쪽의 승리 횟수가 같아.','Each side won equally often.'):pair[wins[0]>wins[1]?0:1].name+t(' 쪽이 더 자주 이겼어.',' won more often.');
   $('odds').innerHTML=`<div class="row"><b>${esc(pair[0].name)} ${pct[0]}%</b><b>${pct[1]}% ${esc(pair[1].name)}</b></div><div class="meter" style="background:linear-gradient(to right,#3269d3 0 ${pct[0]}%,#b6bed0 ${pct[0]}% ${100-pct[1]}%,#eb5868 ${100-pct[1]}% 100%)"></div><p class="hint">${t('400번 연습 결과','400 practice battles')} · ${esc(note)} ${wins[2]?t('무승부 ','Ties ')+pct[2]+'%':''}</p><p class="hint">${t('두 친구 모두 레벨 50 · 개체값 31 · 노력치 0 · 무보정 성격 · 첫 번째 일반 특성 · 지닌 도구 없음','Both at level 50 · 31 IVs · 0 EVs · neutral nature · first regular ability · no held items')}</p>`;
  }catch{if(id===epoch){forecastVersion=-1;$('odds').textContent=t('승률을 불러오지 못했어. 접었다 다시 열어 줘.','Close and reopen to retry the forecast.')}}
 };
 function updateHP(current,maximum){
  current.forEach((v,i)=>{
   const value=v+'/'+maximum[i];
   $('hp'+i).textContent=value;$('bar'+i).style.width=(100*v/maximum[i])+'%';
   $('slot'+i).querySelector('.card-hp').textContent=value;
  });
 }
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function battle(){
  if(busy)return;const id=++epoch;busy=true;$('start').disabled=true;
  $('start').textContent=t('대결 중…','Battling…');$('result').hidden=true;$('prediction').open=false;
  $('actors').innerHTML=actors();updateHP(pair.map(G.hp),pair.map(G.hp));
  $('arena').scrollIntoView({block:'center',behavior:'smooth'});
  let result;
  try{result=await matchRequest('battle','POST')}catch{
   if(id===epoch){busy=false;$('start').disabled=false;$('start').textContent=t('▶ 대결 시작','▶ Start battle');$('log').textContent=t('연결을 확인하고 다시 시작해 줘.','Check the connection and try again.')}
   return
  }
  if(id!==epoch)return;
  updateHP(result.initial,result.initial);
  const events=result.events,long=events.length>22;
  const highlights=long?events.filter((e,k)=>k<3||k>=events.length-4||k%Math.ceil(events.length/12)===0):events;
  for(const e of highlights){
   if(id!==epoch)return;const a=$('a'+e.i),b=$('a'+e.j),fx=$('fx'),m=d.moves[e.move];
   for(let i of [0,1])$('a'+i).classList.remove('hit','strike');
   fx.className='';fx.textContent='';void fx.offsetWidth;
   if(e.kind==='move'&&m){
    a.classList.add('strike');if(e.damage)b.classList.add('hit');
    fx.textContent=e.hit?(m.category===2?'✴':G.icons[m.type]):'· · ·';fx.style.setProperty('--trail',G.colors[m.type]);
    fx.className='shot '+(m.priority>0?'swift':m.category===2?'impact':m.power>=90?'surge':'beam')+(e.i?' reverse':'');
   }
   $('round').textContent=(long?t('주요 장면 · ','Highlights · '):'')+(en?'Turn '+e.round:e.round+'턴');
   $('log').textContent=G.describe(e,pair,d,en);updateHP(e.hp,e.max);await pause(650)
  }
  if(id!==epoch)return;
  const w=result.winner,why=G.explain(result,pair,d,lang);
  $('round').textContent=t('대결 끝','Finished');$('log').textContent=t('두 친구 모두 수고했어!','Well played, both of you!');$('fx').textContent='';$('prediction').open=false;
  const v=pair[w],l=pair[1-w],title=v?v.name+t(' 승리!',' wins!'):t('무승부!','A tie!');
  $('result').innerHTML=`<article class="win">${img(v||pair[0])}<div><h2>${v?'🏆 ':''}${esc(title)}</h2><p>${v?`<b>${en?'Why '+esc(v.name)+' won':esc(v.name)+'이 이긴 이유'}</b><br>`:''}${esc(why[0])}</p>${l?`<p><b>${en?'Why '+esc(l.name)+' lost':esc(l.name)+'이 진 이유'}</b><br>${esc(why[1])}</p>`:''}</div></article>`;$('result').hidden=false;
  history=[{ids:pair.map(p=>p.id),w,time:Date.now()},...history].slice(0,24);put('history',history);
  busy=false;$('start').disabled=false;$('start').textContent=t('↻ 다시 대결','↻ Rematch');$('result').scrollIntoView({block:'nearest',behavior:'smooth'});say([title,...why].join(' '))
 }
 function drawCards(side){
  const oldSpecies=new Set(pair.map(p=>p.dex));
  const pool=d.pokemon.filter(p=>p.id===p.dex&&!oldSpecies.has(p.dex));
  const pick=()=>pool.splice(Math.floor(Math.random()*pool.length),1)[0];
  if(side===0||side===1){pair[side]=pick();target=side}
  else{pair=[pick(),pick()];target=0}
  focus=pair[target].id;suggested=null;questionEpoch++;
  cancelVoice();refresh();
 }
 function openModal(html){$('modalbody').innerHTML=html;if(!$('modal').open)$('modal').showModal()}
 function setOptions(id,options){const select=$(id);for(const [value,label] of options){select.add(new Option(label,value))}}
 setOptions('typeFilter',[['',t('모든 속성','All types')],...types.slice(1).map((label,i)=>[i+1,label])]);
 setOptions('kindFilter',[['',t('모든 포켓몬','All Pokémon')],['legendary',t('전설','Legendary')],['mythical',t('환상','Mythical')],['mega',t('메가진화','Mega')],['base',t('기본 폼','Base form')]]);
 setOptions('regionFilter',[['',t('모든 지방','All regions')],...Object.keys(Locale.regions).map(k=>[k,region(k)])]);
 function catalog(){
   const type=Number($('typeFilter').value),kind=$('kindFilter').value,origin=$('regionFilter').value;
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
 for(const id of ['typeFilter','kindFilter','regionFilter'])$(id).onchange=()=>{pageSize=36;catalog()};
 $('powerOrder').onclick=()=>{powerOrder=true;pageSize=36;catalog()};$('dexOrder').onclick=()=>{powerOrder=false;pageSize=36;catalog()};
 function records(){
  $('records').replaceChildren();for(const h of history){if(!h||!Array.isArray(h.ids)||h.ids.length!==2||!h.ids.every(i=>by.has(i))||![-1,0,1].includes(h.w))continue;const pair=h.ids.map(i=>by.get(i)),el=document.createElement('article');el.className='record';el.innerHTML=`${img(pair[h.w]||pair[0])}<div><b>${h.w<0?t("무승부","Tie"):esc(pair[h.w].name)+" "+t("승리","wins")}</b><p>${pair.map(x=>esc(x.name)).join(t(' 대 '," vs. "))}</p></div><button>${t("다시 대결","Rematch")}</button>`;el.lastElementChild.onclick=()=>{usePair(h.ids);go('battle');battle()};$('records').append(el)}if(!$('records').children.length)$('records').textContent=t('첫 대결을 마치면 여기에 승자가 나타나!',"Finish a battle to see the winner here!")
 }
 function usePair(ids){pair=ids.map(i=>by.get(i));refresh()}
 function go(name){
  if(!['battle','dex','friend','history'].includes(name))name='battle';
  if(activePage!==name){cancelVoice();if(activePage==='battle'&&busy)refresh();activePage=name;window.scrollTo(0,0)}
  for(let n of ['battle','dex','friend','history'])$(n).hidden=n!==name;
  document.querySelectorAll('nav a').forEach(a=>{const current=a.hash==='#'+name;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(location.hash!=='#'+name)window.history.replaceState(null,'','#'+name);
  if(name==='dex')catalog();if(name==='history')records()
 }
 function bubble(text,you){let p=document.createElement('p');p.className='bubble'+(you?' you':'');p.textContent=text;$('talk').append(p);while($('talk').children.length>10)$('talk').firstElementChild.remove()}
 async function ask(text){
  text=text.trim().slice(0,250);if(!text)return;const seq=++questionEpoch;const prior=lastIntent;
  bubble(text,true);$('message').value='';
  try{
   let reply;
   if(suggested&&/^(응|그래|좋아|붙여|해봐|yes|ok|sure)[!. ]*$/i.test(text)){reply={action:{kind:'battle',ids:suggested},reply:t('좋아! 함께 배틀 필드로 가자!',"Great! Let’s head to the battlefield!"),focus:suggested[0],intent:'battle'}}
   else{const r=await fetch('/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang,pair:pair.map(x=>x.id),focus,lastIntent:prior})});if(!r.ok)throw Error();reply=await r.json()}
   if(seq!==questionEpoch)return;focus=reply.focus;lastIntent=reply.intent;suggested=reply.suggest||null;bubble(reply.reply,false);
   if(reply.action){const drawSide=activePage==='battle'?target:undefined;go('battle');if(reply.action.kind==='battle'){usePair(reply.action.ids);battle()}else if(reply.action.kind==='random')drawCards(drawSide);else choose(target,by.get(reply.action.id))}else if(activePage!=='friend')go('friend');say(reply.reply)
  }catch{if(seq===questionEpoch)notify(t('친구와 연결하지 못했어. 잠시 뒤에 다시 말해 줘.',"Could not reach your buddy. Try again in a moment."))}
 }
 async function digest(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,'0')).join('')}
 function settings(unlocked=false){
  const lock=get('pin',null);
  if(lock&&!unlocked){openModal(en?'<h2>Parent settings</h2><p>Enter the parent PIN for this device.</p><form id="unlock"><input id="pin" type="password" inputmode="numeric" maxlength="8" required aria-label="Parent PIN"><button>Unlock</button></form><p id="pinmsg"></p>':'<h2>부모 설정</h2><p>이 기기의 부모 비밀번호를 입력해 주세요.</p><form id="unlock"><input id="pin" type="password" inputmode="numeric" maxlength="8" required aria-label="부모 비밀번호"><button>열기</button></form><p id="pinmsg"></p>');$('unlock').onsubmit=async e=>{e.preventDefault();if(await digest($('pin').value,lock.salt)===lock.hash)settings(true);else $('pinmsg').textContent=t('비밀번호가 달라요.',"That PIN doesn’t match.")};return}
  openModal(en?`<h2>Parent settings</h2><p>History and preferences stay on this device. The game does not save conversations or audio recordings. Your browser handles speech recognition.</p><button id="sound">Turn speech ${mute?'on':'off'}</button><button id="clearhistory">Clear battle history</button><form id="setpin"><input id="newpin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required placeholder="4 to 8 digits" aria-label="New parent PIN"><button>${lock?'Change':'Set'} PIN</button></form><p id="pinmsg"></p>`:`<h2>부모 설정</h2><p>기록과 설정은 이 기기에 보관합니다. 대화와 마이크 녹음은 게임 서버에 저장하지 않습니다. 음성 인식은 브라우저의 음성 서비스를 사용합니다.</p><button id="sound">음성 읽기 ${mute?'켜기':'끄기'}</button><button id="clearhistory">대결 기록 지우기</button><form id="setpin"><input id="newpin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required placeholder="숫자 4~8자리" aria-label="새 부모 비밀번호"><button>비밀번호 ${lock?'변경':'설정'}</button></form><p id="pinmsg"></p>`);
  $('sound').onclick=()=>{mute=!mute;put('mute',mute);if(mute)window.speechSynthesis?.cancel();settings(true)};
  $('clearhistory').onclick=()=>{history=[];put('history',history);records();$('pinmsg').textContent=t('이 기기의 기록을 지웠어요.',"History cleared on this device.")};
  $('setpin').onsubmit=async e=>{e.preventDefault();const salt=crypto.randomUUID();put('pin',{salt,hash:await digest($('newpin').value,salt)});$('newpin').value='';$('pinmsg').textContent=t('저장했어요. 다음에 열 때 비밀번호가 필요해요.',"Saved. Your PIN will be needed next time.")}
 }
 $('settings').onclick=()=>settings();$('close').onclick=()=>$('modal').close();$('start').onclick=battle;
 $('dexquery').oninput=()=>{pageSize=36;catalog()};$('more').onclick=()=>{pageSize+=36;catalog()};
 $('catalog').onclick=e=>{const btn=e.target.closest('[data-card]');if(!btn)return;const p=by.get(+btn.dataset.card);openModal(card(p,t('전국도감',"National Dex"))+`<button id="mine">${t('내 카드로','Pick for me')}</button><button id="theirs">${t('상대 카드로','Pick as opponent')}</button>`);for(let [n,i] of [['mine',0],['theirs',1]])$(n).onclick=()=>{$('modal').close();choose(i,p);go('battle')}};
 $('chat').onsubmit=e=>{e.preventDefault();ask($('message').value)};$('examples').onclick=e=>{if(e.target.tagName==='BUTTON')ask(e.target.textContent)};
 document.querySelectorAll('[data-mic]').forEach(b=>b.onclick=mic);document.querySelectorAll('header a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();if(location.hash!==a.hash)window.history.pushState(null,'',a.hash);go(a.hash.slice(1))});window.onhashchange=()=>go(location.hash.slice(1));document.addEventListener('click',e=>{if(!e.target.closest('.searchbox'))document.querySelectorAll('.suggest').forEach(x=>x.replaceChildren())});
 drawField($('land'));refresh();$('loading').hidden=true;go(location.hash.slice(1));bubble(t('안녕! 좋아하는 포켓몬 이름을 말해 줘.',"Hi! Tell me the name of your favorite Pokémon."),false);
})().catch(()=>{document.getElementById('loading').textContent=Locale.t('도감을 열지 못했어. 새로고침해서 다시 만나자!','Could not open the Pokédex. Please refresh to try again.')});
