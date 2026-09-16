import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parse,safeParse} from 'valibot';
import {GreatKingdomLobbyPlatformSnapshotV2Schema,GreatKingdomPlayingPlatformSnapshotV2Schema,GreatKingdomFinishedPlatformSnapshotV2Schema,GreatKingdomClientCommandSchema,GameRevisionSchema,TurnIdSchema,greatKingdomCoordinate} from '@hangul-rummikub/shared';
import {GreatKingdomScreen} from '../features/great-kingdom/GreatKingdomScreen.js';
import {greatKingdomScope,greatKingdomSelection} from '../features/great-kingdom/ui.js';
import {kingdomNewCue} from '../features/great-kingdom/sound.js';
import {decodeWebSnapshot,type GreatKingdomWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
import {getGameStartControl} from './game-start.js';
const players=[{playerId:'a',nickname:'하비',isHost:true,connectionStatus:'CONNECTED'},{playerId:'b',nickname:'친구',isHost:false,connectionStatus:'CONNECTED'}];
function lobby(n=2){return parse(GreatKingdomLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:'a'},room:{roomId:'room-gk',roomCode:'BCDFGH',gameType:'GREAT_KINGDOM',phase:'LOBBY',players:players.slice(0,n)},game:null});}
function playing(){const l=lobby();return parse(GreatKingdomPlayingPlatformSnapshotV2Schema,{...l,room:{...l.room,phase:'PLAYING'},game:{gameType:'GREAT_KINGDOM',gameId:'gk-game',gameRevision:0,rulesVersion:'great-kingdom-base-v2',phase:'PLAYING',turnId:'t1',activePlayerId:'a',board:Array.from({length:81},(_,i)=>i===40?{tileId:'neutral',color:'NEUTRAL'}:null),territoryOwners:Array(81).fill(null),playerStates:players.map((p,i)=>({playerId:p.playerId,color:i===0?'BLUE':'ORANGE',remaining:40,territory:0})),history:[],consecutivePasses:0,legalPositions:Array.from({length:81},(_,i)=>i).filter(i=>i!==40)}});}
const render=(snapshot:GreatKingdomWebSnapshot,connected=true)=>renderToStaticMarkup(createElement(GreatKingdomScreen,{snapshot,connected,pending:false,error:null,connectionLabel:connected?'접속 중':'재접속 중',onCommand:async()=>{},onRematch:()=>{},onStart:()=>{},onLeave:()=>{},onCopy:()=>{}}));
test('GREAT_KINGDOM UI routes lobby/board/result, exposes 81 labeled cells and sound controls',()=>{
 const l=lobby(),p=playing();const {turnId:_t,activePlayerId:_a,legalPositions:_l,...base}=p.game;
 const f=parse(GreatKingdomFinishedPlatformSnapshotV2Schema,{...p,room:{...p.room,phase:'FINISHED'},game:{...base,phase:'FINISHED',gameRevision:1,result:{reason:'CANCELLED',winnerPlayerIds:[],destroyedPositions:[]}}});
 for(const s of [l,p,f]){const d=decodeWebSnapshot(s);assert.equal(d.kind,'COMPATIBLE');if(d.kind!=='COMPATIBLE')throw new Error();assert.equal(resolveRoomSnapshotView(d.value).kind,'GREAT_KINGDOM');assert.match(render(s),/그레이트 킹덤/);}
 assert.equal(getGameStartControl(lobby(1),false).canStart,false);assert.equal(getGameStartControl(l,false).canStart,true);
 const html=render(p);assert.equal((html.match(/data-position=/g)??[]).length,81);assert.match(html,/E5 · 중립 성/);assert.match(html,/효과음 음량/);assert.match(html,/성을 선택하세요/);assert.match(render(f),/대국이 취소되었습니다/);
 assert.equal((render(p,false).match(/class="gk-cell[^>]*disabled=""/g)??[]).length,81);
});
test('GREAT_KINGDOM drafts are actor/legal-position/scoped and coordinates match board',()=>{
 const g=playing().game;assert.equal(greatKingdomSelection(g,'a',0),0);assert.equal(greatKingdomSelection(g,'a',40),null);assert.equal(greatKingdomSelection(g,'b',0),null);
 assert.notEqual(greatKingdomScope(g),greatKingdomScope({...g,turnId:parse(TurnIdSchema,'new-turn')}));
 assert.equal(greatKingdomCoordinate(0),'A9');assert.equal(greatKingdomCoordinate(40),'E5');assert.equal(greatKingdomCoordinate(80),'I1');
});
test('GREAT_KINGDOM sound only follows new continuous revisions, never hydration or reconnect replay',()=>{
 const g=playing().game,previous={gameId:g.gameId,revision:0,territory:0},next={...g,gameRevision:parse(GameRevisionSchema,1)};
 assert.equal(kingdomNewCue(null,g,true,g.activePlayerId),null);assert.equal(kingdomNewCue(previous,g,true,g.activePlayerId),null);
 assert.equal(kingdomNewCue(previous,next,false,g.activePlayerId),null);assert.equal(kingdomNewCue({...previous,gameId:'old'},next,true,g.activePlayerId),null);
 assert.equal(kingdomNewCue(previous,next,true,g.activePlayerId),'PLACE');
 assert.equal(kingdomNewCue(previous,{...next,playerStates:next.playerStates.map(p=>({...p,territory:1}))},true,g.activePlayerId),'TERRITORY');
 assert.equal(kingdomNewCue(previous,{...next,history:[{move:1,playerId:g.activePlayerId,color:'BLUE',kind:'PASS',position:null}]},true,g.activePlayerId),'PASS');
 assert.equal(kingdomNewCue(previous,{...next,gameRevision:parse(GameRevisionSchema,2)},true,g.activePlayerId),null);
});
test('GREAT_KINGDOM wire rejects impersonation, invalid positions and corrupt projections',()=>{
 const c={kind:'greatKingdom:act',protocolVersion:1,requestId:'request',gameId:'game',expectedGameRevision:0,turnId:'turn',payload:{kind:'PLACE',position:0}};
 assert.equal(safeParse(GreatKingdomClientCommandSchema,c).success,true);
 for(const bad of [{...c,turnId:undefined},{...c,payload:{kind:'PLACE',position:81}},{...c,payload:{kind:'PLACE',position:0,playerId:'b'}},{...c,payload:{kind:'PASS',position:0}}])assert.equal(safeParse(GreatKingdomClientCommandSchema,bad).success,false);
 const s=playing();for(const game of [{...s.game,board:Array(81).fill(null)},{...s.game,activePlayerId:'b'},{...s.game,playerStates:s.game.playerStates.map(p=>({...p,remaining:39}))},{...s.game,legalPositions:[40]}])assert.equal(safeParse(GreatKingdomPlayingPlatformSnapshotV2Schema,{...s,game}).success,false);
});

test('GREAT_KINGDOM tied territory renders a draw and plays neither victory nor defeat',()=>{
 const s=playing(),{turnId:_t,activePlayerId:_a,legalPositions:_l,...base}=s.game;
 const draw=parse(GreatKingdomFinishedPlatformSnapshotV2Schema,{...s,room:{...s.room,phase:'FINISHED'},game:{...base,phase:'FINISHED',gameRevision:2,consecutivePasses:2,history:[{move:1,playerId:'a',color:'BLUE',kind:'PASS',position:null},{move:2,playerId:'b',color:'ORANGE',kind:'PASS',position:null}],result:{reason:'TERRITORY',winnerPlayerIds:[],destroyedPositions:[]}}});
 const html=render(draw);assert.match(html,/>무승부</);assert.doesNotMatch(html,/선공 보정|3칸|플레이어 승리/);
 assert.equal(kingdomNewCue({gameId:draw.game.gameId,revision:1,territory:0},draw.game,true,s.self.playerId),'DRAW');
 assert.equal(safeParse(GreatKingdomFinishedPlatformSnapshotV2Schema,{...draw,game:{...draw.game,result:{...draw.game.result,winnerPlayerIds:['b']}}}).success,false);
 assert.equal(safeParse(GreatKingdomPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,rulesVersion:'great-kingdom-base-v1',firstPlayerMargin:3}}).success,false);
});
