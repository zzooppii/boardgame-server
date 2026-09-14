import type {ArkAbility,ArkCardDefinition} from './catalog.js';
/** The blue solo panel on the eleven base interactive animals replaces the printed multiplayer ability. */
export const ARK_SOLO_ABILITIES:Readonly<Record<string,readonly ArkAbility[]>>={
  '449':[{key:'INVENTIVE',value:1,tag:''}],
  '456':[{key:'SPRINT',value:1,tag:''}],
  '458':[{key:'SPRINT',value:2,tag:''}],
  '463':[{key:'SPRINT',value:1,tag:''}],
  '470':[{key:'INVENTIVE',value:2,tag:''}],
  '474':[{key:'CLEVER',value:1,tag:''}],
  '475':[{key:'DETERMINATION',value:1,tag:''}],
  '482':[{key:'CLEVER',value:1,tag:''}],
  '483':[{key:'CLEVER',value:1,tag:''}],
  '485':[{key:'DETERMINATION',value:1,tag:''}],
  '492':[{key:'INVENTIVE',value:2,tag:''}],
};

export const arkSoloCardAbilities=(card:ArkCardDefinition):readonly ArkAbility[]=>ARK_SOLO_ABILITIES[card.key]??card.abilities;
