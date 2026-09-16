import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {GameIdSchema} from '@hangul-rummikub/shared';
import {example, a, b, tile} from './speakeasy.fixture.js';
import {type SpeakeasyRuleResult} from './games/speakeasy/domain/model.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {speakeasyDefenseActor} from './games/speakeasy/domain/luciano.js';
import {startSpeakeasyGameFlow, parseSpeakeasyGameFlow, placeSpeakeasyCapo, finishSpeakeasyLocation,
  drawSpeakeasyTurnCard, settleSpeakeasyGameRound, beginSpeakeasyMobWar, advanceSpeakeasyMobWar,
  defendSpeakeasyGame, beginSpeakeasyNextAct, commitSpeakeasyLocationEconomy, type SpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
const value = <T>(r: SpeakeasyRuleResult<T>): T => {assert.ok(r.ok); return r.value;};
const mobPhase = (s: SpeakeasyGameFlow) => s.luciano?.phase;
const guard = (s: SpeakeasyGameFlow) => ({gameId:s.round.gameId,revision:s.round.revision});
function setup(count = 2) {
  const economy = example(count);
  const deck = (operation: 'VIP'|'PARTY'|'STILLS'|'FLEET') => Array.from({length:12},(_,i)=>({tileId:tile(`deck-${operation}-${i}`),operation,leverage:1}));
  const round = startSpeakeasyRoundLifecycle({gameId:parse(GameIdSchema,'flow'),revision:0,economy,
    clock:{act:1,round:1,seat:0,order:economy.players.map(p=>p.playerId)},
    decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}});
  // Deliberately synthetic slots/catalog: tests sequencing, not official board setup.
  const capos = economy.players.map((p,i)=>({playerId:p.playerId,available:Array.from({length:4},(_,j)=>tile(`capo-${i}-${j}`)),retired:[],placed:[]}));
  const spaces = capos.flatMap(p=>p.available.map(id=>({id:`space-${id}`,location:'GARAGE'})));
  spaces.push({id:'restaurant',location:'RESTAURANT'});
  return startSpeakeasyGameFlow(round,spaces,capos);
}
function place(s:SpeakeasyGameFlow, restaurant = false, position = 0) {
  const actor=s.round.clock.order[s.round.clock.seat]!, capoId=s.capos.find(p=>p.playerId===actor)!.available[0]!;
  const p=s.round.economy.players.find(p=>p.playerId===actor)!;
  return value(placeSpeakeasyCapo(s,actor,{...guard(s),capoId,spaceId:restaurant?'restaurant':`space-${capoId}`,
    ...(restaurant?{restaurant:{position,discardIds:p.hand.slice(0,position >= (s.capos.length===2?1:2)?2:1).map(c=>c.tileId)}}:{})}));
}
function end(s:SpeakeasyGameFlow) {
  const actor=s.round.clock.order[s.round.clock.seat]!;
  s=value(finishSpeakeasyLocation(s,guard(s)));
  const deck=(['VIP','PARTY','STILLS','FLEET'] as const).find(d=>s.round.decks[d].length)!;
  return value(drawSpeakeasyTurnCard(s,actor,{...guard(s),deck}));
}
function finishAct(s:SpeakeasyGameFlow) {
  while(s.round.phase==='PLAYING') {
    s=end(place(s));
    if(s.round.phase==='ROUND_END') s=value(settleSpeakeasyGameRound(s,guard(s)));
  }
  return s;
}
function war(s:SpeakeasyGameFlow) {
  const act=s.round.clock.act;
  const count=s.capos.length===2?[2,2,3][act-1]!:[3,3,4][act-1]!;
  const districts=s.round.economy.districts.filter(d=>!d.blocked&&d.mobsterStrength===null).slice(0,count).map(d=>d.id);
  return value(beginSpeakeasyMobWar(s,guard(s),{districts,copDistricts:[],payoutTables:[[12,8,4,2,1],[12,8,4,2,1],[12,8,4,2,1]],
    deck:districts.map((_,i)=>({tileId:tile(`mobster-${act}-${i}`),strength:1,modifier:0}))}));
}
function finishWar(s:SpeakeasyGameFlow) {
  while(s.luciano?.phase!=='COMPLETE') {
    if(s.luciano?.phase==='DEFENSE') {
      const actor=speakeasyDefenseActor(s.luciano)!;
      const buildingId=s.luciano.current!.pending.find(id=>s.round.economy.districts.some(d=>d.slots.some(b=>b?.piece.tileId===id&&b.ownerId===actor)))!;
      s=value(defendSpeakeasyGame(s,actor,{...guard(s),buildingId,defend:false,goons:0,useAssociate:false,freeAssociate:false}));
    } else s=value(advanceSpeakeasyMobWar(s,guard(s)));
  }
  return s;
}

test('Capo placement requires turn ownership, a real own Capo and an available verified space',()=>{
  const s=setup(), before=structuredClone(s), command={...guard(s),capoId:tile('capo-0-0'),spaceId:'space-capo-0-0'};
  for(const input of [{...command,capoId:tile('capo-1-0')},{...command,spaceId:'missing'}, {...command,revision:10},
    {...command,gameId:'other'},{...command,actor:a},{...command,restaurant:{position:0,discardIds:[tile('hand-0-0')]}}]) assert.equal(placeSpeakeasyCapo(s,a,input).ok,false);
  assert.equal(placeSpeakeasyCapo(s,b,command).ok,false);
  const next=place(s);assert.equal(next.round.revision,1);assert.equal(next.capos[0]!.available.length,3);
  assert.equal(placeSpeakeasyCapo(next,a,{...command,...guard(next)}).ok,false);
  assert.deepEqual(s,before);
});
test('Cannot finish actions, commit location effects or draw before placing a Capo',()=>{
  const s=setup();assert.equal(finishSpeakeasyLocation(s,guard(s)).ok,false);
  assert.equal(commitSpeakeasyLocationEconomy(s,guard(s),{ok:true,value:s.round.economy}).ok,false);
  assert.equal(drawSpeakeasyTurnCard(s,a,{...guard(s),deck:'VIP'}).ok,false);
  const placed=place(s);assert.equal(drawSpeakeasyTurnCard(placed,a,{...guard(placed),deck:'VIP'}).ok,false);
});
test('Normal space stays occupied after a turn; Restaurant permits multiple Capos with atomic payment',()=>{
  let s=end(place(setup()));
  assert.equal(placeSpeakeasyCapo(s,b,{...guard(s),capoId:tile('capo-1-0'),spaceId:'space-capo-0-0'}).ok,false);
  s=setup();const before=structuredClone(s);
  assert.equal(placeSpeakeasyCapo(s,a,{...guard(s),capoId:tile('capo-0-0'),spaceId:'restaurant'}).ok,false);
  assert.equal(placeSpeakeasyCapo(s,a,{...guard(s),capoId:tile('capo-0-0'),spaceId:'restaurant',restaurant:{position:1,discardIds:[tile('hand-1-0'),tile('hand-1-1')]}}).ok,false);
  assert.deepEqual(s,before);
  s=end(place(s,true,1)); s=end(place(s,true,0));
  assert.ok(s.capos.every(p=>p.placed[0]!.spaceId==='restaurant'));
  s=value(settleSpeakeasyGameRound(s,guard(s))); assert.deepEqual(s.round.clock.order,[b,a]);
  assert.equal(s.active,null);
});
test('Drawing ends the active location but does not free its space or allow replay',()=>{
  const s=place(setup()), ready=value(finishSpeakeasyLocation(s,guard(s)));
  assert.equal(finishSpeakeasyLocation(ready,guard(ready)).ok,false);
  const next=end(s);assert.equal(next.active,null);assert.equal(next.capos[0]!.placed.length,1);
  assert.equal(drawSpeakeasyTurnCard(next,a,{...guard(ready),deck:'VIP'}).ok,false);
  assert.equal(commitSpeakeasyLocationEconomy(ready,guard(ready),{ok:true,value:ready.round.economy}).ok,false);
});
test('All 2/3/4-player acts preserve Capos and carry settled economy/decks through Mob War',()=>{
  for(const count of [2,3,4]) {
    let s=setup(count), turns=0;
    const initialCapos=s.capos.flatMap(p=>p.available).sort();
    for(let act=1;act<=4;act++) {
      const rounds=[4,3,3,1][act-1]!;
      s=finishAct(s);turns+=rounds*count;
      assert.ok(s.capos.every(p=>p.available.length===0&&p.placed.length===rounds));
      if(act===4){assert.equal(s.round.phase,'FINAL_SCORING');break;}
      assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
      s=war(s);assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
      assert.equal(beginSpeakeasyMobWar(s,guard(s),s.luciano!).ok,false);
      s=finishWar(s);const old=structuredClone(s), previous=guard(s);
      s=value(beginSpeakeasyNextAct(s,guard(s)));
      assert.equal(s.round.clock.act,act+1);assert.equal(s.round.clock.round,1);
      assert.deepEqual(s.round.economy,old.round.economy);assert.deepEqual(s.round.decks,old.round.decks);
      assert.equal(s.history.length,act);assert.equal(s.luciano,null);
      assert.ok(s.capos.every(p=>p.available.length===[3,3,1][act-1]&&p.placed.length===0));
      assert.equal(beginSpeakeasyNextAct(s,previous).ok,false);
      assert.deepEqual(s.capos.flatMap(p=>[...p.available,...p.retired]).sort(),initialCapos);
    }
    assert.equal(turns,11*count);assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  }
});
test('Restored flow retains exact location, draw, occupied slots and rejects inconsistent progress',()=>{
  const s=value(finishSpeakeasyLocation(place(setup()),{gameId:parse(GameIdSchema,'flow'),revision:1}));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(s))),s);
  assert.throws(()=>parseSpeakeasyGameFlow({...s,active:null}));
  const bad=structuredClone(s);bad.capos[0]!.available.push(bad.capos[0]!.placed[0]!.tileId);
  assert.throws(()=>parseSpeakeasyGameFlow(bad));
  const missing=structuredClone(s);missing.spaces=[];assert.throws(()=>parseSpeakeasyGameFlow(missing));
  const final=finishWar(war(finishAct(setup())));
  assert.deepEqual(parseSpeakeasyGameFlow(JSON.parse(JSON.stringify(final))),final);
  const mismatched=structuredClone(final);mismatched.luciano!.revision--;assert.throws(()=>parseSpeakeasyGameFlow(mismatched));
  const next=value(beginSpeakeasyNextAct(final,guard(final)));assert.throws(()=>parseSpeakeasyGameFlow({...next,history:[]}));
});

test('Location effects commit only during the active action and failures preserve the full flow',()=>{
  const s=place(setup()), before=structuredClone(s);
  const failed=commitSpeakeasyLocationEconomy(s,guard(s),{ok:false,reason:'INSUFFICIENT_FUNDS'});
  assert.deepEqual(failed,{ok:false,reason:'INSUFFICIENT_FUNDS'});assert.deepEqual(s,before);
  // A resolved server reward. Clients never supply an economy snapshot to this internal hook.
  const reward=structuredClone(s.round.economy);reward.players[0]!.cash+=3;
  const next=value(commitSpeakeasyLocationEconomy(s,guard(s),{ok:true,value:reward}));
  assert.equal(next.round.economy.players[0]!.cash,s.round.economy.players[0]!.cash+3);
  assert.equal(next.round.revision,s.round.revision+1);assert.deepEqual(next.active,s.active);
  assert.equal(commitSpeakeasyLocationEconomy(next,guard(s),{ok:true,value:reward}).ok,false);
});

test('Mob War pauses for the owner defense and police/payout cannot be skipped before the next act',()=>{
  let s=setup();
  const p=s.round.economy.players[0]!, index=p.reserves.findIndex(b=>b.kind==='SPEAKEASY');
  s.round.economy.districts[0]!.slots[0]={piece:p.reserves.splice(index,1)[0]!,ownerId:a,familyId:null,barrelId:null};
  s=war(finishAct(parseSpeakeasyGameFlow(s)));
  s=value(advanceSpeakeasyMobWar(s,guard(s)));assert.equal(mobPhase(s),'DEFENSE');
  const command={...guard(s),buildingId:s.luciano!.current!.pending[0]!,defend:false,goons:0,useAssociate:false,freeAssociate:false};
  assert.equal(advanceSpeakeasyMobWar(s,guard(s)).ok,false);
  assert.equal(defendSpeakeasyGame(s,b,command).ok,false);
  assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  const previous=structuredClone(s);
  s=value(defendSpeakeasyGame(s,a,command));
  assert.equal(previous.round.economy.districts[0]!.slots[0]!.ownerId,a);
  assert.equal(s.round.economy.districts[0]!.slots[0],null);
  assert.equal(defendSpeakeasyGame(s,a,command).ok,false);
  while(s.luciano!.phase!=='PAYOUT') s=value(advanceSpeakeasyMobWar(s,guard(s)));
  assert.equal(beginSpeakeasyNextAct(s,guard(s)).ok,false);
  s=value(advanceSpeakeasyMobWar(s,guard(s)));
  const money=s.round.economy.players.map(p=>p.safe);
  assert.equal(advanceSpeakeasyMobWar(s,guard(s)).ok,false);
  s=value(beginSpeakeasyNextAct(s,guard(s)));
  assert.deepEqual(s.round.economy.players.map(p=>p.safe),money);
});
