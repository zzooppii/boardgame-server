import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {readFileSync} from 'node:fs';
import {MarsPlayingProjectionSchema, MARS_CARDS, marsCardDescription, marsResources} from '@hangul-rummikub/shared';
import {marsFeedback} from '../features/mars/sound.js';
import {GAME_CATALOG} from '../features/game-catalog/game-catalog.js';
import {WEB_SUPPORTED_GAME_TYPES} from './snapshot-wire-decoder.js';
function game(revision=1){return v.parse(MarsPlayingProjectionSchema,{gameType:'TERRAFORMING_MARS',gameId:'mars-feedback',gameRevision:revision,rulesVersion:'mars-base-v1',generation:1,stage:'ACTION',activePlayerId:'mars-a',startingPlayerId:'mars-a',actionsTaken:0,oxygen:0,temperature:-30,oceans:0,tiles:[],landClaims:[],milestones:[],awards:[],history:[],deckCount:137,discardCount:0,phase:'PLAYING',turnId:'mars-turn',playerStates:['mars-a','mars-b'].map(playerId=>({playerId,protectedHabitats:false,corporationId:'Beginner',resources:marsResources({money:42}),production:marsResources(),tr:20,handCount:0,played:[],passed:false,ready:true,generationStartTr:20,corporationUsedGeneration:0})),privateState:{playerId:'mars-a',nextCardDiscount:0,hand:[],research:[],corporations:[],offers:[],payment:null,cardChoice:null,cardStatus:[]}});}
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
 g.privateState.payment={label:'지하수 추출',cost:18,steel:false,titanium:false,heat:false,steelValue:2,titaniumValue:3,cardId:null,cancelable:true};
 assert.match(html(),/아직 지불하지 않았습니다/);g.privateState.payment.cancelable=false;assert.match(html(),/행동의 다음 효과/);assert.doesNotMatch(html(),/취소/);
 g.privateState.payment=null;g.privateState.offers=[{id:'place',kind:'PLACE',targetId:'1-1',label:'해양',detail:'배치',cost:0}];assert.match(html(),/배치할 위치/);
 g.privateState.offers[0]!.kind='EFFECT';assert.match(html(),/남은 효과/);
 g.activePlayerId=g.playerStates[1]!.playerId;assert.equal(html(),'');
});

import {MarsCommandRejected,marsRejectionMessage} from './mars-command-error.js';
import {CommandNotice} from '../features/mars/CommandNotice.js';
test('Mars setup/research revision conflicts explain manual retry without disguising other rejections',()=>{
 const stale=new MarsCommandRejected('기존 상태 오류','STALE_GAME_REVISION');
 assert.match(marsRejectionMessage(stale,{type:'RESEARCH',cardIds:[]}),/내 선택은 유지/);
 assert.match(marsRejectionMessage(stale,{type:'SETUP',corporationId:'Beginner',cardIds:[]}),/다시 확정/);
 assert.equal(marsRejectionMessage(stale,{type:'TAKE',actionId:'pass'}),'기존 상태 오류');
 assert.equal(marsRejectionMessage(new MarsCommandRejected('구매 불가','RULE_VIOLATION'),{type:'RESEARCH',cardIds:[]}),'구매 불가');
});
test('Mars command notice distinguishes rejected choices from uncertain requests and disables offline retry',()=>{
 const props={error:'다시 확인해주세요',uncertain:false,busy:false,connected:true,onRetry(){}};
 assert.doesNotMatch(renderToStaticMarkup(createElement(CommandNotice,props)),/<button/);
 const uncertain=renderToStaticMarkup(createElement(CommandNotice,{...props,uncertain:true,connected:false}));
 assert.match(uncertain,/role="alert"/);assert.match(uncertain,/disabled=""/);assert.match(uncertain,/같은 요청/);
 assert.equal(renderToStaticMarkup(createElement(CommandNotice,{...props,error:null})), '');
});

import {MarsPaymentPanel} from '../features/mars/Payment.js';
test('Mars payment panel renders server metal values instead of assuming two credits per steel',()=>{
 const g=game();g.privateState.payment={label:'금속 가치 검증',cost:11,steel:true,titanium:true,heat:false,steelValue:3,titaniumValue:5,cardId:null,cancelable:true};
 const html=renderToStaticMarkup(createElement(MarsPaymentPanel,{game:g,busy:false,onPay:()=>{}}));
 assert.match(html,/강철 <small>×3/);assert.match(html,/티타늄 <small>×5/);assert.doesNotMatch(html,/×2/);
 assert.match(html,/지불 가치 <b>11 M€/);assert.match(html,/지불 후/);
 const pending=renderToStaticMarkup(createElement(MarsPaymentPanel,{game:g,busy:true,onPay:()=>{}}));
 assert.match(pending,/disabled=""/);
});

import {CardChoicePanel} from '../features/mars/CardChoicePanel.js';
import {MarsCardChoiceSchema} from '@hangul-rummikub/shared';
test('Mars private card panel displays illustrated candidates and explicit purchase or discard instructions',()=>{
 const cards=MARS_CARDS.slice(0,4).map((c,i)=>({tileId:v.parse(TileIdSchema,'peek-'+i),definitionId:c.id,resources:0,usedGeneration:0}));
 const choice=v.parse(MarsCardChoiceSchema,{id:1,label:'비공개 연구',kind:'KEEP',cards,keepCount:2});
 const html=renderToStaticMarkup(createElement(CardChoicePanel,{choice,money:0,heat:0,disabled:false,onConfirm:()=>{},onSelect:()=>{}}));
 assert.match(html,/4장 중 2장을 무료로/);assert.match(html,/나에게만 보입니다/);assert.match(html,/0 \/ 2장 선택/);assert.match(html,/2장 선택 확정/);assert.match(html,/disabled=""/);assert.equal((html.match(/class="tm-art /g)||[]).length,4);
 const buy=v.parse(MarsCardChoiceSchema,{id:2,label:'비공개 구매',kind:'BUY',cards:cards.slice(0,1),cost:3,canUseHeat:true});
 const buyHtml=renderToStaticMarkup(createElement(CardChoicePanel,{choice:buy,money:0,heat:3,disabled:false,onConfirm:()=>{},onSelect:()=>{}}));
 assert.match(buyHtml,/구매하지 않고 버리기/);assert.match(buyHtml,/실행 비용은 나중에 별도로/);assert.doesNotMatch(buyHtml,/disabled=""/);
});

test('Mars card acquisition sound plays only for a confirmed continuous private choice',()=>{
 const before=game(),after=game(2),card={tileId:v.parse(TileIdSchema,'peek-sound'),definitionId:MARS_CARDS[0]!.id,resources:0,usedGeneration:0};
 before.privateState.cardChoice=v.parse(MarsCardChoiceSchema,{id:1,label:'열람',kind:'KEEP',cards:[card],keepCount:1});
 after.privateState.hand=[card];after.playerStates[0]!.handCount=1;
 assert.equal(marsFeedback(before,after,true).cue,'CARD');assert.equal(marsFeedback(before,after,false).cue,null);
 assert.equal(marsFeedback(after,after,true).cue,null);const discarded=game(2);assert.equal(marsFeedback(before,discarded,true).cue,null);
});


import { NextCardDiscount } from '../features/mars/NextCardDiscount.js';
test('Mars next-card discount notice explains consumption and is absent without a pending discount',()=>{
 const g=game();assert.equal(renderToStaticMarkup(createElement(NextCardDiscount,{game:g})), '');
 g.privateState.nextCardDiscount=8;
 const html=renderToStaticMarkup(createElement(NextCardDiscount,{game:g}));
 assert.match(html,/다음 프로젝트 카드 −8 M€/);assert.match(html,/이번 세대/);assert.match(html,/지불을 취소하면 유지/);
 g.privateState.payment={label:'PowerPlant',cost:3,steel:true,titanium:false,heat:false,steelValue:2,titaniumValue:3,cardId:v.parse(TileIdSchema,'discount-card'),cancelable:true};
 assert.match(renderToStaticMarkup(createElement(NextCardDiscount,{game:g})),/지불을 확정하면 할인을 모두 사용/);
});


test('Mars exchange UI keeps unselected hand cards and acquisition sound works without a hand-count increase',()=>{
 const before=game(),after=game(2),card={tileId:v.parse(TileIdSchema,'exchange-old'),definitionId:MARS_CARDS[0]!.id,resources:0,usedGeneration:0};
 before.privateState.hand=[card];before.privateState.cardChoice={id:1,label:'Mars University',kind:'EXCHANGE',cards:[]};
 const html=renderToStaticMarkup(createElement(CardChoicePanel,{choice:before.privateState.cardChoice,hand:[card],money:0,heat:0,disabled:false,onConfirm(){},onSelect(){}}));
 assert.match(html,/교환하지 않고 계속/);assert.match(html,/선택하지 않은 손패는 그대로 유지/);assert.equal((html.match(/class="tm-art /g)||[]).length,1);
 after.privateState.hand=[{...card,tileId:v.parse(TileIdSchema,'exchange-new')}];after.privateState.cardChoice={id:2,label:'Mars University',kind:'EXCHANGE',cards:[]};
 assert.equal(marsFeedback(before,after,true).cue,'CARD');assert.equal(marsFeedback(before,after,false).cue,null);
 after.privateState.hand=[card];assert.equal(marsFeedback(before,after,true).cue,null);
});

import { EngineSummary } from '../features/mars/EngineSummary.js';
test('Mars habitat protection notice explains protected resources and production exclusions',()=>{
 const player=game().playerStates[0]!;player.protectedHabitats=true;
 const html=renderToStaticMarkup(createElement(EngineSummary,{player,generation:1,onInspect(){}}));
 assert.match(html,/서식지 보호/);assert.match(html,/식물·동물·미생물/);assert.match(html,/생산량 감소와 내 자원 사용은 보호 대상이 아닙니다/);
 player.protectedHabitats=false;assert.doesNotMatch(renderToStaticMarkup(createElement(EngineSummary,{player,generation:1,onInspect(){}})),/서식지 보호/);
});

test('Mars production copy guide explains the repeated decrease and excludes non-production benefits',()=>{
 const g=game();g.privateState.offers=[{id:'copy-production:card',kind:'EFFECT',targetId:'card',label:'생산량 복제',detail:'에너지 생산 -1 · M€ 생산 +3',cost:0}];
 const html=renderToStaticMarkup(createElement(ActionGuide,{game:g}));assert.match(html,/생산량 감소도 다시 적용/);assert.match(html,/타일 배치·전역 지표·태그는 복제하지 않습니다/);
});

import {LandClaimMarker} from '../features/mars/LandClaimMarker.js';
test('Mars land claim guide, numbered marker and confirmation sound distinguish reservation from placement',()=>{
 const before=game(),after=game(2);after.landClaims=[{spaceId:'4-4',ownerId:after.privateState.playerId}];after.history=[{id:1,generation:1,playerId:after.privateState.playerId,kind:'CLAIM',text:'4-4 토지 예약'}];
 after.privateState.offers=[{id:'claim-land:4-5',kind:'PLACE',targetId:'4-5',label:'예약',detail:'',cost:0}];
 const html=renderToStaticMarkup(createElement(ActionGuide,{game:after}));assert.match(html,/예약할 육지/);assert.match(html,/지금은 보너스나 점수를 받지 않습니다/);
 const marker=renderToStaticMarkup(createElement(LandClaimMarker,{color:'#ff0000',seat:2}));assert.match(marker,/>2<\/text>/);assert.match(marker,/#ff0000/);
 assert.equal(marsFeedback(before,after,true).cue,'CLAIM');assert.equal(marsFeedback(before,after,false).cue,null);
});

test('Mars attack guidance and sound distinguish removal from transfer and ignore reconnects',()=>{
 const old=game(),next=game(2);next.privateState.offers=[{id:'attack-stock:mars-b:steel:1',kind:'EFFECT',targetId:'mars-b',label:'강철 1 탈취',detail:'대상 1 → 0 · 내 자원 0 → 1',cost:0}];
 const html=renderToStaticMarkup(createElement(ActionGuide,{game:next}));assert.match(html,/대상과 자원 수량/);assert.match(html,/제거는 자원을 없애고/);assert.match(html,/생략할 수도/);
 next.history=[{id:1,generation:1,playerId:next.privateState.playerId,kind:'ATTACK',text:'강철 1 탈취'}];next.playerStates[0]!.resources.steel=1;
 assert.equal(marsFeedback(old,next,true).cue,'ATTACK');assert.equal(marsFeedback(old,next,false).cue,null);assert.equal(marsFeedback(next,next,true).cue,null);
});

import {marsScoreLabel} from '../features/mars/cards.js';
import {marsCard,MARS_CORPORATE_ERA_RESOURCE_ACTIONS,marsEffectText} from '@hangul-rummikub/shared';
test('Mars resource labels show fighters and distinguish one resource for two VP from four resources for one VP',()=>{
 const base=marsCard('Fish');
 assert.equal(marsScoreLabel({...base,resource:'fighter',resourceScore:{per:1,points:1}}),'전투기 1개당 1 VP');
 assert.equal(marsScoreLabel({...base,resource:'science',resourceScore:{per:1,points:2}}),'과학 1개당 2 VP');
 assert.equal(marsScoreLabel({...base,resource:'microbe',resourceScore:{per:4,points:1}}),'미생물 4개당 1 VP');
 assert.match(MARS_CORPORATE_ERA_RESOURCE_ACTIONS.SecurityFleet.map(marsEffectText).join(' · '),/티타늄 -1 · 이 카드에 전투기 \+1/);
});
