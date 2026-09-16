import assert from 'node:assert/strict';
import test from 'node:test';
import {GAME_CATALOG} from '../features/game-catalog/game-catalog.js';
import {WEB_SUPPORTED_GAME_TYPES} from './snapshot-wire-decoder.js';
import {readFileSync} from 'node:fs';
test('Arnak is available in browser catalog and capability advertisement',()=>{assert.ok(GAME_CATALOG.some(g=>g.gameType==='ARNAK'));assert.ok(WEB_SUPPORTED_GAME_TYPES.includes('ARNAK'));});
test('Arnak image files are present with valid WebP headers',()=>{
 for(const file of ['island.webp','camp.webp','atlas.webp'])assert.equal(readFileSync(new URL('../../public/images/arnak/'+file,import.meta.url)).subarray(8,12).toString(),'WEBP');
});

import * as v from 'valibot';
import { GameIdSchema, GameRevisionSchema, arnakResources } from '@hangul-rummikub/shared';
import { arnakNewCue } from '../features/arnak/sound.js';
import { arnakResourceChanges } from '../features/arnak/feedback.js';
test('Arnak sound suppresses initial, duplicate, disconnected and skipped snapshots', () => {
 const gameId=v.parse(GameIdSchema,'arnak-sound-game');
 const g={gameId,gameRevision:v.parse(GameRevisionSchema,4),phase:'PLAYING' as const,stage:'ACTION' as const,history:[{kind:'DISCOVER'}]};
 assert.equal(arnakNewCue(null,g,true),null);
 assert.equal(arnakNewCue({gameId,revision:3},g,false),null);
 assert.equal(arnakNewCue({gameId,revision:4},g,true),null);
 assert.equal(arnakNewCue({gameId,revision:1},g,true),null);
 assert.equal(arnakNewCue({gameId:'other-game',revision:3},g,true),null);
 assert.equal(arnakNewCue({gameId,revision:3},g,true),'DISCOVER');
 assert.equal(arnakNewCue({gameId,revision:3},{...g,history:[{kind:'KEEP'}]},true),'SELECT');
 assert.equal(arnakNewCue({gameId,revision:3},{...g,stage:'CLEANUP',history:[{kind:'PASS'}]},true),'CARD');
 assert.equal(arnakNewCue({gameId,revision:3},{...g,history:[{kind:'PASS'}]},true),'TURN');
});
test('Arnak resource feedback shows signed changes once and stays silent on resync', () => {
 const previous={gameId:'arnak-feedback',revision:3,resources:arnakResources({coin:4,tablet:1})};
 const next={...previous,revision:4,resources:arnakResources({coin:2,tablet:3})};
 assert.deepEqual(arnakResourceChanges(previous,next),['금화 −2','석판 +2']);
 assert.deepEqual(arnakResourceChanges(null,next),[]);
 assert.deepEqual(arnakResourceChanges(next,next),[]);
 assert.deepEqual(arnakResourceChanges(previous,{...next,revision:7}),[]);
 assert.deepEqual(arnakResourceChanges(previous,{...next,gameId:'new'}),[]);
});

import { ARNAK_CARDS, ARNAK_ASSISTANTS, ARNAK_GUARDIANS, ARNAK_SITES, arnakCard, arnakAssistant, TileIdSchema } from '@hangul-rummikub/shared';
import { describeArnakEffect } from '../features/arnak/effect-description.js';
import { ArnakCardDetail } from '../features/arnak/ArnakCardDetail.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
test('Arnak effect descriptions distinguish free acquisition, deck placement and discounts', () => {
 const text=(id:string)=>arnakCard(id).effects.map(describeArnakEffect).join(' ');
 assert.match(text('0112'),/아이템 1장 비용 없이 획득 · 손패에 추가/);
 assert.match(text('0207'),/아이템 1장 비용 없이 획득 · 덱 위에 놓기/);
 assert.match(text('0137'),/유물 1장 비용 4 할인하여 획득/);
 assert.match(text('0120'),/덱 맨 위도 공개/);
 assert.match(text('0115'),/덱 아래에서 카드 1장 뽑기/);
 assert.match(text('0101'),/수첩만.*비용 없음/);
 assert.match(text('0224'),/사원.*보석 1 할인/);
});
test('Arnak effect descriptions expose assistant alternatives, payment chains and site restrictions', () => {
 assert.match(arnakAssistant('assistant-6').silver.map(describeArnakEffect).join(' '),/금화 1.*또는.*비행기/);
 assert.match(arnakAssistant('assistant-2').silver.map(describeArnakEffect).join(' '),/도보 이동 비용 지불 → 화살촉 1/);
 assert.match(arnakCard('0102').effects.map(describeArnakEffect).join(' '),/아무 탐험가도 없는 기초 장소/);
 assert.match(arnakCard('0133').effects.map(describeArnakEffect).join(' '),/다른 플레이어의 탐험가가 없는 장소/);
 assert.match(arnakCard('0222').effects.map(describeArnakEffect).join(' '),/금색 능력 복사/);
 assert.match(arnakCard('0227').effects.map(describeArnakEffect).join(' '),/은색 능력 복사/);
});
test('Arnak all catalog effects render readable descriptions without missing branches', () => {
 const effects=[...ARNAK_CARDS.flatMap(c=>[...c.effects,...c.passEffects]),...ARNAK_ASSISTANTS.flatMap(a=>[...a.silver,...a.gold]),...ARNAK_GUARDIANS.flatMap(g=>g.boon),...ARNAK_SITES.flatMap(s=>s.effects)];
 for(const id of effects){const text=describeArnakEffect(id);assert.ok(text.length>2,id);assert.doesNotMatch(text,/undefined|NaN|추가 효과 선택/,id);}
});
test('Arnak detailed cards explain alternate passing, exile and artifact use without action controls', () => {
 const html=(id:string)=>renderToStaticMarkup(createElement(ArnakCardDetail,{card:{tileId:v.parse(TileIdSchema,'inspect-card'),definitionId:id},onClose(){}}));
 assert.match(html('0108'),/대신 패스할 때/);assert.match(html('0108'),/일반 효과와 둘 중 하나/);
 assert.match(html('0112'),/카드 자체를 제거/);assert.match(html('0207'),/석판 1개/);
 assert.match(html('0207'),/aria-labelledby=/);assert.match(html('0207'),/카드 상세 닫기/);
 assert.doesNotMatch(html('0207'),/선택 확정/);
});

import { ARNAK_SOUND_SCORES, arnakVolume } from '../features/arnak/sound-engine.js';
import { arnakTurnNotice, type ArnakTurnFeedbackSnapshot } from '../features/arnak/feedback.js';
import { PlayerIdSchema } from '@hangul-rummikub/shared';
import { ArnakSoundControls } from '../features/arnak/ArnakSoundControls.js';
test('Arnak turn feedback announces only new continuous transitions', () => {
 const self=v.parse(PlayerIdSchema,'self'), other=v.parse(PlayerIdSchema,'other');
 const before:ArnakTurnFeedbackSnapshot={gameId:v.parse(GameIdSchema,'turn-feedback'),gameRevision:v.parse(GameRevisionSchema,3),round:1,phase:'PLAYING',stage:'ACTION',activePlayerId:other};
 const next={...before,gameRevision:v.parse(GameRevisionSchema,4),activePlayerId:self};
 assert.equal(arnakTurnNotice(before,next,self),'내 차례입니다');
 assert.equal(arnakTurnNotice(before,{...next,round:2},self),'라운드 2 시작 · 내 차례입니다');
 assert.equal(arnakTurnNotice(before,{...next,round:2,activePlayerId:other},self),'라운드 2 시작');
 assert.equal(arnakTurnNotice(before,{...next,stage:'CLEANUP'},self),'라운드 정리 · 보관할 카드를 확인하세요');
 assert.equal(arnakTurnNotice({...before,activePlayerId:self},next,self),'');
 assert.equal(arnakTurnNotice(null,next,self),'');
 assert.equal(arnakTurnNotice(next,next,self),'');
 assert.equal(arnakTurnNotice(before,{...next,gameRevision:v.parse(GameRevisionSchema,8)},self),'');
 assert.equal(arnakTurnNotice(before,{...next,gameId:v.parse(GameIdSchema,'new-game')},self),'');
 assert.equal(arnakTurnNotice(before,{...next,phase:'FINISHED'},self),'');
});
test('Arnak sound scores have bounded envelopes and distinct physical textures', () => {
 assert.equal(arnakVolume(-1),0);assert.equal(arnakVolume(140),100);assert.equal(arnakVolume(NaN),30);
 assert.equal(arnakVolume(57),57);
 for(const score of Object.values(ARNAK_SOUND_SCORES)) {
  assert.ok(score.tones.length+score.textures.length>0);
  for(const part of [...score.tones,...score.textures]) {
   assert.ok(part.frequency>0 && part.frequency<20000);
   assert.ok(part.duration>0 && part.delay>=0 && part.delay+part.duration<2);
   assert.ok(part.gain>0 && part.gain<=.5);
  }
 }
 assert.ok(ARNAK_SOUND_SCORES.CARD.textures.some(t=>t.filter==='highpass'));
 assert.ok(ARNAK_SOUND_SCORES.DIG.textures.some(t=>t.filter==='lowpass'));
 assert.notDeepEqual(ARNAK_SOUND_SCORES.WIN,ARNAK_SOUND_SCORES.DISCOVER);
});
test('Arnak sound controls label mute and disable previews while muted', () => {
 const html=renderToStaticMarkup(createElement(ArnakSoundControls,{volume:0,setVolume(){},async unlock(){},play(){}}));
 assert.match(html,/소리 꺼짐/);assert.match(html,/aria-pressed="true"/);
 assert.equal((html.match(/disabled=""/g)??[]).length,4);
 assert.match(html,/카드 넘김/);assert.match(html,/발굴/);assert.match(html,/구매/);assert.match(html,/유적 발견/);
});

import { ARNAK_CARD_ART_SHEETS, arnakCardArtStyle } from '../features/arnak/card-art.js';
import { ArnakCardArt } from '../features/arnak/ArnakCardArt.js';
test('Arnak every card definition has a unique illustration with complete atlas files', () => {
 const ids=ARNAK_CARD_ART_SHEETS.flat();
 assert.deepEqual([...ids].sort(),ARNAK_CARDS.map(c=>c.id).sort());
 assert.equal(new Set(ids).size,80);
 const locations=new Set<string>();
 for(const [index,sheet] of ARNAK_CARD_ART_SHEETS.entries()){
  assert.equal(sheet.length,16);
  const bytes=readFileSync(new URL(`../../public/images/arnak/cards-${index+1}.webp`,import.meta.url));
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<1_000_000);
  for(const id of sheet){const style=arnakCardArtStyle(id);locations.add(JSON.stringify(style));assert.match(String(style.backgroundImage),new RegExp(`cards-${index+1}\\.webp`));}
 }
 assert.equal(locations.size,80);
});
test('Arnak small and enlarged card artwork share the same source and avoid duplicate accessible labels', () => {
 const small=renderToStaticMarkup(createElement(ArnakCardArt,{definitionId:'0111'}));
 const detail=renderToStaticMarkup(createElement(ArnakCardArt,{definitionId:'0111',detail:true}));
 assert.match(small,/aria-hidden="true"/);assert.match(detail,/튼튼한 장화 테마 일러스트/);
 assert.match(small,/cards-1.webp/);assert.match(detail,/cards-1.webp/);
 const extract=(html:string)=>html.match(/style="([^"]+)"/)?.[1];
 assert.ok(extract(small));assert.equal(extract(small),extract(detail));
 const [x,y]=String(arnakCardArtStyle('0111').backgroundPosition).split(' ').map(parseFloat);
 assert.ok(x!>60&&x!<70&&y!>60&&y!<70);
});

import { ARNAK_WORLD_ART_SHEETS, arnakWorldArt } from '../features/arnak/world-art.js';
import { ArnakWorldArt } from '../features/arnak/ArnakWorldArt.js';
test('Arnak every public site, guardian and assistant has distinct world art', () => {
 const catalog=[...ARNAK_SITES,...ARNAK_GUARDIANS,...ARNAK_ASSISTANTS];
 assert.deepEqual(ARNAK_WORLD_ART_SHEETS.flat().slice().sort(),catalog.map(d=>d.id).sort());
 assert.equal(new Set(ARNAK_WORLD_ART_SHEETS.flat()).size,48);
 assert.equal(new Set(catalog.map(d=>JSON.stringify(arnakWorldArt(d.id)?.style))).size,48);
 for(const [sheet,ids] of ARNAK_WORLD_ART_SHEETS.entries()){
  assert.equal(ids.length,16);
  const bytes=readFileSync(new URL(`../../public/images/arnak/world-${sheet+1}.webp`,import.meta.url));
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<1_000_000);
  for(const id of ids)assert.equal(arnakWorldArt(id)?.name,catalog.find(d=>d.id===id)?.name);
 }
});
test('Arnak hidden definitions never select world illustrations and previews name the public subject', () => {
 for(const definitionId of [null,undefined,'hidden-location','unknown']){
  assert.equal(arnakWorldArt(definitionId),null);
  assert.equal(renderToStaticMarkup(createElement(ArnakWorldArt,{definitionId,expanded:true})),'');
 }
 const small=renderToStaticMarkup(createElement(ArnakWorldArt,{definitionId:'assistant-6'}));
 const large=renderToStaticMarkup(createElement(ArnakWorldArt,{definitionId:'assistant-6',expanded:true}));
 assert.match(small,/aria-hidden="true"/);assert.match(large,/항공 조종사 테마 일러스트/);
 assert.equal(small.match(/style="([^"]+)"/)?.[1],large.match(/style="([^"]+)"/)?.[1]);
 assert.match(large,/world-3.webp/);
});

import { ArnakPlayerPublicSchema } from '@hangul-rummikub/shared';
import { ArnakOpponentCamp } from '../features/arnak/ArnakOpponentCamp.js';
const publicCamp=()=>v.parse(ArnakPlayerPublicSchema,{playerId:'opponent',resources:arnakResources({coin:3}),workers:1,handCount:4,deckCount:6,played:[{tileId:'public-card',definitionId:'0111'}],assistants:[{definitionId:'assistant-0',gold:true,ready:false}],guardians:[{definitionId:'guardian-0',used:true}],idols:2,idolSlots:1,magnifier:'3',notebook:'1L',templePoints:6,fearTiles:1,passed:false});
test('Arnak opponent camp displays public research, current assistant grade and spent boons',()=>{
 const html=renderToStaticMarkup(createElement(ArnakOpponentCamp,{player:publicCamp(),onInspectCard(){}}));
 assert.match(html,/3단계 \(3\)/);assert.match(html,/1단계 \(1L\)/);
 assert.match(html,/금색.*사용 완료/);assert.match(html,/금화 3/);assert.doesNotMatch(html,/금화 2/);
 assert.match(html,/축복 사용 완료/);assert.match(html,/튼튼한 장화 카드 상세 보기/);
 assert.match(html,/4장 \/ 6장/);
 assert.doesNotMatch(html,/선택 확정|효과 사용하기/);
});
test('Arnak public camp never renders extra private hand or deck contents',()=>{
 const player={...publicCamp(),hand:[{tileId:'secret-hand',definitionId:'secret-hand-name'}],deck:[{tileId:'secret-deck',definitionId:'secret-deck-name'}],offers:[{label:'secret-offer'}]};
 const html=renderToStaticMarkup(createElement(ArnakOpponentCamp,{player,onInspectCard(){}}));
 assert.doesNotMatch(html,/secret-/);assert.match(html,/손패와 덱은 장수만 공개/);
});
test('Arnak empty opponent camp gives explicit empty states',()=>{
 const player={...publicCamp(),played:[],assistants:[],guardians:[],magnifier:'0',notebook:'0'};
 const html=renderToStaticMarkup(createElement(ArnakOpponentCamp,{player,onInspectCard(){}}));
 assert.match(html,/고용한 조수가 없습니다/);assert.match(html,/극복한 수호자가 없습니다/);assert.match(html,/사용한 카드가 없습니다/);assert.match(html,/출발/);
});

import { ArnakOfferSchema } from '@hangul-rummikub/shared';
import { groupArnakOffers } from '../features/arnak/offer-list.js';
import { ArnakOfferList } from '../features/arnak/ArnakOfferList.js';
const paymentOffer=(id:string,cards:string[],coin=0)=>v.parse(ArnakOfferSchema,{id,kind:'DIG',targetId:'base-0',label:'해안 야영지 발굴',detail:'장소 보상',cost:arnakResources({coin}),cards,free:false});
test('Arnak payment grouping preserves distinct server IDs, cost choices and input order',()=>{
 const a=paymentOffer('a',['card-a']),b=paymentOffer('b',['card-b']),coins=paymentOffer('coins',[],2);
 const groups=groupArnakOffers([a,b,coins],new Set());
 assert.equal(groups.length,1);assert.deepEqual(groups[0]?.offers,[a,b,coins]);
 const different={...a,id:'effect',kind:'EFFECT' as const};
 assert.equal(groupArnakOffers([a,different],new Set()).length,2);
 assert.equal(groupArnakOffers([a,{...b,detail:'다른 효과'}],new Set()).length,2);
 assert.equal(groupArnakOffers([a,{...b,targetId:'base-1'}],new Set()).length,2);
});
test('Arnak preserve-card filters use instance IDs and never invent alternative payments',()=>{
 const offers=[paymentOffer('a',['card-a']),paymentOffer('b',['card-b']),paymentOffer('both',['card-a','card-b']),paymentOffer('coins',[],2)];
 assert.deepEqual(groupArnakOffers(offers,new Set(['card-a'])).flatMap(g=>g.offers.map(o=>o.id)),['b','coins']);
 assert.deepEqual(groupArnakOffers(offers,new Set(['card-a','card-b'])).flatMap(g=>g.offers.map(o=>o.id)),['coins']);
 assert.equal(groupArnakOffers(offers.slice(0,3),new Set(['card-a','card-b'])).length,0);
 assert.equal(offers.length,4);assert.deepEqual(offers[2]?.cards,['card-a','card-b']);
});
test('Arnak payment list exposes separate hand instances and selection without command controls',()=>{
 const hand=['card-a','card-b'].map(id=>({tileId:v.parse(TileIdSchema,id),definitionId:'fear'}));
 const html=renderToStaticMarkup(createElement(ArnakOfferList,{offers:[paymentOffer('a',['card-a']),paymentOffer('b',['card-b'])],hand,selected:'a',disabled:false,onSelect(){}}));
 assert.match(html,/공포 · 도보 · 손패 1/);assert.match(html,/공포 · 도보 · 손패 2/);
 assert.match(html,/자원 지불 없음/);assert.match(html,/지불 방법 2개/);assert.match(html,/aria-pressed="true"/);assert.doesNotMatch(html,/선택 확정/);
});

import { ArnakResearchDetail } from '../features/arnak/ArnakResearchDetail.js';
test('Arnak research preview distinguishes token rewards and connected predecessor cells',()=>{
 const html=renderToStaticMarkup(createElement(ArnakResearchDetail,{target:'2R',templeSupply:[]}));
 assert.match(html,/1L · 1R/);assert.match(html,/돋보기 보상/);assert.match(html,/나침반 1/);
 assert.match(html,/수첩 보상/);assert.match(html,/조수 1명 고용/);assert.match(html,/석판 1/);assert.match(html,/화살촉 1/);
 assert.doesNotMatch(html,/<button|선택 확정/);
});
test('Arnak research endpoints do not show ordinary row rewards',()=>{
 const render=(target:string)=>renderToStaticMarkup(createElement(ArnakResearchDetail,{target,templeSupply:[]}));
 assert.match(render('0'),/연구 출발점/);assert.doesNotMatch(render('0'),/돋보기 보상|기본 비용/);
 assert.match(render('8'),/수첩은 이 칸으로 이동할 수 없습니다/);assert.doesNotMatch(render('8'),/수첩 보상/);
 assert.equal(render('unknown'),'');
});
test('Arnak temple preview shows public remaining supply including exhausted tiles',()=>{
 const html=renderToStaticMarkup(createElement(ArnakResearchDetail,{target:'temple',templeSupply:[0,1,2,3,4,0]}));
 assert.equal((html.match(/남은 타일 0개/g)??[]).length,2);
 assert.equal((html.match(/기본 비용:/g)??[]).length,6);assert.match(html,/11점/);
 assert.match(html,/실제 비용은 아래 실행 가능한 행동/);assert.doesNotMatch(html,/<button/);
});

import type { ArnakCard } from '@hangul-rummikub/shared';
import { ArnakCleanup } from '../features/arnak/ArnakCleanup.js';
test('Arnak cleanup separates confirmed keep choices by instance and preserves hand positions',()=>{
 const hand=['first','second'].map(id=>({tileId:v.parse(TileIdSchema,id),definitionId:'fear'}));
 const html=renderToStaticMarkup(createElement(ArnakCleanup,{hand,keep:['second','unknown'],selected:'first',disabled:false,onSelect(){}}));
 assert.match(html,/보관할 손패 <span>1장/);assert.match(html,/내려놓을 손패 <span>1장/);
 assert.match(html,/공포 · 손패 2 · 보관 해제 선택/);assert.match(html,/공포 · 손패 1 · 보관 선택/);
 assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);
 assert.ok(html.indexOf('손패 2')<html.indexOf('손패 1'));
 assert.match(html,/확정된 선택만/);assert.doesNotMatch(html,/unknown/);
});
test('Arnak cleanup has explicit empty groups and prevents card selection while blocked',()=>{
 const render=(hand:ArnakCard[])=>renderToStaticMarkup(createElement(ArnakCleanup,{hand,keep:[],selected:null,disabled:true,onSelect(){}}));
 assert.equal((render([]).match(/없음/g)??[]).length,2);
 const html=render([{tileId:v.parse(TileIdSchema,'one'),definitionId:'fear'}]);
 assert.match(html,/disabled=""/);assert.match(html,/패스하면 이번 라운드에는 다시 행동할 수 없습니다/);
});

import { arnakActionTargets } from '../features/arnak/action-browser.js';
import { ArnakActionBrowser } from '../features/arnak/ArnakActionBrowser.js';
test('Arnak action browser counts destinations rather than payment choices and excludes turn controls',()=>{
 const offers=[paymentOffer('a',['one']),paymentOffer('b',['two']),{...paymentOffer('buy',[]),kind:'BUY' as const,targetId:'market-card'}, {...paymentOffer('end',[]),kind:'END' as const}, {...paymentOffer('keep',[]),kind:'KEEP' as const}];
 const groups=arnakActionTargets(offers);
 assert.deepEqual(groups.map(g=>g.kind),['DIG','BUY']);
 assert.equal(groups[0]?.targets.length,1);assert.equal(groups[0]?.targets[0]?.choices,2);
 assert.equal(groups[1]?.targets[0]?.targetId,'market-card');assert.equal(offers.length,5);
 assert.deepEqual(arnakActionTargets([]),[]);
});
test('Arnak action browser uses visible names, exposes only offered targets and disables navigation when blocked',()=>{
 const html=renderToStaticMarkup(createElement(ArnakActionBrowser,{offers:[paymentOffer('a',[])],names:new Map([['base-0','해안 야영지'],['secret','비공개 카드']]),disabled:true,onSelect(){}}));
 assert.match(html,/해안 야영지/);assert.match(html,/선택지 1개/);assert.match(html,/disabled=""/);
 assert.doesNotMatch(html,/비공개 카드|선택 확정/);
 assert.equal(renderToStaticMarkup(createElement(ArnakActionBrowser,{offers:[],names:new Map(),disabled:false,onSelect(){}})),'');
});

import { ArnakJournal, filterArnakHistory } from '../features/arnak/ArnakJournal.js';
import { ArnakLogSchema } from '@hangul-rummikub/shared';
const journalEntry=(id:number,round:number,playerId='alice')=>v.parse(ArnakLogSchema,{id,round,playerId,kind:'DIG',text:`기록 ${id}`});
test('Arnak journal combines player and round filters, newest first without mutating history',()=>{
 const history=[journalEntry(1,1),journalEntry(2,2,'bob'),journalEntry(3,2)];
 assert.deepEqual(filterArnakHistory(history,'','').map(e=>e.id),[3,2,1]);
 assert.deepEqual(filterArnakHistory(history,'2','alice').map(e=>e.id),[3]);
 assert.deepEqual(filterArnakHistory(history,'','bob').map(e=>e.id),[2]);
 assert.deepEqual(filterArnakHistory(history,'1','bob'),[]);
 assert.deepEqual(history.map(e=>e.id),[1,2,3]);
});
test('Arnak journal initially shows fifteen entries and offers access to earlier public records',()=>{
 const history=Array.from({length:20},(_,i)=>journalEntry(i+1,1));
 const html=renderToStaticMarkup(createElement(ArnakJournal,{history,players:[{playerId:'alice',nickname:'탐험가 A'}]}));
 assert.match(html,/20건 중 15건 표시/);assert.match(html,/이전 기록 더 보기 · 5건 남음/);
 assert.match(html,/기록 20/);assert.doesNotMatch(html,/>기록 5</);assert.match(html,/탐험가 A/);
 assert.equal((html.match(/<li>/g)??[]).length,15);
});
test('Arnak journal handles empty history and renders public text safely',()=>{
 const html=renderToStaticMarkup(createElement(ArnakJournal,{history:[],players:[]}));
 assert.match(html,/아직 탐험 기록이 없습니다/);assert.doesNotMatch(html,/이전 기록 더 보기/);
 const escaped=renderToStaticMarkup(createElement(ArnakJournal,{history:[{...journalEntry(1,1),text:'<script>test</script>'}],players:[]}));
 assert.match(escaped,/&lt;script&gt;/);assert.doesNotMatch(escaped,/<script>/);
});

import { ArnakResults } from '../features/arnak/ArnakResults.js';
import { ArnakResultSchema } from '@hangul-rummikub/shared';
const resultFixture=()=>v.parse(ArnakResultSchema,{reason:'SCORED',winnerPlayerIds:['alice'],scores:['alice','bob'].map(playerId=>({playerId,research:10,temple:2,guardians:5,idols:3,slots:10,cards:4,fear:2,total:32}))});
const resultPlayers=[{playerId:'alice',nickname:'앨리스'},{playerId:'bob',nickname:'밥'}];
test('Arnak results honor server tie-break winners and totals without inferring a winner from tied scores',()=>{
 const html=renderToStaticMarkup(createElement(ArnakResults,{result:resultFixture(),players:resultPlayers,self:'bob',isHost:false,disabled:false,onRematch(){}}));
 assert.match(html,/앨리스의 승리/);assert.equal((html.match(/ar-result-winner/g)??[]).length,1);
 assert.match(html,/탐험 완료 · 나/);assert.match(html,/−2/);assert.match(html,/scope="row">총점/);
 assert.doesNotMatch(html,/새로운 탐험 준비 →/);assert.match(html,/방장이 새로운 탐험/);
});
test('Arnak results display shared winners and disable host rematch while disconnected or pending',()=>{
 const result={...resultFixture(),winnerPlayerIds:resultPlayers.map(p=>v.parse(PlayerIdSchema,p.playerId))};
 const html=renderToStaticMarkup(createElement(ArnakResults,{result,players:resultPlayers,self:'alice',isHost:true,disabled:true,onRematch(){}}));
 assert.match(html,/앨리스 · 밥의 승리/);assert.equal((html.match(/ar-result-winner/g)??[]).length,2);
 assert.match(html,/disabled=""/);
});
test('Arnak cancelled results do not present winners or a final scoring comparison',()=>{
 const html=renderToStaticMarkup(createElement(ArnakResults,{result:{...resultFixture(),reason:'CANCELLED'},players:resultPlayers,self:'alice',isHost:true,disabled:false,onRematch(){}}));
 assert.match(html,/탐험이 중단되었습니다/);assert.doesNotMatch(html,/의 승리|<table|ar-result-winner/);
});
