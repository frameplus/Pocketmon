'use strict';
const {Worker,isMainThread,parentPort}=require('node:worker_threads');
if(!isMainThread){
  const sim=require('./simulator.js').makeSimulator(require('./public/dex.json'));
  parentPort.on('message',({ids,count})=>{
    try{parentPort.postMessage({value:sim.forecast(ids,count)})}catch{parentPort.postMessage({error:true})}
  });
}
function createForecasts(){
  let worker=null,active=null;
  const queue=[],pending=new Map(),cache=new Map();
  function advance(){
    if(active||!queue.length)return;
    active=queue.shift();
    if(!worker){
      worker=new Worker(__filename);
      worker.on('message',({value,error})=>{
        const job=active;active=null;pending.delete(job.key);
        if(error)job.reject(Error('Forecast failed'));
        else{if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(job.key,value);job.resolve(value)}
        advance();
      });
      worker.on('error',()=>{});
      worker.on('exit',()=>{
        worker=null;
        if(active){pending.delete(active.key);active.reject(Error('Forecast interrupted'));active=null}
        advance();
      });
    }
    worker.postMessage({ids:active.ids,count:active.count});
  }
  return function forecast(ids,count){
    const key=ids.join('/')+'/'+count;
    if(cache.has(key))return Promise.resolve(cache.get(key));
    if(pending.has(key))return pending.get(key);
    if(queue.length>=12)return Promise.reject(Error('Forecast queue is full'));
    const promise=new Promise((resolve,reject)=>queue.push({key,ids,count,resolve,reject}));
    pending.set(key,promise);advance();return promise;
  };
}
module.exports={createForecasts};
