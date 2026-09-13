(()=>{
const card=(id,extra={})=>({id,type:'persona',name:id,tags:[],baseVp:1,vp:1,...extra});
let count=0;
for(const mode of ['skip','discard','tokens','shielded','wrong owner','wrong turn','no pending','missing me','fallback target','no target','own target','empty tokens']){
 const self=card('persona_3'),left=card('persona_15',{tags:['faction:leftwing'],vpDelta:4});
 const s={G:{players:[{id:'0',name:'You',active:true,coalition:[self],hand:[]},{id:'1',name:'Bob',active:true,coalition:[left,card('persona_44')],hand:[]}],deck:[card('persona_8')],discard:[],log:[],pending:{kind:'persona_3_choice',playerId:'0',sourceCardId:'persona_3'},turnN:1},ctx:{currentPlayer:'0',phase:'action',turn:1},_stateID:5};
 if(mode==='shielded')left.shielded=true;if(mode==='wrong owner')s.G.pending.playerId='1';if(mode==='wrong turn')s.ctx.currentPlayer='1';if(mode==='no pending')s.G.pending=null;if(mode==='missing me')s.G.players.shift();if(mode==='no target')s.G.players[1].coalition.shift();if(mode==='own target'){s.G.players[0].coalition.push(left);s.G.players[1].coalition.shift();}if(mode==='empty tokens')left.vpDelta=0;
 const args=['a',mode==='own target'?'0':'1',mode==='fallback target'?'missing':'persona_15'];if(['tokens','empty tokens'].includes(mode))args[0]='b';
 const before=JSON.stringify(s),result=applyMove(s,'0',mode==='skip'?'persona3Skip':'persona3ChooseOption',args);
 if(JSON.stringify(s)!==before)throw Error(mode+': mutated input');
 const invalid=['shielded','wrong owner','wrong turn','no pending','missing me','no target'].includes(mode);
 if(result.ok===invalid)throw Error(mode+': incorrect result '+JSON.stringify(result));
 if(invalid){if(result.error!=='invalid_move')throw Error(mode+': not validation failure');}
 else {
  const g=result.state.G;if(g.pending)throw Error(mode+': pending not cleared');if(result.state._stateID!==6)throw Error(mode+': wrong version');
  const p=g.players[0].coalition.find(c=>c.id==='persona_3');
  if(!['skip','empty tokens'].includes(mode)&&p.vpDelta!==-1)throw Error(mode+': missing ability cost');
  if(['skip','empty tokens'].includes(mode)&&Number(p.vpDelta||0)!==0)throw Error(mode+': charged without effect');
  if(mode==='tokens'&&g.players[1].coalition[0].vpDelta!==2)throw Error('tokens: wrong removal');
  if(['discard','fallback target','own target'].includes(mode)&&!g.discard.some(c=>c.id==='persona_15'))throw Error(mode+': missing discard');
 }
 count++;
}
return count;
})()
