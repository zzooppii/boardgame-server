import {ARK_CARDS,arkReputationRange,arkActionStrength,arkPlacementReason,arkShape,type ArkActionKind,type ArkSoloCommand,type ArkSoloView} from '@hangul-rummikub/shared';

/** Display the server's continuation constraint; commands are still validated by the server. */
export function arkActionControls(state:Pick<ArkSoloView,'extraAction'|'repeatedAction'>,action:ArkActionKind) {
  const repeated=state.repeatedAction;
  const extra=state.extraAction&&!state.extraAction.started?state.extraAction:null;
  const repeatAllowed=!repeated||(repeated.awaiting&&repeated.action===action);
  return {
    regular:repeatAllowed&&(!repeated||repeated.mode==='REGULAR')&&(!extra||extra.action===action),
    takeX:repeatAllowed&&(!repeated||repeated.mode==='TAKE_X')&&(!extra||extra.action==='TAKE_X'),
  };
}

/** Advisory geometry uses the same shared map kernel as server construction. */
export function arkBuildPlacementHint(state:ArkSoloView,placement:Extract<ArkSoloCommand,{kind:'BUILD'}>['placement']):string|null {
  return arkPlacementReason(state.buildings,placement.building,arkShape(placement.building,placement.anchor,placement.rotation,placement.reflected),
    state.activeBuild?.upgraded??state.actions.some(a=>a.kind==='BUILD'&&a.upgraded),state.played.some(c=>c.key==='219'));
}

export function arkDisplayedStrength(state:ArkSoloView,kind:ArkActionKind,x:number):number {
  const index=state.actions.findIndex(a=>a.kind===kind),action=state.actions[index];
  if(!action||!Number.isInteger(x)||x<0||x>state.x)return 0;
  return arkActionStrength(state.repeatedAction?.action===kind?state.repeatedAction.baseStrength:index+1,x,action.constriction);
}
export function arkZooSelectionHint(state:ArkSoloView,cardId:string|null):string|null {
  const work=state.zooWork;
  if(!work)return null;
  if(work.stage!=='PLAYING')return '카드 사용을 마쳤습니다. 남은 효과를 처리하세요.';
  if(work.remaining===0||work.action==='SPONSORS'&&!work.upgraded&&work.playedCount>0)return '이번 행동의 카드 사용을 마쳤습니다. 카드 사용 마치기를 눌러주세요.';
  if(!cardId)return '사용할 카드 1장을 선택하세요.';
  const held=state.hand.find(c=>c.cardId===cardId),slot=state.display.findIndex(c=>c?.cardId===cardId);
  const card=held??state.display[slot],definition=card&&ARK_CARDS.find(c=>c.key===card.key);
  if(!definition||definition.kind!==(work.action==='ANIMALS'?'ANIMAL':'SPONSOR'))return work.action==='ANIMALS'?'동물 카드를 선택하세요.':'후원자 카드를 선택하세요.';
  if(!held&&!work.upgraded)return '공개 카드 사용은 해당 행동 카드의 업그레이드가 필요합니다.';
  if(!held&&slot>=arkReputationRange(state.reputation))return '현재 평판으로 이용할 수 없는 공개 카드 칸입니다.';
  if(definition.kind==='SPONSOR'&&definition.cost>work.remaining)return '남은 후원 행동력이 카드의 후원 등급보다 부족합니다.';
  return null;
}

export function arkReachableDisplayCards(state:Pick<ArkSoloView,'display'|'reputation'>){
  return state.display.filter((card,index)=>card!==null&&index<arkReputationRange(state.reputation)).filter(card=>card!==null);
}
