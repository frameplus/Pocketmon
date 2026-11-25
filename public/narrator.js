'use strict';
function createNarrator(lang,onState){
  let context,source,utterance,timer,request,finish,generation=0;
  const synth=window.speechSynthesis;
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
    generation++;clearTimeout(timer);request?.abort();request=null;
    if(source){source.onended=null;try{source.stop()}catch{}source=null}
    utterance=null;
    try{synth?.cancel()}catch{}
    signal('idle');
  }
  function speak(text){
    stop();const id=generation;
    const phrases=text.match(/[^.!?。！？]+[.!?。！？]*|[.!?。！？]+/g)?.map(s=>s.trim()).filter(Boolean)||[];
    if(!phrases.length)return;
    const done=new Promise(resolve=>{finish=resolve});
    onState('loading');
    async function fallback(start){
      clearTimeout(timer);
      if(id!==generation)return;
      utterance=null;try{synth?.cancel()}catch{}
      try{
        if(!context)throw Error('audio unavailable');
        request=new AbortController();
        const r=await fetch('/api/narration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang,text:phrases.slice(start).join(' ')}),signal:request.signal});
        if(!r.ok)throw Error('audio');
        const buffer=await context.decodeAudioData(await r.arrayBuffer());
        if(id!==generation)return;
        if(context.state!=='running')throw Error('gesture');
        source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
        source.onended=()=>{if(id===generation){source=null;signal('idle')}};
        source.start();onState('playing');
      }catch{if(id===generation)signal('error')}
    }
    let voice;
    try{voice=synth?.getVoices().find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===lang)}catch{}
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
    next(0);
    return done;
  }
  try{synth?.getVoices()}catch{}
  return {speak,stop,unlock,impactSound};
}
