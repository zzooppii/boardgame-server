import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,HARMONIES_ANIMALS,HARMONIES_CELLS,harmoniesAnimal,harmoniesCellAt,harmoniesNeighbors,harmoniesPatternCells,harmoniesCanPlace,harmoniesCanSettle,harmoniesMatches,harmoniesReplay,harmoniesScore,HarmoniesActionSchema,type HarmoniesPlayer,type HarmoniesColor,type HarmoniesStep,type HarmoniesToken,type HarmoniesCell} from '@hangul-rummikub/shared';
import {createHarmoniesGame,applyHarmoniesAction,parseHarmoniesState,cancelHarmonies} from './games/harmonies/domain/game.js';
let serial=0;
const token=(color:HarmoniesColor):HarmoniesToken=>({tileId:parse(TileIdSchema,`tile-${++serial}`),color});
const stack=(...colors:HarmoniesColor[]):HarmoniesCell=>({stack:colors.map(token),animal:null});
const player=():HarmoniesPlayer=>({playerId:parse(PlayerIdSchema,'a'),board:Array.from({length:23},()=>stack()),cards:[],turns:0});
function fixture(n=2,seed=123){const random={nextInt(max:number){seed=(seed*1664525+1013904223)>>>0;return seed%max;}};let turn=0;const state=createHarmoniesGame({generateTileId:()=>parse(TileIdSchema,`real-${++serial}`),gameId:parse(GameIdSchema,'game'),playerIds:Array.from({length:n},(_,i)=>parse(PlayerIdSchema,`p${i}`)),now:parse(ServerTimeSchema,1000),turnId:parse(TurnIdSchema,'start'),random});return {state,next:()=>parse(TurnIdSchema,`turn-${++turn}`)};}
test('HARMONIES: 23 symmetric hex cells, six reciprocal neighbors, real base inventory and 32 unique cards',()=>{
 assert.equal(HARMONIES_CELLS.length,23);for(let i=0;i<23;i++)for(const n of harmoniesNeighbors(i))assert.ok(harmoniesNeighbors(n).includes(i));
 const {state:s}=fixture();assert.equal(s.bag.length,105);assert.equal(s.markets.length,5);assert.ok(s.markets.every(m=>m.length===3));assert.equal(s.deck.length,27);assert.equal(s.animalMarket.length,5);assert.equal(HARMONIES_ANIMALS.length,32);
 for(const c of HARMONIES_ANIMALS){assert.equal(c.pattern.filter(p=>p.animal).length,1);assert.ok(c.points.every((p,i)=>i===0||p>c.points[i-1]!));}
});
test('HARMONIES: legal stacks, building bases, capped trees, water/field height and occupied animal locks',()=>{
 const yes:(readonly HarmoniesColor[])[]=[['WOOD','WOOD'],['WOOD','LEAF'],['WOOD','WOOD','LEAF'],['STONE','STONE','STONE'],['WOOD','RED'],['RED','RED'],['STONE','RED']];
 const no:(readonly HarmoniesColor[])[]=[['LEAF','WOOD'],['WATER','WATER'],['FIELD','RED'],['WOOD','WOOD','RED'],['WOOD','WOOD','WOOD'],['STONE','STONE','STONE','STONE'],['RED','RED','RED']];
 for(const xs of yes)assert.ok(harmoniesCanPlace(stack(...xs.slice(0,-1)),token(xs.at(-1)!)),xs.join(','));
 for(const xs of no)assert.equal(harmoniesCanPlace(stack(...xs.slice(0,-1)),token(xs.at(-1)!)),false,xs.join(','));
 assert.equal(harmoniesCanPlace({...stack('STONE'),animal:23},token('STONE')),false);
});
test('HARMONIES: all 32 animal cards in each of six rotations match exact heights and an empty anchor',()=>{
 for(const card of HARMONIES_ANIMALS)for(let rotation=0;rotation<6;rotation++){
  const p=player(),origin=HARMONIES_CELLS.findIndex((_,i)=>harmoniesPatternCells(card.id,i,rotation).every(n=>n>=0));assert.ok(origin>=0);
  const ids=harmoniesPatternCells(card.id,origin,rotation);
  card.pattern.forEach((c,i)=>{p.board[ids[i]!] = c.stack[0]==='BUILDING'?stack('STONE','RED'):stack(...c.stack.filter((x):x is HarmoniesColor=>x!=='BUILDING'));});
  assert.ok(harmoniesCanSettle(p.board,card.id,origin,rotation),`${card.name}/${rotation}`);
  const target=ids[card.pattern.findIndex(c=>c.animal)]!;assert.ok(harmoniesMatches(p.board,card.id).some(m=>m.target===target));
  p.board[target]!.animal=card.id;assert.equal(harmoniesCanSettle(p.board,card.id,origin,rotation),false);
  p.board[target]!.animal=null;p.board[target]!.stack=[];assert.equal(harmoniesCanSettle(p.board,card.id,origin,rotation),false);
 }
});
test('HARMONIES: settle during placement, preserve animals after support changes, reject reversed order atomically',()=>{
 const p=player(),origin=harmoniesCellAt(2,1),target=harmoniesPatternCells(26,origin,0)[1]!;p.board[origin]=stack('FIELD');p.board[target]=stack('STONE');p.cards=[{cardId:26,placed:0}];
 const red=token('RED'),leaf=token('LEAF'),water=token('WATER'),markets=[[red,leaf,water]];
 // The meerkat sits on stone; the supporting field cannot be stacked. The bat's tree support can change only by covering another supporting structure, so use fox below.
 const b=player(),ids=harmoniesPatternCells(23,origin,0);b.cards=[{cardId:23,placed:0}];b.board[ids[0]!]=stack('FIELD');b.board[ids[1]!]=stack('STONE');b.board[ids[2]!]=stack('STONE');
 const steps:HarmoniesStep[]=[{type:'TAKE_TOKENS',source:0},{type:'SETTLE',cardId:23,origin,rotation:0},{type:'PLACE',tileId:red.tileId,cell:ids[1]!}];
 const before=JSON.stringify(b),r=harmoniesReplay(b,markets,[],steps);assert.ok(r.ok);assert.equal(r.draft.player.board[ids[2]!]!.animal,23);assert.equal(harmoniesCanSettle(r.draft.player.board,23,origin,0),false);assert.equal(JSON.stringify(b),before);
 assert.equal(harmoniesReplay(b,markets,[],[steps[0]!,steps[2]!,steps[1]!]).ok,false);
 assert.equal(harmoniesReplay(b,markets,[],[...steps,{type:'PLACE',tileId:leaf.tileId,cell:ids[2]!}]).ok,false);
});
test('HARMONIES: completed card frees the fourth slot before an optional card pick; cannot take twice',()=>{
 const p=player(),origin=harmoniesCellAt(2,1),ids=harmoniesPatternCells(26,origin,0);p.board[ids[0]!]=stack('FIELD');p.board[ids[1]!]=stack('STONE');p.cards=[{cardId:26,placed:3},{cardId:1,placed:0},{cardId:2,placed:0},{cardId:3,placed:0}];
 assert.equal(harmoniesReplay(p,[],[4,5],[{type:'TAKE_ANIMAL',cardId:4}]).ok,false);
 const good=harmoniesReplay(p,[],[4,5],[{type:'SETTLE',cardId:26,origin,rotation:0},{type:'TAKE_ANIMAL',cardId:4}]);assert.ok(good.ok);assert.equal(good.draft.player.cards.length,5);
 assert.equal(harmoniesReplay(p,[],[4,5],[{type:'SETTLE',cardId:26,origin,rotation:0},{type:'TAKE_ANIMAL',cardId:4},{type:'TAKE_ANIMAL',cardId:5}]).ok,false);
});
test('HARMONIES scoring: tree heights, isolated mountains, field merging, top colors around buildings, partial animals',()=>{
 const p=player();p.board[0]=stack('LEAF');p.board[1]=stack('WOOD','LEAF');p.board[2]=stack('WOOD','WOOD','LEAF');assert.equal(harmoniesScore(p.board,[]).trees,11);
 p.board[22]=stack('STONE','STONE','STONE');assert.equal(harmoniesScore(p.board,[]).mountains,0);p.board[harmoniesNeighbors(22)[0]!]=stack('STONE');assert.equal(harmoniesScore(p.board,[]).mountains,8);
 const f=player();for(const i of [0,1,3,4])f.board[i]=stack('FIELD');assert.equal(harmoniesScore(f.board,[]).fields,10);f.board[2]=stack('FIELD');assert.equal(harmoniesScore(f.board,[]).fields,5);
 const b=player(),center=harmoniesCellAt(2,1),ns=harmoniesNeighbors(center);b.board[center]=stack('WOOD','RED');b.board[ns[0]!]=stack('WOOD','LEAF');b.board[ns[1]!]=stack('LEAF');b.board[ns[2]!]=stack('STONE');assert.equal(harmoniesScore(b.board,[]).buildings,0);b.board[ns[3]!]=stack('WATER');assert.equal(harmoniesScore(b.board,[]).buildings,5);
 assert.equal(harmoniesScore(b.board,[{cardId:23,placed:2},{cardId:1,placed:0}]).animals,9);
});
test('HARMONIES river: branches and loops use graph diameter of shortest paths, only one river scores',()=>{
 const p=player(),center=harmoniesCellAt(2,1);for(const i of [center,...harmoniesNeighbors(center)])p.board[i]=stack('WATER');const s=harmoniesScore(p.board,[]);assert.equal(s.water,5);assert.equal(s.lines.find(l=>l.kind==='water')?.cells.length,3);
 const straight=player();for(let i=0;i<5;i++)straight.board[i]=stack('WATER');assert.equal(harmoniesScore(straight.board,[]).water,11);
});
test('HARMONIES server: wrong actor, incomplete turn, unauthorized tile and duplicates never change canonical state',()=>{
 const f=fixture(),s=f.state,p=s.players[s.active]!,tokens=s.markets[0]!,steps:HarmoniesStep[]=[{type:'TAKE_TOKENS',source:0},...tokens.map((t,i)=>({type:'PLACE' as const,tileId:t.tileId,cell:i}))],before=JSON.stringify(s),good=parse(HarmoniesActionSchema,{type:'SUBMIT_TURN',steps});
 assert.equal(applyHarmoniesAction(s,s.players[1]!.playerId,good,parse(ServerTimeSchema,2000),f.next()).ok,false);
 assert.equal(applyHarmoniesAction(s,p.playerId,{type:'SUBMIT_TURN',steps:steps.slice(0,3)},parse(ServerTimeSchema,2000),f.next()).ok,false);
 assert.equal(applyHarmoniesAction(s,p.playerId,{type:'SUBMIT_TURN',steps:[steps[0]!,{type:'PLACE',tileId:s.bag[0]!.tileId,cell:0},...steps.slice(2)]},parse(ServerTimeSchema,2000),f.next()).ok,false);
 assert.equal(applyHarmoniesAction(s,p.playerId,{type:'SUBMIT_TURN',steps:[...steps,steps[1]!]},parse(ServerTimeSchema,2000),f.next()).ok,false);assert.equal(JSON.stringify(s),before);
 const applied=applyHarmoniesAction(s,p.playerId,good,parse(ServerTimeSchema,2000),f.next());assert.ok(applied.ok);assert.equal(applied.state.revision,1);assert.equal(applied.state.players[0]!.turns,1);assert.equal(applied.state.bag.length,102);
 const duplicate=structuredClone(s);duplicate.bag[0]=duplicate.markets[0]![0]!;assert.throws(()=>parseHarmoniesState(duplicate));
 const canceled=cancelHarmonies(s,parse(ServerTimeSchema,2000));assert.equal(canceled.result?.reason,'CANCELLED');assert.deepEqual(canceled.result?.winnerPlayerIds,[]);
});
test('HARMONIES: 2/3/4 players complete deterministic full games; every commit conserves all tokens and cards, equal turns',()=>{
 for(const count of [2,3,4])for(let seed=1;seed<=12;seed++){
  const f=fixture(count,seed);let s=f.state;
  for(let turns=0;s.phase==='PLAYING'&&turns<80;turns++){
   const p=s.players[s.active]!,tokens=s.markets.find(m=>m.length===3)!,source=s.markets.indexOf(tokens),empty=p.board.flatMap((c,i)=>c.stack.length?[]:[i]),steps:HarmoniesStep[]=[{type:'TAKE_TOKENS',source}];
   const choice=s.animalMarket[0];if(choice!==undefined&&p.cards.filter(c=>c.placed<harmoniesAnimal(c.cardId).points.length).length<4)steps.push({type:'TAKE_ANIMAL',cardId:choice});
   tokens.forEach((t,i)=>steps.push({type:'PLACE',tileId:t.tileId,cell:empty[i]!}));
   let draft=harmoniesReplay(p,s.markets,s.animalMarket,steps);assert.ok(draft.ok);
   for(const card of draft.draft.player.cards){for(let limit=0;limit<5;limit++){draft=harmoniesReplay(p,s.markets,s.animalMarket,steps);assert.ok(draft.ok);if(draft.draft.player.cards.find(c=>c.cardId===card.cardId)!.placed>=harmoniesAnimal(card.cardId).points.length)break;const match=harmoniesMatches(draft.draft.player.board,card.cardId)[0];if(!match)break;steps.push({type:'SETTLE',cardId:card.cardId,origin:match.origin,rotation:match.rotation});}}
   const result=applyHarmoniesAction(s,p.playerId,{type:'SUBMIT_TURN',steps},parse(ServerTimeSchema,2000+turns),f.next());assert.ok(result.ok);s=result.state;parseHarmoniesState(s);
  }
  assert.equal(s.phase,'FINISHED');assert.equal(new Set(s.players.map(p=>p.turns)).size,1);assert.ok(s.result?.winnerPlayerIds.length);assert.equal(s.players[0]!.turns,7);
 }
});
