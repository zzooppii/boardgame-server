import {ARK_ACTION_LABELS,arkCardName,type ArkSoloView,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {ArkNovaBoard} from './ArkNovaBoard.js';
import {ArkNovaCardRow} from './ArkNovaCards.js';
import {ArkNovaMultiplayerContext} from './ArkNovaMode.js';
export function ArkNovaMultiplayer({state:s,players,disabled,onCommand}:{state:ArkSoloView;players:readonly {playerId:string;nickname:string}[];disabled:boolean;onCommand(a:ArkSoloCommand):void}){
  const t=s.table;if(!t)return null;const name=(id:string)=>players.find(p=>p.playerId===id)?.nickname??`플레이어 ${t.players.findIndex(p=>p.playerId===id)+1}`,own=t.activePlayerId===s.playerId;
  return <ArkNovaMultiplayerContext.Provider value={true}><section className="ark-multiplayer" aria-label="함께하는 동물원">
    {t.notice&&<p role="alert">{t.notice}</p>}
    <h2>{t.stage==='FINISHED'?`승리 · ${t.winners.map(name).join(', ')}`:t.stage==='SETUP'?`시작 손패 선택 · ${t.readyPlayerIds.length}/${t.players.length}명 준비`:`${name(t.activePlayerId)} · ${t.stage==='BREAK'?'휴식 처리':t.stage==='GOAL_DISCARD'?'목표 카드 정리':t.stage==='FINAL_SCORING'?'최종 정산':t.stage==='INTERACTION'?'도둑질 지불 선택':'행동 차례'}`}</h2>
    <p>휴식 {t.breakPosition}/{t.breakLimit} · 휴식까지 {t.breakLimit-t.breakPosition}칸 · {t.breakNumber}회 휴식 완료/진행</p><progress value={t.breakPosition} max={t.breakLimit} aria-label="공용 휴식 진행"/>
    {t.finalTurns&&t.stage!=='FINISHED'&&<p>마지막 차례: {t.finalTurns.map(name).join(' → ')||'최종 정산'}</p>}
    {t.borrowed&&<p>최면 · {name(t.borrowed.targetId)}의 {ARK_ACTION_LABELS[t.borrowed.action]} 행동을 행동력 {t.borrowed.strength}로 사용합니다.</p>}
    {own&&t.stage==='INTERACTION'&&<div><p>{name(t.interaction!.ownerId)}에게 지불할 방법을 선택하세요.</p><button disabled={disabled||s.money<5} onClick={()=>onCommand({kind:'INTERACTION_PAYMENT',choiceId:s.transitionId,payment:'MONEY'})}>돈 5 지불</button><button disabled={disabled||!s.hand.length} onClick={()=>onCommand({kind:'INTERACTION_PAYMENT',choiceId:s.transitionId,payment:'CARD'})}>무작위 손패 1장</button></div>}
    {own&&(t.stage==='GOAL_DISCARD'||t.stage==='FINAL_SCORING')&&<div><p>버릴 최종 목표 1장을 선택하세요. 카드 내용을 펼쳐 정산 조건을 비교할 수 있습니다.</p><ArkNovaCardRow cards={s.goals}/>{s.goals.map(c=><button key={c.cardId} disabled={disabled} onClick={()=>onCommand({kind:'FINAL_GOAL',choiceId:t.stage==='GOAL_DISCARD'?s.transitionId:s.pending?.choiceId??s.transitionId,discard:c.cardId})}>{arkCardName(c.key)} 버리기</button>)}</div>}
    <div className="ark-multiplayer-players">{t.players.map((p,i)=><details key={p.playerId}><summary>{i+1}. {name(p.playerId)} {p.playerId===s.playerId?'(나)':''} · 매력 {p.appeal} / 보전 {p.conservation} · 돈 {p.money}{p.total!==null?` · 최종 ${p.total}점`:''}</summary><p>손패 {p.handCount}장 · 목표 {p.goalCount}장 · 평판 {p.reputation} · X {p.x} · 직원 {p.workers-p.busyWorkers}/{p.workers} · 지원 {p.supportedProjects}회</p><p>{p.actions.map((a,i)=>`${i+1} ${ARK_ACTION_LABELS[a.kind]} ${a.upgraded?'II':'I'}${a.venom?' · 독':''}${a.constriction?' · 조이기':''}`).join(' / ')}</p><ArkNovaCardRow cards={p.played}/><ArkNovaBoard buildings={p.buildings} selected={null} disabled onSelect={()=>{}}/><p>{p.buildings.length}개 시설 · 제휴 {p.partners.length}개 · 대학 {p.universities.length}개</p></details>)}</div>
  </section></ArkNovaMultiplayerContext.Provider>;
}
