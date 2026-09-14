import { arkSoloCardAbilities, type ArkActionKind, type ArkCardDefinition } from '@hangul-rummikub/shared';
import type { ArkZooIcons } from './zoo-icons.js';
export type ArkEffectAmount=number|{kind:'ICONS';tag:string;factor:number;cap:number}|{kind:'THRESHOLDS';tag:string;thresholds:readonly number[]};
export type ArkZooEffect=
  | {kind:'WAZA_PLAY';upgraded:boolean}
  | {kind:'WAZA_SNAP'}
  | {kind:'GAIN';resource:'APPEAL'|'CONSERVATION'|'REPUTATION'|'MONEY'|'X'|'WORKER';amount:ArkEffectAmount}
  | {kind:'DRAW'|'HUNTER'|'DIGGING'|'SCAVENGING'|'CARD_PICK'|'SUNBATHING'|'POUCH';amount:number}
  | {kind:'PERCEPTION';amount:number;keep:number}
  | {kind:'SNAP';amount:number;mayRefillBetween:boolean}
  | {kind:'MOVE_ACTION';action:ArkActionKind|null;slots:readonly (1|5)[]}
  | {kind:'EXTRA_ACTION';action:ArkActionKind|null}
  | {kind:'MULTIPLIER';action:ArkActionKind|null}
  | {kind:'FREE_BUILD';buildings:readonly string[];amount:number;ignoreBuildUpgrade:boolean}
  | {kind:'MOVE_TO_SPECIAL';buildingId:string;moved:readonly string[]}
  | {kind:'SPONSOR_TOKENS';amount:number}
  | {kind:'WAZA_FOCUS'|'FREE_PARTNER'|'FREE_UNIVERSITY'|'ARCHAEOLOGIST'}
  | {kind:'PAID_SPONSOR';usesSponsorToken:boolean}
  | {kind:'UPGRADE'|'UPGRADE_OR_WORKER'|'DISCARD_GOAL'}
  | {kind:'CONSERVATION_BONUS';track:5|8}
  | {kind:'RESISTANCE'|'ASSERTION'|'DOMINANCE'|'SPONSOR_MAGNET'};
export type ArkPlannedEffects={immediate:ArkZooEffect[];afterFinishing:ArkZooEffect[]};
const ACTION_SUFFIX:Readonly<Record<string,ArkActionKind>>={ANIMAL:'ANIMALS',ANIMALS:'ANIMALS',ASSOCIATION:'ASSOCIATION',BUILD:'BUILD',BUILDING:'BUILD',CARD:'CARDS',CARDS:'CARDS',SPONSORS:'SPONSORS'};
export function evaluateArkEffectAmount(amount:ArkEffectAmount,icons:ArkZooIcons):number {
  if (typeof amount==='number') return amount;
  if (amount.kind==='ICONS') return Math.min(amount.cap,(icons[amount.tag]??0)*amount.factor);
  return amount.thresholds.filter(t=>(icons[amount.tag]??0)>=t).length;
}
/** Keep effects separate: the owner selects simultaneous order, and dynamic icon amounts resolve at execution time. */
export function planArkAnimalEffects(card:ArkCardDefinition):ArkPlannedEffects {
  if (card.kind!=='ANIMAL') throw new Error('Expected animal definition.');
  const immediate:ArkZooEffect[]=[],afterFinishing:ArkZooEffect[]=[];
  const gain=(resource:'APPEAL'|'CONSERVATION'|'REPUTATION'|'MONEY'|'X'|'WORKER',amount:ArkEffectAmount)=>{if (amount!==0) immediate.push({kind:'GAIN',resource,amount});};
  gain('APPEAL',card.appeal);gain('CONSERVATION',card.conservation);gain('REPUTATION',card.reputation);
  for (const a of arkSoloCardAbilities(card)) {
    const action=ACTION_SUFFIX[a.key.split('_').slice(1).join('_')];
    if (a.key.startsWith('BOOST_')&&action) {afterFinishing.push({kind:'MOVE_ACTION',action,slots:[1,5]});continue;}
    if (a.key.startsWith('ACTION_')&&action) {afterFinishing.push({kind:'EXTRA_ACTION',action});continue;}
    if (a.key.startsWith('MULTIPLIER_')&&action) {immediate.push({kind:'MULTIPLIER',action});continue;}
    switch (a.key) {
      case 'SPRINT': immediate.push({kind:'DRAW',amount:a.value});break;
      case 'PACK': gain('APPEAL',{kind:'ICONS',tag:'Predator',factor:1,cap:10000});break;
      case 'ICONIC_ANIMAL': gain('APPEAL',{kind:'ICONS',tag:a.tag,factor:1,cap:8});break;
      case 'PETTING_ZOO_ANIMAL': gain('APPEAL',{kind:'ICONS',tag:'Pet',factor:3,cap:10000});break;
      case 'INVENTIVE': gain('X',a.value);break;
      case 'INVENTIVE_BEAR': gain('X',{kind:'ICONS',tag:'Bear',factor:1,cap:3});break;
      case 'INVENTIVE_PRIMARY': gain('X',{kind:'THRESHOLDS',tag:'Primate',thresholds:[1,3,5]});break;
      case 'FULL_THROATED': gain('WORKER',1);break;
      case 'JUMPING': gain('MONEY',a.value);break;
      case 'CLEVER': afterFinishing.push({kind:'MOVE_ACTION',action:null,slots:[1]});break;
      case 'DETERMINATION': afterFinishing.push({kind:'EXTRA_ACTION',action:null});break;
      case 'SNAPPING_1': case 'SNAPPING_2': immediate.push({kind:'SNAP',amount:a.key==='SNAPPING_1'?1:2,mayRefillBetween:a.key==='SNAPPING_2'});break;
      case 'PERCEPTION_4': immediate.push({kind:'PERCEPTION',amount:4,keep:2});break;
      case 'HUNTER': case 'DIGGING': case 'SCAVENGING': case 'POUCH': immediate.push({kind:a.key,amount:a.value});break;
      case 'SUN_BATHING': immediate.push({kind:'SUNBATHING',amount:a.value});break;
      case 'RESISTANCE': case 'ASSERTION': case 'DOMINANCE': case 'SPONSOR_MAGNET': immediate.push({kind:a.key});break;
      case 'POSTURING': immediate.push({kind:'FREE_BUILD',buildings:['KIOSK','PAVILION'],amount:a.value,ignoreBuildUpgrade:false});break;
      case 'PEACOCKING': immediate.push({kind:'FREE_BUILD',buildings:['LargeBirdAviary'],amount:1,ignoreBuildUpgrade:true});break;
      case 'FLOCK_ANIMAL': break; // Housing alternative, already resolved when the card entered the zoo.
      default: throw new Error(`Unsupported base animal ability: ${a.key}`);
    }
  }
  return {immediate,afterFinishing};
}
