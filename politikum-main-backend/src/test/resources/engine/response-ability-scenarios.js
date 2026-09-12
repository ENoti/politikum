(()=>{
Date.now=()=>100000;const results=[];
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
function state(n){const played=card('persona_5#1'),action=card('action_4#1',{type:'action'});return {G:{players:[{id:'0',name:'Alice',active:true,hand:[],coalition:[played,card('persona_6')]},{id:'1',name:'You',active:true,hand:[card('action_'+n+'#r',{type:'action'})],coalition:[card('persona_8'),card('persona_10'),card('persona_29'),card('persona_44')]}],deck:[card('persona_3')],discard:[],log:[],response:{kind:n===8?'cancel_persona':'cancel_action',playedBy:'0',personaCard:played,actionCard:action,expiresAtMs:105000,allowPersona10By:'1',persona8Swap:{playerId:'1',ownerId:'0',playedPersonaId:played.id}},pending:n===8?{kind:'resolve_persona_after_response',playerId:'0',personaId:played.id,sourceCardId:played.id}:{kind:'action_4_discard',attackerId:'0',targetId:'1',sourceCardId:action.id},turnN:1,hasDrawn:true,hasPlayed:true},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};}
function check(n,name,move='playAction',edit=()=>{},actor='1'){const s=state(n);edit(s);const before=JSON.stringify(s),result=applyMove(s,actor,move,['action_'+n+'#r']);if(JSON.stringify(s)!==before)throw Error('input changed');delete result.state.G.trace;results.push({name:n+' '+move+' '+name,result});}
for(const n of [6,8,14])for(const [name,edit] of Object.entries({valid:s=>{},noResponse:s=>s.G.response=null,wrongKind:s=>s.G.response.kind='other',selfPlayed:s=>s.G.response.playedBy='1',wrongTarget:s=>s.G.pending.targetId='0',wrongPending:s=>s.G.pending.kind='other',noHand:s=>s.G.players[1].hand=[],notAction:s=>s.G.players[1].hand[0].type='persona',expired:s=>s.G.response.expiresAtMs=98000,grace:s=>s.G.response.expiresAtMs=99500,onTurn:s=>s.ctx.currentPlayer='1',protected33:s=>{s.G.response.personaCard.id='persona_33';s.G.players[0].coalition[0].id='persona_33';},missingPlayed:s=>s.G.players[0].coalition.shift()}))check(n,name,'playAction',edit);
for(const move of ['persona8SwapWithPlayedPersona','persona10CancelFromHand','persona10CancelFromCoalition'])for(const [name,edit]of Object.entries({valid:s=>{},expired:s=>s.G.response.expiresAtMs=99000,noResponse:s=>s.G.response=null,wrongKind:s=>s.G.response.kind='other',wrongOwner:s=>{s.G.response.allowPersona10By='0';s.G.response.persona8Swap.playerId='0';},noSource:s=>s.G.players[1].coalition=[],wrongPending:s=>s.G.pending.kind='other',duplicateHand:s=>s.G.players[1].hand.push(s.G.response.personaCard)}))check(move.startsWith('persona8')?8:6,name,move,edit);
// Response creation through real public moves.
for(const mode of ['none','human','bot','lazerson','inactive','protected33']){const s=state(8);s.G.response=null;s.G.pending=null;s.G.hasPlayed=false;s.G.players[0].coalition=[];s.G.players[0].hand=[card(mode==='protected33'?'persona_33':'persona_35',{abilityKey:mode==='protected33'?'persona_33_on_enter_choose_faction':'persona_35_no_ability'})];s.G.players[1].coalition=mode==='lazerson'?[card('persona_8')]:[];s.G.players[1].hand=['human','bot','protected33'].includes(mode)?[card('action_8',{type:'action'})]:[];if(mode==='bot')s.G.players[1].isBot=true;if(mode==='inactive')s.G.players[1].active=false;const result=applyMove(s,'0','playPersona',[s.G.players[0].hand[0].id]);delete result.state.G.trace;results.push({name:'create '+mode,result});}
for(const n of [5,7,11,17,45])for(const mode of ['valid','empty','played','steal']) {
 const s=state(8);s.G.response=null;s.G.players[0].isBot=true;s.G.players[0].name='[B] Alice';s.G.hasPlayed=mode==='played';s.G.hasDrawn=mode==='played';
 s.G.players[0].coalition=[card('persona_'+n),card('persona_4')];s.G.players[1].coalition=[card('persona_2',{tags:['faction:liberal'],vpDelta:3})];s.G.players[1].hand=[card('persona_2#hand')];
 if(mode==='empty'){s.G.players[1].hand=[];s.G.players[1].coalition=[];s.G.players[0].coalition=[card('persona_'+n)];}
 s.G.pending={kind:({5:'persona_5_pick_liberal',7:'persona_7_swap_two_in_coalition',11:'persona_11_offer',17:mode==='steal'?'persona_17_pick_persona_from_hand':'persona_17_pick_opponent',45:'persona_45_steal_from_opponent'})[n],playerId:'0',sourceCardId:'persona_'+n,targetId:'1'};
 Math.random=()=>0.25;const before=JSON.stringify(s),result=applyMove(s,'0','tickBot',[]);if(JSON.stringify(s)!==before)throw Error('bot changed input');delete result.state.G.trace;results.push({name:'bot '+n+' '+mode,result});
}
for(const mode of ['valid','wrong actor','unknown','no pending','action7']) {
 const s=state(8);s.G.response=null;s.G.pending={kind:mode==='unknown'?'unknown':mode==='action7'?'action_7_block_persona':'persona_16_discard3_from_hand',playerId:'0'};
 if(mode==='no pending')s.G.pending=null;
 if(mode==='action7'){s.G.lastAction=card('action_7',{type:'action'});s.G.discard=[s.G.lastAction];}
 const result=applyMove(s,mode==='wrong actor'?'1':'0','cancelPending',[]);delete result.state.G.trace;results.push({name:'cancel '+mode,result});
}
for(const n of [4,9,17])for(const source of [true,false]) {
 const s=state(6);s.G.pending=null;s.G.response=null;s.G.hasPlayed=false;s.G.players[0].hand=[card('action_'+n,{type:'action'})];if(!source)s.G.players[1].coalition=[];
 const result=applyMove(s,'0','playAction',['action_'+n,'1']);delete result.state.G.trace;results.push({name:'open action '+n+' '+source,result});
}
for(const n of [6,8,14])for(const expiry of [99100,99101,99099,100000])check(n,'deadline '+expiry,'playAction',s=>s.G.response.expiresAtMs=expiry);
return JSON.stringify(results);
})()
