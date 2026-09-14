import {useEffect,useState} from 'react';
import {ARK_UNIQUE_BUILDINGS,arkUniqueShape,ARK_ACTION_LABELS,ARK_BUILDINGS,ARK_SOLO_ROUND_TURNS,arkCellKey,arkShape,type ArkCell,type ArkSoloView,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {arkActionControls,arkBuildPlacementHint,arkDisplayedStrength,arkZooSelectionHint,arkReachableDisplayCards} from './action-controls.js';
import {ArkNovaResult} from './ArkNovaResult.js';
import {ArkNovaBoard} from './ArkNovaBoard.js';
import {ArkNovaCardRow,ArkNovaDisplay} from './ArkNovaCards.js';
import {ArkNovaEffects,arkEffectSummary} from './ArkNovaEffects.js';
import {ArkNovaAssociation} from './ArkNovaAssociation.js';
import {ArkNovaRewards} from './ArkNovaRewards.js';
import type {ArkCue} from './sound.js';

type Props={state:ArkSoloView;disabled:boolean;onCommand(command:ArkSoloCommand):void;onCue(cue:ArkCue):void};
const rotations=[0,1,2,3,4,5] as const;
/** The table emits intents; costs, legal targets and transitions stay authoritative on the server. */
export function ArkNovaTable({state:s,disabled,onCommand:send,onCue}:Props) {
  const [chosen,setChosen]=useState<string[]>([]),[market,setMarket]=useState<string|null>(null),[x,setX]=useState(0);
  const [anchor,setAnchor]=useState<ArkCell|null>(null),[building,setBuilding]=useState('ENCLOSURE_1'),[rotation,setRotation]=useState<typeof rotations[number]>(0),[reflected,setReflected]=useState(false);
  const [effectUnique,setEffectUnique]=useState<string|null>(null);
  const [buildMode,setBuildMode]=useState(false),[gainReputation,setGainReputation]=useState(true);
  useEffect(()=>{setChosen([]);setMarket(null);setAnchor(null);setX(0);setBuildMode(false);setEffectUnique(null);},[s.revision]);
  const pending=s.pending;
  const actionAvailable=!disabled&&s.phase==='PLAYING'&&s.progress.stage==='ACTION'&&!pending&&!s.activeBuild&&!s.associationWork&&!s.zooWork;
  const selectedBuilding=anchor?s.buildings.find(b=>b.cells.some(c=>arkCellKey(c)===arkCellKey(anchor))):undefined;
  const rotate=()=>{setRotation(r=>rotations[(r+1)%6]!);onCue('ROTATE');};
  const reflect=()=>{setReflected(f=>!f);onCue('ROTATE');};
  const placement=anchor?{building,anchor,rotation,reflected}:null;
  const placementHint=placement&&(buildMode||s.activeBuild)?arkBuildPlacementHint(s,placement):null;
  const selectedCard=[...s.hand,...s.display.filter(c=>c!==null)].find(c=>c.cardId===(market??chosen[0]));
  const zooHint=arkZooSelectionHint(s,market??(chosen.length===1?chosen[0]!:null));
  const uniqueKey=effectUnique??(selectedCard&&Object.hasOwn(ARK_UNIQUE_BUILDINGS,selectedCard.key)?selectedCard.key:null);
  const select=(id:string)=>{setMarket(null);setChosen(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);onCue('CARD');};
  return <div className="ark-live-table">
    <div className="ark-live-status" aria-label="내 동물원 자원"><span>돈 <b>{s.money}</b></span><span>매력 <b>{s.appeal}</b></span><span>보전 <b>{s.conservation}</b></span><span>평판 <b>{s.reputation}</b></span><span>X <b>{s.x}</b></span><span>직원 <b>{s.workers-s.busyWorkers}/{s.workers}</b></span></div>
    <div className="ark-live-progress"><strong>{s.phase==='FINISHED'?'최종 정산':`${s.progress.round}라운드`}</strong><span>{s.progress.turnsCompleted}/27턴 완료 · 이번 라운드 {s.progress.turnInRound}/{ARK_SOLO_ROUND_TURNS[s.progress.round-1]}</span></div>
    <ArkNovaResult state={s}/>
    {s.progress.stage==='SETUP'&&<section className="ark-live-setup-hand"><h2>시작 손패 선택 · 8장 중 4장</h2><ArkNovaCardRow cards={s.hand} selected={chosen} disabled={disabled} onSelect={select}/></section>}
    <div className="ark-live-layout"><ArkNovaBoard invalid={placementHint!==null} buildings={s.buildings} selected={anchor} ghost={anchor&&uniqueKey?arkUniqueShape(uniqueKey,anchor,rotation):placement&&(buildMode||s.activeBuild||s.activeEffect?.kind==='FREE_BUILD')?arkShape(building,anchor!,rotation,reflected):[]} disabled={disabled||s.phase==='FINISHED'} onSelect={cell=>{setAnchor(cell);onCue('SELECT');}} onRotate={rotate} onReflect={reflect} onCancel={()=>setAnchor(null)}/>
      <section className="ark-live-controls" aria-label="현재 행동">
        {s.progress.stage==='SETUP'&&<><h2>동물원의 첫 계획</h2><p>위 카드 8장 중 시작 손패로 남길 4장을 선택하세요.</p><button disabled={disabled||chosen.length!==4} onClick={()=>send({kind:'INITIAL_HAND',keep:chosen})}>선택한 {chosen.length}/4장으로 시작</button></>}
        {(pending?.kind==='BREAK_DISCARD'||pending?.kind==='DRAW_DISCARD')&&<><h2>{pending.kind==='BREAK_DISCARD'?'휴식 · 손패 정리':'카드 버리기'}</h2><p>버릴 카드 {pending.count}장을 선택하세요.</p><button disabled={disabled||chosen.length!==pending.count} onClick={()=>send({kind:'DISCARD',choiceId:pending.choiceId,cards:chosen})}>{chosen.length}/{pending.count}장 버리기</button></>}
        {pending?.kind==='FINAL_GOAL'&&<><h2>최종 목표 선택</h2><p>목표 카드 중 버릴 1장을 선택하세요.</p><ArkNovaCardRow cards={s.goals} selected={chosen} disabled={disabled} onSelect={id=>setChosen([id])}/><button disabled={disabled||chosen.length!==1} onClick={()=>send({kind:'FINAL_GOAL',choiceId:pending.choiceId,discard:chosen[0]!})}>선택한 목표 버리기</button></>}
        {pending?.kind==='DRAW_PICK'&&<><h2>카드 가져오기 · {pending.remaining}장 남음</h2><button disabled={disabled} onClick={()=>send({kind:'PICK_CARD',choiceId:pending.choiceId,cardId:null})}>덱에서 뽑기</button><button disabled={disabled||!arkReachableDisplayCards(s).some(c=>c.cardId===market)} onClick={()=>send({kind:'PICK_CARD',choiceId:pending.choiceId,cardId:market})}>선택한 공개 카드 가져오기</button></>}
        {actionAvailable&&<>{s.extraAction&&!s.extraAction.started&&<p role="status">추가 행동: {s.extraAction.action==='TAKE_X'?'X 토큰 받기':ARK_ACTION_LABELS[s.extraAction.action]}</p>}{s.repeatedAction&&<p role="status">{ARK_ACTION_LABELS[s.repeatedAction.action]} 반복 · 남은 {s.repeatedAction.remaining}회 · 기본 행동력 {s.repeatedAction.baseStrength}</p>}<label>X 토큰 추가 <select value={x} onChange={e=>setX(Number(e.target.value))}>{Array.from({length:s.x+1},(_,i)=><option key={i} value={i}>{i}개</option>)}</select></label>
          <label><input type="checkbox" checked={gainReputation} onChange={e=>setGainReputation(e.target.checked)}/> 동물 II · 행동력 5 이상일 때 평판 받기</label><div className="ark-live-actions">{s.actions.map((a,i)=><div key={a.kind}><strong>{i+1} · {ARK_ACTION_LABELS[a.kind]} {a.upgraded?'II':'I'}</strong><small>행동력 {arkDisplayedStrength(s,a.kind,x)}</small>
            <fieldset className="ark-live-action-options" disabled={!arkActionControls(s,a.kind).regular}>{a.kind==='CARDS'?<><button onClick={()=>send({kind:'DRAW',x})}>카드 뽑기</button><button disabled={!market||arkDisplayedStrength(s,a.kind,x)<(a.upgraded?3:5)} onClick={()=>send({kind:'SNAP',x,cardId:market!})}>공개 카드 낚아채기</button></>:a.kind==='BUILD'?<button onClick={()=>setBuildMode(true)}>건물 배치</button>:a.kind==='ANIMALS'||a.kind==='SPONSORS'?<><button disabled={a.kind==='ANIMALS'&&arkDisplayedStrength(s,a.kind,x)<2} onClick={()=>send({kind:'BEGIN_ZOO',action:a.kind==='ANIMALS'?'ANIMALS':'SPONSORS',x,gainReputation})}>{ARK_ACTION_LABELS[a.kind]} 카드 사용</button>{a.kind==='SPONSORS'&&<button onClick={()=>send({kind:'FUNDRAISE',x})}>모금</button>}</>:<ArkNovaAssociation state={s} disabled={disabled} onTask={task=>send({kind:'ASSOCIATION',x,task})}/>}</fieldset>
            <button disabled={!arkActionControls(s,a.kind).takeX||s.x>=5} onClick={()=>send({kind:'TAKE_X',action:a.kind})}>X 토큰 받기</button></div>)}</div></>}
        {(buildMode||s.activeBuild)&&!pending&&<><h2>건물 배치</h2><label>시설 <select value={building} disabled={disabled} onChange={e=>setBuilding(e.target.value)}>{Object.entries(ARK_BUILDINGS).map(([id,b])=><option key={id} value={id}>{b.name}</option>)}</select></label><p role="status">{placementHint??'지도에서 기준 칸을 고르고 모양을 확인하세요.'}</p><button disabled={disabled} onClick={rotate}>회전 ↻</button><button disabled={disabled} onClick={reflect}>반전 ↔</button><button disabled={disabled||!placement||placementHint!==null} onClick={()=>{if(placement)send(s.activeBuild?{kind:'BUILD_MORE',placement}:{kind:'BUILD',x,placement});}}>배치 확정</button>{s.activeBuild&&<button disabled={disabled} onClick={()=>send({kind:'END_BUILD'})}>건설 마치기</button>}</>}
        {s.zooWork&&!pending&&<><h2>{ARK_ACTION_LABELS[s.zooWork.action]} 카드 사용</h2><p>{s.zooWork.action==='ANIMALS'?`남은 동물 ${s.zooWork.remaining}장`:`남은 후원 행동력 ${s.zooWork.remaining}`}</p><p>{s.zooWork.upgraded?'손패 또는 평판 범위 안의 공개 카드':'손패'} 1장을 선택하세요. 동물은 지도에서 입주할 우리를 고르세요.</p>{zooHint&&<p role="status">{zooHint}</p>}{uniqueKey&&<><p>지도에서 고유 건물 위치를 선택하세요.</p><button disabled={disabled} onClick={rotate}>고유 건물 회전 ↻</button></>}<p>선택한 우리: {selectedBuilding?ARK_BUILDINGS[selectedBuilding.kind]?.name??'특수 시설':'없음'}</p><button disabled={disabled||zooHint!==null||chosen.length+(market?1:0)!==1} onClick={()=>send({kind:'PLAY_ZOO',card:{cardId:market??chosen[0]!,housingId:s.zooWork?.action==='ANIMALS'?selectedBuilding?.id??null:null,...(uniqueKey&&anchor?{uniquePlacement:{anchor,rotation}}:{})}})}>카드 사용</button><button disabled={disabled} onClick={()=>send({kind:'END_ZOO'})}>카드 사용 마치기</button></>}
        {s.associationWork&&!pending&&<><h2>협회 활동</h2><p>남은 행동력 {s.associationWork.remaining}</p><ArkNovaAssociation state={s} disabled={disabled} onTask={task=>send({kind:'ASSOCIATION_MORE',task})}/><button disabled={disabled} onClick={()=>send({kind:'DONATE'})}>기부</button><button disabled={disabled} onClick={()=>send({kind:'END_ASSOCIATION'})}>협회 활동 마치기</button></>}
        <ArkNovaRewards state={s} disabled={disabled} onCommand={send}/>
        {pending?.kind==='EFFECT'&&<section aria-label="효과 선택"><h2>카드 효과</h2>{s.effectOptions.map(e=><button key={e.id} disabled={disabled} onClick={()=>send({kind:'SELECT_EFFECT',choiceId:pending.choiceId,effectId:e.id})}>{arkEffectSummary(e.kind,e.guide)}</button>)}{s.activeEffect&&<ArkNovaEffects key={s.revision} state={s} disabled={disabled} onSelect={selection=>send({kind:'EFFECT',choiceId:pending.choiceId,effectId:s.activeEffect!.id,selection})} placement={placement} cell={anchor} housingId={selectedBuilding?.id??null} onUniqueCard={setEffectUnique} onBuilding={setBuilding} onRotate={rotate} onReflect={reflect}/>}</section>}
        {s.repeatedAction&&actionAvailable&&<button onClick={()=>send({kind:'END_REPEAT'})}>반복 행동 마치기</button>}
        {s.extraAction&&!s.extraAction.started&&actionAvailable&&<button onClick={()=>send({kind:'CANCEL_EXTRA'})}>추가 행동 포기</button>}
      </section></div>
    <section><h2>공개 카드 <small>덱 {s.deckCount}장</small></h2><ArkNovaDisplay cards={s.display} selected={market} disabled={disabled||s.phase==='FINISHED'||s.progress.stage==='SETUP'||pending?.kind==='FINAL_GOAL'} onSelect={id=>{setChosen([]);setMarket(m=>m===id?null:id);onCue('CARD');}}/></section>
    {s.progress.stage!=='SETUP'&&<section><h2>내 손패 · {s.hand.length}장</h2><ArkNovaCardRow cards={s.hand} selected={chosen} disabled={disabled||s.phase==='FINISHED'||pending?.kind==='FINAL_GOAL'} onSelect={select}/></section>}
    <details><summary>내 동물과 후원자 · {s.played.length}장</summary><ArkNovaCardRow cards={s.played}/></details>
    <details><summary>최종 목표와 보전 프로젝트</summary><ArkNovaCardRow cards={[...s.goals,...s.baseProjects,...s.playedProjects]}/></details>
  </div>;
}
