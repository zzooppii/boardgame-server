import {arkProjectCopy,arkProjectSlotCopy} from './project-copy.js';
import {useState} from 'react';
import {ARK_CONTINENTS,ARK_SOLO_UNIVERSITIES,ARK_TAG_LABELS,ARK_PROJECTS,ARK_CARDS,ARK_BUILDINGS,ARK_MAP_A_PROJECT_BONUSES,arkCardName,type ArkSoloView,type ArkAssociationTask,type ArkProjectBonus} from '@hangul-rummikub/shared';
const universities={HAND_LIMIT:'손패 한도 6 · 연구 1',RESEARCH_2:'연구 아이콘 2',RESEARCH_REPUTATION:'연구 1 · 평판 2'};
const bonusLabels:Record<ArkProjectBonus,string>={SNAP_1:'카드 낚아채기',ENCLOSURE_2:'2칸 우리',MONEY_5:'돈 5',CONSERVATION_1:'보전 1',REPUTATION_2:'평판 2',MONEY_12:'돈 12',X_3:'X 토큰 3'};
export function ArkNovaAssociation({state:s,disabled,onTask}:{state:ArkSoloView;disabled:boolean;onTask(task:ArkAssociationTask):void}) {
  const [projectId,setProject]=useState(''),[animalId,setAnimal]=useState(''),[housingId,setHousing]=useState(''),[tokens,setTokens]=useState<string[]>([]);
  const availableBonuses=ARK_MAP_A_PROJECT_BONUSES.filter(b=>!s.activatedProjectBonuses.includes(b));
  const [chosenBonus,setBonus]=useState<ArkProjectBonus|null>(null);
  const bonus=chosenBonus&&availableBonuses.includes(chosenBonus)?chosenBonus:availableBonuses[0];
  const projects=[...s.baseProjects,...s.playedProjects,...s.hand,...s.display.filter(c=>c!==null)].filter(c=>ARK_PROJECTS.some(p=>p.key===c.key));
  const project=projects.find(c=>c.cardId===projectId),definition=project&&ARK_PROJECTS.find(p=>p.key===project.key);
  return <section className="ark-live-association"><h3>협회 업무 선택</h3><p>평판 2 · 제휴 3 · 대학 4 · 프로젝트 {s.played.some(c=>c.key==='203')?4:5} 행동력. 같은 업무를 다시 하면 직원 2명이 필요합니다.</p>
    <button disabled={disabled} onClick={()=>onTask({kind:'REPUTATION'})}>평판 올리기</button>
    <details><summary>제휴 동물원</summary>{ARK_CONTINENTS.filter(c=>s.partnerSupply.includes(c)).map(continent=><button key={continent} disabled={disabled} onClick={()=>onTask({kind:'PARTNER',continent})}>{ARK_TAG_LABELS[continent]}</button>)}</details>
    <details><summary>대학</summary>{ARK_SOLO_UNIVERSITIES.filter(u=>s.universitySupply.includes(u)).map(university=><button key={university} disabled={disabled} onClick={()=>onTask({kind:'UNIVERSITY',university})}>{universities[university]}</button>)}</details>
    <details><summary>보전 프로젝트 지원</summary>
      <label>프로젝트 <select disabled={disabled} value={projectId} onChange={e=>{setProject(e.target.value);setAnimal('');setHousing('');setTokens([]);}}><option value="">선택하세요</option>{projects.map(c=><option key={c.cardId} value={c.cardId}>{arkCardName(c.key)}</option>)}</select></label>
      {definition&&<><p>{arkProjectCopy(definition)}</p>
        {(definition.kind==='BREED'||definition.kind==='RELEASE')&&<label>{definition.kind==='RELEASE'?'방사할 동물':'번식할 동물'} <select value={animalId} disabled={disabled} onChange={e=>setAnimal(e.target.value)}><option value="">선택하세요</option>{s.played.filter(c=>ARK_CARDS.find(d=>d.key===c.key)?.kind==='ANIMAL').map(c=><option key={c.cardId} value={c.cardId}>{arkCardName(c.key)}</option>)}</select></label>}
        {definition.kind==='RELEASE'&&<label>비울 우리 <select value={housingId} disabled={disabled} onChange={e=>setHousing(e.target.value)}><option value="">별도 우리 없음</option>{s.buildings.filter(b=>b.occupied||b.used>0).map(b=><option key={b.id} value={b.id}>{ARK_BUILDINGS[b.kind]?.name??'특수 건물'} · {b.cells[0]!.q+1}열</option>)}</select></label>}
        <label>지도 보너스 <select value={bonus??''} disabled={disabled} onChange={e=>{const b=availableBonuses.find(b=>b===e.target.value);if(b)setBonus(b);}}>{availableBonuses.map(b=><option key={b} value={b}>{bonusLabels[b]}</option>)}</select></label>
        {s.baseProjects.some(c=>c.cardId===projectId)&&s.played.filter(c=>(c.key==='215'||c.key==='218')&&(s.sponsorTokens[c.cardId]??0)>0).map(c=><label key={c.cardId}><input type="checkbox" disabled={disabled} checked={tokens.includes(c.cardId)} onChange={()=>setTokens(ids=>ids.includes(c.cardId)?ids.filter(id=>id!==c.cardId):[...ids,c.cardId])}/>{arkCardName(c.key)} 토큰</label>)}
        <div>{([0,1,2] as const).map(slot=>{const reward=definition.slots[slot];return reward&&<button key={slot} disabled={disabled||!bonus||s.projectSupports.some(p=>p.cardId===projectId&&p.slot===slot)||(definition.kind==='RELEASE'||definition.kind==='BREED')&&!animalId} onClick={()=>{if(bonus)onTask({kind:'PROJECT',cardId:projectId,slot,bonus,animalId:animalId||null,housingId:housingId||null,sponsorTokenIds:tokens});}}>{arkProjectSlotCopy(definition,slot)}</button>;})}</div>
      </>}
    </details>
  </section>;
}
