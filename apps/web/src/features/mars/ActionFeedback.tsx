import {MARS_RESOURCES,MARS_RESOURCE_NAMES,type MarsProjection} from '@hangul-rummikub/shared';

export type MarsResourceChange={label:string;before:number;after:number};
export type MarsResourceReceipt={generation:number;changes:MarsResourceChange[]};
/** Undefined keeps the last receipt; null discards an unreliable comparison. */
export function marsResourceReceipt(previous:MarsProjection|null,current:MarsProjection,continuous:boolean):MarsResourceReceipt|null|undefined{
 if(!continuous||!previous||previous.gameId!==current.gameId||previous.privateState.playerId!==current.privateState.playerId)return null;
 if(previous.gameRevision===current.gameRevision)return undefined;
 if(current.gameRevision!==previous.gameRevision+1)return null;
 const before=previous.playerStates.find(p=>p.playerId===current.privateState.playerId),after=current.playerStates.find(p=>p.playerId===current.privateState.playerId);
 if(!before||!after)return null;
 const changes:MarsResourceChange[]=[];
 for(const key of MARS_RESOURCES){
  if(before.resources[key]!==after.resources[key])changes.push({label:MARS_RESOURCE_NAMES[key],before:before.resources[key],after:after.resources[key]});
  if(before.production[key]!==after.production[key])changes.push({label:MARS_RESOURCE_NAMES[key]+' 생산',before:before.production[key],after:after.production[key]});
 }
 if(before.tr!==after.tr)changes.push({label:'TR',before:before.tr,after:after.tr});
 return changes.length?{generation:current.generation,changes}:undefined;
}
export function ResourceReceipt({receipt}:{receipt:MarsResourceReceipt|null}){
 return <div className="tm-receipt" role="status" aria-live="polite" aria-atomic="true">{receipt&&<><h3>마지막 내 자원 변화 <small>{receipt.generation}세대</small></h3><ul>{receipt.changes.map(c=><li key={c.label}><span>{c.label}</span><span>{c.before} → <strong>{c.after}</strong> <b className={c.after>c.before?'gain':'loss'}>({c.after>c.before?'+':''}{c.after-c.before})</b></span></li>)}</ul><small>마지막으로 반영된 변화입니다. 다음 선택의 예상 결과는 포함하지 않습니다.</small></>}</div>;
}
export function ActionGuide({game:g}:{game:MarsProjection}){
 if(g.phase==='FINISHED'||g.stage==='SETUP'||g.stage==='RESEARCH'||g.activePlayerId!==g.privateState.playerId)return null;
 const payment=g.privateState.payment,placing=g.privateState.offers.some(o=>o.kind==='PLACE'),effect=g.privateState.offers.some(o=>o.kind==='EFFECT');
 if(!payment&&!placing&&!effect)return null;
 return <div className="tm-action-guide" role="status"><strong>{payment?'지불할 자원을 확인하세요':placing?'배치할 위치를 선택하세요':'남은 효과를 해결하세요'}</strong><p>{payment?(payment.cancelable?'아직 지불하지 않았습니다. 자원을 조합한 뒤 확정하거나 선택을 취소할 수 있습니다.':'사용할 자원을 확인하고 확정하세요. 지불이 반영되면 행동의 다음 효과로 이어집니다.'):placing?'밝은 후보 칸을 선택하고 배치 확정을 누르세요. 선택만으로 타일이 놓이지 않습니다.':'아래에서 해결할 효과나 대상을 선택하고 확정하세요. 남은 선택이 있으면 다음 안내가 이어집니다.'}</p></div>;
}
