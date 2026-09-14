import { ARK_CARDS, ARK_GOALS, ARK_MAP_A, arkBorder, arkCellKey, arkNeighbours, type ArkBuilding, type ArkCard } from '@hangul-rummikub/shared';

export type ArkGoalContext = Readonly<{
  played: readonly ArkCard[];
  buildings: readonly ArkBuilding[];
  universityResearch: number;
  supportedProjects: number;
  reputation: number;
}>;

/** Original base-card thresholds. Card 009 is replaced on draw in solo. */
export function scoreArkSoloGoal(key: string, context: ArkGoalContext): number {
  const goal = ARK_GOALS.find(g => g.key === key);
  if (!goal || key === '009') throw new Error('Invalid solo final scoring card.');
  const definitions = context.played.map(c => {
    const definition = ARK_CARDS.find(d => d.key === c.key);
    if (!definition) throw new Error('Unknown played zoo card.');
    return definition;
  });
  const animals = definitions.filter(c => c.kind === 'ANIMAL');
  const covered = new Set(context.buildings.flatMap(b => b.cells.map(arkCellKey)));
  const connected = (cell: {q: number; r: number}) => !covered.has(arkCellKey(cell)) && arkNeighbours(cell).some(n => covered.has(arkCellKey(n)));
  if (key === '004') {
    return Number(ARK_MAP_A.filter(c => c.terrain === 'WATER' && !covered.has(arkCellKey(c))).every(connected)) +
      Number(ARK_MAP_A.filter(c => c.terrain === 'ROCK' && !covered.has(arkCellKey(c))).every(connected)) +
      Number(ARK_MAP_A.filter(c => c.terrain === 'LAND' && arkBorder(c)).every(c => covered.has(arkCellKey(c)))) +
      Number(ARK_MAP_A.filter(c => c.terrain === 'LAND').every(c => covered.has(arkCellKey(c))));
  }
  let value: number;
  switch (key) {
    case '001': value = animals.filter(c => c.size >= 4).length; break;
    case '002': value = animals.filter(c => c.size <= 2).length; break;
    case '003': value = context.universityResearch + definitions.reduce((sum, c) => sum + c.tags.filter(t => t === 'Science').length, 0); break;
    case '005': value = context.supportedProjects; break;
    case '006': value = ARK_MAP_A.filter(c => c.terrain === 'LAND' && !covered.has(arkCellKey(c))).length; break;
    case '007': value = context.reputation; break;
    case '008': value = definitions.filter(c => c.kind === 'SPONSOR').length; break;
    case '010':
      if (definitions.some(c => c.rock === null)) throw new Error('Unverified rock icon count.');
      value = definitions.reduce((sum, c) => sum + (c.rock ?? 0), 0); break;
    case '011': value = definitions.reduce((sum, c) => sum + c.water, 0); break;
    default: throw new Error('Unknown solo final scoring card.');
  }
  return goal.thresholds.filter(threshold => typeof threshold === 'number' && value >= threshold).length;
}
