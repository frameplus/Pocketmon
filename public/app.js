'use strict';
(async function(){
 const $=id=>document.getElementById(id),G=window.Game,esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const d=await fetch('/dex.json').then(r=>{if(!r.ok)throw Error();return r.json()}),idx=G.index(d),by=new Map(d.pokemon.map(p=>[p.id,p]));
 const get=(k,def)=>{try{return JSON.parse(localStorage.getItem('arena.'+k))??def}catch{return def}};
 const put=(k,v)=>{try{localStorage.setItem('arena.'+k,JSON.stringify(v))}catch{}};
 let pair=[by.get(25),by.get(6)],battlePlan,epoch=0,busy=false,activePage='',target=0,pageSize=36,noticeTimer,rec=null,voiceEpoch=0,focus=25,lastIntent='',suggested=null,questionEpoch=0;
 let mute=get('mute',false),history=get('history',[]);if(!Array.isArray(history))history=[];
 const badges=p=>p.types.map(t=>`<span class="badge">${G.icons[t]} ${G.types[t]}</span>`).join('');
 const img=(p,extra='')=>`<img src="/art/${p.id}" alt="${esc(p.name)}" ${extra}>`;
 function say(s){if(mute||rec||!window.speechSynthesis)return;try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(s);u.lang='ko-KR';u.rate=.95;const ko=speechSynthesis.getVoices().find(v=>v.lang.startsWith('ko'));if(ko)u.voice=ko;speechSynthesis.speak(u)}catch{}}
 function notify(s,hold=false){clearTimeout(noticeTimer);$('speech').textContent=s;$('speech').hidden=false;if(!hold)noticeTimer=setTimeout(()=>$('speech').hidden=true,5500)}
 function markMic(on){document.querySelectorAll('[data-mic]').forEach(b=>{b.classList.toggle('onair',on);b.textContent=on?'● 듣고 있어요!':b.closest('#friend')?'🎙 말하기':'🎙 이름 말하기'})}
 function cancelVoice(){voiceEpoch++;if(rec){let old=rec;rec=null;try{old.abort()}catch{}}window.speechSynthesis?.cancel();markMic(false);$('speech').hidden=true}
 function mic(){
  if(rec){rec.stop();return}cancelVoice();let R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R||!window.isSecureContext){notify('이 브라우저에서는 들을 수 없어. HTTPS 주소를 Chrome에서 열거나 이름을 입력해 줘.');return}
  const generation=voiceEpoch,r=new R();rec=r;r.lang='ko-KR';r.interimResults=true;r.maxAlternatives=5;let choices=[],failed=false;
  r.onstart=()=>{if(generation===voiceEpoch){markMic(true);notify('🔴 듣고 있어요!',true)}};
  r.onresult=e=>{if(generation!==voiceEpoch)return;const rows=Array.from(e.results),last=rows.at(-1);const text=rows.map(v=>v[0].transcript).join(' ');notify('듣고 있어요! '+text,true);if(last.isFinal){choices=[text,...Array.from(last,v=>v.transcript)];r.stop()}};
  r.onerror=e=>{if(generation!==voiceEpoch)return;failed=true;const msg={'not-allowed':'주소창의 사이트 설정에서 마이크를 허용해 줘.','service-not-allowed':'브라우저에서 음성 인식을 허용해 줘.','no-speech':'목소리가 들리지 않았어. 다시 눌러 봐.','network':'음성 인식 서버에 연결할 수 없어. 인터넷을 확인하거나 이름을 입력해 줘.','audio-capture':'마이크가 연결됐는지 확인해 줘.','aborted':'듣기를 멈췄어.'};notify(msg[e.error]||'마이크를 다시 눌러 줘.')};
  r.onend=()=>{if(generation!==voiceEpoch)return;rec=null;markMic(false);if(failed)return;if(!choices.length){notify('다시 누르고 말해 줘.');return}const ranked=choices.map(t=>[G.heard(idx,t).length,t]).sort((a,b)=>b[0]-a[0]);notify('들은 말 · '+ranked[0][1]);ask(ranked[0][1])};
  try{notify('마이크 연결 중…',true);r.start()}catch{rec=null;notify('마이크를 시작할 수 없어. 권한을 확인해 줘.')}
 }
 function card(p,side){
  const moves=p.moves.map(id=>{const m=d.moves[id];return `<div class="move"><b>${esc(m.name)}</b><small>${G.icons[m.type]} ${G.types[m.type]} · ${m.power?'위력 '+m.power:'변화 기술'}</small></div>`}).join('');
  return `<article class="card" style="--t:${G.colors[p.types[0]]}"><div class="shell"><div class="cardtop"><div><small class="serial">${side} · No. ${String(p.dex).padStart(4,'0')}</small><h2>${esc(p.name)}</h2></div><span class="hp"><small>HP</small> ${p.stats[0]}</span></div><div class="art">${img(p)}</div><div class="meta">${badges(p)}<span class="english">${esc(p.en)}</span></div><details><summary>능력치 · 기술 ${p.moves.length}개</summary><div class="stats">${p.stats.map((v,i)=>`<span>${G.statNames[i]}<b>${v}</b></span>`).join('')}</div>${moves}</details></div></article>`
 }
 function choose(i,p){pair[i]=p;focus=p.id;target=i;refresh()}
 function slot(i){
  const p=pair[i],el=$('slot'+i),forms=d.pokemon.filter(x=>x.dex===p.dex&&x.id!==x.dex),label=i?'상대':'내 포켓몬';
  el.innerHTML=`<div class="searchbox"><input id="q${i}" autocomplete="off" aria-label="${label} 검색" placeholder="⌕ ${label} 검색"><div id="s${i}" class="suggest"></div></div>${card(p,label)}${forms.length?`<div class="mega">${(p.id!==p.dex?[by.get(p.dex),...forms]:forms).map(f=>`<button data-form="${f.id}" aria-pressed="${f.id===p.id}">${f.id===p.dex?'↶ 기본 모습':'✧ '+esc(f.name)}</button>`).join('')}</div>`:''}`;
  const q=$('q'+i),s=$('s'+i);
  q.onfocus=()=>{target=i};
  q.oninput=()=>{s.replaceChildren();if(!q.value.trim())return;const found=G.search(idx,q.value);for(const f of found){let b=document.createElement('button');b.type='button';b.innerHTML=img(f)+`<b>${esc(f.name)}</b><small>${f.types.map(t=>G.types[t]).join('·')}</small>`;b.onclick=()=>choose(i,f);s.append(b)}if(!found.length)s.textContent='찾는 친구가 없어. 다른 이름을 써 봐.'};
  q.onkeydown=e=>{if(e.key==='Enter')s.querySelector('button')?.click();if(e.key==='Escape')s.replaceChildren();if(e.key==='ArrowDown'){e.preventDefault();s.querySelector('button')?.focus()}};
  el.querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>{choose(i,by.get(+b.dataset.form));say(pair[i].name+'!')})
 }
 function actors(){return pair.map((p,i)=>`<div class="actor ${i?'right':'left'}" id="a${i}">${img(p)}<div class="hud"><div class="row"><span>${esc(p.name)}</span><small id="hp${i}">${G.hp(p)}/${G.hp(p)}</small></div><div class="track"><i id="bar${i}" style="width:100%"></i></div></div></div>`).join('')}
 function refresh(){
  epoch++;busy=false;$('start').disabled=false;$('start').textContent='▶ 대결 시작';$('result').hidden=true;$('prediction').open=true;
  slot(0);slot(1);battlePlan=G.plan(pair,d);const odds=G.odds(battlePlan),lead=odds[0]>=odds[1]?0:1,move=battlePlan.lists[lead][0];
  const note=odds[0]===odds[1]?'두 친구의 기회가 비슷해!':pair[lead].name+' 쪽이 유리해. '+(move&&move.factor>1?d.moves[move.id].name+' 기술로 약점을 노릴 수 있어.':pair[lead].stats[5]>pair[1-lead].stats[5]?'스피드가 더 빨라.':'연습 대결에서 더 자주 이겼어.');
  $('odds').innerHTML=`<div class="row"><b>${esc(pair[0].name)} ${odds[0]}%</b><b>${odds[1]}% ${esc(pair[1].name)}</b></div><div class="meter"><i style="width:${odds[0]}%"></i></div><p class="hint">400번 연습 결과 · ${esc(note)}</p>`;
  $('actors').innerHTML=actors();$('round').textContent='준비 완료';$('log').textContent=pair.map(x=>x.name).join(' 대 ')+'!';$('fx').textContent='';$('fx').className='';
 }
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function battle(){
  if(busy)return;const id=++epoch;busy=true;const result=G.run(battlePlan);
  $('start').disabled=true;$('start').textContent='대결 중…';$('actors').innerHTML=actors();$('result').hidden=true;$('arena').scrollIntoView({block:'center',behavior:'smooth'});
  for(const e of result.events){
   if(id!==epoch)return;const a=$('a'+e.i),b=$('a'+e.j),fx=$('fx'),m=d.moves[e.move];
   for(let i of [0,1])$('a'+i).classList.remove('hit','strike');
   fx.className='';void fx.offsetWidth;a.classList.add('strike');if(e.hit)b.classList.add('hit');fx.textContent=G.icons[m.type];fx.className='shot'+(e.i?' reverse':'');
   $('round').textContent=e.round+'라운드';$('log').textContent=`${pair[e.i].name}의 ${m.name}! `+(e.hit?(e.crit?'급소에 맞았어! ':e.factor>1?'효과가 굉장해! ':'')+'−'+e.damage:'빗나갔어!');
   e.hp.forEach((h,i)=>{$('hp'+i).textContent=h+'/'+G.hp(pair[i]);$('bar'+i).style.width=h/G.hp(pair[i])*100+'%'});await pause(710)
  }
  if(id!==epoch)return;const w=result.winner,v=pair[w],l=pair[1-w],why=G.explain(result,pair,d);
  $('round').textContent='대결 끝';$('log').textContent='두 친구 모두 수고했어!';$('fx').textContent='';$('prediction').open=false;
  $('result').innerHTML=`<article class="win">${img(v)}<div><h2>🏆 ${esc(v.name)} 승리!</h2><p><b>${esc(v.name)}이 이긴 이유</b><br>${esc(why[0])}</p><p><b>${esc(l.name)}이 진 이유</b><br>${esc(why[1])}</p><button id="again">↻ 다시 대결</button></div></article>`;$('result').hidden=false;$('again').onclick=battle;
  history=[{ids:pair.map(p=>p.id),w,time:Date.now()},...history].slice(0,24);put('history',history);
  busy=false;$('start').disabled=false;$('start').textContent='↻ 다시 대결';$('result').scrollIntoView({block:'nearest',behavior:'smooth'});say(`${v.name} 승리! ${why[0]} ${l.name}은 ${why[1]}`)
 }
 function random(){const a=1+Math.floor(Math.random()*1025),b=1+Math.floor(Math.random()*1024);pair=[by.get(a),by.get(b>=a?b+1:b)];refresh()}
 function openModal(html){$('modalbody').innerHTML=html;if(!$('modal').open)$('modal').showModal()}
 function catalog(){const matches=G.search(idx,$('dexquery').value,2000);$('catalog').innerHTML=matches.slice(0,pageSize).map(p=>`<button data-card="${p.id}">${img(p,'loading="lazy"')}<small>No. ${p.dex}</small><b>${esc(p.name)}</b><small>${p.types.map(i=>G.types[i]).join('·')}</small></button>`).join('')||'찾는 친구가 없어.';$('more').hidden=pageSize>=matches.length}
 function records(){
  $('records').replaceChildren();for(const h of history){if(!h||!Array.isArray(h.ids)||h.ids.length!==2||!h.ids.every(i=>by.has(i))||![0,1].includes(h.w))continue;const pair=h.ids.map(i=>by.get(i)),el=document.createElement('article');el.className='record';el.innerHTML=`${img(pair[h.w])}<div><b>${esc(pair[h.w].name)} 승리</b><p>${pair.map(x=>esc(x.name)).join(' 대 ')}</p></div><button>다시 대결</button>`;el.lastElementChild.onclick=()=>{usePair(h.ids);go('battle');battle()};$('records').append(el)}if(!$('records').children.length)$('records').textContent='첫 대결을 마치면 여기에 승자가 나타나!'
 }
 function usePair(ids){pair=ids.map(i=>by.get(i));refresh()}
 function go(name){
  if(!['battle','dex','friend','history'].includes(name))name='battle';
  if(activePage!==name){cancelVoice();if(activePage==='battle'&&busy)refresh();activePage=name;window.scrollTo(0,0)}
  for(let n of ['battle','dex','friend','history'])$(n).hidden=n!==name;
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+name));
  if(location.hash!=='#'+name)window.history.replaceState(null,'','#'+name);
  if(name==='dex')catalog();if(name==='history')records()
 }
 function bubble(text,you){let p=document.createElement('p');p.className='bubble'+(you?' you':'');p.textContent=text;$('talk').append(p);while($('talk').children.length>10)$('talk').firstElementChild.remove()}
 async function ask(text){
  text=text.trim().slice(0,250);if(!text)return;const seq=++questionEpoch;const prior=lastIntent;
  bubble(text,true);$('message').value='';
  try{
   let reply;
   if(suggested&&/^(응|그래|좋아|붙여|해봐)[!. ]*$/.test(text)){reply={action:{kind:'battle',ids:suggested},reply:'좋아! 함께 배틀 필드로 가자!',focus:suggested[0],intent:'battle'}}
   else{const r=await fetch('/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,pair:pair.map(x=>x.id),focus,lastIntent:prior})});if(!r.ok)throw Error();reply=await r.json()}
   if(seq!==questionEpoch)return;focus=reply.focus;lastIntent=reply.intent;suggested=reply.suggest||null;bubble(reply.reply,false);
   if(reply.action){go('battle');if(reply.action.kind==='battle'){usePair(reply.action.ids);battle()}else if(reply.action.kind==='random')random();else choose(target,by.get(reply.action.id))}else if(activePage!=='friend')go('friend');say(reply.reply)
  }catch{if(seq===questionEpoch)notify('친구와 연결하지 못했어. 잠시 뒤에 다시 말해 줘.')}
 }
 async function digest(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,'0')).join('')}
 function settings(unlocked=false){
  const lock=get('pin',null);
  if(lock&&!unlocked){openModal('<h2>부모 설정</h2><p>이 기기의 부모 비밀번호를 입력해 주세요.</p><form id="unlock"><input id="pin" type="password" inputmode="numeric" maxlength="8" required aria-label="부모 비밀번호"><button>열기</button></form><p id="pinmsg"></p>');$('unlock').onsubmit=async e=>{e.preventDefault();if(await digest($('pin').value,lock.salt)===lock.hash)settings(true);else $('pinmsg').textContent='비밀번호가 달라요.'};return}
  openModal(`<h2>부모 설정</h2><p>기록과 설정은 이 기기에 보관합니다. 대화와 마이크 녹음은 게임 서버에 저장하지 않습니다. 음성 인식은 브라우저의 음성 서비스를 사용합니다.</p><button id="sound">음성 읽기 ${mute?'켜기':'끄기'}</button><button id="clearhistory">대결 기록 지우기</button><form id="setpin"><input id="newpin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required placeholder="숫자 4~8자리" aria-label="새 부모 비밀번호"><button>비밀번호 ${lock?'변경':'설정'}</button></form><p id="pinmsg"></p>`);
  $('sound').onclick=()=>{mute=!mute;put('mute',mute);if(mute)window.speechSynthesis?.cancel();settings(true)};
  $('clearhistory').onclick=()=>{history=[];put('history',history);records();$('pinmsg').textContent='이 기기의 기록을 지웠어요.'};
  $('setpin').onsubmit=async e=>{e.preventDefault();const salt=crypto.randomUUID();put('pin',{salt,hash:await digest($('newpin').value,salt)});$('newpin').value='';$('pinmsg').textContent='저장했어요. 다음에 열 때 비밀번호가 필요해요.'}
 }
 $('settings').onclick=()=>settings();$('close').onclick=()=>$('modal').close();$('start').onclick=battle;$('random').onclick=()=>{random();battle()};
 $('dexquery').oninput=()=>{pageSize=36;catalog()};$('more').onclick=()=>{pageSize+=36;catalog()};
 $('catalog').onclick=e=>{const btn=e.target.closest('[data-card]');if(!btn)return;const p=by.get(+btn.dataset.card);openModal(card(p,'전국도감')+'<button id="mine">내 카드로</button><button id="theirs">상대 카드로</button>');for(let [n,i] of [['mine',0],['theirs',1]])$(n).onclick=()=>{$('modal').close();choose(i,p);go('battle')}};
 $('chat').onsubmit=e=>{e.preventDefault();ask($('message').value)};$('examples').onclick=e=>{if(e.target.tagName==='BUTTON')ask(e.target.textContent)};
 document.querySelectorAll('[data-mic]').forEach(b=>b.onclick=mic);window.onhashchange=()=>go(location.hash.slice(1));document.addEventListener('click',e=>{if(!e.target.closest('.searchbox'))document.querySelectorAll('.suggest').forEach(x=>x.replaceChildren())});
 drawField($('land'));refresh();$('loading').hidden=true;go(location.hash.slice(1));bubble('안녕! 좋아하는 포켓몬 이름을 말해 줘.',false);
})().catch(()=>{document.getElementById('loading').textContent='도감을 열지 못했어. 새로고침해서 다시 만나자!'});