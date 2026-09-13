import type { TerrorRoom, TerrorMap } from './actions.js';
export const TERROR_ROOM_INFO:Readonly<Record<TerrorRoom,{name:string;x:number;y:number;search?:boolean;hint:string}>>={
 B1:{name:'거실',x:16,y:15,hint:'무전기 · 무덤 통로'},B2:{name:'식당',x:39,y:18,hint:''},B3:{name:'주방',x:63,y:9,hint:''},B4:{name:'창고',x:85,y:14,search:true,hint:'수색'},B5:{name:'연회장',x:68,y:40,hint:'정원 통로'},
 R1:{name:'메인 홀',x:14,y:44,hint:'정문 탈출'},R3:{name:'중앙 복도',x:42,y:43,hint:''},R4:{name:'작업실',x:47,y:61,hint:''},R2:{name:'전시실',x:17,y:74,search:true,hint:'수색'},R5:{name:'서재',x:43,y:80,hint:''},
 G1:{name:'뒷길',x:32,y:92,hint:''},G2:{name:'무덤',x:56,y:92,hint:'거실 통로'},G3:{name:'헛간',x:89,y:83,hint:''},G4:{name:'온실',x:65,y:74,search:true,hint:'수색'},G5:{name:'정원',x:90,y:45,hint:'숨겨진 출구 · 연회장 통로'},
};
export const TERROR_DOORS:readonly (readonly [TerrorRoom,TerrorRoom])[]=[['B1','B2'],['B1','R1'],['B2','B3'],['B3','B4'],['B4','G5'],['B2','R1'],['B2','B5'],['R3','B5'],['R4','B5'],['R1','R3'],['R1','R2'],['R2','R3'],['R2','R5'],['R4','R5'],['R5','G4'],['G4','G3'],['R2','G1']];
export const TERROR_PATHS:readonly (readonly [TerrorRoom,TerrorRoom])[]=[['G1','G2'],['G2','G3'],['G3','G5']];
export const TERROR_PASSAGES:Partial<Record<TerrorRoom,TerrorRoom>>={B1:'G2',G2:'B1',B5:'G5',G5:'B5'};
export const terrorEdge=(a:TerrorRoom,b:TerrorRoom):string=>[a,b].sort().join('-');
export function terrorAdjacent(a:TerrorRoom,b:TerrorRoom,map:TerrorMap='MANOR',killerMove=false):boolean{if(map==='CABIN'&&killerMove&&terrorEdge(a,b)==='G2-R5')return true;const board=terrorBoard(map);return [...board.doors,...board.paths].some(([x,y])=>x===a&&y===b||x===b&&y===a);}
export function terrorPaths(start:TerrorRoom,steps:number,blocks:readonly string[],map:TerrorMap='MANOR',killerMove=false):Map<TerrorRoom,TerrorRoom[]>{const found=new Map<TerrorRoom,TerrorRoom[]>(),queue:[TerrorRoom,TerrorRoom[]][]=[[start,[]]];for(let i=0;i<queue.length;i++){const [at,path]=queue[i]!;if(path.length>=steps)continue;for(const [a,b] of [...terrorBoard(map).doors,...terrorBoard(map).paths,...(map==='CABIN'&&killerMove?[['G2','R5'] as const]:[])]){const to=a===at?b:b===at?a:null;if(!to||to===start||found.has(to)||blocks.includes(terrorEdge(at,to)))continue;const next=[...path,to];found.set(to,next);queue.push([to,next]);}}return found;}

/** English v2 Cabin board. Passages are not adjacency for range effects. */
export const TERROR_CABIN_INFO:typeof TERROR_ROOM_INFO={
 R1:{name:'접수실',x:34,y:89,hint:'Reception · 정문'},R2:{name:'회의실',x:51,y:84,hint:'Conference Centre'},R3:{name:'게임실',x:56,y:51,search:true,hint:'Game Room · 수색'},R4:{name:'102호',x:42,y:52,hint:'Room 102 · 여행 가방'},R5:{name:'101호',x:42,y:38,hint:'Room 101 · 책 · I 통로'},
 B1:{name:'동쪽 야영지',x:69,y:87,hint:'East Campground · II 통로'},B2:{name:'호숫가 별장',x:86,y:81,search:true,hint:'Lakeview House · 수색 · I 통로'},B3:{name:'호숫가',x:83,y:58,hint:'Lakeside · 무전기'},B4:{name:'모닥불 터',x:70,y:44,hint:'Bonfire Area · 도구'},B5:{name:'소나무 숲길',x:63,y:20,hint:'Pinetum Trail · 숨겨진 출구'},
 G1:{name:'서쪽 야영지',x:25,y:72,hint:'West Campground'},G2:{name:'숲속 길',x:21,y:46,hint:'Forest Track · 살인자 통로'},G3:{name:'오래된 채석장',x:13,y:21,hint:'Old Quarry · 주술 · II 통로'},G4:{name:'오두막',x:26,y:26,search:true,hint:'Cabin · 수색'},G5:{name:'북쪽 산책로',x:41,y:14,hint:'North Trail'},
};
export const TERROR_CABIN_DOORS:typeof TERROR_DOORS=[['G3','G4'],['G2','G4'],['G4','G5'],['G5','B5'],['R5','R3'],['R4','R3'],['R3','B4'],['R3','R2'],['R2','G1'],['R1','G1'],['R1','R2'],['R2','B1'],['B2','B3']];
export const TERROR_CABIN_PATHS:typeof TERROR_PATHS=[['G3','G5'],['G3','G2'],['G2','G1'],['B5','B4'],['B4','B3'],['B4','B1'],['B3','B1']];
export const TERROR_CABIN_PASSAGES:typeof TERROR_PASSAGES={R5:'B2',B2:'R5',G3:'B1',B1:'G3'};
export function terrorBoard(map:import('./actions.js').TerrorMap='MANOR'){
 return map==='CABIN'?{rooms:TERROR_CABIN_INFO,doors:TERROR_CABIN_DOORS,paths:TERROR_CABIN_PATHS,passages:TERROR_CABIN_PASSAGES,radio:'B3' as const,book:'R5' as const,occult:'G3' as const,tools:'B4' as const,exit:'B5' as const}:{rooms:TERROR_ROOM_INFO,doors:TERROR_DOORS,paths:TERROR_PATHS,passages:TERROR_PASSAGES,radio:'B1' as const,book:'R5' as const,occult:'G2' as const,tools:'G3' as const,exit:'G5' as const};
}
export function terrorDistance(a:TerrorRoom,b:TerrorRoom,map:import('./actions.js').TerrorMap='MANOR',killerMove=false):number{return a===b?0:terrorPaths(a,15,[],map,killerMove).get(b)?.length??Infinity;}
