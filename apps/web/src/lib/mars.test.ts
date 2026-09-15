import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {readFileSync} from 'node:fs';
import {MarsPlayingProjectionSchema, MARS_CARDS, marsCardDescription, marsResources} from '@hangul-rummikub/shared';
import {marsFeedback} from '../features/mars/sound.js';
import {GAME_CATALOG} from '../features/game-catalog/game-catalog.js';
import {WEB_SUPPORTED_GAME_TYPES} from './snapshot-wire-decoder.js';
function game(revision=1){return v.parse(MarsPlayingProjectionSchema,{gameType:'TERRAFORMING_MARS',gameId:'mars-feedback',gameRevision:revision,rulesVersion:'mars-base-v1',generation:1,stage:'ACTION',activePlayerId:'mars-a',startingPlayerId:'mars-a',actionsTaken:0,oxygen:0,temperature:-30,oceans:0,tiles:[],milestones:[],awards:[],history:[],deckCount:137,discardCount:0,phase:'PLAYING',turnId:'mars-turn',playerStates:['mars-a','mars-b'].map(playerId=>({playerId,corporationId:'Beginner',resources:marsResources({money:42}),production:marsResources(),tr:20,handCount:0,played:[],passed:false,ready:true,generationStartTr:20,corporationUsedGeneration:0})),privateState:{playerId:'mars-a',hand:[],research:[],corporations:[],offers:[],payment:null,cardStatus:[]}});}
test('Mars sound and resource feedback ignore initial, duplicated, missed and reconnected snapshots',()=>{const old=game(),next=game(2);next.oceans=1;next.playerStates[0]!.resources.money-=18;assert.deepEqual(marsFeedback(old,next,true),{cue:'WATER',deltas:{money:-18}});for(const [previous,current,continuous] of [[null,next,true],[next,next,true],[old,game(4),true],[old,next,false]]as const)assert.deepEqual(marsFeedback(previous,current,continuous),{cue:null,deltas:{}});next.gameId=old.gameId;next.temperature=-28;next.oceans=0;assert.equal(marsFeedback(old,next,true).cue,'HEAT');next.generation=2;assert.equal(marsFeedback(old,next,true).cue,'PRODUCTION');});
test('Mars catalog, browser capability, original art and all card descriptions are available',()=>{assert.ok(GAME_CATALOG.some(g=>g.gameType==='TERRAFORMING_MARS'));assert.ok(WEB_SUPPORTED_GAME_TYPES.includes('TERRAFORMING_MARS'));for(const file of ['terrain.webp','cards-atlas.webp'])assert.equal(readFileSync(new URL('../../public/images/mars/'+file,import.meta.url)).subarray(8,12).toString(),'WEBP');for(const c of MARS_CARDS){assert.ok(marsCardDescription(c).length>0,c.id);assert.doesNotMatch(marsCardDescription(c),/undefined|NaN/);}});

import {filterMarsHand,DEFAULT_MARS_HAND_OPTIONS} from '../features/mars/hand.js';
import {TileIdSchema,type MarsCard} from '@hangul-rummikub/shared';
import {HandTools} from '../features/mars/HandTools.js';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('Mars hand search supports Korean, English, effects and combined tag/type filters without mutating order',()=>{
 const hand: MarsCard[]=['Asteroid','PowerPlant','Shuttles'].map((definitionId,i)=>({tileId:v.parse(TileIdSchema,'filter-'+i),definitionId,resources:0,usedGeneration:0}));
 const before=structuredClone(hand),status=hand.map((c,i)=>({tileId:c.tileId,cost:[11,1,7][i]!,reason:i===2?'기온 조건':null}));
 const ids=(options:Partial<typeof DEFAULT_MARS_HAND_OPTIONS>)=>filterMarsHand(hand,status,{...DEFAULT_MARS_HAND_OPTIONS,...options}).map(c=>c.definitionId);
 assert.deepEqual(ids({query:'  ASTEROID  '}),['Asteroid']);assert.deepEqual(ids({query:'생산',tag:'power'}),['PowerPlant']);assert.deepEqual(ids({tag:'space',kind:'event'}),['Asteroid']);assert.deepEqual(ids({eligibleOnly:true,sort:'cost'}),['PowerPlant','Asteroid']);assert.deepEqual(ids({query:'없는 카드'}),[]);assert.deepEqual(hand,before);
 assert.deepEqual(filterMarsHand(hand,[],{...DEFAULT_MARS_HAND_OPTIONS,eligibleOnly:true}),[],'Missing status is not an eligibility approval');
});
test('Mars hand controls expose labeled search, filters, sort, reset and result count',()=>{
 const html=renderToStaticMarkup(createElement(HandTools,{options:DEFAULT_MARS_HAND_OPTIONS,onChange(){},count:3,total:10}));assert.match(html,/type="search"/);assert.match(html,/aria-label="손패 정렬"/);assert.match(html,/조건·비용 충족/);assert.match(html,/필터 초기화/);assert.match(html,/role="status"/);assert.match(html,/3 \/ 10장/);
});

import {marsEngineSummary} from '../features/mars/EngineSummary.js';
test('Mars engine summary includes duplicate corporation tags, excludes event tags and counts unused actions',()=>{
 const p=game().playerStates[0]!;p.corporationId='MiningGuild';p.played=['Asteroid','Ironworks','ResearchOutpost','Shuttles'].map((definitionId,i)=>({tileId:v.parse(TileIdSchema,'engine-'+i),definitionId,resources:0,usedGeneration:definitionId==='Ironworks'?1:0}));
 const current=marsEngineSummary(p,1);assert.equal(current.tags.find(t=>t.tag==='building')!.count,4);assert.equal(current.tags.find(t=>t.tag==='space')!.count,1);assert.equal(current.actions,1);assert.equal(current.unused,0);assert.equal(current.passives.length,2);assert.equal(marsEngineSummary(p,2).unused,1);
});

import {marsResourceReceipt,ResourceReceipt,ActionGuide} from '../features/mars/ActionFeedback.js';
test('Mars resource receipt includes actual stock, production and TR changes, including another player effect',()=>{
 const before=game(),after=game(2);after.activePlayerId=after.playerStates[1]!.playerId;
 after.playerStates[0]!.resources.money=24;after.playerStates[0]!.production.money=-1;after.playerStates[0]!.tr=21;
 const receipt=marsResourceReceipt(before,after,true);
 assert.deepEqual(receipt,{generation:1,changes:[{label:'M€',before:42,after:24},{label:'M€ 생산',before:0,after:-1},{label:'TR',before:20,after:21}]});
 assert.equal(marsResourceReceipt(after,after,true),undefined,'Duplicate snapshot preserves receipt.');
 assert.equal(marsResourceReceipt(before,game(2),true),undefined,'No resource change preserves receipt.');
 const html=renderToStaticMarkup(createElement(ResourceReceipt,{receipt:receipt??null}));
 assert.match(html,/42 → <strong>24<\/strong>/);assert.match(html,/\(-18\)/);assert.match(html,/\(\+1\)/);assert.match(html,/aria-live="polite"/);
});
test('Mars resource receipt does not fabricate a receipt on first load, reconnect, skipped revision or changed identity',()=>{
 const before=game(),after=game(2);after.playerStates[0]!.resources.money=10;
 assert.equal(marsResourceReceipt(null,after,true),null);assert.equal(marsResourceReceipt(before,after,false),null);
 assert.equal(marsResourceReceipt(before,game(4),true),null);
 const other=game(2);other.privateState.playerId=other.playerStates[1]!.playerId;assert.equal(marsResourceReceipt(before,other,true),null);
 assert.equal(renderToStaticMarkup(createElement(ResourceReceipt,{receipt:null})).includes('마지막 내 자원 변화'),false);
});
test('Mars action guide distinguishes payment cancellation, committed action payment, placement and effect resolution',()=>{
 const g=game(),html=()=>renderToStaticMarkup(createElement(ActionGuide,{game:g}));
 assert.equal(html(),'');
 g.privateState.payment={label:'지하수 추출',cost:18,steel:false,titanium:false,heat:false,titaniumValue:3,cardId:null,cancelable:true};
 assert.match(html(),/아직 지불하지 않았습니다/);g.privateState.payment.cancelable=false;assert.match(html(),/행동의 다음 효과/);assert.doesNotMatch(html(),/취소/);
 g.privateState.payment=null;g.privateState.offers=[{id:'place',kind:'PLACE',targetId:'1-1',label:'해양',detail:'배치',cost:0}];assert.match(html(),/배치할 위치/);
 g.privateState.offers[0]!.kind='EFFECT';assert.match(html(),/남은 효과/);
 g.activePlayerId=g.playerStates[1]!.playerId;assert.equal(html(),'');
});
