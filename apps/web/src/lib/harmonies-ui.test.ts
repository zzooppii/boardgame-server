import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse,safeParse} from 'valibot';
import {HarmoniesPlayingPlatformSnapshotV2Schema,HarmoniesLobbyPlatformSnapshotV2Schema,HarmoniesClientCommandSchema,harmoniesReplay,type HarmoniesStep} from '@hangul-rummikub/shared';
import {HarmoniesScreen} from '../features/harmonies/HarmoniesScreen.js';
import {harmoniesNewCue} from '../features/harmonies/sound.js';
import {decodeWebSnapshot,type HarmoniesWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
const players=[{playerId:'a',nickname:'하비',isHost:true,connectionStatus:'CONNECTED'},{playerId:'b',nickname:'민서',isHost:false,connectionStatus:'CONNECTED'}];
function lobby(){return parse(HarmoniesLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:'a'},room:{roomId:'hm',roomCode:'ABCDEF',gameType:'HARMONIES',phase:'LOBBY',players},game:null});}
function playing(){const l=lobby();const {settings: _settings,...room}=l.room;return parse(HarmoniesPlayingPlatformSnapshotV2Schema,{...l,room:{...room,phase:'PLAYING'},game:{gameType:'HARMONIES',gameId:'g',gameRevision:0,rulesVersion:'harmonies-base-a-v1',settings:{turnSeconds:60},deadlineAt:61000,phase:'PLAYING',turnId:'t',playerStates:players.map(p=>({playerId:p.playerId,board:Array.from({length:23},()=>({stack:[],animal:null})),cards:[],turns:0})),activePlayerId:'a',round:1,markets:Array.from({length:5},(_,i)=>['WATER','STONE','LEAF'].map((color,j)=>({tileId:`t${i}-${j}`,color}))),animalMarket:[1,2,3,4,5],bagCount:105,deckCount:27,lastRound:false,history:[],privateState:{playerId:'a'}}});}
const render=(snapshot:HarmoniesWebSnapshot,connected=true)=>renderToStaticMarkup(createElement(HarmoniesScreen,{snapshot,connected,pending:false,error:null,connectionLabel:'서버 연결됨',onCommand:async()=>{},onRematch(){},onStart(){},onLeave(){},onCopy(){}}));
test('HARMONIES UI: registered lobby and game, original artwork, accessible board, card patterns, undo and audio',()=>{
 for(const s of [lobby(),playing()]){const d=decodeWebSnapshot(s);assert.equal(d.kind,'COMPATIBLE');if(d.kind==='COMPATIBLE')assert.equal(resolveRoomSnapshotView(d.value).kind,'HARMONIES');assert.match(render(s),/하모니즈 효과음 음량/);}
 const lobbyHtml=render(lobby());assert.match(lobbyHtml,/한 차례 시간/);assert.match(lobbyHtml,/30초/);assert.match(lobbyHtml,/1분/);assert.match(render(playing()),/남은 턴 시간 60초/);
 const html=render(playing());assert.equal((html.match(/class="hm-hex /g)??[]).length,23);assert.match(html,/토큰 묶음/);assert.match(html,/서식지 보기/);assert.match(html,/한 수 되돌리기/);assert.match(html,/턴 확정/);assert.match(html,/aria-pressed/);assert.match(html,/배치한 동물에 따른 점수/);assert.match(render(playing(),false),/연결을 복구/);
 const css=readFileSync('src/features/harmonies/harmonies.css','utf8');assert.match(css,/images\/harmonies\/animals.webp/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/position:sticky/);
});
test('HARMONIES wire: rejects hidden deck/bag, forged total, duplicate tokens and wrong viewer',()=>{
 const s=playing();for(const g of [{...s.game,bag:[]},{...s.game,deck:[]},{...s.game,score:999},{...s.game,privateState:{playerId:'b'}},{...s.game,bagCount:104},{...s.game,markets:s.game.markets.map(()=>s.game.markets[0])}])assert.equal(safeParse(HarmoniesPlayingPlatformSnapshotV2Schema,{...s,game:g}).success,false);
 const tokens=s.game.markets[0]!,steps:HarmoniesStep[]=[{type:'TAKE_TOKENS',source:0},...tokens.map((t,i)=>({type:'PLACE' as const,tileId:t.tileId,cell:i}))],c={protocolVersion:1,kind:'harmonies:act',requestId:'r',gameId:'g',expectedGameRevision:0,turnId:'t',payload:{type:'SUBMIT_TURN',steps}};
 assert.equal(safeParse(HarmoniesClientCommandSchema,c).success,true);assert.equal(safeParse(HarmoniesClientCommandSchema,{...c,payload:{...c.payload,board:[]}}).success,false);assert.equal(safeParse(HarmoniesClientCommandSchema,{...c,payload:{...c.payload,steps:[...steps,{type:'PLACE',tileId:'x',cell:23}]}}).success,false);
 const preview=harmoniesReplay(s.game.playerStates[0]!,s.game.markets,s.game.animalMarket,steps);assert.ok(preview.ok);assert.equal(preview.draft.ready,true);const undo=harmoniesReplay(s.game.playerStates[0]!,s.game.markets,s.game.animalMarket,steps.slice(0,-1));assert.ok(undo.ok);assert.equal(undo.draft.pool.length,1);assert.equal(undo.draft.ready,false);assert.equal(s.game.playerStates[0]!.board[0]!.stack.length,0);
});
test('HARMONIES sounds: first view, reconnect, duplicate, old revision are silent; new committed state emits one cue',()=>{
 const g=playing().game;assert.equal(harmoniesNewCue(null,g,true),null);assert.equal(harmoniesNewCue({gameId:'g',revision:0},g,true),null);g.gameRevision=parse(HarmoniesPlayingPlatformSnapshotV2Schema,{...playing(),game:{...g,gameRevision:1}}).game.gameRevision;
 assert.equal(harmoniesNewCue({gameId:'g',revision:0},g,false),null);assert.equal(harmoniesNewCue({gameId:'old',revision:0},g,true),null);assert.equal(harmoniesNewCue({gameId:'g',revision:2},g,true),null);assert.equal(harmoniesNewCue({gameId:'g',revision:0},g,true),null);g.history=[{id:1,playerId:g.activePlayerId,text:'토큰 3개 배치',animals:0,cells:[0,1,2]}];assert.equal(harmoniesNewCue({gameId:'g',revision:0},g,true),'COMMIT');
});
