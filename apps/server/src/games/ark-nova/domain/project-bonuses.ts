import * as v from 'valibot';
import { ArkActivatedProjectBonusesSchema, ArkProjectBonusSchema, type ArkProjectBonus } from '@hangul-rummikub/shared';
import type { ArkZooEffect } from './animal-effects.js';
import type { ArkEffectBatch } from './effect-queue.js';
const recurring:readonly ArkProjectBonus[]=['SNAP_1','ENCLOSURE_2','MONEY_5','CONSERVATION_1'];
export function arkProjectBonusEffect(bonus:ArkProjectBonus):ArkZooEffect {
  switch(v.parse(ArkProjectBonusSchema,bonus)) {
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
export function arkProjectBonusIncome(activated:readonly ArkProjectBonus[]):ArkEffectBatch[] {
  return v.parse(ArkActivatedProjectBonusesSchema,activated).filter(b=>recurring.includes(b)).map(b=>({sourceId:`project-bonus:${b}`,effect:arkProjectBonusEffect(b),timing:'IMMEDIATE'}));
}
