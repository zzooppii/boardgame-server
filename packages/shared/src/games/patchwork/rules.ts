import {patchworkPatch,PATCHWORK_INCOME,PATCHWORK_END} from './catalog.js';
import type {PatchworkPlacement,PatchworkPlayer,PatchworkRotation} from './actions.js';
export type PatchworkCell=Readonly<{x:number;y:number}>;
export function patchworkCells(id:number,rotation:PatchworkRotation=0,flipped=false):PatchworkCell[]{
 let cells=patchworkPatch(id).rows.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='#'?[{x:flipped?-x:x,y}]:[]));
 for(let i=0;i<rotation;i++)cells=cells.map(({x,y})=>({x:-y,y:x}));
 const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));
 return cells.map(({x,y})=>({x:x-minX,y:y-minY}));
}
export function patchworkOccupied(placements:readonly PatchworkPlacement[]):Set<number>{
 return new Set(placements.flatMap(p=>patchworkCells(p.patchId,p.rotation,p.flipped).map(c=>(c.y+p.y)*9+c.x+p.x)));
}
export function patchworkCanPlace(placements:readonly PatchworkPlacement[],id:number,x:number,y:number,rotation:PatchworkRotation,flipped:boolean):boolean{
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0)return false;
 const occupied=patchworkOccupied(placements);
 return patchworkCells(id,rotation,flipped).every(c=>c.x+x<9&&c.y+y<9&&!occupied.has((c.y+y)*9+c.x+x));
}
export function patchworkFirstPlacement(placements:readonly PatchworkPlacement[],id:number):{x:number;y:number;rotation:PatchworkRotation;flipped:boolean}|null{
 for(const flipped of [false,true])for(const rotation of [0,1,2,3] as const)for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(patchworkCanPlace(placements,id,x,y,rotation,flipped))return {x,y,rotation,flipped};
 return null;
}
export function patchworkSeven(placements:readonly PatchworkPlacement[]):{x:number;y:number}|null{
 const occupied=patchworkOccupied(placements);
 for(let y=0;y<=2;y++)for(let x=0;x<=2;x++){let filled=true;for(let dy=0;dy<7&&filled;dy++)for(let dx=0;dx<7;dx++)if(!occupied.has((y+dy)*9+x+dx)){filled=false;break;}if(filled)return {x,y};}
 return null;
}
export function patchworkScore(p:PatchworkPlayer,bonusOwner:string|null){const empty=81-patchworkOccupied(p.placements).size,bonus=bonusOwner===p.playerId?7:0;return {buttons:p.buttons,empty,penalty:empty*2,bonus,total:p.buttons+bonus-empty*2};}
export function patchworkPlayerValid(p:PatchworkPlayer):boolean{
 const before:PatchworkPlacement[]=[];
 for(const tile of p.placements){if(!patchworkCanPlace(before,tile.patchId,tile.x,tile.y,tile.rotation,tile.flipped))return false;before.push(tile);}
 return p.income===p.placements.reduce((n,t)=>n+patchworkPatch(t.patchId).income,0);
}
export function patchworkMovePreview(p:PatchworkPlayer,otherPosition:number,patchId:number|null){
 const patch=patchId===null?null:patchworkPatch(patchId),target=Math.min(PATCHWORK_END,patch?p.position+patch.time:otherPosition+1),distance=target-p.position;
 const income=p.income+(patch?.income??0),incomeCount=PATCHWORK_INCOME.filter(n=>n>p.position&&n<=target).length;
 return {target,distance,income,incomeCount,incomeGain:incomeCount*income,buttons:p.buttons-(patch?.cost??0)+(patch?0:distance)+income*incomeCount,again:target<=otherPosition&&target<PATCHWORK_END};
}
