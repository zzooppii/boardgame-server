/** Fixed interaction example only. No game commands, catalog values, or multiplayer state. */
export const CITY_PREVIEW_TILES = [
  {id:'produce',label:'주류 생산',symbol:'BARREL',detail:'증류소에서 주류를 생산하는 도시 타일'},
  {id:'deliver',label:'주류 운송',symbol:'TRUCK',detail:'주류를 싣고 건물로 배달하는 도시 타일'},
  {id:'protect',label:'건물 보호',symbol:'FAMILY',detail:'패밀리를 보내 건물을 보호하는 도시 타일'},
  {id:'book',label:'장부 획득',symbol:'BOOK',detail:'개인판에 장부를 가져오는 도시 타일'},
  {id:'family',label:'패밀리 획득',symbol:'FAMILY',detail:'VIP 룸에 패밀리를 가져오는 도시 타일'},
  {id:'card',label:'운영 카드',symbol:'BOOK',detail:'운영 카드를 가져오는 도시 타일'},
] as const;
export type CityPreviewState = Readonly<{
  phase:'USE'|'DRAW'|'RETURN'|'DONE'; held:readonly string[]; used:readonly string[];
  selected:string|null; piles:readonly (readonly string[])[]; message:string; revision:number;
}>;
export type CityPreviewAction = {type:'SELECT';id:string|null}|{type:'USE'}|{type:'FINISH'}|{type:'DRAW'}|{type:'RETURN';row:number}|{type:'RESET'};
export function startCityPreview():CityPreviewState {
  return {phase:'USE',held:CITY_PREVIEW_TILES.map(t=>t.id),used:[],selected:null,piles:[['display-a','display-b'],[],['display-c']],
    message:'타일을 선택한 뒤 사용을 확정하세요. 최대 2개까지 체험할 수 있습니다.',revision:0};
}
export function cityPreviewReturns(s:CityPreviewState):number {
  const played=s.held.filter(id=>s.used.includes(id)).length;
  return played+Math.max(0,s.held.length-played-4);
}
export function cityPreviewSelectable(s:CityPreviewState,id:string):boolean {
  if(!s.held.includes(id)) return false;
  if(s.phase==='USE') return s.used.length<2&&!s.used.includes(id);
  return s.phase==='RETURN'&&(s.used.includes(id)||s.held.filter(id=>!s.used.includes(id)).length>4);
}
export function cityPreviewRows(s:CityPreviewState):readonly number[] {
  if(s.phase!=='RETURN'||!s.selected||!cityPreviewSelectable(s,s.selected)) return [];
  const min=Math.min(...s.piles.map(p=>p.length));
  return s.piles.flatMap((p,i)=>p.length===min?[i]:[]);
}
export function cityPreviewStep(s:CityPreviewState,a:CityPreviewAction):CityPreviewState {
  const next=(patch:Partial<CityPreviewState>):CityPreviewState=>({...s,...patch,revision:s.revision+1});
  if(a.type==='RESET') return {...startCityPreview(),revision:s.revision+1};
  if(a.type==='SELECT') {
    if(a.id===null&&s.selected===null) return s;
    if(a.id!==null&&!cityPreviewSelectable(s,a.id)) return s;
    return next({selected:a.id,message:a.id?`${CITY_PREVIEW_TILES.find(t=>t.id===a.id)!.label} 선택. ${s.phase==='USE'?'사용 버튼으로 확정하세요.':'반환 가능한 전시장 칸을 고르세요.'}`:'선택을 취소했습니다.'});
  }
  if(a.type==='USE'&&s.phase==='USE'&&s.selected&&cityPreviewSelectable(s,s.selected)) {
    return next({used:[...s.used,s.selected],selected:null,message:`${CITY_PREVIEW_TILES.find(t=>t.id===s.selected)!.label} 사용 표시. 타일은 턴 종료까지 개인판에 남습니다.`});
  }
  if(a.type==='FINISH'&&s.phase==='USE') return next({phase:'DRAW',selected:null,message:'도시 타일 사용을 마쳤습니다. 먼저 운영 카드를 뽑으세요.'});
  if(a.type==='DRAW'&&s.phase==='DRAW') return next({phase:cityPreviewReturns(s)?'RETURN':'DONE',selected:null,message:'예시 파티 카드를 뽑았습니다. 이제 사용한 타일과 초과분을 반환하세요.'});
  if(a.type==='RETURN'&&s.selected&&cityPreviewRows(s).includes(a.row)) {
    const held=s.held.filter(id=>id!==s.selected), piles=s.piles.map((p,i)=>i===a.row?[s.selected!,...p]:[...p]);
    const remaining=cityPreviewReturns({...s,held});
    return next({held,piles,selected:null,phase:remaining?'RETURN':'DONE',message:remaining?`${a.row+1}번 칸에 반환했습니다. ${remaining}개를 더 반환하세요.`:'반환 완료. 미사용 타일 4개를 남기고 다음 차례로 넘어갑니다.'});
  }
  return s;
}
