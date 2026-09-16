import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {safeParse,parse} from 'valibot';
import {DuelLobbyPlatformSnapshotV2Schema,DuelClientCommandSchema,DUEL_CARDS,DUEL_WONDERS,DUEL_GODS,GameIdSchema,GameRevisionSchema,TileIdSchema} from '@hangul-rummikub/shared';
import {Card,DetailArt,effectText} from '../features/seven-wonders-duel/art.js';
import {duelNewCue} from '../features/seven-wonders-duel/sound.js';
import {decodeWebSnapshot} from './snapshot-wire-decoder.js';
import {resolveRoomSnapshotView} from './room-snapshot-view.js';
import {WonderCard, WonderDetails} from '../features/seven-wonders-duel/WonderCard.js';
import {wonderEffects, wonderDraftEffect} from '../features/seven-wonders-duel/wonder-info.js';
import {MilitaryView, militarySummary} from '../features/seven-wonders-duel/MilitaryView.js';
import {buildingReference} from '../features/seven-wonders-duel/building-reference.js';
import {BuildingReference} from '../features/seven-wonders-duel/BuildingReference.js';
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

test('DUEL inspecting one hidden target must not offer other hidden targets or unrelated location choices', async()=>{
 const {duelInspectionOptions}=await import('../features/seven-wonders-duel/inspection.js');
 const option=(id:string,sourceId:string,definitionId:string|null=null)=>({id,sourceId,definitionId,targetId:null,group:'CHOICE' as const,label:id,detail:'',cost:null});
 const selected=option('option-0','hidden-a');
 const options=[selected,option('option-1','hidden-b'),option('option-2','0')];
 assert.deepEqual(duelInspectionOptions(options,{id:null,source:'hidden-a'}),[selected]);
 assert.deepEqual(duelInspectionOptions(options,{id:null,source:'unrelated'}),[]);
 const god=option('option-3','2','isis');
 assert.deepEqual(duelInspectionOptions([god],{id:'isis',source:'isis'}),[god]);
});

test('DUEL wonder selection exposes the missing military, destruction, production and coin benefits',()=>{
 const wonder=(id:string)=>{const w=DUEL_WONDERS.find(w=>w.id===id);assert.ok(w);return w;};
 const zeus=renderToStaticMarkup(createElement(WonderCard,{wonder:wonder('wonder-zeus-statue'),draft:true,onInspect(){}}));
 for(const text of ['상대 갈색 건물 제거','방패 1개','승점 3점','나무','돌','점토','파피루스','×2','건설에 필요한 자원','상세 보기'])assert.ok(zeus.includes(text),text);
 const colossus=wonderEffects(wonder('wonder-colossus')).map(e=>e.short);
 assert.deepEqual(colossus,['방패 2개','승점 3점']);
 assert.ok(wonderEffects(wonder('wonder-lighthouse')).some(e=>e.text.includes('나무·점토·돌 중 필요한 자원 1개')));
 const artemis=wonderEffects(wonder('wonder-artemis')).map(e=>e.short);
 assert.deepEqual(artemis,['코인 +12','추가 턴']);
});

test('DUEL wonder help distinguishes draft bonuses from later construction without requesting payment',()=>{
 for(const w of DUEL_WONDERS){
  const html=renderToStaticMarkup(createElement(WonderDetails,{wonder:w,draft:true}));
  assert.ok(html.includes('자원은 나중에 건설할 때 필요합니다.'));
  assert.ok(html.includes('건설하면 얻는 효과'));
  assert.ok(wonderEffects(w).length>0);
  assert.equal(html.includes('선택 즉시 효과'),Boolean(w.onSelect));
  assert.equal(wonderDraftEffect(w)!==null,Boolean(w.onSelect));
  if(w.onSelect)assert.ok(html.indexOf('선택 즉시 효과')<html.indexOf('건설하면 얻는 효과'));
  if(w.effect)assert.ok(wonderEffects(w).some(e=>e.text.length>20),w.id);
 }
});

test('DUEL military inspection preserves viewer direction, spent tokens and Agora replacement effects',()=>{
 const game={military:3,militaryTokens:[-6,-3,6],minerva:null,settings:{pantheon:false,agora:false}};
 const render=(g:typeof game,seat:0|1)=>renderToStaticMarkup(createElement(MilitaryView,{game:g,seat,myName:'나문명',opponentName:'상대문명'}));
 const html=render(game,0);
 assert.equal(militarySummary(3,0),'나 우세 3칸');
 assert.equal(militarySummary(3,1),'상대 우세 3칸');
 assert.equal(militarySummary(0,1),'중앙 · 군사력 균형');
 assert.equal(render({...game,military:-3,militaryTokens:game.militaryTokens.map(n=>-n)},1),html);
 assert.equal((html.match(/aria-current="location"/g)??[]).length,1);
 assert.match(html,/상대 쪽 3칸[\s\S]*?spent[\s\S]*?상대: 2코인 상실[\s\S]*?토큰 없음/);
 for(const text of ['나: 5코인 상실','10점','2점','5점','즉시 승리','일반 코인이 부족하면 남은 만큼'])assert.ok(html.includes(text),text);
 const agora=render({...game,settings:{pantheon:true,agora:true}},0);
 assert.ok(agora.includes('코인 손실 토큰을 사용하지 않습니다'));
 assert.ok(agora.includes('나: 영향력 1개 배치'));
 assert.ok(agora.includes('상대: 자신의 영향력 이동 후 내 큐브 제거'));
 assert.equal(agora.includes('5코인 상실'),false);
});

test('DUEL reference retains multi-step and skipped-age chains and covers each enabled component once',()=>{
 for(const pantheon of [false,true])for(const agora of [false,true]){
  const model=buildingReference(pantheon,agora),cards=[...model.chains.flat(),...model.unlinked,...model.temples];
  const expected=DUEL_CARDS.filter(c=>c.color==='TEMPLE'?pantheon:c.color==='PURPLE'?!pantheon:c.color==='WHITE'||c.color==='BLACK'?agora:true);
  assert.deepEqual(cards.map(c=>c.id).sort(),expected.map(c=>c.id).sort());
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  assert.deepEqual(model.chains.find(row=>row[0]?.id==='theater')?.map(c=>c.id),['theater','statue','gardens']);
  assert.deepEqual(model.chains.find(row=>row[0]?.id==='palisade')?.map(c=>c.age),[1,3]);
  assert.equal(model.temples.length,pantheon?5:0);
  const html=renderToStaticMarkup(createElement(BuildingReference,{pantheon,agora,onInspect(){}}));
  assert.equal((html.match(/class="du-chain-card /g)??[]).length,expected.length);
  assert.ok(html.includes('연계되지 않은 건물'));
  assert.ok(html.includes('방책 → 요새 무료 연계'));
  assert.equal(html.includes('해당 신화 토큰을 보유하면'),pantheon);
  assert.equal(html.includes('고용 비용: 원로원 규칙 적용'),agora);
 }
});

test('DUEL city benefits distinguish fixed production, choices, discounts and one-time income', async () => {
 const {buildingBenefits,cityBuildingGroups}=await import('../features/seven-wonders-duel/building-info.js');
 const {BuildingDetails}=await import('../features/seven-wonders-duel/BuildingDetails.js');
 const fixed=DUEL_CARDS.find(c=>c.production?.stone===1)!;
 const flex=DUEL_CARDS.find(c=>c.flex?.includes('stone'))!;
 const trade=DUEL_CARDS.find(c=>c.trade?.includes('stone'))!;
 const income=DUEL_CARDS.find(c=>c.income===4)!;
 const buildings=[fixed,fixed,flex,trade].map((c,i)=>({tileId:parse(TileIdSchema,`owned-${i}`),definitionId:c.id,back:'AGE' as const,slot:null}));
 const result=cityBuildingGroups(buildings,false,false);
 assert.equal(result.fixed.stone,2);
 assert.equal(result.groups.flatMap(g=>g.cards).length,4);
 assert.equal(new Set(result.groups.flatMap(g=>g.cards).map(c=>c.tileId)).size,4);
 assert.ok(buildingBenefits(flex).ongoing.some(e=>e.text.includes('모두를 동시에 생산하는 것은 아닙니다')));
 assert.ok(buildingBenefits(trade).ongoing.some(e=>e.text.includes('자원을 생산하는 효과는 아닙니다')));
 const owned=renderToStaticMarkup(createElement(BuildingDetails,{card:income,owned:true,quotedCost:0}));
 assert.ok(owned.includes('한 번'));assert.ok(owned.includes('매 턴 받는 수입이 아닙니다'));assert.ok(!owned.includes('지금 건설 비용'));
 const quoted=renderToStaticMarkup(createElement(BuildingDetails,{card:fixed,quotedCost:0}));
 assert.ok(quoted.includes('지금 건설 비용'));assert.ok(quoted.includes('0코인'));
});

test('DUEL city groups cover enabled expansions and exclude unknown private definitions', async () => {
 const {cityBuildingGroups,buildingBenefits}=await import('../features/seven-wonders-duel/building-info.js');
 for(const pantheon of [false,true])for(const agora of [false,true]){
  const cards=DUEL_CARDS.filter(c=>(pantheon?c.color!=='PURPLE':c.color!=='TEMPLE')&&(agora||!['WHITE','BLACK'].includes(c.color)));
  const buildings=cards.map((c,i)=>({tileId:parse(TileIdSchema,`c-${i}`),definitionId:c.id,back:'AGE' as const,slot:null}));
  buildings.push({tileId:parse(TileIdSchema,'hidden'),definitionId:'unknown',back:'AGE',slot:null});
  const groups=cityBuildingGroups(buildings,pantheon,agora).groups;
  assert.equal(groups.flatMap(g=>g.cards).length,cards.length);
  assert.ok(!groups.flatMap(g=>g.cards).some(c=>c.tileId==='hidden'));
 }
 const linked=DUEL_CARDS.find(c=>c.chainOut&&DUEL_CARDS.some(next=>next.chainIn===c.chainOut))!;
 assert.deepEqual(buildingBenefits(linked).chain,DUEL_CARDS.filter(c=>c.chainIn===linked.chainOut).map(c=>c.name));
 const science=DUEL_CARDS.find(c=>c.science&&c.points)!;
 assert.ok(buildingBenefits(science).ongoing.some(e=>e.text.includes('과학 기호')));
 assert.ok(buildingBenefits(science).scoring.some(e=>e.text.includes(`${science.points}점`)));
});
