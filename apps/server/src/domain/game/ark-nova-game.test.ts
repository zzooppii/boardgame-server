import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { ArkSoloViewSchema, GameRevisionSchema, GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, type ArkSoloCommand } from '@hangul-rummikub/shared';
import { createArkSoloGame, applyArkSoloCommand, parseArkSoloState, projectArkSoloGame, type ArkSoloState } from '../../games/ark-nova/domain/game.js';

const playerId = v.parse(PlayerIdSchema,'ark-owner');
const now = v.parse(ServerTimeSchema,1000);
let sequence = 0;
const nextTurn = () => v.parse(TurnIdSchema,`ark-transition-${++sequence}`);
function create() {
  let card = 0;
  return createArkSoloGame({gameId:v.parse(GameIdSchema,'ark-game'),playerId,difficulty:'STANDARD',now,transitionId:nextTurn(),
    random:{nextInt:max=>max-1},nextCardId:()=>`opaque-card-${++card}`});
}
function act(s: ArkSoloState, command: ArkSoloCommand): ArkSoloState {
  const before = structuredClone(s);
  const result = applyArkSoloCommand(s,playerId,s.revision,command,now,nextTurn());
  assert.ok(result.ok, JSON.stringify(result)); assert.deepEqual(s,before);
  return result.state;
}
function started() {
  const s = create(); return act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
}

test('Single command entry point connects setup, 27 legal fundraising turns, breaks, goal choice and FINISHED', () => {
  let s = create();
  assert.equal(s.progress.stage,'SETUP');
  s = act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
  for (let turn = 1; turn <= 27; turn++) {
    s = act(s,{kind:'FUNDRAISE',x:0});
    assert.equal(s.progress.turnsCompleted,turn);
    if (s.pending?.kind === 'BREAK_DISCARD') {
      s = act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
    }
    // Rehydrate between commands, as a repository/resume boundary would.
    s = parseArkSoloState(JSON.parse(JSON.stringify(s)));
  }
  assert.equal(s.money,136); // 25 initial + 31 fundraising + exactly five 16-money incomes.
  assert.equal(s.donations.length,5);
  assert.equal(s.phase,'PLAYING'); assert.equal(s.pending?.kind,'FINAL_GOAL');
  assert.equal(s.progress.stage,'FINAL_SCORING');
  s = act(s,{kind:'FINAL_GOAL',choiceId:s.pending!.choiceId,discard:s.goals[0]!.cardId});
  assert.equal(s.phase,'FINISHED'); assert.equal(s.goals.length,1);
  assert.equal(s.result?.total,-94); assert.equal(s.result?.won,false);
  assert.equal(s.money,136); assert.equal(s.finishedAt,now);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'FUNDRAISE',x:0},now,nextTurn()).ok,false);
});

test('Draw choices persist without completing the turn and reject guessed cards or stale choice IDs', () => {
  let s = started();
  s = act(s,{kind:'FUNDRAISE',x:0}); // CARDS now in strength 3: draw two, discard one.
  const handBefore = s.hand.length, turnsBefore = s.progress.turnsCompleted;
  s = act(s,{kind:'DRAW',x:0});
  assert.equal(s.hand.length,handBefore+2); assert.equal(s.progress.turnsCompleted,turnsBefore);
  assert.equal(s.pending?.kind,'DRAW_DISCARD');
  const before = structuredClone(s);
  for (const command of [
    {kind:'FUNDRAISE',x:0},
    {kind:'DISCARD',choiceId:'stale',cards:[s.hand[0]!.cardId]},
    {kind:'DISCARD',choiceId:s.pending!.choiceId,cards:[s.zooDeck[0]!.cardId]},
    {kind:'DISCARD',choiceId:s.pending!.choiceId,cards:[s.hand[0]!.cardId,s.hand[0]!.cardId]},
  ]) assert.equal(applyArkSoloCommand(s,playerId,s.revision,command,now,nextTurn()).ok,false);
  assert.deepEqual(s,before);
  const choiceId = s.pending!.choiceId;
  s = act(s,{kind:'DISCARD',choiceId,cards:[s.hand[0]!.cardId]});
  assert.equal(s.progress.turnsCompleted,turnsBefore+1); assert.equal(s.pending,null);
  assert.equal(s.actions[0]!.kind,'CARDS');
});

test('Authentication, revision and schemas guard atomic commands; projection hides all non-owned cards', () => {
  const s = started(), before = structuredClone(s);
  const wrongPlayer = v.parse(PlayerIdSchema,'other');
  assert.deepEqual(applyArkSoloCommand(s,wrongPlayer,s.revision,{kind:'FUNDRAISE',x:0},now,nextTurn()),{ok:false,reason:'UNAUTHORIZED'});
  assert.deepEqual(applyArkSoloCommand(s,playerId,s.revision-1,{kind:'FUNDRAISE',x:0},now,nextTurn()),{ok:false,reason:'STALE_REVISION'});
  for (const command of [{kind:'FUNDRAISE',x:1},{kind:'FUNDRAISE',x:-1},{kind:'FUNDRAISE',x:0,money:999},{kind:'INITIAL_HAND',keep:s.hand.map(c=>c.cardId)},{kind:'SNAP',x:0,cardId:s.display[0]!.cardId}]) {
    assert.equal(applyArkSoloCommand(s,playerId,s.revision,command,now,nextTurn()).ok,false);
  }
  assert.deepEqual(s,before);
  const projected = projectArkSoloGame(s,playerId), wire = JSON.stringify(projected);
  for (const card of [...s.zooDeck,...s.goalDeck,...s.discardedGoals,...s.baseProjectReserve,...s.discarded]) assert.equal(wire.includes(`"${card.cardId}"`),false);
  assert.throws(()=>projectArkSoloGame(s,wrongPlayer));
  projected.hand[0]!.key='tampered'; assert.notEqual(s.hand[0]!.key,'tampered');
  const corrupted = structuredClone(s); corrupted.zooDeck.pop(); assert.throws(()=>parseArkSoloState(corrupted));
});

test('Save validation rejects missing choices, forged scores and incompatible card-effect state', () => {
  let s = started();
  const corruptions: Array<(state:ArkSoloState)=>void> = [
    state=>{state.actions[0]!.upgraded=true;},
    state=>{state.buildings[1]!.occupied=true;},
    state=>{state.donations=[0];},
    state=>{state.goals.pop();},
    state=>{state.appeal++;},
    state=>{state.breakStep='CARD_INCOME';},
    state=>{state.revision=v.parse(GameRevisionSchema,0);},
  ];
  for (const corrupt of corruptions) {
    const candidate=structuredClone(s); corrupt(candidate); assert.throws(()=>parseArkSoloState(candidate));
  }
  for (let turn=0;turn<7;turn++) s=act(s,{kind:'FUNDRAISE',x:0});
  assert.equal(s.pending?.kind,'BREAK_DISCARD');
  const missing=structuredClone(s); missing.pending=null; assert.throws(()=>parseArkSoloState(missing));
  const wrongCount=structuredClone(s);
  if (wrongCount.pending?.kind==='BREAK_DISCARD') wrongCount.pending.count++;
  assert.throws(()=>parseArkSoloState(wrongCount));
});

test('X tokens and snapping commit once, preserve card inventory and defer market refill until action completion', () => {
  let s=started();
  for (let i=0;i<5;i++) s=act(s,{kind:'TAKE_X',action:'SPONSORS'});
  const capped=structuredClone(s);
  assert.equal(applyArkSoloCommand(s,playerId,s.revision,{kind:'TAKE_X',action:'SPONSORS'},now,nextTurn()).ok,false);
  assert.deepEqual(s,capped); assert.equal(s.x,5);
  const selected=s.display[5]!, next=s.zooDeck[0]!;
  s=act(s,{kind:'SNAP',x:2,cardId:selected.cardId});
  assert.equal(s.x,3); assert.ok(s.hand.some(c=>c.cardId===selected.cardId));
  assert.equal(s.display[5]!.cardId,next.cardId); assert.equal(s.actions[0]!.kind,'CARDS');
  const snapshot=projectArkSoloGame(s,playerId);
  assert.equal(v.safeParse(ArkSoloViewSchema,{...snapshot,zooDeck:s.zooDeck}).success,false);
  assert.equal(v.safeParse(ArkSoloViewSchema,{...snapshot,hand:[...snapshot.hand,snapshot.hand[0]!]}).success,false);
  snapshot.actions[0]!.upgraded=true; assert.equal(s.actions[0]!.upgraded,false);
});

test('All solo difficulties complete mixed legal command sequences after save/restore at every choice', () => {
  for (const difficulty of ['STANDARD','ADVANCED','EXPERT'] as const) {
    let seed=12345, card=0;
    let s=createArkSoloGame({gameId:v.parse(GameIdSchema,'mixed-game'),playerId,difficulty,now,transitionId:nextTurn(),
      random:{nextInt:max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;}},nextCardId:()=>`mixed-card-${++card}`});
    s=act(s,{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)});
    while (s.phase!=='FINISHED') {
      s=parseArkSoloState(JSON.parse(JSON.stringify(s)));
      const pending=s.pending;
      if (pending?.kind==='FINAL_GOAL') s=act(s,{kind:'FINAL_GOAL',choiceId:pending.choiceId,discard:s.goals[0]!.cardId});
      else if (pending?.kind==='DRAW_DISCARD'||pending?.kind==='BREAK_DISCARD') s=act(s,{kind:'DISCARD',choiceId:pending.choiceId,cards:s.hand.slice(0,pending.count).map(c=>c.cardId)});
      else if (s.progress.turnsCompleted%3===0) s=act(s,{kind:'DRAW',x:0});
      else if (s.progress.turnsCompleted%3===1 && s.x<5) s=act(s,{kind:'TAKE_X',action:'ANIMALS'});
      else s=act(s,{kind:'FUNDRAISE',x:Math.min(1,s.x)});
      assert.ok(v.safeParse(ArkSoloViewSchema,projectArkSoloGame(s,playerId)).success);
    }
    assert.equal(s.progress.turnsCompleted,27); assert.equal(s.donations.length,5);
    assert.equal(s.result?.won,false);
    const forged=structuredClone(s); forged.result!.total=999; forged.result!.won=true;
    assert.throws(()=>parseArkSoloState(forged));
  }
});
test('Owner admission projection preserves WAZA specialization and rejects unknown focus values',()=>{
  for(const focus of [null,'SMALL','LARGE'] as const){
    const s=create();s.wazaFocus=focus;
    assert.equal(v.parse(ArkSoloViewSchema,projectArkSoloGame(s,playerId)).wazaFocus,focus);
  }
  const view=projectArkSoloGame(create(),playerId);
  assert.equal(v.safeParse(ArkSoloViewSchema,{...view,wazaFocus:'MEDIUM'}).success,false);
});
