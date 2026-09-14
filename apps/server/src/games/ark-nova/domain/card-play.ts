import * as v from 'valibot';
import { ArkZooCardChoiceSchema, ARK_UNIQUE_BUILDINGS, type ArkCard, type ArkBuilding, type ArkCardDefinition } from '@hangul-rummikub/shared';
import { arkCardDefinition } from './zoo-icons.js';
import { arkMissingCardConditions, arkAnimalPrice, type ArkRequirementContext } from './card-requirements.js';
import { arkReputationRange } from './build-turn.js';
import { arkCanShareFlockEnclosure, occupyArkAnimalHousing } from './animal-housing.js';
import { validateArkUniqueConstruction } from './unique-construction.js';

export type ArkCardPlayState={-readonly [K in keyof ArkRequirementContext]:ArkRequirementContext[K]} & {played:ArkCard[];hand:ArkCard[];display:(ArkCard|null)[];buildings:ArkBuilding[];money:number;wazaFocus:'SMALL'|'LARGE'|null};
export type ArkCardPlayScope=Readonly<{kind:'ANIMAL'|'SPONSOR';upgraded:boolean;remaining:number;paySponsorLevel:boolean}>;
/** Candidate placement/payment only. Returned definition must enter the immediate/after-finishing effect queue.
 * Strength/side/remaining allowance come from the active server action, not the choice payload.
 */
export function playArkZooCard<T extends ArkCardPlayState>(current:T,scope:ArkCardPlayScope,input:unknown):
  {ok:true;state:T;remaining:number;card:ArkCard;definition:ArkCardDefinition;paid:number}|{ok:false} {
  const choice=v.safeParse(ArkZooCardChoiceSchema,input);
  if (!choice.success||!Number.isSafeInteger(scope.remaining)||scope.remaining<=0) return {ok:false};
  const {cardId,housingId}=choice.output;
  const held=current.hand.find(c=>c.cardId===cardId),displayIndex=current.display.findIndex(c=>c?.cardId===cardId);
  const card=held??current.display[displayIndex];
  if (!card||current.played.some(c=>c.cardId===cardId)||held&&displayIndex>=0) return {ok:false};
  if (!held&&(!scope.upgraded||scope.paySponsorLevel||displayIndex>=arkReputationRange(current.reputation))) return {ok:false};
  const definition=arkCardDefinition(card);
  if (definition.kind!==scope.kind||definition.rock===null) return {ok:false};
  const missing=arkMissingCardConditions(definition,current);
  const ignores=definition.kind==='ANIMAL'&&definition.size>=4&&current.played.some(c=>c.key==='263')?1:0;
  if (missing.length>ignores) return {ok:false};
  if (definition.kind==='ANIMAL'&&((current.wazaFocus==='SMALL'&&definition.size>=4)||(current.wazaFocus==='LARGE'&&definition.size<=2))) return {ok:false};
  const strengthCost=definition.kind==='ANIMAL'?1:definition.cost;
  if (scope.remaining<strengthCost) return {ok:false};
  const displaySlot=held?0:displayIndex+1;
  const paid=definition.kind==='ANIMAL'?arkAnimalPrice(definition,current,displaySlot):(scope.paySponsorLevel?definition.cost:displaySlot);
  if (current.money<paid) return {ok:false};
  const state=structuredClone(current);
  if (definition.kind==='ANIMAL') {
    if (housingId===null) {
      if (!arkCanShareFlockEnclosure(definition,current.played.map(arkCardDefinition))) return {ok:false};
    } else {
      const housing=occupyArkAnimalHousing(current.buildings,definition,housingId,current.played.some(c=>c.key==='219'));
      if (!housing.ok) return {ok:false};state.buildings=housing.buildings;
    }
  } else if (housingId!==null) return {ok:false};
  if (Object.hasOwn(ARK_UNIQUE_BUILDINGS,definition.key)) {
    const placed=validateArkUniqueConstruction(current.buildings,definition,current.actions.some(a=>a.kind==='BUILD'&&a.upgraded),current.played.some(c=>c.key==='219'),choice.output.uniquePlacement);
    if(!placed.ok)return {ok:false};
    state.buildings.push({...placed.building,id:`unique:${card.cardId}`});
  } else if(choice.output.uniquePlacement!==undefined)return {ok:false};
  if (held) state.hand=state.hand.filter(c=>c.cardId!==cardId);
  else state.display[displayIndex]=null;
  state.played.push({...card});state.money-=paid;
  return {ok:true,state,remaining:scope.remaining-strengthCost,card:{...card},definition,paid};
}
