import {safeParse} from 'valibot';
import {SpeakeasyBoardViewSchema,type SpeakeasyBoardView} from '@hangul-rummikub/shared';

/** Validate the recipient/game boundary before mounting private screen content. */
export function readSpeakeasyBoardView(input:unknown,gameId:string,viewerId:string):SpeakeasyBoardView|null {
  const parsed=safeParse(SpeakeasyBoardViewSchema,input);
  if(!parsed.success) return null;
  const view=parsed.output,t=view.turn;
  if(t.gameId!==gameId||t.viewerId!==viewerId||!t.order.includes(t.viewerId)||
    new Set(t.order).size!==t.order.length||view.districts.some((d,i)=>d.id!==i+1)) return null;
  if(view.luciano&&(view.luciano.gameId!==gameId||view.luciano.revision!==t.revision||view.luciano.self.playerId!==viewerId)) return null;
  if(view.result&&t.stage!=='FINAL_SCORING') return null;
  return view;
}
export function speakeasyBoardFocus(district:number,key:string,columns:2|4):number|null {
  if(!Number.isInteger(district)||district<1||district>16) return null;
  if(key==='ArrowLeft') return (district-1)%columns ? district-1 : null;
  if(key==='ArrowRight') return district%columns ? district+1 : null;
  if(key==='ArrowUp') return district>columns ? district-columns : null;
  if(key==='ArrowDown') return district<=16-columns ? district+columns : null;
  return null;
}
export const SPEAKEASY_STAGE_LABELS:Record<SpeakeasyBoardView['turn']['stage'],string>={
  PARK_BENEFIT:'공원 보상 선택',PLACE_CAPO:'카포 배치 대기',LOCATION:'장소 행동 진행',RESTAURANT_CHOICE:'레스토랑 행동 선택',
  RESTAURANT_ACTION:'레스토랑 행동 진행',FINISH_LOCATION:'장소 행동 마무리',DRAW_OPERATION:'운영 카드 뽑기',
  RETURN_CITY:'도시 타일 반환',ROUND_END:'라운드 정산',LUCIANO:'마피아 충돌',FINAL_SCORING:'최종 결과',
};
