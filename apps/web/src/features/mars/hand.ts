import {marsCard,marsCardDescription,MARS_TAG_NAMES,type MarsCard,type MarsProjection} from '@hangul-rummikub/shared';
export const MARS_HAND_SORTS=[{id:'received',label:'받은 순서'},{id:'cost',label:'비용 낮은 순'},{id:'name',label:'이름순'}] as const;
export type MarsHandOptions={query:string;tag:string;kind:string;eligibleOnly:boolean;sort:typeof MARS_HAND_SORTS[number]['id']};
export const DEFAULT_MARS_HAND_OPTIONS:MarsHandOptions={query:'',tag:'',kind:'',eligibleOnly:false,sort:'received'};
export function filterMarsHand(hand:readonly MarsCard[],status:MarsProjection['privateState']['cardStatus'],options:MarsHandOptions):MarsCard[]{
 const byId=new Map(status.map(c=>[c.tileId,c])),query=options.query.normalize('NFKC').toLocaleLowerCase('ko').trim();
 const result=hand.filter(c=>{const d=marsCard(c.definitionId);return (!options.tag||d.tags.includes(options.tag))&&(!options.kind||d.type===options.kind)&&(!options.eligibleOnly||byId.get(c.tileId)?.reason===null)&&(!query||[d.name,d.englishName,d.number,marsCardDescription(d),...d.tags.map(t=>MARS_TAG_NAMES[t])].join(' ').normalize('NFKC').toLocaleLowerCase('ko').includes(query));});
 if(options.sort==='cost')result.sort((a,b)=>(byId.get(a.tileId)?.cost??marsCard(a.definitionId).cost)-(byId.get(b.tileId)?.cost??marsCard(b.definitionId).cost));
 if(options.sort==='name')result.sort((a,b)=>marsCard(a.definitionId).name.localeCompare(marsCard(b.definitionId).name,'ko'));
 return result;
}
