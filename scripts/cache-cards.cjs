// Freeze the same level-50 profiles the battle engine uses into the offline Pokédex.
const fs=require('node:fs');
const {makeSimulator}=require('../simulator');
const filename=require.resolve('../public/dex.json');
const data=JSON.parse(fs.readFileSync(filename,'utf8'));
const engine=makeSimulator(data);
const key=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Map(Object.entries(data.abilityNames).map(([en,ko])=>[key(en),ko]));
for(const p of data.pokemon){
  const {stats,ability:en}=engine.cardProfile(p.id);
  const ko=names.get(key(en));
  if(!ko)throw Error('Missing Korean ability for '+p.en+' / '+en);
  p.battleStats=stats;
  p.ability={ko,en};
}
fs.writeFileSync(filename,JSON.stringify(data));
