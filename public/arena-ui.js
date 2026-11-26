'use strict';

const ArenaUI = (() => {
 const {t,stats,types}=Locale;
 const backgrounds=[
  ['stadium',t('스타디움','Stadium'),t('관중석과 잔디 필드','Grandstands and a grass pitch')],
  ['beach',t('해변','Beach'),t('바다와 모래 필드','Ocean and sand')],
  ['snow',t('설원','Snowfield'),t('밤하늘과 얼음 필드','Night sky and ice')]
 ];
 function setGround(value){
  document.body.dataset.ground=backgrounds.some(([id])=>id===value)?value:'stadium';
 }
 function backgroundPicker(parent,pair,save){
  const fieldset=document.createElement('fieldset');
  fieldset.className='grounds';
  fieldset.innerHTML='<legend>'+t('전투 배경','Battle background')+'</legend>'+backgrounds.map(([id,name,info])=>
   `<label data-ground="${id}"><span class="ground-thumb"><i class="horizon"></i><i class="pitch"></i></span><span><b>${name}</b><small>${info}</small></span><input type="radio" name="ground" value="${id}" ${document.body.dataset.ground===id?'checked':''}></label>`).join('');
  const preview=document.createElement('div');
  preview.className='ground-preview';preview.setAttribute('aria-hidden','true');
  preview.innerHTML='<i class="horizon"></i><i class="pitch"></i><i class="pad near"></i><i class="pad far"></i>'+pair.map(p=>`<img src="/art/${p.id}" alt="">`).join('');
  fieldset.querySelector('legend').after(preview);
  fieldset.onchange=e=>{setGround(e.target.value);save(document.body.dataset.ground)};
  parent.prepend(fieldset);
 }
 function comparison(pair,d,esc){
  const ceiling=Math.max(160,...pair.flatMap(p=>p.battleStats));
  const totals=pair.map(p=>p.battleStats.reduce((a,b)=>a+b,0));
  const rows=stats.map((name,k)=>{
   const [a,b]=pair.map(p=>p.battleStats[k]);
   return `<div class="compare-row"><b>${a}</b><i><s style="width:${100*a/ceiling}%"></s></i><span>${name}</span><i><s style="width:${100*b/ceiling}%"></s></i><b>${b}</b></div>`;
  }).join('');
  const moves=pair.map((p,i)=>`<section class="move-team"><h3>${esc(p.name)}</h3>${p.moves.map(id=>{
   const m=d.moves[id],factor=Game.effect(m.type,pair[1-i],d);
   const power=m.power||t('변동','Var.');
   return `<div class="match-move"><i style="--element:${Game.colors[m.type]}">${Game.icons[m.type]}</i><span><b>${esc(m.name)}</b><small>${types[m.type]} · ${m.category===1?t('변화','Status'):t('위력 ','Power ')+power}</small></span><strong class="${m.category!==1&&factor>1?'strong':''}">${m.category===1?'—':'×'+factor}</strong></div>`;
  }).join('')}</section>`).join('');
  return `<div class="sheet-heading"><h2>${t('능력치 비교','Stat comparison')}</h2><small>${t('총합','Totals')} <b>${totals[0]}</b> : <b>${totals[1]}</b></small></div>${rows}<div class="sheet-heading move-heading"><h2>${t('기술 상성','Move matchups')}</h2><small>${t('상대에게 주는 효과','Against the opponent')}</small></div><div class="move-teams">${moves}</div>`;
 }
 function recordSummary(records){
  const wins=records.filter(r=>r.w===0).length,losses=records.filter(r=>r.w===1).length;
  return [[t('승리','Wins'),wins],[t('패배','Losses'),losses],[t('승률','Win rate'),(records.length?Math.round(wins*100/records.length):0)+'%']].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
 }
 function progress(round,finished=false){
  const turns=document.getElementById('turns'),start=Math.max(1,round-1);
  turns.innerHTML=[t('등장','Entry'),...Array.from({length:3},(_,i)=>t((start+i)+'턴','Turn '+(start+i))),t('결과','Result')].map((label,i)=>{
   const selected=finished?i===4:round===0?i===0:i===1+round-start;
   return `<li${selected?' aria-current="step"':''}>${label}</li>`;
  }).join('');
 }
 function journal(text){
  const li=document.createElement('li');li.textContent=text;
  document.getElementById('battleJournal').prepend(li);
 }
 return {setGround,backgroundPicker,comparison,recordSummary,progress,journal};
})();
