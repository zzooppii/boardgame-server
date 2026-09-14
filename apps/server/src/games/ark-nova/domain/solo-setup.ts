import * as v from 'valibot';
import {
  ARK_CARDS, ARK_GOALS, ARK_PROJECTS, ArkActionCardSchema, ArkBuildingSchema, ArkCardSchema,
  ArkRefSchema, ArkSoloDifficultySchema, ArkSoloProgressSchema, GameIdSchema,
  PlayerIdSchema, GameRevisionSchema, arkInitialBuildings,
  type ArkCard, type ArkSoloDifficulty, type GameId, type PlayerId,
} from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import { createArkSoloProgress, parseArkSoloProgress, startArkSolo } from './solo-lifecycle.js';

const cards = v.array(ArkCardSchema);
export const ArkSoloSetupStateSchema = v.strictObject({
  gameId: GameIdSchema,
  playerId: PlayerIdSchema,
  revision: GameRevisionSchema,
  difficulty: ArkSoloDifficultySchema,
  progress: ArkSoloProgressSchema,
  zooDeck: cards,
  display: v.pipe(cards, v.length(6)),
  hand: cards,
  discarded: cards,
  goalDeck: cards,
  discardedGoals: cards,
  goals: v.pipe(cards, v.length(2)),
  baseProjectReserve: cards,
  baseProjects: v.pipe(cards, v.length(3)),
  actions: v.pipe(v.array(ArkActionCardSchema), v.length(5)),
  buildings: v.array(ArkBuildingSchema),
  money: v.literal(25),
  appeal: v.picklist([0, 10, 20]),
  conservation: v.literal(0),
  reputation: v.literal(1),
  workers: v.literal(1),
  x: v.literal(0),
});
export type ArkSoloSetup = v.InferOutput<typeof ArkSoloSetupStateSchema>;
const ChooseHand = v.strictObject({keep: v.pipe(v.array(ArkRefSchema), v.length(4))});

function shuffle<T>(input: readonly T[], random: RandomSource): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1);
    if (!Number.isSafeInteger(j) || j < 0 || j > i) throw new Error('Invalid random source result.');
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
const expectedZoo = () => [...ARK_CARDS.map(c => c.key), ...ARK_PROJECTS.filter(c => c.kind !== 'BASE').map(c => c.key)];
const expectedBase = () => ARK_PROJECTS.filter(c => c.kind === 'BASE').map(c => c.key);
function sameInventory(actual: readonly ArkCard[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.map(c => c.key).sort().join('|') === [...expected].sort().join('|');
}
export function assertArkCardInventory(zoo: readonly ArkCard[], goals: readonly ArkCard[], projects: readonly ArkCard[]): void {
  const all = [...zoo, ...goals, ...projects];
  if (new Set(all.map(c => c.cardId)).size !== all.length || !sameInventory(zoo, expectedZoo()) ||
    !sameInventory(goals, ARK_GOALS.map(c => c.key)) || !sameInventory(projects, expectedBase())) {
    throw new Error('Ark solo card inventory mismatch.');
  }
}
export function parseArkSoloSetup(input: unknown): ArkSoloSetup {
  const s = v.parse(ArkSoloSetupStateSchema, input);
  parseArkSoloProgress(s.progress);
  const zoo = [...s.zooDeck, ...s.display, ...s.hand, ...s.discarded];
  const goals = [...s.goalDeck, ...s.goals, ...s.discardedGoals];
  const projects = [...s.baseProjectReserve, ...s.baseProjects];
  assertArkCardInventory(zoo, goals, projects);
  if (s.progress.stage !== 'SETUP' && s.progress.stage !== 'ACTION' || s.progress.turnsCompleted !== 0 ||
    s.revision !== (s.progress.stage === 'SETUP' ? 0 : 1) ||
    s.hand.length !== (s.progress.stage === 'SETUP' ? 8 : 4) ||
    s.discarded.length !== (s.progress.stage === 'SETUP' ? 0 : 4) ||
    s.actions[0]!.kind !== 'ANIMALS' || new Set(s.actions.map(c => c.kind)).size !== 5 ||
    s.actions.some(c => c.upgraded || c.venom || c.constriction || c.multiplier !== 0) ||
    JSON.stringify(s.buildings) !== JSON.stringify(arkInitialBuildings()) ||
    s.goals.some(c => c.key === '009') || s.discardedGoals.some(c => c.key !== '009') ||
    s.appeal !== createArkSoloProgress(s.difficulty).appeal) throw new Error('Ark solo setup invariant failed.');
  return s;
}
export function createArkSoloSetup(input: Readonly<{
  gameId: GameId; playerId: PlayerId; difficulty: ArkSoloDifficulty; random: RandomSource; nextCardId: () => string;
}>): ArkSoloSetup {
  const makeCards = (keys: readonly string[]): ArkCard[] => keys.map(key => ({key, cardId: input.nextCardId()}));
  const zooDeck = shuffle(makeCards(expectedZoo()), input.random);
  const goalDeck = shuffle(makeCards(ARK_GOALS.map(c => c.key)), input.random);
  const baseProjectReserve = shuffle(makeCards(expectedBase()), input.random);
  const display = zooDeck.splice(0, 6), hand = zooDeck.splice(0, 8);
  const goals: ArkCard[] = [], discardedGoals: ArkCard[] = [];
  // Glossary p.8: replace Biodiverse Zoo immediately whenever drawn in solo.
  while (goals.length < 2) {
    const goal = goalDeck.shift();
    if (!goal) throw new Error('Insufficient solo final scoring cards.');
    (goal.key === '009' ? discardedGoals : goals).push(goal);
  }
  const otherActions = shuffle(['CARDS', 'BUILD', 'ASSOCIATION', 'SPONSORS'] as const, input.random);
  const {progress, appeal} = createArkSoloProgress(input.difficulty);
  return parseArkSoloSetup({gameId: input.gameId, playerId: input.playerId, revision: 0, difficulty: input.difficulty, progress,
    zooDeck, display, hand, discarded: [], goalDeck, discardedGoals, goals, baseProjectReserve, baseProjects: baseProjectReserve.splice(0, 3),
    actions: ['ANIMALS', ...otherActions].map(kind => ({kind, upgraded: false, venom: false, constriction: false, multiplier: 0})),
    buildings: arkInitialBuildings(), money: 25, appeal, conservation: 0, reputation: 1, workers: 1, x: 0});
}
/** Runtime validation and ownership precede any candidate mutation. Never reveals guessed card IDs. */
export function chooseArkSoloInitialHand(current: ArkSoloSetup, actor: PlayerId, expectedRevision: number, input: unknown):
  Readonly<{ok: true; state: ArkSoloSetup}> | Readonly<{ok: false; reason: 'UNAUTHORIZED' | 'STALE_REVISION' | 'INVALID_PHASE' | 'INVALID_CHOICE'}> {
  if (actor !== current.playerId) return {ok: false, reason: 'UNAUTHORIZED'};
  if (expectedRevision !== current.revision) return {ok: false, reason: 'STALE_REVISION'};
  if (current.progress.stage !== 'SETUP') return {ok: false, reason: 'INVALID_PHASE'};
  const parsed = v.safeParse(ChooseHand, input);
  if (!parsed.success || new Set(parsed.output.keep).size !== 4 || parsed.output.keep.some(id => !current.hand.some(c => c.cardId === id))) {
    return {ok: false, reason: 'INVALID_CHOICE'};
  }
  const s = parseArkSoloSetup(current), keep = new Set(parsed.output.keep);
  s.discarded.push(...s.hand.filter(c => !keep.has(c.cardId)));
  s.hand = s.hand.filter(c => keep.has(c.cardId));
  const started = startArkSolo(s.progress);
  if (!started.ok) return {ok: false, reason: 'INVALID_PHASE'};
  s.progress = started.progress;
  s.revision = v.parse(GameRevisionSchema, s.revision + 1);
  return {ok: true, state: parseArkSoloSetup(s)};
}

/** Explicit whitelist: the display stays hidden until the initial four cards are chosen. */
export function projectArkSoloSetup(state: ArkSoloSetup, viewer: PlayerId) {
  if (viewer !== state.playerId) throw new Error('Unauthorized Ark solo projection.');
  return {
    gameId: state.gameId, playerId: state.playerId, revision: state.revision, difficulty: state.difficulty,
    progress: {...state.progress}, money: state.money, appeal: state.appeal,
    conservation: state.conservation, reputation: state.reputation, workers: state.workers, x: state.x,
    actions: state.actions.map(c => ({...c})), buildings: state.buildings.map(b => ({...b, cells: b.cells.map(c => ({...c}))})),
    hand: state.hand.map(c => ({...c})), goals: state.goals.map(c => ({...c})),
    baseProjects: state.baseProjects.map(c => ({...c})),
    display: state.progress.stage === 'SETUP' ? Array.from({length: 6}, () => null) : state.display.map(c => ({...c})),
    deckCount: state.zooDeck.length, discardCount: state.discarded.length,
  };
}
