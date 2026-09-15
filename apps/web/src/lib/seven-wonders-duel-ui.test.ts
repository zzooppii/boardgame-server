import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {safeParse,parse} from 'valibot';
import {DuelLobbyPlatformSnapshotV2Schema,DuelClientCommandSchema,DUEL_CARDS,DUEL_WONDERS,DUEL_GODS,GameIdSchema,GameRevisionSchema} from '@hangul-rummikub/shared';
import {Card,DetailArt,effectText} from '../features/seven-wonders-duel/art.js';
import {duelNewCue} from '../features/seven-wonders-duel/sound.js';
import {decodeWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
test('DUEL UI contracts: all expansion combinations route; actions accept only revision-scoped server option',()=>{
 for(const pantheon of [false,true])for(const agora of [false,true]){const snapshot=parse(DuelLobbyPlatformSnapshotV2Schema,{snapshotVersion:2,versions:{roomRevision:1,presenceVersion:1},serverTime:1000,self:{playerId:'alice'},room:{roomId:'duel',roomCode:'ABCDEF',gameType:'SEVEN_WONDERS_DUEL',phase:'LOBBY',settings:{pantheon,agora},players:[{playerId:'alice',nickname:'하비',isHost:true,connectionStatus:'CONNECTED'}]},game:null});const decoded=decodeWebSnapshot(snapshot);assert.equal(decoded.kind,'COMPATIBLE');if(decoded.kind==='COMPATIBLE')assert.equal(resolveRoomSnapshotView(decoded.value).kind,'SEVEN_WONDERS_DUEL');}
 const c={protocolVersion:1,requestId:'r',kind:'duel:act',gameId:'g',expectedGameRevision:1,turnId:'t',payload:{type:'SELECT',optionId:'option-1'}};assert.equal(safeParse(DuelClientCommandSchema,c).success,true);assert.equal(safeParse(DuelClientCommandSchema,{...c,payload:{...c.payload,coins:99}}).success,false);assert.equal(safeParse(DuelClientCommandSchema,{...c,payload:{...c.payload,optionId:'forged'}}).success,false);
});
test('DUEL artwork: all buildings, wonders and gods render without missing asset index; backs reveal no name',()=>{
 for(const d of DUEL_CARDS){const html=renderToStaticMarkup(createElement(Card,{id:d.id,onClick(){}}));assert.ok(html.includes(d.name));assert.ok(html.includes('buildings.png'));assert.ok(!html.includes('NaN'));assert.equal(typeof effectText(d),'string');}
 for(const d of [...DUEL_WONDERS,...DUEL_GODS]){const html=renderToStaticMarkup(createElement(DetailArt,{id:d.id}));assert.ok(html.includes(d.name));assert.ok(!html.includes('NaN'));}
 const hidden=renderToStaticMarkup(createElement(Card,{id:null,back:'SENATOR',onClick(){}}));assert.ok(hidden.includes('비공개 의원'));assert.equal(hidden.includes('wonders.png'),false);
});
test('DUEL event sounds ignore initial/reconnect/duplicate snapshots',()=>{
 // The cue selector consumes only these projection fields.
 const cue=(revision:number,continuous:boolean,previous:{gameId:string;revision:number}|null)=>duelNewCue(previous,{gameId:parse(GameIdSchema,'g'),gameRevision:parse(GameRevisionSchema,revision),phase:'PLAYING',history:[]},continuous);
 assert.equal(cue(0,true,null),null);assert.equal(cue(1,false,{gameId:'g',revision:0}),null);assert.equal(cue(1,true,{gameId:'g',revision:1}),null);assert.equal(cue(1,true,{gameId:'old',revision:0}),null);
});
