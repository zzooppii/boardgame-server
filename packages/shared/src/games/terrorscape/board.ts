import type { TerrorRoom } from './actions.js';
export const TERROR_ROOM_INFO:Readonly<Record<TerrorRoom,{name:string;x:number;y:number;search?:boolean;hint:string}>>={
 B1:{name:'거실',x:9,y:12,hint:'무전기 · 묘지 통로'},B2:{name:'식당',x:27,y:12,hint:''},B3:{name:'주방',x:45,y:12,hint:''},B4:{name:'창고',x:65,y:12,search:true,hint:'수색'},B5:{name:'연회장',x:48,y:34,hint:'정원 통로'},
 R1:{name:'대현관',x:10,y:37,hint:'정문 탈출'},R3:{name:'복도',x:29,y:37,hint:''},R4:{name:'작은 서재',x:66,y:38,hint:''},R2:{name:'회랑',x:16,y:63,search:true,hint:'수색'},R5:{name:'도서관',x:52,y:62,hint:''},
 G1:{name:'오솔길',x:10,y:87,hint:''},G2:{name:'묘지',x:31,y:87,hint:'거실 통로'},G3:{name:'헛간',x:55,y:87,hint:''},G4:{name:'온실',x:77,y:67,search:true,hint:'수색'},G5:{name:'정원',x:88,y:29,hint:'숨겨진 출구 · 연회장 통로'},
};
export const TERROR_DOORS:readonly (readonly [TerrorRoom,TerrorRoom])[]=[['B1','B2'],['B1','R1'],['B2','B3'],['B3','B4'],['B4','G5'],['B2','R1'],['B2','B5'],['R3','B5'],['R4','B5'],['R1','R3'],['R1','R2'],['R2','R3'],['R2','R5'],['R4','R5'],['R5','G4'],['G4','G3'],['R2','G1']];
export const TERROR_PATHS:readonly (readonly [TerrorRoom,TerrorRoom])[]=[['G1','G2'],['G2','G3'],['G3','G5']];
export const TERROR_PASSAGES:Partial<Record<TerrorRoom,TerrorRoom>>={B1:'G2',G2:'B1',B5:'G5',G5:'B5'};
export const terrorEdge=(a:TerrorRoom,b:TerrorRoom):string=>[a,b].sort().join('-');
export function terrorAdjacent(a:TerrorRoom,b:TerrorRoom):boolean{return [...TERROR_DOORS,...TERROR_PATHS].some(([x,y])=>x===a&&y===b||x===b&&y===a);}
export function terrorPaths(start:TerrorRoom,steps:number,blocks:readonly string[]):Map<TerrorRoom,TerrorRoom[]>{const found=new Map<TerrorRoom,TerrorRoom[]>(),queue:[TerrorRoom,TerrorRoom[]][]=[[start,[]]];for(let i=0;i<queue.length;i++){const [at,path]=queue[i]!;if(path.length>=steps)continue;for(const [a,b] of [...TERROR_DOORS,...TERROR_PATHS]){const to=a===at?b:b===at?a:null;if(!to||to===start||found.has(to)||blocks.includes(terrorEdge(at,to)))continue;const next=[...path,to];found.set(to,next);queue.push([to,next]);}}return found;}
