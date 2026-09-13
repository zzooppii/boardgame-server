import type { SpiritPower } from './catalog.js';
/** Branch & Claw mechanical facts; original Korean interface summaries. */
export const BRANCH_CLAW_MINOR_POWERS: readonly SpiritPower[] = [
  {
    "expansion": "BRANCH_CLAW",
    "key": "inflame-the-fires-of-life",
    "name": "Inflame the Fires of Life",
    "title": "생명의 불꽃을 지피다",
    "description": "질병 1개 추가 또는 공포 1과 분쟁 1개 추가. 동물 3이면 둘 다 가능.",
    "cost": 1,
    "speed": "SLOW",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "fire-in-the-sky",
    "name": "Fire in the Sky",
    "title": "하늘의 불",
    "description": "공포 2. 분쟁 1개 추가.",
    "cost": 1,
    "speed": "FAST",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "AIR"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "fleshrot-fever",
    "name": "Fleshrot Fever",
    "title": "살을 썩히는 열병",
    "description": "공포 1. 질병 1개 추가.",
    "cost": 1,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "JUNGLE",
      "SANDS"
    ],
    "elements": [
      "FIRE",
      "AIR",
      "WATER",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "gold-s-allure",
    "name": "Gold's Allure",
    "title": "황금의 유혹",
    "description": "탐험가 1개와 마을 1개 모으기. 분쟁 1개 추가.",
    "cost": 0,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "MOUNTAIN"
    ],
    "elements": [
      "FIRE",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "guardian-serpents",
    "name": "Guardian Serpents",
    "title": "수호하는 뱀",
    "description": "대상 정령의 현신 지역 한 곳에 야수 1개 추가. 그 정령의 성소이면 방어 4.",
    "cost": 1,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "here-there-be-monsters",
    "name": "Here there be Monsters",
    "title": "괴물이 사는 곳",
    "description": "탐험가·마을·다한 1개를 밀 수 있습니다. 공포 2, 야수가 있으면 공포 +1.",
    "cost": 0,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "INLAND",
    "terrains": [],
    "elements": [
      "MOON",
      "AIR",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "infested-aquifers",
    "name": "Infested Aquifers",
    "title": "오염된 대수층",
    "description": "질병이 있으면 침략자마다 피해 1. 또는 산/습지이면 공포 1과 질병 1개 추가.",
    "cost": 1,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "WATER",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "poisoned-dew",
    "name": "Poisoned Dew",
    "title": "독 이슬",
    "description": "탐험가 1개 파괴. 밀림/습지에서는 모든 탐험가 파괴.",
    "cost": 1,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "FIRE",
      "WATER",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "portents-of-disaster",
    "name": "Portents of Disaster",
    "title": "재앙의 전조",
    "description": "공포 2. 이번 라운드 이 지역에서 다음 침략자가 파괴되면 공포 1.",
    "cost": 0,
    "speed": "FAST",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "INVADERS",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "AIR"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "prowling-panthers",
    "name": "Prowling Panthers",
    "title": "배회하는 표범",
    "description": "공포 1과 야수 1개 추가. 또는 야수가 있으면 탐험가/마을 1개 파괴.",
    "cost": 1,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "MOUNTAIN",
      "JUNGLE"
    ],
    "elements": [
      "MOON",
      "FIRE",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "renewing-rain",
    "name": "Renewing Rain",
    "title": "되살리는 비",
    "description": "밀림/모래이면 오염 1개 제거. 식물 3이면 야생 1개 추가.",
    "cost": 1,
    "speed": "SLOW",
    "range": 1,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "WATER",
      "EARTH",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "rites-of-the-land-s-rejection",
    "name": "Rites of the Land's Rejection",
    "title": "땅의 거부 의식",
    "description": "이번 라운드 건설 차단. 건물 수와 다한 수 중 적은 만큼 공포. 또는 다한 최대 3개 밀기.",
    "cost": 1,
    "speed": "FAST",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "DAHAN",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE",
      "EARTH"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "pact-of-the-joined-hunt",
    "name": "Pact of the Joined Hunt",
    "title": "함께하는 사냥의 맹약",
    "description": "대상 정령의 현신 지역 한 곳으로 다한 1개 모으기. 이후 그곳의 다한마다 피해 1.",
    "cost": 1,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "razor-sharp-undergrowth",
    "name": "Razor-Sharp Undergrowth",
    "title": "칼날 같은 덤불",
    "description": "탐험가 1개와 다한 1개 파괴. 야생 1개 추가. 방어 2.",
    "cost": 1,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "NO_BLIGHT",
    "terrains": [],
    "elements": [
      "MOON",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "growth-through-sacrifice",
    "name": "Growth through Sacrifice",
    "title": "희생을 통한 성장",
    "description": "내 현신 1개 파괴. 대상 정령은 자기 현신 지역의 오염 1개 제거 또는 현신 1개 추가. 태양 2이면 같은 지역에서 둘 다 가능.",
    "cost": 0,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE",
      "WATER",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "scour-the-land",
    "name": "Scour the Land",
    "title": "땅을 쓸어버리다",
    "description": "마을 3개와 모든 탐험가 파괴. 오염 1개 추가. 바람 3이면 빠르게 사용 가능.",
    "cost": 1,
    "speed": "SLOW",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "AIR",
      "EARTH"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "sky-stretches-to-shore",
    "name": "Sky Stretches to Shore",
    "title": "해안까지 펼쳐진 하늘",
    "description": "대상 정령은 능력 1개의 빠름/느림을 바꿀 수 있습니다. 이번 라운드 해안 대상 사거리 +3.",
    "cost": 1,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "AIR",
      "WATER",
      "EARTH"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "swarming-wasps",
    "name": "Swarming Wasps",
    "title": "몰려드는 말벌",
    "description": "야수 1개 추가. 또는 야수가 있으면 탐험가 최대 2개 밀기.",
    "cost": 0,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "NO_BLIGHT",
    "terrains": [],
    "elements": [
      "FIRE",
      "AIR",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "absorb-corruption",
    "name": "Absorb Corruption",
    "title": "오염을 흡수하다",
    "description": "오염 1개 모으기 또는 에너지 1을 지불해 오염 1개 제거. 식물 2이면 둘 다 가능.",
    "cost": 1,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "EARTH",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "animated-wrackroot",
    "name": "Animated Wrackroot",
    "title": "살아 움직이는 뿌리",
    "description": "공포 1과 탐험가 1개 파괴. 또는 야생 1개 추가.",
    "cost": 0,
    "speed": "SLOW",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "FIRE",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "promises-of-protection",
    "name": "Promises of Protection",
    "title": "보호의 약속",
    "description": "다한 최대 2개 모으기. 이번 라운드 이 지역의 다한 체력 +2.",
    "cost": 0,
    "speed": "FAST",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "EARTH",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "call-to-ferocity",
    "name": "Call to Ferocity",
    "title": "사나움을 부르는 소리",
    "description": "다한 최대 3개 모으기. 또는 다한이 있으면 공포 1, 탐험가 1개와 마을 1개 밀기.",
    "cost": 0,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "INVADERS",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "EARTH"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "call-to-trade",
    "name": "Call to Trade",
    "title": "교역을 부르는 소리",
    "description": "다한 1개를 모을 수 있습니다. 공포 수준 II 이하이면 마을 1개 모으기와 이번 라운드 첫 파괴를 건설로 바꾸기.",
    "cost": 1,
    "speed": "FAST",
    "range": 2,
    "sacred": false,
    "sourceTerrain": null,
    "target": "DAHAN",
    "terrains": [],
    "elements": [
      "AIR",
      "WATER",
      "EARTH",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "confounding-mists",
    "name": "Confounding Mists",
    "title": "혼란을 일으키는 안개",
    "description": "방어 4. 또는 이번 라운드 이 지역에 추가되는 침략자를 각각 즉시 인접 지역으로 밀 수 있습니다.",
    "cost": 1,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "AIR",
      "WATER"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "cycles-of-time-and-tide",
    "name": "Cycles of Time and Tide",
    "title": "시간과 조수의 순환",
    "description": "다한이 있으면 다한 1개 추가. 없으면 오염 1개 제거.",
    "cost": 1,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "COASTAL",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "WATER"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "disorienting-landscape",
    "name": "Disorienting Landscape",
    "title": "방향을 잃게 하는 지형",
    "description": "탐험가 1개 밀기. 산/밀림이면 야생 1개 추가.",
    "cost": 1,
    "speed": "FAST",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "MOON",
      "AIR",
      "PLANT"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "elusive-ambushes",
    "name": "Elusive Ambushes",
    "title": "교묘한 매복",
    "description": "피해 1 또는 방어 4.",
    "cost": 1,
    "speed": "FAST",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "DAHAN",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "WATER"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "tormenting-rotflies",
    "name": "Tormenting Rotflies",
    "title": "괴롭히는 썩음파리",
    "description": "질병 1개 추가. 또는 침략자가 있으면 공포 2, 질병과 오염이 있으면 각각 공포 +1.",
    "cost": 1,
    "speed": "SLOW",
    "range": 2,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "SANDS",
      "WETLAND"
    ],
    "elements": [
      "AIR",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "twilight-fog-brings-madness",
    "name": "Twilight Fog brings Madness",
    "title": "황혼의 안개가 부르는 광기",
    "description": "분쟁 1개 추가. 다한 1개 밀기. 남은 다한마다 피해 1.",
    "cost": 0,
    "speed": "SLOW",
    "range": 1,
    "sacred": false,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [],
    "elements": [
      "SUN",
      "MOON",
      "AIR",
      "WATER"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "teeming-rivers",
    "name": "Teeming Rivers",
    "title": "생명으로 가득한 강",
    "description": "오염이 없으면 야수 1개 추가. 오염이 정확히 1개이면 제거.",
    "cost": 1,
    "speed": "SLOW",
    "range": 2,
    "sacred": true,
    "sourceTerrain": null,
    "target": "ANY",
    "terrains": [
      "MOUNTAIN",
      "WETLAND"
    ],
    "elements": [
      "SUN",
      "WATER",
      "PLANT",
      "ANIMAL"
    ],
    "deck": "MINOR"
  },
  {
    "expansion": "BRANCH_CLAW",
    "key": "spur-on-with-words-of-fire",
    "name": "Spur on with Words of Fire",
    "title": "불꽃의 말로 북돋우다",
    "description": "다른 정령을 대상으로 하면 에너지 1도 줍니다. 대상 정령은 비용을 지불해 손패의 능력 카드 1장을 즉시 추가 준비할 수 있습니다.",
    "cost": 1,
    "speed": "FAST",
    "range": 0,
    "sacred": false,
    "sourceTerrain": null,
    "target": "SPIRIT",
    "terrains": [],
    "elements": [
      "SUN",
      "FIRE",
      "AIR"
    ],
    "deck": "MINOR"
  }
];
