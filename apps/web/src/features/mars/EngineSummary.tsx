import {marsCard,marsCorporation,MARS_TAG_NAMES,type MarsPlayerPublic} from '@hangul-rummikub/shared';
export function marsEngineSummary(player:MarsPlayerPublic,generation:number){
 const counts=new Map<string,number>();
 const tags=[...(player.corporationId?marsCorporation(player.corporationId).tags:[]),...player.played.flatMap(c=>{const d=marsCard(c.definitionId);return d.type==='event'?[]:d.tags;})];
 for(const tag of tags)counts.set(tag,(counts.get(tag)??0)+1);
 return {tags:[...counts].map(([tag,count])=>({tag,count})),unused:player.played.filter(c=>marsCard(c.definitionId).actions&&c.usedGeneration!==generation).length,actions:player.played.filter(c=>marsCard(c.definitionId).actions).length,passives:player.played.filter(c=>marsCard(c.definitionId).passive)};
}
export function EngineSummary({player,generation,onInspect}:{player:MarsPlayerPublic;generation:number;onInspect(tileId:string):void}){
 const summary=marsEngineSummary(player,generation);
 return <section className="tm-engine-summary" aria-label="내 기업 엔진 요약"><div className="tm-engine-tags">{summary.tags.map(t=><span key={t.tag}>{MARS_TAG_NAMES[t.tag]} <b>{t.count}</b></span>)}{!summary.tags.length&&<span>보유 태그 없음</span>}</div><p>이번 세대 미사용 카드 행동 <strong>{summary.unused} / {summary.actions}</strong><small> · 실행 조건과 비용은 카드를 선택해 확인하세요.</small></p>{summary.passives.length>0&&<details><summary>지속 효과 {summary.passives.length}개</summary>{summary.passives.map(c=><button key={c.tileId} onClick={()=>onInspect(c.tileId)}><strong>{marsCard(c.definitionId).name}</strong><span>{marsCard(c.definitionId).passive}</span></button>)}</details>}</section>;
}
