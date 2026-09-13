(()=>{
Date.now=()=>100000;Math.random=()=>0.25;const results=[];
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
const event=id=>({...JSON.parse(JSON.stringify(POLITIKUM_CARDS[id])),id:id+'#test'});
const ids=['event_1','event_2','event_3','event_10','event_11','event_12a','event_12b','event_12c','event_15','event_16'];
function state(){return {G:{players:[{id:'0',name:'You',active:true,hand:[card('persona_2#hand')],coalition:[card('persona_4',{tags:['faction:fbk']}),card('persona_38')]},{id:'1',name:'Анна',active:true,hand:[card('persona_3#hand'),card('action_1',{type:'action'})],coalition:[card('persona_44'),card('persona_22',{tags:['faction:liberal']})]},{id:'2',name:'Bob',active:true,hand:[card('persona_5#hand')],coalition:[card('persona_15',{tags:['faction:fbk','faction:liberal']})]}],deck:[card('persona_1#deck'),card('persona_2#deck'),card('persona_3#deck')],discard:[],log:[],pending:null,response:null,turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:7};}
function record(name,s){results.push({name,state:JSON.parse(JSON.stringify(s))});}
function move(name,s,actor,op,args=[]){const before=JSON.stringify(s),result=applyMove(s,actor,op,args);if(JSON.stringify(s)!==before)throw Error(name+': input mutation');delete result.state.G.trace;results.push({name,result});return result;}
for(const id of ids)for(const mode of ['plain','empty','shielded','inactive','bots','blocked','event next']){
 const s=state(),c=event(id),me=s.G.players[0];
 if(mode==='empty'){s.G.players.forEach(p=>{p.coalition=[];p.hand=[];});s.G.deck=[];}
 if(mode==='shielded')s.G.players.forEach(p=>p.coalition.forEach(c=>c.shielded=true));
 if(mode==='inactive')s.G.players[1].active=false;
 if(mode==='bots'){s.G.players[1].name='[B] Anna';s.G.players[2].isBot=true;}
 if(mode==='blocked')c.blockedAbilities=true;
 if(mode==='event next')s.G.deck.unshift(event('event_12b'));
 runAbility(c.abilityKey,{G:s.G,me,card:c});record('entry '+id+' '+mode,s);
}
for(const id of ids)for(const source of ['ability','event_11','event_10','event_15','event_12a','event_12c']){
 const s=state();s.G.deck.unshift(event(id));drawNCards({G:s.G,me:s.G.players[0],source,count:2});record('draw '+id+' from '+source,s);
}
for(const id of ids){
 let s=state();s.G.deck.unshift(event(id));move('turn '+id,s,'0','beginTurnDraw');
 s=state();s.G.deck.unshift(event(id));s.G.pending={kind:'hand_limit_discard_before_draw',playerId:'0',remaining:1};move('limit '+id,s,'0','discardBeforeDrawForHandLimit',['persona_2#hand']);
 s=state();s.G.players[0].isBot=true;s.G.players[0].name='[B] Bot';s.G.deck.unshift(event(id));move('bot draw '+id,s,'0','tickBot');
}
for(const mode of ['plain','wrong actor','missing card','no pending','duplicate targets','deferred','alias']){
 const s=state();s.G.pending={kind:'event_12b_discard_from_hand',playerId:'0',sourceCardId:mode==='alias'?'event_custom':'event_12b',targetIds:mode==='duplicate targets'?['1','1','2']:['1','2']};
 if(mode==='no pending')s.G.pending=null;
 if(mode==='deferred')s.G.pendingDeferred={kind:'other',playerId:'0'};
 const first=move('12b '+mode,s,mode==='wrong actor'?'0':'1','discardFromHandForEvent12b',[mode==='missing card'?'missing':'persona_3#hand']);
 if(first.ok){const second=move('12b second '+mode,first.state,'2','discardFromHandForEvent12b',['persona_5#hand']);move('12b repeat '+mode,second.state,'1','discardFromHandForEvent12b',['action_1']);}
}
for(const mode of ['plain','protected','immovable','wrong actor','no pending','nonpersona','missing card','event10','event12b','event16','empty','alias']){
 const s=state();s.G.pending={kind:'event_16_discard_self_persona_then_draw1',playerId:'0',sourceCardId:mode==='alias'?'event_custom':'event_16'};
 if(mode==='protected')s.G.players[0].coalition[0].shielded=true;
 if(mode==='immovable')s.G.players[0].coalition[0].id='persona_31';
 if(mode==='nonpersona')s.G.players[0].coalition[0].type='action';
 if(mode==='no pending')s.G.pending=null;
 if(mode.startsWith('event'))s.G.deck.unshift(event('event_'+mode.slice(5)));
 if(mode==='empty')s.G.deck=[];
 move('16 '+mode,s,mode==='wrong actor'?'1':'0','discardPersonaFromOwnCoalitionForEvent16',[mode==='missing card'?'missing':s.G.players[0].coalition[0].id]);
 const bot=JSON.parse(JSON.stringify(s));bot.G.players[0].isBot=true;bot.G.players[0].name='[B] Bot';bot.G.hasDrawn=true;move('16 bot '+mode,bot,'0','tickBot');
}
for(const id of ids){const s=state();s.G.persona16AfterEvents={playerId:'0',sourceCardId:'persona_16',events:[event(id),event('event_15')]};move('queued '+id,s,'0','tick');}
return JSON.stringify(results);
})()
