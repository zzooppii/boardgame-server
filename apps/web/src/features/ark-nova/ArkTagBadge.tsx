import {ARK_TAG_LABELS} from '@hangul-rummikub/shared';
const symbols:Readonly<Record<string,string>>={Primate:'🐒',Reptile:'🦎',Bird:'🦅',Predator:'🐾',Herbivore:'🌿',Pet:'🐐',PettingZoo:'🐐',Bear:'🐻',Africa:'AF',Americas:'AM',Europe:'EU',Asia:'AS',Australia:'AU',Oceania:'OC',Research:'⚗',Science:'⚗'};
const continents=new Set(['Africa','Americas','Europe','Asia','Australia','Oceania']);
/** Category glyphs always retain a readable label; color and emoji are never the only cue. */
export function ArkTagBadge({tag}:{tag:string}){
  return <span className={`ark-tag-badge ${continents.has(tag)?'is-continent':'is-animal-tag'}`}><i aria-hidden="true">{symbols[tag]??'◆'}</i><span>{ARK_TAG_LABELS[tag]??tag}</span></span>;
}
