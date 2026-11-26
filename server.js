const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const pub=path.join(__dirname,'public'),d=JSON.parse(fs.readFileSync(path.join(pub,'dex.json'))),by=new Map(d.pokemon.map(p=>[p.id,p]));
const simulator=require('./simulator.js').makeSimulator(d),forecast=require('./forecasts.js').createForecasts();
const answer=require('./friend.js')(d,forecast);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.gif':'image/gif','.wasm':'application/wasm','.glb':'model/gltf-binary','.woff2':'font/woff2','.json':'application/json; charset=utf-8'};
const visitDir=process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.RAILWAY_ENVIRONMENT_ID?'/data':require('node:os').tmpdir());
fs.mkdirSync(visitDir,{recursive:true});
const visitors=require('./visitors.js').openCounter(path.join(visitDir,'pocketmon-visits.sqlite'));
let model=null,active=0;
if(process.env.FRIEND_BINARY&&process.env.FRIEND_MODEL){
 model=spawn(process.env.FRIEND_BINARY,['-m',process.env.FRIEND_MODEL,'--host','127.0.0.1','--port','8089','-c','1024','-t','2','-np','1','--log-disable'],{stdio:'ignore'});
 model.on('error',()=>{model=null});model.on('exit',()=>{model=null})
}
const server=http.createServer(async(req,res)=>{
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/api/narration')return await require('./narration.js')(req,res);
  const match=/^\/api\/(forecast|battle)\/(\d+)\/(\d+)$/.exec(p);
  if(match){
   const ids=match.slice(2).map(Number);
   if(req.method!==(match[1]==='battle'?'POST':'GET'))return send(405,{error:'method'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'origin'});
   if(!ids.every(id=>by.has(id)))return send(404,{error:'unknown species'});
   try{return send(200,match[1]==='battle'?simulator.simulate(ids):await forecast(ids,400))}
   catch{return send(503,{error:'Battle temporarily unavailable'})}
  }
  if(p==='/api/visitors'){
   if(req.method==='GET')return send(200,visitors.snapshot());
   if(req.method!=='POST')return send(405,{error:'method'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'origin'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'json required'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>200)return send(413,{error:'invalid length'})}
   let visit;try{visit=JSON.parse(raw)}catch{return send(400,{error:'invalid json'})}
   if(typeof visit?.token!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(visit.token)||typeof visit.day!=='string')return send(400,{error:'invalid visit'});
   return send(200,visitors.snapshot(visit));
  }
  if(req.method==='POST'&&p==='/api/friend'){
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'origin'});
   if(active>=4)return send(429,{error:'잠시 뒤에 다시 말해 줘.'});
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'too long'});chunks.push(chunk)}
   let input;try{input=JSON.parse(Buffer.concat(chunks))}catch{return send(400,{error:'invalid'})}
   if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>250||!Array.isArray(input.pair)||input.pair.length!==2||!input.pair.every(i=>by.has(i)))return send(400,{error:'invalid question'});
   active++;try{return send(200,await answer({lang:input.lang==="en"?"en":"ko",text:input.text,pair:input.pair,focus:Number(input.focus),lastIntent:String(input.lastIntent||'').slice(0,18)},Boolean(model)))}finally{active--}
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'method'});
  if(p==='/health')return send(200,{version:2,release:process.env.RAILWAY_GIT_COMMIT_SHA||null,species:1025,mega:by.size-1025});
  if(p==='/names')return send(200,d.pokemon.filter(x=>x.id===x.dex).map(x=>[x.id,x.name]));
  if(/^\/type\/\d+$/.test(p)){const m=by.get(Number(p.split('/').pop())),types=['','normal','fighting','flying','poison','ground','rock','bug','ghost','steel','fire','water','grass','electric','psychic','ice','dragon','dark','fairy'];return m?send(200,{types:m.types.map(t=>types[t]),stats:Object.fromEntries(['hp','attack','defense','special-attack','special-defense','speed'].map((s,i)=>[s,m.stats[i]])),moves:m.moves.map(i=>d.moves[i].name)}):send(404,{error:'unknown'})}
  const modelRoute=/^\/models\/(\d+)\.glb$/.exec(p);
  let modelFile;
  if(modelRoute){try{modelFile=await require('./models').locate(Number(modelRoute[1]))}catch{return send(503,{error:'model unavailable'})}
   if(!modelFile)return send(404,{error:'no model for this form'});
  }
  const art=p.match(/^\/art\/(\d+)$/),index=p==='/'||p==='/index.html',file=modelFile||(index?path.join(__dirname,'index.html'):path.join(pub,art?'art/'+Number(art[1])+'.png':p.slice(1)));
  if(!modelFile&&!index&&!file.startsWith(pub+path.sep))return send(404,{error:'unknown'});
  const stat=await fs.promises.stat(file);if(!stat.isFile())return send(404,{error:'unknown'});
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Content-Length':stat.size,'Cache-Control':modelRoute||art||p.startsWith('/fighters/')||p.startsWith('/thumbs/')?'public,max-age=604800':'no-cache','X-Content-Type-Options':'nosniff','Permissions-Policy':'camera=(), microphone=(self)'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res)
 }catch{if(!res.headersSent)send(404,{error:'unavailable'});else res.destroy()}
});
server.listen(process.env.PORT||3000,'0.0.0.0');process.on('SIGTERM',()=>{model?.kill();server.close(()=>process.exit())});
