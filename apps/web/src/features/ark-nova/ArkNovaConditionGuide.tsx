import {ARK_CARDS,ARK_CONTINENTS,ARK_TAG_LABELS,arkMissingCardConditions,arkZooIcons,type ArkSoloView} from '@hangul-rummikub/shared';
/** Printed icon counts use the same inventory as admission checks; this is guidance only. */
export function ArkNovaConditionGuide({state,cardId}:{state:ArkSoloView;cardId:string|null}) {
  const card=state.hand.find(c=>c.cardId===cardId)??state.display.find(c=>c?.cardId===cardId);
  const definition=card&&ARK_CARDS.find(c=>c.key===card.key);
  if(!definition)return null;
  const special=new Set(['Partner_Zoo','AnimalsII','SponsorsII','Appeal','Reputation']);
  const counts=new Map<string,number>();
  for(const tag of definition.requirements)if(!special.has(tag))counts.set(tag,(counts.get(tag)??0)+1);
  const extra=[...new Set(definition.requirements.filter(tag=>special.has(tag)))];
  if(!counts.size&&!extra.length)return null;
  const missing=arkMissingCardConditions(definition,state);
  const icons=arkZooIcons(state.played,state.partners,state.universities);
  return <div className="ark-condition-guide"><h3>카드 사용 조건 비교</h3><ul>{[...counts].map(([tag,required])=>{
    const owned=icons[tag]??0;
    return <li key={tag} className={owned<required?'is-missing':''}><b>{ARK_TAG_LABELS[tag]??tag}</b><span>필요 {required} · 보유 {owned}</span><span>{owned<required?`${required-owned}개 부족`:'충족'}</span></li>;
  })}{extra.map(tag=>{
    const labels:Record<string,string>={AnimalsII:'동물 II',SponsorsII:'후원자 II',Appeal:'매력 25 이하',Reputation:'평판 3 이상',Partner_Zoo:definition.kind==='ANIMAL'?'같은 대륙 제휴':'제휴 동물원'};
    const action=tag==='AnimalsII'?'ANIMALS':'SPONSORS';
    const targetContinents=definition.tags.filter(t=>ARK_CONTINENTS.some(c=>c===t)).map(t=>ARK_TAG_LABELS[t]??t);
    const ownedPartners=state.partners.map(t=>ARK_TAG_LABELS[t]??t).join(' · ')||'없음';
    const current=tag==='AnimalsII'||tag==='SponsorsII'?`현재 ${state.actions.some(a=>a.kind===action&&a.upgraded)?'II · 업그레이드 완료':'I · 업그레이드 필요'}`:tag==='Appeal'?`현재 매력 ${state.appeal}`:tag==='Reputation'?`현재 평판 ${state.reputation}`:`${definition.kind==='ANIMAL'?`필요 ${targetContinents.join(' 또는 ')} · `:''}보유 제휴 ${ownedPartners}`;
    return <li key={tag} className={missing.includes(tag)?'is-missing':''}><b>{labels[tag]}</b><span>{current}</span><span>{missing.includes(tag)?'미충족':'충족'}</span></li>;
  })}</ul>{extra.some(tag=>(tag==='AnimalsII'||tag==='SponsorsII')&&missing.includes(tag))&&<details><summary>행동 카드는 어떻게 업그레이드하나요?</summary><p>평판 5 도달, 보전 2의 업그레이드 보상 선택, 두 번째 제휴 동물원 또는 두 번째 대학 획득 시 원하는 행동 카드를 II로 바꿀 수 있습니다. 행동력이나 동물 수를 올리는 것과는 다릅니다.</p></details>}<p>손패의 아이콘은 포함하지 않습니다. 조건을 무시하는 카드 효과는 위 입주 가능 안내에 반영됩니다.</p></div>;
}
