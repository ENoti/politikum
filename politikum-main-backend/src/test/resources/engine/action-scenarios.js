(()=>{
Date.now=()=>100000;Math.random=()=>0.25;const results=[];
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:3,vpDelta:2,plusTokens:2,...extra});
const action=n=>card('action_'+n+'#test',{type:'action'});
function state(){return {G:{players:[{id:'0',name:'You',active:true,hand:[],coalition:[card('persona_2#self'),card('persona_44')]},{id:'1',name:'Анна',active:true,hand:[],coalition:[card('persona_3#target'),card('persona_13')]},{id:'2',name:'Bob',active:true,hand:[],coalition:[card('persona_22'),card('persona_15')]}],deck:[card('persona_1#deck'),card('persona_2#deck')],discard:[card('persona_6#discard')],log:[],pending:null,response:null,turnN:1,hasDrawn:true,hasPlayed:false},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:7};}
function move(name,s,actor,op,args=[]){const before=JSON.stringify(s),result=applyMove(s,actor,op,args);if(JSON.stringify(s)!==before)throw Error(name+': input mutation');delete result.state.G.trace;results.push({name,result});return result;}
const numbers=[4,5,6,7,8,9,13,14,17,18,99];
for(const n of numbers)for(const mode of ['plain','bot target','bot flag','empty target','shielded','immovable','no discard','wrong actor','self target','missing target','not drawn','already played','pending','response','expired response','named','round end']){
 const s=state(),c=action(n);s.G.players[0].hand=[c];
 if(mode==='bot target')s.G.players[1].name='[B] Anna';
 if(mode==='bot flag')s.G.players[1].isBot=true;
 if(mode==='empty target')s.G.players[1].coalition=[];
 if(mode==='shielded')s.G.players[1].coalition[0].shielded=true;
 if(mode==='immovable')s.G.players[1].coalition[0]=card('persona_31');
 if(mode==='no discard')s.G.discard=[card('persona_31')];
 if(mode==='not drawn')s.G.hasDrawn=false;
 if(mode==='already played')s.G.hasPlayed=true;
 if(mode==='pending')s.G.pending={kind:'other'};
 if(mode.includes('response'))s.G.response={kind:'cancel_action',playedBy:'2',expiresAtMs:mode==='response'?110000:90000};
 if(mode==='named'){c.text='Особое название';c.name='Name';}
 if(mode==='round end'){s.G.roundEnding=true;s.G.roundEndTurn=1;}
 move('play '+n+' '+mode,s,mode==='wrong actor'?'1':'0','playAction',[c.id,mode==='self target'?'0':mode==='missing target'?'missing':'1']);
}
const choices=[['blockPersonaForAction7','action_7_block_persona',7],['shieldPersonaForAction13','action_13_shield_persona',13],['applyAction17ToPersona','action_17_choose_opponent_persona',17],['pickPersonaFromDiscardForAction18','action_18_pick_persona_from_discard',18]];
for(const [op,kind,n]of choices)for(const mode of ['plain','shielded','immovable','special36','special38','special41','special43','not persona','missing card','wrong actor','missing owner','no pending','response','expired response','round end']){
 const s=state();s.G.pending={kind,attackerId:'0'};s.G.lastAction=action(n);s.G.hasPlayed=true;
 let c=card('persona_3#choice');if(mode==='shielded')c.shielded=true;if(mode==='immovable')c.id='persona_31';if(mode.startsWith('special'))c.id='persona_'+mode.slice(7);if(mode==='not persona')c.type='action';
 s.G.players[n===13?0:1].coalition.unshift(c);s.G.discard.unshift(c);
 if(mode==='no pending')s.G.pending=null;
 if(mode.includes('response'))s.G.response={kind:'cancel_action',playedBy:'0',expiresAtMs:mode==='response'?110000:90000};
 if(mode==='round end'){s.G.roundEnding=true;s.G.roundEndTurn=1;}
 const id=mode==='missing card'?'missing':c.id,args=n===7?[mode==='missing owner'?'missing':'1',id]:[id];
 move(op+' '+mode,s,mode==='wrong actor'?'2':'0',op,args);
}
for(const n of [4,9])for(const mode of ['plain','no retaliation','retaliator discarded','shielded','immovable','action target','wrong actor','missing card','no pending','no attacker personas','response','expired response']){
 const s=state();s.G.pending={kind:n===4?'action_4_discard':'action_9_discard_persona',attackerId:'0',targetId:'1',sourceCardId:'action_'+n};s.G.hasPlayed=true;
 let c=s.G.players[1].coalition[0];if(mode==='no retaliation')s.G.players[1].coalition.pop();if(mode==='retaliator discarded')c=s.G.players[1].coalition[1];if(mode==='shielded')c.shielded=true;if(mode==='immovable')c.id='persona_31';if(mode==='action target')c.type='action';if(mode==='no pending')s.G.pending=null;if(mode==='no attacker personas')s.G.players[0].coalition=[];
 if(mode.includes('response'))s.G.response={kind:'cancel_action',playedBy:'0',expiresAtMs:mode==='response'?110000:90000};
 move('discard '+n+' '+mode,s,mode==='wrong actor'?'0':'1','discardFromCoalition',[mode==='missing card'?'missing':c.id]);
}
for(const [op,kind,n]of choices)for(const mode of ['plain','empty','shielded','immovable','special36','special38','wrong owner']){
 const s=state();s.G.players[0].isBot=true;s.G.players[0].name='[B] Bot';s.G.hasPlayed=true;s.G.pending={kind,attackerId:mode==='wrong owner'?'1':'0'};s.G.lastAction=action(n);
 if(mode==='empty'){s.G.players.forEach(p=>p.coalition=[]);s.G.discard=[];}
 if(mode==='shielded')s.G.players.forEach(p=>p.coalition.forEach(c=>c.shielded=true));
 if(mode==='immovable'){s.G.players.forEach(p=>p.coalition=[card('persona_31')]);s.G.discard=[card('persona_31')];}
 if(mode.startsWith('special'))s.G.players.forEach(p=>p.coalition.unshift(card('persona_'+mode.slice(7))));
 move('bot choice '+n+' '+mode,s,'0','tickBot');
}
for(const n of numbers)for(const mode of ['plain','empty','shielded']){
 const s=state();s.G.players[0].isBot=true;s.G.players[0].name='[B] Bot';s.G.players[0].hand=[action(n)];
 if(mode==='empty')s.G.players[0].coalition=[];if(mode==='shielded')s.G.players[0].coalition.forEach(c=>c.shielded=true);
 move('bot play '+n+' '+mode,s,'0','tickBot');
}
for(const n of [4,9,17])for(const response of [6,8,14,'persona10','expires']){
 const s=state();s.G.players[0].hand=[action(n)];s.G.players[1].hand=[action(response)];s.G.players[1].coalition.push(card('persona_10'));
 const played=move('response play '+n+' '+response,s,'0','playAction',[action(n).id,'1']);
 if(!played.ok)throw Error('action failed');
 if(response==='expires'){Date.now=()=>120000;move('response expiry '+n,played.state,'0','tickBot');Date.now=()=>100000;}
 else if(response==='persona10')move('response cancel10 '+n,played.state,'1','persona10CancelFromCoalition');
 else move('response cancel '+n+' '+response,played.state,'1','playAction',[action(response).id]);
}
for(const [op,kind,n]of choices){
 const s=state();s.G.players[0].hand=[action(n)];
 const played=move('sequence play '+n,s,'0','playAction',[action(n).id,'1']);
 const id=n===13?'persona_2#self':n===18?'persona_6#discard':'persona_3#target';
 const chosen=move('sequence choose '+n,played.state,'0',op,n===7?['1',id]:[id]);
 move('sequence repeated '+n,chosen.state,'0',op,n===7?['1',id]:[id]);
}
for(const n of [7,13,17,18,99]){
 const s=state();s.G.players[0].hand=[action(n)];s.G.activePlayerIds=['0'];s.G.players[0].coalition=Array.from({length:7},(_,i)=>card('persona_2#'+i));
 const played=move('trigger round play '+n,s,'0','playAction',[action(n).id]);
 if(n!==99){const [op]=choices.find(x=>x[2]===n);const id=n===13?'persona_2#0':n===18?'persona_6#discard':'persona_3#target';move('trigger round choose '+n,played.state,'0',op,n===7?['1',id]:[id]);}
}
return JSON.stringify(results);
})()
