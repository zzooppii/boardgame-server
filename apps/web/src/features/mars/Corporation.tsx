import {marsCorporation,MARS_TAG_NAMES} from '@hangul-rummikub/shared';
import {MarsArt} from './cards.js';

export const MARS_CORPORATION_ART:Readonly<Partial<Record<string,number>>>={EcoLine:0,Helion:1,MiningGuild:2,TharsisRepublic:3};
export function CorporationArt({id}:{id:string}){
 const cell=MARS_CORPORATION_ART[id];
 return cell===undefined?<MarsArt cell={marsCorporation(id).art}/>:<span aria-hidden="true" className="tm-art" style={{backgroundImage:'url("/images/mars/corporations-v1.webp")',backgroundSize:'200% 200%',backgroundPosition:`${cell%2*100}% ${Math.floor(cell/2)*100}%`}}/>;
}
export function CorporationIdentity({id}:{id:string}){
 const corporation=marsCorporation(id);
 return <span className="tm-corporation-identity">
  <span className="tm-corporation-visual"><CorporationArt id={id}/></span>
  <span className="tm-corporation-copy"><strong>{corporation.name}</strong>
   <span className="tm-corporation-tags" aria-label="기업 태그">{corporation.tags.length?corporation.tags.map((tag,index)=><span key={`${tag}-${index}`}>{MARS_TAG_NAMES[tag]}</span>):<span>태그 없음</span>}</span>
   <small>{corporation.text}</small>
  </span>
 </span>;
}
export function CorporationChoice({id,selected,onSelect}:{id:string;selected:boolean;onSelect():void}){
 const corporation=marsCorporation(id);
 return <button type="button" aria-pressed={selected} className={'tm-corporation '+(selected?'selected':'')} onClick={onSelect}>
  <CorporationIdentity id={id}/>
  <span className="tm-corporation-choice-footer"><b>시작 자금 {corporation.money} M€</b><span>{selected?'✓ 선택됨':'기업 선택'}</span></span>
 </button>;
}
