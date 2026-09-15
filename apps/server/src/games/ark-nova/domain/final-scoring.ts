import { ARK_ANIMAL_TAGS, ARK_CARDS, ARK_CONTINENTS, ARK_MAP_A, arkBorder, arkCellKey, arkNeighbours, type ArkCard } from '@hangul-rummikub/shared';
import { scoreArkSoloGoal, type ArkGoalContext } from './goals.js';
import { arkVictoryPoints } from './scoring.js';

export type ArkFinalContext = ArkGoalContext & Readonly<{
  rightZoo?: readonly ArkCard[] | undefined;
  universities: readonly string[];
  x: number;
  appeal: number;
  conservation: number;
  partners: readonly string[];
  goals: readonly ArkCard[];
}>;
export type ArkFinalScore = Readonly<{
  appeal: number;
  conservation: number;
  goalPoints: number;
  sponsorPoints: number;
  sponsorAppeal: number;
  total: number;
  won: boolean;
  details: readonly Readonly<{cardId: string; conservation: number; appeal: number}>[];
}>;

/** Empty land is scored in separate connected groups, not as one total. */
function emptyGroupScore(covered: ReadonlySet<string>): number {
  const empty = new Set(ARK_MAP_A.filter(c => c.terrain === 'LAND' && !covered.has(arkCellKey(c))).map(arkCellKey));
  let points = 0;
  for (const cell of ARK_MAP_A) {
    if (!empty.delete(arkCellKey(cell))) continue;
    const queue = [cell]; let size = 0;
    while (queue.length > 0) {
      const next = queue.shift()!; size++;
      for (const n of arkNeighbours(next)) {
        if (!empty.delete(arkCellKey(n))) continue;
        const mapCell = ARK_MAP_A.find(c => arkCellKey(c) === arkCellKey(n));
        if (mapCell) queue.push(mapCell);
      }
    }
    points += Math.floor(size / 6);
  }
  return points;
}

/** Resolve final goal selection first. This never accepts a score from a client. */
export function calculateArkSoloFinalScore(context: ArkFinalContext): ArkFinalScore {
  arkVictoryPoints(context.appeal, context.conservation);
  if (context.goals.length === 0 || !context.rightZoo&&context.goals.some(c => c.key === '009') ||
    new Set(context.goals.map(c => c.cardId)).size !== context.goals.length) throw new Error('Final goals have not been resolved.');
  const definitions = context.played.map(c => {
    const d = ARK_CARDS.find(d => d.key === c.key);
    if (!d) throw new Error('Unknown played zoo card.');
    return d;
  });
  const icons = (tag: string) => definitions.reduce((sum, c) => sum +
    (tag === 'Water' ? c.water : tag === 'Rock' ? (c.rock ?? 0) : c.tags.filter(t => t === tag).length), 0) +
    (tag === 'Science' ? context.universityResearch : context.partners.filter(p => p === tag).length);
  const categories = [...ARK_ANIMAL_TAGS, 'Bear'];
  const covered = new Set(context.buildings.flatMap(b => b.cells.map(arkCellKey)));
  const empty = (c: {q: number; r: number}) => !covered.has(arkCellKey(c));
  const adjacent = (c: {q: number; r: number}) => arkNeighbours(c).some(n => covered.has(arkCellKey(n)));
  const connectedTerrain = (terrain: 'WATER' | 'ROCK') => ARK_MAP_A.filter(c => c.terrain === terrain && empty(c)).every(adjacent);
  const isolatedTerrain = (terrain: 'WATER' | 'ROCK') => ARK_MAP_A.filter(c => c.terrain === terrain && empty(c) && !adjacent(c)).length;
  const full = ARK_MAP_A.filter(c => c.terrain === 'LAND').every(c => !empty(c));
  const details: {cardId: string; conservation: number; appeal: number}[] = [];
  let goalPoints = 0, sponsorPoints = 0, sponsorAppeal = 0;
  for (const goal of context.goals) {
    const points = goal.key==='009'&&context.rightZoo?Math.min(4,[...ARK_ANIMAL_TAGS,'Bear'].filter(tag=>icons(tag)>context.rightZoo!.reduce((sum,c)=>sum+(ARK_CARDS.find(d=>d.key===c.key)?.tags.filter(t=>t===tag).length??0),0)).length):scoreArkSoloGoal(goal.key, context);
    details.push({cardId: goal.cardId, conservation: points, appeal: 0}); goalPoints += points;
  }
  for (const card of context.played) {
    let points = 0, appeal = 0;
    switch (card.key) {
      case '203': case '209': points = Number(context.universities.length === 3); break;
      case '210': points = Number(context.buildings.filter(b=>b.kind==='KIOSK').length>=5); break;
      case '211': points = Number(context.buildings.filter(b=>b.kind==='ENCLOSURE_1'&&b.occupied).length>=5); break;
      case '214': appeal = context.x; break;
      case '216': case '220': points = Number(context.reputation>=9); break;
      case '217': appeal = full ? 5 : 0; break;
      case '219': appeal = 2*Math.min(3,icons('Water'),icons('Rock')); break;
      case '221': points = Number(ARK_MAP_A.filter(c=>c.terrain==='LAND'&&arkBorder(c)).every(c=>!empty(c))); break;
      case '201': points = icons('Science') >= 6 ? 2 : Number(icons('Science') >= 3); break;
      case '208': case '261': points = Number(categories.filter(tag => icons(tag) > 0).length >= 5); break;
      case '215': case '218': points = Number(context.supportedProjects >= 5); break;
      case '225': case '226': points = Number(ARK_CONTINENTS.every(tag => icons(tag) > 0)); break;
      case '241': points = Number(connectedTerrain('WATER')); break;
      case '242': points = Number(connectedTerrain('ROCK')); break;
      case '243': points = Number(icons('Herbivore') >= 6); break;
      case '244': points = Number(icons('Bird') >= 6); break;
      case '245': points = Number(icons('Water') >= 6); break;
      case '246':
        if (definitions.some(c => c.rock === null)) throw new Error('Unverified rock icon count.');
        points = Number(icons('Rock') >= 6); break;
      case '247': points = Number(icons('Primate') >= 6); break;
      case '251': points = icons('Bear') >= 6 ? 2 : Number(icons('Bear') >= 3); break;
      case '257': appeal = full ? 5 : 0; break;
      case '258': points = Math.floor(isolatedTerrain('WATER') / 2); break;
      case '259': points = Math.floor(isolatedTerrain('ROCK') / 2); break;
      case '260': points = emptyGroupScore(covered); break;
      case '264': points = Math.floor(ARK_MAP_A.filter(c => c.bonus !== null && empty(c) && !adjacent(c)).length / 2); break;
      default: continue;
    }
    details.push({cardId: card.cardId, conservation: points, appeal}); sponsorPoints += points; sponsorAppeal += appeal;
  }
  const appeal = Math.min(113, context.appeal + sponsorAppeal);
  const conservation = Math.min(41, context.conservation + goalPoints + sponsorPoints);
  const total = arkVictoryPoints(appeal, conservation);
  return {appeal, conservation, goalPoints, sponsorPoints, sponsorAppeal, total, won: total >= 0, details};
}
