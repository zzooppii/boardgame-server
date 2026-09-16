export type MarsTileKind = 'city' | 'greenery' | 'ocean' | 'special';
export type MarsPlacementRule = 'normal' | 'oceanLand' | 'greeneryOcean' | 'oceanSpecial' | 'isolated' | 'nextGreenery' | 'twoCities' | 'volcano' | 'mining' | 'noctis' | 'phobos' | 'ganymede';
export type MarsSpace = {
    id: string;
    q: number;
    r: number;
    ocean: boolean;
    reserved: boolean;
    bonus: readonly ('plants' | 'steel' | 'titanium' | 'card')[];
    name: string;
};
// Physical Tharsis board facts, in reading order; rendering uses independent axial geometry.
const rows = [['ss', 'Oss', '', 'Oc', 'O'], ['', 's', '', '', '', 'Occ'], ['c', '', '', '', '', '', 's'], ['pt', 'p', 'p', 'p', 'pp', 'p', 'p', 'Opp'], ['pp', 'pp', 'pp', 'Opp', 'Opp', 'Opp', 'pp', 'pp', 'pp'], ['p', 'pp', 'p', 'p', 'p', 'Op', 'Op', 'Op'], ['', '', '', '', '', 'p', ''], ['ss', '', 'c', 'c', '', 't'], ['s', 'ss', '', '', 'Ott']];
export const MARS_BOARD: readonly MarsSpace[] = Object.freeze(rows.flatMap((row, y) => row.map((text, x) => ({ id: `${y + 1}-${x + 1}`, q: x - Math.min(y, 4), r: y - 4, ocean: text.startsWith('O'), reserved: y === 4 && x === 2, bonus: [...text.replace('O', '')].map(c => c === 'p' ? 'plants' as const : c === 's' ? 'steel' as const : c === 't' ? 'titanium' as const : 'card' as const), name: y === 4 && x === 2 ? '녹티스 시티' : y === 1 && x === 1 ? '타르시스 톨루스' : y === 2 && x === 0 ? '아스크레우스 산' : y === 3 && x === 0 ? '파보니스 산' : y === 4 && x === 0 ? '아르시아 산' : `${y + 1}행 ${x + 1}열` }))));
export function marsAdjacent(a: string, b: string): boolean { const x = MARS_BOARD.find(s => s.id === a), y = MARS_BOARD.find(s => s.id === b); if (!x || !y)
    return false; const dq = x.q - y.q, dr = x.r - y.r; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1; }
export const MARS_MILESTONES = [{ id: 'terraformer', name: '테라포머', detail: 'TR 35 이상' }, { id: 'mayor', name: '시장', detail: '내 도시 3개 이상' }, { id: 'gardener', name: '원예가', detail: '내 녹지 3개 이상' }, { id: 'builder', name: '건축가', detail: '건물 태그 8개 이상' }, { id: 'planner', name: '전략가', detail: '손패 16장 이상' }] as const;
export const MARS_AWARDS = [{ id: 'landlord', name: '개척기업', detail: '전체 소유 타일 수 · 화성 밖 도시 포함' }, { id: 'banker', name: '금융기업', detail: 'M€ 생산량' }, { id: 'scientist', name: '과학기업', detail: '과학 태그 수' }, { id: 'thermalist', name: '열기업', detail: '열 보유량' }, { id: 'miner', name: '광업기업', detail: '강철 + 티타늄 보유량' }] as const;
