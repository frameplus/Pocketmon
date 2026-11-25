'use strict';
function buildField(field){
  const props=field.querySelector('.entrance-props');
  for(const depth of ['near','far']){
    const rig=document.createElement('div');
    rig.className='throw-rig '+depth;
    rig.innerHTML='<i class="thrower"></i><div class="ball-path"><div class="master-ball"><i class="ball-base"></i><i class="ball-lid">M</i><i class="ball-button"></i></div></div><i class="release-light"></i>';
    props.append(rig);
  }
}
