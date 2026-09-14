import { ARK_BUILDINGS, ARK_MAP_A, arkCellKey, arkInitialBuildings, arkPlacementReason, arkShape, type ArkBuilding, type ArkCardDefinition, type ArkCell } from '@hangul-rummikub/shared';

export type ArkPreviewState = Readonly<{money: number; buildings: ArkBuilding[]; history: readonly Readonly<{id: string; cost: number}>[]; sequence: number}>;
export type ArkDraft = Readonly<{kind: string; anchor: ArkCell | null; rotation: number; reflected: boolean; upgraded: boolean}>;
export const initialArkPreview = (): ArkPreviewState => ({money: 40, buildings: arkInitialBuildings(), history: [], sequence: 0});
export function previewPlacementReason(state: ArkPreviewState, draft: ArkDraft): string | null {
  const building = Object.hasOwn(ARK_BUILDINGS, draft.kind) ? ARK_BUILDINGS[draft.kind] : undefined;
  if (!building || !draft.anchor) return '지도에서 건물의 기준 칸을 선택하세요.';
  if (!draft.upgraded && ['ReptileHouse', 'LargeBirdAviary'].includes(draft.kind)) return '건설 II 체험을 켜면 배치할 수 있습니다.';
  if (state.money < building.shape.length * 2) return '체험 예산이 부족합니다. 마지막 배치를 되돌리거나 처음부터 시작하세요.';
  return arkPlacementReason(state.buildings, draft.kind, arkShape(draft.kind, draft.anchor, draft.rotation, draft.reflected), draft.upgraded);
}
/** Deliberately a construction sandbox, not a client-side multiplayer game authority. */
export function placeArkPreview(state: ArkPreviewState, draft: ArkDraft): ArkPreviewState {
  if (previewPlacementReason(state, draft) || !draft.anchor) return state;
  const cost = ARK_BUILDINGS[draft.kind]!.shape.length * 2, id = `preview-${state.sequence + 1}`;
  return {...state, sequence: state.sequence + 1, money: state.money - cost,
    buildings: [...state.buildings, {id, kind: draft.kind, cells: arkShape(draft.kind, draft.anchor, draft.rotation, draft.reflected), occupied: false, used: 0}],
    history: [...state.history, {id, cost}]};
}
export function undoArkPreview(state: ArkPreviewState): ArkPreviewState {
  const last = state.history.at(-1);
  return last ? {...state, money: state.money + last.cost, buildings: state.buildings.filter(b => b.id !== last.id), history: state.history.slice(0, -1)} : state;
}
export const arkPreviewCovered = (state: ArkPreviewState): number => new Set(state.buildings.flatMap(b => b.cells.map(arkCellKey))).size;
export const arkLandCount = ARK_MAP_A.filter(c => c.terrain === 'LAND').length;
export const arkScreenPoint = (c: ArkCell): Readonly<{x: number; y: number}> => ({x: 44 + c.q * 45, y: 46 + (c.r + c.q / 2) * Math.sqrt(3) * 30});
export const arkHexPoints = (c: ArkCell, radius = 28.5): string => {
  const center = arkScreenPoint(c);
  return Array.from({length: 6}, (_, i) => `${center.x + radius * Math.cos(i * Math.PI / 3)},${center.y + radius * Math.sin(i * Math.PI / 3)}`).join(' ');
};
export function searchArkCards(cards: readonly ArkCardDefinition[], query: string, kind: string): readonly ArkCardDefinition[] {
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase();
  return cards.filter(c => (kind === 'ALL' || c.kind === kind) && (!needle || `${c.name} ${c.english} ${c.key}`.normalize('NFKC').toLocaleLowerCase().includes(needle)));
}
