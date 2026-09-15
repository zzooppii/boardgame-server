import {ARK_CARDS,ARK_TAG_LABELS,arkZooIcons,type ArkSoloView} from '@hangul-rummikub/shared';
/** Printed icon counts use the same inventory as admission checks; this is guidance only. */
export function ArkNovaConditionGuide({state,cardId}:{state:ArkSoloView;cardId:string|null}) {
  const card=state.hand.find(c=>c.cardId===cardId)??state.display.find(c=>c?.cardId===cardId);
  const definition=card&&ARK_CARDS.find(c=>c.key===card.key);
  if(!definition)return null;
  const special=new Set(['Partner_Zoo','AnimalsII','SponsorsII','Appeal','Reputation']);
  const counts=new Map<string,number>();
  for(const tag of definition.requirements)if(!special.has(tag))counts.set(tag,(counts.get(tag)??0)+1);
  if(!counts.size)return null;
  const icons=arkZooIcons(state.played,state.partners,state.universities);
  return <div className="ark-condition-guide"><h3>카드 아이콘 조건 비교</h3><ul>{[...counts].map(([tag,required])=>{
    const owned=icons[tag]??0;
    return <li key={tag} className={owned<required?'is-missing':''}><b>{ARK_TAG_LABELS[tag]??tag}</b><span>필요 {required} · 보유 {owned}</span><span>{owned<required?`${required-owned}개 부족`:'충족'}</span></li>;
  })}</ul><p>손패의 아이콘은 포함하지 않습니다. 조건을 무시하는 카드 효과는 위 입주 가능 안내에 반영됩니다.</p></div>;
}
