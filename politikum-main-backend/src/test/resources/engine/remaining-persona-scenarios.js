(()=>{
Date.now=()=>100000;Math.random=()=>0.25;const results=[];
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
function state(n){return {G:{players:[{id:'0',name:'You',active:true,hand:[],coalition:[card('persona_'+n),card('persona_22',{tags:['faction:liberal','faction:fbk','faction:rightwing'],vpDelta:3})]},{id:'1',name:'Bob',active:true,hand:[],coalition:[card('persona_15',{tags:['faction:leftwing','faction:red_nationalist','faction:rightwing'],vpDelta:4}),card('persona_44')]}],deck:[card('persona_2'),card('persona_8'),card('persona_9')],discard:[],log:[],pending:n===23?{kind:'persona_23_choose_self_inflict_draw',playerId:'0',sourceCardId:'persona_23',taken:0}:null,turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};}
const keys={3:'persona_3_on_enter_choice',6:'persona_6_on_action8_plus1',23:'persona_23_on_enter_self_inflict_draw',30:'persona_30_on_enter_buff_liberals',41:'persona_41_on_enter_buff_fbk',43:'persona_43_on_enter_drain_rightwing'};
for(const n of [3,6,23,30,41,43])for(const mode of ['plain','blocked','no targets','text name','shielded','negative']){
 const s=state(n),me=s.G.players[0],c=me.coalition[0];s.G.pending=null;
 if(mode==='blocked')c.blockedAbilities=true;
 if(mode==='no targets'){me.coalition=[c];s.G.players[1].coalition=[];}
 if(mode==='text name'){delete c.name;c.text='Имя';me.name='Анна';}
 if(mode==='shielded')me.coalition[1].shielded=true;
 if(mode==='negative')me.coalition[1].vpDelta=-3;
 runAbility(keys[n],{G:s.G,me,card:c});results.push({name:'entry '+n+' '+mode,state:s});
}
function move(n,name,args,edit=()=>{}){const s=state(n);edit(s);const before=JSON.stringify(s),result=applyMove(s,'0',n===23?'persona23ChooseSelfInflict':'persona39ActivateRecycle',args);if(JSON.stringify(s)!==before)throw Error('input changed');delete result.state.G.trace;results.push({name:n+' '+name,result});}
for(const value of [0,1,2,3,5,-1,0.5,'2',null,'bad'])move(23,'amount '+value,[value]);
for(const mode of ['wrong owner','wrong pending','no pending','missing self','off turn','empty deck','already taken','event','token event'])move(23,mode,[2],s=>{
 if(mode==='wrong owner')s.G.pending.playerId='1';if(mode==='wrong pending')s.G.pending.kind='other';if(mode==='no pending')s.G.pending=null;if(mode==='missing self')s.G.players[0].coalition.shift();if(mode==='off turn')s.ctx.currentPlayer='1';if(mode==='empty deck')s.G.deck=[];if(mode==='already taken')s.G.pending.taken=2;
 if(mode==='event')s.G.deck.unshift(card('event_test',{type:'event',abilityKey:'event_draw_cards',params:{count:1}}));
 if(mode==='token event'){s.G.players[0].coalition.push(card('persona_38'));s.G.deck.unshift(card('event_1',{type:'event',abilityKey:'place_tokens_plus_vp',params:{tokens:3,delta:1}}));}
});
for(const mode of ['plain','no self','pending','off turn','wrong phase','empty deck','buff targets','blocked'])move(39,mode,[],s=>{if(mode==='no self')s.G.players[0].coalition.shift();if(mode==='pending')s.G.pending={kind:'other'};if(mode==='off turn')s.ctx.currentPlayer='1';if(mode==='wrong phase')s.ctx.phase='lobby';if(mode==='empty deck')s.G.deck=[];if(mode==='buff targets')s.G.players[0].coalition.push(card('persona_1',{tags:['faction:red_nationalist']}));if(mode==='blocked')s.G.players[0].coalition[0].blockedAbilities=true;});
for(const event of ['event_1','event_2','event_3','event_10','event_12'])for(const remaining of [0,1,2,4]){
 const s=state(38);s.G.players[1].coalition.push(card('persona_38#2'));s.G.pending={kind:'place_tokens_plus_vp',sourceCardId:event+'#1',remaining,delta:1};persona38OnEventPlayed(s.G,card(event+'#1',{type:'event'}));results.push({name:'vacuum '+event+' '+remaining,state:s});
}
for(const n of [3,23])for(const mode of ['plain','shielded','empty','event']){
 const s=state(n);s.G.players[0].isBot=true;s.G.players[0].name='[B] Bob';s.G.hasDrawn=true;s.G.pending={kind:n===3?'persona_3_choice':'persona_23_choose_self_inflict_draw',playerId:'0',sourceCardId:'persona_'+n,taken:0};
 if(mode==='shielded')s.G.players[1].coalition[0].shielded=true;if(mode==='empty'){s.G.deck=[];s.G.players[1].coalition=[];}if(mode==='event')s.G.deck.unshift(card('event_1',{type:'event',abilityKey:'place_tokens_plus_vp',params:{tokens:3,delta:1}}));
 const result=applyMove(s,'0','tickBot',[]);delete result.state.G.trace;results.push({name:'bot '+n+' '+mode,result});
}
for(const id of ['persona_14','persona_40','event_1','event_2','event_3','event_10'])for(const mode of ['plain','empty','shield','negative']){
 const s=state(40),me=s.G.players[0],c=card(id,{params:{tokens:id==='event_3'?5:id==='event_10'?4:id==='event_2'?2:3,delta:mode==='negative'?-1:1}});
 if(mode==='empty')me.coalition=[];if(mode==='shield')me.coalition[0].shielded=true;
 runAbility(id==='persona_14'?'discard_one_persona_from_any_coalition':'place_tokens_plus_vp',{G:s.G,me,card:c});results.push({name:'shared entry '+id+' '+mode,state:JSON.parse(JSON.stringify(s))});
 const before=JSON.stringify(s),result=applyMove(s,'0',id==='persona_14'?'discardPersonaFromCoalition':'applyPendingToken',id==='persona_14'?['1','persona_15']:['persona_40']);if(JSON.stringify(s)!==before)throw Error('shared input changed');delete result.state.G.trace;results.push({name:'shared choice '+id+' '+mode,result});
}
for(const mode of ['liberal','right','both','neutral','new22','absent22','multiple22','blocked22']){
 const s=state(22);s.G.pending=null;s.G.hasDrawn=true;
 if(mode==='absent22')s.G.players[0].coalition=[];
 if(mode==='multiple22')s.G.players[1].coalition.push(card('persona_22#extra'));
 if(mode==='blocked22')s.G.players[0].coalition[0].blockedAbilities=true;
 const c=card(mode==='new22'?'persona_22#new':'persona_35',{abilityKey:'persona_35_no_ability',tags:mode==='neutral'?[]:mode==='right'?['faction:rightwing']:mode==='both'?['faction:liberal','faction:rightwing']:['faction:liberal']});s.G.players[0].hand=[c];
 const result=applyMove(s,'0','playPersona',[c.id]);delete result.state.G.trace;results.push({name:'global22 '+mode,result});
}
return JSON.stringify(results);
})()
