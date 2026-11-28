'use strict';
(async function(){
 const {t,en,lang}=Locale,$=id=>document.getElementById(id);
 const views=['setup','waiting','watch','result'];
 const show=view=>views.forEach(id=>$(id).hidden=id!==view);
 const status=text=>{$('notice').textContent=text};
 const d=await fetch('/dex.json').then(r=>{if(!r.ok)throw Error();return r.json()});
 const idx=Game.index(d),by=new Map(d.pokemon.map(p=>[p.id,p]));
 const name=id=>en?by.get(id).en:by.get(id).name;
 const newURL=new URL(location.href);
 for(const link of document.querySelectorAll('a.back,#home,#restart')){
  const dest=new URL(link.href);dest.searchParams.set('lang',lang);link.href=dest.href;
 }
 let room=newURL.searchParams.get('room'),mode=room?'join':'practice',pendingId=null;
 let teams=[room?[6,94,130]:[25,9,3],[6,94,130]],editing,match,side=0,round=0,frame,poll,submitting=false;
 const draftNames=[localStorage.getItem('arena.team-name')||'',''];
 let names=['',''],game=1,ready=0,voting=false,pollVersion=0;
 const teamName=i=>names[i]||(i===side?t('우리 팀','Your team'):t('상대 팀','Opponent'));
 function roomMatch(state){
  names=state.names;game=state.game;ready=state.ready;
  watch(state.match,state.side);
 }
 const secrets=new Map();
 function credential(id){
  if(secrets.has(id))return secrets.get(id);
  const key='arena.team-seat.'+id;
  let token=localStorage.getItem(key);
  if(!token){
   token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   localStorage.setItem(key,token);
  }
  secrets.set(id,token);return token;
 }
 async function api(path,data,id){
  const headers={};
  if(id)headers.Authorization='Bearer '+credential(id);
  if(data)headers['Content-Type']='application/json';
  const response=await fetch(path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Object.assign(Error('request'),{status:response.status});
  return response.json();
 }
 const roomPath=id=>'/api/team-rooms/'+encodeURIComponent(id);
 function handleError(e){
  const terminal=e.status===404||e.status===409;
  status(e.status===404?t('방이 만료되었거나 링크가 잘못됐어.','This room expired or the link is incorrect.'):e.status===409?t('이미 두 명이 참가한 방이야.','Both seats are taken.'):e.status===429?t('방이 가득 찼어. 잠시 뒤 다시 시도해 줘.','Too many rooms. Try again later.'):t('연결을 확인하고 다시 시도해 줘.','Check your connection and try again.'));
  if(terminal){clearTimeout(poll);show('');$('restart').hidden=false}
  return terminal;
 }
 function el(tag,txt){
  const node=document.createElement(tag);if(txt!==undefined)node.textContent=txt;return node;
 }
 function art(id){
  const image=el('img');image.alt='';image.src='/art/'+id;return image;
 }
 function roster(ids,sideIndex,editable){
  const block=el('div');if(sideIndex===1)block.className='opponent';
  const head=el('div');head.className='section-head';
  head.append(el('h2',sideIndex?t('상대 팀','Opponent'):t('내 팀','My team')));
  if(editable){
   const draw=el('button',t('랜덤 뽑기','Random team'));
   draw.onclick=()=>{
    const pool=d.pokemon.filter(p=>p.dex===p.id);
    teams[sideIndex]=ids.map(()=>pool.splice(Math.floor(Math.random()*pool.length),1)[0].id);renderSetup();
   };head.append(draw);
  }
  const grid=el('div');grid.className='roster';
  ids.forEach((id,i)=>{
   const card=el(editable?'button':'div');card.className='member';
   card.append(el('small',t((i+1)+'번 출전','Slot '+(i+1))),art(id),el('b',name(id)));
   if(editable)card.onclick=()=>pick(sideIndex,i);grid.append(card);
  });
  block.append(head);
  if(editable){
   const label=el('label',sideIndex?t('상대 팀 이름','Opponent team name'):t('팀 이름','Team name'));
   const input=el('input');input.type='text';input.maxLength=24;input.className='team-name';input.value=draftNames[sideIndex];
   input.placeholder=sideIndex?t('예: 불꽃단','e.g. Fire Squad'):t('예: 번개단','e.g. Bolt Squad');
   input.oninput=()=>{draftNames[sideIndex]=input.value};label.append(input);block.append(label);
  }else if(names[0])head.firstChild.textContent=names[0];
  block.append(grid);return block;
 }
 function renderSetup(){
  show('setup');$('lineups').replaceChildren(roster(teams[0],0,true));
  if(mode==='practice')$('lineups').append(roster(teams[1],1,true));
  $('practice').parentElement.hidden=mode==='join';
  $('practice').setAttribute('aria-pressed',String(mode==='practice'));$('friends').setAttribute('aria-pressed',String(mode==='friends'));
  $('launch').textContent=mode==='practice'?t('3:3 대결 시작','Start team battle'):mode==='join'?t('이 팀으로 참가','Join with this team'):t('이 팀으로 초대방 만들기','Create invite room');
 }
 function choices(){
  const [s,i]=editing,matches=Game.search(idx,$('query').value,16);
  $('choices').replaceChildren(...matches.map(p=>{
   const button=el('button');button.append(art(p.id),el('b',name(p.id)),el('small',p.types.map(id=>Locale.types[id]).join(' · ')));
   button.onclick=()=>{
    const other=teams[s].findIndex(id=>by.get(id).dex===p.dex);
    if(other>=0&&other!==i)teams[s][other]=teams[s][i];
    teams[s][i]=p.id;$('picker').close();renderSetup();
   };return button;
  }));
  if(!matches.length)$('choices').textContent=t('이름이나 도감 번호를 다시 입력해 줘.','Try a different name or Pokédex number.');
 }
 function pick(s,i){
  stopListening();
  editing=[s,i];$('pick-title').textContent=t((i+1)+'번 포켓몬 선택','Choose Pokémon '+(i+1));
  $('query').value='';choices();$('picker').showModal();$('query').focus();
 }
 let recognition=null;
 const mic=$('pick-mic'),hint=$('mic-status');
 function stopListening(){
  const current=recognition;
  recognition=null;
  if(current)current.abort();
  mic.setAttribute('aria-pressed','false');
  hint.textContent='';
 }
 mic.onclick=()=>{
  if(recognition){stopListening();return}
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition||!window.isSecureContext){
   hint.textContent=t('마이크를 쓰려면 Chrome에서 열어 줘. 이름을 입력해도 돼.','Open in Chrome to use the mic, or type a name.');
   return;
  }
  const session=new Recognition();
  recognition=session;
  session.lang=en?'en-US':'ko-KR';
  session.maxAlternatives=5;
  mic.setAttribute('aria-pressed','true');
  hint.textContent=t('마이크 연결 중…','Connecting microphone…');
  session.onstart=()=>{
   if(recognition===session)hint.textContent=t('듣고 있어! 포켓몬 이름을 말해 줘.','Listening! Say a Pokémon name.');
  };
  let answered=false;
  session.onresult=event=>{
   if(recognition!==session||!$('picker').open)return;
   const words=Array.from(event.results[event.resultIndex],alt=>alt.transcript.trim()).filter(Boolean);
   if(!words.length)return;
   const found=words.map(word=>Game.heard(idx,word)[0]).find(Boolean);
   $('query').value=found?name(found.id):words.find(word=>Game.search(idx,word,1).length)||words[0];
   choices();answered=true;
   hint.textContent=t('들은 말 · ','Heard · ')+words[0];
  };
  session.onerror=event=>{
   if(recognition!==session)return;
   answered=true;
   hint.textContent=['not-allowed','service-not-allowed'].includes(event.error)
    ?t('사이트 설정에서 마이크를 허용해 줘.','Allow microphone access in site settings.')
    :t('잘 들리지 않았어. 다시 말하거나 이름을 입력해 줘.','Try speaking again, or type a name.');
  };
  session.onend=()=>{
   if(recognition!==session)return;
   recognition=null;mic.setAttribute('aria-pressed','false');
   if(!answered)hint.textContent=t('다시 눌러서 이름을 말해 줘.','Tap again and say a name.');
  };
  try{session.start()}catch{
   stopListening();hint.textContent=t('마이크 권한을 확인하고 다시 눌러 줘.','Check microphone permissions and try again.');
  }
 };
 $('picker').addEventListener('close',stopListening);
 window.addEventListener('pagehide',stopListening);
 $('query').oninput=()=>{stopListening();choices()};
 $('query').onkeydown=e=>{if(e.key==='Enter')$('choices').querySelector('button')?.click()};
 $('practice').onclick=()=>{mode='practice';status('');renderSetup()};
 $('friends').onclick=()=>{mode='friends';status('');renderSetup()};
 function waitForFriend(){
  show('waiting');$('invite').value=location.href;$('locked-team').replaceChildren(roster(teams[0],0,false));
  async function check(){
   try{
    const state=await api(roomPath(room),null,room);status('');
    if(state.match){roomMatch(state);return}
   }catch(e){if(handleError(e))return}
   poll=setTimeout(check,1600);
  }
  poll=setTimeout(check,800);
 }
 async function copyInvite(){
  try{await navigator.clipboard.writeText($('invite').value);$('share-hint').textContent=t('초대 링크를 복사했어. 메시지나 카카오톡에 붙여넣어 줘.','Link copied. Paste it into Messages or KakaoTalk.')}
  catch{$('invite').focus();$('invite').select();$('share-hint').textContent=t('선택된 링크를 복사해서 친구에게 보내 줘.','Copy the selected link and send it to your friend.')}
 }
 $('copy').onclick=copyInvite;
 $('share').onclick=async()=>{
  const invite={title:t('카드 아레나 · 3:3 대결','Card Arena · Team Battle'),url:$('invite').value,
   text:(names[0]?names[0]+' · ':'')+t('포켓몬 세 마리를 골라 나랑 대결하자!','Pick three Pokémon and battle me!')};
  try{
   if(navigator.share&&(!navigator.canShare||navigator.canShare(invite))){await navigator.share(invite);return}
  }catch(e){if(e.name==='AbortError')return}
  await copyInvite();
 };
 $('launch').onclick=async()=>{
  if(submitting)return;submitting=true;
  $('setup').inert=true;$('launch').disabled=true;status(t('준비 중…','Getting ready…'));
  try{
   localStorage.setItem('arena.team-name',draftNames[0].trim());
   if(mode==='practice'){
    names=draftNames.map(n=>n.trim());
    const result=await api('/api/team-battle',{team:teams[0],opponent:teams[1]});watch(result,0);
   }else{
    const id=room||(pendingId??=crypto.randomUUID()),creating=mode==='friends';
    const state=await api(roomPath(id),{action:creating?'create':'join',team:teams[0],name:draftNames[0].trim()},id);
    room=id;newURL.searchParams.set('room',room);history.replaceState(null,'',newURL);status('');
    names=state.names;
    if(state.match)roomMatch(state);else waitForFriend();
   }
  }catch(e){handleError(e)}finally{submitting=false;$('setup').inert=false;$('launch').disabled=false}
 };
 function sendRound(){
  const current=match.rounds[round];
  const score=[0,0];
  for(const previous of match.rounds.slice(0,round))if(previous.result.winner>=0)score[previous.result.winner]++;
  $('live-score').textContent=t('파랑','Blue')+' · '+teamName(0)+' '+score[0]+' : '+score[1]+' '+teamName(1)+' · '+t('빨강','Red');
  $('round-title').textContent=t((round+1)+'차전','Round '+(round+1))+' · '+current.ids.map(name).join(' vs ');
  frame.contentWindow.postMessage({kind:'team-round',round,names,...current},location.origin);
 }
 function watch(value,seat){
  clearTimeout(poll);pollVersion++;match=value;side=seat;round=0;status('');show('watch');
  frame=el('iframe');frame.title=t('3:3 배틀 필드','Team battle arena');
  frame.src='/?teamReplay=1&lang='+lang+'#battle';$('round-title').textContent=t('배틀 필드 준비 중…','Opening the arena…');
  $('stage').replaceChildren(frame);window.scrollTo(0,0);
 }
 function result(){
  $('stage').replaceChildren();frame=null;show('result');
  const w=match.winner;
  $('result').dataset.winner=w<0?'draw':w===0?'blue':'red';
  $('verdict').textContent=w<0?t('무승부!','A tie!'):teamName(w)+t(' 승리!',' wins!');
  const champions=w<0?[0,1]:[w];
  $('champions').replaceChildren(...champions.map(s=>{
   const team=el('div');team.className='champion-team';
   for(const r of match.rounds){
    const id=r.ids[s],figure=el('figure');figure.append(art(id),el('figcaption',name(id)));team.append(figure);
   }
   return team;
  }));
  $('score').replaceChildren(el('span',teamName(side)),el('strong',match.score[side]+' : '+match.score[1-side]),el('span',teamName(1-side)));
  $('rounds').replaceChildren(...match.rounds.map(({ids,result:r},i)=>{
   const row=el('div');row.className='duel';
   const who=r.winner<0?t('무승부','Tie'):name(ids[r.winner])+t(' 승리',' wins');
   row.dataset.winner=r.winner;
   const header=el('div');header.className='duel-top';
   header.append(el('small',t((i+1)+'차전','Round '+(i+1))),el('strong',ids.map(name).join(' vs ')),el('b',who));row.append(header);
   const explanation=Game.explain(r,ids.map(id=>by.get(id)),d,lang)[0];
   const details=el('details');details.append(el('summary',t('경기 해설','Battle recap')),el('p',explanation));row.append(details);return row;
  }));window.scrollTo(0,0);
  updateVote();
  if(room)pollResult();
 }
 function updateVote(){
  const mine=Boolean(ready&(1<<side)),theirs=Boolean(ready&(1<<(1-side)));
  $('rematch').disabled=voting||mine;
  $('rematch').textContent=mine?t('재대결 신청 완료','Rematch requested'):theirs?t('재대결 수락','Accept rematch'):t('재대결','Rematch');
  $('rematch-status').textContent=mine?t('친구가 수락하면 같은 팀으로 다시 시작해.','Waiting for your friend to accept.'):theirs?t('친구가 재대결을 신청했어!','Your friend wants a rematch!'):'';
 }
 function applyVote(state){
  if(state.game>game){roomMatch(state);return}
  if(state.game===game){ready|=state.ready;updateVote()}
 }
 function pollResult(){
  const version=++pollVersion;clearTimeout(poll);
  async function check(){
   try{
    const state=await api(roomPath(room)+'?since='+game,null,room);
    if(version!==pollVersion)return;
    applyVote(state);
   }catch(e){
    if(version!==pollVersion)return;
    if(e.status===404){$('rematch').disabled=true;$('rematch-status').textContent=t('방이 만료됐어. 새 팀 대결에서 다시 초대해 줘.','Room expired. Start a new team battle.');return}
   }
   if(version===pollVersion)poll=setTimeout(check,1800);
  }
  poll=setTimeout(check,500);
 }
 $('rematch').onclick=async()=>{
  if(voting)return;voting=true;updateVote();
  try{
   if(room)applyVote(await api(roomPath(room),{action:'rematch',game},room));
   else watch(await api('/api/team-battle',{team:teams[0],opponent:teams[1]}),0);
  }catch{status(t('재대결 요청을 보내지 못했어. 다시 시도해 줘.','Could not request the rematch. Please try again.'))}
  finally{voting=false;updateVote()}
 };
 window.addEventListener('message',e=>{
  if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow)return;
  if(e.data?.kind==='team-ready')sendRound();
  if(e.data?.kind==='team-exit')result();
  if(e.data?.kind==='team-round-end'&&e.data.round===round){
   if(++round<match.rounds.length)sendRound();else result();
  }
 });
 $('finish').onclick=result;$('replay').onclick=()=>watch(match,side);
 if(room){
  try{
   const state=await api(roomPath(room),null,room);
   if(state.match){roomMatch(state);if(state.ready)result()}
   else if(state.side===0){names=state.names;teams[0]=state.team;waitForFriend()}
   else if(state.available){renderSetup();if(state.hostName)status(state.hostName+t('의 초대장이야.',' invited you to battle.'))}
   else handleError({status:409});
  }catch(e){if(!handleError(e)){$('restart').href=location.href;$('restart').hidden=false;$('restart').textContent=t('다시 연결','Reconnect')}}
 }else renderSetup();
})().catch(()=>{document.getElementById('notice').textContent=Locale.t('도감을 열지 못했어. 새로고침해 줘.','Could not load the Pokédex. Please refresh.')});
