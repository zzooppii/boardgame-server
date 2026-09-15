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
