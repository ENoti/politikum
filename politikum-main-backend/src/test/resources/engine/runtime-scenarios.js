(()=>{
Date.now=()=>100000;Math.random=()=>0.25;
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
const fromCatalog=id=>({...JSON.parse(JSON.stringify(POLITIKUM_CARDS[id])),id:id+'#native',name:POLITIKUM_CARDS[id].text||id,baseVp:POLITIKUM_CARDS[id].vp});
function state(){return {G:{players:[{id:'0',name:'You',active:true,hand:[],coalition:[card('persona_22'),card('persona_15')]},{id:'1',name:'Анна',active:true,hand:[card('persona_2#h')],coalition:[card('persona_3'),card('persona_44')]},{id:'2',name:'Bob',active:true,hand:[],coalition:[]}],deck:[card('persona_2#d'),card('persona_3#d'),card('persona_4#d')],discard:[card('persona_5'),card('action_4',{type:'action'})],pending:null,response:null,log:[],hasDrawn:true,hasPlayed:false,playsThisTurn:0,maxPlaysThisTurn:1,turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:7};}
for(const id of Object.keys(POLITIKUM_CARDS).filter(x=>x.startsWith('persona_')))for(const mode of ['plain','left','opponent','blocked','human response','bot response','swap response','empty deck','round end','two plays','full','wrong turn','no draw','already played']){
 const s=state(),c=fromCatalog(id);s.G.players[0].hand=[c];
 if(mode==='blocked')c.blockedAbilities=true;
 if(mode==='human response'||mode==='bot response'){s.G.players[1].hand=[card('action_8',{type:'action'})];if(mode==='bot response')s.G.players[1].isBot=true;}
 if(mode==='swap response')s.G.players[2].coalition=[fromCatalog('persona_8')];
 if(mode==='empty deck')s.G.deck=[];
 if(mode==='round end')s.G.players[0].coalition=Array.from({length:6},(_,i)=>card('persona_2#'+i));
 if(mode==='full')s.G.players[0].coalition=Array.from({length:7},(_,i)=>card('persona_2#'+i));
 if(mode==='two plays'){s.G.maxPlaysThisTurn=2;s.G.playVpDelta=-1;}
 if(mode==='wrong turn')s.ctx.currentPlayer='1';if(mode==='no draw')s.G.hasDrawn=false;if(mode==='already played')s.G.playsThisTurn=1;
 applyMove(s,'0','playPersona',[c.id,mode==='left'?'persona_22':null,'left',mode==='opponent'?'1':'']);
}
const pendings=['persona_20_pick_from_discard','persona_21_pick_target_invert','persona_28_pick_non_fbk','persona_33_choose_faction','persona_34_guess_topdeck','persona_13_pick_target','persona_26_pick_red_nationalist','persona_37_pick_opponent_persona','place_tokens_plus_vp','hand_limit_discard_before_draw','unknown'];
for(const kind of pendings)for(const mode of ['plain','empty','shielded','wrong owner','not drawn','hard cap','pause','scheduled','response','expired response']){
 const s=state(),p=s.G.players[0];p.isBot=true;p.name='[B] Bot';p.coalition.push(...[20,21,28,33,34,13,26,37].map(n=>fromCatalog('persona_'+n)));p.hand=[card('persona_2#h')];
 s.G.pending={kind,playerId:mode==='wrong owner'?'1':'0',attackerId:'1',sourceCardId:kind.split('_').slice(0,2).join('_'),remaining:2,delta:1};
 if(mode==='empty'){s.G.players.forEach(p=>p.coalition=[]);s.G.discard=[];s.G.deck=[];p.hand=[];}
 if(mode==='shielded')s.G.players.forEach(p=>p.coalition.forEach(c=>c.shielded=true));
 if(mode==='not drawn')s.G.hasDrawn=false;
 if(mode==='hard cap')s.G.turnStartedAtMs=79000;if(mode==='pause')s.G.botPauseUntilMs=110000;if(mode==='scheduled')s.G.botNextActAtMs=110000;
 if(mode.includes('response'))s.G.response={kind:'cancel_action',playedBy:'0',expiresAtMs:mode==='response'?110000:90000};
 applyMove(s,'0','tickBot',[]);
}
for(const id of Object.keys(POLITIKUM_CARDS))for(const mode of ['plain','draw','full','two plays']){
 const s=state(),p=s.G.players[0];p.isBot=true;p.name='[B] Bot';p.hand=[fromCatalog(id)];
 if(mode==='draw'){s.G.hasDrawn=false;s.G.deck.unshift(fromCatalog('event_10'));}
 if(mode==='full')p.coalition=Array.from({length:7},(_,i)=>card('persona_2#'+i));
 if(mode==='two plays'){s.G.maxPlaysThisTurn=2;s.G.playVpDelta=-1;}
 applyMove(s,'0','tickBot',[]);
}
})()
