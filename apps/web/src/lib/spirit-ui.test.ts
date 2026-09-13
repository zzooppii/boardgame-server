import { ravagePreview } from '../features/spirit-island/presentation.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse, safeParse } from 'valibot';
import { SpiritLobbyPlatformSnapshotV2Schema, SpiritPlayingPlatformSnapshotV2Schema, SPIRIT_BOARD_DATA, SPIRIT_POWERS, spiritBoardLinks, spiritProjectionIsConsistent, SpiritActionSchema } from '@hangul-rummikub/shared';
import { SpiritScreen } from '../features/spirit-island/SpiritScreen.js';
import { spiritTransitionCues } from '../features/spirit-island/sound.js';
const players = [{ playerId: 'a', nickname: '강', isHost: true, connectionStatus: 'CONNECTED' }];
function lobby() { return parse(SpiritLobbyPlatformSnapshotV2Schema, { snapshotVersion: 2, versions: { roomRevision: 1, presenceVersion: 1 }, serverTime: 1000, self: { playerId: 'a' }, room: { roomId: 'spirit-room', roomCode: 'ABCDEF', gameType: 'SPIRIT_ISLAND', phase: 'LOBBY', players }, game: null }); }
function playing() { const s = lobby(), cards = SPIRIT_POWERS.filter(c => c.deck === 'RIVER').map(c => ({ cardId: c.key, key: c.key })), links = spiritBoardLinks(1); return parse(SpiritPlayingPlatformSnapshotV2Schema, { ...s, room: { ...s.room, phase: 'PLAYING' }, game: { gameType: 'SPIRIT_ISLAND', rulesVersion: 'spirit-island-core-v2', gameId: 'game', gameRevision: 0, phase: 'PLAYING', turnId: 'turn', stage: 'PREPARE', round: 1, lands: SPIRIT_BOARD_DATA.A.terrains.map((terrain, i) => { const id = `A${i + 1}`; return { id, board: 'A', number: i + 1, terrain, coastal: i < 3, adjacent: links.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []), pieces: [], presence: i === 4 ? [{ playerId: 'a', count: 1 }] : [], blight: i === 3 ? 1 : 0, defend: 0, skip: false, protectDahan: false, vitality: false, dahanHealth: 0 }; }), playerStates: [{ playerId: 'a', spirit: 'RIVER', board: 'A', energy: 2, energyTrack: 0, cardTrack: 0, destroyedPresence: 0, grown: true, ready: false, hand: cards, played: [], discard: [], resolved: [], elements: [], fastRemaining: 0, repeatRemaining: 0 }], fear: 0, fearPool: 4, terror: 1, fearDeckCount: 9, earnedFearCount: 0, blightPool: 6, ravage: null, build: null, explore: null, invaderDeckCount: 11, pending: null, plans: [], log: [], privateState: { playerId: 'a', hand: cards, powerOptions: [] } } }); }
const handlers = { connected: true, pending: false, error: null, connectionLabel: '연결됨', async onCommand() { }, onRematch() { }, onStart() { }, onLeave() { }, onCopy() { } };
test('Spirit UI: illustrated lobby, solo start, accessible sound, map and cards', () => { const welcome = renderToStaticMarkup(createElement(SpiritScreen, { ...handlers, snapshot: lobby() })); assert.match(welcome, /섬으로 들어가기/); assert.match(welcome, /효과음 음량/); assert.match(welcome, /1–4인/); const s = playing(), html = renderToStaticMarkup(createElement(SpiritScreen, { ...handlers, snapshot: s })); assert.ok(spiritProjectionIsConsistent(s.game)); assert.equal((html.match(/class="si-land si-terrain-/g) ?? []).length, 8); assert.match(html, /강의 풍요/); assert.match(html, /카드 준비 확정/); assert.match(html, /aria-pressed="false"/); assert.match(html, /si-panel-portrait/); assert.match(html, /prefers-reduced-motion|진행 방법과 이번 버전 안내/); });
test('Spirit sounds deduplicate revisions and establish silent initial/reconnect baseline', () => { const a = playing().game, b = structuredClone(a); b.gameRevision = parse(SpiritPlayingPlatformSnapshotV2Schema, { ...playing(), game: { ...b, gameRevision: 1 } }).game.gameRevision; b.log = [{ id: 1, kind: 'DAMAGE', text: '피해', playerId: a.privateState.playerId, landId: 'A1' }]; assert.deepEqual(spiritTransitionCues(null, b), []); assert.deepEqual(spiritTransitionCues(a, b), ['DAMAGE']); assert.deepEqual(spiritTransitionCues(b, b), []); assert.deepEqual(spiritTransitionCues(b, a), []); });
test('Spirit contracts reject unrecognized fields and mismatched self hand', () => { assert.equal(safeParse(SpiritActionSchema, { kind: 'GROW', option: 0, energy: 99 }).success, false); assert.equal(safeParse(SpiritActionSchema, { kind: 'USE_POWER', cardId: 'x', target: 'A1', threshold: 99, fast: true, repeat: false, shadowReach: false }).success, false); const s = playing(); assert.equal(safeParse(SpiritPlayingPlatformSnapshotV2Schema, { ...s, game: { ...s.game, privateState: { ...s.game.privateState, hand: [] } } }).success, false); });

test('Core spirit selection exposes eight spirits and challenge settings',()=>{const s=playing();s.game.stage='SELECT';s.game.playerStates[0]!.spirit=null;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.equal((html.match(/이 정령 선택/g)??[]).length,8);for(const label of ['대적 단계','시나리오','꿈과 악몽을 가져오는 자','굶주린 바다의 손아귀'])assert.ok(html.includes(label));});
test('Ocean tracks show upcoming permanent elements and scenario objective',()=>{const s=playing();s.game.playerStates[0]!.spirit='OCEAN';s.game.settings.scenario='INSURRECTION';s.game.terror=2;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/건물 수 ≤ 다한 수/);assert.match(html,/모든 지역에서 충족하면 승리/);assert.match(html,/해안을 집어삼키다/);assert.match(html,/<small>물<\/small>/);});

test('Branch & Claw development selection exposes ten spirits and clearly states missing content',()=>{
 const s=playing();s.game.stage='SELECT';s.game.playerStates[0]!.spirit=null;s.game.settings.expansion='BRANCH_CLAW';
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.equal((html.match(/이 정령 선택/g)??[]).length,10);assert.match(html,/si-art-FANGS/);assert.match(html,/si-art-KEEPER/);assert.match(html,/이벤트 14\/25장 개발 덱 · 나머지 확장 카드 미포함/);
});
test('Branch & Claw map shows token counts and growth distinguishes selected options and costs',()=>{
 const s=playing(),p=s.game.playerStates[0]!;s.game.settings.expansion='BRANCH_CLAW';p.spirit='FANGS';p.grown=false;p.growthSelections=[3];p.canCallPredators=true;
 s.game.lands[0]!.tokens={beasts:2,wilds:1,disease:1};s.game.lands[0]!.pieces=[{id:'invader',kind:'CITY',damage:0,strife:2}];
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 for(const text of ['야수 2','질병 1','야생 1','si-island-token-strife','선택 완료','현신을 영구 제거','거리 제한 없음'])assert.ok(html.includes(text),text);
 assert.match(html,/서로 다른 성장 2개 선택/);
});
test('Branch minor card UI exposes terrain restrictions and expansion progress',()=>{
 const s=playing();s.game.settings.expansion='BRANCH_CLAW';s.game.stage='SELECT';s.game.playerStates[0]!.spirit=null;
 const settings=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(settings,/보조 능력 31장/);assert.match(settings,/주요 능력/);
 s.game.stage='PREPARE';s.game.playerStates[0]!.spirit='RIVER';const card={cardId:'fleshrot',key:'fleshrot-fever'};s.game.playerStates[0]!.hand=[card];s.game.privateState.hand=[card];
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/살을 썩히는 열병/);assert.match(html,/대상: 밀림\/모래/);assert.match(html,/질병 1개 추가/);
});
test('Sunk boards disappear with an accessible notice and a nonrepeating sound',()=>{
 const before=playing(),after=structuredClone(before);after.game.destroyedBoards=['A'];after.game.lands=[];after.game.gameRevision++;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:after}));assert.match(html,/바다 아래로 가라앉은 섬: A/);assert.doesNotMatch(html,/aria-label="A 섬 구역"/);assert.deepEqual(spiritTransitionCues(before.game,after.game),['SINK']);assert.deepEqual(spiritTransitionCues(after.game,after.game),[]);
});
test('Branch majors show source terrain and distinct two-land range',()=>{
 const s=playing(),cards=SPIRIT_POWERS.filter(c=>['fire-and-flood','pyroclastic-flow'].includes(c.key)).map(c=>({key:c.key,cardId:c.key}));s.game.playerStates[0]!.hand=cards;s.game.privateState.hand=cards;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/사거리 1 · 2 · 성소에서/);assert.match(html,/산에서/);
});
test('Power acquisition choices display illustrated cards and instructions without a map target',()=>{
 const s=playing(),c=SPIRIT_POWERS.find(c=>c.key==='bloodwrack-plague')!;s.game.pending={choiceId:'pick-major',playerId:s.game.privateState.playerId,title:'획득할 능력 카드 선택',options:[{id:'o0',label:c.title,landId:null,pieceId:null}]};const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/아래 카드나 효과를 고른 뒤/);assert.match(html,/피를 끓이는 역병/);assert.match(html,/si-options[^]*si-card-art si-power-art/);
});

test('Event panel exposes illustrated ordered effects, preview limits and team contribution progress',()=>{
 const s=playing();s.game.currentEvent='NEW_SPECIES';s.game.round=2;s.game.eventPayment={cost:4,element:'MOON',energy:1,support:2,remaining:1,contributions:[{playerId:s.self.playerId,energy:1,support:2}]};
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const label of ['새로운 종의 확산','si-event-art','14 / 25장','토큰 이벤트','다한 이벤트','확정 전에는 소모되지 않습니다','이벤트 비용 충족도','1 더 필요'])assert.ok(html.includes(label),label);
});
test('Event reveal has a distinct cue, without replaying on the same revision',()=>{
 const s=playing();const next=parse(SpiritPlayingPlatformSnapshotV2Schema,{...s,game:{...s.game,gameRevision:1,currentEvent:'LITTLE_RAIN',log:[{id:1,kind:'EVENT',text:'공개',playerId:null,landId:null}]}}).game;
 assert.deepEqual(spiritTransitionCues(s.game,next),['EVENT']);assert.deepEqual(spiritTransitionCues(next,next),[]);
});

test('Stage event UI displays frozen branch and pending invader effects',()=>{
 const s=playing();s.game.currentEvent='STRANGE_TALES';s.game.round=2;s.game.eventInvaderStage=2;s.game.eventAfterAdvance='FORTIFICATION';
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['낯선 섬의 소문','공개 시 침략 2단계','요새화','침략 카드 전진 후','표시되지 않은 지형에서 추가 건설'])assert.ok(html.includes(text),text);
});
test('Stage event UI announces exploration, ravage bonus and conditional skips',()=>{
 const s=playing();s.game.currentEvent='RECONNAISSANCE';s.game.eventInvaderStage=1;s.game.eventExploreBonus=true;s.game.eventRavageBonus=1;s.game.eventStricken=true;
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['정찰의 물결','지역마다 +1','탐험가 +1','질병·분쟁 지역은 파괴 생략'])assert.ok(html.includes(text),text);
});
test('Ravage preview reflects event damage and Stricken without marking buildings skipped',()=>{
 const s=playing(),l=s.game.lands[0]!;l.pieces=[{id:'town',kind:'TOWN',damage:0,strife:0}];l.defend=1;s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};assert.equal(ravagePreview(s.game,l).blight,false);s.game.eventRavageBonus=1;assert.equal(ravagePreview(s.game,l).blight,true);l.tokens.disease=1;s.game.eventStricken=true;assert.equal(ravagePreview(s.game,l).blocked,true);assert.equal(ravagePreview(s.game,l).blight,false);assert.equal(l.skip,false);
});

test('Island event panel shows the resolved branch even when island state later changes',()=>{
 const s=playing();s.game.currentEvent='WELL_PREPARED';s.game.round=2;s.game.eventIslandState='HEALTHY';s.game.blighted=true;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/적용 분기 · 건강한 섬/);assert.match(html,/탐험가.*체력 \+1/);assert.match(html,/si-art-RIVER/);s.game.eventIslandState='BLIGHTED';const changed=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(changed,/적용 분기 · 오염된 섬/);assert.doesNotMatch(changed,/<p class="si-event-notice">이번 라운드 탐험가 체력 \+1<\/p>/);
});
test('Settlement event panels show branch and instructions without an unrelated health bonus',()=>{
 for(const key of ['ROOTS','NEW_LANDS','SURGE_INLAND','POPULATION'] as const){const s=playing();s.game.currentEvent=key;s.game.eventIslandState='HEALTHY';s.game.round=2;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/14 \/ 25장/);assert.match(html,/적용 분기 · 건강한 섬/);assert.doesNotMatch(html,/<p class="si-event-notice">이번 라운드.*체력 \+1<\/p>/);s.game.eventIslandState='BLIGHTED';assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/적용 분기 · 오염된 섬/);}
});
test('Normal Ravage event effects remain visible without a current event and preview per building',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.currentEvent=null;s.game.eventCityDamage=2;s.game.eventTownDamage=1;s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};l.pieces=[{id:'city',kind:'CITY',damage:0,strife:0},{id:'town',kind:'TOWN',damage:0,strife:0}];assert.equal(ravagePreview(s.game,l).attack,8);l.pieces[0]!.strife=1;assert.equal(ravagePreview(s.game,l).attack,3);let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/다음 정상 파괴까지 대기/);assert.match(html,/도시마다 피해 \+2/);assert.match(html,/마을마다 피해 \+1/);s.game.eventNormalRavageActive=true;html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/정상 파괴 적용 중/);
});
test('Industry event panels display branches and the temporary disease exception',()=>{
 for(const key of ['URBAN_DEVELOPMENT','HEAVY_FARMING'] as const){const s=playing();s.game.currentEvent=key;s.game.round=2;s.game.eventIslandState='BLIGHTED';s.game.eventLingeringPlagues=key==='URBAN_DEVELOPMENT';const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/14 \/ 25장/);assert.match(html,/적용 분기 · 오염된 섬/);if(key==='URBAN_DEVELOPMENT')assert.match(html,/이번 침략자 단계: 질병은 건설을 막지 않고 소모되지 않습니다/);}
});
