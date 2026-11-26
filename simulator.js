'use strict';
const {Battle, Dex} = require('@pkmn/sim');
const G = require('./public/game.js');
const keys = ['hp','atk','def','spa','spd','spe'];
const nature = 'Serious';
const ivs = Object.fromEntries(keys.map(s=>[s,31]));
const evs = Object.fromEntries(keys.map(s=>[s,0]));

function makeSimulator(data) {
  const species = Dex.species.all();
  const sets = new Map();
  for (const p of data.pokemon) {
    const names = p.types.map(t=>G.englishTypes[t]);
    const matches = s => s.exists && s.num===p.dex && keys.every((k,i)=>s.baseStats[k]===p.stats[i]) && s.types.join()===names.join();
    const canonical = Dex.species.get(p.en.replace(/^Mega (.*?)(?: ([XY]))?$/,(_,name,variant)=>name+'-Mega'+(variant||'')));
    const s = matches(canonical) ? canonical : species.find(matches);
    if (!s) throw Error('No matching simulator form for '+p.en);
    sets.set(p.id,{species:s.name,ability:s.abilities[0],moves:p.moves.map(id=>data.moves[id].en),level:50,nature,ivs,evs,item:''});
  }

  function start(ids,seed){
    const battle=new Battle({formatid:'gen9customgame',seed});
    try{
      ids.forEach((id,i)=>battle.setPlayer('p'+(i+1),{name:'side'+i,team:[{...sets.get(id)}]}));
      battle.makeChoices('team 1','team 1');
      return battle;
    }catch(error){battle.destroy();throw error}
  }

  // Read unboosted entry stats after automatic form changes, before either side attacks.
  function cardProfile(id){
    const battle=start([id,129],[1,2,3,4]);
    try{
      const pokemon=battle.sides[0].active[0],ability=Dex.abilities.get(sets.get(id).ability);
      return {stats:[pokemon.maxhp,...keys.slice(1).map(k=>pokemon.storedStats[k])],ability:ability.name};
    }finally{battle.destroy()}
  }

  function simulate(ids,{seed,record=true}={}) {
    const battle=start(ids,seed);
    try {
      const active = () => battle.sides.map(s=>s.active[0]||s.pokemon[0]);
      // Two of six outcomes charge one side. Forecast and replay take the same draw.
      const finisher={side:battle.random(6)};
      active().forEach(p=>applyJuniorRules(p,finisher));
      const initial = active().map(p=>p.maxhp), events=[];
      let hp=active().map(p=>p.hp), max=initial.slice();
      const contexts=record?observeHits(battle):null;
      for(let round=1;!battle.ended && round<=100;round++){
        const cursor=battle.log.length;
        if(record) contexts.clear();
        const choices=battle.sides.map((side,i)=>choice(side,active()[1-i]));
        battle.makeChoices(...choices);
        if(record){
          const rendered=readTurn(battle.log.slice(cursor),round,hp,max,contexts,cursor);
          events.push(...rendered);
          hp=active().map(p=>p.hp);max=active().map(p=>p.maxhp);
          if(rendered.length){rendered.at(-1).hp=hp.slice();rendered.at(-1).max=max.slice()}
        }
      }
      const winner=['side0','side1'].indexOf(battle.winner);
      return {winner,initial,events,capped:!battle.ended};
    } finally { battle.destroy(); }
  }
  function forecast(ids,count){
    const wins=[0,0,0];
    for(let i=0;i<count;i++){const {winner}=simulate(ids,{record:false});wins[winner===-1?2:winner]++}
    return {wins,count};
  }
  return {simulate,forecast,cardProfile};
}

// Resolve accuracy, type, stats, abilities and criticals in Showdown first.
function applyJuniorRules(pokemon,finisher){
  const original=pokemon.damage;
  let turn=-1,remaining=0;
  pokemon.damage=function(amount,source,effect){
    if(!(amount>0))return 0;
    if(turn!==this.battle.turn){
      turn=this.battle.turn;
      // Shedinja keeps its canonical single HP and gets two opening turns to participate.
      remaining=this.maxhp===1&&turn<=2?0:Math.max(1,Math.floor(this.maxhp*.32));
    }
    const knee=this.maxhp*.20;
    const paced=effect?.effectType==='Move'?Math.min(amount,knee)+Math.max(0,amount-knee)*.30:amount;
    const ordinary=Math.min(remaining,Math.max(1,Math.floor(paced)));
    const charged=turn>=2&&source&&source.side!==this.side&&source.side.n===finisher.side&&
      effect?.effectType==='Move'&&effect.basePower>0&&effect.id===this.battle.activeMove?.id;
    const boosted=charged?Math.min(remaining,ordinary+Math.max(1,Math.floor(ordinary*.25))):ordinary;
    const actual=original.call(this,boosted,source,effect);
    if(charged&&actual>ordinary){
      finisher.side=-1;
      this.battle.add('-arena-finisher',source);
    }
    remaining-=actual;
    return actual;
  };
}

// Both forecast and play use the same policy. The simulator resolves the actual effects.
function choice(side,foe){
  const user=side.active[0], options=side.activeRequest?.active?.[0]?.moves;
  if(!options?.length)return 'default';
  let best=-Infinity,index=-1;
  for(const [i,slot] of options.entries()){
    if(slot.disabled || slot.pp===0)continue;
    const m=Dex.moves.get(slot.id);
    let score;
    if(m.category==='Status')score=m.id==='transform'?100:1;
    else {
      const physical=m.category==='Physical', def=m.overrideDefensiveStat||(physical?'def':'spd');
      const source=m.overrideOffensivePokemon==='target'?foe:user;
      const stat=source.getStat(m.overrideOffensiveStat||(physical?'atk':'spa'),false,true)/Math.max(1,foe.getStat(def,false,true));
      const matchup=Dex.getImmunity(m.type,foe.getTypes())?2**Dex.getEffectiveness(m.type,foe.getTypes()):0;
      let power=m.basePower||45;
      if(m.id==='flail'||m.id==='reversal'){const x=Math.floor(48*user.hp/user.maxhp);power=x<2?200:x<5?150:x<10?100:x<17?80:x<33?40:20}
      if(m.id==='counter'||m.id==='mirrorcoat')power=foe.moveSlots.some(v=>Dex.moves.get(v.id).category===(m.id==='counter'?'Physical':'Special'))?120:0;
      if(m.flags.charge||m.flags.recharge)power/=2;
      if(m.id==='futuresight'||m.id==='doomdesire')power=foe.side.slotConditions[foe.position].futuremove?0:power/2;
      if((m.id==='firstimpression'||m.id==='fakeout')&&user.activeMoveActions>0)power=0;
      if(m.id==='acrobatics'&&!user.item)power*=2;
      if(m.id==='focuspunch'&&foe.moveSlots.some(v=>Dex.moves.get(v.id).category!=='Status'))power*=.15;
      const accuracy=m.accuracy===true?1:m.accuracy/100;
      const immuneAbility=!m.ignoreAbility && (foe.hasAbility('wonderguard')&&matchup<=1 || m.type==='Ground'&&foe.hasAbility('levitate') || m.type==='Water'&&foe.hasAbility(['waterabsorb','stormdrain','dryskin']) || m.type==='Electric'&&foe.hasAbility(['voltabsorb','lightningrod','motordrive']) || m.type==='Fire'&&foe.hasAbility(['flashfire','wellbakedbody']) || m.type==='Grass'&&foe.hasAbility('sapsipper'));
      score=immuneAbility?0:(power*stat*matchup*(user.hasType(m.type)?1.5:1)*accuracy);
      // When another good move is available, vary the next attack.
      if(user.lastMove?.id===m.id)score*=.80;
      if(m.priority>0&&score>0&&score*.44+2>=foe.hp)score+=150;
    }
    if(score>best){best=score;index=i}
  }
  return index<0?'default':'move '+(index+1);
}

// Read the resolved move type and defender's current form at the moment the
// engine logs the hit. Recomputing from the two cards would miss type changes.
function observeHits(battle){
  const contexts=new Map(), add=battle.add;
  battle.add=function(tag,target,...args){
    const move=this.activeMove;
    if(move && target?.getTypes && ['-supereffective','-resisted','-immune','-damage'].includes(tag)){
      const factor=move.moveHitData?.[target.getSlot()]?.typeMod;
      contexts.set(this.log.length,{
        move:Dex.moves.get(move.id).num,type:G.englishTypes.indexOf(move.type),
        defender:target.getTypes().map(t=>G.englishTypes.indexOf(t)),
        factor:Number.isFinite(factor)?2**factor:null
      });
    }
    return add.call(this,tag,target,...args);
  };
  return contexts;
}

function readTurn(lines,round,startHp,startMax,contexts,cursor){
  const hp=startHp.slice(),max=startMax.slice(),events=[];
  let event;
  const side=s=>s?.startsWith('p1')?0:s?.startsWith('p2')?1:-1;
  function begin(i,kind,move=0){
    event={i,j:1-i,kind,move,round,damage:0,crit:false,hit:true,effect:'',reason:'',hp:hp.slice(),max:max.slice()};
    events.push(event);
  }
  for(let n=0;n<lines.length;n++){
    const context=contexts.get(cursor+n);
    let fields=lines[n].split('|');
    if(fields[1]==='split'){fields=lines[n+1].split('|');n+=2}
    const [,tag,actor,val,...extra]=fields,i=side(actor);
    if(i<0)continue;
    if(context&&event?.kind==='move'&&event.move===context.move&&i===event.j&&context.type>0)event.matchup=context;
    if(tag==='move'){begin(i,'move',Dex.moves.get(val).num);continue}
    if(tag==='cant'){begin(i,'cant');event.reason=val;continue}
    if(tag==='-damage'||tag==='-heal'||tag==='-sethp'){
      const values=val.match(/^(\d+)(?:\/(\d+))?/);if(!values)continue;
      const delta=hp[i]-Number(values[1]),from=extra.find(v=>v.startsWith('[from] '));
      if(!event||from||tag==='-heal') {begin(i,tag==='-heal'?'heal':'indirect');event.reason=from?.slice(7)||''}
      hp[i]=Number(values[1]);if(values[2])max[i]=Number(values[2]);
      if(event.kind==='move'&&i===event.j)event.damage+=Math.max(0,delta);
      else if(event.kind!=='move')event.damage=Math.abs(delta);
      event.hp=hp.slice();event.max=max.slice();continue;
    }
    if(!event||event.kind!=='move')continue;
    if(tag==='-arena-finisher'&&i===event.i)event.finisher=true;
    if(tag==='-crit')event.crit=true;
    if(tag==='-supereffective')event.effect='strong';
    if(tag==='-resisted')event.effect='weak';
    if(tag==='-immune'){event.effect='immune';event.reason=[val,...extra].find(v=>v?.startsWith('[from] '))?.slice(7)||''}
    if(tag==='-miss'){event.hit=false;event.effect='miss'}
    if(tag==='-fail')event.effect='fail';
    if(tag==='-prepare')event.effect='prepare';
  }
  return events;
}
module.exports={makeSimulator};
