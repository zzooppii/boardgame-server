import {arkAppealIncome} from './income.js';
import type {ArkSoloView} from '@hangul-rummikub/shared';
import type {ArkSoloState} from './game.js';
import {arkVictoryPoints} from './scoring.js';

/** Project public tiles and pending choices, including effects hidden below a nested frame.
 * Reaching a space is not evidence that a particular tile was taken (money is an alternative).
 */
export function projectArkScoreBoard(s:Pick<ArkSoloState,'appeal'|'conservation'|'conservationBonuses'|'effects'|'conservationChoices'>):NonNullable<ArkSoloView['scoreBoard']> {
  const jobs=[...s.effects.frames.flat(),...s.effects.afterFinishing,...(s.effects.active?[s.effects.active]:[])];
  const pendingMilestones=([2,5,8,10] as const).filter(track=>jobs.some(({effect})=>
    track===2?effect.kind==='UPGRADE_OR_WORKER':track===10?effect.kind==='DISCARD_GOAL':
    effect.kind==='CONSERVATION_BONUS'&&effect.track===track));
  const gap=arkVictoryPoints(s.appeal,s.conservation);
  return {choices:(s.conservationChoices??[]).map(c=>({...c})),targetAppeal:s.appeal-gap,gap,bonuses:s.conservationBonuses.map(b=>({...b})),pendingMilestones,appealIncome:Array.from({length:114},(_,n)=>arkAppealIncome(n))};
}
