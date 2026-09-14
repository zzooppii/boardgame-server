import * as v from 'valibot';
import { ArkCountSchema } from '@hangul-rummikub/shared';
import type { RandomSource } from '../../../ports/system.js';
import type { ArkZooEffect } from './animal-effects.js';
export const ARK_BASE_BONUS_TILES=['REPUTATION_2','X_3','ENCLOSURE_3','CARDS_3','MONEY_10','MULTIPLIER','UNIVERSITY','PARTNER','PAID_SPONSOR'] as const;
export const ArkBonusTileSchema=v.picklist(ARK_BASE_BONUS_TILES);
export type ArkBonusTile=v.InferOutput<typeof ArkBonusTileSchema>;
export const ArkConservationBonusPoolSchema=v.pipe(v.array(v.strictObject({tile:ArkBonusTileSchema,track:v.picklist([5,8])})),v.maxLength(4),v.check(xs=>new Set(xs.map(x=>x.tile)).size===xs.length&&[5,8].every(track=>xs.filter(x=>x.track===track).length<=2)));
export type ArkConservationBonusPool=v.InferOutput<typeof ArkConservationBonusPoolSchema>;
export function createArkConservationBonuses(random:RandomSource):ArkConservationBonusPool {
  const tiles:ArkBonusTile[]=[...ARK_BASE_BONUS_TILES];
  for(let i=tiles.length-1;i>0;i--){const j=random.nextInt(i+1);if(!Number.isSafeInteger(j)||j<0||j>i)throw new Error('Invalid random index.');[tiles[i],tiles[j]]=[tiles[j]!,tiles[i]!];}
  return tiles.slice(0,4).map((tile,i)=>({tile,track:i<2?5:8}));
}
/** Called on actual score movement, never on an uncommitted client-selected amount. */
export function arkConservationAdvance(before:number,amount:number):{conservation:number;milestones:(2|5|8|10)[]} {
  v.parse(v.pipe(ArkCountSchema,v.maxValue(41)),before);v.parse(ArkCountSchema,amount);
  const conservation=Math.min(41,before+amount);
  return {conservation,milestones:([2,5,8,10] as const).filter(n=>before<n&&conservation>=n)};
}
export function chooseArkConservationBonus(current:ArkConservationBonusPool,track:5|8,tile:ArkBonusTile|null):
  {ok:true;pool:ArkConservationBonusPool;effect:ArkZooEffect}|{ok:false} {
  const pool=v.parse(ArkConservationBonusPoolSchema,current);
  if(track!==5&&track!==8)return {ok:false};
  if(tile===null)return {ok:true,pool,effect:{kind:'GAIN',resource:'MONEY',amount:5}};
  if(!pool.some(t=>t.track===track&&t.tile===tile))return {ok:false};
  let effect:ArkZooEffect;
  switch(tile) {
    case 'REPUTATION_2':effect={kind:'GAIN',resource:'REPUTATION',amount:2};break;
    case 'X_3':effect={kind:'GAIN',resource:'X',amount:3};break;
    case 'ENCLOSURE_3':effect={kind:'FREE_BUILD',buildings:['ENCLOSURE_3'],amount:1,ignoreBuildUpgrade:false};break;
    case 'CARDS_3':effect={kind:'CARD_PICK',amount:3};break;
    case 'MONEY_10':effect={kind:'GAIN',resource:'MONEY',amount:10};break;
    case 'MULTIPLIER':effect={kind:'MULTIPLIER',action:null};break;
    case 'UNIVERSITY':effect={kind:'FREE_UNIVERSITY'};break;
    case 'PARTNER':effect={kind:'FREE_PARTNER'};break;
    case 'PAID_SPONSOR':effect={kind:'PAID_SPONSOR',usesSponsorToken:false};break;
  }
  return {ok:true,pool:pool.filter(t=>t.tile!==tile),effect};
}
