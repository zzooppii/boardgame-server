/** Base animal card facts transcribed against card photographs; see docs/HARMONIES_GAME_RULES.md. */
export const HARMONIES_COLORS = ['WATER', 'STONE', 'WOOD', 'LEAF', 'FIELD', 'RED'] as const;
export type HarmoniesColor = typeof HARMONIES_COLORS[number];
export const HARMONIES_COLOR_NAMES: Record<HarmoniesColor, string> = { WATER: '물', STONE: '돌', WOOD: '나무줄기', LEAF: '나뭇잎', FIELD: '들판', RED: '건물' };
export const HARMONIES_INVENTORY: Record<HarmoniesColor, number> = { WATER: 23, STONE: 23, WOOD: 21, LEAF: 19, FIELD: 19, RED: 15 };
export type HarmoniesPatternCell = { q: number; r: number; stack: readonly (HarmoniesColor | 'BUILDING')[]; animal: boolean };
export type HarmoniesAnimal = { id: number; name: string; points: readonly number[]; pattern: readonly HarmoniesPatternCell[] };
export const HARMONIES_ANIMALS: readonly HarmoniesAnimal[] = [
  {
    "id": 1,
    "name": "악어",
    "points": [
      4,
      9,
      15
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 2,
    "name": "가오리",
    "points": [
      4,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 3,
    "name": "영원",
    "points": [
      3,
      6,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "STONE",
          "STONE",
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 4,
    "name": "해달",
    "points": [
      5,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 5,
    "name": "개구리",
    "points": [
      2,
      4,
      6,
      10,
      15
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 6,
    "name": "오리",
    "points": [
      2,
      4,
      8,
      13
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 7,
    "name": "홍학",
    "points": [
      4,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "FIELD"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 8,
    "name": "도마뱀",
    "points": [
      5,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 9,
    "name": "들쥐",
    "points": [
      5,
      10,
      17
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "BUILDING"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "FIELD"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 10,
    "name": "공작",
    "points": [
      5,
      10,
      17
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "BUILDING"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 11,
    "name": "다람쥐",
    "points": [
      4,
      9,
      15
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 12,
    "name": "고슴도치",
    "points": [
      5,
      12
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 13,
    "name": "꿀벌",
    "points": [
      8,
      18
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "FIELD"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 14,
    "name": "불곰",
    "points": [
      5,
      11
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "STONE",
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "STONE",
          "STONE"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 15,
    "name": "산토끼",
    "points": [
      5,
      10,
      17
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 16,
    "name": "금강앵무",
    "points": [
      4,
      9,
      14
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 17,
    "name": "멧돼지",
    "points": [
      4,
      8,
      13
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 18,
    "name": "코알라",
    "points": [
      3,
      6,
      10,
      15
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 19,
    "name": "늑대",
    "points": [
      4,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WOOD",
          "WOOD",
          "LEAF"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "FIELD"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 20,
    "name": "물총새",
    "points": [
      5,
      11,
      18
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "WOOD",
          "WOOD",
          "LEAF"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 21,
    "name": "펭귄",
    "points": [
      4,
      10,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "STONE"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 22,
    "name": "박쥐",
    "points": [
      3,
      6,
      10,
      15
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "STONE"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 23,
    "name": "사막여우",
    "points": [
      4,
      9,
      16
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "STONE"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 24,
    "name": "일본원숭이",
    "points": [
      5,
      11
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "STONE",
          "STONE"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 25,
    "name": "수염수리",
    "points": [
      5,
      11
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "STONE",
          "STONE",
          "STONE"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 26,
    "name": "미어캣",
    "points": [
      2,
      5,
      9,
      14
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "STONE"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 27,
    "name": "까마귀",
    "points": [
      4,
      9
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "BUILDING"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "FIELD"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "BUILDING"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 28,
    "name": "라마",
    "points": [
      5,
      12
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "STONE",
          "STONE"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 29,
    "name": "백로",
    "points": [
      5,
      10,
      17
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "FIELD"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 30,
    "name": "너구리",
    "points": [
      6,
      12
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": 0,
        "r": -1,
        "stack": [
          "FIELD"
        ],
        "animal": true
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WATER"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": -1,
        "stack": [
          "WATER"
        ],
        "animal": false
      }
    ]
  },
  {
    "id": 31,
    "name": "무당벌레",
    "points": [
      2,
      5,
      8,
      12,
      17
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": true
      }
    ]
  },
  {
    "id": 32,
    "name": "고양이",
    "points": [
      5,
      11
    ],
    "pattern": [
      {
        "q": 0,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -1,
        "r": 0,
        "stack": [
          "WOOD",
          "LEAF"
        ],
        "animal": false
      },
      {
        "q": -2,
        "r": 0,
        "stack": [
          "FIELD"
        ],
        "animal": true
      }
    ]
  }
];
export function harmoniesAnimal(id: number): HarmoniesAnimal {
  const card = HARMONIES_ANIMALS.find(c => c.id === id);
  if (!card) throw new Error('Unknown Harmonies animal.');
  return card;
}
