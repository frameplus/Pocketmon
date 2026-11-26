import * as T from 'three';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from '/vendor/three/examples/jsm/loaders/DRACOLoader.js';

const standardPads=[new T.Vector3(-2.05,0,.95),new T.Vector3(2.0,0,-.55)];
const angles=[.39,-.55];
const still=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=v=>Math.max(0,Math.min(1,v));
function paintArena(scene,marks){
 const meshes=new Map(),materials=new Map();
 const shapes={slab:new T.BoxGeometry(1,1,1),disc:new T.CylinderGeometry(1,1,1,64),stone:new T.DodecahedronGeometry(1,0),ring:new T.TorusGeometry(1,.018,6,72)};
 function put(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
  const obj=new T.Object3D();obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.rotation.set(rx,ry,rz);obj.updateMatrix();
  const key=shape+color;if(!meshes.has(key))meshes.set(key,{shape,color,items:[]});
  meshes.get(key).items.push(obj.matrix);
 }
 const ring=(c,x,y,z,r)=>put('ring',c,x,y,z,r,r,r,-Math.PI/2);
 put('slab',0x76bcb0,0,-1.1,0,60,1,48);
 put('disc',0x688991,0,-.39,0,8.7,.83,7.2);put('disc',0xc9d8d8,0,-.09,0,8.5,.45,7.0);
 put('disc',0x94c9b4,0,.09,0,8.24,.18,6.76);
 // Stone pavers and colored lanes on the stadium floor.
 for(let i=-7;i<=7;i++)for(let j=-5;j<=5;j++){
  const x=i*1.05+(j%2)*.525,z=j*.82;
  if(x*x/51+z*z/26>1)continue;
  put('slab',[0xc1cdbd,0xafc3b8,0xb5c9bf,0xc3d1c5][Math.abs(i*13+j*7)%4],x,.18,z,1.035,.045,.807);
 }
 const colors=[0x8861cc,0xe68c47];
 marks.forEach((mark,i)=>{
  for(const [r,y,c] of [[1.62,.21,colors[i]],[1.47,.24,i?0xf2ba80:0xb3a1e1]]){
   const tile=new T.Mesh(shapes.disc,new T.MeshStandardMaterial({color:c}));
   tile.position.y=y;tile.scale.set(r,.025,r);tile.receiveShadow=true;mark.add(tile);
  }
  const border=new T.Mesh(shapes.ring,new T.MeshStandardMaterial({color:0xfff8e6}));
  border.rotation.x=-Math.PI/2;border.position.y=.257;border.scale.setScalar(1.32);mark.add(border);scene.add(mark);
 });
 ring(0xf9f4dd,0,.22,0,.77);ring(0xa4b9ac,0,.218,0,.92);
 put('slab',0xfff9e2,0,.225,0,1.52,.012,.045);
 put('disc',0xf9f6de,0,.235,0,.17,.02,.17);
 for(let i=0;i<40;i++){
  const a=2*Math.PI*i/40,x=Math.sin(a)*8,z=Math.cos(a)*6.55;
  if(z<1.4){
   put('slab',0x577b86,x,.5,z,1.14,.53,.22,0,a);
   put('slab',i%5===0?0xf9be68:0xbeefdc,x,.79,z,1.14,.075,.26,0,a);
   if(i%2===0)put('slab',0xeff2df,x,.53,z,.13,.75,.32,0,a);
  }
 }
 // Low terraced stands and trees on the distant rim keep the arena in view.
 for(let i=-7;i<=7;i++){
  const x=i*1.62,z=-6.4+Math.abs(i)*.12;
  put('slab',0xcbddd2,x,.37,z,1.62,.8,1.28);
  put('slab',0x80a5aa,x,.83,z-.36,1.62,.28,.8);
  for(let j=0;j<3;j++)put('slab',[0xf5bf70,0xa19ada,0x86cbcc][Math.abs(i+j)%3],x-.49+j*.46,1.01,z-.44,.36,.14,.39);
  if(i%2===0){
   const tx=x+.5;put('slab',0x897554,tx,.72,z-2,.26,1.45,.25);
   put('stone',0x3b936e,tx,1.58,z-2,.96,1.13,.85);
   put('stone',0x78bc77,tx-.21,2.04,z-2,.72,.77,.7);
  }
 }
 // Goal arches, illuminated team stripes and shaded planting beds frame the dueling lane.
 for(const side of [-1,1]){
  const x=3.98*side,z=-2.55,c=side<0?0x9360dd:0xf69b3b;
  put('disc',0x528784,x,.18,z,.82,.26,.53);
  put('disc',0x405c73,x,.36,z,.61,.12,.43);
  for(const k of [-1,1]){
   put('slab',0x4d6581,x+k*.4,.74,z,.17,.85,.18,0,0,-k*.18);
   put('slab',c,x+k*.45,.75,z+.09,.06,.49,.05,0,0,-k*.18);
  }
  put('ring',c,x,1.18,z,.67,.67,2.6,Math.PI*.35);
  put('ring',0xffedb8,x,1.20,z,.59,.59,1.75,Math.PI*.35);
  for(let k=0;k<3;k++){
   const tx=side*(4.48+k*.58),tz=-2.42-k*.84;
   put('disc',0x6e976c,tx,.19,tz,.77,.22,.68);
   put('slab',0x8d6d49,tx,.64,tz,.22,.95,.23);
   put('stone',0x37866e,tx,1.32,tz,.68,.84,.65);
   put('stone',0x77b778,tx-.12,1.79,tz,.55,.54,.53);
  }
 }
 for(let i=0;i<18;i++){
  const a=(i*.86+.6),x=Math.sin(a)*7.55,z=Math.cos(a)*6.25;
  put('stone',i%2?0x77ad7c:0x69a879,x,.27,z,.43,.24,.38);
 }
 for(const {shape,color,items} of meshes.values()){
  if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));
  const batch=new T.InstancedMesh(shapes[shape],materials.get(color),items.length);
  items.forEach((m,i)=>batch.setMatrixAt(i,m));batch.receiveShadow=true;batch.castShadow=shape==='stone';scene.add(batch);
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
 const canvas=field.querySelector('.world'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color(0xb5dbd6);scene.fog=new T.Fog(0xb5dbd6,19,35);
 const camera=new T.OrthographicCamera(-5,5,3,-3,.05,90);
 camera.position.set(0,7.1,13.8);camera.lookAt(0,1.12,0);camera.updateMatrixWorld();
 scene.add(new T.HemisphereLight(0xfff6e4,0xb9ccdc,1.45));
 const sun=new T.DirectionalLight(0xfff3de,1.7);sun.position.set(-4,8,7);sun.castShadow=true;sun.shadow.mapSize.set(768,768);
 Object.assign(sun.shadow.camera,{left:-6,right:6,top:5,bottom:-5,near:.5,far:22});sun.shadow.normalBias=.025;sun.shadow.bias=-.00035;scene.add(sun);
 const rim=new T.DirectionalLight(0xe0eeff,.50);rim.position.set(5,4,-3);scene.add(rim);
 const pads=standardPads.map(p=>p.clone()),marks=pads.map(()=>new T.Group());paintArena(scene,marks);marks.forEach((mark,i)=>mark.position.copy(pads[i]));
 const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/');draco.setWorkerLimit(1);loader.setDRACOLoader(draco);
 let factors=[1,1],rate=1;
 const slots=[null,null],ids=[0,0],requests=[null,null],jobs=[null,null],shadowMap=document.createElement('canvas');
 shadowMap.width=shadowMap.height=64;const cx=shadowMap.getContext('2d'),grad=cx.createRadialGradient(32,32,1,32,32,32);
 grad.addColorStop(0,'rgba(27,52,67,.48)');grad.addColorStop(.56,'rgba(27,52,67,.25)');grad.addColorStop(1,'rgba(27,52,67,0)');cx.fillStyle=grad;cx.fillRect(0,0,64,64);
 const shadowTexture=new T.CanvasTexture(shadowMap);
 const sideAxis=new T.Vector3(1,0,0),forwardAxis=new T.Vector3(0,0,1);
 const shadows=pads.map(p=>{const s=new T.Mesh(new T.PlaneGeometry(2.6,2),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  s.rotation.x=-Math.PI/2;s.position.set(p.x,.269,p.z);scene.add(s);return s});
 let visible=false,frame=0,last=0,phase='',release=0,action=null,winner=-1,finished=0,stopped=false;
 function resize(){
  const w=field.clientWidth,h=field.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);
  const half=Math.max(2.6,4.85*h/w);
  camera.left=-half*w/h;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();updateGround();
 }
 const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(field);resize();
 function projected(pos){const v=pos.clone().project(camera);return [(v.x+1)/2,(1-v.y)/2]}
 function anchors(){
  return pads.map((p,i)=>projected(new T.Vector3(p.x,((slots[i]?.height||2.3)*factors[i])*.57+.26,p.z)));
 }
 function updateGround(){
  pads.forEach((p,i)=>{const v=projected(new T.Vector3(p.x,.26,p.z));field.style.setProperty(i?'--far-x':'--near-x',(v[0]*100)+'%');field.style.setProperty(i?'--far-feet':'--near-feet',(v[1]*100)+'%')});
 }
 function detach(i){
  const s=slots[i];delete field.dataset['mesh'+i];if(!s)return;
  s.mixer?.stopAllAction();if(s.mixer)s.mixer.uncacheRoot(s.model);
  scene.remove(s.base);disposeModel(s.model);slots[i]=null;
 }
 async function selectOne(id,i){
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
   const idle=gltf.animations.find(a=>/battlewait/i.test(a.name))||gltf.animations.find(a=>/idle.*loop|defaultwait|standing|^idle$/i.test(a.name));
   if(idle)mixer.clipAction(idle).play();mixer.update(0);
   // The pinned Pikachu export is Z-up. Keep its cheeks and ears upright in this Y-up arena.
   if(id===25)model.children[0].rotateX(-Math.PI/2);
   // Eevee's rest pose pitches its nose into the ground. Correct it before measuring the model.
   if(id===133)model.rotation.x=-.52;
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
   const attack=id!==25&&gltf.animations.find(a=>/rangeattack01|attack01|impactrueno|attack|atacar/i.test(a.name));
   const joints=[];
   if(!idle&&!attack)model.traverse(bone=>{
    if(!bone.isBone)return;
    const match=/^(tail1?|[lr]ear1?|[lr]wing1?|[lr]arm|head)(?:_|$)/i.exec(bone.name);
    if(!match)return;
    const name=match[1].toLowerCase();
    joints.push({bone,rest:bone.quaternion.clone(),axis:name.startsWith('tail')?'y':name==='head'?'x':'z',
     amplitude:name==='head' ? .045:name.startsWith('tail') ? .21 : .13,sign:name.startsWith('r')?-1:1});
   });
   slots[i]={base,model,pivot,mixer,idle,attack,scale,height:extent.y*scale,id,joints};
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
  pair.forEach((p,i)=>{if(p.id!==ids[i])jobs[i]=selectOne(p.id,i)});
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
  const {t,i,travel}=action,source=pads[i],dest=pads[1-i],v=clamp((t-.20)/.33),impact=clamp((t-.53)/.36);
  sparks.visible=t>=.18&&t<.89&&(!travel||t>=.53);if(!sparks.visible)return;
  const h0=((slots[i]?.height||2.3)*factors[i])*.57+.26,h1=((slots[1-i]?.height||2.3)*factors[1-i])*.57+.26;
  sparks.position.set(T.MathUtils.lerp(source.x,dest.x,v),T.MathUtils.lerp(h0,h1,v),T.MathUtils.lerp(source.z,dest.z,v));
  sparks.children.forEach((s,k)=>{
   const angle=k*Math.PI/4+t*7,r=.12+impact*.75;
   s.position.set(r*Math.cos(angle),r*Math.sin(angle),Math.sin(angle*2)*r*.5);
   s.rotation.set(t*8,k+t*3,angle);s.scale.setScalar(1.05-impact);
  });
 }
 function move(a){action=a;if(a)sparkMat.color.set(a.color);if(a)winner=-1;if(!a)return;const s=slots[a.i];if(!still.matches&&s?.attack){
  const clip=s.mixer.clipAction(s.attack);clip.reset().setLoop(T.LoopOnce,1);clip.setDuration(a.duration/1000);clip.play();
 }}
 function render(time){
  frame=0;if(stopped||!visible||document.hidden)return;
  if(last&&time-last<(still.matches?80:26)){frame=requestAnimationFrame(render);return}
  const dt=Math.min((time-(last||time))/1000,.075);last=time;
  const next=field.dataset.scene;if(next!==phase){phase=next;if(next==='release'){release=time;winner=-1}if(next==='throw')winner=-1}
  slots.forEach((s,i)=>{
   if(!s){shadows[i].visible=false;return}
   const from=pads[i],other=pads[1-i];s.base.position.copy(from);s.base.position.y=.275;
   // Pose each frame from the standing position, including after an interrupted move.
   s.base.rotation.set(0,angles[i],0);
   const size=phase==='release'&&!still.matches?clamp((time-release-90)/440):1;
   s.base.visible=phase!=='throw'&&size>.01;shadows[i].visible=s.base.visible;
   s.base.scale.setScalar(Math.max(.001,size)*factors[i]);
   shadows[i].scale.setScalar(factors[i]);
   if(!still.matches){
    s.mixer.update(dt*rate);
    const beat=time*.0043+i*2.2,step=(1-Math.cos(beat))*.5;
    s.base.position.y+=step*(s.idle ? .025 : .09);
    s.base.position.x+=Math.sin(beat)*.055;
    s.base.rotation.y+=Math.sin(beat*.5)*.085;
    for(const joint of s.joints){
     const swing=Math.sin(beat+.7)*joint.amplitude*joint.sign;
     joint.bone.quaternion.copy(joint.rest);
     joint.bone.rotateOnAxis(joint.axis==='y'?T.Object3D.DEFAULT_UP:joint.axis==='x'?sideAxis:forwardAxis,swing);
    }
    if(action){
     const t=action.t,dir=i?-1:1;
     if(i===action.i){
      const load=Math.sin(Math.PI*clamp(t/.31));
      const drive=Math.sin(Math.PI*clamp((t-.21)/.65));
      const stride=action.travel ? .65 : .16;
      s.base.position.x+=(other.x-from.x)*stride*drive-dir*.31*load;
      s.base.position.z+=(other.z-from.z)*stride*drive;
      s.base.position.y+=drive*(action.travel ? .46 : .24);
      s.base.scale.x*=1+.045*load;s.base.scale.y*=1-.10*load;s.base.scale.z*=1+.045*load;
      s.base.rotation.y+=dir*(.29*drive-.20*load);
      s.base.rotation.x=.13*drive-.09*load;
      s.base.rotation.z=dir*-.055*drive;
     }else if(t>=.53){
      const bump=Math.sin(Math.PI*clamp((t-.53)/.41));
      s.base.position.x-=dir*bump*(action.connects ? .43 : .18);
      s.base.position.y+=bump*(action.miss ? .39 : .20);
      s.base.rotation.x=-.15*bump;
     }
    }
   }
   if(i===winner){
    const t=still.matches?1:clamp((time-finished)/720);
    s.base.rotation.y=T.MathUtils.lerp(angles[i],i?-.1:.13,t);s.base.position.y+=Math.abs(Math.sin(Math.PI*2*t))*(1-t)*.52;
   }
   shadows[i].position.x=s.base.position.x;shadows[i].position.z=s.base.position.z;
  });
  paintSparks();renderer.render(scene,camera);frame=requestAnimationFrame(render);
 }
 function wake(){if(!frame&&!stopped&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(render)}}
 const observer=new IntersectionObserver(rows=>{visible=rows.at(-1).isIntersecting;wake()});observer.observe(field);
 document.addEventListener('visibilitychange',wake);
 field.dataset.world='on';
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;cancelAnimationFrame(frame);delete field.dataset.world;delete field.dataset.mesh0;delete field.dataset.mesh1;observer.disconnect();sizeObserver.disconnect();requests.forEach(c=>c?.abort());document.removeEventListener('visibilitychange',wake)});
 return {select,move,anchors,setRate(value){rate=value},finish(side){winner=side;finished=performance.now();wake()}};
}
