import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,PatchworkActionSchema,PATCHWORK_PATCHES,PATCHWORK_LEATHER,patchworkPatch,patchworkCells,patchworkCanPlace,patchworkOccupied,patchworkFirstPlacement,patchworkSeven,patchworkScore,patchworkMovePreview,type PatchworkAction,type PatchworkPlayer,type PatchworkTile} from '@hangul-rummikub/shared';
import {timeoutPatchwork,createPatchworkGame,applyPatchworkAction,parsePatchworkState,cancelPatchwork,type PatchworkState} from './games/patchwork/domain/game.js';
let serial=0;
const id=()=>parse(TileIdSchema,`tile-${++serial}`),now=parse(ServerTimeSchema,1000);
function fixture(seed=1){return createPatchworkGame({gameId:parse(GameIdSchema,'patchwork'),playerIds:[parse(PlayerIdSchema,'alice'),parse(PlayerIdSchema,'bob')],generateTileId:id,turnId:parse(TurnIdSchema,'first'),now,random:{nextInt(max){seed=(seed*1664525+1013904223)>>>0;return seed%max;}}});}
function actor(s:PatchworkState){return s.players.find(p=>p.playerId===s.activePlayerId)!;}
function other(s:PatchworkState){return s.players.find(p=>p.playerId!==s.activePlayerId)!;}
function apply(s:PatchworkState,a:PatchworkAction){const before=structuredClone(s),result=applyPatchworkAction(s,s.activePlayerId,a,now,parse(TurnIdSchema,`turn-${++serial}`));assert.deepEqual(s,before);assert.ok(result.ok,result.ok?'':result.reason);return result.state;}
function clearPastLeather(s:PatchworkState){const position=Math.max(...s.players.map(p=>p.position)),past=s.leather.filter(t=>t.position<=position);s.discardedLeather.push(...past.map(({tileId,patchId})=>({tileId,patchId})));s.leather=s.leather.filter(t=>t.position>position);}
function promote(s:PatchworkState,patchId:number){const index=s.market.findIndex(t=>t.patchId===patchId);s.market=[s.market[index]!,...s.market.filter((_,i)=>i!==index)];return s.market[0]!;}
function give(s:PatchworkState,p:PatchworkPlayer,patchId:number,x:number,y:number){const index=s.market.findIndex(t=>t.patchId===patchId);assert.ok(index>=0);const [tile]=s.market.splice(index,1);p.placements.push({...tile!,x,y,rotation:0,flipped:false});p.income+=patchworkPatch(patchId).income;}
function leather(s:PatchworkState){const p=patchworkFirstPlacement(actor(s).placements,0)!;return apply(s,{type:'PLACE_LEATHER',tileId:s.pendingLeather[0]!.tileId,x:p.x,y:p.y});}
test('PATCHWORK catalog: 33 real patches, 38 opaque instances, five buttons, corrected leather track and initial pawn',()=>{
 const s=fixture();assert.equal(PATCHWORK_PATCHES.filter(p=>p.id>0).length,33);assert.deepEqual(PATCHWORK_LEATHER,[26,32,38,44,50]);assert.equal(s.market.at(-1)?.patchId,1);assert.equal(s.players.length,2);assert.ok(s.players.every(p=>p.buttons===5&&p.position===0));assert.equal(new Set([...s.market,...s.leather].map(p=>p.tileId)).size,38);
 assert.deepEqual(patchworkPatch(1),{id:1,cost:2,time:1,income:0,rows:['##']});assert.equal(patchworkPatch(17).cost,0);assert.equal(patchworkPatch(17).income,1);assert.equal(patchworkPatch(5).cost,6);assert.equal(patchworkPatch(33).income,3);
});
test('PATCHWORK all pieces × eight orientations retain connected cells; reflected asymmetric shape is distinct; overlap and edges reject',()=>{
 const p=fixture().players[0]!;
 for(const patch of PATCHWORK_PATCHES)for(const r of [0,1,2,3] as const)for(const flipped of [false,true]){const cells=patchworkCells(patch.id,r,flipped);assert.equal(new Set(cells.map(c=>`${c.x},${c.y}`)).size,cells.length);assert.equal(cells.length,patch.rows.join('').replaceAll(' ','').length);assert.ok(patchworkCanPlace([],patch.id,0,0,r,flipped));assert.equal(patchworkCanPlace([],patch.id,9,0,r,flipped),false);assert.equal(patchworkCanPlace([],patch.id,-1,0,r,flipped),false);}
 assert.notDeepEqual(patchworkCells(18,0,false),patchworkCells(18,0,true));
 p.placements.push({tileId:id(),patchId:1,x:0,y:0,rotation:0,flipped:false});assert.equal(patchworkCanPlace(p.placements,2,1,0,0,false),false);assert.equal(patchworkCanPlace(p.placements,2,0,1,0,false),true);
});
test('PATCHWORK BUY chooses only first three, commits cost/placement/market cursor once, and rejects invalid commands atomically',()=>{
 let s=fixture();const t=promote(s,1),owner=s.activePlayerId;other(s).position=4;
 const original=structuredClone(s);
 for(const tileId of [s.market[3]!.tileId,id()]){const r=applyPatchworkAction(s,owner,{type:'BUY',tileId,x:0,y:0,rotation:0,flipped:false},now,parse(TurnIdSchema,'x'));assert.deepEqual(r,{ok:false,reason:'INVALID_ACTION'});assert.deepEqual(s,original);}
 const expectedNext=s.market[1]!.tileId;s=apply(s,{type:'BUY',tileId:t.tileId,x:0,y:0,rotation:0,flipped:false});assert.equal(actor(s).buttons,3);assert.equal(actor(s).position,1);assert.equal(s.activePlayerId,owner);assert.equal(s.market[0]!.tileId,expectedNext);assert.equal(s.market.length,32);assert.equal(s.revision,1);
 const result=applyPatchworkAction(s,other(s).playerId,{type:'ADVANCE'},now,parse(TurnIdSchema,'x'));assert.deepEqual(result,{ok:false,reason:'NOT_YOUR_TURN'});
});
test('PATCHWORK buying across income uses newly purchased buttons; equal position keeps moving player on top',()=>{
 let s=fixture();const owner=s.activePlayerId;actor(s).position=3;other(s).position=6;const t=promote(s,3);
 s=apply(s,{type:'BUY',tileId:t.tileId,x:0,y:0,rotation:0,flipped:false});assert.equal(s.activePlayerId,owner);assert.equal(actor(s).position,6);assert.equal(actor(s).income,1);assert.equal(actor(s).buttons,3);assert.equal(s.history.at(-1)!.income,1);
 s=apply(s,{type:'ADVANCE'});assert.notEqual(s.activePlayerId,owner);assert.equal(other(s).position,7);assert.equal(other(s).buttons,4);
});
test('PATCHWORK long advance grants every crossed income and every available leather; pending phase survives parse and blocks next turn',()=>{
 let s=fixture();const owner=s.activePlayerId;give(s,actor(s),3,0,0);actor(s).position=24;other(s).position=49;
 // Synthetic event-boundary fixture: verify all five markers in one transition.

 s=apply(s,{type:'ADVANCE'});assert.equal(s.activePlayerId,owner);assert.equal(actor(s).position,50);assert.equal(actor(s).buttons,35);assert.equal(s.pendingLeather.length,5);assert.equal(s.history.at(-1)!.income,4);assert.deepEqual(parsePatchworkState(s),s);
 assert.deepEqual(applyPatchworkAction(s,owner,{type:'ADVANCE'},now,parse(TurnIdSchema,'no')),{ok:false,reason:'INVALID_ACTION'});
 while(s.pendingLeather.length)s=leather(s);assert.notEqual(s.activePlayerId,owner);assert.equal(other(s).placements.filter(t=>t.patchId===0).length,5);
});
test('PATCHWORK one player can advance across several leather markers that the other has not reached',()=>{
 let s=fixture();actor(s).position=24;other(s).position=25;s=apply(s,{type:'ADVANCE'});assert.equal(s.pendingLeather.length,1);assert.equal(s.leather.length,4);s=leather(s);assert.equal(s.pendingLeather.length,0);assert.equal(actor(s).position,25);
});
test('PATCHWORK seven by seven checks every origin and holes; scoring allows negative scores',()=>{
 const p=fixture().players[0]!;for(let y=2;y<9;y++)for(let x=2;x<9;x++)p.placements.push({tileId:id(),patchId:0,x,y,rotation:0,flipped:false});assert.deepEqual(patchworkSeven(p.placements),{x:2,y:2});assert.equal(patchworkScore(p,p.playerId).total,5+7-32*2);p.placements.pop();assert.equal(patchworkSeven(p.placements),null);
});
test('PATCHWORK capped end movement pays only actual distance; both end, last income, tie to first arrival',()=>{
 let s=fixture();const owner=s.activePlayerId;actor(s).position=52;other(s).position=53;other(s).buttons=6;s.finishOrder=[other(s).playerId];clearPastLeather(s);s=apply(s,{type:'ADVANCE'});assert.equal(s.phase,'FINISHED');assert.equal(s.players.find(p=>p.playerId===owner)!.buttons,6);assert.equal(s.history.at(-1)!.distance,1);assert.deepEqual(s.result?.winnerPlayerIds,[s.finishOrder[0]]);
 assert.equal(applyPatchworkAction(s,owner,{type:'ADVANCE'},now,parse(TurnIdSchema,'no')).ok,false);
});
test('PATCHWORK costs reject insufficient buttons and strict schema rejects forged fields',()=>{
 let s=fixture();const t=promote(s,33),before=structuredClone(s);assert.equal(applyPatchworkAction(s,s.activePlayerId,{type:'BUY',tileId:t.tileId,x:0,y:0,rotation:0,flipped:false},now,parse(TurnIdSchema,'no')).ok,false);assert.deepEqual(s,before);
 assert.throws(()=>parse(PatchworkActionSchema,{type:'ADVANCE',buttons:100}));assert.throws(()=>parse(PatchworkActionSchema,{type:'BUY',tileId:t.tileId,x:0,y:0,rotation:4,flipped:false}));
 assert.equal(patchworkMovePreview(actor(s),53,null).distance,53);
});
for(let seed=1;seed<=16;seed++)test(`PATCHWORK seeded complete game ${seed}: tile conservation, valid placements, bonus and deterministic scoring`,()=>{
 let s=fixture(seed),turns=0;
 while(s.phase==='PLAYING'&&turns++<120){
  if(s.pendingLeather.length){s=leather(s);continue;}
  const p=actor(s);let selected:{tile:PatchworkTile;position:NonNullable<ReturnType<typeof patchworkFirstPlacement>>}|null=null;
  for(const tile of s.market.slice(0,3)){if(p.buttons<patchworkPatch(tile.patchId).cost)continue;const position=patchworkFirstPlacement(p.placements,tile.patchId);if(position){selected={tile,position};break;}}
  s=selected?apply(s,{type:'BUY',tileId:selected.tile.tileId,...selected.position}):apply(s,{type:'ADVANCE'});
  for(const p of s.players)assert.equal(patchworkOccupied(p.placements).size,p.placements.reduce((n,t)=>n+patchworkCells(t.patchId).length,0));
 }
 assert.equal(s.phase,'FINISHED');assert.equal(s.finishOrder.length,2);assert.ok(s.players.every(p=>p.position===53));assert.ok(s.result?.winnerPlayerIds.length===1);const winner=s.players.find(p=>p.playerId===s.result!.winnerPlayerIds[0])!;assert.equal(patchworkScore(winner,s.bonusOwner).total,Math.max(...s.players.map(p=>patchworkScore(p,s.bonusOwner).total)));
 const cancelled=cancelPatchwork(fixture(seed),now);assert.equal(cancelled.result?.reason,'CANCELLED');assert.deepEqual(cancelled.result?.winnerPlayerIds,[]);
});

test('PATCHWORK timer: default 60 seconds, exact deadline rejects atomically, early timeout does nothing',()=>{
 const s=fixture(),before=structuredClone(s),turn=parse(TurnIdSchema,'timeout');
 assert.equal(s.settings.turnDurationSeconds,60);assert.equal(s.deadlineAt,61000);
 assert.deepEqual(timeoutPatchwork(s,parse(ServerTimeSchema,60999),turn),{ok:false});
 assert.equal(applyPatchworkAction(s,s.activePlayerId,{type:'ADVANCE'},parse(ServerTimeSchema,60999),turn).ok,true);
 assert.deepEqual(applyPatchworkAction(s,s.activePlayerId,{type:'ADVANCE'},parse(ServerTimeSchema,61000),turn),{ok:false,reason:'TURN_EXPIRED'});
 const result=timeoutPatchwork(s,parse(ServerTimeSchema,61000),turn);assert.ok(result.ok);
 assert.equal(result.state.history.at(-1)?.automatic,true);assert.equal(result.state.deadlineAt,121000);
 assert.equal(result.state.players.find(p=>p.playerId===s.activePlayerId)!.position,1);
 assert.deepEqual(s,before);
});
test('PATCHWORK timer: 30 seconds and a consecutive turn both get a fresh deadline',()=>{
 const s=fixture();s.settings={turnDurationSeconds:30};s.deadlineAt=parse(ServerTimeSchema,31000);
 other(s).position=4;const tile=promote(s,1);
 const result=applyPatchworkAction(s,s.activePlayerId,{type:'BUY',tileId:tile.tileId,x:0,y:0,rotation:0,flipped:false},parse(ServerTimeSchema,2000),parse(TurnIdSchema,'next'));
 assert.ok(result.ok);assert.equal(result.state.activePlayerId,s.activePlayerId);assert.equal(result.state.deadlineAt,32000);
});
test('PATCHWORK timer: leather shares the remaining deadline; timeout places all pending without advancing again',()=>{
 let s=fixture();actor(s).position=24;other(s).position=25;
 const advanced=applyPatchworkAction(s,s.activePlayerId,{type:'ADVANCE'},parse(ServerTimeSchema,60000),parse(TurnIdSchema,'leather'));
 assert.ok(advanced.ok);s=advanced.state;assert.equal(s.pendingLeather.length,1);assert.equal(s.deadlineAt,61000);
 const before=structuredClone(s),result=timeoutPatchwork(s,parse(ServerTimeSchema,61000),parse(TurnIdSchema,'automatic'));
 assert.ok(result.ok);assert.equal(result.state.pendingLeather.length,0);assert.equal(result.state.deadlineAt,121000);
 const placed=result.state.players.find(p=>p.playerId===s.activePlayerId)!;
 assert.equal(placed.position,26);assert.equal(placed.placements[0]!.x,0);assert.equal(placed.placements[0]!.y,0);
 assert.equal(result.state.history.at(-1)!.kind,'LEATHER');assert.deepEqual(s,before);
});
test('PATCHWORK timer: expired advance resolves all earned leather in its candidate and finished games stop ticking',()=>{
 const s=fixture();actor(s).position=24;other(s).position=49;
 const result=timeoutPatchwork(s,parse(ServerTimeSchema,61000),parse(TurnIdSchema,'automatic'));
 assert.ok(result.ok);assert.equal(result.state.pendingLeather.length,0);assert.equal(result.state.players.find(p=>p.playerId===s.activePlayerId)!.placements.length,5);
 assert.ok(result.state.history.every(h=>h.automatic));
 const finished=cancelPatchwork(result.state,parse(ServerTimeSchema,62000));assert.equal(finished.deadlineAt,null);
 assert.deepEqual(timeoutPatchwork(finished,parse(ServerTimeSchema,999999),parse(TurnIdSchema,'late')),{ok:false});
});
