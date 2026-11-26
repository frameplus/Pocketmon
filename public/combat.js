'use strict';

// Draw in field coordinates so a technique travels between the same two marks on any screen.
function createCombat(field,world){
 const canvas=field.querySelector('.technique-fx'),ctx=canvas.getContext('2d');
 const label=field.querySelector('.move-call'),points=field.querySelector('.hit-points');
 const radiant={3:'air',10:'flame',11:'water',13:'lightning',12:'leaves',15:'ice',14:'pulse',16:'pulse',8:'pulse',18:'pulse'};
 const contact={33:'rush',98:'rush',231:'tail',163:'slash',337:'slash',404:'slash',421:'slash',348:'slash',400:'slash'};
 const cutin=document.createElement('div');
 cutin.className='special-cutin';cutin.hidden=true;
 cutin.innerHTML='<img alt=""><div><small></small><strong></strong></div>';
 field.append(cutin);
 let active=null;
 const clamp=x=>Math.max(0,Math.min(1,x));
 function clear(){
  active?.();active=null;label.hidden=true;points.hidden=true;canvas.hidden=true;cutin.hidden=true;
  delete field.dataset.technique;delete field.dataset.phase;delete field.dataset.finisher;
 }
 function play(e,m,{attacker,typeName,impact,rate}){
  clear();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connects=e.damage>0,deflected=e.effect==='immune',miss=e.effect==='miss';
  const type=e.matchup?.type||m.type,color=Game.colors[type];
  const style=e.effect==='prepare'||m.category===1||e.effect==='fail'?'focus':
    contact[e.move]||(m.category===2?'rush':radiant[type]||'bolt');
  const fieldRect=field.getBoundingClientRect(),width=900,height=width*fieldRect.height/fieldRect.width;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(fieldRect.width*dpr);canvas.height=Math.round(fieldRect.height*dpr);
  const imgs=[e.i,e.j].map(i=>document.querySelector('#a'+i+' img'));
  const anchors=field.dataset.world==='on'?world()?.anchors():null;
  const [src,dest]=[e.i,e.j].map((side,k)=>{
   if(anchors&&field.dataset['mesh'+side])return [anchors[side][0]*width,anchors[side][1]*height];
   const box=imgs[k].getBoundingClientRect();
   return [(box.left+box.width*.5-fieldRect.left)*width/fieldRect.width,
    (box.bottom-box.height*.5-fieldRect.top)*height/fieldRect.height];
  });
  if(miss){dest[0]+=e.i?-65:65;dest[1]-=height*.14}
  const dx=dest[0]-src[0],dy=dest[1]-src[1],dist=Math.hypot(dx,dy);
  const special=Boolean(e.finisher&&connects),direction=Math.sign(dx),motion=[];
  const travel=['rush','slash','tail'].includes(style)&&!deflected;
  const duration=reduced?460:travel?900:1040;
  const intro=special&&!reduced?540:0,hold=special&&!reduced?95:0;
  const arrival=.53;
  field.dataset.technique=style;field.dataset.phase='windup';canvas.hidden=false;
  label.textContent=m.name;label.dataset.side=e.i;label.style.setProperty('--element',color);label.hidden=false;
  label.dataset.caption=(special?Locale.t('필살기 · ','SPECIAL · '):'')+typeName;
  if(special){
   field.dataset.finisher='true';
   if(!reduced){
    cutin.querySelector('img').src='/art/'+attacker.id;
    cutin.querySelector('small').textContent=Locale.t('필살기','SPECIAL')+' / '+attacker.name;
    cutin.querySelector('strong').textContent=m.name;
    cutin.style.setProperty('--element',color);cutin.hidden=false;
   }
  }
  label.title=typeName;
  function animate(el,keyframes,options,start=0){
   if(!reduced){
    const anim=el.animate(keyframes,{fill:'both',...options});
    anim.pause();anim.currentTime=0;motion.push({anim,start});
   }
  }
  const pose={i:e.i,connects,miss,travel,duration,style,color,special,t:0};world()?.move(pose);
  const pixelX=dx*fieldRect.width/width,pixelY=dy*fieldRect.width/width;
  const windup=direction*-9;
  animate(imgs[0],[
   {translate:'0 0',offset:0},{translate:windup+'px 3px',scale:style==='lightning'?'1.10 .85':'.96 1.03',offset:.2},
   {translate:travel?(pixelX*.81)+'px '+(pixelY*.8)+'px':direction*9+'px -3px',scale:travel?(e.i?'1.12':'.9'):'1.03',offset:.51},
   {translate:'0 0',scale:'1',offset:.94},{translate:'0 0',scale:'1',offset:1}
  ],{duration});
  const stroke=(pts,ink,size)=>{
   ctx.strokeStyle=ink;ctx.lineWidth=size;ctx.lineJoin='round';ctx.lineCap='round';
   ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  };
  const dot=(x,y,r,ink)=>{ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);ctx.fill()};
  function crescent(x,y,r,ink,angle){
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=ink;
   ctx.beginPath();ctx.moveTo(-r*.3,-r);ctx.quadraticCurveTo(r*1.2,0,-r*.3,r);ctx.quadraticCurveTo(r*.62,0,-r*.3,-r);ctx.fill();ctx.restore();
  }
  function draw(t){
   if(!ctx||reduced)return;
   ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   const lead=clamp((t-.20)/(arrival-.20)),fade=clamp((.85-t)/.22);
   ctx.save();ctx.translate(...src);ctx.rotate(Math.atan2(dy,dx));
   if(t<.31&&!travel){
    const a=clamp(t/.19)*(1-clamp((t-.19)/.12));ctx.globalAlpha=.75*a;
    for(let i=0;i<7;i++){
     const angle=i*.898+t*4,r=38*(1-clamp(t/.30))+8;
     dot(Math.cos(angle)*r,Math.sin(angle)*r,3,color);
    }
    dot(0,0,5+8*a,'#fffbd4');
    if(style==='lightning'){
     for(let i=0;i<3;i++){
      const angle=i*2.094+t*5;ctx.save();ctx.rotate(angle);
      stroke([[8,0],[18,3],[15,-8],[26+9*a,-4]],'#ffeb65',3);ctx.restore();
     }
    }else if(style==='flame'){
     for(let i=0;i<3;i++)crescent(0,0,11+a*17+i*3,i===1?'#fff0a2':'#ff7934',t*9+i*2.09);
    }
   }
   ctx.globalAlpha=fade;
   if(style==='lightning'&&lead>0&&fade>0){
    const bolt=[];
    for(let i=0;i<=12;i++)bolt.push([dist*lead*i/12,i===0||i===12?0:(i%2?1:-1)*(9+8*Math.sin(i*2.7+t*21))*(special?1.65:1)]);
    ctx.shadowColor='#ffce3e';ctx.shadowBlur=8;stroke(bolt,'#c68020',13);ctx.shadowBlur=0;stroke(bolt,'#ffdf48',9);stroke(bolt,'#ffffe5',3);
    for(const i of [4,8]){const [x,y]=bolt[i];stroke([[x,y],[x+16,y-22],[x+6,y-19],[x+33,y-41]],'#ffe864',3)}
    if(special)stroke(bolt.map(([x,y],i)=>[x,y*.55+Math.sin(i*.7+t*15)*18]),'#fff5a7',4);
   }else if(style==='flame'&&lead>0&&fade>0){
    const reach=dist*lead;
    const axis=p=>Math.sin(p*8-t*12)*7*p;
    const edge=(p,phase)=>(2+p*(special?44:29))*(.76+.18*Math.sin(p*29-t*17+phase)+.08*Math.sin(p*57+t*16))*Math.min(1,(1.06-p)*8);
    for(const [size,ink] of [[1.23,'#ee5127'],[.91,'#ff942f'],[.63,'#ffcb48'],[.28,'#fff2a0']]){
     ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(0,0);
     for(let i=1;i<=34;i++){const p=i/34;ctx.lineTo(reach*p,axis(p)-edge(p,i%4*.35)*size)}
     for(let i=34;i>=0;i--){const p=i/34;ctx.lineTo(reach*p,axis(p)+edge(p,2.2)*size)}
     ctx.closePath();ctx.fill();
    }
    for(let i=0;i<14;i++){
     const p=(t*1.8+i*.071)%1,side=i%2?1:-1;
     const y=axis(p)+side*(edge(p,0)+4+p*(8+i%5));
     stroke([[reach*p-6,y+2*side],[reach*p,y]],i%3?'#ffbd46':'#fff0a1',2+i%3);
    }
    for(let i=0;i<4;i++){
     const p=(t*2+i*.25)%1;
     crescent(reach*p,axis(p),6+17*p,'#fff19a',Math.sin(t*14+i)*.5);
    }
   }else if(style==='air'&&lead>0&&fade>0){
    for(let i=0;i<3;i++){
     const x=dist*lead-i*23;if(x>=0)crescent(x,(i-1)*9,23+i*4,i===0?'#f7ffff':'#9fe5fa',-.45+i*.3);
    }
   }else if(style==='water'&&lead>0&&fade>0){
    const wave=Array.from({length:29},(_,i)=>[dist*lead*i/28,Math.sin(i*.52-t*16)*(4+i*.15)]);
    stroke(wave,'#227cc1',20);stroke(wave,'#61ddf6',13);stroke(wave,'#dcfcff',4);
    for(let j=0;j<8;j++)dot(dist*lead-14-j*9,Math.sin(j*4+t*12)*22,3+j%3,'#baf7ff');
   }else if((style==='leaves'||style==='ice')&&lead>0&&fade>0){
    for(let i=0;i<10;i++){const x=dist*lead-i*12;if(x<0)continue;
     ctx.save();ctx.translate(x,Math.sin(i*1.7+t*16)*17);ctx.rotate(t*9+i);
     ctx.fillStyle=style==='ice'?'#beffff':'#a0eb55';ctx.strokeStyle=style==='ice'?'#4baad8':'#4e9439';ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(0,-5);ctx.lineTo(13,0);ctx.lineTo(0,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
   }else if((style==='pulse'||style==='bolt')&&lead>0&&fade>0){
    for(let i=0;i<6;i++){const x=dist*lead-12*i;if(x<0)continue;ctx.globalAlpha=fade*(1-i/7);dot(x,Math.sin(i+t*14)*4,17-i*1.8,color)}
    dot(dist*lead,0,7,'#fff');
   }else if(travel&&t>.28&&t<.55){
    ctx.globalAlpha=Math.sin((t-.28)/.27*Math.PI)*.75;
    for(let i=0;i<5;i++)stroke([[dist*lead*.7-52,i*7-12],[dist*lead*.7,i*7-14]],'#fff3c5',2+i%2);
   }
   ctx.restore();
   const burst=clamp((t-arrival)/.36);
   if(connects&&burst>0&&burst<1){
    ctx.save();ctx.translate(...dest);ctx.globalAlpha=1-burst;
    for(let i=0;i<12;i++){const angle=i*Math.PI/6+.16;const r=9+burst*43;
     stroke([[r*Math.cos(angle),r*Math.sin(angle)],[(r+12)*Math.cos(angle),(r+12)*Math.sin(angle)]],i%2?'#fffbd2':color,3+i%3)}
    if(style==='slash'){for(let i=-1;i<=1;i++)stroke([[i*12-18,22],[i*12+19,-23]],'#fff7db',5)}
    if(style==='tail')crescent(-8,0,34+burst*21,'#c7f4ff',-.9+burst*1.6);
    if(style==='lightning'||style==='flame'||special){
     const radius=13+burst*(special?94:56);
     ctx.strokeStyle=style==='flame'?'#ffbb52':style==='lightning'?'#fff282':color;ctx.lineWidth=(1-burst)*5+1;
     ctx.beginPath();ctx.ellipse(0,0,radius,radius*.75,-.3,0,Math.PI*2);ctx.stroke();
     if(style==='flame')for(let i=0;i<6;i++){
      const a=i*1.047+burst*.6;dot(Math.cos(a)*radius*.75,Math.sin(a)*radius*.65-burst*25,8*(1-burst),'#ffad44');
     }
    }
    ctx.restore();
   }
  }
  return new Promise(resolve=>{
   let frame=0,landed=false,previousTime,elapsed=0;
   function done(){
    world()?.move(null);cancelAnimationFrame(frame);motion.forEach(({anim})=>anim.cancel());label.hidden=true;points.hidden=true;canvas.hidden=true;
    cutin.hidden=true;delete field.dataset.finisher;delete field.dataset.phase;delete field.dataset.technique;active=null;resolve();
   }
   active=done;
   function tick(time){
    // After a stalled frame or a backgrounded tab, keep the approach and impact visible.
    elapsed+=Math.min(time-(previousTime??time),80)*rate();previousTime=time;
    const actionTime=Math.max(0,elapsed-intro);
    const visualTime=actionTime-Math.min(hold,Math.max(0,actionTime-duration*(arrival+.045)));
    const t=clamp(visualTime/duration);
    if(!cutin.hidden){
     cutin.style.opacity=String(clamp((intro+90-elapsed)/120));
     if(elapsed>=intro+90)cutin.hidden=true;
    }
    pose.t=t;
    if(t>=arrival&&!landed){
     landed=true;field.dataset.phase='impact';impact();
     if(connects){
      if(e.crit||e.damage*2>=e.max[e.j])animate(field.querySelector('.meadow'),[
       {transform:'scale(1)'},{transform:'scale(1.027) translateX('+direction*-2+'px)',offset:.30},{transform:'scale(1)'}
      ],{duration:310},visualTime);
      points.textContent='−'+e.damage;points.style.left=(dest[0]/width*100)+'%';points.style.top=(dest[1]/height*100-8)+'%';points.hidden=false;
      points.dataset.verdict=e.crit?Locale.t('급소!','CRITICAL!'):e.effect==='strong'?Locale.t('효과 굉장!','SUPER EFFECTIVE!'):'';
      animate(points,[{opacity:0,translate:'0 4px',scale:'.8'},{opacity:1,translate:'0 0',scale:'1.08',offset:.2},{opacity:1,translate:'0 -6px',offset:.65},{opacity:0,translate:'0 -18px'}],{duration:duration*(1-arrival)},visualTime);
      animate(imgs[1],[{translate:'0 0'},{translate:direction*(special?18:10)+'px -4px',filter:'brightness(1.25)',offset:.25},{translate:'0 0'}],{duration:280},visualTime);
     }else if(miss)animate(imgs[1],[{translate:'0 0'},{translate:'0 -12px'},{translate:'0 0'}],{duration:250},visualTime);
    }
    if(landed&&t>=.72)field.dataset.phase='recover';
    for(const {anim,start} of motion)anim.currentTime=visualTime-start;
    draw(t);if(t===1)done();else frame=requestAnimationFrame(tick);
   }
   frame=requestAnimationFrame(tick);
  });
 }
 return {play,clear};
}
