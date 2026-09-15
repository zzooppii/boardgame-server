import {arkCardName,type ArkSoloView} from '@hangul-rummikub/shared';
/** Render the server's final ledger, never a client prediction or a resubmittable score. */
export function ArkNovaResult({state,disabled=false,onRematch}:{state:ArkSoloView;disabled?:boolean;onRematch?():void}){
  const result=state.result;if(!result)return null;
  const cards=[...state.goals,...state.played];
  return <section className="ark-live-result" aria-label="솔로 최종 결과">
    <h2>{result.won?'동물원 운영 성공':'이번 동물원 운영 결과'}</h2><strong>{result.total}점</strong>
    <p>0점 이상이면 솔로 도전에 성공합니다.</p>
    <p>최종 매력 {result.appeal} · 최종 보전 {result.conservation}</p>
    <p>목표 보전 +{result.goalPoints} · 후원자 보전 +{result.sponsorPoints} · 후원자 매력 +{result.sponsorAppeal} (최종 수치에 포함)</p>
    <div className="ark-result-explanation">
      <h3>점수 계산</h3>
      <p>최종 매력 {result.appeal} − 보전 {result.conservation}점 위치의 기준 매력 {result.appeal-result.total} = <b>{result.total}점</b></p>
      <p>{result.total<0?`0점까지 매력 기준으로 ${-result.total}점이 부족했습니다. 보전을 올려 기준 매력을 낮추는 방법도 있습니다.`:'두 점수 마커가 교차해 솔로 목표를 달성했습니다.'}</p>
      <table><caption>최종 정산 전후</caption><thead><tr><th scope="col">항목</th><th scope="col">매력</th><th scope="col">보전</th></tr></thead><tbody>
        <tr><th scope="row">정산 전</th><td>{result.appeal-result.sponsorAppeal}</td><td>{result.conservation-result.goalPoints-result.sponsorPoints}</td></tr>
        <tr><th scope="row">최종 목표 보너스</th><td>—</td><td>+{result.goalPoints}</td></tr>
        <tr><th scope="row">후원자 보너스</th><td>+{result.sponsorAppeal}</td><td>+{result.sponsorPoints}</td></tr>
        <tr><th scope="row">최종 수치</th><td>{result.appeal}</td><td>{result.conservation}</td></tr>
      </tbody></table>
      <p>남은 돈·X 토큰은 그 자체로 최종 점수에 더하지 않습니다. 카드 보너스는 위 최종 수치에 이미 포함되어 있습니다.</p>
    </div>
    {onRematch&&<div className="ark-result-retry"><button type="button" disabled={disabled} onClick={onRematch}>새 솔로 게임 준비</button><p>준비 화면으로 돌아갑니다. ‘솔로 동물원 시작’을 누르면 새 손패로 시작합니다.</p></div>}
    <details open><summary>카드별 정산 내역</summary><ul>{result.details.map(entry=>{
      const card=cards.find(c=>c.cardId===entry.cardId);
      return <li key={entry.cardId}><span>{card?arkCardName(card.key):'정산 카드'}</span><span>보전 +{entry.conservation} · 매력 +{entry.appeal}</span></li>;
    })}</ul></details>
  </section>;
}
