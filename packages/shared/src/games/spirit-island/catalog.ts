import type { SpiritElement, SpiritId, SpiritTerrain } from './actions.js';
export type SpiritPower = Readonly<{
    expansion?: 'BRANCH_CLAW';
    key: string;
    name: string;
    title: string;
    description: string;
    cost: number;
    speed: 'FAST' | 'SLOW';
    range: number;
    sacred: boolean;
    sourceTerrain: SpiritTerrain | null;
    target: 'ANY' | 'SPIRIT' | 'OTHER_SPIRIT' | 'DAHAN' | 'INVADERS' | 'NO_BLIGHT' | 'BLIGHT' | 'NO_INVADERS' | 'COASTAL' | 'BEASTS' | 'CITY' | 'INLAND' | 'COAST_OR_WETLAND';
    terrains: readonly SpiritTerrain[];
    elements: readonly SpiritElement[];
    deck: SpiritId | 'MINOR' | 'MAJOR';
}>;
export type SpiritDefinition = Readonly<{
    id: SpiritId;
    expansion?: 'BRANCH_CLAW';
    growthCount?: number;
    reclaimSlots?: readonly number[];
    name: string;
    subtitle: string;
    trackElements?: readonly { track: 'energyTrack' | 'cardTrack'; at: number; element: SpiritElement | 'ANY' }[];
    energy: readonly number[];
    plays: readonly number[];
    growth: readonly Readonly<{
        cost?: number;
        restriction?: string;
        extraGain?: boolean;
        reclaimOne?: boolean;
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
    {"id": "GREEN", "name": "무성하게 퍼지는 녹음", "subtitle": "끝없는 생명력으로 동료를 성장시키세요", "energy": [0, 1, 1, 2, 2, 2, 3], "plays": [1, 1, 2, 2, 3, 4], "trackElements": [{"track": "energyTrack", "at": 2, "element": "PLANT"}, {"track": "energyTrack", "at": 5, "element": "PLANT"}], "growth": [{"reclaim": true, "gain": true, "energy": 0, "presence": []}, {"reclaim": false, "gain": false, "energy": 0, "presence": [1]}, {"reclaim": false, "gain": true, "energy": 3, "presence": []}], "special": "성장마다 사거리 2의 밀림/습지에 현신을 추가합니다. 성소의 현신 1개를 파괴해 그 지역의 파괴 또는 건설을 막을 수 있습니다. 성장으로 파괴된 현신을 재생할 수 있습니다.", "innate": "벽을 찢는 덩굴", "innateText": ["달 1 · 식물 2: 사거리 0, 건물에 피해 1", "달 2 · 식물 3 / 달 3 · 식물 4: 고유 능력 반복", "온 섬을 덮는 녹음: 물 1 · 식물 3 방어 2 / 물 2 · 식물 4 방어 4 / 물 3 · 땅 1 · 식물 5 오염 1 제거"], "progression": []},
    {"id": "THUNDER", "name": "천둥의 목소리", "subtitle": "다한과 함께 움직이며 반격을 이끄세요", "energy": [1, 1, 2, 2, 2, 3], "plays": [1, 2, 2, 3, 3, 3, 4], "trackElements": [{"track": "energyTrack", "at": 1, "element": "AIR"}, {"track": "energyTrack", "at": 3, "element": "FIRE"}, {"track": "energyTrack", "at": 4, "element": "SUN"}], "growth": [{"reclaim": true, "gain": true, "extraGain": true, "energy": 0, "presence": []}, {"reclaim": false, "gain": false, "energy": 0, "presence": [2, 1]}, {"reclaim": false, "gain": false, "energy": 4, "presence": [1]}], "special": "다한이 이동할 때 같은 지역의 내 현신 1개를 함께 이동할 수 있습니다. 침략자의 파괴로 다한이 죽으면 그 지역에서 사거리 1 이내의 내 현신을 같은 수만큼 파괴합니다.", "innate": "전사들을 모으다", "innateText": ["동물 1: 바람 수만큼 다한 모으기, 태양 수만큼 다한 밀기", "바람 4: 두 고유 능력을 빠르게 사용 가능", "분노의 공격: 태양 2 · 불 1 다한 2개당 마을 1개 파괴 / 태양 4 · 불 3 다한 3개당 도시 1개도 파괴"], "progression": []},
    {"id": "OCEAN", "name": "굶주린 바다의 손아귀", "subtitle": "밀물과 썰물로 침략자를 삼키세요", "energy": [0, 0, 0, 1, 1, 1, 2], "plays": [1, 2, 2, 3, 4, 5], "trackElements": [{"track": "energyTrack", "at": 1, "element": "MOON"}, {"track": "energyTrack", "at": 2, "element": "WATER"}, {"track": "energyTrack", "at": 4, "element": "EARTH"}, {"track": "energyTrack", "at": 5, "element": "WATER"}], "growth": [{"reclaim": true, "gain": true, "energy": 2, "presence": []}, {"reclaim": false, "gain": false, "energy": 1, "presence": [100, 100]}, {"reclaim": false, "gain": true, "energy": 0, "presence": [1]}], "special": "현신은 바다와 해안에만 놓을 수 있습니다. 내 현신이 있는 보드의 바다는 능력과 오염에 대해 해안 습지입니다. 그 바다로 이동한 기물은 익사하며 침략자의 기본 체력을 인원수만큼 모을 때마다 에너지 1을 얻습니다.", "innate": "배를 산산이 부수다", "innateText": ["달 1 · 바람 1 · 물 2: 공포 1", "달 2 · 바람 1 · 물 3: 공포 +1 / 달 3 · 바람 2 · 물 4: 공포 +2", "해안을 집어삼키다: 물 2 · 땅 1 마을 익사 / 물 3 · 땅 2 도시 가능 / 물 4 · 땅 3 건물 1개 추가"], "progression": []},
    {"id": "BRINGER", "name": "꿈과 악몽을 가져오는 자", "subtitle": "파괴 대신 악몽으로 침략자를 몰아내세요", "energy": [2, 2, 3, 3, 4, 4, 5], "plays": [2, 2, 2, 3, 3, 3], "trackElements": [{"track": "energyTrack", "at": 1, "element": "AIR"}, {"track": "energyTrack", "at": 3, "element": "MOON"}, {"track": "energyTrack", "at": 5, "element": "ANY"}, {"track": "cardTrack", "at": 5, "element": "ANY"}], "growth": [{"reclaim": true, "gain": true, "energy": 0, "presence": []}, {"reclaim": false, "reclaimOne": true, "gain": false, "energy": 0, "presence": [0]}, {"reclaim": false, "gain": true, "energy": 0, "presence": [1]}, {"reclaim": false, "gain": false, "energy": 2, "presence": [4]}], "special": "내 능력은 피해를 주거나 내 현신 이외의 기물을 파괴하지 않습니다. 파괴할 탐험가/마을/도시 대신 공포 0/2/5를 얻고 탐험가와 마을을 밉니다. 같은 능력으로 같은 기물에서 두 번 공포를 얻지 않습니다.", "innate": "정령도 꿈을 꾼다", "innateText": ["달 2 · 바람 2: 뒷면 공포 카드 1장 공개", "달 3: 대상 정령이 가진 원소 1개 추가", "밤의 공포: 달 1 · 바람 1 공포 1 / 달 2 · 바람 1 · 동물 1 공포 +1 / 달 3 · 바람 2 · 동물 1 공포 +1"], "progression": []},
    {"id": "FANGS", "expansion": "BRANCH_CLAW", "growthCount": 2, "reclaimSlots": [3, 5], "name": "잎사귀 뒤의 날카로운 송곳니", "subtitle": "야수와 함께 이동하며 사냥하세요", "energy": [1, 1, 1, 2, 2, 3, 4], "plays": [2, 2, 3, 3, 4, 5], "trackElements": [{"track": "energyTrack", "at": 1, "element": "ANIMAL"}, {"track": "energyTrack", "at": 2, "element": "PLANT"}, {"track": "energyTrack", "at": 4, "element": "ANIMAL"}], "growth": [{"reclaim": true, "gain": true, "energy": 0, "presence": [], "cost": 1}, {"reclaim": false, "gain": false, "energy": 0, "presence": [100], "restriction": "FANGS"}, {"reclaim": false, "gain": true, "energy": 1, "presence": []}, {"reclaim": false, "gain": false, "energy": 3, "presence": []}], "special": "야수가 내 지역에서 이동할 때 현신 1개가 동행할 수 있습니다. 정령 단계마다 현신 1개를 영구 제거하여 야수 1개로 바꿀 수 있습니다.", "innate": "넓게 누비는 사냥", "innateText": ["빠름 · 사거리 1 · 오염 없는 지역", "동물 2: 야수 1개 모으기와 최대 2개 밀기. 식물 2·동물 3이면 그 사이에 야수마다 피해 1.", "광란의 습격: 느림 · 사거리 1 · 야수 지역. 달 1·불 1·동물 4: 공포 1, 피해 2, 야수 1개 제거. 불 2·동물 5면 공포 +1, 피해 +1."], "progression": []},
    {"id": "KEEPER", "expansion": "BRANCH_CLAW", "growthCount": 2, "reclaimSlots": [5], "name": "금지된 야생의 수호자", "subtitle": "야생을 넓히고 침입자에게 분노를 내리세요", "energy": [2, 2, 4, 5, 5, 7, 8, 9], "plays": [1, 2, 2, 3, 4, 5], "trackElements": [{"track": "energyTrack", "at": 1, "element": "SUN"}, {"track": "energyTrack", "at": 4, "element": "PLANT"}], "growth": [{"reclaim": true, "gain": false, "energy": 1, "presence": []}, {"reclaim": false, "gain": true, "energy": 0, "presence": []}, {"reclaim": false, "gain": false, "energy": 1, "presence": [3], "restriction": "KEEPER_WILDS"}, {"reclaim": false, "gain": true, "energy": 0, "presence": [3], "cost": 3, "restriction": "NO_BLIGHT"}], "special": "현신을 추가하거나 이동하여 새 성소를 만들면 그 지역의 모든 다한을 밀어냅니다. 성장마다 서로 다른 두 선택을 합니다.", "innate": "침입자에게 내리는 벌", "innateText": ["느림 · 사거리 0", "태양 2·불 1·식물 2: 피해 2와 다한 1개 파괴. 불 2·식물 3: 태양 수와 식물 수 중 적은 만큼 추가 피해. 식물 4: 다른 내 현신 지역 한 곳과 피해를 나눌 수 있습니다.", "퍼지는 야생: 느림 · 사거리 1 · 오염 없는 지역. 태양 2개마다 탐험가 1개 밀기. 식물 1: 탐험가가 없으면 야생 1개. 식물 3, 바람 1은 각각 사거리 +1."], "progression": []},
];
export const spiritDefinition = (id: SpiritId): SpiritDefinition => { const value = SPIRITS.find(s => s.id === id); if (!value)
    throw new Error('Unknown spirit'); return value; };
