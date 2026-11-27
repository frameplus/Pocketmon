import * as T from 'three';

const clamp=v=>Math.max(0,Math.min(1,v));
function ease(t,a,b){
 const u=clamp((t-a)/(b-a));return u*u*(3-2*u);
}
// Both skeletons sample the same attack clock as the HP change at 0.53.
export function strikeBeat(t){
 return {
  gather:ease(t,0,.23)*(1-ease(t,.25,.46)),
  extend:ease(t,.23,.51)*(1-ease(t,.60,.90)),
  step:ease(t,.22,.50)*(1-ease(t,.63,.96)),
  outbound:Math.sin(Math.PI*clamp((t-.22)/.28)),
  returning:Math.sin(Math.PI*clamp((t-.63)/.33)),
  recoil:ease(t,.53,.61)*(1-ease(t,.64,.93))
 };
}

// Author poses in the model's forward/up frame. Each export has its own joint
// axes, so solve those directions once and retain local rotations for playback.
export function createStrikeRig(model){
 const bones=new Map(),slots=[],poses=new Map(),axis=new T.Vector3(),q=new T.Quaternion();
 model.traverse(b=>{
  if(b.isBone)bones.set(b.name.replace(/_\d+$/,'').toLowerCase(),b);
 });
 const names=['spine1','spine2','neck','neck1','head','jaw','tail1'];
 for(const side of ['l','r'])for(const part of ['arm','forearm','arm2','forearm2','thigh','leg'])names.push(side+part);
 for(const name of names){const b=bones.get(name);if(b)slots.push({b,rest:b.quaternion.clone()})}
 const wrist=bones.get('lhand'),ankle=bones.get('lfoot'),head=bones.get('head');
 const height=b=>b.getWorldPosition(new T.Vector3()).y;
 const armsFree=!ankle||!head||!wrist||height(wrist)>height(ankle)+.28*(height(head)-height(ankle));
 const rest=()=>slots.forEach(j=>j.b.quaternion.copy(j.rest));
 function twist(name,x,y,z){
  const b=bones.get(name);if(!b)return;
  // Convert the authored axis from the rig's neutral world into the current local frame.
  const angle=axis.set(x,y,z).length();if(!angle)return;
  axis.multiplyScalar(1/angle).applyQuaternion(b.getWorldQuaternion(q).invert());
  b.rotateOnAxis(axis,angle);
 }
 function aim(name,tip,x,y,z){
  const b=bones.get(name),end=bones.get(tip);if(!b||!end)return;
  const source=end.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3()));
  if(source.lengthSq()<1e-8)return;
  const rot=new T.Quaternion().setFromUnitVectors(source.normalize(),new T.Vector3(x,y,z).normalize());
  const parent=b.parent.getWorldQuaternion(new T.Quaternion());
  b.quaternion.premultiply(parent.clone().invert().multiply(rot).multiply(parent));
 }
 function bake(pose){
  rest();pose();return slots.map(j=>j.b.quaternion.clone());
 }
 function posesFor(style,left){
  const lead=left?'l':'r',off=left?'r':'l',sign=left?1:-1;
  const hand=(side,out,y,z,foreOut,foreY,foreZ,suffix='')=>{
   if(!armsFree)return;
   const s=side==='l'?1:-1;
   aim(side+'arm'+suffix,side+'forearm'+suffix,s*out,y,z);
   aim(side+'forearm'+suffix,side+'hand'+suffix,s*foreOut,foreY,foreZ);
  };
  const punch=style==='punch',slash=style==='slash',kick=style==='leap',bite=style==='fang',tail=style==='tail';
  const gather=bake(()=>{
   twist('spine1',.16,-sign*.30,sign*.06);twist('head',-.12,sign*.16,0);
   twist(lead+'thigh',-.30,0,0);twist(lead+'leg',.49,0,0);
   twist(off+'thigh',.14,0,0);twist(off+'leg',.18,0,0);
   hand(lead,.70,-.72,-.44,-.20,.86,.44);hand(off,.48,-.48,.62,-.30,.70,.74);
   if(slash)hand(lead,.85,.65,-.10,.30,.63,.6);
   if(bite)twist('jaw',.46,0,0);if(tail)twist('tail1',.08,-.58*sign,0);
  });
  const extend=bake(()=>{
   twist('spine1',(punch||bite) ? .23 : -.09,sign*(tail ? .70 : .42),-sign*.08);
   twist('neck1',bite ? .36 : -.10,0,0);twist('head',bite ? .20 : -.08,-sign*.14,0);
   if(slash){
    hand(lead,-.64,-.20,.82,-.50,-.34,.80);twist('spine2',.14,sign*.34,0);
   }else if(punch){
    hand(lead,.04,.13,1,-.03,.02,1);hand(off,.62,-.80,-.3,-.30,.81,.45);
    hand(lead,.43,-.24,.87,-.18,.29,1,'2');
   }else if(kick){
    twist(lead+'thigh',-1.03,0,-sign*.16);twist(lead+'leg',.16,0,0);
    hand(lead,.8,-.45,-.40,.25,-.30,.9);
   }else if(tail)twist('tail1',.12,sign*.92,0);
   else if(!bite){
    hand(lead,.48,-.12,.85,-.23,.19,1);hand(off,.48,-.12,.85,-.23,.19,1);
   }
   if(!kick)twist(lead+'thigh',-.22,0,0);
   twist(off+'thigh',.35,0,0);twist(off+'leg',.18,0,0);
  });
  return {gather,extend};
 }
 const flinch=bake(()=>{
  twist('spine1',-.34,.14,.12);twist('spine2',-.20,0,0);twist('head',-.22,.14,0);
  twist('jaw',.21,0,0);twist('lthigh',-.29,0,0);twist('lleg',.45,0,0);
  if(armsFree){aim('larm','lforearm',1,.28,-.35);aim('rarm','rforearm',-1,.22,.16)}
 });
 // Pose generation must happen before the model is attached to a moving pivot.
 for(const style of ['punch','slash','leap','tail','fang','cast']){
  for(const left of [false,true])poses.set(style+left,posesFor(style,left));
 }
 rest();
 const feet=['lfoot','rfoot'].map(name=>bones.get(name)).filter(Boolean)
  .map(b=>({b,restY:height(b)}));
 // The ankle is usually above the sole. Preserve its original clearance when planted.
 function plant(base,scale,weight){
  if(!feet.length||weight<=0)return;
  let lowest=Infinity;
  for(const foot of feet)lowest=Math.min(lowest,foot.b.getWorldPosition(axis).y-foot.restY*scale);
  base.position.y+=T.MathUtils.clamp(.275-lowest,-.46,.46)*weight;
 }
 function apply(action,attacking,beat){
  const key=action.style==='rush'?'punch':action.style;
  const left=action.leadLeft,pose=poses.get(key+left)||poses.get('cast'+left);
  for(let i=0;i<slots.length;i++){
   const b=slots[i].b;
   if(attacking){
    b.quaternion.slerp(pose.gather[i],beat.gather);
    b.quaternion.slerp(pose.extend[i],beat.extend);
   }else if(action.connects)b.quaternion.slerp(flinch[i],beat.recoil);
  }
 }
 return {rest,apply,plant};
}
