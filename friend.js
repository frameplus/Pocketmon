const G=require('./public/game.js');
module.exports=function makeFriend(d,forecast){
 const idx=G.index(d),by=new Map(d.pokemon.map(p=>[p.id,p]));
 const rules=[['counter',/보다.*(강|세|쎄)|천적|이길.*(상대|친구)/],['moves',/기술|필살기/],['speed',/스피드|빠르|빨라/],['type',/속성|타입|약점/],['random',/랜덤|다른.*(보여|골라|포켓몬)/],['battle',/시작|다시.*(싸|배틀|대결)|붙여|싸워\s*(봐|줘)|누가.*(이|강|세)|싸우면|대결하면/],['strength',/왜.*(강|세|쎄)|특징|소개/],['greet',/^(안녕|반가워|고마워)[!. ]*$/]];
 const englishRules=[['counter',/who can (?:beat|defeat)|stronger than|counter to/i],['moves',/\bmoves?\b|attacks? (?:does|can)/i],['speed',/fast|speed|quicker/i],['type',/type|weakness|weak to/i],['random',/random|another pok[eé]mon|different pok[eé]mon/i],['battle',/battle|fight|rematch|who (?:wins|would win)|versus|\bvs\b/i],['strength',/strong|special about|tell me about/i],['greet',/^(hi|hello|thanks|thank you)[! .]*$/i]];
 const intents=['counter','moves','speed','type','random','battle','strength','select','greet','other'];
 async function interpret(text,previous){
   const response=await fetch('http://127.0.0.1:8089/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'Classify the Korean or English Pokémon conversation in context. counter=승리할 상대, moves=기술, speed=빠르기, type=속성, random=새로운 두 카드, battle=둘을 겨루기, strength=특징/강한 이유, select=카드 선택, greet=인사, other=포켓몬과 무관. Output one English label only.'},{role:'user',content:`직전 주제 ${previous}\n${text}`}],grammar:'root ::= '+intents.map(x=>JSON.stringify(x)).join(' | '),temperature:0,max_tokens:12}),signal:AbortSignal.timeout(14000)});
   if(!response.ok)throw Error();return (await response.json()).choices[0].message.content.trim()
 }
 return async function answer(input,enabled){
   const en=input.lang==='en',text=input.text,pair=input.pair.map(id=>by.get(id));if(!pair.every(Boolean))throw Error('bad pair');
   let named=G.heard(idx,text);
   // Resolve imperfect names on each side of the spoken match as well as ASR alternatives.
   const parts=text.split(/(?:\s+대\s+|이랑|랑|하고|와\s+|과\s+)/).slice(0,2);
   if(parts.length===2){const sides=parts.map(part=>G.heard(idx,part)[0]||G.similar(idx,part.trim().split(/\s/)[0].replace(/(이|가|는|은)$/,'')));if(sides.every(Boolean))named=sides}
   if(!named.length){const word=text.trim().split(/\s/)[0].replace(/(보다|이랑|는|은|가)$/,'');if(word.length>1&&!/^(다시|다른|누가|그럼|그건|얘는|어떤|어떻게|안녕)/.test(word)){const p=G.similar(idx,word);if(p)named=[p]}}
   const p=named[0]||by.get(input.focus)||pair[0],op=named[1]||pair.find(q=>q.id!==p.id)||pair[1];
   let kind=(en?englishRules:rules).find(([,re])=>re.test(text))?.[0],model=false;
   if(!kind&&named.length>1)kind='battle';
   if(!kind&&named.length&&[p.name,p.en].some(n=>G.norm(n)===G.norm(text)))kind='select';
   if(!kind&&enabled){try{kind=await interpret(text,input.lastIntent||'없음');model=true}catch{}}
   if(!intents.includes(kind))kind=named.length?'select':'other';
   const out={focus:p.id,intent:kind,model,action:null},best=p.battleStats.indexOf(Math.max(...p.battleStats)),move=d.moves[p.moves[0]];
   switch(kind){
     case 'counter':{const scores=[];for(const id of [6,9,94,130,150,248,282,384,445,483,635,717,888]){if(id!==p.id)scores.push([by.get(id),(await forecast([id,p.id],100)).wins[0]])}scores.sort((a,b)=>b[1]-a[1]);let [q,n]=scores[0];out.reply=en?`Try ${q.en}! It won ${n} out of 100 practice battles against ${p.en}. Want to try them together?`:`비교한 친구 중에는 ${q.name}이 있어! ${p.name}와 100번 연습 대결해서 ${n}번 이겼어. 둘을 붙여 볼까?`;out.suggest=[q.id,p.id];break}
     case 'moves':out.reply=`${p.name}의 기술을 알려 줄게! ${p.moves.map(i=>d.moves[i].name).join(', ')}. 첫 번째는 ${G.types[move.type]} 기술이야.`;break;
     case 'type':{let weak=G.types.filter((v,t)=>t&&G.effect(t,p,d)>1);out.reply=`${p.name}의 속성은 ${p.types.map(t=>G.types[t]).join('·')}야. ${weak.length?weak.join(', ')+' 기술에 약해.':'약점이 적은 친구야!'}`;break}
     case 'speed':out.reply=`${p.name}의 레벨 50 스피드는 ${p.battleStats[5]}, ${op.name}의 스피드는 ${op.battleStats[5]}야. 같은 우선도의 기술이면 ${p.battleStats[5]===op.battleStats[5]?'추첨해서 먼저 움직여.':(p.battleStats[5]>op.battleStats[5]?p:op).name+'이 먼저 움직여!'}`;break;
     case 'battle':out.action={kind:'battle',ids:named.length?[p.id,op.id]:input.pair};out.reply=out.action.ids.map(id=>by.get(id).name).join(' 대 ')+'! 배틀 필드로 가자!';break;
     case 'random':out.action={kind:'random'};out.reply='새 친구 두 명을 골랐어! 카드에서 만나 봐.';break;
     case 'select':out.action={kind:'select',id:p.id};out.reply=p.name+' 카드를 골랐어!';break;
     case 'greet':out.reply='반가워! 오늘은 어떤 포켓몬과 놀아 볼까?';break;
     case 'other':out.reply='나는 포켓몬 이야기를 좋아해! 어떤 친구가 궁금해?';break;
     default:out.reply=`${p.name} 카드에서 가장 높은 능력치는 ${G.statNames[best]}! 수치는 ${p.battleStats[best]}. ${move.name} 같은 기술도 쓸 수 있어. 누구랑 만나 볼까?`
   }
   if(en){
     switch(kind){
       case 'counter':break;
       case 'moves':out.reply=`${p.en} knows ${p.moves.map(id=>d.moves[id].en).join(', ')}. ${move.en} is a ${G.englishTypes[move.type]} move!`;break;
       case 'type':{const weak=G.englishTypes.filter((v,i)=>i&&G.effect(i,p,d)>1);out.reply=`${p.en} is ${p.types.map(i=>G.englishTypes[i]).join(' / ')} type. ${weak.length?'Watch out for '+weak.join(', ')+' moves!':'It has no type weaknesses here!'}`;break}
       case 'speed':out.reply=`${p.en} has ${p.battleStats[5]} Speed at level 50, and ${op.en} has ${op.battleStats[5]}. With equal move priority, ${p.battleStats[5]===op.battleStats[5]?'either can move first':(p.battleStats[5]>op.battleStats[5]?p:op).en+' moves first'}.`;break;
       case 'battle':out.reply=out.action.ids.map(id=>by.get(id).en).join(' vs. ')+'! Let’s battle!';break;
       case 'random':out.reply='I picked two new friends. Take a look!';break;
       case 'select':out.reply=`You picked ${p.en}!`;break;
       case 'greet':out.reply='Hi! Which Pokémon would you like to play with?';break;
       case 'other':out.reply='I love talking about Pokémon! Which one are you curious about?';break;
       default:out.reply=`${p.en}’s highest stat is ${G.englishStats[best]} at ${p.battleStats[best]}. It can use ${move.en}. Who should we match it with?`
     }
   }
   if(model&&!out.action&&['strength','moves','speed','type'].includes(kind)){
     try{
       const res=await fetch('http://127.0.0.1:8089/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:en?'You are a friendly Pokémon buddy for a six-year-old. Use only the provided facts. Reply in simple English, one or two sentences. Never ask for personal details.':'여섯 살 어린이의 포켓몬 친구야. 주어진 도감 사실만 써서 사용자 질문에 맞게 짧고 다정하게 한국어로 답해. 숫자나 기술을 지어내지 마. 개인정보나 외부 연락을 묻지 마.'},{role:'user',content:'질문 '+text+'\\n도감 사실 '+out.reply}],temperature:.25,max_tokens:80}),signal:AbortSignal.timeout(15000)});
       const sentence=(await res.json()).choices?.[0]?.message?.content?.trim();
       const numbers=sentence?.match(/\d+/g)||[];
       if(sentence&&sentence.length<=200&&sentence.includes(en?p.en:p.name)&&(en?!/[가-힣]/.test(sentence):/[가-힣]/.test(sentence))&&numbers.every(n=>out.reply.includes(n))&&!/(https?:|전화|주소|사진을 보내|비밀번호|죽|피투성이)/.test(sentence))out.reply=sentence
     }catch{}
   }return out
 }
}
