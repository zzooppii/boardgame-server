import {ARK_ACTIONS,type ArkActionCard,type ArkEffectGuide} from '@hangul-rummikub/shared';
import type {ArkZooEffect} from './animal-effects.js';
import type {ArkConservationBonusPool} from './conservation-bonuses.js';
/** Explicit public fields only: no executable expression, queue frames or unrevealed cards. */
export function projectArkEffectGuide(effect:ArkZooEffect,actions:readonly ArkActionCard[],pool:ArkConservationBonusPool):ArkEffectGuide {
  const choices:ArkEffectGuide['actions']=effect.kind==='UPGRADE'||effect.kind==='UPGRADE_OR_WORKER'?
    (actions.filter(a=>a.upgraded).length>=4?[]:actions.filter(a=>!a.upgraded).map(a=>a.kind)):
    effect.kind==='EXTRA_ACTION'||effect.kind==='MULTIPLIER'||effect.kind==='MOVE_ACTION'?
      (effect.action?[effect.action]:effect.kind==='EXTRA_ACTION'?[...ARK_ACTIONS,'TAKE_X']:[...ARK_ACTIONS]):[];
  return {resource:effect.kind==='GAIN'?effect.resource:null,amount:'amount' in effect&&typeof effect.amount==='number'?effect.amount:null,actions:choices,
    buildings:effect.kind==='FREE_BUILD'?[...effect.buildings]:[],slots:effect.kind==='MOVE_ACTION'?[...effect.slots]:[],
    mayRefill:effect.kind==='SNAP'&&effect.mayRefillBetween&&effect.amount>1,
    bonuses:effect.kind==='CONSERVATION_BONUS'?pool.filter(b=>b.track===effect.track).map(b=>b.tile):[]};
}
