import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse,safeParse} from 'valibot';
import {PatchworkPlayingPlatformSnapshotV2Schema,PatchworkLobbyPlatformSnapshotV2Schema,PatchworkClientCommandSchema,PATCHWORK_PATCHES,PATCHWORK_LEATHER} from '@hangul-rummikub/shared';
import {PatchworkScreen} from '../features/patchwork/PatchworkScreen.js';
import {PatchArt,patchworkSpiral} from '../features/patchwork/art.js';
import {patchworkNewCue} from '../features/patchwork/sound.js';
import {decodeWebSnapshot,type PatchworkWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
const players=[{playerId:'a',nickname:'하비',isHost:true,connectionStatus:'CONNECTED'},{playerId:'b',nickname:'민서',isHost:false,connectionStatus:'CONNECTED'}];
function lobby(){return parse(PatchworkLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:'a'},room:{roomId:'pw',roomCode:'ABCDEF',gameType:'PATCHWORK',phase:'LOBBY',players},game:null});}
function playing(){const l=lobby();return parse(PatchworkPlayingPlatformSnapshotV2Schema,{...l,room:{...l.room,phase:'PLAYING'},game:{gameType:'PATCHWORK',gameId:'g',gameRevision:0,rulesVersion:'patchwork-base-v1',phase:'PLAYING',turnId:'t',playerStates:players.map(p=>({playerId:p.playerId,placements:[],buttons:5,income:0,position:0})),activePlayerId:'a',market:PATCHWORK_PATCHES.filter(p=>p.id>0).map(p=>({tileId:`tile-${p.id}`,patchId:p.id})),leather:PATCHWORK_LEATHER.map(position=>({tileId:`leather-${position}`,patchId:0,position})),pendingLeather:[],discardedLeather:[],bonusOwner:null,finishOrder:[],history:[],privateState:{playerId:'a'}}});}
const render=(snapshot:PatchworkWebSnapshot,connected=true)=>renderToStaticMarkup(createElement(PatchworkScreen,{snapshot,connected,pending:false,error:null,connectionLabel:'서버 연결됨',onCommand:async()=>{},onRematch(){},onStart(){},onLeave(){},onCopy(){}}));
test('PATCHWORK UI: lobby/game routing, original art, 81 keyboard cells, actions, separate prices/time/income and sound',()=>{
 for(const s of [lobby(),playing()]){const d=decodeWebSnapshot(s);assert.equal(d.kind,'COMPATIBLE');if(d.kind==='COMPATIBLE')assert.equal(resolveRoomSnapshotView(d.value).kind,'PATCHWORK');assert.match(render(s),/패치워크 효과음 음량/);}
 assert.match(render(lobby()),/images\/patchwork\/cover.svg/);const html=render(playing());assert.equal((html.match(/행 \d열/g)??[]).length,81);for(const label of ['구매·배치 확정','앞으로 이동','회전','뒤집기','선택 취소','시간판','전체 천 조각'])assert.ok(html.includes(label));assert.match(render(playing(),false),/연결을 복구/);
 const points=patchworkSpiral();assert.equal(points.length,54);assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,54);for(let i=1;i<points.length;i++)assert.equal(Math.abs(points[i]!.x-points[i-1]!.x)+Math.abs(points[i]!.y-points[i-1]!.y),1);
 const css=readFileSync('src/features/patchwork/patchwork.css','utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.pw-action-dock\{position:relative/);assert.match(css,/\.pw-my-area\{order:3\}\.pw-action-dock\{order:4\}/);
 for(const p of PATCHWORK_PATCHES)assert.match(renderToStaticMarkup(createElement(PatchArt,{patchId:p.id})),/<pattern/);
});
test('PATCHWORK wire rejects forged totals, duplicate tiles, mismatched viewer and illegal coordinates',()=>{
 const s=playing();for(const game of [{...s.game,score:999},{...s.game,privateState:{playerId:'b'}},{...s.game,market:s.game.market.map(()=>s.game.market[0])},{...s.game,leather:[]}])assert.equal(safeParse(PatchworkPlayingPlatformSnapshotV2Schema,{...s,game}).success,false);
 const c={protocolVersion:1,kind:'patchwork:act',requestId:'r',gameId:'g',expectedGameRevision:0,turnId:'t',payload:{type:'BUY',tileId:'tile-1',x:0,y:0,rotation:0,flipped:false}};assert.equal(safeParse(PatchworkClientCommandSchema,c).success,true);assert.equal(safeParse(PatchworkClientCommandSchema,{...c,payload:{...c.payload,x:9}}).success,false);assert.equal(safeParse(PatchworkClientCommandSchema,{...c,payload:{...c.payload,buttons:999}}).success,false);
});
test('PATCHWORK sounds suppress initial/sync/reconnect/replayed snapshots; new income and bonus have distinct cues',()=>{
 const g=playing().game;assert.equal(patchworkNewCue(null,g,true),null);assert.equal(patchworkNewCue({gameId:'g',revision:0},g,true),null);
 const next=parse(PatchworkPlayingPlatformSnapshotV2Schema,{...playing(),game:{...g,gameRevision:1,history:[{id:1,playerId:'a',kind:'ADVANCE',patchId:0,distance:1,income:3,bonus:false}]}}).game;
 assert.equal(patchworkNewCue({gameId:'g',revision:0},next,false),null);assert.equal(patchworkNewCue({gameId:'old',revision:0},next,true),null);assert.equal(patchworkNewCue({gameId:'g',revision:2},next,true),null);assert.equal(patchworkNewCue({gameId:'g',revision:0},next,true),'INCOME');next.history[0]!.bonus=true;assert.equal(patchworkNewCue({gameId:'g',revision:0},next,true),'BONUS');
});

test('PATCHWORK timer UI: host settings, guest read-only options, server-based countdown and expired actions',()=>{
 const l=lobby();assert.equal(l.room.settings.turnDurationSeconds,60);assert.match(render(l),/한 차례 제한 시간/);assert.match(render(l),/aria-pressed="true">1분/);
 const guest=parse(PatchworkLobbyPlatformSnapshotV2Schema,{...l,self:{playerId:players[1]!.playerId}});assert.match(render(guest),/<fieldset[^>]+disabled/);
 const s=playing();s.game.deadlineAt=parse(PatchworkPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,deadlineAt:31000}}).game.deadlineAt;s.game.settings.turnDurationSeconds=30;s.room.settings.turnDurationSeconds=30;
 assert.match(render(s),/남은 시간 30초/);
 s.serverTime=parse(PatchworkPlayingPlatformSnapshotV2Schema,{...s,serverTime:31000}).serverTime;const expired=render(s);assert.match(expired,/서버 처리 중/);assert.doesNotMatch(expired,/aria-label="퀼트 배치 위치"/);
 const c={protocolVersion:1,requestId:'config',kind:'patchwork:configure',expectedRoomRevision:1,payload:{turnDurationSeconds:30}};
 assert.equal(safeParse(PatchworkClientCommandSchema,c).success,true);
 for(const seconds of [0,45,90,'30'])assert.equal(safeParse(PatchworkClientCommandSchema,{...c,payload:{turnDurationSeconds:seconds}}).success,false);
});
