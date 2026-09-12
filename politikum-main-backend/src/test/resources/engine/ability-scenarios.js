(() => {
  Date.now = () => 100000;
  const results = [];
  const card = (id, extra = {}) => ({id, name:id, type:'persona', baseVp:1, vp:1, tags:[], ...extra});
  const red = id => card(id, {tags:['faction:red_nationalist']});
  function state(coalition) {
    return {G:{players:[{id:'0',name:'You',hand:[],coalition},{id:'1',name:'Bob',hand:[],coalition:[]}],
      deck:[],discard:[],log:[],pending:null,turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};
  }
  function ability(name, coalition, index, configure = () => {}, around = false) {
    const s = state(coalition); configure(s.G);
    const p = s.G.players[0], c = p.coalition[index], ref = p.coalition;
    if(around) applyAdjacencyBonusesAround(s.G,p,c); else runAbility(c.abilityKey,{G:s.G,me:p,card:c});
    if(ref !== p.coalition || c !== p.coalition[index]) throw Error('card identity lost');
    results.push({name,state:s});
  }
  const adjacent = extra => card('persona_8#1',{abilityKey:'on_enter_adjacent_bonus',params:{neighbors:['persona_9'],tokens:4},...extra});
  ability('both neighbors', [card('persona_9#1'),adjacent(),card('persona_9#2')],1);
  ability('no match',[card('persona_6'),adjacent()],1);
  ability('already awarded',[card('persona_9#1',{_adjBonusApplied:true}),adjacent({_adjBonusApplied:true})],1);
  ability('blocked',[card('persona_9#1'),adjacent({blockedAbilities:true})],1);
  ability('neighbor hook',[adjacent(),card('persona_9#1')],1,()=>{},true);
  ability('blocked neighbor hook',[adjacent({blockedAbilities:true}),card('persona_9#1')],1,()=>{},true);
  ability('non persona neighbor',[card('persona_9#1',{type:'action'}),adjacent()],1);
  const twitter = card('persona_4#1',{abilityKey:'persona_4_on_enter_twitter_penalty'});
  ability('no twitter',[twitter],0);
  ability('two twitter',[{...twitter}],0,g=>g.discard=[{tags:['event_type:twitter_squabble']},{tags:[]},{tags:['event_type:twitter_squabble']}]);
  const p12 = () => card('persona_12#1',{abilityKey:'persona_12_on_enter_adjacent_red_buff'});
  ability('red left',[red('left'),p12(),card('right')],1);
  ability('red right',[card('left'),p12(),red('right')],1);
  ability('two red',[red('left'),p12(),red('right')],1);
  ability('shielded red',[red('left'),p12(),red('right')],1,g=>g.players[0].coalition.forEach(c=>c.shielded=true));
  function choice(name, target, actor='0', configure=()=>{}) {
    const s=state([red('left'),p12(),red('right')]);
    s.G.pending={kind:'persona_12_choose_adjacent_red',playerId:'0',sourceCardId:'persona_12#1',leftId:'left',rightId:'right'};
    configure(s); const before=JSON.stringify(s);
    const result=applyMove(s,actor,'persona12ChooseAdjacentRed',target===undefined?[]:[target]);
    if(JSON.stringify(s)!==before)throw Error('input changed');
    if(result.state.G.trace)delete result.state.G.trace;
    results.push({name,result});
  }
  choice('choose left','left'); choice('choose right','right');
  choice('wrong seat','left','1'); choice('wrong target','unknown');
  choice('shielded target','left','0',s=>s.G.players[0].coalition[0].shielded=true);
  choice('auto single',undefined,'0',s=>s.G.players[0].coalition[0].shielded=true);
  choice('no candidates',undefined,'0',s=>s.G.players[0].coalition.forEach(c=>c.shielded=true));
  choice('wrong pending','left','0',s=>s.G.pending.kind='other');
  choice('wrong current','left','0',s=>s.ctx.currentPlayer='1');
  choice('wrong owner','left','0',s=>s.G.pending.playerId='1');
  function retaliate(name, move='persona13PickTarget', actor='0', owner='1', target='victim', configure=()=>{}) {
    const s=state([]);
    s.ctx.currentPlayer='1';
    s.G.players[1].coalition=[card('victim')];
    s.G.pending={kind:'persona_13_pick_target',playerId:'0',attackerId:'1',sourceCardId:'action_4'};
    configure(s); const before=JSON.stringify(s);
    const result=applyMove(s,actor,move,[owner,target]);
    if(JSON.stringify(s)!==before)throw Error('input changed');
    if(result.state.G.trace)delete result.state.G.trace;
    results.push({name,result});
  }
  retaliate('p13 valid off-turn');
  retaliate('p13 wrong actor','persona13PickTarget','1');
  retaliate('p13 wrong owner','persona13PickTarget','0','0');
  retaliate('p13 missing target','persona13PickTarget','0','1','missing');
  retaliate('p13 shield','persona13PickTarget','0','1','victim',s=>s.G.players[1].coalition[0].shielded=true);
  retaliate('p13 action target','persona13PickTarget','0','1','victim',s=>s.G.players[1].coalition[0].type='action');
  retaliate('p13 wrong pending','persona13PickTarget','0','1','victim',s=>s.G.pending.kind='other');
  retaliate('p13 missing attacker','persona13PickTarget','0','1','victim',s=>s.G.pending.attackerId='missing');
  retaliate('p13 skip','persona13Skip');
  retaliate('p13 skip wrong actor','persona13Skip','1');
  retaliate('p13 skip wrong pending','persona13Skip','0','1','victim',s=>s.G.pending=null);
  const p33 = extra => card('persona_33#1', {abilityKey:'persona_33_on_enter_choose_faction', ...extra});
  ability('p33 enter', [p33()], 0);
  ability('p33 blocked entry', [p33({blockedAbilities:true})], 0);
  function faction(name, tag='faction:liberal', actor='0', configure=()=>{}) {
    const s=state([p33()]);
    s.G.pending={kind:'persona_33_choose_faction',playerId:'0',sourceCardId:'persona_33#1'};
    configure(s); const before=JSON.stringify(s);
    const result=applyMove(s,actor,'persona33ChooseFaction',tag===undefined?[]:[tag]);
    if(JSON.stringify(s)!==before)throw Error('input changed');
    if(result.state.G.trace)delete result.state.G.trace;
    results.push({name,result});
  }
  for (const tag of ['liberal','rightwing','leftwing','fbk','red_nationalist','system','neutral']) {
    faction('p33 faction '+tag,'faction:'+tag);
  }
  faction('p33 unknown faction','faction:unknown');
  faction('p33 missing prefix','liberal');
  faction('p33 empty','');
  faction('p33 null',null);
  faction('p33 wrong actor','faction:fbk','1');
  faction('p33 wrong pending','faction:fbk','0',s=>s.G.pending.kind='other');
  faction('p33 no pending','faction:fbk','0',s=>s.G.pending=null);
  faction('p33 missing player','faction:fbk','0',s=>s.G.players=s.G.players.slice(1));
  faction('p33 missing card','faction:fbk','0',s=>s.G.players[0].coalition=[]);
  faction('p33 off turn','faction:fbk','0',s=>s.ctx.currentPlayer='1');
  faction('p33 replace faction','faction:fbk','0',s=>s.G.players[0].coalition[0].chosenFactionTag='faction:liberal');
  faction('p33 blocked existing choice','faction:fbk','0',s=>s.G.players[0].coalition[0].blockedAbilities=true);
  faction('p33 text fallback','faction:system','0',s=>{s.G.players[0].name='Alice'; delete s.G.players[0].coalition[0].name; s.G.players[0].coalition[0].text='Persona text';});
  faction('p33 base name fallback','faction:neutral','0',s=>delete s.G.players[0].coalition[0].name);
  faction('p33 first matching card','faction:leftwing','0',s=>{s.G.players[0].coalition.push(p33({id:'persona_33#2'}));s.G.pending.sourceCardId='persona_33#2';});
  return JSON.stringify(results);
})()
