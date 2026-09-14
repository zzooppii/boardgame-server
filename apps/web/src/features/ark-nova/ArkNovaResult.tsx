import {arkCardName,type ArkSoloView} from '@hangul-rummikub/shared';
/** Render the server's final ledger, never a client prediction or a resubmittable score. */
export function ArkNovaResult({state}:{state:ArkSoloView}){
  const result=state.result;if(!result)return null;
  const cards=[...state.goals,...state.played];
  return <section className="ark-live-result" aria-label="솔로 최종 결과">
    <h2>{result.won?'동물원 운영 성공':'이번 동물원 운영 결과'}</h2><strong>{result.total}점</strong>
    <p>0점 이상이면 솔로 도전에 성공합니다.</p>
    <p>최종 매력 {result.appeal} · 최종 보전 {result.conservation}</p>
    <p>목표 보전 +{result.goalPoints} · 후원자 보전 +{result.sponsorPoints} · 후원자 매력 +{result.sponsorAppeal} (최종 수치에 포함)</p>
    <details><summary>카드별 정산 내역</summary><ul>{result.details.map(entry=>{
      const card=cards.find(c=>c.cardId===entry.cardId);
      return <li key={entry.cardId}><span>{card?arkCardName(card.key):'정산 카드'}</span><span>보전 +{entry.conservation} · 매력 +{entry.appeal}</span></li>;
    })}</ul></details>
  </section>;
}
