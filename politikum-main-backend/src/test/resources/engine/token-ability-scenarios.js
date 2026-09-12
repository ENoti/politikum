(() => {
  Date.now = () => 100000;
  const results = [];
  const keys = {21:'persona_21_on_enter_invert_tokens',26:'persona_26_on_enter_purge_red_inherit_plus',28:'persona_28_on_enter_steal_plus_tokens'};
  const kinds = {21:'persona_21_pick_target_invert',26:'persona_26_pick_red_nationalist',28:'persona_28_pick_non_fbk'};
  const moves = {21:'persona21InvertTokens',26:'persona26PurgeRedNationalist',28:'persona28StealPlusTokens'};
  const card = (id, extra={}) => ({id,name:id,type:'persona',baseVp:1,vp:1,tags:[],...extra});
  function state(n) {
    return {G:{players:[
      {id:'0',name:'You',hand:[],coalition:[card(`persona_${n}#1`,{abilityKey:keys[n]})]},
      {id:'1',name:'Bob',hand:[],coalition:[card('victim',{tags:['faction:red_nationalist'],vpDelta:3,plusTokens:5,minusTokens:2})]},
    ],deck:[],discard:[],log:[],pending:{kind:kinds[n],playerId:'0',sourceCardId:`persona_${n}#1`},turnN:1},
      ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};
  }
  function entry(n, name, configure=()=>{}) {
    const s=state(n); s.G.pending=null; configure(s);
    const me=s.G.players[0], source=me.coalition[0], refs=me.coalition;
    runAbility(keys[n],{G:s.G,me,card:source});
    if(me.coalition!==refs || me.coalition[0]!==source)throw Error('entry lost references');
    results.push({name:`p${n} entry ${name}`,state:s});
  }
  function choose(n,name,configure=()=>{},args=['1','victim'],actor='0') {
    const s=state(n); configure(s); const before=JSON.stringify(s);
    const result=applyMove(s,actor,moves[n],args);
    if(JSON.stringify(s)!==before)throw Error('input mutated');
    if(result.state.G.trace)delete result.state.G.trace;
    results.push({name:`p${n} choice ${name}`,result});
  }
  for(const n of [21,26,28]) {
    entry(n,'valid');
    entry(n,'no opponents',s=>s.G.players[1].coalition=[]);
    entry(n,'shielded',s=>s.G.players[1].coalition[0].shielded=true);
    entry(n,'persona31',s=>s.G.players[1].coalition[0].id='persona_31#1');
    entry(n,'action target',s=>s.G.players[1].coalition[0].type='action');
    entry(n,'blocked',s=>s.G.players[0].coalition[0].blockedAbilities=true);
    entry(n,'own target',s=>{s.G.players[0].coalition.push(s.G.players[1].coalition.pop());});
    entry(n,'name fallback',s=>{s.G.players[0].name='Alice';delete s.G.players[0].coalition[0].name;s.G.players[0].coalition[0].text='Source';});
    choose(n,'valid');
    choose(n,'wrong actor',()=>{},['1','victim'],'1');
    choose(n,'off turn',s=>s.ctx.currentPlayer='1');
    choose(n,'no pending',s=>s.G.pending=null);
    choose(n,'wrong pending',s=>s.G.pending.kind='other');
    choose(n,'missing owner',()=>{},['missing','victim']);
    choose(n,'missing target',()=>{},['1','missing']);
    choose(n,'non-persona',s=>s.G.players[1].coalition[0].type='action');
    choose(n,'shield',s=>s.G.players[1].coalition[0].shielded=true);
    choose(n,'missing actor',s=>s.G.players=s.G.players.slice(1));
    choose(n,'missing source',s=>s.G.players[0].coalition=[]);
    choose(n,'own target',s=>s.G.players[0].coalition.push(s.G.players[1].coalition.pop()),['0','victim']);
    choose(n,'negative balance',s=>Object.assign(s.G.players[1].coalition[0],{vpDelta:-3,plusTokens:2,minusTokens:5}));
    choose(n,'missing counters',s=>{delete s.G.players[1].coalition[0].plusTokens;delete s.G.players[1].coalition[0].minusTokens;});
    choose(n,'name fallback',s=>{s.G.players[0].name='Alice';delete s.G.players[0].coalition[0].name;s.G.players[0].coalition[0].text='Source';delete s.G.players[1].coalition[0].name;});
    choose(n,'numeric string balance',s=>s.G.players[1].coalition[0].vpDelta='2');
  }
  choose(21,'zero with both counters',s=>Object.assign(s.G.players[1].coalition[0],{vpDelta:0,plusTokens:4,minusTokens:4}));
  choose(21,'null counters',s=>Object.assign(s.G.players[1].coalition[0],{plusTokens:null,minusTokens:null}));
  choose(21,'zero explicit counters',s=>Object.assign(s.G.players[1].coalition[0],{plusTokens:0,minusTokens:0}));
  choose(21,'negative missing counters',s=>{s.G.players[1].coalition[0].vpDelta=-3;delete s.G.players[1].coalition[0].plusTokens;delete s.G.players[1].coalition[0].minusTokens;});
  choose(26,'wrong faction',s=>s.G.players[1].coalition[0].tags=['faction:fbk']);
  choose(26,'no tags',s=>delete s.G.players[1].coalition[0].tags);
  choose(26,'persona44 trigger',s=>s.G.players[0].coalition.push(card('persona_44#1')));
  choose(26,'persona31 pending selection',s=>s.G.players[1].coalition[0].id='persona_31#1',['1','persona_31#1']);
  choose(26,'discard source itself',s=>Object.assign(s.G.players[0].coalition[0],{tags:['faction:red_nationalist'],vpDelta:2,plusTokens:2,minusTokens:0}),['0','persona_26#1']);
  for(const amount of [0,1,2,3,8,-1,1.5,null,'2','invalid']) choose(28,`amount ${amount}`,()=>{},['1','victim',amount]);
  choose(28,'fbk rejected',s=>s.G.players[1].coalition[0].tags=['faction:fbk']);
  choose(28,'zero balance',s=>Object.assign(s.G.players[1].coalition[0],{vpDelta:0,plusTokens:0,minusTokens:0}));
  choose(28,'available caps request',s=>Object.assign(s.G.players[1].coalition[0],{vpDelta:1,plusTokens:1,minusTokens:0}),['1','victim',3]);
  choose(28,'self transfer',s=>Object.assign(s.G.players[0].coalition[0],{vpDelta:2,plusTokens:2,minusTokens:0}),['0','persona_28#1',2]);
  entry(26,'wrong faction',s=>s.G.players[1].coalition[0].tags=[]);
  entry(28,'only fbk with plus',s=>s.G.players[1].coalition[0].tags=['faction:fbk']);
  entry(28,'no plus',s=>s.G.players[1].coalition[0].vpDelta=0);
  return JSON.stringify(results);
})()
