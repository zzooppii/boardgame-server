import type { MarsEffect } from './catalog.js';

// Original Prelude (35 cards), printed facts and independently authored effects.
export const MARS_PRELUDE_FACTS = [
  {
    "id": "AlliedBanks",
    "name": "은행 연합",
    "englishName": "Allied Banks",
    "number": "P01",
    "tags": [
      "earth"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": 4
      },
      {
        "kind": "stock",
        "resource": "money",
        "amount": 3
      }
    ]
  },
  {
    "id": "AquiferTurbines",
    "name": "대수층 수력터빈",
    "englishName": "Aquifer Turbines",
    "number": "P02",
    "tags": [
      "power"
    ],
    "effects": [
      {
        "kind": "pay",
        "amount": 3,
        "material": "none"
      },
      {
        "kind": "place",
        "tile": "ocean",
        "rule": "normal"
      },
      {
        "kind": "production",
        "resource": "energy",
        "amount": 2
      }
    ]
  },
  {
    "id": "Biofuels",
    "name": "바이오 연료",
    "englishName": "Biofuels",
    "number": "P03",
    "tags": [
      "microbe"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "energy",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "stock",
        "resource": "plants",
        "amount": 2
      }
    ]
  },
  {
    "id": "Biolab",
    "name": "생명공학실험실",
    "englishName": "Biolab",
    "number": "P04",
    "tags": [
      "science"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "draw",
        "amount": 3
      }
    ]
  },
  {
    "id": "BiosphereSupport",
    "name": "생물권 유지시설",
    "englishName": "Biosphere Support",
    "number": "P05",
    "tags": [
      "plant"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": -1
      },
      {
        "kind": "production",
        "resource": "plants",
        "amount": 2
      }
    ]
  },
  {
    "id": "BusinessEmpire",
    "name": "재벌",
    "englishName": "Business Empire",
    "number": "P06",
    "tags": [
      "earth"
    ],
    "effects": [
      {
        "kind": "pay",
        "amount": 6,
        "material": "none"
      },
      {
        "kind": "production",
        "resource": "money",
        "amount": 6
      }
    ]
  },
  {
    "id": "DomeFarming",
    "name": "돔 농장",
    "englishName": "Dome Farming",
    "number": "P07",
    "tags": [
      "plant",
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": 2
      },
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      }
    ]
  },
  {
    "id": "Donation",
    "name": "기부금",
    "englishName": "Donation",
    "number": "P08",
    "tags": [],
    "effects": [
      {
        "kind": "stock",
        "resource": "money",
        "amount": 21
      }
    ]
  },
  {
    "id": "EarlySettlement",
    "name": "초기 정착지",
    "englishName": "Early Settlement",
    "number": "P09",
    "tags": [
      "building",
      "city"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "place",
        "tile": "city",
        "rule": "normal"
      }
    ]
  },
  {
    "id": "EcologyExperts",
    "name": "생태학 전문가 그룹",
    "englishName": "Ecology Experts",
    "number": "P10",
    "tags": [
      "plant",
      "microbe"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "instantProject",
        "discount": 0,
        "ignoreGlobal": true
      }
    ]
  },
  {
    "id": "EccentricSponsor",
    "name": "괴짜 후원자",
    "englishName": "Eccentric Sponsor",
    "number": "P11",
    "tags": [],
    "effects": [
      {
        "kind": "instantProject",
        "discount": 25,
        "ignoreGlobal": false
      }
    ]
  },
  {
    "id": "ExperimentalForest",
    "name": "시험림",
    "englishName": "Experimental Forest",
    "number": "P12",
    "tags": [
      "plant"
    ],
    "effects": [
      {
        "kind": "place",
        "tile": "greenery",
        "rule": "normal"
      },
      {
        "kind": "drawTag",
        "tag": "plant",
        "amount": 2
      }
    ]
  },
  {
    "id": "GalileanMining",
    "name": "갈릴레이 위성 채굴시설",
    "englishName": "Galilean Mining",
    "number": "P13",
    "tags": [
      "jovian"
    ],
    "effects": [
      {
        "kind": "pay",
        "amount": 5,
        "material": "none"
      },
      {
        "kind": "production",
        "resource": "titanium",
        "amount": 2
      }
    ]
  },
  {
    "id": "GreatAquifer",
    "name": "대규모 대수층",
    "englishName": "Great Aquifer",
    "number": "P14",
    "tags": [],
    "effects": [
      {
        "kind": "place",
        "tile": "ocean",
        "rule": "normal"
      },
      {
        "kind": "place",
        "tile": "ocean",
        "rule": "normal"
      }
    ]
  },
  {
    "id": "HugeAsteroid",
    "name": "초대형 소행성",
    "englishName": "Huge Asteroid",
    "number": "P15",
    "tags": [],
    "effects": [
      {
        "kind": "pay",
        "amount": 5,
        "material": "none"
      },
      {
        "kind": "global",
        "track": "temperature",
        "amount": 3
      }
    ]
  },
  {
    "id": "IoResearchOutpost",
    "name": "이오 연구 전진기지",
    "englishName": "Io Research Outpost",
    "number": "P16",
    "tags": [
      "jovian",
      "science"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "titanium",
        "amount": 1
      },
      {
        "kind": "draw",
        "amount": 1
      }
    ]
  },
  {
    "id": "Loan",
    "name": "대출",
    "englishName": "Loan",
    "number": "P17",
    "tags": [],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": -2
      },
      {
        "kind": "stock",
        "resource": "money",
        "amount": 30
      }
    ]
  },
  {
    "id": "MartianIndustries",
    "name": "화성 공업단지",
    "englishName": "Martian Industries",
    "number": "P18",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "energy",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "steel",
        "amount": 1
      },
      {
        "kind": "stock",
        "resource": "money",
        "amount": 6
      }
    ]
  },
  {
    "id": "MetalRichAsteroid",
    "name": "다금속 소행성",
    "englishName": "Metal Rich Asteroid",
    "number": "P19",
    "tags": [],
    "effects": [
      {
        "kind": "global",
        "track": "temperature",
        "amount": 1
      },
      {
        "kind": "stock",
        "resource": "titanium",
        "amount": 4
      },
      {
        "kind": "stock",
        "resource": "steel",
        "amount": 4
      }
    ]
  },
  {
    "id": "MetalsCompany",
    "name": "철강 회사",
    "englishName": "Metals Company",
    "number": "P20",
    "tags": [],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "steel",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "titanium",
        "amount": 1
      }
    ]
  },
  {
    "id": "MiningOperations",
    "name": "채굴 시설",
    "englishName": "Mining Operations",
    "number": "P21",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "steel",
        "amount": 2
      },
      {
        "kind": "stock",
        "resource": "steel",
        "amount": 4
      }
    ]
  },
  {
    "id": "Mohole",
    "name": "모홀 프로젝트",
    "englishName": "Mohole",
    "number": "P22",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "heat",
        "amount": 3
      },
      {
        "kind": "stock",
        "resource": "heat",
        "amount": 3
      }
    ]
  },
  {
    "id": "MoholeExcavation",
    "name": "모홀 시추 시설",
    "englishName": "Mohole Excavation",
    "number": "P23",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "steel",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "heat",
        "amount": 2
      },
      {
        "kind": "stock",
        "resource": "heat",
        "amount": 2
      }
    ]
  },
  {
    "id": "NitrogenShipment",
    "name": "질소 수송",
    "englishName": "Nitrogen Shipment",
    "number": "P24",
    "tags": [],
    "effects": [
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "global",
        "track": "tr",
        "amount": 1
      },
      {
        "kind": "stock",
        "resource": "money",
        "amount": 5
      }
    ]
  },
  {
    "id": "OrbitalConstructionYard",
    "name": "궤도 조선소",
    "englishName": "Orbital Construction Yard",
    "number": "P25",
    "tags": [
      "space"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "titanium",
        "amount": 1
      },
      {
        "kind": "stock",
        "resource": "titanium",
        "amount": 4
      }
    ]
  },
  {
    "id": "PolarIndustries",
    "name": "극지 공업단지",
    "englishName": "Polar Industries",
    "number": "P26",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "heat",
        "amount": 2
      },
      {
        "kind": "place",
        "tile": "ocean",
        "rule": "normal"
      }
    ]
  },
  {
    "id": "PowerGeneration",
    "name": "발전 시설",
    "englishName": "Power Generation",
    "number": "P27",
    "tags": [
      "power"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "energy",
        "amount": 3
      }
    ]
  },
  {
    "id": "ResearchNetwork",
    "name": "연구 네트워크",
    "englishName": "Research Network",
    "number": "P28",
    "tags": [
      "wild"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": 1
      },
      {
        "kind": "draw",
        "amount": 3
      }
    ]
  },
  {
    "id": "SelfSufficientSettlement",
    "name": "자급자족형 정착지",
    "englishName": "Self-sufficient Settlement",
    "number": "P29",
    "tags": [
      "building",
      "city"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": 2
      },
      {
        "kind": "place",
        "tile": "city",
        "rule": "normal"
      }
    ]
  },
  {
    "id": "SmeltingPlant",
    "name": "제련 시설",
    "englishName": "Smelting Plant",
    "number": "P30",
    "tags": [
      "building"
    ],
    "effects": [
      {
        "kind": "global",
        "track": "oxygen",
        "amount": 2
      },
      {
        "kind": "stock",
        "resource": "steel",
        "amount": 5
      }
    ]
  },
  {
    "id": "SocietySupport",
    "name": "사회적 지원",
    "englishName": "Society Support",
    "number": "P31",
    "tags": [],
    "effects": [
      {
        "kind": "production",
        "resource": "money",
        "amount": -1
      },
      {
        "kind": "production",
        "resource": "plants",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "energy",
        "amount": 1
      },
      {
        "kind": "production",
        "resource": "heat",
        "amount": 1
      }
    ]
  },
  {
    "id": "Supplier",
    "name": "납품업체",
    "englishName": "Supplier",
    "number": "P32",
    "tags": [
      "power"
    ],
    "effects": [
      {
        "kind": "production",
        "resource": "energy",
        "amount": 2
      },
      {
        "kind": "stock",
        "resource": "steel",
        "amount": 4
      }
    ]
  },
  {
    "id": "SupplyDrop",
    "name": "보급품 투하",
    "englishName": "Supply Drop",
    "number": "P33",
    "tags": [],
    "effects": [
      {
        "kind": "stock",
        "resource": "titanium",
        "amount": 3
      },
      {
        "kind": "stock",
        "resource": "steel",
        "amount": 8
      },
      {
        "kind": "stock",
        "resource": "plants",
        "amount": 3
      }
    ]
  },
  {
    "id": "UNMIContractor",
    "name": "UNMI 도급 계약",
    "englishName": "UNMI Contractor",
    "number": "P34",
    "tags": [
      "earth"
    ],
    "effects": [
      {
        "kind": "global",
        "track": "tr",
        "amount": 3
      },
      {
        "kind": "draw",
        "amount": 1
      }
    ]
  },
  {
    "id": "AcquiredSpaceAgency",
    "name": "항공우주국 합병",
    "englishName": "Acquired Space Agency",
    "number": "P35",
    "tags": [],
    "effects": [
      {
        "kind": "stock",
        "resource": "titanium",
        "amount": 6
      },
      {
        "kind": "drawTag",
        "tag": "space",
        "amount": 2
      }
    ]
  }
] as const satisfies readonly {id:string;name:string;englishName:string;number:string;tags:readonly string[];effects:readonly MarsEffect[]}[];

export const MARS_PRELUDE_PROJECT_FACTS = [
 {id:'HousePrinting',name:'주택 3D 프린팅',englishName:'House Printing',number:'P36',cost:10,tags:['building'],points:1,effects:[{kind:'production',resource:'steel',amount:1}]},
 {id:'LavaTubeSettlement',name:'용암동굴 정착지',englishName:'Lava Tube Settlement',number:'P37',cost:15,tags:['building','city'],effects:[{kind:'production',resource:'energy',amount:-1},{kind:'production',resource:'money',amount:2},{kind:'place',tile:'city',rule:'volcano'}]},
 {id:'MartianSurvey',name:'화성 측량',englishName:'Martian Survey',number:'P38',cost:9,tags:['science'],type:'event',points:1,requirements:[{kind:'oxygen',amount:4,max:true}],effects:[{kind:'draw',amount:2}]},
 {id:'Psychrophiles',name:'호냉성 미생물',englishName:'Psychrophiles',number:'P39',cost:2,tags:['microbe'],type:'active',resource:'microbe',requirements:[{kind:'temperature',amount:-20,max:true}],effects:[],actions:[{kind:'add',resource:'microbe',amount:1,self:true}],passive:'식물 태그 프로젝트 지불에 이 카드의 미생물을 개당 2 M€로 사용 가능'},
 {id:'ResearchCoordination',name:'연구 조직화',englishName:'Research Coordination',number:'P40',cost:4,tags:['wild'],effects:[],passive:'행동할 때 와일드 태그를 원하는 태그로 사용. 태그 반응·기업상·종료 점수에는 제외'},
 {id:'SFMemorial',name:'SF 거장 기념비',englishName:'SF Memorial',number:'P41',cost:7,tags:['building'],points:1,effects:[{kind:'draw',amount:1}]},
 {id:'SpaceHotels',name:'우주 호텔',englishName:'Space Hotels',number:'P42',cost:12,tags:['space','earth'],requirements:[{kind:'earth',amount:2,max:false}],effects:[{kind:'production',resource:'money',amount:4}]},
] as const satisfies readonly {id:string;name:string;englishName:string;number:string;cost:number;tags:readonly string[];points?:number;type?:string;resource?:string;requirements?:readonly {kind:string;amount:number;max:boolean}[];effects:readonly MarsEffect[];actions?:readonly MarsEffect[];passive?:string}[];

export const MARS_PRELUDE_CORPORATIONS = [
 {id:'CheungShingMARS',name:'쳉 싱 마스',money:44,tags:['building'],art:0,text:'M€ 생산 +3. 건물 태그 1개당 프로젝트 비용 2 M€ 할인'},
 {id:'PointLuna',name:'포인트 루나',money:38,tags:['space','earth'],art:5,text:'티타늄 생산 +1. 지구 태그를 낼 때마다 카드 1장 획득. 자기 기업 태그 포함'},
 {id:'RobinsonIndustries',name:'로빈슨 인더스트리',money:47,tags:[],art:4,text:'행동: M€ 4를 지불하고 가장 낮은 생산량 중 하나 +1 (세대당 1회)'},
 {id:'ValleyTrust',name:'밸리 트러스트',money:37,tags:['earth'],art:11,text:'첫 행동: 프렐류드 3장 중 1장 실행. 과학 태그 1개당 프로젝트 비용 2 M€ 할인'},
 {id:'Vitor',name:'비토르',money:48,tags:['earth'],art:10,text:'시작 M€ 45와 자기 기업 보상 3. 첫 행동: 기업상 무료 후원. 양수 또는 변동 VP가 있는 카드 실행 시 M€ 3 획득'},
] as const;
