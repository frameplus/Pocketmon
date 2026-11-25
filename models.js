'use strict';
const {modelPath,revision}=require('./model-index');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises'),{createWriteStream}=require('node:fs');
const cache=path.join(os.tmpdir(),'pocketmon-models-'+revision);
const pending=new Map();
async function prune(){
 const files=await fs.readdir(cache);
 const entries=(await Promise.all(files.filter(f=>f.endsWith('.glb')).map(async file=>{
  const p=path.join(cache,file),s=await fs.stat(p).catch(()=>null);return s&&{p,age:s.mtimeMs,bytes:s.size};
 }))).filter(Boolean).sort((a,b)=>a.age-b.age);
 let size=entries.reduce((n,f)=>n+f.bytes,0);
 for(const f of entries){if(size<=320*1024*1024)break;await fs.unlink(f.p).catch(()=>{});size-=f.bytes}
}
async function locate(id){
 const relative=modelPath(id);if(!relative)return;
 const bundled=path.join(__dirname,'public/models',id+'.glb');
 if(await fs.stat(bundled).catch(()=>null))return bundled;
 const target=path.join(cache,id+'.glb');
 if(await fs.stat(target).catch(()=>null)){const now=new Date();await fs.utimes(target,now,now).catch(()=>{});return target}
 if(pending.has(id))return pending.get(id);
 if(pending.size>=8)throw Error('busy');
 const job=(async()=>{
  await fs.mkdir(cache,{recursive:true});const tmp=target+'.part';
  try{
   const r=await fetch('https://raw.githubusercontent.com/Pokemon-3D-api/assets/'+revision+'/models/opt/'+relative,{signal:AbortSignal.timeout(20000)});
   if(!r.ok||!r.body)throw Error('asset unavailable');
   await pipeline(Readable.fromWeb(r.body),createWriteStream(tmp));
   const fd=await fs.open(tmp);try{const header=Buffer.alloc(12);await fd.read(header,0,12,0);if(header.toString('ascii',0,4)!=='glTF'||header.readUInt32LE(8)!==(await fd.stat()).size)throw Error('invalid model')}finally{await fd.close()}
   await fs.rename(tmp,target);await prune();return target;
  }finally{await fs.unlink(tmp).catch(()=>{})}
 })();
 pending.set(id,job);try{return await job}finally{pending.delete(id)}
}
module.exports={locate};
