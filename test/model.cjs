const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3200'},stdio:'inherit'});
 try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch('http://127.0.0.1:8089/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
  assert.ok(ready,'Local model must become ready');
  const r=await fetch('http://127.0.0.1:3200/api/friend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'이 친구를 한 문장으로 설명해 줄래?',lastIntent:'strength',focus:25,pair:[25,7]})});
  const reply=await r.json();assert.equal(reply.model,true);assert.match(reply.reply,/[가-힣]/);console.log('PASS local Korean dialogue',reply.intent,reply.reply)
 }finally{server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});