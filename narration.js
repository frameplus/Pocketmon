'use strict';
const {spawn}=require('node:child_process');
let active=0;

async function narration(req,res){
  function fail(code){res.writeHead(code,{'Cache-Control':'no-store'});res.end()}
  if(req.method!=='POST')return fail(405);
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return fail(403);
  if(!req.headers['content-type']?.startsWith('application/json'))return fail(415);
  const input=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>5000)return fail(413);input.push(chunk)}
  let body;try{body=JSON.parse(Buffer.concat(input))}catch{return fail(400)}
  if(!['ko','en'].includes(body?.lang)||typeof body?.text!=='string'||!body.text.trim()||body.text.length>1000)return fail(400);
  if(active>=4)return fail(429);
  active++;
  try{
    const pcm=await new Promise((resolve,reject)=>{
      const proc=spawn('espeak-ng',['--stdin','--stdout','-b','1','-v',body.lang==='ko'?'ko':'en-us','-s','150'],{timeout:8000,stdio:['pipe','pipe','ignore']});
      const pieces=[];let length=0;
      proc.stdout.on('data',chunk=>{length+=chunk.length;if(length>10_000_000)proc.kill();else pieces.push(chunk)});
      proc.once('error',reject);proc.stdin.on('error',()=>{});
      proc.once('close',code=>code===0?resolve(Buffer.concat(pieces)):reject(Error('voice unavailable')));
      proc.stdin.end(body.text);
    });
    // eSpeak emits an open-ended WAV header on stdout. Supply the actual length for mobile decoders.
    if(pcm.length<=44||pcm.toString('ascii',0,4)!=='RIFF'||pcm.toString('ascii',36,40)!=='data')return fail(503);
    pcm.writeUInt32LE(pcm.length-8,4);pcm.writeUInt32LE(pcm.length-44,40);
    res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':pcm.length,'Cache-Control':'no-store'});
    res.end(pcm);
  }catch{fail(503)}finally{active--}
}
module.exports=narration;
