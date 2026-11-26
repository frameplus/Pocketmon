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
  block.append(head,grid);return block;
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
  editing=[s,i];$('pick-title').textContent=t((i+1)+'번 포켓몬 선택','Choose Pokémon '+(i+1));
  $('query').value='';choices();$('picker').showModal();$('query').focus();
 }
 $('query').oninput=choices;
 $('query').onkeydown=e=>{if(e.key==='Enter')$('choices').querySelector('button')?.click()};
 $('practice').onclick=()=>{mode='practice';status('');renderSetup()};
 $('friends').onclick=()=>{mode='friends';status('');renderSetup()};
 function waitForFriend(){
  show('waiting');$('invite').value=location.href;$('locked-team').replaceChildren(roster(teams[0],0,false));
  async function check(){
   try{
    const state=await api(roomPath(room),null,room);status('');
    if(state.match){watch(state.match,state.side);return}
   }catch(e){if(handleError(e))return}
   poll=setTimeout(check,1600);
  }
  poll=setTimeout(check,800);
 }
 $('copy').onclick=async()=>{
  try{await navigator.clipboard.writeText($('invite').value);status(t('링크를 복사했어. 친구에게 보내 줘!','Link copied. Send it to your friend!'))}
  catch{$('invite').select();status(t('선택된 링크를 복사해 줘.','Copy the selected link.'))}
 };
 $('launch').onclick=async()=>{
  if(submitting)return;submitting=true;
  $('setup').inert=true;$('launch').disabled=true;status(t('준비 중…','Getting ready…'));
  try{
   if(mode==='practice'){
    const result=await api('/api/team-battle',{team:teams[0],opponent:teams[1]});watch(result,0);
   }else{
    const id=room||(pendingId??=crypto.randomUUID()),creating=mode==='friends';
    const state=await api(roomPath(id),{action:creating?'create':'join',team:teams[0]},id);
    room=id;newURL.searchParams.set('room',room);history.replaceState(null,'',newURL);status('');
    if(state.match)watch(state.match,state.side);else waitForFriend();
   }
  }catch(e){handleError(e)}finally{submitting=false;$('setup').inert=false;$('launch').disabled=false}
 };
 function sendRound(){
  const current=match.rounds[round];
  const score=[0,0];
  for(const previous of match.rounds.slice(0,round))if(previous.result.winner>=0)score[previous.result.winner]++;
  const own=t('내 팀','My team'),other=t('상대 팀','Opponent');
  $('live-score').textContent=t('파랑','Blue')+' · '+(side===0?own:other)+' '+score[0]+' : '+score[1]+' '+(side===1?own:other)+' · '+t('빨강','Red');
  $('round-title').textContent=t((round+1)+'차전','Round '+(round+1))+' · '+current.ids.map(name).join(' vs ');
  frame.contentWindow.postMessage({kind:'team-round',round,...current},location.origin);
 }
 function watch(value,seat){
  clearTimeout(poll);match=value;side=seat;round=0;status('');show('watch');
  frame=el('iframe');frame.title=t('3:3 배틀 필드','Team battle arena');
  frame.src='/?teamReplay=1&lang='+lang+'#battle';$('round-title').textContent=t('배틀 필드 준비 중…','Opening the arena…');
  $('stage').replaceChildren(frame);window.scrollTo(0,0);
 }
 function result(){
  $('stage').replaceChildren();frame=null;show('result');
  $('verdict').textContent=match.winner<0?t('무승부!','A tie!'):match.winner===side?t('우리 팀 승리!','Your team wins!'):t('상대 팀 승리!','Opponent wins!');
  $('score').textContent=t('우리 팀 ','Your team ')+match.score[side]+' : '+match.score[1-side]+t(' 상대 팀',' Opponent');
  $('rounds').replaceChildren(...match.rounds.map(({ids,result:r},i)=>{
   const row=el('div');row.className='duel';
   const who=r.winner<0?t('무승부','Tie'):name(ids[r.winner])+t(' 승리',' wins');
   row.append(el('strong',t((i+1)+'차전','Round '+(i+1))+' · '+ids.map(name).join(' vs ')),el('b',who));
   const explanation=Game.explain(r,ids.map(id=>by.get(id)),d,lang)[0];
   row.append(el('small',explanation));return row;
  }));window.scrollTo(0,0);
 }
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
   if(state.match)watch(state.match,state.side);
   else if(state.side===0){teams[0]=state.team;waitForFriend()}
   else if(state.available)renderSetup();
   else handleError({status:409});
  }catch(e){if(!handleError(e)){$('restart').href=location.href;$('restart').hidden=false;$('restart').textContent=t('다시 연결','Reconnect')}}
 }else renderSetup();
})().catch(()=>{document.getElementById('notice').textContent=Locale.t('도감을 열지 못했어. 새로고침해 줘.','Could not load the Pokédex. Please refresh.')});
