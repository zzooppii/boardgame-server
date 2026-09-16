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
 if(g.privateState.cardChoice)return null;
 if(g.privateState.offers.some(o=>o.id.startsWith('initial-award:')))return <div className="tm-action-guide" role="status"><strong>비토르의 첫 행동 · 기업상 무료 후원</strong><p>후원할 기업상을 선택하세요. 점수는 게임 종료 시 해당 기업상의 순위로 결정됩니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('instant:')))return <div className="tm-action-guide" role="status"><strong>손패에서 프로젝트 1장을 실행하세요</strong><p>프렐류드의 할인 또는 전역 조건 완화는 이번 프로젝트에만 적용됩니다. 카드 선택 후 지불을 확정하세요.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('prelude:')))return <div className="tm-action-guide" role="status"><strong>프렐류드 실행 순서를 선택하세요</strong><p>앞 카드에서 얻은 자원으로 다음 카드를 실행할 수 있습니다. 필수 효과를 실행할 수 없는 카드는 공개하고 버려 15 M€를 받습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('olympus:')))return <div className="tm-action-guide" role="status"><strong>과학 태그 효과를 선택하세요</strong><p>과학 자원을 추가하거나 기존 과학 자원 1개로 카드 1장을 뽑습니다. 과학 태그가 여러 개면 각각 처리합니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('viral:')))return <div className="tm-action-guide" role="status"><strong>식물 또는 카드 자원을 선택하세요</strong><p>자원은 방금 낸 카드에만 추가할 수 있습니다. 대상 카드에 자원 칸이 없으면 식물을 얻습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('copy-resource:')))return <div className="tm-action-guide" role="status"><strong>자원을 추가할 카드를 선택하세요</strong><p>이미 자원이 있는 내 카드에 같은 종류 1개를 추가합니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('energy-sale:')))return <div className="tm-action-guide" role="status"><strong>전환할 에너지 수량을 선택하세요</strong><p>선택한 에너지만큼 M€를 받습니다. 생산량은 변하지 않습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('transfer-energy:')))return <div className="tm-action-guide" role="status"><strong>에너지 생산을 이전할 기업을 선택하세요</strong><p>대상 생산 −1, 내 생산 +1입니다. 자기 대상은 변화가 없고, 모두의 생산이 0이면 내 생산 0을 유지합니다. 보유 에너지와 서식지 보호는 영향을 받지 않습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('reduce:')))return <div className="tm-action-guide" role="status"><strong>생산량을 줄일 기업을 선택하세요</strong><p>필수 효과로 생략할 수 없습니다. 자신도 선택할 수 있습니다. M€ 생산 하한은 -5, 다른 생산 하한은 0입니다. 보유 자원은 줄지 않으며 서식지 보호로 막을 수 없습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('attack-stock:')||o.id.startsWith('attack-card:')))return <div className="tm-action-guide" role="status"><strong>대상과 자원 수량을 확인하세요</strong><p>한 대상의 수량 하나를 선택한 뒤 확정하세요. 제거는 자원을 없애고, 탈취는 같은 수량을 가져옵니다. 생략할 수도 있습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('claim-land:')))return <div className="tm-action-guide" role="status"><strong>예약할 육지를 선택하세요</strong><p>선택 후 예약 확정을 누르세요. 예약자만 타일을 놓을 수 있지만 배치 조건은 그대로 적용됩니다. 지금은 보너스나 점수를 받지 않습니다.</p></div>;
 if(g.privateState.offers.some(o=>o.id.startsWith('copy-production:')))return <div className="tm-action-guide" role="status"><strong>복제할 생산량 상자를 선택하세요</strong><p>생산량 감소도 다시 적용됩니다. 자원 수령·타일 배치·전역 지표·태그는 복제하지 않습니다. 대상을 선택한 뒤 확정하세요.</p></div>;
 const payment=g.privateState.payment,placing=g.privateState.offers.some(o=>o.kind==='PLACE'),effect=g.privateState.offers.some(o=>o.kind==='EFFECT');
 if(!payment&&!placing&&!effect)return null;
 return <div className="tm-action-guide" role="status"><strong>{payment?'지불할 자원을 확인하세요':placing?'배치할 위치를 선택하세요':'남은 효과를 해결하세요'}</strong><p>{payment?(payment.cancelable?'아직 지불하지 않았습니다. 자원을 조합한 뒤 확정하거나 선택을 취소할 수 있습니다.':'사용할 자원을 확인하고 확정하세요. 지불이 반영되면 행동의 다음 효과로 이어집니다.'):placing?'밝은 후보 칸을 선택하고 배치 확정을 누르세요. 선택만으로 타일이 놓이지 않습니다.':'아래에서 해결할 효과나 대상을 선택하고 확정하세요. 남은 선택이 있으면 다음 안내가 이어집니다.'}</p></div>;
}
