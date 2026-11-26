'use strict';
// Spell out the mixed-script names in the Korean Pokédex only for speech.
const spokenNames={
  '니드런♀':'니드런 암컷','니드런♂':'니드런 수컷','폴리곤2':'폴리곤 투','폴리곤Z':'폴리곤 제트',
  '타입:널':'타입 널','메가리자몽X':'메가리자몽 엑스','메가리자몽Y':'메가리자몽 와이',
  '메가뮤츠X':'메가뮤츠 엑스','메가뮤츠Y':'메가뮤츠 와이','1000만볼트':'천만볼트',
  '10만볼트':'십만볼트','10만마력':'십만마력','HP회복':'체력 회복','텍스처2':'텍스처 투',
  'V제너레이트':'브이제너레이트','DD래리어트':'디디래리어트','G의힘':'지의 힘','3연화살':'삼연화살'
};
const spokenNamePattern=new RegExp(Object.keys(spokenNames).join('|'),'g');
function koreanNumber(digits){
  const units=['','십','백','천'],names='영일이삼사오육칠팔구';
  return Array.from(digits,(d,i)=>{
    const unit=units[digits.length-i-1];
    return d==='0'?'':(d==='1'&&unit?'':names[Number(d)])+unit;
  }).join('')||'영';
}
function koreanCount(digits){
  const n=Number(digits);
  if(!n||n>=100)return koreanNumber(digits);
  if(n===20)return '스무';
  return ['','열','스물','서른','마흔','쉰','예순','일흔','여든','아흔'][Math.floor(n/10)]
    +['','한','두','세','네','다섯','여섯','일곱','여덟','아홉'][n%10];
}
function narrationText(text,lang){
  if(lang!=='ko')return text;
  const hpWords={HP:'체력',HP가:'체력이',HP는:'체력은',HP를:'체력을',HP로:'체력으로'};
  return text.replace(spokenNamePattern,name=>spokenNames[name]).replace(/HP[가는를로]?/g,word=>hpWords[word]).replace(/·/g,', ')
    .replace(/(?<![\d.])([24])배/g,(_,n)=>n==='2'?'두 배':'네 배')
    .replace(/(?<!\d)(\d{1,4})\.(\d+)/g,(_,whole,fraction)=>koreanNumber(whole)+' 점 '+Array.from(fraction,koreanNumber).join(' '))
    .replace(/(?<!\d)(\d{1,4})\s*번/g,(_,digits)=>koreanCount(digits)+' 번')
    .replace(/(?<!\d)\d{1,4}(?!\d)/g,koreanNumber);
}
function createNarrator(lang,onState){
  let context,source,utterance,timer,request,finish,voiceListener,generation=0;
  const synth=window.speechSynthesis;
  let recordings;
  function selectVoice(){
    try{
      const voices=(synth?.getVoices()||[]).filter(v=>v.lang.toLowerCase().split(/[-_]/)[0]===lang);
      const locale=lang==='ko'?'ko-kr':'en-us';
      const regional=voices.filter(v=>v.lang.toLowerCase().replace('_','-')===locale);
      const candidates=regional.length?regional:voices;
      return candidates.find(v=>v.default)||candidates[0];
    }catch{}
  }
  function stopWaitingForVoice(){
    if(voiceListener)synth?.removeEventListener?.('voiceschanged',voiceListener);
    voiceListener=null;
  }
  let tone;
  function impactSound(type){
    if(context?.state!=='running'||tone)return;
    const notes={10:[210,80],11:[330,680],12:[420,310],13:[820,260],15:[910,590]};
    const [from,to]=notes[type]||[165,95],now=context.currentTime,length=.18;
    const voice=context.createOscillator(),volume=context.createGain();
    tone=voice;voice.type=type===13?'triangle':'sine';
    voice.frequency.setValueAtTime(from,now);voice.frequency.exponentialRampToValueAtTime(to,now+length);
    volume.gain.setValueAtTime(.0001,now);volume.gain.exponentialRampToValueAtTime(.10,now+.018);
    volume.gain.exponentialRampToValueAtTime(.0001,now+length);
    voice.connect(volume);volume.connect(context.destination);
    voice.onended=()=>{voice.disconnect();volume.disconnect();if(tone===voice)tone=null};
    voice.start(now);voice.stop(now+length+.01);
  }
  function victorySound(){
    if(context?.state!=='running'||tone)return;
    const voice=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    tone=voice;voice.type='triangle';
    [392,494,587,784].forEach((hz,i)=>{
      const at=now+i*.13;
      voice.frequency.setValueAtTime(hz,at);
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(.075,at+.018);
      gain.gain.exponentialRampToValueAtTime(.0001,at+(i===3 ? .35 : .12));
    });
    voice.connect(gain);gain.connect(context.destination);
    voice.onended=()=>{voice.disconnect();gain.disconnect();if(tone===voice)tone=null};
    voice.start(now);voice.stop(now+.76);
  }
  function unlock(){
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!context&&Audio)context=new Audio();
      if(context&&context.state!=='running')context.resume().catch(()=>{});
    }catch{}
  }
  function signal(state){
    onState(state);
    if(state==='idle'||state==='error'){finish?.();finish=null}
  }
  function stop(){
    if(tone){try{tone.stop()}catch{}tone=null}
    generation++;clearTimeout(timer);stopWaitingForVoice();request?.abort();request=null;
    if(source){source.onended=null;try{source.stop()}catch{}source=null}
    utterance=null;
    try{synth?.cancel()}catch{}
    signal('idle');
  }
  function speak(text,preferRecording=false){
    stop();const id=generation;
    const phrases=narrationText(text,lang).split(/(?<=[.!?。！？])\s+/u).map(s=>s.trim()).filter(Boolean);
    if(!phrases.length)return;
    const done=new Promise(resolve=>{finish=resolve});
    onState('loading');
    async function fallback(start,clip){
      clearTimeout(timer);
      if(id!==generation)return;
      utterance=null;try{synth?.cancel()}catch{}
      try{
        if(!context)throw Error('audio unavailable');
        request=new AbortController();
        const r=clip?await fetch('/voice/'+clip+'.wav',{signal:request.signal}):
          await fetch('/api/narration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang,text:phrases.slice(start).join(' ')}),signal:request.signal});
        if(!r.ok)throw Error('audio');
        const buffer=await context.decodeAudioData(await r.arrayBuffer());
        if(id!==generation)return;
        if(context.state!=='running')throw Error('gesture');
        source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
        source.onended=()=>{if(id===generation){source=null;signal('idle')}};
        source.start();onState('playing');
      }catch{if(id===generation){if(clip)next(start);else signal('error')}}
    }
    let voice=selectVoice();
    function next(n){
      if(id!==generation)return;
      if(n===phrases.length){utterance=null;signal('idle');return}
      if(!voice||!window.SpeechSynthesisUtterance){fallback(n);return}
      try{
        const u=new SpeechSynthesisUtterance(phrases[n]);utterance=u;
        u.lang=voice.lang;u.voice=voice;u.rate=.95;
        const current=()=>id===generation&&utterance===u;
        u.onstart=()=>{if(current()){clearTimeout(timer);onState('playing');timer=setTimeout(()=>{if(current())fallback(n)},Math.max(12000,phrases[n].length*500))}};
        u.onend=()=>{if(current()){clearTimeout(timer);next(n+1)}};
        u.onerror=()=>{if(current())fallback(n)};
        timer=setTimeout(()=>{if(current())fallback(n)},2200);synth.speak(u);
      }catch{fallback(n)}
    }
    function startSpeech(){
     if(id!==generation)return;
     if(!voice&&synth?.addEventListener&&window.SpeechSynthesisUtterance){
      // Some phones populate getVoices() asynchronously after the first tap.
      function resume(){
        if(id!==generation)return;
        clearTimeout(timer);stopWaitingForVoice();next(0);
      }
      voiceListener=()=>{voice=selectVoice();if(voice)resume()};
      synth.addEventListener('voiceschanged',voiceListener);
      timer=setTimeout(()=>{voice=selectVoice();resume()},700);
      voiceListener();
     }else next(0);
    }
    if(preferRecording&&lang==='ko'){
      recordings??=fetch('/voice/lines.json',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok?r.json():{}).catch(()=>({}));
      recordings.then(lines=>{
        if(id!==generation)return;
        const line=phrases.join(' '),clip=Object.keys(lines).find(key=>lines[key]===line);
        if(clip)fallback(0,clip);else startSpeech();
      });
    }else startSpeech();
    return done;
  }
  try{synth?.getVoices()}catch{}
  return {speak,stop,unlock,impactSound,victorySound};
}
