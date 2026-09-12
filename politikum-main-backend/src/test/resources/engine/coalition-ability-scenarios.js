(()=>{
Date.now=()=>100000; const results=[];
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
function state(n){return {G:{players:[{id:'0',name:'You',active:true,hand:[],coalition:[card(`persona_${n}#1`)]},{id:'1',name:'Bob',active:true,hand:[],coalition:[card('persona_2#1',{tags:['faction:liberal'],vpDelta:2}),card('persona_4#1')] }],deck:[card('persona_3')],discard:[],log:[],pending:{kind:({5:'persona_5_pick_liberal',7:'persona_7_swap_two_in_coalition',11:'persona_11_offer'})[n],playerId:'0',sourceCardId:`persona_${n}#1`},turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};}
function check(n,name,move,args=[],edit=()=>{},actor='0'){const s=state(n);edit(s);const before=JSON.stringify(s);const result=applyMove(s,actor,move,args);if(JSON.stringify(s)!==before)throw Error('input changed');delete result.state.G.trace;results.push({name:n+' '+name,result});}
for(const n of [5,7,11]){
 const move={5:'persona5PickLiberal',7:'persona7SwapTwoInCoalition',11:'persona11Use'}[n];const args=n===5?['1','persona_2#1']:n===7?['1','persona_2#1','persona_4#1']:[];
 for(const [name,edit] of Object.entries({valid:s=>{},wrongTurn:s=>s.ctx.currentPlayer='1',noPending:s=>s.G.pending=null,wrongKind:s=>s.G.pending.kind='other',wrongOwner:s=>s.G.pending.playerId='1',missingSource:s=>s.G.players[0].coalition=[],shielded:s=>s.G.players[1].coalition[0].shielded=true,noTargets:s=>s.G.players[1].coalition=[],alreadyDrawn:s=>s.G.hasDrawn=true}))check(n,name,move,args,edit);
 check(n,'wrong actor',move,args,()=>{},'1');
}
for(const args of [['missing','persona_2#1','persona_4#1'],['0','persona_2#1','persona_4#1'],['1','persona_2#1','persona_2#1'],['1','','persona_4#1'],['1','persona_2#1','missing']])check(7,JSON.stringify(args),'persona7SwapTwoInCoalition',args);
check(7,'non persona','persona7SwapTwoInCoalition',['1','persona_2#1','persona_4#1'],s=>s.G.players[1].coalition[0].type='action');
for(const delta of [0,-3,5])check(5,'tokens '+delta,'persona5PickLiberal',['1','persona_2#1'],s=>s.G.players[1].coalition[0].vpDelta=delta);
check(5,'non liberal','persona5PickLiberal',['1','persona_2#1'],s=>s.G.players[1].coalition[0].tags=[]);
for(const name of ['valid','shielded','wrong turn','missing source','bonus44'])check(11,'discard '+name,'persona11DiscardOpponentPersona',['1','persona_2#1'],s=>{s.G.pending.kind='persona_11_pick_opponent_persona';if(name==='shielded')s.G.players[1].coalition[0].shielded=true;if(name==='wrong turn')s.ctx.currentPlayer='1';if(name==='missing source')s.G.players[0].coalition=[];if(name==='bonus44')s.G.players[1].coalition.push(card('persona_44'));});
check(11,'skip','persona11Skip');check(11,'skip wrong turn','persona11Skip',[],s=>s.ctx.currentPlayer='1');
for(const n of [5,7])for(const available of [true,false]){const s=state(n);s.G.pending=null;if(!available)s.G.players[1].coalition=[];const me=s.G.players[0],c=me.coalition[0];runAbility(n===5?'persona_5_discard_liberal_steal_tokens':'persona_7_swap_two_in_coalition',{G:s.G,me,card:c});results.push({name:'entry '+n+' '+available,state:s});}
return JSON.stringify(results);
})()
