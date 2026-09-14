import {ARK_ACTION_LABELS,type ArkSoloView,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {arkReachableDisplayCards} from './action-controls.js';
import {ArkNovaCardRow} from './ArkNovaCards.js';
const labels:Readonly<Record<string,string>>={MONEY_5:'돈 5',MONEY_10:'돈 10',X_1:'X 토큰',CARD_1:'카드',REPUTATION_2:'평판 2',REPUTATION:'평판',CONSERVATION:'보전',WORKER:'협회 직원',UPGRADE:'행동 업그레이드',UPGRADE_OR_WORKER:'업그레이드 또는 직원',CARD:'카드',X:'X 토큰'};
export function ArkNovaRewards({state:s,disabled,onCommand:send}:{state:ArkSoloView;disabled:boolean;onCommand(command:ArkSoloCommand):void}) {
  const pending=s.pending;
  if(pending?.kind!=='BUILD_BONUS'&&pending?.kind!=='REWARD')return null;
  const options=pending.kind==='BUILD_BONUS'?s.buildBonuses:s.rewards;
  return <section aria-label="보너스 선택"><h2>동물원 보너스</h2><p>원하는 순서대로 보너스를 받으세요.</p>{options.map(option=>{
    const take=(selection:Extract<ArkSoloCommand,{kind:'REWARD'}>['selection'])=>{
      if(pending.kind==='REWARD')send({kind:'REWARD',choiceId:pending.choiceId,rewardId:option.id,selection});
      else if(selection.kind!=='WORKER')send({kind:'BUILD_BONUS',choiceId:pending.choiceId,bonusId:option.id,selection});
    };
    const upgrade=option.kind==='UPGRADE'||option.kind==='UPGRADE_OR_WORKER',card=option.kind==='CARD'||option.kind==='CARD_1';
    return <div key={option.id} className="ark-live-reward"><h3>{labels[option.kind]??option.kind}</h3>
      {upgrade?s.actions.filter(a=>!a.upgraded&&s.actions.filter(c=>c.upgraded).length<4).map(a=><button key={a.kind} disabled={disabled} onClick={()=>take({kind:'UPGRADE',action:a.kind})}>{ARK_ACTION_LABELS[a.kind]} II</button>):card?<><button disabled={disabled||s.deckCount===0} onClick={()=>take({kind:'CARD',cardId:null})}>덱에서 가져오기</button><ArkNovaCardRow cards={arkReachableDisplayCards(s)} disabled={disabled} onSelect={id=>take({kind:'CARD',cardId:id})}/></>:<button disabled={disabled} onClick={()=>take({kind:'NONE'})}>받기</button>}
      {option.kind==='UPGRADE_OR_WORKER'&&<button disabled={disabled||s.workers>=4} onClick={()=>take({kind:'WORKER'})}>직원 받기</button>}
    </div>;
  })}</section>;
}
