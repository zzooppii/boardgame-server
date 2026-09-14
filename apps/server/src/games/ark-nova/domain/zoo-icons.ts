import { ARK_CARDS, ARK_CONTINENTS, type ArkCard, type ArkCardDefinition } from '@hangul-rummikub/shared';
import { arkUniversityResearch } from './association.js';
export const ARK_ZOO_ANIMAL_CATEGORIES=['Predator','Herbivore','Primate','Reptile','Bird','Bear','Pet'] as const;
export type ArkZooIcons=Readonly<Record<string,number>>;
export function arkCardDefinition(card:ArkCard):ArkCardDefinition {
  const definition=ARK_CARDS.find(c=>c.key===card.key);
  if (!definition) throw new Error('Unknown zoo card.');
  return definition;
}
/** Count printed zoo icons, including repeated icons and terrain requirements, never left-edge conditions. */
export function arkZooIcons(played:readonly ArkCard[],partners:readonly string[],universities:readonly string[]):ArkZooIcons {
  const icons:Record<string,number>={Science:arkUniversityResearch(universities)};
  const add=(tag:string,n=1)=>{icons[tag]=(icons[tag]??0)+n;};
  for (const card of played) {
    const definition=arkCardDefinition(card);
    if (definition.rock===null) throw new Error('Unverified zoo card terrain requirement.');
    for (const tag of definition.tags) add(tag);
    add('Water',definition.water);add('Rock',definition.rock);
  }
  for (const partner of partners) {
    if (!ARK_CONTINENTS.some(c=>c===partner)) throw new Error('Unknown partner continent.');
    add(partner);
  }
  return icons;
}
