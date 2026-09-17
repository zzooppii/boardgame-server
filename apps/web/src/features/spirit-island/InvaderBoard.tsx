import { SPIRIT_TERRAIN_LABELS, type SpiritProjection, type SpiritInvaderCard } from '@hangul-rummikub/shared';

export function InvaderBoard({ game:g }: { game:SpiritProjection }) {
 const advanced=['SLOW','TIME'].includes(g.stage)&&!g.pending;
 const slots = [
  {stage:'RAVAGE',name:'약탈 (파괴)',english:'Ravage',card:g.ravage,extra:g.ravageExtra,help:'침략자가 땅과 다한을 공격합니다. 방어 후 땅이 받는 피해가 2 이상이면 오염이 추가됩니다.'},
  {stage:'BUILD',name:'건설',english:'Build',card:g.build,extra:g.buildExtra,help:'침략자가 있는 대상 지역에 마을 또는 도시를 추가합니다.'},
  {stage:'EXPLORE',name:'탐험',english:'Explore',card:g.explore,extra:g.exploreExtra,help:'새 카드를 공개하고, 해당 지형 중 해안이나 건물과 연결된 지역에 탐험가를 추가합니다.'},
 ];
 const lands=(card:SpiritInvaderCard)=>g.lands.filter(l=>l.number>0&&(card.coastal?l.coastal:card.terrains.includes(l.terrain))).map(l=>l.id).join(' · ');
 return <section className="si-invader-board" aria-label="침략자 보드">
  <div className="si-section-title"><h2>침략자 보드</h2><span>{g.pending?'선택 효과 처리 중 · 현재 카드 배치':advanced?'카드 이동 완료 · 다음 라운드 대비':'이번 라운드 · 약탈 → 건설 → 탐험'}</span></div>
  <div className="si-invader-slots">{slots.map((slot,i)=>{
   const cards=[...(slot.card?[slot.card]:[]),...slot.extra];
   const current=!g.pending&&g.stage===slot.stage;
   return <article key={slot.stage} className={`si-invader-slot si-invader-${slot.stage.toLowerCase()}`} aria-label={slot.name} aria-current={current?'step':undefined}>
    <header><h3>{i+1}. {slot.name}</h3><span>{slot.english}</span>{current?<b className="si-invader-current">지금 진행할 단계</b>:null}</header>
    {cards.length>1?<p>{slot.name} · {cards.length}장 순서대로</p>:null}
    {cards.map((card,index)=><div className="si-invader-face" key={index}><small>{cards.length>1?`${index+1}. `:''}공개된 대상 · 침략 {card.stage}단계</small><strong>{card.coastal?'해안':card.terrains.map(t=>SPIRIT_TERRAIN_LABELS[t]).join(' + ')}</strong><span>지형이 일치하는 지역: {lands(card)||'없음'}</span></div>)}
    {!cards.length?<div className="si-invader-face si-invader-empty"><strong>{slot.stage==='EXPLORE'?'? 미공개':'카드 없음'}</strong><span>{slot.stage==='EXPLORE'?`탐험할 때 공개 · 덱 ${g.invaderDeckCount}장 남음`:'이 칸의 기본 행동은 없습니다.'}</span></div>:null}
    <p>{slot.help}</p>
   </article>;
  })}</div>
  <p className="si-invader-flow">행동 순서: <b>약탈 → 건설 → 탐험</b><br/>탐험 해결 후 카드 이동: <b>탐험 → 건설 → 약탈 → 버림</b></p>
  <small>지형이 일치해도 기물·방어·행동 생략 효과에 따라 실제 결과는 달라집니다. 추가 행동이나 카드 유지 효과가 있으면 아래 안내를 함께 확인하세요.</small>
 </section>;
}
