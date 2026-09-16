import assert from 'node:assert/strict';
import test from 'node:test';
import {parse, safeParse} from 'valibot';
import {GameIdSchema, PlayerIdSchema, ServerTimeSchema, TileIdSchema, TurnIdSchema, GreatKingdomActionSchema, GreatKingdomPlayingProjectionSchema, greatKingdomProjectionIsConsistent, type GreatKingdomBoard} from '@hangul-rummikub/shared';
import {createGreatKingdomGame, applyGreatKingdomAction, cancelGreatKingdom, parseGreatKingdomState, publicGreatKingdom, type GreatKingdomState} from './games/great-kingdom/domain/game.js';
import {neighbors, territoryOwners, surroundedCastles, legalPositions} from './games/great-kingdom/domain/board.js';
let seq = 0;
const tile = () => parse(TileIdSchema, `castle-${++seq}`), turn = () => parse(TurnIdSchema, `turn-${++seq}`);
const now = parse(ServerTimeSchema, 1000), ids = ['a','b'].map(id => parse(PlayerIdSchema,id));
function initial() {return createGreatKingdomGame({gameId:parse(GameIdSchema,'kingdom'), playerIds:ids, now, transitionId:turn(), reserves:ids.map(() => Array.from({length:40},tile)), neutralId:tile(), starter:0});}
function play(s:GreatKingdomState, position:number|null) {
  if(s.phase!=='PLAYING')throw new Error('Game finished');
  const before=structuredClone(s), result=applyGreatKingdomAction(s,s.activePlayerId,position===null?{kind:'PASS'}:{kind:'PLACE',position},now,turn());
  assert.ok(result.ok);assert.deepEqual(s,before);assert.ok(greatKingdomProjectionIsConsistent(publicGreatKingdom(result.state)));return result.state;
}
function board(blue:number[]=[],orange:number[]=[]):GreatKingdomBoard {
  const b:GreatKingdomBoard=Array.from({length:81},()=>null);b[40]={color:'NEUTRAL',tileId:tile()};
  for(const i of blue)b[i]={color:'BLUE',tileId:tile()};for(const i of orange)b[i]={color:'ORANGE',tileId:tile()};return b;
}
test('GREAT_KINGDOM orthogonal adjacency, initial inventory, and public projection exclude reserve IDs',()=>{
  assert.deepEqual(neighbors(0),[1,9]);assert.deepEqual(neighbors(8),[17,7]);assert.equal(neighbors(40).length,4);
  const s=initial(), p=publicGreatKingdom(s);assert.equal(p.board.filter(Boolean).length,1);assert.equal(p.playerStates[0]!.remaining,40);
  assert.ok(p.territoryOwners.every(o=>o===null));if(p.phase!=='PLAYING')throw new Error();assert.equal(p.legalPositions.length,80);
  for(const t of s.players.flatMap(p=>p.reserve))assert.equal(JSON.stringify(p).includes(JSON.stringify(t)),false);
});
test('GREAT_KINGDOM territory excludes own castles, enemy regions and all-four-edge regions',()=>{
  assert.equal(territoryOwners(board([1,9]))[0],'BLUE');assert.equal(territoryOwners(board([1,9]))[1],null);
  assert.equal(territoryOwners(board([10]))[0],null); // Diagonal contact does not close a corner.
  assert.equal(territoryOwners(board([2,11,18,19],[0]))[1],null);
  assert.ok(territoryOwners(board([30])).every(o=>o===null));
  const horizontal=Array.from({length:9},(_,i)=>18+i), owners=territoryOwners(board(horizontal));
  assert.equal(owners.filter(o=>o==='BLUE').length,72); // Two separate regions, each touching three edges; neutral counts below.
  assert.equal(owners[40],'BLUE');
});
test('GREAT_KINGDOM neutral is a wall and belongs only to a fully enclosed territory',()=>{
  const b=board([31,39,41,49]);assert.equal(territoryOwners(b)[40],'BLUE');
  assert.equal(territoryOwners(board([31,39,41],[49]))[40],null);
  const near=board([22,30,32]);assert.equal(territoryOwners(near)[31],'BLUE');assert.equal(territoryOwners(near)[40],null);
  assert.equal(legalPositions(board([1,9]),'ORANGE',40).includes(0),false);
  assert.equal(legalPositions(board([1,9]),'BLUE',40).includes(0),true);
  assert.deepEqual(legalPositions(b,'BLUE',0),[]);
});
test('GREAT_KINGDOM siege uses group liberties and neutral/edges block liberties',()=>{
  assert.deepEqual(surroundedCastles(board([0],[1,9]),'BLUE'),[0]);
  assert.deepEqual(surroundedCastles(board([0,9],[1,10]),'BLUE'),[]);
  assert.deepEqual(surroundedCastles(board([0,9],[1,10,18]),'BLUE'),[0,9]);
  assert.deepEqual(surroundedCastles(board([31],[22,30,32]),'BLUE'),[31]);
  let s=initial();for(const p of [1,0,9])s=play(s,p);
  assert.equal(s.phase,'FINISHED');if(s.phase!=='FINISHED')throw new Error();assert.deepEqual(s.result,{reason:'SIEGE',winnerPlayerIds:[ids[0]],destroyedPositions:[0]});
  assert.equal(s.board.filter(Boolean).length,4);assert.equal(s.players.flatMap(p=>p.reserve).length,77);
});
test('GREAT_KINGDOM rejected moves preserve state; wrong actor, neutral, occupied, invalid positions',()=>{
  const s=initial(),before=structuredClone(s);
  assert.equal(applyGreatKingdomAction(s,ids[1]!,{kind:'PASS'},now,turn()).ok,false);
  for(const position of [-1,40,81,.5])assert.equal(applyGreatKingdomAction(s,ids[0]!,{kind:'PLACE',position},now,turn()).ok,false);
  assert.deepEqual(s,before);
  for(const input of [{kind:'PLACE',position:81},{kind:'PLACE',position:1.5},{kind:'PASS',position:1},{kind:'PLACE',position:1,playerId:'a'}])assert.equal(safeParse(GreatKingdomActionSchema,input).success,false);
});
test('GREAT_KINGDOM consecutive passes end in a draw when equal, placement resets passes, cancellation is separate',()=>{
  let s=play(initial(),null);assert.equal(s.consecutivePasses,1);s=play(s,70);assert.equal(s.consecutivePasses,0);
  s=play(play(s,null),null);assert.equal(s.phase,'FINISHED');if(s.phase!=='FINISHED')throw new Error();assert.equal(s.result.reason,'TERRITORY');assert.deepEqual(s.result.winnerPlayerIds,[]);
  assert.equal(applyGreatKingdomAction(s,ids[0]!,{kind:'PASS'},now,turn()).ok,false);
  const cancelled=cancelGreatKingdom(play(initial(),3),now);assert.equal(cancelled.phase,'FINISHED');if(cancelled.phase!=='FINISHED')throw new Error();assert.equal(cancelled.result.reason,'CANCELLED');assert.deepEqual(cancelled.result.winnerPlayerIds,[]);
});
test('GREAT_KINGDOM rejects duplicate physical IDs, corrupt history, public hidden fields and scores',()=>{
  const s=initial(),bad=structuredClone(s);bad.players[0]!.reserve[1]=bad.players[0]!.reserve[0]!;assert.throws(()=>parseGreatKingdomState(bad));
  const after=play(s,1),history=structuredClone(after);history.history[0]!.position=2;assert.throws(()=>parseGreatKingdomState(history));
  const p=publicGreatKingdom(s);assert.equal(safeParse(GreatKingdomPlayingProjectionSchema,{...p,reserve:s.players}).success,false);
  assert.equal(greatKingdomProjectionIsConsistent({...p,playerStates:p.playerStates.map(p=>({...p,territory:20}))}),false);
});
test('GREAT_KINGDOM seeded complete games conserve all 81 pieces and remain valid',()=>{
  for(let seed=1;seed<=20;seed++) {let random=seed,s=initial(),moves=0;
    while(s.phase==='PLAYING') {const p=publicGreatKingdom(s);if(p.phase!=='PLAYING')throw new Error();random=(random*1664525+1013904223)>>>0;
      s=play(s,p.legalPositions.length?p.legalPositions[random%p.legalPositions.length]!:null);assert.ok(++moves<=162);
    }
  }
});
test('GREAT_KINGDOM either color wins by exactly one territory cell, equal territories draw',()=>{
  const cases = [
    {moves:[1,80,9,null,null], scores:[1,0], winners:[ids[0]]},
    {moves:[80,1,78,9,76,null,null], scores:[0,1], winners:[ids[1]]},
    {moves:[1,71,9,79,null,null], scores:[1,1], winners:[]},
    {moves:[null,null], scores:[0,0], winners:[]},
  ];
  for(const scenario of cases){let s=initial();for(const p of scenario.moves)s=play(s,p);
    assert.equal(s.phase,'FINISHED');if(s.phase!=='FINISHED')throw new Error();
    assert.deepEqual(s.result.winnerPlayerIds,scenario.winners);
    const projection=publicGreatKingdom(s);assert.deepEqual(projection.playerStates.map(p=>p.territory),scenario.scores);
    assert.equal(greatKingdomProjectionIsConsistent({...projection,phase:'FINISHED',result:{...s.result,winnerPlayerIds:scenario.winners.length ? [] : [ids[0]!]}}),false);
  }
});
test('GREAT_KINGDOM filling the last shared liberty of own castles loses immediately',()=>{
  let s=initial();for(const p of [0,1,18,19,60,27,62,10,9])s=play(s,p);
  assert.equal(s.phase,'FINISHED');if(s.phase!=='FINISHED')throw new Error();assert.deepEqual(s.result,{reason:'SIEGE',winnerPlayerIds:[ids[1]],destroyedPositions:[0,9,18]});
});
test('GREAT_KINGDOM simultaneous enclosure resolves opponent first and awards mover the siege',()=>{
  const s=initial();if(s.phase!=='PLAYING')throw new Error();
  // Both connected kingdoms share the board's final empty cell (D5).
  const blue=Array.from({length:40},(_,i)=>41+i),orange=Array.from({length:39},(_,i)=>i);
  for(let i=0;i<79;i++) {const player=s.players[i%2]!,position=(i%2===0?blue:orange)[Math.floor(i/2)]!,tileId=player.reserve.shift()!;
    s.board[position]={tileId,color:player.color};s.history.push({move:i+1,playerId:player.playerId,color:player.color,kind:'PLACE',position});
  }
  const before=parseGreatKingdomState({...s,revision:79,activePlayerId:ids[1]});
  const end=play(before,39);assert.equal(end.phase,'FINISHED');if(end.phase!=='FINISHED')throw new Error();
  assert.deepEqual(end.result.winnerPlayerIds,[ids[1]]);assert.deepEqual(end.result.destroyedPositions,blue);
});
