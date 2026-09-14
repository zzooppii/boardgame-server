import {arkEnclosuresToEmpty,ARK_UNIQUE_BUILDINGS,validateArkUniqueConstruction,arkAnimalPrice,arkMissingCardConditions,arkAnimalHousingChoices,arkCanShareFlockEnclosure,arkCardDefinition,ARK_TAG_LABELS} from '@hangul-rummikub/shared';
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

/** Uses the same pure price, prerequisites and habitat kernels as server card play. */
export function arkAnimalSelectionAdvice(state:ArkSoloView,cardId:string|null) {
  const card=state.hand.find(c=>c.cardId===cardId)??state.display.find(c=>c?.cardId===cardId);
  const animal=card&&ARK_CARDS.find(c=>c.key===card.key&&c.kind==='ANIMAL');
  if(!animal)return null;
  const slot=state.hand.some(c=>c.cardId===cardId)?0:state.display.findIndex(c=>c?.cardId===cardId)+1;
  const price=arkAnimalPrice(animal,state,slot),missing=arkMissingCardConditions(animal,state);
  const ignores=animal.size>=4&&state.played.some(c=>c.key==='263')?1:0;
  const missingLabels=missing.map(key=>key==='Partner_Zoo'?'이 동물과 같은 대륙의 제휴 동물원':key==='AnimalsII'?'동물 행동 II':key==='Reputation'?'평판 3 이상':key==='Appeal'?'매력 25 이하':`${ARK_TAG_LABELS[key]??key} 아이콘`);
  const issues:string[]=[];
  if(missing.length>ignores)issues.push(`부족한 조건: ${missingLabels.join(', ')}${ignores?' (이 중 1개 무시 가능)':''}`);
  if(state.money<price)issues.push(`돈 ${price-state.money} 부족 (필요 ${price} · 보유 ${state.money})`);
  if(state.wazaFocus==='SMALL'&&animal.size>=4||state.wazaFocus==='LARGE'&&animal.size<=2)issues.push('현재 WAZA 전문화로 이 크기의 동물을 사용할 수 없습니다.');
  const housingIds=arkAnimalHousingChoices(state.buildings,animal,state.played.some(c=>c.key==='219'));
  const flock=arkCanShareFlockEnclosure(animal,state.played.map(arkCardDefinition));
  if(!housingIds.length&&!flock)issues.push(`입주 가능한 우리가 없습니다. ${animal.standard?`${animal.size}칸 이상의 빈 우리 또는 허용된 특수 우리`:'허용된 특수 우리'}${animal.water?` · 물 ${animal.water}칸 인접`:''}${animal.rock?` · 바위 ${animal.rock}칸 인접`:''} 조건과 남은 용량을 확인하세요.`);
  return {price,housingIds,flock,issues};
}

export function arkSponsorSelectionAdvice(state:ArkSoloView,cardId:string|null,placement:unknown,mode:'ACTION'|'PAID_EFFECT'='ACTION') {
  const card=state.hand.find(c=>c.cardId===cardId)??state.display.find(c=>c?.cardId===cardId);
  const definition=card&&ARK_CARDS.find(c=>c.key===card.key&&c.kind==='SPONSOR');
  if(!definition)return null;
  const held=state.hand.some(c=>c.cardId===cardId);
  const price=mode==='PAID_EFFECT'?definition.cost:held?0:state.display.findIndex(c=>c?.cardId===cardId)+1;
  const missing=arkMissingCardConditions(definition,state),issues:string[]=[];
  if(mode==='PAID_EFFECT'&&!held)issues.push('이 효과는 손패의 후원자만 사용할 수 있습니다.');
  if(missing.length)issues.push(`부족한 조건: ${missing.map(key=>key==='Partner_Zoo'?'제휴 동물원':key==='SponsorsII'?'후원자 행동 II':key==='Appeal'?'매력 25 이하':key==='Reputation'?'평판 3 이상':`${ARK_TAG_LABELS[key]??key} 아이콘`).join(', ')}`);
  if(state.money<price)issues.push(`돈 ${price-state.money} 부족 (필요 ${price} · 보유 ${state.money})`);
  if(Object.hasOwn(ARK_UNIQUE_BUILDINGS,definition.key)&&!validateArkUniqueConstruction(state.buildings,definition,state.actions.some(a=>a.kind==='BUILD'&&a.upgraded),state.played.some(c=>c.key==='219'),placement).ok)issues.push('고유 건물을 배치할 수 없습니다. 지도에서 위치·회전·연결·지형·가장자리 조건을 확인하세요.');
  return {price,issues};
}

/** WAZA's extra play is hand-only, paid normally, and restricted to printed size 1–2. */
export function arkWazaSelectionAdvice(state:ArkSoloView,cardId:string|null,housingId:string|null) {
  const card=state.hand.find(c=>c.cardId===cardId);
  if(!card||!ARK_CARDS.some(d=>d.key===card.key&&d.kind==='ANIMAL'&&d.size<=2))return null;
  const advice=arkAnimalSelectionAdvice(state,cardId);
  if(!advice)return null;
  const housingHint=(housingId===null?advice.flock:advice.housingIds.includes(housingId))?null:'지도에서 입주 가능한 우리를 선택하세요.';
  return {...advice,housingHint};
}

/** Use the server-projected facility permissions, then the shared geometry kernel. */
export function arkFreeBuildPlacementHint(state:ArkSoloView,placement:Extract<ArkSoloCommand,{kind:'BUILD'}>['placement']|null):string|null {
  if(!placement)return '시설과 지도 기준 칸을 선택하세요.';
  if(state.activeEffect?.kind!=='FREE_BUILD'||!state.activeEffect.guide.buildings.includes(placement.building))return '이 효과에서 허용된 시설을 선택하세요.';
  return arkPlacementReason(state.buildings,placement.building,arkShape(placement.building,placement.anchor,placement.rotation,placement.reflected),state.actions.some(a=>a.kind==='BUILD'&&a.upgraded),state.played.some(c=>c.key==='219'));
}

export function arkSpecialMoveAdvice(state:ArkSoloView,cardId:string|null,housingId:string|null) {
  const move=state.activeEffect?.kind==='MOVE_TO_SPECIAL'?state.activeEffect.guide.specialMove:undefined;
  const destination=move&&state.buildings.find(b=>b.id===move.buildingId);
  const card=state.played.find(c=>c.cardId===cardId),animal=card&&ARK_CARDS.find(d=>d.key===card.key&&d.kind==='ANIMAL');
  const issues:string[]=[];
  if(!move||!destination||!['ReptileHouse','LargeBirdAviary'].includes(destination.kind))issues.push('이동할 특수 우리 정보를 확인할 수 없습니다.');
  if(!animal)issues.push('이동할 동물을 선택하세요.');
  if(move&&cardId&&move.moved.includes(cardId))issues.push('이번 효과에서 이미 이동한 동물입니다.');
  const ignoreTerrain=state.played.some(c=>c.key==='219');
  if(animal&&destination&&!arkAnimalHousingChoices([destination],animal,ignoreTerrain).length)issues.push('이 특수 우리에 들어갈 수 없습니다. 동물 종류·남은 용량·지형 조건을 확인하세요.');
  const housingIds=animal?arkEnclosuresToEmpty(state.buildings,animal,ignoreTerrain):[];
  if(animal&&(housingId===null?housingIds.length>0:!housingIds.includes(housingId)))issues.push('비울 수 있는 기존 우리를 선택하세요.');
  return {destination,housingIds,issues};
}

/** Keep deselection available at the limit, including rapid queued clicks. */
export function arkToggleLimitedSelection(selected:readonly string[],id:string,limit:number):string[] {
  if(selected.includes(id))return selected.filter(value=>value!==id);
  return selected.length<limit?[...selected,id]:[...selected];
}
