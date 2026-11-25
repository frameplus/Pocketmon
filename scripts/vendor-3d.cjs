const fs=require('node:fs'),path=require('node:path');
const from='node_modules/three/',out='public/vendor/three/';
for(const file of ['LICENSE','build/three.module.min.js','build/three.core.min.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/loaders/DRACOLoader.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/libs/draco/gltf/draco_decoder.wasm','examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js']){
 fs.mkdirSync(path.dirname(out+file),{recursive:true});fs.copyFileSync(from+file,out+file);
}
