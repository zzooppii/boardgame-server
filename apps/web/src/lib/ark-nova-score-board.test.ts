import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ArkSoloView} from '@hangul-rummikub/shared';
import {ArkNovaScoreBoard,ArkNovaScoreBoardDetail} from '../features/ark-nova/ArkNovaScoreBoard.js';
type State=Pick<ArkSoloView,'appeal'|'conservation'|'scoreBoard'|'result'>;
const initial:State={appeal:20,conservation:0,result:null,scoreBoard:{choices:[],appealIncome:Array.from({length:114},()=>5),targetAppeal:114,gap:-94,bonuses:[{track:5,tile:'X_3'},{track:8,tile:'MONEY_10'}],pendingMilestones:[]}};
const render=(s:State)=>renderToStaticMarkup(createElement(ArkNovaScoreBoardDetail,{state:s}));
test('Score board shows opposite markers, next milestone and public tiles before reaching them',()=>{
  const html=render(initial);assert.match(html,/교차까지 매력 94점 거리/);assert.match(html,/2점까지 보전 2점 필요/);
  assert.match(html,/남은 타일: X 토큰 3/);assert.match(html,/남은 타일: 돈 10/);
  assert.match(html,/← 매력/);assert.match(html,/보전 →/);assert.match(html,/6라운드 끝까지/);
});
test('Pending reward links to controls while reaching alone does not claim receipt',()=>{
  const html=render({...initial,conservation:8,scoreBoard:{choices:[],appealIncome:Array.from({length:114},()=>5),targetAppeal:98,gap:-78,bonuses:[],pendingMilestones:[5,8]}});
  assert.equal((html.match(/선택 대기/g)??[]).length,2);assert.equal((html.match(/href="#ark-current-action"/g)??[]).length,2);
  assert.match(html,/10점까지 보전 2점 필요/);assert.match(html,/도달 표시는 보상 수령 기록이 아닙니다/);
});
test('Crossing and server final score are explicitly distinct',()=>{
  const state:State={...initial,appeal:94,conservation:10,scoreBoard:{choices:[],appealIncome:Array.from({length:114},()=>5),targetAppeal:94,gap:0,bonuses:[],pendingMilestones:[]}};
  assert.match(render(state),/두 마커 교차/);
  assert.match(render({...state,result:{appeal:94,conservation:10,total:0,won:true,goalPoints:0,sponsorPoints:0,sponsorAppeal:0,details:[]}}),/최종 확정 0점/);
});
test('Older projection never invents a score or bonus tile',()=>{
  const html=render({appeal:20,conservation:0,result:null});assert.match(html,/점수판 상세 정보 연결 대기/);assert.doesNotMatch(html,/<svg/);
});
test('A server receipt identifies the selected money alternative without inferring tile ownership',()=>{
  const html=render({...initial,conservation:5,scoreBoard:{...initial.scoreBoard!,choices:[{track:5,choice:'MONEY_5'}]}});
  assert.match(html,/선택 완료/);assert.match(html,/선택한 보상: 돈 5/);assert.match(html,/남은 타일: X 토큰 3/);
});

test('Default score summary keeps the full board in a closed modal with an accessible trigger',()=>{
  const html=renderToStaticMarkup(createElement(ArkNovaScoreBoard,{state:initial}));
  const summary=html.split('<dialog')[0]!;
  assert.match(summary,/aria-haspopup="dialog"/);assert.match(summary,/aria-expanded="false"/);
  assert.match(summary,/전체 점수판 보기/);assert.match(summary,/교차까지 94점/);
  assert.doesNotMatch(summary,/<svg/);assert.doesNotMatch(html,/<dialog[^>]* open/);
  assert.match(html,/점수판 닫기/);
});

test('Both milestone tiles have separate pentagons and effect explanations with an exclusive money option',()=>{
  const html=render({...initial,scoreBoard:{...initial.scoreBoard!,bonuses:[{track:5,tile:'REPUTATION_2'},{track:5,tile:'X_3'},{track:8,tile:'CARDS_3'},{track:8,tile:'PAID_SPONSOR'}]}});
  assert.equal((html.match(/class="ark-bonus-token"/g)??[]).length,4);
  assert.equal((html.match(/class="ark-bonus-token is-money"/g)??[]).length,2);
  assert.match(html,/평판을 2 올립니다/);
  assert.match(html,/보유 한도는 5개/);
  assert.match(html,/덱 또는 평판 범위 안의 공개 카드/);
  assert.match(html,/후원 등급만큼 돈을 내고/);
  assert.match(html,/타일 하나 또는 돈 5 중 택1 · 추가 지급 없음/);
  assert.doesNotMatch(html,/>타일 \/ 돈 5</);
});
