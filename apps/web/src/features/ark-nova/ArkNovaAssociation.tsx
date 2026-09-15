import {arkMapProjectBonuses,ArkProjectBonusSchema} from '@hangul-rummikub/shared';
import * as v from 'valibot';
import {ARK_UNIVERSITY_LABELS,ArkNovaAssociationBenefits} from './ArkNovaAssociationBenefits.js';
import {arkProjectCopy,arkProjectSlotCopy} from './project-copy.js';
import {ArkTagBadge} from './ArkTagBadge.js';
import {arkAssociationAdvice,arkDonationAdvice} from './association-advice.js';
import {useEffect,useState} from 'react';
import {occupyArkSoloDonation,ARK_DONATION_COSTS,arkProjectEligibility,arkReleaseHousingChoices,ARK_CONTINENTS,ARK_SOLO_UNIVERSITIES,ARK_TAG_LABELS,ARK_PROJECTS,ARK_CARDS,ARK_BUILDINGS,arkCardName,type ArkSoloView,type ArkAssociationTask,type ArkProjectBonus} from '@hangul-rummikub/shared';
const bonusLabels:Record<ArkProjectBonus,string>={WORKER:'직원 1명',PAID_SPONSOR:'후원자 사용 · 등급만큼 돈 지불',UPGRADE:'행동 업그레이드',FREE_UNIVERSITY:'대학 1개',SPECIAL_ENCLOSURE:'파충류관 또는 대형 조류관 무료 건설',MOVE_1_TWICE:'행동 카드 2회 → 1번',APPEAL_2:'매력 2',FREE_PARTNER:'제휴 동물원 1개',SNAP_1:'카드 낚아채기',ENCLOSURE_2:'2칸 우리',MONEY_5:'돈 5',CONSERVATION_1:'보전 1',REPUTATION_2:'평판 2',MONEY_12:'돈 12',X_3:'X 토큰 3'};
export function ArkNovaAssociation({state:s,disabled,onTask,onDonate,x=0}:{state:ArkSoloView;x?:number;disabled:boolean;onTask(task:ArkAssociationTask):void;onDonate?():void}) {
  const [projectId,setProject]=useState(s.baseProjects[0]?.cardId??''),[animalId,setAnimal]=useState(''),[housingId,setHousing]=useState(''),[tokens,setTokens]=useState<string[]>([]);
  const availableBonuses=arkMapProjectBonuses(s.mapId).map(b=>v.parse(ArkProjectBonusSchema,b)).filter(b=>!s.activatedProjectBonuses.includes(b));
  const [chosenBonus,setBonus]=useState<ArkProjectBonus|null>(null);
  const bonus=chosenBonus&&availableBonuses.includes(chosenBonus)?chosenBonus:availableBonuses[0];
  const projects=[...s.baseProjects,...s.playedProjects,...s.hand,...s.display.filter(c=>c!==null)].filter(c=>ARK_PROJECTS.some(p=>p.key===c.key));
  useEffect(()=>{setAnimal('');setHousing('');setTokens([]);},[s.revision]);
  const project=projects.find(c=>c.cardId===projectId),definition=project&&ARK_PROJECTS.find(p=>p.key===project.key);
  const selectedAnimal=s.played.find(c=>c.cardId===animalId);
  const releaseChoices=selectedAnimal?arkReleaseHousingChoices(s.buildings,selectedAnimal,s.played.some(c=>c.key==='219'),s.mapId):[];
  const eligibleAnimals=definition?new Set([0,1,2].flatMap(slot=>arkProjectEligibility(definition.key,slot,s).animals)):new Set<string>();
  function taskButton(task:ArkAssociationTask,label:string){
    const reasons=arkAssociationAdvice(s,task,x);
    const owned=task.kind==='PARTNER'?s.partners.includes(task.continent):task.kind==='UNIVERSITY'?s.universities.includes(task.university):false;
    return <div key={label} className={`ark-task-choice ${owned?'is-owned':''}`}><button disabled={disabled||reasons.length>0} onClick={()=>onTask(task)}>{task.kind==='PARTNER'?<ArkTagBadge tag={task.continent}/>:label}{owned?' · 보유 중':!disabled&&reasons.length===0?' · 가능':''}</button>{reasons.length>0&&<p className="ark-task-reason">{reasons.join(' · ')}</p>}</div>;
  }
  const donation=arkDonationAdvice(s);
  const nextDonation=occupyArkSoloDonation(s.donations).blocked;
  const staff=(kind:ArkAssociationTask['kind'])=><div className="ark-association-staff" aria-label={`${kind} 배치 직원 ${s.taskWorkers[kind]??0}명`}><span aria-hidden="true">♟</span> 배치 {s.taskWorkers[kind]??0}명 · {(s.taskWorkers[kind]??0)>=3?'휴식 전 재사용 불가':`다음 업무에 ${(s.taskWorkers[kind]??0)===0?1:2}명 필요`}</div>;
  return <section className="ark-live-association ark-association-board" aria-label="협회판">
    <header><div><small>ASSOCIATION</small><h2>협회판</h2></div><strong>대기 직원 {s.workers-s.busyWorkers} / {s.workers}명</strong></header>
    <p>{s.associationWork?`협회 활동 중 · 남은 행동력 ${s.associationWork.remaining}`:disabled?'현재 행동을 마치면 협회 업무를 선택할 수 있습니다.':'업무를 선택하면 협회 행동을 시작합니다. X 토큰은 현재 행동 영역에서 추가할 수 있습니다.'}</p>
    <div className="ark-association-lanes">
      <section className="ark-association-donation"><h3><b>II</b> 기부</h3><p>{s.table?'돈을 내고 보전 1 · 점유된 기부 칸은 모두 공유합니다.':'돈을 내고 보전 1 · 솔로는 휴식마다 가장 저렴한 빈 칸을 막습니다.'}</p><div className="ark-donation-spaces">{ARK_DONATION_COSTS.map((cost,i)=><span key={i} className={s.donations.includes(i)?'is-occupied':''}>돈 {cost} {s.donations.includes(i)?'■ 점유':i===nextDonation?'다음 기부':i===7?'∞':'□'}</span>)}</div><button disabled={disabled||!onDonate||donation.issues.length>0} onClick={onDonate}>돈 {donation.cost} 기부 · 보전 +1</button><p className="ark-task-reason">{donation.issues.join(' · ')}</p></section>
      <section><h3><b>2</b> 평판</h3><div className="ark-association-emblem" aria-hidden="true">🎓</div><p>평판 +2</p>{taskButton({kind:'REPUTATION'},'평판 올리기')}{staff('REPUTATION')}</section>
      <section><h3><b>3</b> 제휴 동물원</h3><div className="ark-partner-tiles">{ARK_CONTINENTS.map(continent=>taskButton({kind:'PARTNER',continent},ARK_TAG_LABELS[continent]??continent))}</div><ArkNovaAssociationBenefits mapId={s.mapId} kind="PARTNER" count={s.partners.length}/>{staff('PARTNER')}</section>
      <section><h3><b>4</b> 대학</h3><div className="ark-university-tiles">{ARK_SOLO_UNIVERSITIES.map(university=>taskButton({kind:'UNIVERSITY',university},ARK_UNIVERSITY_LABELS[university]))}</div><ArkNovaAssociationBenefits mapId={s.mapId} kind="UNIVERSITY" count={s.universities.length}/>{staff('UNIVERSITY')}</section>
      <section><h3><b>{s.played.some(c=>c.key==='203')?4:5}</b> 프로젝트</h3><div className="ark-association-emblem" aria-hidden="true">♜</div><p>아래 프로젝트를 선택한 뒤 지원할 보상 칸을 고르세요.</p>{staff('PROJECT')}</section>
    </div>
    <section className="ark-association-projects" aria-label="보전 프로젝트 지원">
      <h3>보전 프로젝트</h3><div className="ark-project-tiles">{[...s.baseProjects,...s.playedProjects].map(card=>{
        const d=ARK_PROJECTS.find(p=>p.key===card.key);
        return <button key={card.cardId} aria-pressed={projectId===card.cardId} onClick={()=>{setProject(card.cardId);setAnimal('');setHousing('');setTokens([]);}}><strong>{arkCardName(card.key)}</strong><span>{d&&arkProjectCopy(d)}</span><span className="ark-project-spaces">{d?.slots.map((_,i)=><span key={i}>{arkProjectSlotCopy(d,i)}{s.projectSupports.some(p=>p.cardId===card.cardId&&p.slot===i)?' · ■ 지원 완료':s.table?.occupiedProjects.some(p=>p.cardId===card.cardId&&p.slot===i)?' · ■ 점유/사용 불가':''}</span>)}</span></button>;
      })}</div>
      <label>프로젝트 <select disabled={disabled} value={projectId} onChange={e=>{setProject(e.target.value);setAnimal('');setHousing('');setTokens([]);}}><option value="">선택하세요</option>{projects.map(c=><option key={c.cardId} value={c.cardId}>{arkCardName(c.key)}</option>)}</select></label>
      {definition&&<><p>{arkProjectCopy(definition)}</p>
        {(definition.kind==='BREED'||definition.kind==='RELEASE')&&<label>{definition.kind==='RELEASE'?'방사할 동물':'번식할 동물'} <select value={animalId} disabled={disabled} onChange={e=>{setAnimal(e.target.value);setHousing('');}}><option value="">선택하세요</option>{s.played.filter(c=>ARK_CARDS.find(d=>d.key===c.key)?.kind==='ANIMAL').map(c=><option key={c.cardId} value={c.cardId} disabled={!eligibleAnimals.has(c.cardId)}>{arkCardName(c.key)}{eligibleAnimals.has(c.cardId)?' · 가능':' · 조건 미달'}</option>)}</select></label>}
        {definition.kind==='RELEASE'&&<label>비울 우리 <select value={housingId} disabled={disabled} onChange={e=>setHousing(e.target.value)}><option value="" disabled={releaseChoices.length>0}>{releaseChoices.length?'비울 우리를 선택하세요':'별도 우리 없음'}</option>{s.buildings.filter(b=>releaseChoices.includes(b.id)).map(b=><option key={b.id} value={b.id}>{ARK_BUILDINGS[b.kind]?.name??'특수 건물'} · {b.cells[0]!.q+1}열</option>)}</select></label>}
        <label>지도 보너스 <select value={bonus??''} disabled={disabled} onChange={e=>{const b=availableBonuses.find(b=>b===e.target.value);if(b)setBonus(b);}}>{availableBonuses.map(b=><option key={b} value={b}>{bonusLabels[b]}</option>)}</select></label>
        {s.baseProjects.some(c=>c.cardId===projectId)&&s.played.filter(c=>(c.key==='215'||c.key==='218')&&(s.sponsorTokens[c.cardId]??0)>0).map(c=><label key={c.cardId}><input type="checkbox" disabled={disabled} checked={tokens.includes(c.cardId)} onChange={()=>setTokens(ids=>ids.includes(c.cardId)?ids.filter(id=>id!==c.cardId):[...ids,c.cardId])}/>{arkCardName(c.key)} 토큰</label>)}
        {definition.kind==='RELEASE'&&<p>이 동물에 맞는 우리만 표시합니다. 특수 우리 용량을 먼저 반환하며, 방사하면 인쇄된 매력만 차감됩니다.</p>}
        <div>{([0,1,2] as const).map(slot=>{
          if(!definition.slots[slot])return null;
          const task:ArkAssociationTask={kind:'PROJECT',cardId:projectId,slot,bonus:bonus??'SNAP_1',animalId:animalId||null,housingId:housingId||null,sponsorTokenIds:tokens};
          const reasons=arkAssociationAdvice(s,task,x);
          if(!bonus)reasons.push('남은 지도 보너스가 없습니다.');
          return <div key={slot} className="ark-task-choice"><button disabled={disabled||reasons.length>0} onClick={()=>onTask(task)}>{arkProjectSlotCopy(definition,slot)}{reasons.length===0?' · 지원 가능':''}</button>{reasons.length>0&&<p className="ark-task-reason">{reasons.join(' · ')}</p>}</div>;
        })}</div>
      </>}
    </section>
  </section>;
}
