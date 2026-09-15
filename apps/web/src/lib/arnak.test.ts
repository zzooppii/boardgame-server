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
