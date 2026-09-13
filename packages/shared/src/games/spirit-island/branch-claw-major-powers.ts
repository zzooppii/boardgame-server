import type { SpiritPower } from './catalog.js';
/** Branch & Claw rules metadata with original Korean interface descriptions. */
export const BRANCH_CLAW_MAJOR_POWERS: readonly SpiritPower[] = [
  {
    "expansion": "BRANCH_CLAW",
    "key": "strangling-firevine",
    "name": "Strangling Firevine",
    "title": "목을 조르는 불덩굴",
    "description": "모든 탐험가 파괴. 대상과 출발 모래 지역에 야생 1개씩. 대상과 인접 지역의 야생마다 피해 1. 불 2·식물 3: 야생마다 피해 +1.",
    "cost": 4,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": "SANDS",
    "target": "ANY",
    "terrains": [],
    "elements": [
      "FIRE",
      "PLANT"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "bloodwrack-plague",
    "name": "Bloodwrack Plague",
    "title": "피를 끓이는 역병",
    "description": "질병 2개 추가. 질병마다 대상과 모든 인접 지역 방어 1. 땅 2·동물 4: 공포 2와 질병 수만큼 대상/인접 지역에 피해 분배.",
    "cost": 4,
    "speed": "FAST",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "WATER",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "cast-down-into-the-briny-deep",
    "name": "Cast down into the Briny Deep",
    "title": "소금 바다 깊이 가라앉히다",
    "description": "공포 6. 모든 침략자 파괴. 태양 2·달 2·물 4·땅 4: 대상 보드와 모든 것을 파괴하며 오염은 공급으로 돌아가지 않습니다.",
    "cost": 9,
    "speed": "SLOW",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "COASTAL",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "WATER",
      "EARTH"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "death-falls-gently-from-open-blossoms",
    "name": "Death Falls Gently from Open Blossoms",
    "title": "꽃잎에서 조용히 내려오는 죽음",
    "description": "피해 4. 침략자가 남으면 질병 1개. 바람 3·식물 3: 공포 3과 침략자가 있는 인접 지역 2곳에 질병 1개씩.",
    "cost": 4,
    "speed": "SLOW",
    "range": 3,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "JUNGLE",
      "SANDS"
    ],
    "elements": [
      "MOON",
      "AIR",
      "PLANT"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "fire-and-flood",
    "name": "Fire and Flood",
    "title": "불과 홍수",
    "description": "같은 성소에서 사거리 1과 2의 지역을 각각 선택하여 피해 4씩. 불 3, 물 3: 각각 두 대상 중 한 곳에 피해 +4.",
    "cost": 7,
    "speed": "SLOW",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "WATER"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "grant-hatred-a-ravenous-form",
    "name": "Grant Hatred a Ravenous Form",
    "title": "증오에 굶주린 형상을 주다",
    "description": "분쟁과 오염마다 공포 1·피해 2. 모든 침략자를 파괴했다면 야수 1개. 달 4·불 2: 인접 지역 최대 3곳에 분쟁 1개씩.",
    "cost": 4,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "insatiable-hunger-of-the-swarm",
    "name": "Insatiable Hunger of the Swarm",
    "title": "끝없이 굶주린 무리",
    "description": "오염 1개·야수 2개 추가, 야수 최대 2개 모으기. 야수마다 공포 1, 침략자와 다한에게 각각 피해 2. 야수 1개 파괴. 바람 2·동물 4: 인접 지역에 반복.",
    "cost": 4,
    "speed": "FAST",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "AIR",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "instruments-of-their-own-ruin",
    "name": "Instruments of their own Ruin",
    "title": "스스로 파멸하는 도구",
    "description": "분쟁 1개. 분쟁이 있는 침략자가 다른 침략자에게 피해. 태양 4·불 2·동물 2: 대신 이번 라운드 파괴 시 인접 지역 침략자에게 피해를 주며 다한은 반격하지 않습니다.",
    "cost": 4,
    "speed": "FAST",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "AIR",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "flow-like-water-reach-like-air",
    "name": "Flow like Water, Reach like Air",
    "title": "물처럼 흐르고 바람처럼 뻗다",
    "description": "대상 정령의 능력 사거리 +2. 현신 1개를 인접 지역으로 밀며 탐험가·마을·다한을 종류마다 최대 2개 동반. 바람 2·물 2: 도시·오염도 최대 2개씩 동반.",
    "cost": 2,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "AIR",
      "WATER"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "pent-up-calamity",
    "name": "Pent-Up Calamity",
    "title": "쌓여 있던 재앙",
    "description": "질병 1개와 분쟁 1개 추가. 또는 토큰을 원하는 만큼 제거하여 각각 공포 1·피해 3. 달 2·불 3: 제거한 토큰 최대 2개 반환, 제거하지 않았다면 분쟁 2개 추가.",
    "cost": 3,
    "speed": "FAST",
    "range": 2,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE",
      "EARTH",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "pyroclastic-flow",
    "name": "Pyroclastic Flow",
    "title": "화쇄류",
    "description": "피해 2, 모든 탐험가 파괴. 밀림/습지이면 오염 1개. 불 2·바람 3·땅 2: 피해 +4와 야생 1개.",
    "cost": 3,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": "MOUNTAIN",
    "target": "ANY",
    "terrains": [],
    "elements": [
      "FIRE",
      "AIR",
      "EARTH"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "savage-transformation",
    "name": "Savage Transformation",
    "title": "야수로 변하다",
    "description": "공포 2. 탐험가 1개를 야수로 교체. 달 2·동물 3: 대상 또는 인접 지역의 탐험가 1개도 교체.",
    "cost": 2,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "sea-monsters",
    "name": "Sea Monsters",
    "title": "바다 괴물",
    "description": "야수 1개. 침략자가 있으면 야수마다 공포 2(최대 8). 야수마다 피해 3, 오염마다 피해 1. 물 3·동물 3: 반복.",
    "cost": 5,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "COAST_OR_WETLAND",
    "terrains": [],
    "elements": [
      "WATER",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "tigers-hunting",
    "name": "Tigers Hunting",
    "title": "사냥하는 호랑이",
    "description": "공포 2. 야수 1개 추가, 최대 1개 모으기, 야수마다 피해 1, 최대 2개 밀기. 태양 2·달 2·동물 3: 오염 없는 인접 지역에 피해 1 + 그곳 야수 수.",
    "cost": 2,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": "JUNGLE",
    "target": "NO_BLIGHT",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "unrelenting-growth",
    "name": "Unrelenting Growth",
    "title": "멈추지 않는 성장",
    "description": "대상 정령은 현신에서 사거리 1의 한 지역에 현신 2개와 야생 1개 추가. 태양 3·식물 3: 그곳에 야생 +1·오염 1개 제거, 능력 카드 획득.",
    "cost": 4,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "WATER",
      "PLANT"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "volcanic-eruption",
    "name": "Volcanic Eruption",
    "title": "화산 폭발",
    "description": "공포 6, 피해 20, 모든 다한·야수 파괴, 오염 1개. 불 4·땅 3: 모든 침략자 파괴와 야생 1개. 인접 지역마다 피해 10·다한과 야수 전멸·오염이 없으면 1개 추가.",
    "cost": 8,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": "MOUNTAIN",
    "target": "ANY",
    "terrains": [],
    "elements": [
      "FIRE",
      "EARTH"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "sweep-into-the-sea",
    "name": "Sweep into the Sea",
    "title": "바다로 쓸어 보내다",
    "description": "탐험가와 마을 모두 가장 가까운 바다 방향으로 밀기. 또는 해안이면 모두 파괴. 태양 3·물 2: 인접 지역에 반복.",
    "cost": 4,
    "speed": "SLOW",
    "range": 2,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "AIR",
      "WATER"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "manifest-incarnation",
    "name": "Manifest Incarnation",
    "title": "현신의 화신",
    "description": "공포 6 + 마을·도시·내 현신 수. 도시·마을·탐험가 1개씩 제거한 뒤 침략자가 파괴합니다. 태양 3·달 3: 공포 +3, 이 파괴의 침략자 피해 -6.",
    "cost": 6,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "CITY",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "smothering-infestation",
    "name": "Smothering Infestation",
    "title": "숨 막히는 감염",
    "description": "질병 1개. 밀림/습지이면 공포 2·피해 3. 물 2·식물 2: 침략자마다 피해 1.",
    "cost": 3,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "WATER",
      "PLANT"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "twisted-flowers-murmur-ultimatums",
    "name": "Twisted Flowers Murmur Ultimatums",
    "title": "뒤틀린 꽃의 최후통첩",
    "description": "공포 4와 분쟁 1개. 공포 수준 II 이상이면 침략자 2개 제거. 달 3·바람 2·식물 3: 수준 확인 전 공포 +3, 피해 3.",
    "cost": 5,
    "speed": "SLOW",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "INVADERS",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "AIR",
      "EARTH",
      "PLANT"
    ],
    "deck": "MAJOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "unlock-the-gates-of-deepest-power",
    "name": "Unlock the Gates of Deepest Power",
    "title": "가장 깊은 힘의 문을 열다",
    "description": "대상 정령은 주요 능력 2장 중 1장을 획득하며 망각하지 않습니다. 모든 원소 2: 반값(올림) 지불 또는 라운드 끝 망각으로 즉시 준비 가능. 그 카드의 모든 원소 조건을 충족합니다.",
    "cost": 4,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "FIRE",
      "AIR",
      "WATER",
      "EARTH",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MAJOR"
  }
];
