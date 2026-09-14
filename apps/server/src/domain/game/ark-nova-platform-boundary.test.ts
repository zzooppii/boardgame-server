import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { PROTOCOL_VERSION, ArkNovaActCommandSchema, ArkNovaProjectionSchema, GameIdSchema, PlayerIdSchema, ServerTimeSchema, TurnIdSchema, type ArkSoloCommand } from '@hangul-rummikub/shared';
import { createArkSoloGame } from '../../games/ark-nova/domain/game.js';
import { ArkNovaGameStateAdapter, type ArkNovaStoredGame } from '../../games/ark-nova/compatibility/adapter.js';
import { projectArkNova } from '../../games/ark-nova/compatibility/projector.js';
import { prepareArkNovaCommand } from '../../games/ark-nova/application/prepare-command.js';
const owner=v.parse(PlayerIdSchema,'ark-session-owner'),now=v.parse(ServerTimeSchema,1000);
let seq=0;
const deps={clock:{now:()=>now},ids:{generateTurnId:()=>v.parse(TurnIdSchema,`ark-wire-${++seq}`)},random:{nextInt:(max:number)=>max-1},authorization:{isCurrent:()=>true}};
function game():ArkNovaStoredGame {
  const state=createArkSoloGame({gameId:v.parse(GameIdSchema,'ark-wire-game'),playerId:owner,difficulty:'STANDARD',now,transitionId:v.parse(TurnIdSchema,'ark-start'),random:deps.random,nextCardId:()=>`ark-private-${++seq}`});
  return {gameId:state.gameId,gameRevision:state.revision,startedAt:now,finishedAt:null,state};
}
const wire=(g:ArkNovaStoredGame,payload:ArkSoloCommand)=>({kind:'arkNova:act',protocolVersion:PROTOCOL_VERSION,requestId:`request-${++seq}`,gameId:g.gameId,expectedGameRevision:g.gameRevision,turnId:g.state.transitionId,payload});
test('Ark stored adapter rejects wrapper drift and returns isolated state and a timer-free lifecycle',()=>{
  const original=game(),adapter=new ArkNovaGameStateAdapter(),copy=adapter.cloneAndValidate(original);
  copy.state.hand.pop();assert.equal(original.state.hand.length,8);
  assert.deepEqual(adapter.inspectLifecycle(original),{lifecycle:'RUNNING',gameId:original.gameId,gameRevision:original.gameRevision,activeTurn:null});
  for(const changed of [{...original,gameId:v.parse(GameIdSchema,'other-game')},{...original,startedAt:v.parse(ServerTimeSchema,1001)},{...original,finishedAt:now}])assert.throws(()=>adapter.cloneAndValidate(changed));
});
test('Ark wire boundary rejects stale game, revision, transition and untrusted identity fields without changing state',()=>{
  const g=game(),before=structuredClone(g),command=wire(g,{kind:'INITIAL_HAND',keep:g.state.hand.slice(0,4).map(c=>c.cardId)});
  assert.equal(v.safeParse(ArkNovaActCommandSchema,{...command,playerId:owner}).success,false);
  for(const changed of [{...command,gameId:'other'},{...command,expectedGameRevision:1},{...command,turnId:'old-transition'}]) {
    const result=prepareArkNovaCommand(g,owner,changed,deps);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.error.code,'STALE_GAME_REVISION');
  }
  assert.equal(prepareArkNovaCommand(g,v.parse(PlayerIdSchema,'intruder'),command,deps).ok,false);
  assert.equal(prepareArkNovaCommand(g,owner,command,{...deps,authorization:{isCurrent:()=>false}}).ok,false);
  let current=true;
  assert.equal(prepareArkNovaCommand(g,owner,command,{...deps,clock:{now:()=>{current=false;return now;}},authorization:{isCurrent:()=>current}}).ok,false);
  assert.deepEqual(g,before);
});
test('Ark owner projection has matching metadata and hides deck contents and reserve cards',()=>{
  const g=game(),view=projectArkNova(g,owner);assert.ok(v.safeParse(ArkNovaProjectionSchema,view).success);
  assert.equal(Object.hasOwn(view.state,'zooDeck'),false);assert.equal(Object.hasOwn(view.state,'baseProjectReserve'),false);assert.equal(Object.hasOwn(view.state,'discarded'),false);
  assert.equal(view.state.deckCount,g.state.zooDeck.length);assert.equal(view.state.hand.length,8);
  assert.throws(()=>projectArkNova(g,v.parse(PlayerIdSchema,'intruder')));
  assert.equal(v.safeParse(ArkNovaProjectionSchema,{...view,gameRevision:1}).success,false);
  view.state.hand.pop();assert.equal(g.state.hand.length,8);
});
test('Ark wire candidates preserve atomicity from initial choice through 27 turns and finished projection',()=>{
  let g=game();
  for(let guard=0;g.state.phase!=='FINISHED'&&guard<60;guard++) {
    const s=g.state;
    const payload:ArkSoloCommand=s.progress.stage==='SETUP'?{kind:'INITIAL_HAND',keep:s.hand.slice(0,4).map(c=>c.cardId)}:
      s.pending?.kind==='BREAK_DISCARD'?{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)}:
      s.pending?.kind==='FINAL_GOAL'?{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId}:{kind:'FUNDRAISE',x:0};
    const command=wire(g,payload),before=structuredClone(g),result=prepareArkNovaCommand(g,owner,command,deps);assert.ok(result.ok);
    assert.deepEqual(g,before);assert.equal(result.game.gameRevision,g.gameRevision+1);assert.equal(prepareArkNovaCommand(result.game,owner,command,deps).ok,false);
    g=new ArkNovaGameStateAdapter().cloneAndValidate(JSON.parse(JSON.stringify(result.game)));projectArkNova(g,owner);
  }
  assert.equal(g.state.progress.turnsCompleted,27);assert.equal(projectArkNova(g,owner).phase,'FINISHED');
  assert.deepEqual(new ArkNovaGameStateAdapter().inspectLifecycle(g),{lifecycle:'FINISHED',gameId:g.gameId,finishedAt:now});
});
