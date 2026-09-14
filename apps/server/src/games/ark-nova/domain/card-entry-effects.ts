import type { ArkCard } from '@hangul-rummikub/shared';
import { arkCardDefinition, arkZooIcons } from './zoo-icons.js';
import { planArkAnimalEffects, type ArkZooEffect } from './animal-effects.js';
import { arkSponsorImmediate, arkSponsorIconTriggers, type ArkSponsorContext } from './sponsor-effects.js';
import { arkNewBuildingEffects } from './construction-effects.js';
import type { ArkEffectBatch } from './effect-queue.js';
/** Every successful card entry, including a paid sponsor bonus, produces the same effects and icon triggers. */
export function arkCardEntryEffects(before:ArkSponsorContext,after:ArkSponsorContext,card:ArkCard):ArkEffectBatch[] {
  const sourceId=card.cardId,batch:ArkEffectBatch[]=[],definition=arkCardDefinition(card);
  const emit=(effect:ArkZooEffect,timing:'IMMEDIATE'|'AFTER_FINISHING'='IMMEDIATE')=>batch.push({sourceId,effect,timing});
  if(definition.kind==='ANIMAL') {
    const effects=planArkAnimalEffects(definition);
    effects.immediate.forEach(effect=>emit(effect));effects.afterFinishing.forEach(effect=>emit(effect,'AFTER_FINISHING'));
  } else arkSponsorImmediate(card.key,after).forEach(effect=>emit(effect));
  batch.push(...arkSponsorIconTriggers(after,arkZooIcons([card],[],[]),arkZooIcons(before.played,before.partners,before.universities)));
  const placed=[...before.buildings];
  for(const building of after.buildings.filter(b=>!before.buildings.some(old=>old.id===b.id))) {
    arkNewBuildingEffects(placed,building,after.played).forEach(effect=>emit(effect));placed.push(building);
  }
  return batch;
}
