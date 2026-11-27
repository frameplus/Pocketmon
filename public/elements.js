'use strict';

// The ambient effects belong to the fighters. The projectile layer separately uses the move's resolved type.
function createElementalStage(field,world){
 const stage=field.querySelector('.battle-camera')||field;
 const canvas=document.createElement('canvas');canvas.className='element-fx';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');stage.append(canvas);
 const ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const tau=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
 const palette=[null,['#fff9dd','#d3bf91'],['#ffc088','#d54c2b'],['#edffff','#59bedb'],['#e6b7ff','#9931bb'],['#ffcd83','#b26b3f'],['#f1d7a8','#8a6a52'],['#dcff74','#76ab40'],['#d4baff','#714ac4'],['#effdff','#879cb9'],['#ffdc55','#ef481e'],['#91f4ff','#2581dc'],['#b9f779','#419755'],['#fff7a5','#edb521'],['#ffd2f2','#cf5ac3'],['#e0ffff','#5bb6d9'],['#cfc0ff','#6355c8'],['#c3b8e3','#493a62'],['#ffe3f4','#e474b4']];
 let fighters=[],particles=[],action=null,rate=()=>1,clock=0,last=0,frame=0,landing=null;
 function line(points,ink,size){
  ctx.strokeStyle=ink;ctx.lineWidth=size;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 }
 function oval(x,y,rx,ry,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,tau);ctx.fill();
 }
 function shard(ink,wide,tall){
  ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(0,-tall);ctx.lineTo(wide,0);ctx.lineTo(0,tall);ctx.lineTo(-wide,0);ctx.closePath();ctx.fill();
 }
 function drop(ink){
  ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(.12,-1.45);ctx.bezierCurveTo(.18,-.60,.96,.03,.56,.72);
  ctx.bezierCurveTo(.13,1.45,-.99,.89,-.65,.1);ctx.quadraticCurveTo(-.46,-.50,.12,-1.45);ctx.fill();
 }
 function glyph(type){
  const [light,dark]=palette[type];
  switch(type){
   case 10: // A curved tongue of fire with a hot core.
    drop(dark);ctx.scale(.56,.72);ctx.translate(0,.25);drop(light);break;
   case 11:drop(dark);ctx.scale(.72,.75);drop(light);oval(-.22,-.12,.13,.27,'#fff');break;
   case 3: // Feather with a curving slipstream.
    ctx.strokeStyle=light;ctx.lineWidth=.23;ctx.beginPath();ctx.moveTo(-2.4,.35);ctx.quadraticCurveTo(-.2,-.45,1.4,-.05);ctx.stroke();
    ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-.95,.15);ctx.quadraticCurveTo(-.1,-1,1.35,-.2);ctx.quadraticCurveTo(.14,.5,-.95,.15);ctx.fill();break;
   case 13:{
    const path=[[-.92,-.62],[.15,-.31],[-.28,.08],[.96,.55]];
    line(path,dark,.45);line(path,light,.22);break;
   }
   case 12:case 7:
    ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-1,.5);ctx.quadraticCurveTo(-.85,-.9,1.1,-.65);ctx.quadraticCurveTo(.84,.72,-1,.5);ctx.fill();
    line([[-.82,.37],[.70,-.42]],light,.17);break;
   case 15:
    for(let i=0;i<3;i++){line([[0,-1],[0,1]],light,.24);line([[-.35,-.74],[0,-.45],[.35,-.74]],dark,.15);ctx.rotate(Math.PI/3)}break;
   case 4:case 14:
    ctx.strokeStyle=dark;ctx.lineWidth=.24;ctx.beginPath();ctx.ellipse(0,0,1,type===4?1:.48,0,0,tau);ctx.stroke();
    oval(-.34,-.38,.23,.20,light);break;
   case 8:case 17:
    ctx.fillStyle=dark;ctx.beginPath();ctx.arc(0,0,1,0,tau);ctx.arc(.42,-.18,.87,0,tau,true);ctx.fill('evenodd');break;
   case 5:case 6:case 9:case 16:
    shard(dark,.75,1.06);ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(0,-1.06);ctx.lineTo(.75,0);ctx.lineTo(-.16,.42);ctx.closePath();ctx.fill();break;
   case 2:line([[-1.5,.48],[1,-.5]],light,.36);line([[-.6,.68],[.9,.11]],dark,.26);break;
   default:shard(light,.35,1.1);shard(type===18?dark:light,1.05,.23);
  }
 }
 function random(f){
  f.seed=(Math.imul(f.seed,1664525)+1013904223)>>>0;return f.seed/4294967296;
 }
 function emit(f,type,x,y,r,unit,boost){
  const a=random(f)*tau,spread=.40+random(f)*.52;
  const water=type===11,fire=type===10,air=type===3;
  const px=x+Math.cos(a)*r*spread,py=y+((fire||water) ? .25 : Math.sin(a)*.56)*r;
  const speed=(boost?1.6:1)*unit;
  particles.push({type,x:px,y:py,vx:air?-f.dir*(29+random(f)*28)*speed:Math.cos(a)*(water?41:16)*speed,
   vy:air?-5*speed:-(water?40+random(f)*25:15+random(f)*21)*speed,gravity:water?105*speed:fire?-12*speed:4*speed,
   angle:air?-.15*f.dir:fire?Math.cos(a)*.3:random(f)*1.7,spin:(water||fire) ? .3 : random(f)*2-1,
   size:(fire?5.2:air?5:4.0)*(boost?1.25:1)*unit*(.70+random(f)*.66),life:.48+random(f)*.48,age:0});
 }
 function paintParticle(p){
  const q=p.age/p.life,alpha=clamp(q/.11)*clamp((1-q)/.35);
  ctx.save();ctx.globalAlpha=.94*alpha;ctx.translate(p.x,p.y);ctx.rotate(p.angle);
  const scale=p.size*(1-.35*q);ctx.scale(scale,scale);glyph(p.type);ctx.restore();
 }
 function wake(type,x,y,r,drive,unit,dir){
  if(type!==11&&type!==3&&type!==10)return;
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';
  if(type===11){
   for(let i=0;i<2;i++){
    const p=(clock*1.18+i*.5)%1,s=r*(.42+p*.83);
    ctx.globalAlpha=(1-p)*(.70+.22*drive);ctx.strokeStyle=i?'#e1ffff':'#49beef';ctx.lineWidth=unit*(2+drive);
    ctx.beginPath();ctx.ellipse(0,r*.63,s,s*.24,0,.12,Math.PI*1.96);ctx.stroke();
   }
   for(const side of [-1,1]){
    const phase=(clock*1.4+(side+1)*.19)%1;
    const reach=r*(.30+.25*drive),rise=r*(.16+.30*drive)*Math.sin(Math.PI*phase);
    ctx.save();ctx.translate(side*r*.55,r*.55);ctx.scale(side,1);
    ctx.globalAlpha=.75*Math.sin(Math.PI*phase);ctx.strokeStyle='#47bce7';ctx.lineWidth=unit*(2+2*drive);
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(reach*.65,-rise*1.8,reach,-rise);ctx.stroke();
    oval(reach+3*unit,-rise-4*unit,2.2*unit,3.1*unit,'#e1ffff');ctx.restore();
   }
  }else if(type===10){
   const glow=ctx.createRadialGradient(0,r*.46,0,0,r*.46,r*.95);
   glow.addColorStop(0,'#ffad383b');glow.addColorStop(1,'#ff661700');ctx.fillStyle=glow;ctx.fillRect(-r,-r,2*r,2.5*r);
   for(let i=0;i<3;i++){
    const flicker=.70+.3*Math.sin(clock*11+i*2),size=r*(.13+.10*drive)*flicker;
    ctx.save();ctx.translate(-dir*r*(.48+i*.13),r*(.35-i*.10));ctx.rotate(-dir*(.18+i*.18));ctx.scale(size,size*(1.2+i*.18));
    glyph(10);ctx.restore();
   }
  }else{
   for(let i=0;i<2;i++){
    const p=(clock*.96+i*.5)%1;ctx.globalAlpha=(1-p)*(.40+.32*drive);ctx.strokeStyle='#ddffff';ctx.lineWidth=unit*1.7;
    ctx.beginPath();ctx.ellipse(0,r*.38,r*(.62+p*.53),r*(.16+p*.12),-.12,p*tau,p*tau+Math.PI);ctx.stroke();
   }
  }
  ctx.restore();
 }
 function flight(f,drive,rect,envelope){
  const angle=clock*2.7+f.side*.9;
  const x=f.dir*envelope*(Math.sin(angle)*.055+drive*.095);
  const lift=envelope*(.082+.026*Math.cos(angle*1.7)+.026*Math.sin(Math.PI*drive)-.036*drive);
  const bank=envelope*f.dir*(.10*Math.cos(angle)+drive*.16);
  f.rig.style.transform='translate('+x*rect.width+'px,'+(-lift*rect.height)+'px) rotate('+bank+'rad)';
  world()?.setFlight(f.side,x,lift,-bank);
 }
 function stop(){
  cancelAnimationFrame(frame);frame=0;canvas.hidden=true;particles=[];action=null;landing=null;
  for(const f of fighters){f.rig.style.removeProperty('transform');world()?.setFlight(f.side,0,0,0)}
  fighters=[];
 }
 function tick(time){
  if(!fighters.length)return;
  if(last&&time-last<30){frame=requestAnimationFrame(tick);return}
  const dt=Math.min((time-(last||time))/1000,.09)*rate();last=time;clock+=dt;
  const envelope=clamp(clock/.5)*(landing===null?1:1-clamp((clock-landing)/.40));
  if(landing!==null&&!envelope){stop();return}
  const rect=stage.getBoundingClientRect(),width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height){stop();return}
  const dpr=Math.min(1.5,devicePixelRatio||1),w=Math.round(width*dpr),h=Math.round(height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;particles=[]}
  ctx.setTransform(w/width,0,0,h/height,0,0);ctx.clearRect(0,0,width,height);
  const unit=Math.min(width,height*1.4)/390,marks=field.dataset.world==='on'?world()?.anchors(true):null;
  for(const f of fighters){
   const drive=action?.i===f.side?Math.sin(Math.PI*clamp((action.t-.14)/.75)):0;
   if(f.flying)flight(f,drive,{width,height},envelope);
   let x,y;
   if(marks&&field.dataset['mesh'+f.side]){x=marks[f.side][0]*width;y=marks[f.side][1]*height}
   else{const b=f.img.getBoundingClientRect();x=(b.left+b.width*.5-rect.left)*width/rect.width;y=(b.top+b.height*.5-rect.top)*height/rect.height}
   const radius=(19+f.size*28)*unit;
   f.types.forEach((type,i)=>{
    wake(type,x,y,radius,drive,unit,f.dir);
    f.budget[i]+=dt*(7+drive*17)*(f.types.length===1?1:.76)*envelope;
    while(f.budget[i]>=1){f.budget[i]--;if(particles.length<90)emit(f,type,x,y,radius,unit,drive>.25)}
   });
  }
  for(const p of particles){p.age+=dt;if(p.age>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.angle+=p.spin*dt;paintParticle(p)}
  particles=particles.filter(p=>p.age<p.life);
  frame=requestAnimationFrame(tick);
 }
 function start(pair,getRate){
  stop();if(!ctx||reduce.matches)return;
  const sizes=Game.fieldSizes(pair);clock=last=0;rate=getRate;
  fighters=pair.map((p,side)=>{
   const rig=field.querySelector('#a'+side+' .flight-rig');
   return {side,dir:side?-1:1,size:sizes[side],types:p.types,flying:p.types.includes(3),seed:p.id+side*997,
    rig,img:rig.querySelector('img'),budget:p.types.map(()=>1)};
  });
  canvas.hidden=false;frame=requestAnimationFrame(tick);
 }
 reduce.addEventListener('change',e=>{if(e.matches)stop()});
 return {start,stop,move(pose){action=pose},land(){landing=clock}};
}
