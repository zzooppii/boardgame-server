import {parse} from 'valibot';
import {SpeakeasyBoardViewSchema, type SpeakeasyBoardView} from '@hangul-rummikub/shared';

/** Fixed display fixture projected from the server's synthetic economy; never official setup. */
export function createSpeakeasyBoardPreview():SpeakeasyBoardView {
  return parse(SpeakeasyBoardViewSchema,{
  "ports": [], "ships": [], "turn": {
    "locationActions": null,
    "gameId": "speakeasy-board-preview",
    "revision": 0,
    "viewerId": "sp-player-a",
    "act": 1,
    "round": 1,
    "stage": "PLACE_CAPO",
    "actorId": "sp-player-a",
    "order": [
      "sp-player-a",
      "sp-player-b"
    ],
    "lowerRow": [
      null,
      null
    ],
    "spaces": [
      {
        "id": "preview-restaurant",
        "location": "RESTAURANT",
        "occupants": []
      }
    ],
    "active": null,
    "restaurant": null,
    "market": {
      "middle": [
        {
          "count": 0,
          "top": null
        },
        {
          "count": 0,
          "top": null
        },
        {
          "count": 0,
          "top": null
        }
      ],
      "right": [
        null,
        null,
        null
      ],
      "supplyCounts": [
        0,
        0,
        0
      ]
    },
    "self": {
      "cash": 15,
      "safe": 30,
      "availableCapos": [
        "preview-capo-0-0",
        "preview-capo-0-1",
        "preview-capo-0-2",
        "preview-capo-0-3"
      ],
      "hand": [
        {
          "tileId": "hand-0-0",
          "operation": "PARTY",
          "leverage": 1
        },
        {
          "tileId": "hand-0-1",
          "operation": "PARTY",
          "leverage": 1
        },
        {
          "tileId": "hand-0-2",
          "operation": "PARTY",
          "leverage": 1
        },
        {
          "tileId": "hand-0-3",
          "operation": "PARTY",
          "leverage": 1
        }
      ],
      "cityTiles": [],
      "drawDecks": [],
      "returnCount": 0,
      "mandatoryReturnIds": [],
      "eligibleReturnIds": [],
      "firstReturnRows": []
    }
  },
  "districts": [
    {
      "id": 1,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 2,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 3,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        {
          "tileId": "bar-0-0",
          "ownerId": "sp-player-a",
          "kind": "SPEAKEASY",
          "protected": true,
          "barrel": true,
          "operating": true
        }
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 4,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 5,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 6,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 7,
      "blocked": false,
      "cop": false,
      "slots": [
        {
          "tileId": "stills-0",
          "ownerId": "sp-player-a",
          "kind": "STILLS",
          "protected": false,
          "barrel": false,
          "operating": true
        },
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 8,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 9,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [
        1
      ],
      "mobsterStrength": 3
    },
    {
      "id": 10,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 11,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 12,
      "blocked": false,
      "cop": true,
      "slots": [
        {
          "tileId": "bar-0-1",
          "ownerId": "sp-player-a",
          "kind": "SPEAKEASY",
          "protected": false,
          "barrel": true,
          "operating": false
        },
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 13,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 14,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        {
          "tileId": "casino-1-0",
          "ownerId": "sp-player-b",
          "kind": "CASINO",
          "protected": true,
          "barrel": false,
          "operating": true
        }
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 15,
      "blocked": false,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    },
    {
      "id": 16,
      "blocked": true,
      "cop": false,
      "slots": [
        null,
        null
      ],
      "mobsterSlots": [],
      "mobsterStrength": null
    }
  ],
  "trucks": [
    {
      "tileId": "truck-0-0",
      "ownerId": "sp-player-a",
      "district": 3,
      "load": 2
    }
  ],
  "docks": [
    {
      "ownerId": "sp-player-a",
      "zone": 0,
      "space": 1
    }
  ],
  "placedBooks": [
    {
      "ownerId": "sp-player-a",
      "goalId": "preview-goal",
      "space": 0
    }
  ],
  "self": {
    "fixedGoals": [
      {
        "id": "fixed:docks:1",
        "kind": "CRATES",
        "minimum": 1,
        "progress": 0,
        "payout": 15,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:docks:2",
        "kind": "CRATES",
        "minimum": 2,
        "progress": 0,
        "payout": 15,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:docks:3",
        "kind": "CRATES",
        "minimum": 3,
        "progress": 0,
        "payout": 15,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:city-hall:3",
        "kind": "PROTECTED_DISTRICTS",
        "minimum": 3,
        "progress": 1,
        "payout": 20,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:city-hall:5",
        "kind": "PROTECTED_DISTRICTS",
        "minimum": 5,
        "progress": 1,
        "payout": 20,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:city-hall:7",
        "kind": "PROTECTED_DISTRICTS",
        "minimum": 7,
        "progress": 1,
        "payout": 20,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:infamy:10",
        "kind": "INFAMY",
        "minimum": 10,
        "progress": 12,
        "payout": 10,
        "spaces": [
          null,
          null
        ],
        "status": "BOOK_ACTION_REQUIRED"
      },
      {
        "id": "fixed:infamy:15",
        "kind": "INFAMY",
        "minimum": 15,
        "progress": 12,
        "payout": 15,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      },
      {
        "id": "fixed:infamy:22",
        "kind": "INFAMY",
        "minimum": 22,
        "progress": 12,
        "payout": 20,
        "spaces": [
          null,
          null
        ],
        "status": "REQUIREMENT"
      }
    ],
    "levels": {
      "VIP": 2,
      "PARTY": 2,
      "STILLS": 2,
      "FLEET": 3,
      "STRENGTH": 3
    },
    "leverageTokens": 2,
    "operations": [
      {
        "tileId": "installed-0",
        "operation": "VIP",
        "leverage": 3
      }
    ],
    "reserves": [
      {
        "tileId": "bar-0-2",
        "kind": "SPEAKEASY",
        "cost": 3,
        "group": 0
      },
      {
        "tileId": "bar-0-3",
        "kind": "SPEAKEASY",
        "cost": 5,
        "group": 1
      },
      {
        "tileId": "bar-0-4",
        "kind": "SPEAKEASY",
        "cost": 5,
        "group": 1
      },
      {
        "tileId": "bar-0-5",
        "kind": "SPEAKEASY",
        "cost": 8,
        "group": 2
      },
      {
        "tileId": "bar-0-6",
        "kind": "SPEAKEASY",
        "cost": 8,
        "group": 2
      },
      {
        "tileId": "bar-0-7",
        "kind": "SPEAKEASY",
        "cost": 8,
        "group": 2
      },
      {
        "tileId": "club-0-0",
        "kind": "NIGHTCLUB",
        "cost": 12,
        "group": null
      },
      {
        "tileId": "casino-0-0",
        "kind": "CASINO",
        "cost": 17,
        "group": null
      },
      {
        "tileId": "club-0-1",
        "kind": "NIGHTCLUB",
        "cost": 12,
        "group": null
      },
      {
        "tileId": "casino-0-1",
        "kind": "CASINO",
        "cost": 17,
        "group": null
      },
      {
        "tileId": "club-0-2",
        "kind": "NIGHTCLUB",
        "cost": 12,
        "group": null
      },
      {
        "tileId": "casino-0-2",
        "kind": "CASINO",
        "cost": 17,
        "group": null
      }
    ],
    "vip": 1,
    "familyReserve": 9,
    "goons": 1,
    "stock": [
      "barrel-35"
    ],
    "trucks": [
      {
        "tileId": "truck-0-0",
        "district": 3,
        "barrels": [
          "barrel-37",
          "barrel-36"
        ]
      },
      {
        "tileId": "truck-0-1",
        "district": null,
        "barrels": []
      }
    ],
    "books": 2,
    "bookReserve": 7,
    "crates": [],
    "helpers": [],
    "associate": null
  },
  "luciano": null,
  "result": null
});
}
