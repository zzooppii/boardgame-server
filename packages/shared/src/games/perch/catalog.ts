import * as v from 'valibot';
export const PERCH_CREATURES = ['BEE', 'CAT', 'CUCKOO', 'DOG', 'FOX', 'HAWK', 'OWL', 'SCARECROW', 'SQUIRREL'] as const;
export const PerchCreatureSchema = v.picklist(PERCH_CREATURES);
export type PerchCreature = v.InferOutput<typeof PerchCreatureSchema>;
export const PERCH_LOCATIONS = ['BIRCH', 'ASH', 'ELM', 'OAK', 'PINE', 'MAPLE', 'FEEDER', 'BENCH', 'BEEHIVE', 'THORN', 'CORN', 'DEN', 'HAWK_NEST', 'BARN', 'COTTAGE', 'DOGHOUSE', 'STATUE', 'WIRES', 'EARLY', 'BIRDBATH', 'OVERSTUFFED', 'HANGING', 'ROOKERY', 'HIGH'] as const;
export const PerchLocationSchema = v.picklist(PERCH_LOCATIONS);
export type PerchLocation = v.InferOutput<typeof PerchLocationSchema>;
type LocationInfo = Readonly<{
    name: string;
    english: string;
    scores: readonly [
        number,
        number,
        number
    ];
    nests: number;
    kind: 'BASIC' | 'CREATURE' | 'SPECIAL';
    description: string;
    creature?: PerchCreature;
}>;
export const PERCH_LOCATION_INFO: Record<PerchLocation, LocationInfo> = {
    BIRCH: { name: '하얀 자작나무', english: 'The Peeling Birch Trees', scores: [5, 3, 3], nests: 1, kind: 'BASIC', description: '장소의 새 무리 순위에 따라 점수를 받습니다.' },
    ASH: { name: '커다란 물푸레나무', english: 'The Great Ash Tree', scores: [5, 3, 2], nests: 1, kind: 'BASIC', description: '장소의 새 무리 순위에 따라 점수를 받습니다.' },
    ELM: { name: '외로운 느릅나무', english: 'The Lonely Elm Tree', scores: [5, 0, 2], nests: 1, kind: 'BASIC', description: '2위는 0점, 3위는 2점입니다.' },
    OAK: { name: '우람한 참나무', english: 'The Mighty Oak Tree', scores: [6, 4, 3], nests: 1, kind: 'BASIC', description: '둥지를 활용해 높은 점수에 도전하세요.' },
    PINE: { name: '향기로운 소나무', english: 'The Scented Pine Trees', scores: [3, 5, 2], nests: 1, kind: 'BASIC', description: '2위가 가장 높은 5점을 받습니다.' },
    MAPLE: { name: '붉은 단풍나무', english: 'The Japanese Maple Tree', scores: [4, 7, 3], nests: 1, kind: 'BASIC', description: '2위가 가장 높은 7점을 받습니다.' },
    FEEDER: { name: '가득 찬 모이통', english: 'Full Bird Feeder', scores: [3, 1, 1], nests: 0, kind: 'SPECIAL', description: '모집 후: 지배자는 자신이 모집한 새 1마리와 다른 플레이어가 모집한 새 1마리를 교환합니다.' },
    BENCH: { name: '공원 벤치', english: 'The Park Bench', scores: [0, 1, 3], nests: 0, kind: 'CREATURE', creature: 'SQUIRREL', description: '정비: 지배자가 다음 라운드의 다람쥐를 조종합니다.' },
    BEEHIVE: { name: '벌집', english: 'A Beehive', scores: [2, 4, 2], nests: 0, kind: 'CREATURE', creature: 'BEE', description: '정비: 지배자가 다음 라운드의 벌을 조종합니다.' },
    THORN: { name: '가시덤불', english: 'The Thorn Bush', scores: [1, 2, 3], nests: 0, kind: 'CREATURE', creature: 'CUCKOO', description: '정비: 지배자가 다음 라운드의 뻐꾸기를 조종합니다.' },
    CORN: { name: '옥수수밭', english: 'A Cornfield', scores: [0, 2, 2], nests: 0, kind: 'CREATURE', creature: 'SCARECROW', description: '정비: 지배자가 허수아비를 조종합니다. 조종자가 바뀌면 새로운 세 장소의 교차점에 놓습니다.' },
    DEN: { name: '여우 굴', english: "The Fox’s Den", scores: [0, 0, 1], nests: 0, kind: 'CREATURE', creature: 'FOX', description: '정비: 지배자가 다음 라운드의 여우를 조종합니다.' },
    HAWK_NEST: { name: '매의 둥지', english: "The Hawk’s Nest", scores: [1, 1, 2], nests: 0, kind: 'CREATURE', creature: 'HAWK', description: '정비: 지배자가 다음 라운드의 매를 조종합니다.' },
    BARN: { name: '올빼미 헛간', english: 'The Owl Barn', scores: [3, 2, 1], nests: 0, kind: 'CREATURE', creature: 'OWL', description: '가장자리에 배치합니다. 정비: 지배자가 다음 라운드의 올빼미를 조종합니다.' },
    COTTAGE: { name: '시골집', english: 'A Country House', scores: [0, 1, 1], nests: 0, kind: 'CREATURE', creature: 'CAT', description: '정비: 지배자가 다음 라운드의 고양이를 조종합니다.' },
    DOGHOUSE: { name: '강아지 집', english: 'The Doghouse', scores: [1, 3, 1], nests: 0, kind: 'CREATURE', creature: 'DOG', description: '정비: 지배자가 다음 라운드의 강아지를 조종합니다.' },
    STATUE: { name: '돌 조각상', english: 'A Stone Statue', scores: [1, 2, 1], nests: 2, kind: 'SPECIAL', description: '정산: 지배자는 1점에 더해 이 장소의 전체 새 수 2마리마다 1점을 받습니다. 나머지는 버립니다.' },
    WIRES: { name: '흔들리는 전깃줄', english: 'The Swaying Power Lines', scores: [3, 4, 5], nests: 0, kind: 'SPECIAL', description: '정비: 지배자가 이 장소의 자기 새 1마리를 분수로 보냅니다.' },
    EARLY: { name: '부지런한 새', english: 'The Early Bird', scores: [3, 4, 5], nests: 0, kind: 'SPECIAL', description: '이동: 지배자가 자기 공급처에서 새 1마리를 주머니에 추가합니다.' },
    BIRDBATH: { name: '즐거운 새 목욕탕', english: 'The Happy Birdbath', scores: [2, 0, 1], nests: 0, kind: 'SPECIAL', description: '모집: 지배자가 먼저 주머니에서 3마리를 뽑고 2마리를 선택합니다. 남은 새를 주머니에 돌려놓고 다른 플레이어가 모집합니다.' },
    OVERSTUFFED: { name: '비좁은 새집', english: 'The Overstuffed Birdhouse', scores: [4, 5, 6], nests: 0, kind: 'SPECIAL', description: '정비: 이 장소에 새가 7마리 이상이면 모든 새를 광장으로 보내고 장소를 제거합니다.' },
    HANGING: { name: '아슬아슬한 둥지', english: 'The Precariously Hanging Nest', scores: [5, 3, 1], nests: 0, kind: 'SPECIAL', description: '정비: 이 장소에 새가 4마리 이상이면 모든 새를 광장으로 보냅니다.' },
    ROOKERY: { name: '새들의 집합소', english: 'The Rookery', scores: [1, 0, 1], nests: 3, kind: 'SPECIAL', description: '이동: 이곳의 새 수가 정확히 2인 각 플레이어는 주머니에 새 1마리를 추가할 수 있습니다. 이후 지배자는 이곳의 자기 새 1마리를 분수로 보냅니다.' },
    HIGH: { name: '높은 횃대', english: 'The High Perch', scores: [1, 2, 1], nests: 0, kind: 'SPECIAL', description: '차례 결정: 지배자는 다음 라운드의 마지막 차례가 됩니다.' },
};
export const PERCH_CREATURE_INFO: Record<PerchCreature, {
    name: string;
    home: PerchLocation;
    move: string;
    effect: string;
    art: number;
}> = {
    BEE: { name: '벌', home: 'BEEHIVE', move: '현재 위치에서 최소 2칸 떨어진 장소로 이동합니다.', effect: '도착한 장소에 이미 있는 색의 새 1마리를 다른 장소에서 데려옵니다.', art: 0 },
    CAT: { name: '고양이', home: 'COTTAGE', move: '이웃 중 새가 가장 많은 장소로 이동합니다. 동률이면 선택합니다.', effect: '도착한 곳의 새 1마리를 분수로 보내고, 다른 1마리를 한 칸 이동시킵니다.', art: 1 },
    CUCKOO: { name: '뻐꾸기', home: 'THORN', move: '이웃 장소로 한 칸 이동합니다.', effect: '도착한 곳의 새 1마리와 다른 장소의 새 1마리를 교환합니다.', art: 2 },
    DOG: { name: '강아지', home: 'DOGHOUSE', move: '이웃 장소로 한 칸 이동합니다.', effect: '도착한 곳의 새 1마리를 한 칸 밀어냅니다. 보드 바깥이면 분수로 보냅니다.', art: 3 },
    FOX: { name: '여우', home: 'DEN', move: '되돌아가지 않고 정확히 두 칸 이동합니다.', effect: '지나간 장소와 도착한 장소에서 각각 새 1마리를 분수로 보냅니다.', art: 4 },
    HAWK: { name: '매', home: 'HAWK_NEST', move: '현재 장소를 제외한 어느 장소로든 이동합니다.', effect: '도착한 곳의 새 1마리를 분수로 보냅니다.', art: 5 },
    OWL: { name: '올빼미', home: 'BARN', move: '보드 가장자리를 시계 방향으로 1~4칸 이동합니다.', effect: '지나가거나 도착한 장소 중 한 곳에서 새 1마리를 분수로 보냅니다.', art: 6 },
    SCARECROW: { name: '허수아비', home: 'CORN', move: '조종자가 바뀔 때 현재 교차점을 제외한 교차점으로 이동합니다.', effect: '교차점에 닿은 서로 다른 두 장소에서 새를 1마리씩 분수로 보냅니다.', art: 7 },
    SQUIRREL: { name: '다람쥐', home: 'BENCH', move: '공원 벤치에서 한 칸 이내를 유지하며 이웃으로 한 칸 이동합니다.', effect: '도착한 장소의 새 1마리와 분수의 새 1마리를 교환합니다.', art: 8 },
};
export const PERCH_OBJECTIVES = ['WISE', 'CHIRP', 'TOUCAN', 'LORD', 'IMPECKABLE', 'ILLEAGLE', 'OSTRICH', 'EGGS', 'JACK', 'BIRDEN', 'WING', 'UNPHEASANT', 'QUACK', 'CROWBAR', 'STORK', 'TWEET', 'HIDDEN', 'EGRETS', 'MYSELF', 'ROBIN', 'EMU', 'COMEDIHEN'] as const;
export const PerchObjectiveSchema = v.picklist(PERCH_OBJECTIVES);
export type PerchObjective = v.InferOutput<typeof PerchObjectiveSchema>;
export const PERCH_OBJECTIVE_INFO: Record<PerchObjective, {
    name: string;
    points: number;
    min: number;
    max: number;
    description: string;
}> = {
    WISE: { name: '슬기로운 새', points: 6, min: 2, max: 4, description: '대각선으로 이어진 장소 3곳 이상을 지배하세요.' },
    CHIRP: { name: '한 줄의 노래', points: 3, min: 2, max: 5, description: '한 열의 장소 3곳 이상에 자기 새를 각각 2마리 이상 두세요.' },
    TOUCAN: { name: '모퉁이의 주인', points: 5, min: 3, max: 5, description: '모서리 장소를 2곳 이상 지배하세요.' },
    LORD: { name: '날개의 군주', points: 3, min: 3, max: 5, description: '네 모서리 장소 모두에 자기 새를 1마리 이상 두세요.' },
    IMPECKABLE: { name: '완벽한 둥지', points: 3, min: 3, max: 5, description: '둥지가 있는 장소를 1곳 이상 지배하세요.' },
    ILLEAGLE: { name: '남의 둥지 곁에서', points: 6, min: 2, max: 5, description: '상대가 둥지를 차지한 장소를 지배하세요.' },
    OSTRICH: { name: '나무의 친구들', points: 4, min: 4, max: 5, description: '이름에 나무가 들어가는 장소를 2곳 이상 지배하세요.' },
    EGGS: { name: '나무 위의 아침', points: 3, min: 2, max: 5, description: '이름에 나무가 들어가는 장소를 1곳 이상 지배하세요.' },
    JACK: { name: '동물들의 친구', points: 5, min: 2, max: 5, description: '동물을 2종 이상 조종하세요.' },
    BIRDEN: { name: '작은 동행', points: 4, min: 5, max: 5, description: '동물을 1종 이상 조종하세요.' },
    WING: { name: '오직 날개로', points: 3, min: 2, max: 5, description: '조종하는 동물이 없어야 합니다.' },
    UNPHEASANT: { name: '절묘한 2위', points: 4, min: 3, max: 5, description: '장소 2곳 이상에서 단독 2위가 되세요.' },
    QUACK: { name: '세 번째 자리', points: 5, min: 4, max: 5, description: '장소 2곳 이상에서 단독 3위가 되세요.' },
    CROWBAR: { name: '가장 북적이는 곳', points: 5, min: 2, max: 5, description: '전체 새 수가 가장 많은 장소를 지배하세요. 장소 간 동률이면 그중 한 곳이면 됩니다.' },
    STORK: { name: '어디에나 우리 새', points: 6, min: 2, max: 5, description: '모든 장소에 자기 새를 1마리 이상 두세요.' },
    TWEET: { name: '다정한 두 마리', points: 6, min: 3, max: 5, description: '서로 다른 장소 5곳 이상에 자기 새를 각각 2마리 이상 두세요.' },
    HIDDEN: { name: '고요한 빈자리', points: 6, min: 2, max: 3, description: '어느 색의 새도 없는 장소가 1곳 이상 남아 있어야 합니다.' },
    EGRETS: { name: '여백의 미학', points: 5, min: 2, max: 3, description: '자기 새가 없는 장소를 3곳 이상 남기세요.' },
    MYSELF: { name: '우리만의 장소', points: 5, min: 2, max: 3, description: '자기 새만 있는 장소를 1곳 이상 지배하세요. 동물은 있어도 됩니다.' },
    ROBIN: { name: '두 둥지의 주인', points: 5, min: 4, max: 5, description: '둥지가 있는 장소를 2곳 이상 지배하세요.' },
    EMU: { name: '특별한 보금자리', points: 4, min: 2, max: 5, description: '특수 장소를 1곳 이상 지배하세요.' },
    COMEDIHEN: { name: '네 번째의 여유', points: 4, min: 5, max: 5, description: '장소 3곳 이상에서 단독 4위가 되세요.' },
};
export const PERCH_FLOCK_COLORS = ['#4f9cc5', '#d96d55', '#d3aa45', '#79a46a', '#aa85c5'] as const;
export const PERCH_FLOCK_NAMES = ['파랑', '빨강', '노랑', '초록', '보라'] as const;
export const PERCH_FLOCK_MARKS = ['●', '▲', '◆', '■', '✦'] as const;
export type PerchCell = Readonly<{
    id: number;
    x: number;
    level: number;
    points: number;
    supports: readonly number[];
}>;
/** Explicit support edges transcribed from the two printed fountain boards. Coordinates are display-only. */
export function perchFountainCells(players: number): PerchCell[] {
    const rows = players <= 3 ? [[0, 2, 4, 6], [1, 3, 5], [2, 4], [2, 4], [3]] : [[0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [1, 3, 5], [2, 4], [3]];
    const points = players <= 3 ? [1, 2, 3, 4, 6] : [1, 1, 2, 3, 5, 8];
    const cells: PerchCell[] = [];
    rows.forEach((xs, level) => xs.forEach(x => {
        const below = cells.filter(c => c.level === level - 1);
        let supports = below.filter(c => Math.abs(c.x - x) <= 1).map(c => c.id);
        if (players <= 3 && level === 3)
            supports = below.map(c => c.id);
        cells.push({ id: cells.length, x, level, points: points[level]!, supports });
    }));
    return cells;
}
