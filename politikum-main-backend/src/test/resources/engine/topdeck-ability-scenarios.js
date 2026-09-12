(() => {
  Date.now=()=>100000;
  const results=[];
  const card=(id,extra={})=>({id,name:id,type:'persona',tags:[],baseVp:1,vp:1,...extra});
  function state() {
    return {G:{players:[{id:'0',name:'You',hand:[],coalition:[card('persona_34#1',{abilityKey:'persona_34_on_enter_guess_topdeck'})]},
      {id:'1',name:'Bob',hand:[],coalition:[]}],deck:[card('persona_5#2'),card('persona_6')],discard:[],log:[],
      pending:{kind:'persona_34_guess_topdeck',playerId:'0',sourceCardId:'persona_34#1'},turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};
  }
  function entry(name,configure=()=>{}) {
    const s=state();s.G.pending=null;configure(s);
    const me=s.G.players[0],source=me.coalition[0];
    runAbility(source.abilityKey,{G:s.G,me,card:source});
    if(me.coalition[0]!==source)throw Error('entry lost source identity');
    results.push({name:'entry '+name,state:s});
  }
  function guess(name,value='persona_5',configure=()=>{},actor='0') {
    const s=state();configure(s);const before=JSON.stringify(s),deck=JSON.stringify(s.G.deck);
    const result=applyMove(s,actor,'persona34GuessTopdeck',[value]);
    if(JSON.stringify(s)!==before)throw Error('input changed');
    if(JSON.stringify(result.state.G.deck)!==deck)throw Error('deck changed');
    if(result.state.G.trace)delete result.state.G.trace;
    const followup=applyMove(result.state,actor,'persona34GuessTopdeck',[value]);
    if(result.state.ctx.gameover && (followup.ok || followup.error!=='gameover'))throw Error('move accepted after victory');
    results.push({name,result,followup:{ok:followup.ok,error:followup.error}});
  }
  entry('valid');
  entry('blocked',s=>s.G.players[0].coalition[0].blockedAbilities=true);
  entry('name fallback',s=>{s.G.players[0].name='Alice';delete s.G.players[0].coalition[0].name;});
  guess('correct');
  guess('incorrect','persona_6');
  guess('unknown id','persona_unknown');
  guess('instance id does not match base','persona_5#2');
  guess('skip','skip');
  guess('empty','');
  guess('null',null);
  guess('numeric',5);
  guess('wrong actor','persona_5',()=>{},'1');
  guess('wrong pending','persona_5',s=>s.G.pending.kind='other');
  guess('missing pending','persona_5',s=>s.G.pending=null);
  guess('missing player','persona_5',s=>s.G.players=s.G.players.slice(1));
  guess('off turn','persona_5',s=>s.ctx.currentPlayer='1');
  guess('missing source','persona_5',s=>s.G.players[0].coalition=[]);
  guess('blocked source pending','persona_5',s=>s.G.players[0].coalition[0].blockedAbilities=true);
  guess('empty deck','persona_5',s=>s.G.deck=[]);
  guess('missing deck','persona_5',s=>delete s.G.deck);
  guess('null deck','persona_5',s=>s.G.deck=null);
  guess('non-array deck','persona_5',s=>s.G.deck={});
  guess('actions and events only','persona_5',s=>s.G.deck=[card('action',{type:'action'}),card('event',{type:'event'})]);
  guess('skip actions and events','persona_5',s=>s.G.deck.unshift(card('action',{type:'action'}),card('event',{type:'event'})));
  guess('skip nulls without counting','persona_5',s=>s.G.deck.unshift(null,card('action',{type:'action'}),null));
  guess('source text fallback','persona_5',s=>{s.G.players[0].name='Alice';delete s.G.players[0].coalition[0].name;s.G.players[0].coalition[0].text='Oracle';});
  guess('no source name','skip',s=>delete s.G.players[0].coalition[0].name);
  guess('game already over','persona_5',s=>{s.G.gameOver=true;s.ctx.gameover=true;});
  guess('winner overwritten on success','persona_5',s=>s.G.winnerId='1');
  return JSON.stringify(results);
})()
