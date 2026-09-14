import { PANDEMIC_CITY_INFO, PANDEMIC_EVENT_INFO, pandemicNeighbors, type PandemicAction, type PandemicCard, type PandemicCity, type PandemicColor, type PandemicProjection, type PlayerId } from '@hangul-rummikub/shared';
export const DISEASE_NAMES:Record<PandemicColor,string>={BLUE:'파랑',YELLOW:'노랑',BLACK:'검정',RED:'빨강'};
export const DISEASE_COLORS:Record<PandemicColor,string>={BLUE:'#60cbff',YELLOW:'#ffd657',BLACK:'#c4b2e2',RED:'#ff6e78'};
export const STAGE_NAMES:Record<PandemicProjection['phase'],string>={SETUP:'출동 준비',ACTIONS:'행동',DRAW:'카드 2장 뽑기',EPIDEMIC_NEXT:'다음 전염병',INTENSIFY:'전염병 강화',INFECTION_READY:'감염 시작 전',INFECTION:'도시 감염',TURN_END:'차례 마무리',FINISHED:'작전 종료'};
export function cardName(c:PandemicCard){return c.kind==='CITY'?PANDEMIC_CITY_INFO[c.city].name:c.kind==='EVENT'?PANDEMIC_EVENT_INFO[c.event].name:'전염병';}
export type MoveOption={label:string;cost:string;action:Extract<PandemicAction,{type:'MOVE'}>};
export function pandemicMoveOptions(g:PandemicProjection,self:PlayerId,targetId:PlayerId,destination:PandemicCity):MoveOption[]{
 const p=g.playerStates.find(p=>p.playerId===self),target=g.playerStates.find(p=>p.playerId===targetId);if(!p||!target||target.city===destination||target!==p&&p.role!=='DISPATCHER')return [];
 const options:MoveOption[]=[];
 const add=(mode:Extract<PandemicAction,{type:'MOVE'}>['mode'],label:string,card:PandemicCard|null=null)=>options.push({label,cost:`행동 1회${card?` · ${cardName(card)} 카드 버림`:' · 카드 소모 없음'}${target!==p?' · 동료 동의 필요':''}`,action:{type:'MOVE',mode,playerId:targetId,destination,cardId:card?.cardId??null}});
 if(pandemicNeighbors(target.city).includes(destination))add('DRIVE','차량 / 선박');
 if(g.stations.includes(target.city)&&g.stations.includes(destination))add('SHUTTLE','셔틀 항공편');
 if(p.role==='DISPATCHER'&&g.playerStates.some(q=>q!==target&&q.city===destination))add('DISPATCH','동료에게 집결');
 for(const c of p.hand??[])if(c.kind==='CITY'){if(c.city===destination)add('DIRECT','직항편',c);if(c.city===target.city)add('CHARTER','전세 항공편',c);if(p.role==='OPERATIONS'&&p===target&&!g.operationsUsed&&g.stations.includes(p.city))add('OPERATIONS','건설 전문가 항공편',c);}
 return options;
}
export function pandemicFeedback(previous:PandemicProjection|null,next:PandemicProjection|null){if(!previous||!next||previous.gameId!==next.gameId||next.gameRevision!==previous.gameRevision+1)return [];const last=previous.history.at(-1)?.id??0;return next.history.filter(e=>e.id>last&&e.sound!=='NONE');}
