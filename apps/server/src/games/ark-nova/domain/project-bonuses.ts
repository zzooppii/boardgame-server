import {ARK_MAP_LAYOUTS,type ArkMapId} from '@hangul-rummikub/shared';
import * as v from 'valibot';
import { ArkActivatedProjectBonusesSchema, type ArkProjectBonus } from '@hangul-rummikub/shared';
import type { ArkZooEffect } from './animal-effects.js';
import type { ArkEffectBatch } from './effect-queue.js';
export function arkProjectBonusEffect(bonus:ArkProjectBonus):ArkZooEffect {
  switch(bonus) {
    case 'WORKER':return {kind:'GAIN',resource:'WORKER',amount:1};
    case 'APPEAL_2':return {kind:'GAIN',resource:'APPEAL',amount:2};
    case 'PAID_SPONSOR':return {kind:'PAID_SPONSOR',usesSponsorToken:false};
    case 'UPGRADE':case 'FREE_UNIVERSITY':case 'FREE_PARTNER':case 'MOVE_1_TWICE':return {kind:bonus};
    case 'SPECIAL_ENCLOSURE':return {kind:'FREE_BUILD',buildings:['ReptileHouse','LargeBirdAviary'],amount:1,ignoreBuildUpgrade:true};
    case 'SNAP_1':return {kind:'SNAP',amount:1,mayRefillBetween:false};
    case 'ENCLOSURE_2':return {kind:'FREE_BUILD',buildings:['ENCLOSURE_2'],amount:1,ignoreBuildUpgrade:false};
    case 'MONEY_5':return {kind:'GAIN',resource:'MONEY',amount:5};
    case 'CONSERVATION_1':return {kind:'GAIN',resource:'CONSERVATION',amount:1};
    case 'REPUTATION_2':return {kind:'GAIN',resource:'REPUTATION',amount:2};
    case 'MONEY_12':return {kind:'GAIN',resource:'MONEY',amount:12};
    case 'X_3':return {kind:'GAIN',resource:'X',amount:3};
  }
}
/** Purple spaces pay at activation and at each subsequent income; yellow spaces pay only once. */
export function arkProjectBonusIncome(activated:readonly ArkProjectBonus[],mapId:ArkMapId='A'):ArkEffectBatch[] {
  return v.parse(ArkActivatedProjectBonusesSchema,activated).filter(b=>['SNAP_1','ENCLOSURE_2','MONEY_5'].includes(b)||ARK_MAP_LAYOUTS[mapId].recurring&&b===ARK_MAP_LAYOUTS[mapId].project).map(b=>({sourceId:`project-bonus:${b}`,effect:arkProjectBonusEffect(b),timing:'IMMEDIATE'}));
}
