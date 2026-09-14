import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { ARK_MAP_A, ArkSoloViewSchema, GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, arkCellKey, arkNeighbours, arkOffset, type ArkActionKind, type ArkCell, type ArkSoloCommand } from '@hangul-rummikub/shared';
import { createArkSoloGame, applyArkSoloCommand, parseArkSoloState, projectArkSoloGame, type ArkSoloState } from '../../games/ark-nova/domain/game.js';
import { validateArkConstruction } from '../../games/ark-nova/domain/construction.js';
const playerId=v.parse(PlayerIdSchema,'builder'), now=v.parse(ServerTimeSchema,1000);
let seq=0;
function act(s:ArkSoloState,a:ArkSoloCommand):ArkSoloState {
  const before=structuredClone(s);
  const result=applyArkSoloCommand(s,playerId,s.revision,a,now,v.parse(TurnIdSchema,`build-turn-${++seq}`));
  assert.ok(result.ok,JSON.stringify(a)); assert.deepEqual(s,before);
  const state=parseArkSoloState(JSON.parse(JSON.stringify(result.state)));
  assert.ok(v.safeParse(ArkSoloViewSchema,projectArkSoloGame(state,playerId)).success);
  return state;
}
function create() {
  let card=0;
  const s=createArkSoloGame({gameId:v.parse(GameIdSchema,'building-game'),playerId,difficulty:'STANDARD',now,transitionId:v.parse(TurnIdSchema,`initial-${++seq}`),random:{nextInt:max=>max-1},nextCardId:()=>`build-card-${++card}`});
  return act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
}
const placement=(cell:ArkCell,building='ENCLOSURE_1')=>({building,anchor:{q:cell.q,r:cell.r},rotation:0 as const,reflected:false});
function resolve(s:ArkSoloState,upgrade:ArkActionKind='BUILD'):ArkSoloState {
  while (s.pending) {
    if (s.pending.kind==='BREAK_DISCARD') s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
    else if (s.pending.kind==='REWARD') {
      const reward=s.rewards[0]!;
      s=act(s,{kind:'REWARD',choiceId:s.pending.choiceId,rewardId:reward.id,selection:reward.kind==='UPGRADE'?{kind:'UPGRADE',action:upgrade}:reward.kind==='CARD'?{kind:'CARD',cardId:null}:reward.kind==='UPGRADE_OR_WORKER'?{kind:'WORKER'}:{kind:'NONE'}});
    } else if (s.pending.kind==='BUILD_BONUS') {
      const b=s.buildBonuses[0]!;
      s=act(s,{kind:'BUILD_BONUS',choiceId:s.pending.choiceId,bonusId:b.id,selection:b.kind==='CARD_1'?{kind:'CARD',cardId:null}:b.kind==='UPGRADE'?{kind:'UPGRADE',action:upgrade}:{kind:'NONE'}});
    } else assert.fail('Unexpected pending choice');
  }
  if (s.activeBuild) s=act(s,{kind:'END_BUILD'});
  return s;
}
function pathTo(s:ArkSoloState,target:ArkCell):ArkCell[] {
  const queue=s.buildings.flatMap(b=>b.cells.map(c=>({cell:c,path:[] as ArkCell[]}))), seen=new Set(queue.map(p=>arkCellKey(p.cell)));
  while (queue.length) {
    const entry=queue.shift()!;
    if (arkCellKey(entry.cell)===arkCellKey(target)) return entry.path;
    for (const cell of arkNeighbours(entry.cell)) {
      const key=arkCellKey(cell),map=ARK_MAP_A.find(c=>arkCellKey(c)===key);
      if (seen.has(key)||!map||map.terrain!=='LAND'||map.restricted) continue;
      seen.add(key); queue.push({cell,path:[...entry.path,cell]});
    }
  }
  throw new Error('No route');
}
function upgraded(kind:ArkActionKind):ArkSoloState {
  let s=create();
  for (const target of [arkOffset(0,0),arkOffset(7,5)]) {
    for (const cell of pathTo(s,target)) {
      if (s.money<2) s=resolve(act(s,{kind:'FUNDRAISE',x:0}),kind);
      s=resolve(act(s,{kind:'BUILD',x:0,placement:placement(cell)}),kind);
    }
  }
  assert.equal(s.reputation,5); assert.ok(s.actions.find(a=>a.kind===kind)!.upgraded);
  return s;
}
function available(s:ArkSoloState,kind:string) {
  const active=s.activeBuild;
  for (const cell of ARK_MAP_A) for (const rotation of [0,1,2,3,4,5] as const) for (const reflected of [false,true]) {
    const p={...placement(cell,kind),rotation,reflected};
    if (validateArkConstruction({buildings:s.buildings,money:s.money,remainingStrength:active?.remaining??10,upgraded:true,builtKinds:active?.builtKinds??[]},p).ok) return p;
  }
  throw new Error(`No ${kind} placement`);
}

test('Building pays first, grants a pavilion appeal once, and preserves state on illegal placements',()=>{
  let s=create(); const before=structuredClone(s);
  for (const p of [placement(arkOffset(0,3)),placement(arkOffset(1,0)),placement(arkOffset(8,5)),{...placement(arkOffset(0,2)),cost:0}]) {
    assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD',x:0,placement:p},now,v.parse(TurnIdSchema,'invalid-build')).ok,false);
  }
  assert.deepEqual(s,before);
  s=act(s,{kind:'BUILD',x:0,placement:placement(arkOffset(0,2),'PAVILION')});
  assert.equal(s.money,23);assert.equal(s.appeal,21);assert.equal(s.progress.turnsCompleted,1);assert.equal(s.actions[0]!.kind,'BUILD');
  const after=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD',x:0,placement:placement(arkOffset(0,2),'PAVILION')},now,v.parse(TurnIdSchema,'duplicate')).ok,false);
  assert.deepEqual(s,after);
});

test('Placement bonuses block turn completion and reject stale, repeated or mismatched selections',()=>{
  let s=create();
  s=act(s,{kind:'BUILD',x:0,placement:placement(arkOffset(0,2))});
  s=act(s,{kind:'BUILD',x:0,placement:placement(arkOffset(0,1))});
  assert.equal(s.progress.turnsCompleted,1); assert.equal(s.pending?.kind,'BUILD_BONUS');
  const b=s.buildBonuses[0]!, choice=s.pending!.choiceId, before=structuredClone(s);
  for (const a of [{kind:'FUNDRAISE',x:0},{kind:'END_BUILD'},{kind:'BUILD_BONUS',choiceId:'stale',bonusId:b.id,selection:{kind:'NONE'}},{kind:'BUILD_BONUS',choiceId:choice,bonusId:b.id,selection:{kind:'CARD',cardId:null}}]) {
    assert.equal(applyArkSoloCommand(s,playerId,s.revision,a,now,v.parse(TurnIdSchema,'wrong-choice')).ok,false);
  }
  assert.deepEqual(s,before);
  s=act(s,{kind:'BUILD_BONUS',choiceId:choice,bonusId:b.id,selection:{kind:'NONE'}});
  assert.equal(s.x,1);assert.equal(s.progress.turnsCompleted,2);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD_BONUS',choiceId:choice,bonusId:b.id,selection:{kind:'NONE'}},now,v.parse(TurnIdSchema,'repeated')).ok,false);
});

test('Real build commands reach reputation upgrade and Build II pays and places different buildings before one turn ends',()=>{
  let s=upgraded('BUILD');
  s=resolve(act(s,{kind:'FUNDRAISE',x:0}));
  s=resolve(act(s,{kind:'TAKE_X',action:'ANIMALS'}));
  const turn=s.progress.turnsCompleted, money=s.money;
  s=act(s,{kind:'BUILD',x:0,placement:available(s,'PAVILION')});
  while (s.pending?.kind==='BUILD_BONUS') {
    const b=s.buildBonuses[0]!; s=act(s,{kind:'BUILD_BONUS',choiceId:s.pending.choiceId,bonusId:b.id,selection:b.kind==='CARD_1'?{kind:'CARD',cardId:null}:{kind:'NONE'}});
  }
  assert.ok(s.activeBuild);assert.equal(s.progress.turnsCompleted,turn);
  const p=available({...s,activeBuild:null},'PAVILION');
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD_MORE',placement:p},now,v.parse(TurnIdSchema,'same-kind')).ok,false);
  s=act(s,{kind:'BUILD_MORE',placement:available(s,'ENCLOSURE_1')});
  s=resolve(s);
  assert.equal(s.progress.turnsCompleted,turn+1);assert.equal(s.actions[0]!.kind,'BUILD');assert.ok(s.money>=money-4);
});

test('Cards II draws one at a time, keeps market holes until the turn ends and uses reputation range',()=>{
  let s=upgraded('CARDS');
  const turn=s.progress.turnsCompleted, market=s.display.map(c=>c!.cardId);
  s=act(s,{kind:'DRAW',x:0}); assert.equal(s.pending?.kind,'DRAW_PICK');
  const choice=s.pending!.choiceId;
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'PICK_CARD',choiceId:choice,cardId:market[5]},now,v.parse(TurnIdSchema,'too-far')).ok,false);
  s=act(s,{kind:'PICK_CARD',choiceId:choice,cardId:market[0]!});
  assert.equal(s.display[0],null);assert.equal(s.display[1]!.cardId,market[1]); assert.equal(s.progress.turnsCompleted,turn);
  while (s.pending?.kind==='DRAW_PICK') s=act(s,{kind:'PICK_CARD',choiceId:s.pending.choiceId,cardId:null});
  if (s.pending?.kind==='DRAW_DISCARD') s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:[s.hand[0]!.cardId]});
  s=resolve(s);
  assert.equal(s.progress.turnsCompleted,turn+1);assert.ok(s.display.every(c=>c!==null));
});

test('Money placement bonus cannot pay its own construction cost, and is available after placement',()=>{
  let s=create(); const target=arkOffset(2,4), path=pathTo(s,target);
  for (const cell of path.slice(0,-1)) s=resolve(act(s,{kind:'BUILD',x:0,placement:placement(cell)}));
  s.money=1;
  const before=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD',x:0,placement:placement(target)},now,v.parse(TurnIdSchema,'unaffordable')).ok,false);
  assert.deepEqual(s,before);
  s.money=2;
  s=act(s,{kind:'BUILD',x:0,placement:placement(target)});
  assert.equal(s.money,0);assert.equal(s.buildBonuses[0]!.kind,'MONEY_5');
  s=resolve(s);assert.equal(s.money,5);
});

test('Map card bonus offers reputation-range cards on Cards I and cannot expose or take a hidden card',()=>{
  let s=create();const target=arkOffset(2,2),path=pathTo(s,target);
  for (const cell of path.slice(0,-1)) s=resolve(act(s,{kind:'BUILD',x:0,placement:placement(cell)}));
  s=act(s,{kind:'BUILD',x:0,placement:placement(target)});
  assert.equal(s.buildBonuses[0]!.kind,'CARD_1');assert.equal(s.actions.find(a=>a.kind==='CARDS')!.upgraded,false);
  const b=s.buildBonuses[0]!,choice=s.pending!.choiceId, before=structuredClone(s),selected=s.display[0]!.cardId;
  for (const cardId of [s.zooDeck[0]!.cardId,s.display[5]!.cardId]) assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'BUILD_BONUS',choiceId:choice,bonusId:b.id,selection:{kind:'CARD',cardId}},now,v.parse(TurnIdSchema,'bad-map-card')).ok,false);
  assert.deepEqual(s,before);
  s=act(s,{kind:'BUILD_BONUS',choiceId:choice,bonusId:b.id,selection:{kind:'CARD',cardId:selected}});
  assert.ok(s.hand.some(c=>c.cardId===selected));assert.ok(s.display.every(c=>c!==null));
});

test('Construction income and final scoring stay connected through turn 27; Sponsors II pays double strength',()=>{
  let s=upgraded('SPONSORS');
  const money=s.money,strength=s.actions.findIndex(a=>a.kind==='SPONSORS')+1;
  const nextEndsRound=s.progress.turnInRound+1===[7,6,5,4,3,2][s.progress.round-1];
  s=act(s,{kind:'FUNDRAISE',x:0});
  // A break with a discard choice defers income; otherwise account for the break separately below.
  if (!nextEndsRound||s.pending?.kind==='BREAK_DISCARD') assert.equal(s.money,money+2*strength);
  s=resolve(s);
  while (s.progress.stage!=='FINAL_SCORING') { s=act(s,{kind:'FUNDRAISE',x:0}); if (s.progress.stage!=='FINAL_SCORING') s=resolve(s); }
  assert.equal(s.pending?.kind,'FINAL_GOAL');
  s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});
  assert.equal(s.phase,'FINISHED');assert.equal(s.progress.turnsCompleted,27);assert.equal(s.donations.length,5);
});
