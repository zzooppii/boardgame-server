export const DUEL_RESOURCES = ['wood', 'clay', 'stone', 'glass', 'papyrus'] as const;
export type DuelResource = typeof DUEL_RESOURCES[number];
export type DuelColor = 'BROWN' | 'GREY' | 'RED' | 'GREEN' | 'BLUE' | 'YELLOW' | 'PURPLE' | 'WHITE' | 'BLACK' | 'TEMPLE';
export type DuelScience = 'QUILL' | 'MORTAR' | 'TRIANGLE' | 'WHEEL' | 'SUNDIAL' | 'ORBIT' | 'LAW';
export type DuelMythology = 'GREEK' | 'PHOENICIAN' | 'MESOPOTAMIAN' | 'EGYPTIAN' | 'ROMAN';
export type DuelCost = Partial<Record<DuelResource, number>>;
export type DuelCardDefinition = Readonly<{
    id: string;
    name: string;
    english: string;
    age: number;
    color: DuelColor;
    cost: DuelCost;
    coins: number;
    points: number;
    shields: number;
    production?: DuelCost;
    flex?: readonly DuelResource[];
    trade?: readonly DuelResource[];
    science?: DuelScience;
    chainOut?: string;
    chainIn?: string;
    income?: number;
    incomePer?: DuelColor | 'WONDER' | 'RESOURCES';
    incomeMultiplier?: number;
    guild?: DuelColor | 'COINS' | 'WONDER' | 'RESOURCES';
    section?: number;
    mythology?: DuelMythology;
    art: number;
}>;
/** Component facts checked against the official rules and the supplied Korean reference. */
export const DUEL_BASE_CARDS: readonly DuelCardDefinition[] = [
    {
        "id": "lumber-yard",
        "name": "벌목장",
        "english": "Lumber Yard",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "production": {
            "wood": 1
        },
        "art": 0
    },
    {
        "id": "sawmill",
        "name": "제재소",
        "english": "Sawmill",
        "age": 2,
        "color": "BROWN",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 0,
        "production": {
            "wood": 2
        },
        "art": 0
    },
    {
        "id": "stone-pit",
        "name": "돌 구덩이",
        "english": "Stone Pit",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 1,
        "points": 0,
        "shields": 0,
        "production": {
            "stone": 1
        },
        "art": 2
    },
    {
        "id": "clay-pool",
        "name": "흙 채굴장",
        "english": "Clay Pool",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "production": {
            "clay": 1
        },
        "art": 1
    },
    {
        "id": "shelf-quarry",
        "name": "단층 채석장",
        "english": "Shelf Quarry",
        "age": 2,
        "color": "BROWN",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 0,
        "production": {
            "stone": 2
        },
        "art": 2
    },
    {
        "id": "logging-camp",
        "name": "벌채장",
        "english": "Logging Camp",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 1,
        "points": 0,
        "shields": 0,
        "production": {
            "wood": 1
        },
        "art": 0
    },
    {
        "id": "brickyard",
        "name": "벽돌 공장",
        "english": "Brickyard",
        "age": 2,
        "color": "BROWN",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 0,
        "production": {
            "clay": 2
        },
        "art": 1
    },
    {
        "id": "quarry",
        "name": "채석장",
        "english": "Quarry",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "production": {
            "stone": 1
        },
        "art": 2
    },
    {
        "id": "clay-pit",
        "name": "흙 구덩이",
        "english": "Clay Pit",
        "age": 1,
        "color": "BROWN",
        "cost": {},
        "coins": 1,
        "points": 0,
        "shields": 0,
        "production": {
            "clay": 1
        },
        "art": 1
    },
    {
        "id": "glassworks",
        "name": "유리 공장",
        "english": "Glassworks",
        "age": 1,
        "color": "GREY",
        "cost": {},
        "coins": 1,
        "points": 0,
        "shields": 0,
        "production": {
            "glass": 1
        },
        "art": 3
    },
    {
        "id": "press",
        "name": "파피루스 다림실",
        "english": "Press",
        "age": 1,
        "color": "GREY",
        "cost": {},
        "coins": 1,
        "points": 0,
        "shields": 0,
        "production": {
            "papyrus": 1
        },
        "art": 4
    },
    {
        "id": "guard-tower",
        "name": "감시탑",
        "english": "Guard Tower",
        "age": 1,
        "color": "RED",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 1,
        "art": 5
    },
    {
        "id": "workshop",
        "name": "작업장",
        "english": "Workshop",
        "age": 1,
        "color": "GREEN",
        "cost": {
            "papyrus": 1
        },
        "coins": 0,
        "points": 1,
        "shields": 0,
        "science": "TRIANGLE",
        "art": 6
    },
    {
        "id": "apothecary",
        "name": "제약소",
        "english": "Apothecary",
        "age": 1,
        "color": "GREEN",
        "cost": {
            "glass": 1
        },
        "coins": 0,
        "points": 1,
        "shields": 0,
        "science": "WHEEL",
        "art": 6
    },
    {
        "id": "stone-reserve",
        "name": "돌 저장고",
        "english": "Stone Reserve",
        "age": 1,
        "color": "YELLOW",
        "cost": {},
        "coins": 3,
        "points": 0,
        "shields": 0,
        "trade": [
            "stone"
        ],
        "art": 11
    },
    {
        "id": "chamber-of-commerce",
        "name": "상공회의소",
        "english": "Chamber Of Commerce",
        "age": 3,
        "color": "YELLOW",
        "cost": {
            "papyrus": 2
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "incomePer": "GREY",
        "incomeMultiplier": 3,
        "art": 11
    },
    {
        "id": "forum",
        "name": "광장",
        "english": "Forum",
        "age": 2,
        "color": "YELLOW",
        "cost": {
            "clay": 1
        },
        "coins": 3,
        "points": 0,
        "shields": 0,
        "flex": [
            "glass",
            "papyrus"
        ],
        "art": 11
    },
    {
        "id": "clay-reserve",
        "name": "흙 저장고",
        "english": "Clay Reserve",
        "age": 1,
        "color": "YELLOW",
        "cost": {},
        "coins": 3,
        "points": 0,
        "shields": 0,
        "trade": [
            "clay"
        ],
        "art": 11
    },
    {
        "id": "port",
        "name": "항구",
        "english": "Port",
        "age": 3,
        "color": "YELLOW",
        "cost": {
            "wood": 1,
            "glass": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "incomePer": "BROWN",
        "incomeMultiplier": 2,
        "art": 12
    },
    {
        "id": "caravansery",
        "name": "대상단 숙박소",
        "english": "Caravansery",
        "age": 2,
        "color": "YELLOW",
        "cost": {
            "glass": 1,
            "papyrus": 1
        },
        "coins": 2,
        "points": 0,
        "shields": 0,
        "flex": [
            "wood",
            "clay",
            "stone"
        ],
        "art": 11
    },
    {
        "id": "customs-house",
        "name": "세관",
        "english": "Customs House",
        "age": 2,
        "color": "YELLOW",
        "cost": {},
        "coins": 4,
        "points": 0,
        "shields": 0,
        "trade": [
            "papyrus",
            "glass"
        ],
        "art": 11
    },
    {
        "id": "tribunal",
        "name": "법원",
        "english": "Courthouse",
        "age": 2,
        "color": "BLUE",
        "cost": {
            "wood": 2,
            "glass": 1
        },
        "coins": 0,
        "points": 5,
        "shields": 0,
        "art": 14
    },
    {
        "id": "wood-reserve",
        "name": "나무 저장고",
        "english": "Wood Reserve",
        "age": 1,
        "color": "YELLOW",
        "cost": {},
        "coins": 3,
        "points": 0,
        "shields": 0,
        "trade": [
            "wood"
        ],
        "art": 11
    },
    {
        "id": "armory",
        "name": "무기고",
        "english": "Armory",
        "age": 3,
        "color": "YELLOW",
        "cost": {
            "stone": 2,
            "glass": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "incomePer": "RED",
        "incomeMultiplier": 1,
        "art": 11
    },
    {
        "id": "glass-blower",
        "name": "유리 가공 공장",
        "english": "Glass-Blower",
        "age": 2,
        "color": "GREY",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "production": {
            "glass": 1
        },
        "art": 3
    },
    {
        "id": "drying-room",
        "name": "건조실",
        "english": "Drying Room",
        "age": 2,
        "color": "GREY",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "production": {
            "papyrus": 1
        },
        "art": 4
    },
    {
        "id": "arsenal",
        "name": "군함 조선소",
        "english": "Arsenal",
        "age": 3,
        "color": "RED",
        "cost": {
            "clay": 3,
            "wood": 2
        },
        "coins": 0,
        "points": 0,
        "shields": 3,
        "art": 5
    },
    {
        "id": "merchants-guild",
        "name": "상인 조합",
        "english": "Merchants Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "wood": 1,
            "clay": 1,
            "glass": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "incomePer": "YELLOW",
        "incomeMultiplier": 1,
        "guild": "YELLOW",
        "art": 13
    },
    {
        "id": "shipowners-guild",
        "name": "선주 조합",
        "english": "Shipowners Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "clay": 1,
            "stone": 1,
            "glass": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "incomePer": "RESOURCES",
        "incomeMultiplier": 1,
        "guild": "RESOURCES",
        "art": 13
    },
    {
        "id": "builders-guild",
        "name": "건축가 조합",
        "english": "Builders Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "stone": 2,
            "wood": 1,
            "clay": 1,
            "glass": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "guild": "WONDER",
        "art": 13
    },
    {
        "id": "magistrates-guild",
        "name": "법률가 조합",
        "english": "Magistrates Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "wood": 2,
            "clay": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "incomePer": "BLUE",
        "incomeMultiplier": 1,
        "guild": "BLUE",
        "art": 13
    },
    {
        "id": "scientists-guild",
        "name": "과학자 조합",
        "english": "Scientists Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "clay": 2,
            "wood": 2
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "incomePer": "GREEN",
        "incomeMultiplier": 1,
        "guild": "GREEN",
        "art": 13
    },
    {
        "id": "moneylenders-guild",
        "name": "대금업자 조합",
        "english": "Moneylenders Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "stone": 2,
            "wood": 2
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "guild": "COINS",
        "art": 13
    },
    {
        "id": "tacticians-guild",
        "name": "군사전문가 조합",
        "english": "Tacticians Guild",
        "age": 3,
        "color": "PURPLE",
        "cost": {
            "stone": 2,
            "clay": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 0,
        "incomePer": "RED",
        "incomeMultiplier": 1,
        "guild": "RED",
        "art": 13
    },
    {
        "id": "courthouse",
        "name": "총독부",
        "english": "Pretorium",
        "age": 3,
        "color": "RED",
        "cost": {},
        "coins": 8,
        "points": 0,
        "shields": 3,
        "art": 5
    },
    {
        "id": "academy",
        "name": "학술원",
        "english": "Academy",
        "age": 3,
        "color": "GREEN",
        "cost": {
            "stone": 1,
            "wood": 1,
            "glass": 2
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "science": "SUNDIAL",
        "art": 7
    },
    {
        "id": "study",
        "name": "연구당",
        "english": "Study",
        "age": 3,
        "color": "GREEN",
        "cost": {
            "wood": 2,
            "glass": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "science": "SUNDIAL",
        "art": 7
    },
    {
        "id": "palace",
        "name": "궁전",
        "english": "Palace",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "stone": 1,
            "wood": 1,
            "clay": 1,
            "glass": 2
        },
        "coins": 0,
        "points": 7,
        "shields": 0,
        "art": 9
    },
    {
        "id": "town-hall",
        "name": "시청",
        "english": "Town Hall",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "stone": 3,
            "wood": 2
        },
        "coins": 0,
        "points": 7,
        "shields": 0,
        "art": 9
    },
    {
        "id": "obelisk",
        "name": "오벨리스크",
        "english": "Obelisk",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "stone": 2,
            "glass": 1
        },
        "coins": 0,
        "points": 5,
        "shields": 0,
        "art": 9
    },
    {
        "id": "walls",
        "name": "성벽",
        "english": "Walls",
        "age": 2,
        "color": "RED",
        "cost": {
            "stone": 2
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "art": 5
    },
    {
        "id": "stable",
        "name": "마구간",
        "english": "Stable",
        "age": 1,
        "color": "RED",
        "cost": {
            "wood": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 1,
        "chainOut": "stable",
        "art": 5
    },
    {
        "id": "lighthouse",
        "name": "등대",
        "english": "Lighthouse",
        "age": 3,
        "color": "YELLOW",
        "cost": {
            "clay": 2,
            "glass": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "chainIn": "tavern",
        "incomePer": "YELLOW",
        "incomeMultiplier": 1,
        "art": 12
    },
    {
        "id": "scriptorium",
        "name": "기록실",
        "english": "Scriptorium",
        "age": 1,
        "color": "GREEN",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 0,
        "science": "QUILL",
        "chainOut": "scriptorium",
        "art": 6
    },
    {
        "id": "theater",
        "name": "극장",
        "english": "Theater",
        "age": 1,
        "color": "BLUE",
        "cost": {},
        "coins": 0,
        "points": 3,
        "shields": 0,
        "chainOut": "theater",
        "art": 8
    },
    {
        "id": "tavern",
        "name": "여관",
        "english": "Tavern",
        "age": 1,
        "color": "YELLOW",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "chainOut": "tavern",
        "income": 4,
        "art": 11
    },
    {
        "id": "brewery",
        "name": "양조장",
        "english": "Brewery",
        "age": 2,
        "color": "YELLOW",
        "cost": {},
        "coins": 0,
        "points": 0,
        "shields": 0,
        "chainOut": "brewery",
        "income": 6,
        "art": 11
    },
    {
        "id": "altar",
        "name": "제단",
        "english": "Altar",
        "age": 1,
        "color": "BLUE",
        "cost": {},
        "coins": 0,
        "points": 3,
        "shields": 0,
        "chainOut": "altar",
        "art": 9
    },
    {
        "id": "baths",
        "name": "공중목욕탕",
        "english": "Baths",
        "age": 1,
        "color": "BLUE",
        "cost": {
            "stone": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "chainOut": "baths",
        "art": 10
    },
    {
        "id": "archery-range",
        "name": "궁수 훈련소",
        "english": "Archery Range",
        "age": 2,
        "color": "RED",
        "cost": {
            "stone": 1,
            "wood": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "chainOut": "archery-range",
        "art": 5
    },
    {
        "id": "garrison",
        "name": "수비대 주둔지",
        "english": "Garrison",
        "age": 1,
        "color": "RED",
        "cost": {
            "clay": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 1,
        "chainOut": "garrison",
        "art": 5
    },
    {
        "id": "pharmacist",
        "name": "약국",
        "english": "Pharmacist",
        "age": 1,
        "color": "GREEN",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 0,
        "science": "MORTAR",
        "chainOut": "pharmacist",
        "art": 6
    },
    {
        "id": "parade-ground",
        "name": "연병장",
        "english": "Parade Ground",
        "age": 2,
        "color": "RED",
        "cost": {
            "clay": 2,
            "glass": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "chainOut": "parade-ground",
        "art": 5
    },
    {
        "id": "palisade",
        "name": "방책",
        "english": "Palisade",
        "age": 1,
        "color": "RED",
        "cost": {},
        "coins": 2,
        "points": 0,
        "shields": 1,
        "chainOut": "palisade",
        "art": 5
    },
    {
        "id": "horse-breeders",
        "name": "말 사육소",
        "english": "Horse Breeders",
        "age": 2,
        "color": "RED",
        "cost": {
            "clay": 1,
            "wood": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 1,
        "chainIn": "stable",
        "art": 5
    },
    {
        "id": "library",
        "name": "도서관",
        "english": "Library",
        "age": 2,
        "color": "GREEN",
        "cost": {
            "stone": 1,
            "wood": 1,
            "glass": 1
        },
        "coins": 0,
        "points": 2,
        "shields": 0,
        "science": "QUILL",
        "chainIn": "scriptorium",
        "art": 6
    },
    {
        "id": "statue",
        "name": "동상",
        "english": "Statue",
        "age": 2,
        "color": "BLUE",
        "cost": {
            "clay": 2
        },
        "coins": 0,
        "points": 4,
        "shields": 0,
        "chainOut": "statue",
        "chainIn": "theater",
        "art": 9
    },
    {
        "id": "gardens",
        "name": "정원",
        "english": "Gardens",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "wood": 2,
            "clay": 2
        },
        "coins": 0,
        "points": 6,
        "shields": 0,
        "chainIn": "statue",
        "art": 9
    },
    {
        "id": "arena",
        "name": "투기장",
        "english": "Arena",
        "age": 3,
        "color": "YELLOW",
        "cost": {
            "clay": 1,
            "stone": 1,
            "wood": 1
        },
        "coins": 0,
        "points": 3,
        "shields": 0,
        "chainIn": "brewery",
        "incomePer": "WONDER",
        "incomeMultiplier": 2,
        "art": 11
    },
    {
        "id": "temple",
        "name": "신전",
        "english": "Temple",
        "age": 2,
        "color": "BLUE",
        "cost": {
            "wood": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 4,
        "shields": 0,
        "chainOut": "temple",
        "chainIn": "altar",
        "art": 9
    },
    {
        "id": "rostrum",
        "name": "연단",
        "english": "Rostrum",
        "age": 2,
        "color": "BLUE",
        "cost": {
            "stone": 1,
            "wood": 1
        },
        "coins": 0,
        "points": 4,
        "shields": 0,
        "chainOut": "rostrum",
        "art": 9
    },
    {
        "id": "pantheon",
        "name": "사원",
        "english": "Pantheon",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "clay": 1,
            "wood": 1,
            "papyrus": 2
        },
        "coins": 0,
        "points": 6,
        "shields": 0,
        "chainIn": "temple",
        "art": 9
    },
    {
        "id": "senate",
        "name": "원로원",
        "english": "Senate",
        "age": 3,
        "color": "BLUE",
        "cost": {
            "clay": 2,
            "stone": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 5,
        "shields": 0,
        "chainIn": "rostrum",
        "art": 14
    },
    {
        "id": "aqueduct",
        "name": "수도교",
        "english": "Aqueduct",
        "age": 2,
        "color": "BLUE",
        "cost": {
            "stone": 3
        },
        "coins": 0,
        "points": 5,
        "shields": 0,
        "chainIn": "baths",
        "art": 10
    },
    {
        "id": "school",
        "name": "학교",
        "english": "School",
        "age": 2,
        "color": "GREEN",
        "cost": {
            "wood": 1,
            "papyrus": 2
        },
        "coins": 0,
        "points": 1,
        "shields": 0,
        "science": "WHEEL",
        "chainOut": "school",
        "art": 6
    },
    {
        "id": "university",
        "name": "대학",
        "english": "University",
        "age": 3,
        "color": "GREEN",
        "cost": {
            "clay": 1,
            "glass": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 2,
        "shields": 0,
        "science": "ORBIT",
        "chainIn": "school",
        "art": 7
    },
    {
        "id": "siege-workshop",
        "name": "공성무기 제조소",
        "english": "Siege Workshop",
        "age": 3,
        "color": "RED",
        "cost": {
            "wood": 3,
            "glass": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "chainIn": "archery-range",
        "art": 5
    },
    {
        "id": "barracks",
        "name": "병영",
        "english": "Barracks",
        "age": 2,
        "color": "RED",
        "cost": {},
        "coins": 3,
        "points": 0,
        "shields": 1,
        "chainIn": "garrison",
        "art": 5
    },
    {
        "id": "dispensary",
        "name": "진료소",
        "english": "Dispensary",
        "age": 2,
        "color": "GREEN",
        "cost": {
            "clay": 2,
            "stone": 1
        },
        "coins": 0,
        "points": 2,
        "shields": 0,
        "science": "MORTAR",
        "chainIn": "pharmacist",
        "art": 6
    },
    {
        "id": "laboratory",
        "name": "실험실",
        "english": "Laboratory",
        "age": 2,
        "color": "GREEN",
        "cost": {
            "wood": 1,
            "glass": 2
        },
        "coins": 0,
        "points": 1,
        "shields": 0,
        "science": "TRIANGLE",
        "chainOut": "laboratory",
        "art": 6
    },
    {
        "id": "observatory",
        "name": "관측소",
        "english": "Observatory",
        "age": 3,
        "color": "GREEN",
        "cost": {
            "stone": 1,
            "papyrus": 2
        },
        "coins": 0,
        "points": 2,
        "shields": 0,
        "science": "ORBIT",
        "chainIn": "laboratory",
        "art": 7
    },
    {
        "id": "circus",
        "name": "원형 경기장",
        "english": "Circus",
        "age": 3,
        "color": "RED",
        "cost": {
            "clay": 2,
            "stone": 2
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "chainIn": "parade-ground",
        "art": 5
    },
    {
        "id": "fortifications",
        "name": "요새",
        "english": "Fortifications",
        "age": 3,
        "color": "RED",
        "cost": {
            "stone": 2,
            "clay": 1,
            "papyrus": 1
        },
        "coins": 0,
        "points": 0,
        "shields": 2,
        "chainIn": "palisade",
        "art": 5
    }
];
export type DuelWonderDefinition = Readonly<{
    id: string;
    name: string;
    cost: DuelCost;
    points: number;
    coins?: number;
    loss?: number;
    shields?: number;
    replay?: boolean;
    flex?: readonly DuelResource[];
    effect?: string;
    onSelect?: string;
    expansion?: 'PANTHEON' | 'AGORA';
    art: number;
}>;
export const DUEL_WONDERS: readonly DuelWonderDefinition[] = [
    { id: 'wonder-appian', name: '아피아 가도', cost: { stone: 2, clay: 2, papyrus: 1 }, coins: 3, loss: 3, points: 3, replay: true, art: 0 },
    { id: 'wonder-colossus', name: '콜로소스', cost: { clay: 3, glass: 1 }, shields: 2, points: 3, art: 1 },
    { id: 'wonder-circus', name: '대원형 경기장', cost: { stone: 2, wood: 1, glass: 1 }, shields: 1, points: 3, effect: 'DESTROY_GREY', art: 2 },
    { id: 'wonder-library', name: '알렉산드리아 대도서관', cost: { wood: 3, glass: 1, papyrus: 1 }, points: 4, effect: 'LIBRARY', art: 3 },
    { id: 'wonder-lighthouse', name: '알렉산드리아 등대', cost: { wood: 1, stone: 1, papyrus: 2 }, points: 4, flex: ['wood', 'clay', 'stone'], art: 4 },
    { id: 'wonder-gardens', name: '공중정원', cost: { wood: 2, glass: 1, papyrus: 1 }, coins: 6, points: 3, replay: true, art: 5 },
    { id: 'wonder-mausoleum', name: '마우솔로스의 영묘', cost: { clay: 2, glass: 2, papyrus: 1 }, points: 2, effect: 'RESURRECT', art: 6 },
    { id: 'wonder-piraeus', name: '피레우스 항', cost: { wood: 2, stone: 1, clay: 1 }, points: 2, flex: ['glass', 'papyrus'], replay: true, art: 7 },
    { id: 'wonder-pyramids', name: '피라미드', cost: { stone: 3, papyrus: 1 }, points: 9, art: 8 },
    { id: 'wonder-sphinx', name: '스핑크스', cost: { stone: 1, clay: 1, glass: 2 }, points: 6, replay: true, art: 9 },
    { id: 'wonder-artemis', name: '아르테미스 신전', cost: { wood: 1, stone: 1, glass: 1, papyrus: 1 }, coins: 12, points: 0, replay: true, art: 10 },
    { id: 'wonder-zeus-statue', name: '제우스상', cost: { wood: 1, stone: 1, clay: 1, papyrus: 2 }, shields: 1, points: 3, effect: 'DESTROY_BROWN', art: 11 },
    { id: 'wonder-sanctuary', name: '성역', cost: { stone: 2, glass: 1, papyrus: 1 }, points: 0, replay: true, expansion: 'PANTHEON', art: 12 },
    { id: 'wonder-divine-theater', name: '신들의 극장', cost: { wood: 2, glass: 1, papyrus: 2 }, points: 2, effect: 'THEATER', expansion: 'PANTHEON', art: 13 },
    { id: 'wonder-curia-julia', name: '쿠리아 율리아', cost: { wood: 1, stone: 1, clay: 1, glass: 1, papyrus: 1 }, points: 0, coins: 6, replay: true, effect: 'UNPREPARED', onSelect: 'CONSPIRE', expansion: 'AGORA', art: 14 },
    { id: 'wonder-knossos', name: '크노소스', cost: { wood: 1, stone: 1, clay: 1, glass: 2 }, points: 3, effect: 'KNOSSOS', onSelect: 'PLACE', expansion: 'AGORA', art: 15 },
];
export const DUEL_MYTHOLOGIES: readonly DuelMythology[] = ['MESOPOTAMIAN', 'PHOENICIAN', 'GREEK', 'EGYPTIAN', 'ROMAN'];
export const DUEL_GODS = [
    { id: 'enki', name: '엔키', mythology: 'MESOPOTAMIAN', text: '공개 시 진보 토큰 2개를 올립니다. 활성화하면 1개를 획득합니다.' },
    { id: 'ishtar', name: '이슈타르', mythology: 'MESOPOTAMIAN', text: '법률과 같은 과학 기호를 얻습니다.' },
    { id: 'nisaba', name: '니사바', mythology: 'MESOPOTAMIAN', text: '상대 과학 건물에 뱀 토큰을 놓고 그 과학 기호를 복제합니다.' },
    { id: 'astarte', name: '아스타르테', mythology: 'PHOENICIAN', text: '보호된 코인 7개. 소비 가능하며 남은 코인은 각각 1점입니다.' },
    { id: 'baal', name: '바알', mythology: 'PHOENICIAN', text: '상대의 갈색 또는 회색 건물 1개를 가져옵니다.' },
    { id: 'tanit', name: '타니트', mythology: 'PHOENICIAN', text: '코인 12개를 얻습니다.' },
    { id: 'aphrodite', name: '아프로디테', mythology: 'GREEK', text: '9점을 얻습니다.' },
    { id: 'hades', name: '하데스', mythology: 'GREEK', text: '버린 카드 1장을 무료로 건설합니다.' },
    { id: 'zeus', name: '제우스', mythology: 'GREEK', text: '배치의 카드 1장을 제거하고 그 위 토큰을 획득합니다.' },
    { id: 'anubis', name: '아누비스', mythology: 'EGYPTIAN', text: '건설된 불가사의 아래 카드를 버려 미건설 상태로 되돌립니다. 이전 즉시 효과는 유지됩니다.' },
    { id: 'isis', name: '이시스', mythology: 'EGYPTIAN', text: '버린 카드를 사용해 자신의 불가사의 1개를 무료로 건설합니다.' },
    { id: 'ra', name: '라', mythology: 'EGYPTIAN', text: '상대의 미건설 불가사의 1개를 가져옵니다.' },
    { id: 'mars', name: '마르스', mythology: 'ROMAN', text: '방패 2개를 얻습니다.' },
    { id: 'minerva', name: '미네르바', mythology: 'ROMAN', text: '군사 트랙에 토큰을 놓습니다. 충돌 말은 그 칸 진입 직전에 멈추고 토큰이 제거됩니다.' },
    { id: 'neptune', name: '넵투누스', mythology: 'ROMAN', text: '군사 토큰 하나를 효과 없이 버린 뒤 다른 하나의 효과를 적용합니다.' },
    { id: 'gate', name: '관문', mythology: 'GATE', text: '각 신화 덱 맨 위의 신을 공개하고 1명을 무료로 활성화합니다. 자리 비용의 2배를 지불합니다.' },
] as const;
export const DUEL_PROGRESS = [
    { id: 'agriculture', name: '농업', text: '즉시 6코인 · 4점', expansion: 'BASE' },
    { id: 'architecture', name: '건축', text: '불가사의 건설에 필요한 자원 2개 할인', expansion: 'BASE' },
    { id: 'economy', name: '경제', text: '상대가 자원 구매에 지불한 코인을 은행에서 획득', expansion: 'BASE' },
    { id: 'law', name: '법률', text: '법률 과학 기호 획득', expansion: 'BASE' },
    { id: 'masonry', name: '석공술', text: '파란 건물 건설에 필요한 자원 2개 할인', expansion: 'BASE' },
    { id: 'mathematics', name: '수학', text: '보유한 진보 토큰마다 3점 (자신 포함)', expansion: 'BASE' },
    { id: 'philosophy', name: '철학', text: '7점', expansion: 'BASE' },
    { id: 'strategy', name: '군사전략', text: '이후 건설하는 빨간 건물마다 방패 1개 추가', expansion: 'BASE' },
    { id: 'theology', name: '신학', text: '이후 건설하는 불가사의에 추가 턴 부여 (중복 없음)', expansion: 'BASE' },
    { id: 'urbanism', name: '도시화', text: '즉시 6코인 · 이후 연쇄 무료 건설마다 4코인', expansion: 'BASE' },
    { id: 'mysticism', name: '신비주의', text: '보유한 신화·공물 토큰마다 2점', expansion: 'PANTHEON' },
    { id: 'poliorcetics', name: '공성술', text: '군사 전진 1칸마다 상대가 코인 1개 상실', expansion: 'PANTHEON' },
    { id: 'engineering', name: '공학', text: '선행 연계 기호가 있는 건물을 1코인으로 건설 가능', expansion: 'PANTHEON' },
    { id: 'corruption', name: '부패', text: '모든 의원을 무료로 고용', expansion: 'AGORA' },
    { id: 'organized-crime', name: '조직범죄', text: '음모 획득 시 후보 2장을 모두 획득', expansion: 'AGORA' },
] as const;
export const DUEL_CONSPIRACIES = [
    { id: 'extortion', name: '강탈', text: '상대 미건설 불가사의 획득 → 영향력 1회 이동', effect: 'STEAL_WONDER', move: true },
    { id: 'blackmail', name: '협박', text: '상대 코인의 절반(올림) 획득 → 영향력 1회 이동', effect: 'HALF_COINS', move: true },
    { id: 'expropriation', name: '몰수', text: '상대 파란 건물 1개 제거 → 영향력 1회 이동', effect: 'DESTROY_BLUE', move: true },
    { id: 'swindle', name: '사기', text: '상대 노란 건물 1개 제거 → 영향력 1회 이동', effect: 'DESTROY_YELLOW', move: true },
    { id: 'obscurantism', name: '우민화', text: '공용·상대·상자 속 진보 토큰 1개를 비공개로 봉인', effect: 'LOCK_PROGRESS', move: false },
    { id: 'coup', name: '쿠데타', text: '방패 2개 획득', effect: 'COUP', move: false },
    { id: 'property-fraud', name: '부동산 사기', text: '배치 최상단의 건물 1개를 무료 건설 (의원 제외)', effect: 'TOP_BUILD', move: false },
    { id: 'treason', name: '반역', text: '현재까지 시대 준비에서 제외된 건물 중 1개 무료 건설', effect: 'BOX_BUILD', move: false },
    { id: 'political-maneuver', name: '정치 공작', text: '영향력 배치 → 상대 영향력 제거 → 영향력 이동', effect: 'POLITICAL', move: false },
    { id: 'espionage', name: '첩보', text: '상자 속 진보 토큰 1개 획득', effect: 'BOX_PROGRESS', move: false },
    { id: 'turn-of-events', name: '정세 변화', text: '가져갈 수 있는 카드 최대 2장 제거 → 영향력 이동', effect: 'DISCARD_TWO', move: true },
    { id: 'embezzlement', name: '횡령', text: '내 영향력 수만큼 코인 획득 · 상대는 자기 영향력 수만큼 코인 상실', effect: 'INFLUENCE_COINS', move: false },
    { id: 'foreclosure', name: '압류', text: '상대 갈색·회색 건물 1개 획득', effect: 'STEAL_RESOURCE', move: false },
    { id: 'coercion', name: '강요', text: '상대와 같은 색의 파랑·초록 건물 교환 → 영향력 이동', effect: 'SWAP', move: true },
    { id: 'insider-influence', name: '내부 공작', text: '법령 1개를 다른 의회로 이동 → 영향력 이동', effect: 'MOVE_DECREE', move: true },
    { id: 'sabotage', name: '파괴 공작', text: '상대의 건설된 불가사의 1개를 게임에서 제거', effect: 'SABOTAGE', move: false },
] as const;
export const DUEL_DECREES = [
    '파란 건물이 건설될 때 시대 수만큼 코인 획득', '초록 건물이 건설될 때 시대 수만큼 코인 획득', '노란 건물이 건설될 때 시대 수만큼 코인 획득', '빨간 건물이 건설될 때 시대 수만큼 코인 획득',
    '노란 건물의 비용 기호 1개 할인', '빨간 건물의 비용 기호 1개 할인', '초록 건물의 비용 기호 1개 할인', '불가사의 자원 1개 할인',
    '지배 중 방패 1개 (지배 변경 시 군사 위치 변경)', '갈색 자원 구매비 1코인 할인 (최소 1)', '회색 자원 구매비 1코인 할인 (최소 1)', '원로원 행동 계산 시 파란 건물 +2',
    '카드를 버릴 때 2코인 추가', '불가사의 건설 시 시대 수만큼 코인 획득', '상대의 연계 기호 사용 가능', '음모자 고용 시 추가 턴',
] as const;
const temples: readonly [
    DuelMythology,
    DuelCost
][] = [['MESOPOTAMIAN', { wood: 3, glass: 1, papyrus: 1 }], ['PHOENICIAN', { wood: 1, stone: 1, glass: 1, papyrus: 2 }], ['GREEK', { stone: 3, glass: 1, papyrus: 1 }], ['EGYPTIAN', { clay: 3, glass: 1, papyrus: 1 }], ['ROMAN', { clay: 1, stone: 1, glass: 2, papyrus: 1 }]];
export const DUEL_CARDS: readonly DuelCardDefinition[] = [...DUEL_BASE_CARDS,
    ...[0, 0, 1, 1, 1, 2, 2].map((section, i): DuelCardDefinition => ({ id: `politician-${i}`, name: `정치가 · ${['좌', '중앙', '우'][section]} 구역`, english: 'Politician', age: 0, color: 'WHITE', section, cost: {}, coins: 0, points: 0, shields: 0, art: 14 })),
    ...Array.from({ length: 6 }, (_, i): DuelCardDefinition => ({ id: `conspirator-${i}`, name: '음모자', english: 'Conspirator', age: 0, color: 'BLACK', cost: {}, coins: 0, points: 0, shields: 0, art: 14 })),
    ...temples.map(([mythology, cost], i): DuelCardDefinition => ({ id: `temple-${mythology}`, name: `${['메소포타미아', '페니키아', '그리스', '이집트', '로마'][i]} 대신전`, english: `${mythology} Grand Temple`, age: 3, color: 'TEMPLE', cost, coins: 0, points: 0, shields: 0, mythology, chainIn: `myth-${mythology}`, art: 15 })),
];
export function duelCard(id: string): DuelCardDefinition {
    const c = DUEL_CARDS.find(c => c.id === id);
    if (!c)
        throw new Error('Unknown Duel card definition.');
    return c;
}
export function duelWonder(id: string): DuelWonderDefinition {
    const w = DUEL_WONDERS.find(w => w.id === id);
    if (!w)
        throw new Error('Unknown Duel wonder definition.');
    return w;
}
export const DUEL_RULES_VERSION = 'seven-wonders-duel-v1' as const;
