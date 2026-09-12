(() => {
  Date.now=()=>100000;
  const results=[];
  const card=(id,extra={})=>({id,name:id,type:'persona',tags:[],baseVp:1,vp:1,...extra});
  const action=(id,extra={})=>card(id,{type:'action',...extra});
  const keys={20:'persona_20_on_enter_take_from_discard',32:'persona_32_activate_bounce'};
  const kinds={20:'persona_20_pick_from_discard',32:'persona_32_pick_bounce_target'};
  function state(n) {
    return {G:{players:[{id:'0',name:'You',hand:[],coalition:[card(`persona_${n}#1`,{abilityKey:keys[n]}),card('target',{vpDelta:2,plusTokens:3,minusTokens:1})]},
      {id:'1',name:'Bob',hand:[],coalition:[]}],deck:[],discard:[action('action_4#1'),action('action_5#1')],log:[],pending:{kind:kinds[n],playerId:'0',sourceCardId:`persona_${n}#1`},turnN:1},
      ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};
  }
  function entry(n,name,configure=()=>{}) {
    const s=state(n);s.G.pending=null;configure(s);
    const me=s.G.players[0],source=me.coalition[0];
    runAbility(keys[n],{G:s.G,me,card:source});
    if(me.coalition[0]!==source)throw Error('source identity lost');
    if(n===20 && me.hand.length && me.hand[0]!==s.G.discard.find(c=>c.id===me.hand[0].id))throw Error('legacy single-card alias changed');
    results.push({name:`p${n} entry ${name}`,state:s});
  }
  function choice(n,name,configure=()=>{},target=n===20?'action_4#1':'target',actor='0',move=n===20?'persona20PickFromDiscard':'persona32BounceToHand') {
    const s=state(n);configure(s);const before=JSON.stringify(s);
    const result=applyMove(s,actor,move,[target]);
    if(JSON.stringify(s)!==before)throw Error('input mutated');
    if(result.state.G.trace)delete result.state.G.trace;
    results.push({name:`p${n} choice ${name}`,result});
  }
  for(const n of [20,32]) {
    entry(n,'valid');
    entry(n,'blocked',s=>s.G.players[0].coalition[0].blockedAbilities=true);
    entry(n,'name fallback',s=>{s.G.players[0].name='Alice';delete s.G.players[0].coalition[0].name;});
    choice(n,'valid');
    choice(n,'wrong actor',()=>{},undefined,'1');
    choice(n,'off turn',s=>s.ctx.currentPlayer='1');
    choice(n,'no pending',s=>s.G.pending=null);
    choice(n,'wrong pending',s=>s.G.pending.kind='other');
    choice(n,'missing target',()=>{},'missing');
    choice(n,'missing player',s=>s.G.players=s.G.players.slice(1));
    choice(n,'missing source',s=>s.G.players[0].coalition.shift());
    choice(n,'existing hand order',s=>s.G.players[0].hand=[card('existing')]);
  }
  entry(20,'empty discard',s=>s.G.discard=[]);
  entry(20,'only persona and event',s=>s.G.discard=[card('persona'),card('event',{type:'event'})]);
  entry(20,'single action',s=>s.G.discard=[action('action_4#1')]);
  entry(20,'single mixed discard',s=>s.G.discard=[card('persona'),action('action_4#1'),card('event',{type:'event'})]);
  entry(20,'single text title',s=>s.G.discard=[action('action_4#1',{text:'Action text',name:'Other name'})]);
  entry(20,'single id fallback',s=>{s.G.discard=[action('action_4#1')];delete s.G.discard[0].name;});
  choice(20,'persona accepted',s=>s.G.discard=[card('persona')],'persona');
  choice(20,'event rejected',s=>s.G.discard=[card('event',{type:'event'})],'event');
  choice(20,'other type accepted',s=>s.G.discard=[card('other',{type:'custom'})],'other');
  choice(20,'empty discard',s=>s.G.discard=[]);
  choice(20,'raw action title',s=>s.G.discard[0].text='  Custom title  ');
  choice(20,'unknown action fallback',s=>s.G.discard=[action('action_999#1')],'action_999#1');
  choice(20,'duplicate id takes first',s=>s.G.discard=[action('action_4#1',{text:'First'}),action('action_4#1',{text:'Second'})]);
  choice(32,'action rejected',s=>s.G.players[0].coalition[1].type='action');
  choice(32,'shielded allowed',s=>s.G.players[0].coalition[1].shielded=true);
  choice(32,'blocked target allowed',s=>s.G.players[0].coalition[1].blockedAbilities=true);
  choice(32,'source itself',()=>{},'persona_32#1');
  choice(32,'opponent card rejected',s=>{s.G.players[1].coalition.push(s.G.players[0].coalition.pop());});
  choice(32,'source text fallback',s=>{delete s.G.players[0].coalition[0].name;s.G.players[0].coalition[0].text='Bounce';delete s.G.players[0].coalition[1].name;});
  choice(32,'does not trigger discard bonus',s=>s.G.players[1].coalition.push(card('persona_44#1')));
  for(const [name,configure,actor] of [
    ['cancel',()=>{},'0'],['cancel wrong actor',()=>{},'1'],['cancel wrong pending',s=>s.G.pending.kind='other','0'],
    ['cancel no pending',s=>s.G.pending=null,'0'],['cancel off turn',s=>s.ctx.currentPlayer='1','0'],
    ['cancel missing player',s=>s.G.players=s.G.players.slice(1),'0'],['cancel flag false',s=>s.G.pending.cancellable=false,'0'],
  ]) choice(32,name,configure,'',actor,'persona32CancelBounce');
  return JSON.stringify(results);
})()
