'use strict';
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');

function openTeamBattles(file,by,simulator){
  const db=new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, owner TEXT NOT NULL, guest TEXT, team TEXT NOT NULL, result TEXT, expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS room_expiry ON rooms(expires)');
  const read=db.prepare('SELECT * FROM rooms WHERE id=? AND expires>?');
  const get=id=>read.get(id,Date.now());
  const valid=team=>Array.isArray(team)&&team.length===3&&team.every(id=>by.has(id))&&new Set(team.map(id=>by.get(id).dex)).size===3;
  function play(teams){
    const score=[0,0];
    const rounds=teams[0].map((id,i)=>{
      const ids=[id,teams[1][i]],result=simulator.simulate(ids);
      if(result.winner>=0)score[result.winner]++;
      return {ids,result};
    });
    return {rounds,score,winner:score[0]===score[1]?-1:Number(score[1]>score[0])};
  }
  function snapshot(room,token){
    const side=token===room.owner?0:token===room.guest?1:-1;
    if(side<0)return {available:!room.guest};
    return {side,team:JSON.parse(room.team),match:room.result?JSON.parse(room.result):null};
  }
  return async function route(req,res,p,send){
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'origin'});
    const solo=p==='/api/team-battle';
    const id=p.match(/^\/api\/team-rooms\/([a-f0-9-]{36})$/)?.[1];
    if(!solo&&!id)return send(404,{error:'room'});
    const raw=req.headers.authorization?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
    if(!solo&&!raw)return send(401,{error:'token'});
    const token=raw&&createHash('sha256').update(raw).digest('hex');
    if(!solo&&req.method==='GET'){
      const room=get(id);
      return room?send(200,snapshot(room,token)):send(404,{error:'expired'});
    }
    if(req.method!=='POST')return send(405,{error:'method'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'json'});
    const parts=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,{error:'size'});parts.push(chunk)}
    let body;try{body=JSON.parse(Buffer.concat(parts))}catch{return send(400,{error:'json'})}
    if(!valid(body?.team))return send(400,{error:'team'});
    if(solo)return valid(body.opponent)?send(200,play([body.team,body.opponent])):send(400,{error:'team'});
    if(!['create','join'].includes(body.action))return send(400,{error:'action'});
    db.exec('BEGIN IMMEDIATE');
    try{
      let room=get(id),status=200,error;
      if(body.action==='create'){
        db.prepare('DELETE FROM rooms WHERE expires<=?').run(Date.now());
        if(room&&room.owner!==token){status=409;error='occupied'}
        else if(!room){
          if(db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n>=1000){status=429;error='busy'}
          else db.prepare('INSERT INTO rooms(id,owner,team,expires) VALUES(?,?,?,?)').run(id,token,JSON.stringify(body.team),Date.now()+2*3600000);
        }
      }else if(!room){status=404;error='expired'}
      else if(room.owner===token||room.guest&&room.guest!==token){status=409;error='occupied'}
      else if(!room.guest){
        const match=play([JSON.parse(room.team),body.team]);
        db.prepare('UPDATE rooms SET guest=?,result=? WHERE id=?').run(token,JSON.stringify(match),id);
      }
      room=get(id);
      db.exec('COMMIT');
      return send(status,error?{error}:snapshot(room,token));
    }catch(err){db.exec('ROLLBACK');throw err}
  };
}
module.exports={openTeamBattles};
