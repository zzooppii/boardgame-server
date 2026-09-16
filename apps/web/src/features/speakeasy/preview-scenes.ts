import type {SpeakeasyBuildingKind} from '@hangul-rummikub/shared';
import type {SpeakeasyCue} from './sound.js';

export type SpeakeasyPreviewBuilding = Readonly<{district: number; slot: number; kind: SpeakeasyBuildingKind; owner: 0 | 1 | 2; protected: boolean; barrel: boolean}>;
export type SpeakeasyPreviewScene = Readonly<{id: string; label: string; location: string; title: string; instruction: string;
  target: number; cue: SpeakeasyCue; before: string; after: string; button: string; rule: string; changed: SpeakeasyPreviewBuilding}>;
export const SPEAKEASY_PREVIEW_BUILDINGS: readonly SpeakeasyPreviewBuilding[] = [
  {district: 2, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: false, barrel: false},
  {district: 4, slot: 0, kind: 'SPEAKEASY', owner: 1, protected: true, barrel: true},
  {district: 7, slot: 0, kind: 'STILLS', owner: 0, protected: false, barrel: false},
  {district: 9, slot: 1, kind: 'NIGHTCLUB', owner: 2, protected: true, barrel: false},
  {district: 12, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: false, barrel: true},
  {district: 15, slot: 1, kind: 'CASINO', owner: 1, protected: false, barrel: false},
];
export const SPEAKEASY_PREVIEW_SCENES: readonly SpeakeasyPreviewScene[] = [
  {id: 'build', label: '건설', location: '건축 사무소', title: '골목에 첫 불을 켜세요.', instruction: '3구역의 빈 건물 칸을 선택하세요.', target: 3, cue: 'BUILD',
    before: '빈 건물 칸', after: '내 주점이 들어섰습니다', button: '건설 연출 보기', rule: '건물과 비용을 검토한 뒤 확정합니다. 개인판 칸의 보너스는 별도 안내합니다.',
    changed: {district: 3, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: false, barrel: false}},
  {id: 'deliver', label: '운송', location: '차고', title: '주류를 손님 곁으로.', instruction: '2구역의 내 주점을 선택하세요.', target: 2, cue: 'DELIVER',
    before: '배달 대기', after: '주점 옆에 주류 1개', button: '배달 연출 보기', rule: '트럭은 최대 2개를 싣고, 영업 중인 자기 건물에 1개를 배달합니다. 이 예시는 도착 장면입니다.',
    changed: {district: 2, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: false, barrel: true}},
  {id: 'protect', label: '보호', location: '시청', title: '문 앞을 지키는 한 사람.', instruction: '경찰이 있는 12구역을 선택하세요.', target: 12, cue: 'PROTECT',
    before: '경찰 · 영업 중단', after: '조직원 보호 · 영업 재개', button: '보호 연출 보기', rule: '경찰이 와도 주류는 남습니다. 조직원이 보호하면 영업할 수 있지만 마피아 방어력이 증가하지는 않습니다.',
    changed: {district: 12, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: true, barrel: true}},
  {id: 'upgrade', label: '증축', location: '도시계획 사무소', title: '골목의 주점에서, 밤의 무대로.', instruction: '2구역의 내 주점을 선택하세요.', target: 2, cue: 'BUILD',
    before: '주점', after: '나이트클럽', button: '증축 연출 보기', rule: '같은 구역권에 내 나이트클럽은 최대 1개입니다. 기존 건물의 보호와 주류는 유지합니다.',
    changed: {district: 2, slot: 0, kind: 'NIGHTCLUB', owner: 0, protected: false, barrel: false}},
  {id: 'sell', label: '판매', location: '파티 운영', title: '오늘 밤의 수익을 거두세요.', instruction: '2구역의 주류가 있는 주점을 선택하세요.', target: 2, cue: 'SELL',
    before: '주류 1개', after: '주류 판매 · 현금 수입', button: '판매 연출 보기', rule: '판매 한도는 파티 수준, 단가는 악명과 건물 종류에 따라 달라집니다. 수입은 현금으로 받습니다.',
    changed: {district: 2, slot: 0, kind: 'SPEAKEASY', owner: 0, protected: false, barrel: false}},
];
export function speakeasyPreviewBuildings(scene: SpeakeasyPreviewScene, applied: boolean): readonly SpeakeasyPreviewBuilding[] {
  const initial = SPEAKEASY_PREVIEW_BUILDINGS.map(b => scene.id === 'sell' && b.district === 2 && b.slot === 0 ? {...b, barrel: true} : b);
  return applied ? [...initial.filter(b => b.district !== scene.changed.district || b.slot !== scene.changed.slot), scene.changed] : initial;
}
export function speakeasyPreviewOperating(b: SpeakeasyPreviewBuilding): boolean {return b.district !== 12 || b.protected;}

/** Visual grid navigation only; this never represents legal truck adjacency. */
export function speakeasyDistrictFocus(district: number, key: string): number | null {
  if (!Number.isInteger(district) || district < 1 || district > 16) return null;
  const zone = district <= 6 ? 0 : district <= 12 ? 1 : 2;
  const index = district - zone * 6 - 1;
  let x = zone * 2 + index % 2, y = Math.floor(index / 2);
  if (key === 'ArrowLeft') x--;
  else if (key === 'ArrowRight') x++;
  else if (key === 'ArrowUp') y--;
  else if (key === 'ArrowDown') y++;
  else return null;
  if (x < 0 || x > 5 || y < 0 || y > 2 || (x >= 4 && y === 2)) return null;
  return Math.floor(x / 2) * 6 + y * 2 + x % 2 + 1;
}
