import { HARMONIES_ANIMALS, harmoniesAnimal, type HarmoniesColor } from './catalog.js';
import type { HarmoniesCell, HarmoniesOwnedCard, HarmoniesPlayer, HarmoniesStep, HarmoniesToken } from './actions.js';
export type HarmoniesCoord = { q: number; r: number };
/** Flat-top axial coordinates. The five columns contain 5/4/5/4/5 cells. */
export const HARMONIES_CELLS: readonly HarmoniesCoord[] = Array.from({ length: 5 }, (_, q) => Array.from({ length: q % 2 ? 4 : 5 }, (_, row) => ({ q, r: row - Math.floor(q / 2) }))).flat();
const DIRECTIONS = [{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
export function harmoniesCellAt(q: number, r: number): number { return HARMONIES_CELLS.findIndex(c => c.q === q && c.r === r); }
export function harmoniesNeighbors(id: number): number[] { const p = HARMONIES_CELLS[id]; return p ? DIRECTIONS.map(d => harmoniesCellAt(p.q+d.q,p.r+d.r)).filter(n => n >= 0) : []; }
export function harmoniesRotate(p: HarmoniesCoord, rotation: number): HarmoniesCoord { let {q,r}=p; for(let i=0;i<rotation;i++) [q,r]=[-r,q+r]; return {q,r}; }
export function harmoniesPatternCells(cardId: number, origin: number, rotation: number): number[] {
  const at = HARMONIES_CELLS[origin]; if(!at) return [];
  return harmoniesAnimal(cardId).pattern.map(p => {const rotated=harmoniesRotate(p,rotation); return harmoniesCellAt(at.q+rotated.q,at.r+rotated.r);});
}
export function harmoniesStackValid(stack: readonly HarmoniesToken[]): boolean {
  if(stack.length<=1) return true;
  const colors=stack.map(t=>t.color),top=colors.at(-1);
  return stack.length<=3 && ((top==='STONE'&&colors.every(c=>c==='STONE')) || (top==='WOOD'&&stack.length===2&&colors.every(c=>c==='WOOD')) || (top==='LEAF'&&colors.slice(0,-1).every(c=>c==='WOOD')) || (top==='RED'&&stack.length===2&&['RED','WOOD','STONE'].includes(colors[0]!)));
}
export function harmoniesCanPlace(cell: HarmoniesCell, token: HarmoniesToken): boolean { return cell.animal===null && harmoniesStackValid([...cell.stack,token]); }
export function harmoniesCanSettle(board: readonly HarmoniesCell[], cardId: number, origin: number, rotation: number): boolean {
  const def=harmoniesAnimal(cardId),ids=harmoniesPatternCells(cardId,origin,rotation);
  return ids.length===def.pattern.length && def.pattern.every((p,i)=>{
    const cell=board[ids[i]!]; if(!cell || p.animal&&cell.animal!==null) return false;
    if(p.stack[0]==='BUILDING') return cell.stack.length===2 && cell.stack.at(-1)?.color==='RED';
    return p.stack.length===cell.stack.length && p.stack.every((color,j)=>cell.stack[j]?.color===color);
  });
}
export function harmoniesMatches(board: readonly HarmoniesCell[], cardId: number): {origin:number;rotation:number;target:number;cells:number[]}[] {
  const def=harmoniesAnimal(cardId),anchor=def.pattern.findIndex(p=>p.animal),found=[];
  const seen=new Set<number>();
  for(let origin=0;origin<23;origin++) for(let rotation=0;rotation<6;rotation++) if(harmoniesCanSettle(board,cardId,origin,rotation)){
    const cells=harmoniesPatternCells(cardId,origin,rotation),target=cells[anchor]!;
    if(!seen.has(target)){found.push({origin,rotation,target,cells});seen.add(target);}
  }
  return found;
}
export type HarmoniesScoreKind = 'trees'|'mountains'|'fields'|'buildings'|'water'|'animals';
export type HarmoniesScore = Record<HarmoniesScoreKind|'total',number> & { lines: {kind:HarmoniesScoreKind;cells:number[];points:number;cardId:number|null}[] };
export function harmoniesScore(board: readonly HarmoniesCell[], cards: readonly HarmoniesOwnedCard[]): HarmoniesScore {
  const score:HarmoniesScore={trees:0,mountains:0,fields:0,buildings:0,water:0,animals:0,total:0,lines:[]};
  const add=(kind:HarmoniesScoreKind,cells:number[],points:number,cardId:number|null=null)=>{score[kind]+=points;score.total+=points;score.lines.push({kind,cells,points,cardId});};
  const top=(i:number)=>board[i]?.stack.at(-1)?.color;
  board.forEach((c,i)=>{
    if(top(i)==='LEAF')add('trees',[i],[0,1,3,7][c.stack.length]??0);
    if(top(i)==='STONE')add('mountains',[i],harmoniesNeighbors(i).some(n=>top(n)==='STONE')?([0,1,3,7][c.stack.length]??0):0);
    if(top(i)==='RED'&&c.stack.length===2)add('buildings',[i],new Set(harmoniesNeighbors(i).map(top).filter(c=>c!==undefined)).size>=3?5:0);
  });
  const unseen=new Set(board.flatMap((_,i)=>top(i)==='FIELD'?[i]:[]));
  while(unseen.size){const first=unseen.values().next().value; if(first===undefined)break;const cells=[first];unseen.delete(first);for(let p=0;p<cells.length;p++)for(const n of harmoniesNeighbors(cells[p]!))if(unseen.delete(n))cells.push(n);add('fields',cells,cells.length>=2?5:0);}
  // Maximum shortest path among blue cells (not a longest walk or the size of a component).
  let best:number[]=[];
  board.forEach((_,start)=>{if(top(start)!=='WATER')return;const paths=new Map<number,number[]>([[start,[start]]]),queue=[start];for(let p=0;p<queue.length;p++){const id=queue[p]!,path=paths.get(id)!;if(path.length>best.length)best=path;for(const n of harmoniesNeighbors(id))if(top(n)==='WATER'&&!paths.has(n)){paths.set(n,[...path,n]);queue.push(n);}}});
  add('water',best,best.length>6?15+(best.length-6)*4:([0,0,2,5,8,11,15][best.length]??0));
  for(const card of cards)add('animals',board.flatMap((c,i)=>c.animal===card.cardId?[i]:[]),harmoniesAnimal(card.cardId).points[card.placed-1]??0,card.cardId);
  return score;
}
export type HarmoniesDraft = { player:HarmoniesPlayer;pool:HarmoniesToken[];source:number|null;takenCard:number|null;placed:number;ready:boolean };
export type HarmoniesDraftResult = {ok:true;draft:HarmoniesDraft}|{ok:false;message:string};
/** Public deterministic preview, also replayed by the server; never accepts a client-computed board. */
export function harmoniesReplay(player: HarmoniesPlayer, markets: readonly (readonly HarmoniesToken[])[], animalMarket: readonly number[], steps: readonly HarmoniesStep[]): HarmoniesDraftResult {
  const draft:HarmoniesDraft={player:{...player,board:player.board.map(c=>({...c,stack:c.stack.map(t=>({...t}))})),cards:player.cards.map(c=>({...c}))},pool:[],source:null,takenCard:null,placed:0,ready:false};
  const no=(message:string):HarmoniesDraftResult=>({ok:false,message});
  for(const step of steps){
    if(step.type==='TAKE_TOKENS'){
      if(draft.source!==null || markets[step.source]?.length!==3)return no('토큰 세 개가 있는 묶음 하나를 선택하세요.');
      draft.source=step.source;draft.pool=[...markets[step.source]!];
    }else if(step.type==='PLACE'){
      const token=draft.pool.find(t=>t.tileId===step.tileId),cell=draft.player.board[step.cell];
      if(!token||!cell||!harmoniesCanPlace(cell,token))return no('이 토큰을 놓을 수 없는 칸입니다. 쌓기 규칙과 동물 위치를 확인하세요.');
      cell.stack.push(token);draft.pool=draft.pool.filter(t=>t.tileId!==token.tileId);draft.placed++;
    }else if(step.type==='TAKE_ANIMAL'){
      if(draft.takenCard!==null||!animalMarket.includes(step.cardId)||draft.player.cards.filter(c=>c.placed<harmoniesAnimal(c.cardId).points.length).length>=4)return no('동물 카드는 턴마다 한 장, 진행 중인 카드는 네 장까지 가질 수 있어요.');
      draft.takenCard=step.cardId;draft.player.cards.push({cardId:step.cardId,placed:0});
    }else{
      const owned=draft.player.cards.find(c=>c.cardId===step.cardId),def=HARMONIES_ANIMALS.find(c=>c.id===step.cardId);
      if(!owned||!def||owned.placed>=def.points.length||!harmoniesCanSettle(draft.player.board,step.cardId,step.origin,step.rotation))return no('동물의 서식지 모양과 높이, 남은 동물을 확인하세요.');
      const ids=harmoniesPatternCells(step.cardId,step.origin,step.rotation),target=ids[def.pattern.findIndex(c=>c.animal)]!;
      draft.player.board[target]!.animal=step.cardId;owned.placed++;
    }
  }
  draft.ready=draft.source!==null&&draft.placed===3&&draft.pool.length===0;
  return {ok:true,draft};
}
export function harmoniesPlayerValid(p:HarmoniesPlayer):boolean {
  if(p.board.length!==23||new Set(p.cards.map(c=>c.cardId)).size!==p.cards.length||p.cards.filter(c=>c.placed<harmoniesAnimal(c.cardId).points.length).length>4)return false;
  if(p.board.some(c=>!harmoniesStackValid(c.stack)||c.animal!==null&&(c.stack.length===0||!p.cards.some(a=>a.cardId===c.animal))))return false;
  return p.cards.every(c=>c.placed<=harmoniesAnimal(c.cardId).points.length&&p.board.filter(cell=>cell.animal===c.cardId).length===c.placed);
}
export function harmoniesTopColor(cell: HarmoniesCell): HarmoniesColor | undefined {return cell.stack.at(-1)?.color;}
