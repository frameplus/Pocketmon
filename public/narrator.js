'use strict';
function createNarrator(lang,onState){
  let context,source,utterance,timer,request,generation=0;
  const synth=window.speechSynthesis;
  function unlock(){
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!context&&Audio)context=new Audio();
      if(context&&context.state!=='running')context.resume().catch(()=>{});
    }catch{}
  }
  function stop(){
    generation++;clearTimeout(timer);request?.abort();request=null;
    if(source){source.onended=null;try{source.stop()}catch{}source=null}
    utterance=null;
    try{synth?.cancel()}catch{}
    onState('idle');
  }
  function speak(text){
    stop();const id=generation;
    const phrases=text.match(/[^.!?。！？]+[.!?。！？]*|[.!?。！？]+/g)?.map(s=>s.trim()).filter(Boolean)||[];
    if(!phrases.length)return;
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
        source.onended=()=>{if(id===generation){source=null;onState('idle')}};
        source.start();onState('playing');
      }catch{if(id===generation)onState('error')}
    }
    let voice;
    try{voice=synth?.getVoices().find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===lang)}catch{}
    function next(n){
      if(id!==generation)return;
      if(n===phrases.length){utterance=null;onState('idle');return}
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
  }
  try{synth?.getVoices()}catch{}
  return {speak,stop,unlock};
}
