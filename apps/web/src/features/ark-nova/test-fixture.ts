import { ArkSoloViewSchema } from '@hangul-rummikub/shared';
import { parse } from 'valibot';
/** Owner projection from the full-deck server setup; no hidden cards. */
export const arkSoloSetupFixture=parse(ArkSoloViewSchema,{
  "gameId": "ark-ui-game",
  "playerId": "ark-ui-owner",
  "revision": 0,
  "transitionId": "ark-ui-turn",
  "phase": "PLAYING",
  "startedAt": 1000,
  "finishedAt": null,
  "difficulty": "STANDARD",
  "progress": {
    "round": 1,
    "turnsCompleted": 0,
    "turnInRound": 0,
    "stage": "SETUP"
  },
  "activatedProjectBonuses": [],
  "projectSupports": [],
  "playedProjects": [],
  "associationWork": null,
  "activeAssociation": false,
  "rewards": [],
  "partners": [],
  "partnerSupply": [
    "Africa",
    "Americas",
    "Asia",
    "Australia",
    "Europe"
  ],
  "universities": [],
  "universitySupply": [
    "HAND_LIMIT",
    "RESEARCH_2",
    "RESEARCH_REPUTATION"
  ],
  "taskWorkers": {},
  "activeBuild": null,
  "buildBonuses": [],
  "repeatedAction": null,
  "extraAction": null,
  "zooWork": null,
  "played": [],
  "pouchedCounts": {},
  "sponsorTokens": {},
  "effectOptions": [],
  "activeEffect": null,
  "revealedCards": null,
  "reserveChoices": [],
  "pending": null,
  "result": null,
  "money": 25,
  "appeal": 20,
  "conservation": 0,
  "reputation": 1,
  "x": 0,
  "workers": 1,
  "busyWorkers": 0,
  "actions": [
    {
      "kind": "ANIMALS",
      "upgraded": false,
      "venom": false,
      "constriction": false,
      "multiplier": 0
    },
    {
      "kind": "CARDS",
      "upgraded": false,
      "venom": false,
      "constriction": false,
      "multiplier": 0
    },
    {
      "kind": "BUILD",
      "upgraded": false,
      "venom": false,
      "constriction": false,
      "multiplier": 0
    },
    {
      "kind": "ASSOCIATION",
      "upgraded": false,
      "venom": false,
      "constriction": false,
      "multiplier": 0
    },
    {
      "kind": "SPONSORS",
      "upgraded": false,
      "venom": false,
      "constriction": false,
      "multiplier": 0
    }
  ],
  "buildings": [
    {
      "id": "initial-kiosk",
      "kind": "KIOSK",
      "cells": [
        {
          "q": 0,
          "r": 3
        }
      ],
      "occupied": false,
      "used": 0
    },
    {
      "id": "initial-enclosure",
      "kind": "ENCLOSURE_3",
      "cells": [
        {
          "q": 0,
          "r": 4
        },
        {
          "q": 0,
          "r": 5
        },
        {
          "q": 1,
          "r": 4
        }
      ],
      "occupied": false,
      "used": 0
    }
  ],
  "hand": [
    {
      "cardId": "ark-ui-7",
      "key": "407"
    },
    {
      "cardId": "ark-ui-8",
      "key": "408"
    },
    {
      "cardId": "ark-ui-9",
      "key": "409"
    },
    {
      "cardId": "ark-ui-10",
      "key": "410"
    },
    {
      "cardId": "ark-ui-11",
      "key": "411"
    },
    {
      "cardId": "ark-ui-12",
      "key": "412"
    },
    {
      "cardId": "ark-ui-13",
      "key": "413"
    },
    {
      "cardId": "ark-ui-14",
      "key": "414"
    }
  ],
  "goals": [
    {
      "cardId": "ark-ui-213",
      "key": "001"
    },
    {
      "cardId": "ark-ui-214",
      "key": "002"
    }
  ],
  "baseProjects": [
    {
      "cardId": "ark-ui-224",
      "key": "101"
    },
    {
      "cardId": "ark-ui-225",
      "key": "102"
    },
    {
      "cardId": "ark-ui-226",
      "key": "103"
    }
  ],
  "donations": [],
  "display": [
    null,
    null,
    null,
    null,
    null,
    null
  ],
  "deckCount": 198,
  "discardCount": 0
});
