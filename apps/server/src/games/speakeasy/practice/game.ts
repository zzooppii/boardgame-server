import {parse,safeParse} from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,SpeakeasyPracticeViewSchema,SpeakeasyPracticeCommandSchema,
  SPEAKEASY_BUILDING_LABELS,type PlayerId,type SpeakeasyPracticeAction,type SpeakeasyPracticeView} from '@hangul-rummikub/shared';
import {parseSpeakeasyEconomy,type SpeakeasyEconomy,type SpeakeasyRuleResult} from '../domain/model.js';
import {buildSpeakeasy,produceSpeakeasy,deliverSpeakeasy,sellSpeakeasy,protectSpeakeasy,speakeasyOperating,type SpeakeasyDeliveryStep} from '../domain/economy.js';
import {speakeasyFinalScores,speakeasyWinners} from '../domain/scoring.js';

export type PracticeGame = {gameId:SpeakeasyPracticeView['gameId'];revision:number;turn:number;actionsLeft:number;finished:boolean;
  player:PlayerId;bot:PlayerId;economy:SpeakeasyEconomy;log:string[];feedback:SpeakeasyPracticeView['feedback']};
/** Injected opaque IDs; no test fixture or original component catalog is reused. */
export function startPractice(id:()=>string):PracticeGame {
  const tile=()=>parse(TileIdSchema,id()),player=parse(PlayerIdSchema,id()),bot=parse(PlayerIdSchema,id());
  const economy=parseSpeakeasyEconomy({players:[player,bot].map(playerId=>({playerId,cash:15,safe:30,
    levels:{VIP:4,PARTY:1,STILLS:2,FLEET:1,STRENGTH:1},leverageTokens:0,hand:[],operations:[],
    reserves:[...Array.from({length:5},()=>({tileId:tile(),kind:'SPEAKEASY',cost:3,group:0})),
      ...Array.from({length:3},()=>({tileId:tile(),kind:'NIGHTCLUB',cost:12,group:null})),{tileId:tile(),kind:'STILLS',cost:5,group:1}],
    removedBuildings:[],vip:Array.from({length:4},tile),familyReserve:[],removedFamily:[],goons:[],stock:[],
    trucks:[0,1].map(()=>({tileId:tile(),district:null,barrels:[]})),books:0,bookReserve:10,cityTileCount:0,crates:[],helpers:[],associate:null,
  })),districts:Array.from({length:16},(_,i)=>({id:i+1,blocked:false,cop:false,slots:[null,null],mobsterSlots:[],mobsterStrength:null})),
    docks:[],barrelSupply:Array.from({length:40},tile),goonSupply:[],discardedCards:[],placedBooks:[]});
  economy.players.forEach((p,i)=>{
    const still=p.reserves.find(b=>b.kind==='STILLS')!,bar=p.reserves.find(b=>b.kind==='SPEAKEASY')!;
    p.reserves=p.reserves.filter(b=>b!==still&&b!==bar);
    economy.districts[i===0?0:14]!.slots[0]={piece:still,ownerId:p.playerId,familyId:null,barrelId:null};
    economy.districts[i===0?1:15]!.slots[0]={piece:bar,ownerId:p.playerId,familyId:null,barrelId:null};
  });
  return {gameId:parse(GameIdSchema,id()),revision:0,turn:1,actionsLeft:2,finished:false,player,bot,
    economy:parseSpeakeasyEconomy(economy),feedback:null,log:['연습 시작 · 생산 → 운송 → 판매로 수익을 만들어 보세요.']};
}
const edges:readonly (readonly [number,number])[]=Array.from({length:16},(_,i)=>i+1).flatMap(n=>[
  ...(n%4!==0?[[n,n+1] as const]:[]),...(n<=12?[[n,n+4] as const]:[])]);
function path(from:number,to:number):number[] {
  const queue:[number,number[]][]=[[from,[]]],seen=new Set([from]);
  for(let i=0;i<queue.length;i++) {
    const [at,route]=queue[i]!;if(at===to)return route;
    for(const [a,b] of edges) {const next=a===at?b:b===at?a:null;
      if(next!==null&&!seen.has(next)){seen.add(next);queue.push([next,[...route,next]]);}}
  }
  return [];
}
function delivery(s:SpeakeasyEconomy,actor:PlayerId,buildingId:string):{steps:SpeakeasyDeliveryStep[];route:number[]}|null {
  const p=s.players.find(p=>p.playerId===actor)!,truck=p.trucks[0]!;
  const target=s.districts.find(d=>d.slots.some(b=>b?.piece.tileId===buildingId&&b.ownerId===actor&&b.piece.kind!=='STILLS'&&!b.barrelId&&speakeasyOperating(d.cop,b)));
  if(!target)return null;
  let at=truck.district;const steps:SpeakeasyDeliveryStep[]=[],route:number[]=[];
  function move(to:number){const way=at===null?[to]:path(at,to);for(const district of way)steps.push({kind:'MOVE',truckId:truck.tileId,district});route.push(...way);at=to;}
  if(!truck.barrels.length){
    const still=s.districts.find(d=>d.slots.some(b=>b?.ownerId===actor&&b.piece.kind==='STILLS'&&speakeasyOperating(d.cop,b)));
    if(!still||!p.stock.length)return null;
    move(still.id);steps.push({kind:'LOAD',truckId:truck.tileId,count:Math.min(2,p.stock.length)});
  }
  move(target.id);const building=target.slots.find(b=>b?.piece.tileId===buildingId)!;
  steps.push({kind:'UNLOAD',truckId:truck.tileId,buildingId:building.piece.tileId});
  return {steps,route};
}
function effect(s:SpeakeasyEconomy,actor:PlayerId,action:SpeakeasyPracticeAction):SpeakeasyRuleResult<SpeakeasyEconomy> {
  const p=s.players.find(p=>p.playerId===actor)!;
  switch(action.type){
    case 'BUILD':{
      const piece=p.reserves.find(b=>b.kind===action.kind);
      if(!piece)return {ok:false,reason:'CAPACITY'};
      return buildSpeakeasy(s,actor,{pieceId:piece.tileId,district:action.district,slot:action.slot,goons:0,useAssociate:false,freeAssociate:false,discardIds:[]},{kinds:[action.kind],upgrade:false});
    }
    case 'MOVE':{
      const truck=p.trucks[0]!;if(truck.district===action.district)return {ok:false,reason:'INVALID_ACTION'};
      const route=truck.district===null?[action.district]:path(truck.district,action.district);
      return deliverSpeakeasy(s,actor,route.map(district=>({kind:'MOVE',truckId:truck.tileId,district})),{range:3,edges});
    }
    case 'PRODUCE':return produceSpeakeasy(s,actor,2);
    case 'DELIVER':{const plan=delivery(s,actor,action.buildingId);return plan?deliverSpeakeasy(s,actor,plan.steps,{range:3,edges}):{ok:false,reason:'INVALID_ACTION'};}
    case 'SELL':return sellSpeakeasy(s,actor,[action.buildingId],{limit:1,speakeasy:10,premium:15});
    case 'PROTECT':{
      // Training permission supplies one leverage for this action, without fabricating an operation card.
      const copy=parseSpeakeasyEconomy(s);copy.players.find(p=>p.playerId===actor)!.leverageTokens=1;
      return protectSpeakeasy(copy,actor,[action.buildingId],1);
    }
    case 'END_TURN':return {ok:false,reason:'INVALID_ACTION'};
  }
}
function candidates(s:SpeakeasyEconomy,actor:PlayerId):SpeakeasyPracticeAction[]{
  const result:SpeakeasyPracticeAction[]=[{type:'PRODUCE'},...s.districts.map(d=>({type:'MOVE' as const,district:d.id}))];
  for(const d of s.districts) d.slots.forEach((b,slot)=>{
    if(!b&&(slot===0||slot===1))for(const kind of ['SPEAKEASY','NIGHTCLUB'] as const)result.push({type:'BUILD',kind,district:d.id,slot});
    if(b?.ownerId===actor)for(const type of ['DELIVER','SELL','PROTECT'] as const)result.push({type,buildingId:b.piece.tileId});
  });
  return result;
}
function label(s:SpeakeasyEconomy,action:SpeakeasyPracticeAction):string {
  if(action.type==='END_TURN')return '턴 마치기';
  if(action.type==='PRODUCE')return '주류 2개 생산';
  if(action.type==='MOVE')return `${action.district}구역으로 트럭 이동`;
  if(action.type==='BUILD')return `${action.district}구역 ${action.slot+1}번 칸에 ${SPEAKEASY_BUILDING_LABELS[action.kind]} 건설`;
  const d=s.districts.find(d=>d.slots.some(b=>b?.piece.tileId===action.buildingId))!;
  const b=d.slots.find(b=>b?.piece.tileId===action.buildingId)!;
  return `${d.id}구역 ${SPEAKEASY_BUILDING_LABELS[b.piece.kind]} ${action.type==='DELIVER'?'배달':action.type==='SELL'?'판매':'보호'}`;
}
/** Deltas come from the same validated candidate used for execution, never UI estimates. */
function resourceChange(before:SpeakeasyEconomy,after:SpeakeasyEconomy,actor:PlayerId) {
  const a=before.players.find(p=>p.playerId===actor)!,b=after.players.find(p=>p.playerId===actor)!;
  return {cash:b.cash-a.cash,safe:b.safe-a.safe,stock:b.stock.length-a.stock.length,
    family:b.vip.length-a.vip.length,truckLoad:b.trucks[0]!.barrels.length-a.trucks[0]!.barrels.length};
}
function preview(s:SpeakeasyEconomy,after:SpeakeasyEconomy,actor:PlayerId,action:SpeakeasyPracticeAction):SpeakeasyPracticeView['choices'][number]['preview'] {
  const at=s.players.find(p=>p.playerId===actor)!.trucks[0]!.district;
  const moves=action.type==='MOVE'?(at===null?[action.district]:path(at,action.district)):
    action.type==='DELIVER'?delivery(s,actor,action.buildingId)?.route??[]:[];
  const route=action.type==='MOVE'||action.type==='DELIVER'?[...(at===null?[]:[at]),...moves]:[];
  const targets:SpeakeasyPracticeView['choices'][number]['preview']['targets']=[];
  if(action.type==='MOVE')targets.push({district:action.district,slot:null});
  else if(action.type==='BUILD')targets.push({district:action.district,slot:action.slot});
  else for(const d of s.districts)d.slots.forEach((b,slot)=>{
    if(b&&(slot===0||slot===1)&&(action.type==='PRODUCE'?b.ownerId===actor&&b.piece.kind==='STILLS'&&speakeasyOperating(d.cop,b):'buildingId' in action&&b.piece.tileId===action.buildingId))targets.push({district:d.id,slot});
  });
  return {route,targets,delta:resourceChange(s,after,actor)};
}
export function practiceChoices(s:PracticeGame,actor=s.player):SpeakeasyPracticeView['choices'] {
  if(s.finished||s.actionsLeft===0)return [];
  return candidates(s.economy,actor).flatMap(action=>{
    const outcome=effect(s.economy,actor,action);if(!outcome.ok)return [];
    const p=s.economy.players.find(p=>p.playerId===actor)!,after=outcome.value.players.find(p=>p.playerId===actor)!;
    if(action.type==='PRODUCE'&&after.stock.length===p.stock.length)return [];
    const detail=action.type==='MOVE'?`경로 ${[p.trucks[0]!.district??'진입',...(p.trucks[0]!.district===null?[action.district]:path(p.trucks[0]!.district,action.district))].join(' → ')}`:action.type==='BUILD'?`현금 $${p.cash-after.cash} · 금고 $${p.safe-after.safe} 지불`:
      action.type==='DELIVER'?`이동 경로 ${[p.trucks[0]!.district??'진입',...(delivery(s.economy,actor,action.buildingId)?.route??[])].join(' → ')} · 도착 건물에 주류 1개`:
      action.type==='SELL'?`현금 +$${after.cash-p.cash}`:action.type==='PROTECT'?'조직원 1명 · 경찰 진입 후에도 영업 · 최종 점수 획득':`저장 주류 +${after.stock.length-p.stock.length}`;
    return [{action,label:label(s.economy,action),detail,preview:preview(s.economy,outcome.value,actor,action)}];
  });
}
function botTurn(s:PracticeGame) {
  for(let n=0;n<2;n++){
    const choices=practiceChoices({...s,actionsLeft:2},s.bot);
    const owned=s.economy.districts.flatMap(d=>d.slots).filter(b=>b?.ownerId===s.bot);
    const priority:SpeakeasyPracticeAction['type'][]=s.turn>=9?['PROTECT','SELL','DELIVER','PRODUCE','BUILD']:
      ['SELL','DELIVER',...(owned.length<3?['BUILD' as const]:[]),'PRODUCE','PROTECT','BUILD'];
    let choice:typeof choices[number]|undefined;
    for(const type of priority){choice=choices.find(c=>c.action.type===type&&(type!=='BUILD'||(c.action.type==='BUILD'&&c.action.district>=13)));if(choice)break;}
    if(!choice)break;
    const outcome=effect(s.economy,s.bot,choice.action);if(!outcome.ok)throw new Error('Invalid practice bot choice.');
    s.log.push(`컴퓨터 · ${choice.label}`);s.economy=outcome.value;
  }
}
const practiceSettlements=[{turn:4,district:4},{turn:7,district:8},{turn:10,district:12}] as const;
function practiceIncome(economy:SpeakeasyEconomy,actor:PlayerId,policeDistrict?:number):number {
  return economy.districts.flatMap(d=>d.slots.filter(b=>b?.ownerId===actor&&speakeasyOperating(d.cop||d.id===policeDistrict,b))).length*5;
}
function nextSettlement(s:PracticeGame):SpeakeasyPracticeView['settlement'] {
  const next=s.finished?undefined:practiceSettlements.find(item=>item.turn>=s.turn);
  if(!next)return null;
  return {...next,income:practiceIncome(s.economy,s.player,next.district),atRisk:s.economy.districts
    .filter(d=>d.id===next.district&&!d.cop).flatMap(d=>d.slots.flatMap(b=>b?.ownerId===s.player&&b.familyId===null?[b.piece.tileId]:[]))};
}
export function actPractice(original:PracticeGame,actor:PlayerId,input:unknown):PracticeGame|null {
  const parsed=safeParse(SpeakeasyPracticeCommandSchema,input);
  if(!parsed.success||actor!==original.player||original.finished||parsed.output.gameId!==original.gameId||parsed.output.revision!==original.revision)return null;
  const action=parsed.output.action,s:PracticeGame={...original,economy:parseSpeakeasyEconomy(original.economy),log:[...original.log]};
  if(action.type==='END_TURN'){
    botTurn(s);
    const settlement=practiceSettlements.find(item=>item.turn===s.turn);
    if(settlement){
      const district=settlement.district;s.economy.districts[district-1]!.cop=true;
      s.log.push(`경찰 · ${district}구역 진입`);
      for(const p of s.economy.players){const income=practiceIncome(s.economy,p.playerId);p.safe+=income;s.log.push(`${p.playerId===s.player?'나':'컴퓨터'} · 지역 정산 금고 +$${income}`);}
    }
    if(s.turn===11){s.finished=true;s.actionsLeft=0;s.log.push('11턴 종료 · 최종 정산');}
    else {s.turn++;s.actionsLeft=2;s.log.push(`${s.turn}턴 · 나의 차례`);}
  } else {
    if(s.actionsLeft===0)return null;
    const outcome=effect(s.economy,actor,action);if(!outcome.ok)return null;
    s.log.push(`나 · ${label(s.economy,action)}`);s.economy=outcome.value;s.actionsLeft--;
  }
  s.economy=parseSpeakeasyEconomy(s.economy);s.revision++;
  s.feedback={title:action.type==='END_TURN'?`${original.turn}턴 종료${s.finished?' · 최종 정산':''}`:label(original.economy,action),
    delta:resourceChange(original.economy,s.economy,actor),events:s.log.slice(original.log.length)};
  s.log=s.log.slice(-60);return s;
}
export function projectPractice(s:PracticeGame):SpeakeasyPracticeView {
  const p=s.economy.players.find(p=>p.playerId===s.player)!,winners=s.finished?speakeasyWinners(s.economy):[];
  return parse(SpeakeasyPracticeViewSchema,{gameId:s.gameId,revision:s.revision,viewerId:s.player,opponentId:s.bot,turn:s.turn,actionsLeft:s.actionsLeft,finished:s.finished,
    cash:p.cash,safe:p.safe,stock:p.stock.length,family:p.vip.length,truck:{district:p.trucks[0]!.district,load:p.trucks[0]!.barrels.length},
    districts:s.economy.districts.map(d=>({id:d.id,cop:d.cop,slots:d.slots.map(b=>b?{tileId:b.piece.tileId,ownerId:b.ownerId,kind:b.piece.kind,protected:b.familyId!==null,barrel:b.barrelId!==null,operating:speakeasyOperating(d.cop,b)}:null)})),
    reserves:(['SPEAKEASY','NIGHTCLUB'] as const).map(kind=>({kind,count:p.reserves.filter(b=>b.kind===kind).length})),
    settlement:nextSettlement(s),choices:practiceChoices(s),feedback:s.feedback,log:s.log,scores:s.finished?speakeasyFinalScores(s.economy).map(p=>({playerId:p.playerId,cash:p.cash,safe:p.safe,buildings:p.buildingMoney,total:p.total,winner:winners.includes(p.playerId)})):[]});
}
