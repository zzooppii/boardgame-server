import type { SpiritElement, SpiritId, SpiritTerrain } from './actions.js';
export type SpiritPower = Readonly<{
    key: string;
    name: string;
    title: string;
    description: string;
    cost: number;
    speed: 'FAST' | 'SLOW';
    range: number;
    sacred: boolean;
    sourceTerrain: SpiritTerrain | null;
    target: 'ANY' | 'SPIRIT' | 'OTHER_SPIRIT' | 'DAHAN' | 'INVADERS' | 'NO_BLIGHT' | 'BLIGHT' | 'NO_INVADERS' | 'COASTAL';
    terrains: readonly SpiritTerrain[];
    elements: readonly SpiritElement[];
    deck: SpiritId | 'MINOR' | 'MAJOR';
}>;
export type SpiritDefinition = Readonly<{
    id: SpiritId;
    name: string;
    subtitle: string;
    energy: readonly number[];
    plays: readonly number[];
    growth: readonly Readonly<{
        reclaim: boolean;
        gain: boolean;
        energy: number;
        presence: readonly number[];
    }>[];
    special: string;
    innate: string;
    innateText: readonly string[];
    progression: readonly string[];
}>;
export const SPIRIT_ELEMENTS: readonly SpiritElement[] = ['SUN', 'MOON', 'FIRE', 'AIR', 'WATER', 'EARTH', 'PLANT', 'ANIMAL'];
export const SPIRIT_ELEMENT_LABELS: Record<SpiritElement, string> = { SUN: '태양', MOON: '달', FIRE: '불', AIR: '바람', WATER: '물', EARTH: '땅', PLANT: '식물', ANIMAL: '동물' };
export const SPIRIT_TERRAIN_LABELS: Record<SpiritTerrain, string> = { MOUNTAIN: '산', JUNGLE: '밀림', SANDS: '모래', WETLAND: '습지' };
export const SPIRITS: readonly SpiritDefinition[] = [
    { id: 'RIVER', name: '햇살 아래 굽이치는 강', subtitle: '흐름을 바꾸고, 생명을 키우세요', energy: [1, 2, 2, 3, 4, 4, 5], plays: [1, 2, 2, 3, 3, 4, 5], growth: [{ reclaim: true, gain: true, energy: 1, presence: [] }, { reclaim: false, gain: false, energy: 0, presence: [1, 1] }, { reclaim: false, gain: true, energy: 0, presence: [2] }], special: '습지에 있는 내 현신은 1개만 있어도 성소입니다. 카드 트랙의 회수 칸을 열면 준비 단계마다 카드 1장을 회수할 수 있습니다.', innate: '거대한 범람', innateText: ['태양 1 · 물 2: 탐험가/마을 1개 밀기', '태양 2 · 물 3: 대신 피해 2, 탐험가/마을 최대 3개 밀기', '태양 3 · 물 4 · 땅 1: 대신 각 침략자에게 피해 2'], progression: ['uncanny-melting', 'nature-s-resilience', 'pull-beneath-the-hungry-earth', 'accelerated-rot', 'song-of-sanctity', 'tsunami', 'encompassing-ward'] },
    { id: 'LIGHTNING', name: '번개의 신속한 일격', subtitle: '폭풍처럼 빠르게 침략자를 몰아내세요', energy: [1, 1, 2, 2, 3, 4, 4, 5], plays: [2, 3, 4, 5, 6], growth: [{ reclaim: true, gain: true, energy: 1, presence: [] }, { reclaim: false, gain: false, energy: 0, presence: [2, 0] }, { reclaim: false, gain: false, energy: 3, presence: [1] }], special: '바람 원소 1개당 느린 능력 1개를 빠른 능력으로 사용할 수 있습니다. 고유 능력에도 적용됩니다.', innate: '천둥의 파괴', innateText: ['불 3 · 바람 2: 마을 1개 파괴', '불 4 · 바람 3: 대신 도시 1개 파괴 가능', '불 5 · 바람 4 · 물 1: 마을/도시 1개 추가 파괴', '불 5 · 바람 5 · 물 2: 마을/도시 1개 더 파괴'], progression: ['delusions-of-danger', 'call-to-bloodshed', 'powerstorm', 'purifying-flame', 'pillar-of-living-flame', 'entrancing-apparitions', 'call-to-isolation'] },
    { id: 'EARTH', name: '대지의 생명력', subtitle: '섬을 지키는 든든한 바위가 되세요', energy: [2, 3, 4, 6, 7, 8], plays: [1, 1, 2, 2, 3, 4], growth: [{ reclaim: true, gain: false, energy: 0, presence: [2] }, { reclaim: false, gain: true, energy: 0, presence: [0] }, { reclaim: false, gain: false, energy: 2, presence: [1] }], special: '내 성소가 있는 모든 지역에 방어 3을 제공합니다.', innate: '힘의 선물', innateText: ['태양 1 · 땅 2 · 식물 2: 대상 정령이 비용 1 이하 카드 1회 무료 반복', '태양 2 · 땅 3 · 식물 2: 비용 상한 3', '태양 2 · 땅 4 · 식물 3: 비용 상한 6'], progression: ['rouse-the-trees-and-stones', 'call-to-migrate', 'poisoned-land', 'devouring-ants', 'vigor-of-the-breaking-dawn', 'voracious-growth', 'savage-mawbeasts'] },
    { id: 'SHADOW', name: '불꽃처럼 흔들리는 그림자', subtitle: '공포와 다한의 힘으로 섬을 지키세요', energy: [0, 1, 3, 4, 5, 6], plays: [1, 2, 3, 3, 4, 5], growth: [{ reclaim: true, gain: true, energy: 0, presence: [] }, { reclaim: false, gain: true, energy: 0, presence: [1] }, { reclaim: false, gain: false, energy: 3, presence: [3] }], special: '능력 사용 시 에너지 1을 지불하면 다한이 있는 지역을 사거리와 관계없이 대상으로 삼을 수 있습니다. 다른 대상 조건은 유지됩니다.', innate: '방심한 자를 삼키는 어둠', innateText: ['달 2 · 불 1: 탐험가 1개 모으기', '달 3 · 불 2: 탐험가 최대 2개 파괴, 각각 공포 1', '달 4 · 불 3 · 바람 2: 피해 3, 이 피해로 파괴한 침략자마다 공포 1'], progression: ['dark-and-tangled-woods', 'shadows-of-the-burning-forest', 'the-jungle-hungers', 'land-of-haunts-and-embers', 'terrifying-nightmares', 'call-of-the-dahan-ways', 'visions-of-fiery-doom'] },
];
export const spiritDefinition = (id: SpiritId): SpiritDefinition => { const value = SPIRITS.find(s => s.id === id); if (!value)
    throw new Error('Unknown spirit'); return value; };
