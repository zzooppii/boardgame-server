import { SPIRIT_BRANCH_FEAR, type SpiritProjection } from '@hangul-rummikub/shared';
export function RevealedFearPanel({game:g}:{game:SpiritProjection}){
 if(!g.revealedFear.length)return null;
 return <section aria-label="미리 공개된 공포 카드"><p className="si-event-notice">꿈에서 본 공포 · 강조는 현재 공포 수준입니다. 실제 해결 시점의 수준을 적용합니다.</p>{g.revealedFear.map(c=>{
  const art=Object.values(SPIRIT_BRANCH_FEAR).find(card=>card.name===c.name)?.artwork??'SHADOW';
  return <article key={c.position} className="si-event"><div className={`si-event-art si-art-${art}`} aria-hidden="true"/><div className="si-event-body"><small>공포 덱 위에서 {c.position}번째 · 공개된 카드</small><h2>{c.name}</h2>{c.effects.map((text,i)=><p key={i} className={g.terror===i+1?'si-event-notice':undefined}><b>공포 {i+1}{g.terror===i+1?' · 현재 수준':''}</b><br/>{text}</p>)}</div></article>;
 })}</section>;
}
