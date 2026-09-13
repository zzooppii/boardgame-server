import {terrorFeedback} from '../features/terrorscape/feedback.js';
import {ManorMap} from '../features/terrorscape/ManorMap.js';
import {CABIN_ROOMS,CABIN_DOORS,CABIN_OUTDOOR} from '../features/terrorscape/cabin-layout.js';
import {MANOR_ROOMS,MANOR_DOORS,MANOR_OUTDOOR} from '../features/terrorscape/manor-layout.js';
import {terrorBoard,terrorAdjacent,terrorDistance,TERROR_DOORS,TERROR_PATHS,TERROR_ROOMS,TERROR_ROOM_INFO,terrorEdge} from '@hangul-rummikub/shared';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse,safeParse} from 'valibot';
import {TerrorscapeLobbyPlatformSnapshotV2Schema,TerrorscapePlayingPlatformSnapshotV2Schema,TerrorscapeFinishedPlatformSnapshotV2Schema,TerrorscapeClientCommandSchema,TERROR_CHARACTERS} from '@hangul-rummikub/shared';
import {TerrorscapeScreen} from '../features/terrorscape/TerrorscapeScreen.js';
import {decodeWebSnapshot,type TerrorscapeWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
const players=[{playerId:'a',nickname:'추격자',isHost:true,connectionStatus:'CONNECTED'},{playerId:'b',nickname:'생존자',isHost:false,connectionStatus:'CONNECTED'}];
function lobby(){return parse(TerrorscapeLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:'a'},room:{roomId:'terror',roomCode:'ABCDEF',gameType:'TERRORSCAPE',phase:'LOBBY',players},game:null});}
function playing(killer=false){const l=lobby();return parse(TerrorscapePlayingPlatformSnapshotV2Schema,{...l,self:{playerId:killer?'a':'b'},room:{...l.room,phase:'PLAYING'},game:{gameType:'TERRORSCAPE',gameId:'game',gameRevision:2,rulesVersion:'terrorscape-base-v2',playerStates:players.map(({playerId})=>({playerId})),killerPlayerId:'a',owners:['b','b','b'],round:1,difficulty:'NONE',killerTraits:[],groupMove:null,plansEnabled:false,separateWays:false,firstDiscover:null,keys:0,killerType:'BUTCHER',stealthOrigin:null,killerLocation:'G5',level:1,strength:5,blocks:[],noises:[],firecracker:false,conditions:TERROR_CHARACTERS.slice(0,3).map(character=>({character,outcome:'ACTIVE',keys:0,fear:0,injuries:0})),sensed:[],encounter:null,dice:[],defenseTotal:null,history:[],phase:'SURVIVORS',turnId:'turn',privateState:killer?{role:'KILLER',playerId:'a',killer:{traitOffer:[],traitsChosen:true,usedTraits:[],senseTargets:[],levelTrait:null,hand:[],deckCount:10,discardCount:0,actionsLeft:2,slowUsed:false,discard:[],fearTarget:null,levelBlocksRemaining:0}}:{role:'SURVIVOR',playerId:'b',team:{traits:[],usedTraits:[],keyOwners:[],plan:{cards:[],active:null,progress:0,complete:false,used:false,location:null,chooser:null},survivors:TERROR_CHARACTERS.slice(0,3).map(character=>({character,outcome:'ACTIVE',playerId:'b',location:'R1',fear:0,injuries:0,hand:[],acted:false,ready:false})),keys:0,repair:0,repaired:false,rescue:null,trap:null,searchCount:11,discoverCount:32,discard:[],loot:null,pings:[]}}}});}
const render=(snapshot:TerrorscapeWebSnapshot,connected=true)=>renderToStaticMarkup(createElement(TerrorscapeScreen,{snapshot,connected,pending:false,error:null,connectionLabel:'서버 연결됨',onCommand:async()=>{},onRematch(){},onStart(){},onLeave(){},onCopy(){}}));
test('Terrorscape UI: role-specific renderer, all rooms, audio controls and platform decoding',()=>{for(const s of [lobby(),playing(),playing(true)]){const d=decodeWebSnapshot(s);assert.equal(d.kind,'COMPATIBLE');if(d.kind==='COMPATIBLE')assert.equal(resolveRoomSnapshotView(d.value).kind,'TERRORSCAPE');const html=render(s);assert.match(html,/배경음악 음량/);assert.match(html,/효과음 음량/);assert.doesNotMatch(html,/class="tr-/);}const team=render(playing()),killer=render(playing(true));assert.equal((team.match(/class="tsc-floor-room /g)??[]).length,15);assert.match(team,/무전기 수리/);assert.doesNotMatch(killer,/무전기 수리<small/);assert.match(killer,/위치 비공개/);assert.doesNotMatch(killer,/남은 발견/);assert.match(render(playing(),false),/연결 복구를 기다리고/);});
test('Terrorscape DTO: opposite-side payload, wrong viewer, injected position and forged result fail closed',()=>{const s=playing(true);for(const game of [{...s.game,discoverDeck:[]},{...s.game,privateState:{...s.game.privateState,team:{}}},{...s.game,privateState:{...s.game.privateState,playerId:'b'}}])assert.equal(safeParse(TerrorscapePlayingPlatformSnapshotV2Schema,{...s,game}).success,false);const c={kind:'terrorscape:act',protocolVersion:1,requestId:'req',gameId:'game',expectedGameRevision:0,turnId:'turn',payload:{type:'DEFEND',cardId:null}};assert.equal(safeParse(TerrorscapeClientCommandSchema,c).success,true);assert.equal(safeParse(TerrorscapeClientCommandSchema,{...c,payload:{...c.payload,dice:[3,3,3,3]}}).success,false);});
test('Terrorscape UI: loot, defense, flee, unlock and finished stages render without exposing other role',()=>{const s=playing(),g=s.game;assert.equal(g.privateState.role,'SURVIVOR');if(g.privateState.role!=='SURVIVOR')return;g.phase='LOOT';g.privateState.team.loot={character:'ANNA',source:'SEARCH',cards:[]};assert.match(render(s),/모두 버리기/);g.privateState.team.loot=null;g.encounter={location:'R1',targets:['ANNA'],attacked:[],defender:'ANNA',fleePending:[]};g.phase='DEFEND';assert.match(render(s),/맨손으로 방어 주사위 굴리기/);g.phase='FLEE';g.encounter.fleePending=['ANNA'];assert.match(render(s),/현 위치에 머무르기/);const k=playing(true);k.game.phase='UNLOCK';assert.match(render(k),/새로운 능력 각성/);const {turnId:_turn,phase:_phase,...base}=g;const f=parse(TerrorscapeFinishedPlatformSnapshotV2Schema,{...s,room:{...s.room,phase:'FINISHED'},game:{...base,phase:'FINISHED',result:{reason:'RESCUED',winnerPlayerIds:['b']}}});assert.match(render(f),/구조대가 도착했습니다/);});

test('Terrorscape UI: reward is retained in full; plans and private trait choices are actionable',()=>{
 const s=playing();if(s.game.privateState.role!=='SURVIVOR')throw new Error('Wrong fixture');const team=s.game.privateState.team;s.game.phase='LOOT';team.loot={character:'ANNA',source:'REWARD',cards:[]};assert.match(render(s),/보상 모두 받기/);assert.doesNotMatch(render(s),/모두 버리기|최대 한 장을 보관/);
 team.loot=null;s.game.phase='TRAIT_DRAFT';s.game.difficulty='NORMAL';team.traits=[{character:'ANNA',offered:['MARTIAL','FIRST_AID'],chosen:null}];assert.match(render(s),/Martial Arts/);assert.match(render(s),/First Aid/);
 s.game.phase='PLAN';team.plan={cards:['INTEL','AMBUSH'],active:'INTEL',progress:1,complete:false,used:false,location:null,chooser:'ANNA'};assert.match(render(s),/이 계획을 한 단계 진행/);
 const k=playing(true);k.game.killerType='SPECTRE';k.game.stealthOrigin='G5';k.game.killerLocation='B4';assert.match(render(k),/base-cast.webp/);assert.match(render(k),/실제 위치는 나만/);
});


test('Terrorscape map: physical doors and outdoor boundaries cover the rule graph exactly',()=>{
 assert.deepEqual(Object.keys(MANOR_DOORS).sort(),TERROR_DOORS.map(([a,b])=>terrorEdge(a,b)).sort());
 assert.deepEqual(Object.keys(MANOR_OUTDOOR).sort(),TERROR_PATHS.map(([a,b])=>terrorEdge(a,b)).sort());
 assert.deepEqual(Object.keys(MANOR_ROOMS).sort(),[...TERROR_ROOMS].sort());
 assert.deepEqual(['R1','R2','R3','R4','R5','G1','G2'].map(r=>TERROR_ROOMS.find(x=>x===r)).map(r=>r&&TERROR_ROOM_INFO[r].name),['메인 홀','전시실','중앙 복도','작업실','서재','뒷길','무덤']);
 // Each doorway must sit on both rooms' walls, never inside an unrelated room.
 const distance=(p:readonly number[],a:readonly number[],b:readonly number[])=>{const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,t=Math.max(0,Math.min(1,((p[0]!-a[0]!)*dx+(p[1]!-a[1]!)*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]!-a[0]!-t*dx,p[1]!-a[1]!-t*dy);};
 for(const [a,b] of TERROR_DOORS)for(const room of [a,b]){const points=MANOR_ROOMS[room].polygon.split(' ').map(p=>p.split(',').map(Number));const at=MANOR_DOORS[terrorEdge(a,b)]!.at;assert.ok(points.some((p,i)=>distance(at,p,points[(i+1)%points.length]!)<1),`${a}-${b} must touch ${room}`);}
});
test('Terrorscape map: all rooms and doors are keyboard targets; private positions remain role-specific',()=>{
 const draw=(killer:boolean)=>{const s=playing(killer);return renderToStaticMarkup(createElement(ManorMap,{game:s.game,start:'R1',path:['R2'],destination:'R2',activeRooms:['R2'],notes:[],edge:'R1-R2',disabled:false,onRoom(){},onDoor(){}}));};
 const team=draw(false),killer=draw(true);
 assert.equal((team.match(/class="tsc-floor-room /g)??[]).length,15);
 assert.equal((team.match(/class="tsc-floor-door/g)??[]).length,17);
 assert.equal((team.match(/tabindex="0"/g)??[]).length,32);
 assert.match(team,/tsc-floor-route/);assert.match(team,/메인 홀 ↔ 전시실 문/);assert.match(team,/지도 확대/);
 assert.match(team,/aria-label="ANNA"/);assert.doesNotMatch(killer,/aria-label="ANNA"/);
 assert.match(team,/<image[^>]+href="\/images\/terrorscape\/manor-floorplan.webp"[^>]+pointer-events="none"/);
 assert.doesNotMatch(team,/rooms.webp|tsc-map-lines|tsc-furniture/);
});


test('Terrorscape map: every visible killer has a distinct badge; hidden positions have no marker',()=>{
 for(const killerType of ['BUTCHER','SPECTRE','MURDERER'] as const){const s=playing();s.game.killerType=killerType;assert.match(render(s),/tsc-floor-token tsc-floor-killer/);assert.equal((render(s).match(/class="tsc-killer-tag"/g)??[]).length,1);assert.match(render(s),/class="tsc-killer-tag">살인자/);s.game.killerLocation=null;assert.doesNotMatch(render(s),/tsc-floor-killer|tsc-killer-tag/);}
});


test('Terrorscape feedback: visible moves, noise and doors are located; snapshots and hidden actions are silent',()=>{
 const before=playing().game,after=structuredClone(before);after.gameRevision=parse(TerrorscapePlayingPlatformSnapshotV2Schema,{...playing(),game:{...after,gameRevision:3}}).game.gameRevision;
 if(after.privateState.role!=='SURVIVOR')throw new Error('fixture');after.privateState.team.survivors[0]!.location='B1';after.noises=['R2'];after.blocks=['B1-B2'];
 const events=terrorFeedback(before,after);assert.deepEqual(events.find(e=>e.kind==='MOVE')?.rooms,['B1']);assert.deepEqual(events.find(e=>e.kind==='NOISE')?.rooms,['R2']);assert.equal(events.find(e=>e.kind==='BLOCK')?.edge,'B1-B2');
 assert.deepEqual(terrorFeedback(null,after),[]);assert.deepEqual(terrorFeedback(after,after),[]);assert.deepEqual(terrorFeedback(after,before),[]);
 const killer=playing(true).game;assert.deepEqual(terrorFeedback(killer,{...killer,gameRevision:after.gameRevision}),[]);
});
test('Terrorscape feedback: sensing never invents a precise location; hurt reveals no hidden room',()=>{
 const before=playing(true).game,after=structuredClone(before);after.gameRevision=parse(TerrorscapePlayingPlatformSnapshotV2Schema,{...playing(true),game:{...after,gameRevision:3}}).game.gameRevision;
 after.sensed=[{kind:'ZONE',character:'WILLIAM',zone:'B'}];after.conditions[1]!.injuries=1;
 const events=terrorFeedback(before,after);assert.deepEqual(events.find(e=>e.kind==='SENSE')?.rooms,['B1','B2','B3','B4','B5']);assert.deepEqual(events.find(e=>e.kind==='HURT')?.rooms,[]);
 after.sensed=[{kind:'PAIR',character:'WILLIAM',rooms:['B1','R1']}];assert.deepEqual(terrorFeedback(before,after).find(e=>e.kind==='SENSE')?.rooms,['B1','R1']);
 after.killerLocation=null;after.stealthOrigin='G5';assert.ok(!terrorFeedback(before,after).some(e=>e.kind==='MOVE'||e.kind==='REVEAL'));
 const appeared={...after,killerLocation:'B3' as const,gameRevision:parse(TerrorscapePlayingPlatformSnapshotV2Schema,{...playing(true),game:{...after,killerLocation:'B3',gameRevision:4}}).game.gameRevision};assert.deepEqual(terrorFeedback(after,appeared).find(e=>e.kind==='REVEAL')?.rooms,['B3']);
});

test('Feral Cabin UI: every door and outdoor connection matches the board and killer passage stays out of range',()=>{
 const board=terrorBoard('CABIN');assert.deepEqual(Object.keys(CABIN_ROOMS).sort(),[...TERROR_ROOMS].sort());assert.deepEqual(Object.keys(CABIN_DOORS).sort(),board.doors.map(([a,b])=>terrorEdge(a,b)).sort());assert.deepEqual(Object.keys(CABIN_OUTDOOR).sort(),board.paths.map(([a,b])=>terrorEdge(a,b)).sort());
 for(const [a,b] of board.doors)for(const r of [a,b]){const points=CABIN_ROOMS[r].polygon.split(' ').map(p=>p.split(',').map(Number)),at=CABIN_DOORS[terrorEdge(a,b)]!.at;assert.ok(points.some((p,i)=>{const q=points[(i+1)%points.length]!,dx=q[0]!-p[0]!,dy=q[1]!-p[1]!,t=Math.max(0,Math.min(1,((at[0]-p[0]!)*dx+(at[1]-p[1]!)*dy)/(dx*dx+dy*dy)));return Math.hypot(at[0]-p[0]!-t*dx,at[1]-p[1]!-t*dy)<.1;}),`${a}-${b} touches ${r}`);}
 assert.equal(terrorAdjacent('G2','R5','CABIN'),false);assert.equal(terrorAdjacent('G2','R5','CABIN',true),true);assert.ok(terrorDistance('G2','R5','CABIN')>2);
});
test('Feral UI: cabin artwork, expansion cast, private traps and silver defense render from viewer projections',()=>{
 const s=playing();s.game.map='CABIN';s.game.rulesVersion='terrorscape-feral-v2';s.game.killerType='HUNTRESS';s.game.huntingTrapRooms=['R3','G4','B2','B3'];const html=render(s);assert.match(html,/cabin-floorplan.webp/);assert.match(html,/오두막 평면도/);assert.match(html,/feral-atlas.webp/);assert.match(html,/\? 함정/);assert.doesNotMatch(html,/NET_A|NET_B|그물 1|곰덫/);assert.match(html,/호숫가에서 수리/);assert.equal((html.match(/class="tsc-floor-door/g)??[]).length,13);
 const setup=playing(true);setup.game.phase='SETUP';assert.match(render(setup),/Feral Instincts/);assert.match(render(setup),/늑대인간/);assert.match(render(setup),/사냥꾼/);
});
