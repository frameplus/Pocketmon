import * as T from 'three';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from '/vendor/three/examples/jsm/loaders/DRACOLoader.js';

const standardPads=[new T.Vector3(-2.05,0,.95),new T.Vector3(2.0,0,-.55)];
const angles=[.39,-.55];
const still=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=v=>Math.max(0,Math.min(1,v));
// Some pinned exports contain only a bind pose. Work in model space because
// the local bone axes differ between skeletons (including Machamp's second arms).
function poseStaticRig(model,id){
 function rotateWorld(bone,delta){
  const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false,true);
 }
 function aim(name,end,direction){
  const bone=model.getObjectByName(name),tip=model.getObjectByName(end);
  if(!bone||!tip)return;
  const from=tip.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
  rotateWorld(bone,new T.Quaternion().setFromUnitVectors(from,direction.normalize()));
 }
 if([68,282,448].includes(id)){
  for(const side of ['L','R'])for(const suffix of (id===68?['','2']:[''])){
   const arm=side+'Arm'+suffix,elbow=side+'ForeArm'+suffix,hand=side+'Hand'+suffix;
   const shoulder=model.getObjectByName(arm),wrist=model.getObjectByName(hand);
   if(!shoulder||!wrist)continue;
   const outward=Math.sign(wrist.getWorldPosition(new T.Vector3()).x-shoulder.getWorldPosition(new T.Vector3()).x)||1;
   const guard=id!==282&&!suffix;
   aim(arm,elbow,new T.Vector3(outward*(guard ? .76 : .40),-.92,guard ? .33 : .12));
   aim(elbow,hand,new T.Vector3(outward*(guard ? -.18 : .20),guard ? .48 : -.53,.9));
  }
 }
 if(id===384){
  const bend=(name,axis,angle)=>{const bone=model.getObjectByName(name);if(bone)rotateWorld(bone,new T.Quaternion().setFromAxisAngle(axis,angle))};
  const up=new T.Vector3(0,1,0),across=new T.Vector3(1,0,0);
  bend('Spine1',across,-.85);bend('Spine2',across,-.50);bend('Neck1',up,.38);bend('Neck2',across,.88);
  for(let i=1;i<=15;i++){bend('Tail'+i,up,i<10 ? .40 : -.20);bend('Tail'+i,across,i<7 ? .22 : -.12)}
 }
}
// Measure the silhouette in the battle camera, so a long tail or deep wingspan
// does not shrink the whole fighter. Keep the full silhouette inside its lane.
function battleScale(model,yaw,camera){
 const vertex=new T.Vector3(),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
 const axis=new T.Vector3(0,1,0);
 let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
 model.traverseVisible(mesh=>{
  if(!mesh.isMesh)return;
  const count=mesh.geometry.attributes.position.count,stride=Math.max(1,Math.ceil(count/1400));
  for(let j=0;j<count;j+=stride){
   mesh.getVertexPosition(j,vertex).applyMatrix4(mesh.matrixWorld).applyAxisAngle(axis,yaw);
   const y=vertex.dot(up);
   left=Math.min(left,vertex.x);right=Math.max(right,vertex.x);
   top=Math.max(top,y);bottom=Math.min(bottom,y);
  }
 });
 return 3.55/Math.max(right-left,top-bottom);
}
function disposeModel(model){
 const textures=new Set(),materials=new Set(),geometries=new Set();
 model.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [].concat(o.material)){
  if(!m)continue;materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
 }if(o.isSkinnedMesh)o.skeleton.dispose()});
 textures.forEach(t=>{t.dispose();t.source?.data?.close?.()});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
export function createStadium(field){
 const canvas=field.querySelector('.world'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();renderer.setClearColor(0x000000,0);
 const camera=new T.OrthographicCamera(-5,5,3,-3,.05,90);
 camera.position.set(0,7.1,13.8);camera.lookAt(0,1.12,0);camera.updateMatrixWorld();
 scene.add(new T.HemisphereLight(0xfff6e4,0xb9ccdc,1.45));
 const sun=new T.DirectionalLight(0xfff3de,1.7);sun.position.set(-4,8,7);sun.castShadow=true;sun.shadow.mapSize.set(768,768);
 Object.assign(sun.shadow.camera,{left:-6,right:6,top:5,bottom:-5,near:.5,far:22});sun.shadow.normalBias=.025;sun.shadow.bias=-.00035;scene.add(sun);
 const rim=new T.DirectionalLight(0xe0eeff,.50);rim.position.set(5,4,-3);scene.add(rim);
 const pads=standardPads.map(p=>p.clone());
 const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/');draco.setWorkerLimit(1);loader.setDRACOLoader(draco);
 let factors=[1,1],rate=1,wingTime=0;
 const flight=[{x:0,lift:0,bank:0},{x:0,lift:0,bank:0}];
 const slots=[null,null],ids=[0,0],requests=[null,null],jobs=[null,null],shadowMap=document.createElement('canvas');
 shadowMap.width=shadowMap.height=64;const cx=shadowMap.getContext('2d'),grad=cx.createRadialGradient(32,32,1,32,32,32);
 grad.addColorStop(0,'rgba(27,52,67,.48)');grad.addColorStop(.56,'rgba(27,52,67,.25)');grad.addColorStop(1,'rgba(27,52,67,0)');cx.fillStyle=grad;cx.fillRect(0,0,64,64);
 const shadowTexture=new T.CanvasTexture(shadowMap);
 const sideAxis=new T.Vector3(1,0,0),forwardAxis=new T.Vector3(0,0,1);
 const shadows=pads.map(p=>{const s=new T.Mesh(new T.PlaneGeometry(2.6,2),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  s.rotation.x=-Math.PI/2;s.position.set(p.x,.269,p.z);scene.add(s);return s});
 let visible=false,frame=0,last=0,phase='',releaseImages=[],action=null,attackClip=null,winner=-1,victoryTime=0,stopped=false;
 function resize(){
  const w=field.clientWidth,h=field.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);
  const half=Math.max(2.6,4.85*h/w);
  camera.left=-half*w/h;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  // Project the illustrated platforms onto the model's ground plane at any aspect ratio.
  const ground=new T.Plane(new T.Vector3(0,1,0),-.26),ray=new T.Raycaster();
  [[.28,.81],[.73,.55]].forEach(([x,y],i)=>{
   ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);
   ray.ray.intersectPlane(ground,pads[i]);
  });
  updateGround();
 }
 const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(field);resize();
 function projected(pos){const v=pos.clone().project(camera);return [(v.x+1)/2,(1-v.y)/2]}
 function anchors(live=false){
  return pads.map((p,i)=>{
   const pos=live&&slots[i]?slots[i].base.position:p;
   const y=live&&slots[i]?pos.y:.26;
   return projected(new T.Vector3(pos.x,y+((slots[i]?.height||2.3)*factors[i])*.57,pos.z));
  });
 }
 function updateGround(){
  pads.forEach((p,i)=>{const v=projected(new T.Vector3(p.x,.26,p.z));field.style.setProperty(i?'--far-x':'--near-x',(v[0]*100)+'%');field.style.setProperty(i?'--far-feet':'--near-feet',(v[1]*100)+'%')});
  anchors().forEach((p,i)=>field.style.setProperty(i?'--far-release':'--near-release',(p[1]*100)+'%'));
 }
 function detach(i){
  const s=slots[i];delete field.dataset['mesh'+i];if(!s)return;
  s.mixer?.stopAllAction();if(s.mixer)s.mixer.uncacheRoot(s.model);
  scene.remove(s.base);disposeModel(s.model);slots[i]=null;
 }
 async function selectOne(p,i){
  const id=p.id,flying=p.types.includes(3);
  if(id===ids[i]||stopped)return;ids[i]=id;requests[i]?.abort();detach(i);
  const control=new AbortController();requests[i]=control;
  try{
   const res=await fetch('/models/'+id+'.glb',{signal:control.signal});
   if(res.status===404)return;
   if(!res.ok)throw Error('Model request failed');
   const gltf=await loader.parseAsync(await res.arrayBuffer(),'');
   if(control.signal.aborted||stopped){disposeModel(gltf.scene);return}
   const model=gltf.scene,base=new T.Group(),pivot=new T.Group();base.add(pivot);pivot.add(model);
   base.name='fighter-'+i;
   const mixer=new T.AnimationMixer(model);
   const airIdle=flying&&gltf.animations.find(a=>/flywait|fly(?:ing)?.*idle|fly(?:ing)?.*loop|wingflap/i.test(a.name));
   const idle=airIdle||gltf.animations.find(a=>/battlewait/i.test(a.name))||gltf.animations.find(a=>/idle.*loop|defaultwait|standing|(?:^|[|_\d])idle$/i.test(a.name));
   if(idle)mixer.clipAction(idle).play();mixer.update(0);
   // The pinned Pikachu export is Z-up. Keep its cheeks and ears upright in this Y-up arena.
   if(id===25)model.children[0].rotateX(-Math.PI/2);
   // Eevee's rest pose pitches its nose into the ground. Correct it before measuring the model.
   if(id===133)model.rotation.x=-.52;
   if(!idle)poseStaticRig(model,id);
   model.traverse(o=>{
    if(!o.isMesh)return;o.castShadow=true;
    if(id===6)for(const mat of [].concat(o.material)){
      // These two texture masks represent the tail flame in this export.
      if(!['Material_15','Material_16'].includes(mat.name))continue;
      mat.map?.dispose();mat.map=null;mat.color.set(mat.name==='Material_15'?0xff6b19:0xffda4e);
      mat.emissive?.set(mat.name==='Material_15'?0xed5817:0xfbb91f);
     }
   });
   model.updateMatrixWorld(true);
   const box=new T.Box3().setFromObject(model,true),extent=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
   const scale=battleScale(model,angles[i],camera);
   if(!Number.isFinite(scale)||scale<=0){disposeModel(model);return}
   const ground=new T.Vector3(center.x,box.min.y,center.z);
   if(id===150){
    // Its long tail shifts the bounding-box center far away from its stance.
    const feet=['left_foot_index_50','right_foot_index_56'].map(name=>model.getObjectByName(name));
    if(feet.every(Boolean)){
     const stance=feet[0].getWorldPosition(new T.Vector3()).lerp(feet[1].getWorldPosition(new T.Vector3()),.5);
     ground.x=stance.x;ground.z=stance.z;
    }
   }
   model.position.sub(ground);pivot.scale.setScalar(scale);
   const clips=id===25?[]:gltf.animations;
   const melee=clips.find(a=>/(?:^|[_|\d])attack01(?:$|_loop)|fight_b$/i.test(a.name));
   const ranged=clips.find(a=>/rangeattack01|fight_d$/i.test(a.name));
   const attack=melee||ranged||clips.find(a=>/attack|atacar/i.test(a.name));
   const joints=[];
   if(!idle&&!attack)model.traverse(bone=>{
    if(!bone.isBone)return;
    // The Charizard export calls its two wing chains LFeeler and RFeeler.
    const wing=flying&&(/^[lr]wing1?(?:_|$)/i.test(bone.name)||(id===6&&/^[lr]feeler1(?:_|$)/i.test(bone.name)));
    if(wing){joints.push({bone,rest:bone.quaternion.clone(),axis:'z',amplitude:.38,sign:/^r/i.test(bone.name)?-1:1,wing:true});return}
    const match=/^(tail1?|[lr]ear1?|[lr]wing1?|[lr]arm|head)(?:_|$)/i.exec(bone.name);
    if(!match)return;
    const name=match[1].toLowerCase();
    joints.push({bone,rest:bone.quaternion.clone(),axis:name.startsWith('tail')?'y':name==='head'?'x':'z',
     amplitude:name==='head' ? .045:name.startsWith('tail') ? .21 : .13,sign:name.startsWith('r')?-1:1});
   });
   slots[i]={base,model,pivot,mixer,idle,attack,melee,ranged,scale,height:extent.y*scale,id,joints};
   scene.add(base);base.position.copy(pads[i]);base.position.y=.27;base.rotation.y=angles[i];
   field.dataset['mesh'+i]=String(id);resize();wake();
  }catch{
   // Keep the sprite visible and allow the next selection or battle to retry.
   if(requests[i]===control&&!control.signal.aborted)ids[i]=0;
  }
 }
 function select(pair){
  winner=-1;if(stopped)return;
  factors=window.Game.fieldSizes(pair);
  updateGround();
  pair.forEach((p,i)=>{if(p.id!==ids[i])jobs[i]=selectOne(p,i)});
  return Promise.all(jobs);
 }
 const wave=new T.Mesh(new T.RingGeometry(.83,1,48),new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide}));
 wave.rotation.x=-Math.PI/2;wave.visible=false;scene.add(wave);
 const sparks=new T.Group(),sparkMat=new T.MeshBasicMaterial(),sparkShape=new T.OctahedronGeometry(.065);
 for(let i=0;i<8;i++)sparks.add(new T.Mesh(sparkShape,sparkMat));
 sparks.visible=false;scene.add(sparks);
 function paintSparks(){
  wave.visible=false;
  if(action&&!still.matches){
   const charge=action.t<.32,progress=charge?action.t/.32:(action.t-.53)/.32;
   if(progress>=0&&progress<1&&(charge||action.connects)){
    const mark=pads[charge?action.i:1-action.i];
    wave.visible=true;wave.position.set(mark.x,.282,mark.z);
    wave.scale.setScalar(charge?1.20-progress*.72:.38+progress*1.2);
    wave.material.color.set(action.color);wave.material.opacity=charge ? .48*Math.sin(progress*Math.PI):.65*(1-progress);
   }
  }
  sparks.visible=!!action&&!still.matches&&action.style!=='focus'&&action.connects;
  if(!sparks.visible)return;
  const {t,i,travel}=action,source=slots[i]?.base.position||pads[i],dest=slots[1-i]?.base.position||pads[1-i],v=clamp((t-.20)/.33),impact=clamp((t-.53)/.36);
  sparks.visible=t>=.18&&t<.89&&(!travel||t>=.53);if(!sparks.visible)return;
  const h0=((slots[i]?.height||2.3)*factors[i])*.57+source.y,h1=((slots[1-i]?.height||2.3)*factors[1-i])*.57+dest.y;
  sparks.position.set(T.MathUtils.lerp(source.x,dest.x,v),T.MathUtils.lerp(h0,h1,v),T.MathUtils.lerp(source.z,dest.z,v));
  sparks.children.forEach((s,k)=>{
   const angle=k*Math.PI/4+t*7,r=.12+impact*.75;
   s.position.set(r*Math.cos(angle),r*Math.sin(angle),Math.sin(angle*2)*r*.5);
   s.rotation.set(t*8,k+t*3,angle);s.scale.setScalar(1.05-impact);
  });
 }
 function move(a){
  attackClip?.stop();attackClip=null;action=a;if(!a)return;
  sparkMat.color.set(a.color);winner=-1;const s=slots[a.i];
  if(!still.matches&&s?.attack){
   attackClip=s.mixer.clipAction((a.travel?s.melee:s.ranged)||s.attack).reset().setLoop(T.LoopOnce,1);
   attackClip.paused=true;attackClip.play();
  }
 }
 function render(time){
  frame=0;if(stopped||!visible||document.hidden)return;
  if(last&&time-last<(still.matches?80:26)){frame=requestAnimationFrame(render);return}
  const dt=Math.min((time-(last||time))/1000,.075);last=time;
  wingTime+=dt*rate;
  const next=field.dataset.scene;if(next!==phase){
   phase=next;if(next==='release')releaseImages=[...field.querySelectorAll('.actor img')];
   if(next==='release'||next==='throw')winner=-1;
  }
  if(winner>=0)victoryTime+=dt*rate;
  slots.forEach((s,i)=>{
   if(!s){shadows[i].visible=false;return}
   const from=pads[i],other=pads[1-i];s.base.position.copy(from);s.base.position.y=.275;
   // Pose each frame from the standing position, including after an interrupted move.
   s.base.rotation.set(0,angles[i],0);
   // Use the same release animation as the fallback, including its side delay and live playback rate.
   const size=phase==='release'&&!still.matches?(parseFloat(getComputedStyle(releaseImages[i]).scale)||1):1;
   s.base.visible=phase!=='throw'&&size>.061;shadows[i].visible=s.base.visible;
   if(phase==='release')s.base.position.y+=(1-size)*s.height*factors[i]*.57;
   s.base.scale.setScalar(Math.max(.001,size)*factors[i]);
   shadows[i].scale.setScalar(factors[i]);
   if(!still.matches){
    if(action?.i===i&&attackClip){
     attackClip.time=action.t*attackClip.getClip().duration;
     attackClip.setEffectiveWeight(clamp((1-action.t)/.23));
    }
    s.mixer.update(dt*rate);
    const beat=time*.0043+i*2.2,step=(1-Math.cos(beat))*.5;
    s.base.position.y+=step*(s.idle ? .025 : .09);
    s.base.position.x+=Math.sin(beat)*.055;
    s.base.rotation.y+=Math.sin(beat*.5)*.085;
    for(const joint of s.joints){
     const swing=joint.wing?Math.sin(wingTime*9)*(.22+clamp(flight[i].lift*12)*.78):Math.sin(beat+.7);
     joint.bone.quaternion.copy(joint.rest);
     joint.bone.rotateOnAxis(joint.axis==='y'?T.Object3D.DEFAULT_UP:joint.axis==='x'?sideAxis:forwardAxis,swing*joint.amplitude*joint.sign);
    }
    if(action){
     const t=action.t,dir=i?-1:1;
     if(i===action.i){
      const load=Math.sin(Math.PI*clamp(t/.31));
      const drive=Math.sin(Math.PI*clamp((t-.21)/.65));
      const stride=action.travel ? .65 : action.style==='lightning' ? .19 : .16;
      s.base.position.x+=(other.x-from.x)*stride*drive-dir*.31*load;
      s.base.position.z+=(other.z-from.z)*stride*drive;
      s.base.position.y+=drive*(action.travel ? .46 : .24);
      s.base.scale.x*=1+.045*load;s.base.scale.y*=1-.10*load;s.base.scale.z*=1+.045*load;
      s.base.rotation.y+=dir*(.29*drive-.20*load);
      s.base.rotation.x=.13*drive-.09*load;
      s.base.rotation.z=dir*-.055*drive;
      if(action.style==='leap'){
       s.base.position.y+=.95*Math.sin(Math.PI*clamp((t-.18)/.35));s.base.rotation.x+=.22*drive;
      }else if(action.style==='punch'||action.style==='fang'){
       s.base.rotation.y+=dir*(action.style==='punch' ? .48 : .22)*drive;
       s.base.rotation.x+=.25*drive;
      }else if(action.style==='quake'){
       s.base.position.y+=.42*load;s.base.scale.y*=1-.13*drive;
      }else if(action.style==='lightning'){
       s.base.position.y+=.29*drive;s.base.scale.y*=1-.08*load;
      }else if(action.style==='flame'){
       s.base.rotation.x+=.17*drive-.13*load;
       s.base.rotation.y+=dir*.08*Math.sin(t*16)*drive;
      }else if(action.style==='tail'){
       s.base.rotation.y+=dir*1.35*Math.sin(2*Math.PI*clamp((t-.18)/.69));
      }
     }else if(t>=.53){
      const bump=Math.sin(Math.PI*clamp((t-.53)/.41));
      s.base.position.x-=dir*bump*(action.special ? .62 : action.connects ? .43 : .18);
      s.base.position.y+=bump*(action.miss ? .39 : .20);
      s.base.rotation.x=-.15*bump;
     }
    }
   }
   if(i===winner){
    const t=still.matches?1:clamp(victoryTime/.72);
    s.base.rotation.y=T.MathUtils.lerp(s.base.rotation.y,i?-.1:.13,t);s.base.position.y+=Math.sin(Math.PI*t)*.35;
   }
   const air=flight[i];
   if(!still.matches){
    s.base.position.x+=air.x*(camera.right-camera.left);
    s.base.position.y+=air.lift*(camera.top-camera.bottom)/camera.matrixWorld.elements[5];
    s.pivot.rotation.z=air.bank;
    shadows[i].scale.multiplyScalar(1-air.lift*2.6);
   }else s.pivot.rotation.z=0;
   shadows[i].position.x=s.base.position.x;shadows[i].position.z=s.base.position.z;
  });
  paintSparks();renderer.render(scene,camera);frame=requestAnimationFrame(render);
 }
 function wake(){if(!frame&&!stopped&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(render)}}
 const observer=new IntersectionObserver(rows=>{visible=rows.at(-1).isIntersecting;wake()});observer.observe(field);
 document.addEventListener('visibilitychange',wake);
 field.dataset.world='on';
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;cancelAnimationFrame(frame);delete field.dataset.world;delete field.dataset.mesh0;delete field.dataset.mesh1;observer.disconnect();sizeObserver.disconnect();requests.forEach(c=>c?.abort());document.removeEventListener('visibilitychange',wake)});
 return {select,move,anchors,setFlight(i,x,lift,bank){Object.assign(flight[i],{x,lift,bank})},setRate(value){rate=value},finish(side){winner=side;victoryTime=0;wake()}};
}
