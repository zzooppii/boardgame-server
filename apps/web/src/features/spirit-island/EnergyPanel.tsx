export function EnergyPanel({ energy, income, budget, cost, preparing }: {
 energy: number; income: number; budget: number; cost: number; preparing: boolean;
}) {
 const remaining=budget-cost;
 return <section className="si-energy-panel" aria-label="성장과 준비 에너지 안내">
  <div className="si-energy-balance"><span>현재 보유 에너지 · 이월분 포함</span><strong>{energy}</strong></div>
  <p>쓰지 않은 에너지는 다음 라운드에도 남습니다. 위 숫자는 지금까지 받은 에너지와 지출을 반영한 현재 잔액입니다.</p>
  <div className="si-energy-income"><b>현재 트랙 수입 · 라운드당 +{income}</b><span>성장 효과 처리가 끝나면 한 번 지급됩니다. 현신으로 수입 트랙을 열면 금액이 달라질 수 있습니다. 성장 선택의 추가 에너지는 별도입니다.</span></div>
  {preparing ? <><dl>
   <div><dt>카드 준비에 쓸 수 있는 에너지</dt><dd>{budget}</dd></div>
   <div><dt>선택한 카드 비용</dt><dd>{cost}</dd></div>
   <div><dt>{remaining<0?'부족한 에너지':'이 선택 확정 후 잔액'}</dt><dd>{Math.abs(remaining)}{remaining<0?' 부족':''}</dd></div>
  </dl>{budget>energy?<p>이미 준비한 카드에 지불한 {budget-energy} 에너지를 포함해 다시 선택할 수 있습니다. 수입을 다시 더하지 않습니다.</p>:null}</> : <p>성장 효과를 마치면 카드 준비 비용과 확정 후 잔액을 비교할 수 있습니다.</p>}
 </section>;
}
