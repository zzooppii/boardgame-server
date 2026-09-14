import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { GameIdSchema, PlayerIdSchema, type ArkSoloProgress } from '@hangul-rummikub/shared';
import { createArkSoloProgress, startArkSolo, finishArkSoloTurn, finishArkSoloBreak, occupyArkSoloDonation, completeArkSoloScoring, parseArkSoloProgress } from '../../games/ark-nova/domain/solo-lifecycle.js';
import { createArkSoloSetup, chooseArkSoloInitialHand, projectArkSoloSetup, parseArkSoloSetup } from '../../games/ark-nova/domain/solo-setup.js';
import { startArkAction, finishArkAction, takeArkXToken } from '../../games/ark-nova/domain/action-row.js';
import { arkVictoryPoints } from '../../games/ark-nova/domain/scoring.js';

const playerId = v.parse(PlayerIdSchema, 'solo-player'), gameId = v.parse(GameIdSchema, 'solo-game');
function setup() { let n = 0; return createArkSoloSetup({gameId, playerId, difficulty: 'STANDARD', random: {nextInt: () => 0}, nextCardId: () => `opaque-${++n}`}); }
test('Solo immediately replaces goal 009 without losing or exposing the discarded goal instance', () => {
  let n = 0;
  const s = createArkSoloSetup({gameId, playerId, difficulty: 'STANDARD', random: {nextInt: upper => upper === 9 ? 0 : upper - 1}, nextCardId: () => `goal-test-${++n}`});
  assert.deepEqual(s.goals.map(c => c.key), ['002', '003']);
  assert.deepEqual(s.discardedGoals.map(c => c.key), ['009']);
  assert.equal(s.goals.length + s.goalDeck.length + s.discardedGoals.length, 11);
  assert.equal(JSON.stringify(projectArkSoloSetup(s, playerId)).includes(s.discardedGoals[0]!.cardId), false);
});
test('Victory points follow the printed scoring areas and the official worked examples', () => {
  assert.equal(arkVictoryPoints(72, 16), -4);
  assert.equal(arkVictoryPoints(79, 18), 9);
  assert.equal(arkVictoryPoints(64, 20), 0);
  for (const [conservation, target] of [[0,114],[1,112],[9,96],[10,94],[11,91],[40,4],[41,1]]) {
    assert.equal(arkVictoryPoints(0, conservation!), -target!);
    if (target! <= 113) {
      assert.equal(arkVictoryPoints(target!, conservation!), 0);
      assert.equal(arkVictoryPoints(target! - 1, conservation!), -1);
    }
  }
  for (const [appeal, conservation] of [[-1,0],[114,0],[1,-1],[1,42],[1.5,1],[1,NaN]]) {
    assert.throws(() => arkVictoryPoints(appeal!, conservation!));
  }
});
test('Official solo timeline resolves exactly 27 completed turns and five breaks, with no sixth income phase', () => {
  const initial = createArkSoloProgress('STANDARD'), start = startArkSolo(initial.progress);
  assert.ok(start.ok); assert.equal(initial.appeal, 20);
  let progress: ArkSoloProgress = start.progress; const rounds: number[] = []; let breaks = 0;
  for (let round = 1; round <= 6; round++) {
    let turns = 0;
    while (progress.stage === 'ACTION') { const next = finishArkSoloTurn(progress, 0); assert.ok(next.ok); progress = next.progress; turns++; }
    rounds.push(turns);
    if (round < 6) { assert.equal(progress.stage, 'BREAK'); const next = finishArkSoloBreak(progress, 0); assert.ok(next.ok); progress = next.progress; breaks++; }
  }
  assert.deepEqual(rounds, [7, 6, 5, 4, 3, 2]); assert.equal(breaks, 5);
  assert.equal(progress.stage, 'FINAL_SCORING'); assert.equal(progress.turnsCompleted, 27);
  assert.equal(finishArkSoloBreak(progress, 0).ok, false);
  assert.equal(finishArkSoloTurn(progress, 0).ok, false);
  for (const [score, won] of [[-1, false], [0, true], [1, true]] as const) {
    const result = completeArkSoloScoring(progress, score); assert.ok(result.ok); assert.equal(result.won, won);
    assert.equal(completeArkSoloScoring(result.progress, score).ok, false);
  }
});
test('Solo lifecycle rejects unresolved effects, forged counters, premature scoring and duplicate transitions', () => {
  const initial = createArkSoloProgress('EXPERT'); assert.equal(initial.appeal, 0);
  assert.equal(createArkSoloProgress('ADVANCED').appeal, 10);
  assert.equal(finishArkSoloTurn(initial.progress, 0).ok, false);
  const start = startArkSolo(initial.progress); assert.ok(start.ok);
  assert.equal(startArkSolo(start.progress).ok, false);
  assert.equal(finishArkSoloTurn(start.progress, 1).ok, false);
  assert.equal(finishArkSoloTurn(start.progress, -1).ok, false);
  assert.equal(completeArkSoloScoring(start.progress, 100).ok, false);
  assert.throws(() => parseArkSoloProgress({...start.progress, turnsCompleted: 27}));
  assert.throws(() => parseArkSoloProgress({...start.progress, round: 7}));
  assert.throws(() => parseArkSoloProgress({...start.progress, stage: 'BREAK'}));
});
test('Solo removed tokens block cheapest available donation, never the repeatable 12 space', () => {
  const original = [0, 1]; const first = occupyArkSoloDonation(original);
  assert.deepEqual(first, {occupied: [0, 1, 2], blocked: 2}); assert.deepEqual(original, [0, 1]);
  const full = [0, 1, 2, 3, 4, 5, 6]; assert.deepEqual(occupyArkSoloDonation(full), {occupied: full, blocked: null});
  for (const invalid of [[7], [0, 0], [-1], [0.5]]) assert.throws(() => occupyArkSoloDonation(invalid));
});
test('Solo setup preserves the entire base inventory and hides the market until hand selection', () => {
  const s = setup(), projection = projectArkSoloSetup(s, playerId);
  assert.equal(s.zooDeck.length + s.display.length + s.hand.length, 212);
  assert.equal(s.goalDeck.length + s.goals.length + s.discardedGoals.length, 11);
  assert.equal(s.baseProjectReserve.length + s.baseProjects.length, 12);
  assert.equal(s.hand.length, 8); assert.equal(s.money, 25); assert.equal(s.appeal, 20);
  assert.equal(s.actions[0]!.kind, 'ANIMALS'); assert.equal(new Set(s.actions.map(c=>c.kind)).size, 5);
  assert.deepEqual(projection.display, [null,null,null,null,null,null]);
  const serialized = JSON.stringify(projection);
  for (const c of [...s.display, ...s.zooDeck, ...s.goalDeck, ...s.baseProjectReserve]) assert.equal(serialized.includes(`"${c.cardId}"`), false);
  assert.throws(() => projectArkSoloSetup(s, v.parse(PlayerIdSchema, 'other')));
  projection.hand[0]!.key = 'modified'; assert.notEqual(s.hand[0]!.key, 'modified');
});
test('Initial choice validates actor, revision, exact cardinality and hidden card ownership before atomic commit', () => {
  const s = setup(), before = structuredClone(s), keep = s.hand.slice(0,4).map(c=>c.cardId);
  assert.equal(chooseArkSoloInitialHand(s, v.parse(PlayerIdSchema,'other'),0,{keep}).ok,false);
  assert.equal(chooseArkSoloInitialHand(s,playerId,1,{keep}).ok,false);
  for (const invalid of [keep.slice(0,3),[keep[0],keep[0],keep[1],keep[2]],[...keep.slice(0,3),s.display[0]!.cardId],[...keep.slice(0,3),'unknown']]) assert.equal(chooseArkSoloInitialHand(s,playerId,0,{keep:invalid}).ok,false);
  assert.deepEqual(s,before);
  const next = chooseArkSoloInitialHand(s,playerId,0,{keep}); assert.ok(next.ok);
  assert.deepEqual(s,before); assert.equal(next.state.hand.length,4); assert.equal(next.state.discarded.length,4);
  assert.equal(next.state.revision,1); assert.equal(next.state.progress.stage,'ACTION');
  assert.deepEqual(projectArkSoloSetup(next.state,playerId).display,s.display);
  assert.equal(chooseArkSoloInitialHand(next.state,playerId,1,{keep}).ok,false);
  const corrupted=structuredClone(next.state);corrupted.zooDeck[0]!.cardId=corrupted.hand[0]!.cardId;
  assert.throws(()=>parseArkSoloSetup(corrupted));
  assert.throws(()=>parseArkSoloSetup({...s, revision: 1}));
  assert.throws(()=>parseArkSoloSetup({...next.state, revision: 0}));
});
test('Action strength spends X before resolution and shifts only the used action to slot one', () => {
  const row=setup().actions,before=structuredClone(row),kind=row[3]!.kind;
  assert.deepEqual(startArkAction(row,kind,3,2),{ok:true,strength:6,xRemaining:1,upgraded:false});
  assert.equal(startArkAction(row,kind,1,2).ok,false);
  const shifted=finishArkAction(row,kind);
  assert.deepEqual(shifted.map(c=>c.kind),[kind,row[0]!.kind,row[1]!.kind,row[2]!.kind,row[4]!.kind]);
  assert.deepEqual(row,before);
  assert.equal(takeArkXToken(row,kind,5).ok,false);
  const alternate=takeArkXToken(row,kind,4);assert.ok(alternate.ok);assert.equal(alternate.x,5);
  const bound=structuredClone(row);bound[0]!.constriction=true;
  assert.equal(startArkAction(bound,bound[0]!.kind,0,0).ok,false);
  assert.ok(takeArkXToken(bound,bound[0]!.kind,0).ok);
});
