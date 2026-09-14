import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_MAP_A, ARK_BUILDINGS, ARK_ACTIONS, ARK_CARDS, arkInitialBuildings, arkDistance, type ArkCard, type ArkSoloProgress } from '@hangul-rummikub/shared';
import { arkAppealIncome, arkKioskIncome } from '../../games/ark-nova/domain/income.js';
import { drawArkCards, takeArkDisplayCard, replenishArkDisplay, discardArkHand, type ArkCardZones } from '../../games/ark-nova/domain/card-zones.js';
import { beginArkSoloBreak, resolveArkSoloBreakDiscard, completeArkSoloBreak, type ArkBreakState } from '../../games/ark-nova/domain/solo-break.js';
import { createArkSoloProgress, startArkSolo, finishArkSoloTurn } from '../../games/ark-nova/domain/solo-lifecycle.js';
import { scoreArkSoloGoal } from '../../games/ark-nova/domain/goals.js';
import { calculateArkSoloFinalScore } from '../../games/ark-nova/domain/final-scoring.js';
import { arkAnimalHousingChoices, occupyArkAnimalHousing, arkEnclosuresToEmpty } from '../../games/ark-nova/domain/animal-housing.js';

const card = (n: number): ArkCard => ({cardId: `opaque-${n}`, key: String(n)});
const zones = (): ArkCardZones => ({zooDeck: Array.from({length: 30}, (_, i) => card(i + 20)), display: Array.from({length: 6}, (_, i) => card(i)), hand: [card(10), card(11), card(12), card(13)], discarded: []});
const inventory = (z: ArkCardZones) => [...z.zooDeck, ...z.display.filter(c => c !== null), ...z.hand, ...z.discarded].map(c => c.cardId).sort();

test('Market holes preserve card slot positions until the complete turn ends; card zones conserve all IDs', () => {
  const s = zones(), before = inventory(s);
  assert.equal(takeArkDisplayCard(s, 'opaque-5', 5), false);
  assert.equal(takeArkDisplayCard(s, 'unknown', 6), false);
  assert.equal(takeArkDisplayCard(s, 'opaque-1', 2), true);
  assert.equal(s.display[1], null);
  assert.equal(s.display[5]?.cardId, 'opaque-5');
  assert.equal(takeArkDisplayCard(s, 'opaque-1', 6), false);
  drawArkCards(s, 2);
  assert.equal(s.hand.length, 7);
  assert.equal(discardArkHand(s, ['opaque-10', 'opaque-10'], 2), false);
  assert.equal(discardArkHand(s, ['opaque-10', 'opaque-49'], 2), false);
  assert.equal(discardArkHand(s, ['opaque-10', 'opaque-20'], 2), true);
  replenishArkDisplay(s);
  assert.deepEqual(s.display.map(c => c?.cardId), ['opaque-0', 'opaque-2', 'opaque-3', 'opaque-4', 'opaque-5', 'opaque-22']);
  assert.deepEqual(inventory(s), before);
});

test('Appeal income uses the board bands; kiosk pays once per adjacent occupied or special building', () => {
  for (const [appeal, income] of [[0,5],[4,9],[5,10],[6,10],[7,11],[9,11],[10,12],[20,16],[21,17],[51,25],[52,26],[95,34],[96,35],[101,35],[102,36],[107,36],[108,37],[113,37]]) assert.equal(arkAppealIncome(appeal!), income);
  for (const value of [-1, 114, 0.5, NaN]) assert.throws(() => arkAppealIncome(value));
  const buildings = arkInitialBuildings();
  assert.equal(buildings[1]!.occupied, false);
  assert.equal(arkKioskIncome(buildings), 0);
  buildings[1]!.occupied = true;
  assert.equal(arkKioskIncome(buildings), 1);
  const touching = [
    {id: 'k', kind: 'KIOSK', cells: [{q:0,r:0}], occupied: false, used: 0},
    {id: 's', kind: 'ReptileHouse', cells: [{q:1,r:0},{q:1,r:-1}], occupied: false, used: 0},
    {id: 'p', kind: 'PAVILION', cells: [{q:0,r:1}], occupied: false, used: 0},
  ];
  assert.equal(arkKioskIncome(touching), 2);
});

function breakState(progress: ArkSoloProgress): ArkBreakState {
  return {...zones(), progress, breakStep: 'NOT_STARTED', donations: [],
    actions: ARK_ACTIONS.map(kind => ({kind, upgraded: false, venom: true, constriction: true, multiplier: 2})),
    buildings: arkInitialBuildings(), workers: 2, busyWorkers: 2, taskWorkers: {REPUTATION: 2},
    partners: ['Europe'], partnerSupply: [], universities: [], universitySupply: [], money: 0, appeal: 20};
}

test('Real break pipeline runs five times across 27 turns, with no sixth income or donation', () => {
  const start = startArkSolo(createArkSoloProgress('STANDARD').progress); assert.ok(start.ok);
  let s = breakState(start.progress), breaks = 0;
  for (let turn = 0; turn < 27; turn++) {
    const next = finishArkSoloTurn(s.progress, 0); assert.ok(next.ok); s.progress = next.progress;
    if (s.progress.stage !== 'BREAK') continue;
    s.breakStep = 'NOT_STARTED';
    const before = structuredClone(s), cardsBefore = inventory(s);
    const begun = beginArkSoloBreak(s); assert.ok(begun.ok); assert.deepEqual(s, before);
    assert.equal(beginArkSoloBreak(begun.state).ok, false);
    assert.equal(resolveArkSoloBreakDiscard(begun.state, {discard: ['unknown']}).ok, false);
    const count = Math.max(0, s.hand.length - 3);
    const discarded = resolveArkSoloBreakDiscard(begun.state, {discard: s.hand.slice(0, count).map(c => c.cardId)}); assert.ok(discarded.ok);
    assert.equal(discarded.state.money, s.money + 16);
    assert.equal(discarded.state.busyWorkers, 0);
    assert.deepEqual(discarded.state.taskWorkers, {});
    assert.ok(discarded.state.actions.every(c => !c.venom && !c.constriction && c.multiplier === 0));
    assert.equal(discarded.state.partnerSupply.includes('Europe'), false);
    assert.equal(discarded.state.partnerSupply.length, 4);
    assert.equal(discarded.state.universitySupply.length, 3);
    assert.equal(completeArkSoloBreak(discarded.state, 1).ok, false);
    const complete = completeArkSoloBreak(discarded.state, 0); assert.ok(complete.ok); s = complete.state;
    assert.deepEqual(inventory(s), cardsBefore); breaks++;
  }
  assert.equal(breaks, 5); assert.equal(s.money, 80); assert.equal(s.donations.length, 5);
  assert.equal(s.progress.stage, 'FINAL_SCORING');
  assert.equal(beginArkSoloBreak({...s, breakStep: 'NOT_STARTED'}).ok, false);
});

test('Hand-limit university keeps five and break selections cannot smuggle extra fields or IDs', () => {
  const s = breakState({stage:'BREAK', round:1, turnsCompleted:7, turnInRound:7});
  s.hand.push(card(14), card(15)); s.universities = ['HAND_LIMIT'];
  const begun = beginArkSoloBreak(s); assert.ok(begun.ok);
  assert.equal(resolveArkSoloBreakDiscard(begun.state, {discard: [], income: 999}).ok, false);
  assert.equal(resolveArkSoloBreakDiscard(begun.state, {discard: []}).ok, false);
  const result = resolveArkSoloBreakDiscard(begun.state, {discard: ['opaque-14']}); assert.ok(result.ok);
  assert.equal(result.state.hand.length, 5);
});

test('Original final goals count actual animals, icons, open land and complete map coverage', () => {
  const context = {universities:[],x:0,played: [{cardId:'a', key:'406'}, {cardId:'b', key:'407'}], buildings: arkInitialBuildings(), universityResearch: 0, supportedProjects: 0, reputation: 1};
  assert.equal(scoreArkSoloGoal('001', context), 2);
  assert.equal(scoreArkSoloGoal('002', context), 0);
  assert.equal(scoreArkSoloGoal('006', context), 4);
  assert.equal(scoreArkSoloGoal('011', context), 1);
  assert.equal(scoreArkSoloGoal('003', {...context, universityResearch: 6}), 4);
  assert.equal(scoreArkSoloGoal('005', {...context, supportedProjects: 6}), 4);
  assert.equal(scoreArkSoloGoal('007', {...context, reputation: 15}), 4);
  const full = ARK_MAP_A.filter(c => c.terrain === 'LAND').map((c, i) => ({id:`b${i}`,kind:'PAVILION',cells:[{q:c.q,r:c.r}],occupied:false,used:0}));
  assert.equal(scoreArkSoloGoal('004', {...context, buildings: full}), 4);
  assert.equal(scoreArkSoloGoal('006', {...context, buildings: full}), 0);
  assert.throws(() => scoreArkSoloGoal('009', context));
});

test('Special enclosures have distinct printed hex topology', () => {
  const degrees = (kind: string) => ARK_BUILDINGS[kind]!.shape.map(c => ARK_BUILDINGS[kind]!.shape.filter(n => arkDistance(c,n) === 1).length).sort();
  assert.deepEqual(degrees('PettingZoo'), [1,1,2]);
  assert.deepEqual(degrees('ReptileHouse'), [2,2,2,2,4]);
  assert.deepEqual(degrees('LargeBirdAviary'), [1,2,2,3,4]);
});

test('Final scoring includes sponsor goals, clamps track caps and never fabricates a client score', () => {
  const context = {universities:[],x:0,played: [{cardId:'lab', key:'201'}, {cardId:'polar',key:'251'}, {cardId:'bear1',key:'408'}, {cardId:'bear2',key:'415'}],
    buildings: arkInitialBuildings(), universityResearch: 5, supportedProjects: 0, reputation: 15,
    appeal: 64, conservation: 15, partners: [], goals: [{cardId:'goal',key:'007'}]};
  const score = calculateArkSoloFinalScore(context);
  assert.equal(score.goalPoints, 4);
  assert.equal(score.sponsorPoints, 3); // Science Lab 2, Polar Bear Exhibit 1 (including its own bear).
  assert.equal(score.conservation, 22);
  assert.equal(score.total, 6); assert.equal(score.won, true);
  const capped = calculateArkSoloFinalScore({...context, appeal:113, conservation:40});
  assert.equal(capped.conservation, 41); assert.equal(capped.appeal, 113);
  assert.throws(() => calculateArkSoloFinalScore({...context, appeal:114}));
  assert.throws(() => calculateArkSoloFinalScore({...context, goals:[]}));
});

test('Animals occupy a suitable empty enclosure atomically; release chooses smallest eligible rather than historical housing', () => {
  const animal = ARK_CARDS.find(c => c.key === '408')!;
  const original = arkInitialBuildings();
  assert.deepEqual(arkAnimalHousingChoices(original, animal), ['initial-enclosure']);
  assert.equal(occupyArkAnimalHousing(original, animal, 'initial-kiosk').ok, false);
  const placed = occupyArkAnimalHousing(original, animal, 'initial-enclosure'); assert.ok(placed.ok);
  assert.equal(original[1]!.occupied, false);
  assert.equal(placed.buildings[1]!.occupied, true);
  assert.deepEqual(arkAnimalHousingChoices(placed.buildings, animal), []);
  assert.deepEqual(arkEnclosuresToEmpty(placed.buildings, animal), ['initial-enclosure']);
  assert.deepEqual(arkEnclosuresToEmpty(original, animal), []);
});
