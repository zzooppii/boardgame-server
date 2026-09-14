import { ARK_CARDS, ARK_PROJECTS, type ArkCard } from '@hangul-rummikub/shared';
import type { ArkCardEffectZones } from './card-effect-choices.js';
import type { ArkGoalZones } from './reserve-card-choices.js';
import { assertArkCardInventory } from './solo-setup.js';
export type ArkExtendedInventory=ArkCardEffectZones & ArkGoalZones & {
  played:ArkCard[];pouched:Record<string,ArkCard[]>;baseProjectReserve:ArkCard[];baseProjects:ArkCard[];playedProjects:ArkCard[];
};
/** Base projects obtained by card abilities can travel through hand/discard/pouch. Classify by the immutable
 * definition, not by the zone, so the full 212 zoo + 12 base + 11 goal inventory remains conserved.
 */
export function assertArkExtendedCardInventory(s:ArkExtendedInventory):void {
  const cards=[...s.zooDeck,...s.display.filter(c=>c!==null),...s.hand,...s.discarded,...s.played,
    ...Object.values(s.pouched).flat(),...(s.cardReveal?.candidates??[]),...s.baseProjectReserve,...s.baseProjects,...s.playedProjects];
  const baseKeys=new Set(ARK_PROJECTS.filter(p=>p.kind==='BASE').map(p=>p.key));
  if([...s.baseProjectReserve,...s.baseProjects].some(c=>!baseKeys.has(c.key))||
    s.playedProjects.some(c=>!ARK_PROJECTS.some(p=>p.key===c.key))||s.played.some(c=>!ARK_CARDS.some(d=>d.key===c.key)))throw new Error('Invalid Ark card zone.');
  assertArkCardInventory(cards.filter(c=>!baseKeys.has(c.key)),[...s.goalDeck,...s.goals,...s.discardedGoals,...(s.goalReveal?.candidates??[])],cards.filter(c=>baseKeys.has(c.key)));
}
