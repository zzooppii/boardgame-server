import {buildSpeakeasy} from './games/speakeasy/domain/economy.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {GameIdSchema, speakeasyRestaurantDiscardCount, type PlayerId} from '@hangul-rummikub/shared';
import {example, a, b, tile} from './speakeasy.fixture.js';
import {type SpeakeasyEconomy, type SpeakeasyRuleResult} from './games/speakeasy/domain/model.js';
import {startSpeakeasyRoundLifecycle, commitSpeakeasyRoundEconomy, chooseSpeakeasyRestaurantPosition, finishSpeakeasyTurnActions,
  drawSpeakeasyOperation, settleSpeakeasyRound, speakeasyEffectivePosition, parseSpeakeasyRoundLifecycle,
  finalizedSpeakeasyRoundScores, type SpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';

const deckNames = ['VIP', 'PARTY', 'STILLS', 'FLEET'] as const;
function value<T>(result: SpeakeasyRuleResult<T>): T {assert.ok(result.ok); return result.value;}
/** Numeric fixture, not a full original setup or a replacement catalog. */
function seed(players = 2, act: 1 | 2 | 3 | 4 = 1, round = 1) {
  const economy = example(players);
  const deck = (operation: typeof deckNames[number]) => Array.from({length: 12}, (_, i) => ({tileId: tile(`deck-${operation}-${i}`), operation, leverage: 1}));
  return {gameId: parse(GameIdSchema, 'sp-round-test'), revision: 0, economy,
    clock: {act, round, seat: 0, order: economy.players.map(p => p.playerId)},
    decks: {VIP: deck('VIP'), PARTY: deck('PARTY'), STILLS: deck('STILLS'), FLEET: deck('FLEET')}};
}
function visit(s: SpeakeasyRoundLifecycle, position = 0) {
  const actor = s.clock.order[s.clock.seat]!;
  const p = s.economy.players.find(p => p.playerId === actor)!;
  const required = speakeasyRestaurantDiscardCount(s.clock.order.length, position)!;
  return value(chooseSpeakeasyRestaurantPosition(s, actor, {gameId:s.gameId, revision:s.revision, position, discardIds:p.hand.slice(0, required).map(c=>c.tileId)}));
}
function endTurn(s: SpeakeasyRoundLifecycle) {
  s = value(finishSpeakeasyTurnActions(s, s));
  const deck = deckNames.find(name => s.decks[name].length > 0)!;
  return value(drawSpeakeasyOperation(s, s.clock.order[s.clock.seat]!, {gameId:s.gameId, revision:s.revision, deck}));
}
function endRound(s: SpeakeasyRoundLifecycle) {
  while (s.phase === 'PLAYING') s = endTurn(s);
  assert.equal(s.phase, 'ROUND_END');
  return value(settleSpeakeasyRound(s, s));
}
function putCasino(s: SpeakeasyEconomy, owner: PlayerId, district: number, protectedBuilding = false) {
  const p = s.players.find(p => p.playerId === owner)!;
  const at = p.reserves.findIndex(b => b.kind === 'CASINO'), piece = p.reserves.splice(at,1)[0]!;
  s.districts[district-1]!.slots[0] = {piece, ownerId:owner, familyId:protectedBuilding ? p.vip.shift()! : null, barrelId:null};
}

test('Restaurant required discards depend on actual player count and lower-row slot', () => {
  assert.deepEqual([0,1,2,3].map(p=>speakeasyRestaurantDiscardCount(2,p)), [1,2,null,null]);
  assert.deepEqual([0,1,2,3].map(p=>speakeasyRestaurantDiscardCount(3,p)), [1,1,2,null]);
  assert.deepEqual([0,1,2,3].map(p=>speakeasyRestaurantDiscardCount(4,p)), [1,1,2,2]);
  assert.equal(speakeasyRestaurantDiscardCount(5,0), null);
  assert.equal(speakeasyRestaurantDiscardCount(4,1.5), null);
});

test('Restaurant changes effective position immediately and returns discarded cards to the correct deck bottom', () => {
  const original = startSpeakeasyRoundLifecycle(seed());
  const ids = original.economy.players[0]!.hand.slice(0,2).map(c=>c.tileId);
  const beforeDeck = original.decks.PARTY.map(c=>c.tileId);
  const next = visit(original,1);
  assert.equal(speakeasyEffectivePosition(next,a),1);
  assert.deepEqual(next.clock.order,[a,b]); assert.equal(next.clock.seat,0);
  assert.deepEqual(next.decks.PARTY.map(c=>c.tileId),[...beforeDeck,...ids]);
  assert.equal(next.economy.discardedCards.length,0);
  assert.equal(next.economy.players[0]!.hand.length,2);
  assert.equal(original.economy.players[0]!.hand.length,4);
  assert.equal(original.revision,0);
});

test('Restaurant atomically rejects missing/duplicate/foreign cards, occupied slots and forged commands', () => {
  const s = startSpeakeasyRoundLifecycle(seed()), before = structuredClone(s);
  const valid = {gameId:s.gameId,revision:s.revision,position:1,discardIds:[tile('hand-0-0'),tile('hand-0-1')]};
  for (const c of [{...valid,discardIds:[]},{...valid,discardIds:[tile('hand-0-0')]},
    {...valid,discardIds:[tile('hand-0-0'),tile('hand-0-0')]},{...valid,discardIds:[tile('hand-0-0'),tile('hand-1-0')]},
    {...valid,position:2},{...valid,revision:10},{...valid,gameId:'old-game'},{...valid,actorId:a}]) {
    assert.equal(chooseSpeakeasyRestaurantPosition(s,a,c).ok,false);
  }
  assert.equal(chooseSpeakeasyRestaurantPosition(s,b,valid).ok,false); assert.deepEqual(s,before);
  let occupied = visit(s,0);
  assert.equal(chooseSpeakeasyRestaurantPosition(occupied,a,{...valid,revision:occupied.revision}).ok,false);
  occupied = endTurn(occupied);
  assert.equal(chooseSpeakeasyRestaurantPosition(occupied,b,{...valid,revision:occupied.revision,position:0,discardIds:[tile('hand-1-0')]}).ok,false);
});

test('Turn cannot skip its top-card draw or use a delayed draw/settlement twice', () => {
  let s = startSpeakeasyRoundLifecycle(seed());
  const draw = {gameId:s.gameId,revision:s.revision,deck:'VIP'};
  assert.equal(drawSpeakeasyOperation(s,a,draw).ok,false);
  assert.equal(settleSpeakeasyRound(s,s).ok,false);
  s = value(finishSpeakeasyTurnActions(s,s));
  assert.equal(finishSpeakeasyTurnActions(s,s).ok,false);
  assert.equal(drawSpeakeasyOperation(s,b,{...draw,revision:s.revision}).ok,false);
  assert.equal(drawSpeakeasyOperation(s,a,{...draw,revision:s.revision,cardId:'deck-VIP-5'}).ok,false);
  const previous = s, top = s.decks.VIP[0]!.tileId;
  s = value(drawSpeakeasyOperation(s,a,{...draw,revision:s.revision}));
  assert.equal(s.economy.players[0]!.hand.at(-1)!.tileId,top); assert.equal(s.clock.seat,1);
  assert.equal(drawSpeakeasyOperation(s,a,{...draw,revision:previous.revision}).ok,false);
  s = endTurn(s); const finished = value(settleSpeakeasyRound(s,s));
  assert.equal(settleSpeakeasyRound(finished,s).ok,false);
  assert.equal(settleSpeakeasyRound(finished,finished).ok,false);
});

test('Same-position Restaurant visit still pays all operating casinos in cash, not safe money', () => {
  for (const count of [2,3,4]) {
    const source = seed(count), c = source.economy.players[2]?.playerId;
    putCasino(source.economy,a,1); putCasino(source.economy,b,7);
    source.economy.districts[6]!.cop = true;
    if (c) {putCasino(source.economy,c,13,true);source.economy.districts[12]!.cop = true;}
    const s = endRound(visit(startSpeakeasyRoundLifecycle(source),0));
    assert.deepEqual(s.clock.order,source.clock.order);
    assert.equal(s.economy.players[0]!.cash,15+(count===2?5:3));
    assert.equal(s.economy.players[1]!.cash,15);
    if (c) assert.equal(s.economy.players[2]!.cash,18);
    assert.ok(s.economy.players.every(p=>p.safe===30));
    assert.equal(s.lastSettlement!.restaurantVisited,true);
  }
});

test('No Restaurant visitor means no casino payout; lower-row markers clear for the next round', () => {
  const source = seed();putCasino(source.economy,a,1);
  let s = endRound(startSpeakeasyRoundLifecycle(source));assert.equal(s.economy.players[0]!.cash,15);
  assert.equal(s.lastSettlement!.restaurantVisited,false);
  s = endRound(visit(s,1));assert.deepEqual(s.clock.order,[b,a]);
  assert.deepEqual(s.lowerRow,[null,null]);assert.equal(s.clock.seat,0);
  s = endRound(visit(s,0));assert.equal(s.economy.players[0]!.cash,25);
});

test('Unmoved players retain order and the next actor follows the settled lower row', () => {
  let s = startSpeakeasyRoundLifecycle(seed(4));
  const [first,second,third,fourth] = s.clock.order;
  s = endTurn(s); // first does not visit
  s = endTurn(visit(s,3)); // second chooses fourth
  s = endTurn(s); // third does not visit
  s = endTurn(visit(s,1)); // fourth chooses second
  s = value(settleSpeakeasyRound(s,s));
  assert.deepEqual(s.clock.order,[first,fourth,third,second]);
  assert.equal(s.clock.seat,0);
});

test('Final-round casino cash is included before the winner is calculated', () => {
  const source = seed(2,4,1);putCasino(source.economy,a,1);
  let s = startSpeakeasyRoundLifecycle(source);assert.equal(finalizedSpeakeasyRoundScores(s),null);
  s = endRound(visit(s,0));
  assert.equal(s.phase,'FINAL_SCORING');assert.equal(s.economy.players[0]!.cash,20);
  assert.deepEqual(finalizedSpeakeasyRoundScores(s)!.winners,[a]);
  assert.equal(settleSpeakeasyRound(s,s).ok,false);
});

test('Every 2/3/4-player round ends after its last mandatory draw, before Luciano/final scoring', () => {
  for (const count of [2,3,4]) for (const act of [1,2,3,4] as const) {
    let s = startSpeakeasyRoundLifecycle(seed(count,act));let draws=0;
    const rounds = [4,3,3,1][act-1]!;
    for (let round=1;round<=rounds;round++) {
      for (let seat=0;seat<count;seat++) {s=endTurn(s);draws++;}
      assert.equal(s.phase,'ROUND_END');s=value(settleSpeakeasyRound(s,s));
      assert.equal(s.phase,round<rounds?'PLAYING':act===4?'FINAL_SCORING':'LUCIANO');
    }
    assert.equal(draws,count*rounds);
  }
});

test('Round state restores exact draw/marker position and validates malformed snapshots', () => {
  let s=visit(startSpeakeasyRoundLifecycle(seed()),1);
  s=value(finishSpeakeasyTurnActions(s,s));
  const restored=parseSpeakeasyRoundLifecycle(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored,s);
  assert.equal(speakeasyEffectivePosition(restored,a),1);
  assert.throws(()=>parseSpeakeasyRoundLifecycle({...s,phase:'FINAL_SCORING'}));
  assert.throws(()=>parseSpeakeasyRoundLifecycle({...s,lowerRow:[a,a]}));
  const duplicate=structuredClone(s);duplicate.decks.VIP.push(duplicate.decks.VIP[0]!);
  assert.throws(()=>parseSpeakeasyRoundLifecycle(duplicate));
  const mixed=structuredClone(s);mixed.decks.VIP.push(mixed.decks.PARTY.shift()!);
  assert.throws(()=>parseSpeakeasyRoundLifecycle(mixed));
});

test('Authorized economic actions integrate without losing discarded cards or committing failures', () => {
  const before = startSpeakeasyRoundLifecycle(seed());
  const request = {pieceId:tile('casino-0-0'), district:1, slot:0, goons:0, useAssociate:false, freeAssociate:false, discardIds:[tile('hand-0-0')]};
  const outcome = buildSpeakeasy(before.economy,a,request,{kinds:['CASINO'],upgrade:false});
  const after = value(commitSpeakeasyRoundEconomy(before,before,outcome));
  assert.equal(after.decks.PARTY.at(-1)!.tileId,tile('hand-0-0'));
  assert.equal(after.economy.discardedCards.length,0);
  assert.equal(after.economy.players[0]!.safe,26);
  assert.equal(after.economy.districts[0]!.slots[0]!.piece.kind,'CASINO');
  assert.equal(before.economy.players[0]!.safe,30);
  assert.equal(commitSpeakeasyRoundEconomy(after,before,outcome).ok,false);
  assert.deepEqual(commitSpeakeasyRoundEconomy(before,before,{ok:false,reason:'INSUFFICIENT_FUNDS'}),{ok:false,reason:'INSUFFICIENT_FUNDS'});
  const drawPhase=value(finishSpeakeasyTurnActions(after,after));
  assert.equal(commitSpeakeasyRoundEconomy(drawPhase,drawPhase,outcome).ok,false);
});
