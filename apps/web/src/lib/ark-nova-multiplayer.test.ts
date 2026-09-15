import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as v from 'valibot';
import {PlayerIdSchema,type ArkSoloView} from '@hangul-rummikub/shared';
import {ArkNovaMultiplayer} from '../features/ark-nova/ArkNovaMultiplayer.js';
import {ArkNovaMultiplayerContext} from '../features/ark-nova/ArkNovaMode.js';
import {ArkNovaCard} from '../features/ark-nova/ArkNovaCards.js';
import {arkAssociationAdvice} from '../features/ark-nova/association-advice.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';
function state():ArkSoloView{
  const s=structuredClone(arkSoloSetupFixture),other=v.parse(PlayerIdSchema,'opponent');
  const player={playerId:s.playerId,money:s.money,appeal:s.appeal,conservation:s.conservation,reputation:s.reputation,x:s.x,workers:s.workers,busyWorkers:s.busyWorkers,handCount:s.hand.length,goalCount:s.goals.length,played:s.played,buildings:s.buildings,actions:s.actions,partners:s.partners,universities:s.universities,supportedProjects:0,total:null};
  s.progress.mode='MULTIPLAYER';s.table={stage:'ACTION',activePlayerId:other,breakPosition:7,breakLimit:9,breakNumber:2,readyPlayerIds:[s.playerId,other],finalTurns:[other],winners:[],occupiedProjects:[],players:[player,{...player,playerId:other,handCount:3}]};return s;
}
test('Multiplayer overview names the active player, break distance, final turns and public opponent board',()=>{
  const s=state();const html=renderToStaticMarkup(createElement(ArkNovaMultiplayer,{state:s,players:[{playerId:s.playerId,nickname:'나'},{playerId:s.table!.activePlayerId,nickname:'친구'}],disabled:false,onCommand:()=>{}}));
  assert.match(html,/친구 · 행동 차례/);assert.match(html,/휴식까지 2칸/);assert.match(html,/마지막 차례: 친구/);assert.match(html,/MY ZOO/);
  for(const card of s.hand)assert.ok(!html.includes(card.cardId));
});
test('Multiplayer sponsor descriptions distinguish global triggers and other-player payments from solo',()=>{
  const card=(key:string)=>renderToStaticMarkup(createElement(ArkNovaMultiplayerContext.Provider,{value:true},createElement(ArkNovaCard,{card:{key,cardId:key}})));
  assert.match(card('236'),/어느 플레이어의 동물원에든/);assert.match(card('222'),/다른 모든 플레이어는 돈 2/);assert.doesNotMatch(card('222'),/솔로에는/);
  assert.match(card('009'),/오른쪽 플레이어보다/);assert.doesNotMatch(card('009'),/솔로에서는 이 카드/);
});
test('Project advice blocks foreign and player-count blocked slots before sending a command',()=>{
  const s=state(),id=s.baseProjects[0]!.cardId;
  s.table!.occupiedProjects=[{cardId:id,slot:0,playerId:null}];
  assert.ok(arkAssociationAdvice(s,{kind:'PROJECT',cardId:id,slot:0,bonus:'MONEY_12',animalId:null,housingId:null}).some(text=>text.includes('막힌 보상 칸')));
});
