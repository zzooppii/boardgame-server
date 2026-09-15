import {ARK_UNIVERSITY_LABELS,ArkNovaAssociationBenefits} from './ArkNovaAssociationBenefits.js';
import {ArkNovaUpgradeChoice} from './ArkNovaUpgradeChoice.js';
import {useState,type ReactNode} from 'react';
import {ARK_UNIQUE_BUILDINGS,ARK_ACTION_LABELS,ARK_BUILDINGS,ARK_CARDS,ARK_CONTINENTS,ARK_SOLO_UNIVERSITIES,ARK_TAG_LABELS,arkCardName,type ArkEffectGuide,type ArkSoloView,type ArkSoloCommand,type ArkCell} from '@hangul-rummikub/shared';
import {arkMapBonusAdvice,arkToggleLimitedSelection,arkSpecialMoveAdvice,arkFreeBuildPlacementHint,arkWazaSelectionAdvice,arkSponsorSelectionAdvice,arkReachableDisplayCards} from './action-controls.js';
import {ArkNovaBonusTile} from './ArkNovaBonusTile.js';
import {ArkNovaCardRow} from './ArkNovaCards.js';

type Selection=Extract<ArkSoloCommand,{kind:'EFFECT'}>['selection'];
type Placement=Extract<ArkSoloCommand,{kind:'BUILD'}>['placement'];
export const arkEffectLabels:Readonly<Record<string,string>>={WAZA_PLAY:'WAZA · 소형 동물 추가',WAZA_SNAP:'WAZA · 소형 동물 획득',ARCHAEOLOGIST:'고고학자 · 지도 보너스',MULTIPLIER:'배수 토큰',PAID_SPONSOR:'후원자 비용 지불',FREE_PARTNER:'제휴 동물원 획득',FREE_UNIVERSITY:'대학 획득',MOVE_TO_SPECIAL:'특수 우리로 동물 이동',FREE_BUILD:'무료 건설',RESISTANCE:'최종 목표 교체',ASSERTION:'자기주장 · 프로젝트 획득',DOMINANCE:'지배 · 프로젝트 획득',HUNTER:'사냥',SCAVENGING:'청소',PERCEPTION:'통찰',POUCH:'주머니',SUNBATHING:'일광욕',DIGGING:'땅파기',SPONSOR_MAGNET:'후원자 자석',DRAW:'카드 뽑기',GAIN:'보상 받기',CARD_PICK:'카드 획득',SNAP:'카드 낚아채기',MOVE_ACTION:'행동 카드 이동',UPGRADE:'행동 업그레이드',UPGRADE_OR_WORKER:'업그레이드 또는 직원',CONSERVATION_BONUS:'보전 보너스',DISCARD_GOAL:'목표 카드 정리',WAZA_FOCUS:'WAZA · 동물 크기 선택',SPONSOR_TOKENS:'후원 토큰',EXTRA_ACTION:'추가 행동'};
const resourceLabels={APPEAL:'매력',CONSERVATION:'보전',REPUTATION:'평판',MONEY:'돈',X:'X 토큰',WORKER:'직원'};
export function arkEffectSummary(kind:string,guide:ArkEffectGuide):string {
  if(kind==='GAIN'&&guide.resource)return `${resourceLabels[guide.resource]} ${guide.amount===null?'획득 · 효과 처리 시 계산':`+${guide.amount}`}`;
  return `${arkEffectLabels[kind]??'카드 효과'}${guide.amount===null?'':` · ${guide.amount}`}`;
}
export function ArkNovaEffects({state:s,disabled,onSelect,placement,cell,housingId,onUniqueCard,onBuilding,onRotate,onReflect,onAnimalCard,onClearHousing,selectedBuildingKind,onChooseHousing}:{
  state:ArkSoloView;disabled:boolean;onSelect(selection:Selection):void;placement:Placement|null;cell:ArkCell|null;housingId:string|null;
  onChooseHousing?(housingId:string|null):void;
  selectedBuildingKind?:string;
  onAnimalCard?(cardId:string):void;onClearHousing?():void;
  onUniqueCard(key:string|null):void;onBuilding(kind:string):void;onRotate():void;onReflect():void;
}) {
  const [chosen,setChosen]=useState<string[]>([]),[refill,setRefill]=useState(false);
  const effect=s.activeEffect;if(!effect)return null;
  const kind=effect.kind,guide=effect.guide,source=[...s.played,...s.hand,...s.playedProjects,...s.baseProjects].find(c=>c.cardId===effect.sourceId);
  const selectionLimit=['POUCH','SUNBATHING'].includes(kind)?guide.amount??0:s.revealedCards?.kind==='RESISTANCE'?1:s.revealedCards?.keep??0;
  const toggle=(id:string)=>setChosen(xs=>arkToggleLimitedSelection(xs,id,selectionLimit));
  const button=(label:string,selection:Selection,invalid=false)=><button key={label} disabled={disabled||invalid} onClick={()=>onSelect(selection)}>{label}</button>;
  const skip=()=>button('이 효과 포기',{kind:'SKIP'});
  const row=(cards:ArkSoloView['hand'],multiple=false)=><ArkNovaCardRow cards={cards} selected={chosen} disabled={disabled} {...(multiple?{maxSelected:selectionLimit}:{})} onSelect={multiple?toggle:id=>{setChosen([id]);if(kind==='WAZA_PLAY')onAnimalCard?.(id);if(kind==='MOVE_TO_SPECIAL')onClearHousing?.();const c=cards.find(c=>c.cardId===id);onUniqueCard(kind==='PAID_SPONSOR'&&c&&Object.hasOwn(ARK_UNIQUE_BUILDINGS,c.key)?c.key:null);}}/>;
  const playedAnimals=s.played.filter(c=>ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL'));
  let controls:ReactNode;
  if(kind==='INTERACTION'&&guide.interaction&&s.table){
    const e=guide.interaction,track=e.track==='CONSERVATION'?'conservation':'appeal',top=Math.max(...s.table.players.filter(p=>!p.played.some(c=>c.key==='225')).map(p=>p[track]));
    const targets=s.table.players.filter(p=>p.playerId!==s.playerId&&p[track]===top&&(track!=='conservation'||top>=1)&&p.appeal>=5&&!p.played.some(c=>c.key==='225'));
    controls=e.ability==='VENOM'||e.ability==='CONSTRICTION'?<><p>{e.ability==='VENOM'?'매력이 앞선 상대의 낮은 칸에 독 토큰을 놓습니다.':'매력·보전에서 앞선 상대의 높은 칸에 조이기 토큰을 놓습니다.'} 매력 5 미만과 검역 연구실 보유자는 제외됩니다.</p>{button('상대에게 적용',{kind:'NONE'})}</>:<><p>{e.ability==='HYPNOSIS'?'상대의 1–3번 행동을 빌립니다. 해당 카드의 강화 면과 행동력을 사용합니다.':'선두 상대가 돈 5 또는 무작위 손패 1장으로 지불합니다.'}</p>{targets.map(p=><div key={p.playerId}>플레이어 {s.table!.players.indexOf(p)+1}{e.ability==='HYPNOSIS'?p.actions.slice(0,3).map((a,i)=>button(`${i+1} · ${ARK_ACTION_LABELS[a.kind]} ${a.upgraded?'II':'I'}`,{kind:'INTERACTION',targetId:p.playerId,action:a.kind})):button(`대상 선택 · 플레이어 ${s.table!.players.indexOf(p)+1}`,{kind:'INTERACTION',targetId:p.playerId,action:null})}</div>)}{(!targets.length||e.ability==='HYPNOSIS'||s[track]===top&&!s.played.some(c=>c.key==='225'))&&skip()}</>;
  }else if(['GAIN','DRAW','BREAK','SPONSOR_TOKENS','SPONSOR_MAGNET'].includes(kind))controls=button('효과 적용',{kind:'NONE'});
  else if(['HUNTER','SCAVENGING','PERCEPTION','RESISTANCE'].includes(kind)) {
    const reveal=s.revealedCards;
    controls=reveal?<><p role="status">선택 {chosen.length}/{selectionLimit}장 · 다른 카드로 바꾸려면 선택한 카드를 다시 누르세요.</p><p>{reveal.kind==='RESISTANCE'?'남길 목표 1장을 선택하세요.':`가져올 카드 ${reveal.keep}장을 선택하세요.`}</p><p>공개 {reveal.candidates.length}장{reveal.kind==='HUNTER'?' · 동물 카드 1장만 가져올 수 있습니다. 나머지는 버립니다.':''}</p><ArkNovaCardRow cards={reveal.candidates} selected={chosen} disabled={disabled} maxSelected={selectionLimit} onSelect={toggle} unavailable={c=>reveal.kind==='HUNTER'&&!ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL')?'선택 불가 · 동물 카드가 아니므로 버려질 카드':undefined}/>{button('선택 확정',reveal.kind==='RESISTANCE'?{kind:'KEEP_GOAL',choiceId:reveal.choiceId,keep:chosen[0]??''}:{kind:'KEEP',choiceId:reveal.choiceId,keep:chosen},reveal.kind==='RESISTANCE'?chosen.length!==1:chosen.length!==reveal.keep)}</>:button('카드 공개',{kind:'NONE'});
  } else if(kind==='POUCH'||kind==='SUNBATHING')controls=<><p role="status">선택 {chosen.length}/{selectionLimit}장 · 최대 수만큼 선택하면 추가 선택이 잠깁니다.</p><p>손패에서 최대 {guide.amount}장을 선택하세요. 0장도 선택할 수 있습니다.</p>{row(s.hand,true)}{button('선택한 카드 처리',{kind:'CARDS',cards:chosen},chosen.length>(guide.amount??0))}</>;
  else if(kind==='DIGGING')controls=<><p>교체할 카드 1장을 고르세요.</p>{row([...s.hand,...s.display.filter(c=>c!==null)])}{button('카드 교체',{kind:'DIG',zone:s.hand.some(c=>c.cardId===chosen[0])?'HAND':'DISPLAY',cardId:chosen[0]??''},chosen.length!==1)}{skip()}</>;
  else if(kind==='CARD_PICK'||kind==='SNAP'||kind==='WAZA_SNAP') {
    const cards=(kind==='CARD_PICK'?arkReachableDisplayCards(s):s.display.filter(c=>c!==null)).filter(c=>kind!=='WAZA_SNAP'||ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL'&&d.size<=2));
    controls=<>{row(cards)}{guide.mayRefill&&<label><input type="checkbox" checked={refill} onChange={e=>setRefill(e.target.checked)}/> 다음 카드 선택 전에 공개 카드 보충</label>}{button('선택한 카드 가져오기',{kind:'CARD',cardId:chosen[0]??null,refill:guide.mayRefill&&refill},chosen.length!==1)}{kind==='CARD_PICK'&&button('덱에서 뽑기',{kind:'CARD',cardId:null,refill:false},s.deckCount===0)}{(guide.amount===0||kind==='WAZA_SNAP'&&cards.length===0)&&button('대상 없음 · 계속',{kind:'NONE'})}</>;
  } else if(kind==='UPGRADE'||kind==='UPGRADE_OR_WORKER')controls=<><div className="ark-upgrade-options">{guide.actions.map(action=>action==='TAKE_X'?null:<ArkNovaUpgradeChoice key={action} action={action} disabled={disabled} onChoose={()=>onSelect({kind:'UPGRADE',action})}/>)}</div>{kind==='UPGRADE_OR_WORKER'&&button('직원 받기',{kind:'WORKER'},s.workers>=4)}</>;
  else if(['MOVE_ACTION','MULTIPLIER','EXTRA_ACTION'].includes(kind))controls=<>{guide.actions.map(action=>kind==='EXTRA_ACTION'?button(action==='TAKE_X'?'X 토큰 받기':ARK_ACTION_LABELS[action],{kind:'ACTION',action}):action==='TAKE_X'?null:kind==='MOVE_ACTION'?guide.slots.map(slot=>button(`${ARK_ACTION_LABELS[action]} → ${slot}번`,{kind:'MOVE',action,slot})):button(ARK_ACTION_LABELS[action],{kind:'MULTIPLIER',action}))}{(kind==='MOVE_ACTION'||kind==='EXTRA_ACTION')&&skip()}</>;
  else if(kind==='FREE_PARTNER') {
    const available=ARK_CONTINENTS.filter(c=>s.partnerSupply.includes(c)&&s.partners.length<(s.actions.some(a=>a.kind==='ASSOCIATION'&&a.upgraded)?4:2));
    controls=<><ArkNovaAssociationBenefits kind="PARTNER" count={s.partners.length}/>{available.map(continent=>button(ARK_TAG_LABELS[continent]??continent,{kind:'PARTNER',continent}))}{!available.length&&button('대상 없음 · 계속',{kind:'NONE'})}</>;
  } else if(kind==='FREE_UNIVERSITY')controls=<><ArkNovaAssociationBenefits kind="UNIVERSITY" count={s.universities.length}/>{ARK_SOLO_UNIVERSITIES.filter(u=>s.universitySupply.includes(u)).map(university=>button(ARK_UNIVERSITY_LABELS[university],{kind:'UNIVERSITY',university}))}{!s.universitySupply.length&&button('대상 없음 · 계속',{kind:'NONE'})}</>;
  else if(kind==='FREE_BUILD') {
    const hint=arkFreeBuildPlacementHint(s,placement);
    controls=<><p>건물을 고른 뒤 지도에서 기준 칸을 선택하세요.</p><select aria-label="무료 건물" value={selectedBuildingKind??placement?.building??''} onChange={e=>onBuilding(e.target.value)} disabled={disabled}><option value="">시설 선택</option>{guide.buildings.map(b=><option key={b} value={b}>{ARK_BUILDINGS[b]?.name??b}</option>)}</select><button disabled={disabled} onClick={onRotate}>회전 ↻</button><button disabled={disabled} onClick={onReflect}>반전 ↔</button>{hint&&<p role="status">{hint}</p>}{guide.buildings.length===0&&<p>현재 건설할 수 있는 시설이 없습니다. 이 효과를 포기할 수 있습니다.</p>}{button('무료 배치 확정',{kind:'BUILD',placement:placement??{building:'',anchor:{q:0,r:0},rotation:0,reflected:false}},hint!==null)}{skip()}</>;
  }
  else if(kind==='PAID_SPONSOR'||kind==='WAZA_PLAY') {
    const cards=s.hand.filter(c=>ARK_CARDS.some(d=>d.key===c.key&&(kind==='PAID_SPONSOR'?d.kind==='SPONSOR':d.kind==='ANIMAL'&&d.size<=2)));
    const animalAdvice=kind==='WAZA_PLAY'?arkWazaSelectionAdvice(s,chosen[0]??null,housingId):null;
    const sponsorAdvice=kind==='PAID_SPONSOR'?arkSponsorSelectionAdvice(s,chosen[0]??null,placement?{anchor:placement.anchor,rotation:placement.rotation}:null,'PAID_EFFECT'):null;
    controls=<><p>{kind==='WAZA_PLAY'?'손패의 크기 1–2 동물을 선택하세요. 할인을 반영한 비용을 지불하고 입주 조건을 충족해야 합니다.':'손패의 후원자를 선택하고 후원 등급만큼 돈을 냅니다. 고유 건물이 있다면 지도에서 위치도 선택하세요.'}</p>{row(cards)}{kind==='WAZA_PLAY'&&cards.length===0&&<p>손패에 소형 동물이 없습니다. 이 효과를 포기하면 소형 동물 획득으로 이어집니다.</p>}{animalAdvice&&<div className="ark-admission-guide" aria-label="추가 동물 입주 조건"><strong>실제 비용 {animalAdvice.price} · 보유 {s.money}</strong>{animalAdvice.issues.map(text=><p className="ark-admission-missing" key={text}>{text}</p>)}<p>입주 가능한 우리 {animalAdvice.housingIds.length}개</p>{animalAdvice.housingHint&&<p role="status">{animalAdvice.housingHint}</p>}{animalAdvice.flock&&onClearHousing&&<button disabled={disabled} onClick={onClearHousing}>무리 생활 · 새 우리 없이 입주{housingId===null?' ✓':''}</button>}</div>}{kind==='PAID_SPONSOR'&&cards.length===0&&<p>손패에 후원자가 없습니다. 이 효과를 포기할 수 있습니다.</p>}{sponsorAdvice&&<div className="ark-admission-guide" aria-label="효과 후원자 사용 조건"><strong>지불할 돈 {sponsorAdvice.price} · 보유 {s.money}</strong>{sponsorAdvice.issues.map(text=><p className="ark-admission-missing" key={text}>{text}</p>)}</div>}{kind==='PAID_SPONSOR'&&<button disabled={disabled} onClick={onRotate}>고유 건물 회전 ↻</button>}{button('카드 사용',{kind:kind==='WAZA_PLAY'?'ANIMAL':'SPONSOR',card:{cardId:chosen[0]??'',housingId:kind==='WAZA_PLAY'?housingId:null,...(placement&&kind==='PAID_SPONSOR'&&cards.some(c=>c.cardId===chosen[0]&&Object.hasOwn(ARK_UNIQUE_BUILDINGS,c.key))?{uniquePlacement:{anchor:placement.anchor,rotation:placement.rotation}}:{})}},chosen.length!==1||!!sponsorAdvice?.issues.length||kind==='WAZA_PLAY'&&(!animalAdvice||animalAdvice.issues.length>0||animalAdvice.housingHint!==null))}{skip()}</>;
  } else if(kind==='MOVE_TO_SPECIAL') {
    const advice=arkSpecialMoveAdvice(s,chosen[0]??null,housingId);
    const cards=playedAnimals.filter(c=>!guide.specialMove?.moved.includes(c.cardId));
    controls=<><p>이동할 동물을 고르고 비울 기존 우리를 선택하세요.</p>{advice.destination&&<p>이동 목적지: {ARK_BUILDINGS[advice.destination.kind]?.name??'특수 우리'} · 사용 용량 {advice.destination.used}/{ARK_BUILDINGS[advice.destination.kind]?.capacity}</p>}{row(cards)}{chosen.length===1&&onChooseHousing&&<label>비울 기존 우리 <select aria-label="비울 기존 우리" disabled={disabled} value={housingId??''} onChange={e=>onChooseHousing(e.target.value||null)}><option value="">{advice.housingIds.length?'우리를 선택하세요':'비울 우리 없음'}</option>{s.buildings.filter(b=>advice.housingIds.includes(b.id)).map(b=><option key={b.id} value={b.id}>{ARK_BUILDINGS[b.kind]?.name??b.kind} · {b.cells[0]!.q+1}열 {b.cells[0]!.r+Math.ceil(b.cells[0]!.q/2)+1}칸</option>)}</select></label>}{advice.issues.map(text=><p role="status" key={text}>{text}</p>)}{button('동물 이동',{kind:'MOVE_ANIMAL',cardId:chosen[0]??'',housingId},chosen.length!==1||advice.issues.length>0)}{skip()}</>;
  }
  else if(kind==='ARCHAEOLOGIST') {
    const advice=arkMapBonusAdvice(s,cell);
    controls=<><p>선택 가능한 지도 보너스 {advice.available.length}개</p><p role="status">{advice.available.length===0?'남아 있는 지도 보너스가 없습니다. 계속을 눌러주세요.':advice.reason??`선택한 보상: ${advice.label}`}</p>{button('선택한 지도 보너스 받기',{kind:'MAP_BONUS',cell:cell??{q:0,r:0}},advice.reason!==null)}{advice.available.length===0&&button('대상 없음 · 계속',{kind:'NONE'})}</>;
  }
  else if(kind==='ASSERTION'||kind==='DOMINANCE')controls=<>{row(s.reserveChoices)}{button('프로젝트 가져오기',{kind:'PROJECT',cardId:chosen[0]??null},chosen.length!==1)}{s.reserveChoices.length===0&&button('대상 없음 · 계속',{kind:'PROJECT',cardId:null})}</>;
  else if(kind==='CONSERVATION_BONUS')controls=<><p>남은 보너스 타일 하나 또는 돈 5 중 하나만 선택하세요. 돈 5는 추가 지급되지 않습니다.</p><div className="ark-bonus-options">{([...guide.bonuses,'MONEY_5'] as const).map(tile=><button key={tile} className="ark-bonus-option" disabled={disabled} onClick={()=>onSelect({kind:'BONUS',tile:tile==='MONEY_5'?null:tile})}><ArkNovaBonusTile tile={tile}/><span>{tile==='MONEY_5'?'돈 5 받기':'이 타일 선택'}</span></button>)}</div></>;
  else if(kind==='DISCARD_GOAL')controls=<>{row(s.goals)}{button('선택한 목표 버리기',{kind:'GOAL',discard:chosen[0]??''},chosen.length!==1)}</>;
  else if(kind==='WAZA_FOCUS')controls=<>{button('소형 동물',{kind:'FOCUS',focus:'SMALL'})}{button('대형 동물',{kind:'FOCUS',focus:'LARGE'})}</>;
  else controls=<p role="alert">이 효과의 선택 화면을 불러오지 못했습니다.</p>;
  return <section className="ark-live-effect" aria-label="현재 카드 효과"><h2>{arkEffectSummary(kind,guide)}</h2>{source&&<p>{arkCardName(source.key)}</p>}{controls}</section>;
}
