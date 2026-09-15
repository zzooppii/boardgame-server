import {ARK_ACTION_LABELS,ARK_BUILDINGS,arkCardName,type ArkHistoryEntry,type ArkSoloCommand} from '@hangul-rummikub/shared';
import type {ArkSoloState} from './game.js';
/** Server-confirmed owner history. Never serialize command payloads, credentials or hidden deck IDs. */
export function recordArkHistory(before:ArkSoloState,after:ArkSoloState,command:ArkSoloCommand):ArkHistoryEntry[] {
  const changes:ArkHistoryEntry['changes']=[];
  for(const [key,resource] of [['money','돈'],['appeal','매력'],['conservation','보전'],['reputation','평판'],['x','X'],['workers','직원']] as const)
    if(before[key]!==after[key])changes.push({resource,before:before[key],after:after[key]});
  const notes:string[]=[];
  const entered=after.played.filter(c=>!before.played.some(old=>old.cardId===c.cardId));
  for(const card of entered)notes.push(`${arkCardName(card.key)} 사용`);
  for(const card of before.played.filter(c=>!after.played.some(next=>next.cardId===c.cardId)))notes.push(`${arkCardName(card.key)} 방사`);
  for(const building of after.buildings.filter(b=>!before.buildings.some(old=>old.id===b.id)))notes.push(`${ARK_BUILDINGS[building.kind]?.name??'고유 건물'} 건설`);
  if(before.donations.length<after.donations.length&&command.kind!=='DONATE')notes.push('휴식 시작');
  if(before.breakStep!=='CARD_INCOME'&&after.breakStep==='CARD_INCOME'||before.progress.round!==after.progress.round)notes.push('휴식 수입 처리 · 직원 복귀');
  if(after.phase==='FINISHED')notes.push(`최종 점수 ${after.result?.total??0} · ${after.result?.won?'승리':'패배'}`);
  const labels:Partial<Record<ArkSoloCommand['kind'],string>>={INITIAL_HAND:'시작 손패 확정',FUNDRAISE:'모금',BUILD:'건설',BUILD_MORE:'추가 건설',END_BUILD:'건설 마치기',END_ZOO:'카드 사용 마치기',CANCEL_ZOO:'카드 사용 취소',DRAW:'카드 뽑기',SNAP:'카드 낚아채기',PICK_CARD:'카드 가져오기',DISCARD:'카드 버리기',ASSOCIATION:'협회 업무',ASSOCIATION_MORE:'추가 협회 업무',END_ASSOCIATION:'협회 마치기',DONATE:'기부',FINAL_GOAL:'최종 목표 선택',END_REPEAT:'반복 행동 마치기',CANCEL_EXTRA:'추가 행동 취소',BUILD_BONUS:'건설 보너스',REWARD:'보상 받기'};
  let label=labels[command.kind]??'선택 처리';
  if(command.kind==='BEGIN_ZOO')label=`${ARK_ACTION_LABELS[command.action]} 행동 시작`;
  if(command.kind==='TAKE_X')label=`${ARK_ACTION_LABELS[command.action]} · X 토큰 받기`;
  if(command.kind==='PLAY_ZOO')label=entered[0]?`${arkCardName(entered[0].key)} 사용`:'카드 사용';
  if(command.kind==='EFFECT'){
    const job=before.effects.active??before.effects.frames.at(-1)?.find(j=>j.id===command.effectId);
    const source=job&&[...before.played,...before.hand,...before.playedProjects,...before.baseProjects,...before.discarded].find(c=>c.cardId===job.sourceId);
    label=source?`${arkCardName(source.key)} · 카드 효과`:'카드·보너스 효과';
  }
  if(command.kind==='ASSOCIATION'||command.kind==='ASSOCIATION_MORE'){
    label=command.task.kind==='PROJECT'?'보전 프로젝트 지원':command.task.kind==='PARTNER'?'제휴 동물원 획득':command.task.kind==='UNIVERSITY'?'대학 획득':'협회 · 평판 올리기';
  }
  // Selecting a pending effect does not execute it; avoid duplicate entries on UI selection.
  if(command.kind==='SELECT_EFFECT')return before.history;
  return [...before.history,{revision:after.revision,round:before.progress.round,turn:Math.min(27,before.progress.turnsCompleted+Number(before.progress.stage!=='BREAK'&&before.progress.stage!=='FINAL_SCORING')),label,notes:notes.filter(note=>note!==label).slice(0,20),changes}].slice(-100);
}
