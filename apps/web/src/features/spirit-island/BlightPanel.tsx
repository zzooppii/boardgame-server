import { SPIRIT_BLIGHT, SPIRIT_ELEMENT_LABELS, spiritPower, type SpiritPlayingProjection } from '@hangul-rummikub/shared';
export function BlightPanel({game:g}:{game:Pick<SpiritPlayingProjection,'blighted'|'blightCard'|'blightPool'|'lesserOffer'|'settings'>}){
 if(!g.blighted||!g.blightCard)return null;
 const card=SPIRIT_BLIGHT[g.blightCard];
 return <section className="si-blight-panel" aria-label="오염된 섬 카드"><div className="si-blight-portrait" aria-hidden="true">◈</div><div><span className="si-eyebrow">BLIGHTED ISLAND · {card.timing}</span><h2>{card.name}</h2><p>{card.help}</p><small>공개 시 인원수마다 오염 {card.perPlayer-(g.settings.scenario==='BLITZ'?1:0)}개 보충 · 현재 {g.blightPool}개</small>{g.lesserOffer.length?<div className="si-lesser-offer" aria-label="배정할 보조 능력">{g.lesserOffer.map(c=>{const p=spiritPower(c.key);return <article key={c.cardId}><b>{p.title}</b><small>{p.speed==='FAST'?'빠른 능력':'느린 능력'} · 사거리 {p.range}{p.sacred?' · 성소에서':''}</small><p>{p.description}</p><small>{p.elements.map(e=>SPIRIT_ELEMENT_LABELS[e]).join(' · ')}</small></article>;})}</div>:null}</div></section>;
}
