import { ElementBadge } from '../features/spirit-island/ElementBadge.js';
import { SPIRIT_ELEMENTS, SPIRIT_ELEMENT_LABELS } from '@hangul-rummikub/shared';
import { SPIRIT_BRANCH_FEAR, SPIRIT_BRANCH_FEAR_KEYS } from '@hangul-rummikub/shared';
import { ravagePreview, spiritCardDraft } from '../features/spirit-island/presentation.js';
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

test('Branch & Claw development selection exposes ten spirits and all four expansion scenarios',()=>{
 const s=playing();s.game.stage='SELECT';s.game.playerStates[0]!.spirit=null;s.game.settings.expansion='BRANCH_CLAW';
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.equal((html.match(/이 정령 선택/g)??[]).length,10);assert.match(html,/si-art-FANGS/);assert.match(html,/si-art-KEEPER/);assert.match(html,/이벤트 25\/25장 개발 덱 · 확장 공포 15\/15장 · 확장 오염 7장 · 프랑스 0–6단계 · 확장 시나리오 4종/);
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
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const label of ['새로운 종의 확산','si-event-art','25 / 25장','토큰 이벤트','다한 이벤트','확정 전에는 소모되지 않습니다','이벤트 비용 충족도','1 더 필요'])assert.ok(html.includes(label),label);
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
 for(const key of ['ROOTS','NEW_LANDS','SURGE_INLAND','POPULATION'] as const){const s=playing();s.game.currentEvent=key;s.game.eventIslandState='HEALTHY';s.game.round=2;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/25 \/ 25장/);assert.match(html,/적용 분기 · 건강한 섬/);assert.doesNotMatch(html,/<p class="si-event-notice">이번 라운드.*체력 \+1<\/p>/);s.game.eventIslandState='BLIGHTED';assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/적용 분기 · 오염된 섬/);}
});
test('Normal Ravage event effects remain visible without a current event and preview per building',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.currentEvent=null;s.game.eventCityDamage=2;s.game.eventTownDamage=1;s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};l.pieces=[{id:'city',kind:'CITY',damage:0,strife:0},{id:'town',kind:'TOWN',damage:0,strife:0}];assert.equal(ravagePreview(s.game,l).attack,8);l.pieces[0]!.strife=1;assert.equal(ravagePreview(s.game,l).attack,3);let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/다음 정상 파괴까지 대기/);assert.match(html,/도시마다 피해 \+2/);assert.match(html,/마을마다 피해 \+1/);s.game.eventNormalRavageActive=true;html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/정상 파괴 적용 중/);
});
test('Industry event panels display branches and the temporary disease exception',()=>{
 for(const key of ['URBAN_DEVELOPMENT','HEAVY_FARMING'] as const){const s=playing();s.game.currentEvent=key;s.game.round=2;s.game.eventIslandState='BLIGHTED';s.game.eventLingeringPlagues=key==='URBAN_DEVELOPMENT';const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/25 \/ 25장/);assert.match(html,/적용 분기 · 오염된 섬/);if(key==='URBAN_DEVELOPMENT')assert.match(html,/이번 침략자 단계: 질병은 건설을 막지 않고 소모되지 않습니다/);}
});
test('Terror event panels preserve applied branch and display exploration and crowd effects',()=>{
 const s=playing();s.game.currentEvent='DISTANT_EXPLORATION';s.game.eventTerrorLevel=1;s.game.terror=3;s.game.eventDistantExplore=true;s.game.round=2;let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/적용 시 공포 1수준 · 먼 곳의 탐험/);assert.match(html,/이번 라운드 탐험: 마을·도시·바다에서 거리 2까지/);s.game.currentEvent='CULTURAL_ASSIMILATION';s.game.eventTerrorLevel=2;html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/적용 시 공포 2수준 · 문화적 동화/);s.game.eventTerrorLevel=3;assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/적용 시 공포 3수준 · 다한을 향한 보복/);
});
test('Fearful Mobs preview counts all invaders including strife but excludes Dahan',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.eventFearfulMobs=true;l.pieces=[{id:'one',kind:'EXPLORER',damage:0,strife:1},{id:'two',kind:'EXPLORER',damage:0,strife:1},{id:'three',kind:'DAHAN',damage:0,strife:0}];assert.equal(ravagePreview(s.game,l).attack,0);l.pieces[2]!.kind='EXPLORER';l.pieces[2]!.strife=1;assert.equal(ravagePreview(s.game,l).attack,3);
});
test('Missionaries shows Sun support and no nonexistent Dahan subevent; Rising Interest shows Air support',()=>{
 const s=playing();s.game.currentEvent='MISSIONARIES';s.game.round=2;s.game.eventPayment={cost:4,element:'SUN',energy:0,support:0,remaining:4,contributions:[]};let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/선교사의 도착/);assert.match(html,/함께 모으는 지원 · 태양/);assert.doesNotMatch(html,/<b>다한 이벤트<\/b>/);s.game.currentEvent='RISING_INTEREST';s.game.eventPayment.element='AIR';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/섬에 쏠리는 관심/);assert.match(html,/함께 모으는 지원 · 바람/);assert.match(html,/<b>다한 이벤트<\/b>/);
});
test('Farmers conversion stays visible after the card clears and replaces map damage warning',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.currentEvent=null;s.game.eventRavageToBuild=true;s.game.eventCityDamage=3;s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};l.pieces=[{id:'city',kind:'CITY',damage:0,strife:0}];const p=ravagePreview(s.game,l);assert.equal(p.convertsToBuild,true);assert.equal(p.blight,false);assert.equal(p.damage,0);const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/다음 정상 파괴 → 건설/);assert.match(html,/파괴 대신 건설/);assert.match(html,/대기 중인 파괴 피해 증가는 소모되지 않습니다/);
});
test('Farmers card displays building-only health loss and no payment or Dahan subevent',()=>{
 const s=playing();s.game.currentEvent='FARMERS';s.game.round=2;s.game.lands[0]!.eventBuildingHealthLoss=true;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/다한에게 도움을 청하는 농부들/);assert.match(html,/마을·도시 체력 −1/);assert.doesNotMatch(html,/<b>다한 이벤트<\/b>/);assert.doesNotMatch(html,/함께 모으는 지원/);
});

test('Farmland UI distinguishes exploration choice from extra Ravage and its later defense',()=>{
 const s=playing();s.game.currentEvent='FARMLAND';s.game.round=2;s.game.eventIslandState='HEALTHY';let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/25 \/ 25장/);assert.match(html,/탐험 단계에서 지역 선택/);assert.match(html,/si-art-KEEPER/);s.game.eventIslandState='BLIGHTED';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/적용 분기 · 오염된 섬 · 새 환금 작물의 정착/);assert.match(html,/추가 파괴를 끝낸 뒤 적용/);assert.doesNotMatch(html,/탐험 단계에서 지역 선택/);
});

test('Investigation UI shows terror branch, immediate Slow use and current-presence damage preview',()=>{
 const s=playing();s.game.currentEvent='INVESTIGATION';s.game.round=2;s.game.eventTerrorLevel=2;s.game.eventUnnatural=true;const l=s.game.lands[0]!;l.pieces=[{id:'explorer',kind:'EXPLORER',damage:0,strife:0}];l.presence=[{playerId:s.game.privateState.playerId,count:1}];assert.equal(ravagePreview(s.game,l).attack,4);l.presence=[];assert.equal(ravagePreview(s.game,l).attack,1);const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/25 \/ 25장/);assert.match(html,/부자연스러운 것을 파괴하라/);assert.match(html,/느린 능력 하나를 지금/);assert.match(html,/현신이 있는 지역마다 피해 \+3/);
});

test('Outpaced panel explains individual costs, lost elements, delayed use and disease exception',()=>{
 const s=playing();s.game.currentEvent='OUTPACED';s.game.round=2;s.game.eventLingeringPlagues=true;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['25 / 25장','뒤처진 정령들','자기 에너지 3','원소를 잃습니다','정령끼리 비용을 대신','느린 단계','서로 다른 지역','질병은 건설을 막지 않고 소모되지 않습니다'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/함께 모으는 지원/);
});

test('Madness panel shows the dynamic animal cost, reversible beast plan and ordered follow-up effects',()=>{
 const s=playing();s.game.currentEvent='MADNESS';s.game.round=2;s.game.eventPayment={cost:6,element:'ANIMAL',support:2,energy:1,remaining:3,contributions:[{playerId:s.game.privateState.playerId,support:2,energy:1}]};const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['25 / 25장','si-art-FANGS','야수들 사이의 기이한 광기','야수 제거를 계획하면 비용이 갱신','최소 3','야수도 비용 확정 전에는 제거되지','필요 6','3 더 필요','남은 야수마다','그 세 토큰이 모두 없는'])assert.ok(html.includes(text),text);
});

test('Sacred sites panel explains reversible regional plans and renders zero cost safely',()=>{
 const s=playing();s.game.currentEvent='SACRED_SITES';s.game.round=2;s.game.eventPayment={cost:0,element:'FIRE',support:0,energy:0,remaining:0,contributions:[]};const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['25 / 25장','si-art-EARTH','위협받는 성소','지역마다 피해 또는 현신 희생을 계획','피해 지역마다 비용 3','필요 0','확정 가능','다한 합계가 4개'])assert.ok(html.includes(text),text);assert.match(html,/max="1"/);
});

test('War panel explains energy-only payment, major damage and face-down fear insertion',()=>{
 const s=playing();s.game.currentEvent='WAR';s.game.round=2;s.game.eventPayment={cost:2,element:null,support:0,energy:1,remaining:1,contributions:[]};const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['25 / 25장','si-art-OCEAN','섬의 해안에 닥친 전쟁','주요 능력 1장','방어는 양쪽에 적용','함께 모으는 지원 · 에너지만','원소·카드는 지원에 사용할 수 없습니다','뒷면으로 추가','1 더 필요'])assert.ok(html.includes(text),text);
});

test('Branch fear preview displays illustrations and current level without revealing hidden cards',()=>{
 const s=playing();s.game.terror=2;s.game.revealedFear=Object.values(SPIRIT_BRANCH_FEAR).map((c,i)=>({position:i+1,name:c.name,effects:[...c.effects]}));const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['미리 공개된 공포 카드','실제 해결 시점의 수준','공포 2 · 현재 수준','si-art-FANGS',...Object.values(SPIRIT_BRANCH_FEAR).map(c=>c.name)])assert.ok(html.includes(text),text);assert.equal(SPIRIT_BRANCH_FEAR_KEYS.length,15);s.game.revealedFear=[];assert.ok(!renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})).includes('미리 공개된 공포 카드'));
});

test('Tread Carefully shows a separate ravage skip and suppresses blight risk without blocking converted builds',()=>{
 const s=playing(),l=s.game.lands[0]!;l.pieces=[{id:'town',kind:'TOWN',damage:0,strife:0}];l.ravageSkip=true;s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};assert.equal(ravagePreview(s.game,l).blocked,true);assert.equal(ravagePreview(s.game,l).blight,false);assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/파괴 생략/);assert.equal(l.skip,false);s.game.eventRavageToBuild=true;assert.equal(ravagePreview(s.game,l).blocked,false);assert.equal(ravagePreview(s.game,l).convertsToBuild,true);
});

test('Quarantine shows dynamic disease blocking and current level notices',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.quarantineCoast=true;s.game.quarantineDisease=true;l.tokens.disease=1;l.pieces=[{id:'town',kind:'TOWN',damage:0,strife:0}];s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};assert.equal(ravagePreview(s.game,l).blocked,true);assert.equal(ravagePreview(s.game,l).blight,false);const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/격리 · 행동 생략/);assert.match(html,/해안 탐험 생략/);assert.ok(!html.includes('질병 지역은 탐험 출발지 제외'));s.game.eventRavageToBuild=true;assert.equal(ravagePreview(s.game,l).convertsToBuild,false);s.game.eventRavageToBuild=false;l.tokens.disease=0;assert.equal(ravagePreview(s.game,l).blocked,false);s.game.quarantineDisease=false;s.game.quarantineSource=true;assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/질병 지역은 탐험 출발지 제외/);
});

test('Strife health loss explains immediate destruction in the game view',()=>{const s=playing();s.game.lands[0]!.strifeHealthLoss=2;assert.match(renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s})),/분쟁으로 침략자 체력 감소/);});

test('Fear track displays all invader cards in order and pending delays',()=>{
 const s=playing();s.game.build={stage:1,terrains:['MOUNTAIN'],coastal:false};s.game.buildExtra=[{stage:3,terrains:['JUNGLE','WETLAND'],coastal:false}];s.game.fearInvaderNotices=['이주 둔화 · 건설 카드 1번은 건설 칸에 남습니다','3라운드 침략자 단계 · 탐험 카드 1장 추가'];s.game.fearBeasts=2;
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['건설 · 2장 순서대로','1. ','2. ','공포로 바뀐 침략자 진행',...s.game.fearInvaderNotices,'야수 공포 · 야수 지역의 정상 건설·탐험 생략'])assert.ok(html.includes(text),text);
});
test('Ravage preview includes additional cards and dynamic beast skip without blocking converted build',()=>{
 const s=playing(),l=s.game.lands[0]!;s.game.ravage={stage:1,terrains:['JUNGLE'],coastal:false};s.game.ravageExtra=[{stage:1,terrains:[l.terrain],coastal:false}];l.pieces=[{id:'city',kind:'CITY',damage:0,strife:0}];assert.equal(ravagePreview(s.game,l).active,true);s.game.fearBeasts=3;l.tokens.beasts=1;assert.equal(ravagePreview(s.game,l).blocked,true);assert.equal(ravagePreview(s.game,l).blight,false);s.game.eventRavageToBuild=true;assert.equal(ravagePreview(s.game,l).convertsToBuild,false);s.game.ravage={stage:1,terrains:[l.terrain],coastal:false};assert.equal(ravagePreview(s.game,l).convertsToBuild,true);s.game.eventRavageToBuild=false;l.tokens.beasts=0;assert.equal(ravagePreview(s.game,l).blocked,false);
});

test('Blight batch UI: seven card names and instructions; healthy identity hidden',async()=>{
 const {SPIRIT_BLIGHT,spiritBlightKeys}=await import('@hangul-rummikub/shared');
 for(const key of spiritBlightKeys('BRANCH_CLAW').slice(2)){
  const s=playing();s.game.blighted=true;s.game.blightCard=key;s.game.settings.blightCard=true;const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/오염된 섬 카드/);assert.ok(html.includes(SPIRIT_BLIGHT[key].name));assert.ok(html.includes(SPIRIT_BLIGHT[key].help));
 }
 const s=playing();const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.ok(!html.includes('오염된 섬 카드'));
});
test('Lesser UI: candidate effects, assigned card and usable power visible without counting as played',()=>{
 const s=playing(),power=SPIRIT_POWERS.find(p=>p.deck==='MINOR')!,card={cardId:'lesser',key:power.key};s.game.blighted=true;s.game.blightCard='LESSER';s.game.lesserOffer=[card];let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/배정할 보조 능력/);assert.ok(html.includes(power.description));
 s.game.lesserOffer=[];s.game.playerStates[0]!.lesserPower=card;s.game.stage=power.speed;s.game.privateState.powerOptions=[{cardId:card.cardId,key:card.key,fast:power.speed==='FAST',slow:power.speed==='SLOW',targets:['A1'],shadowTargets:[],repeat:false,thresholdMax:1}];html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/매 라운드 무료/);assert.ok(html.includes(power.title));assert.ok(spiritProjectionIsConsistent(s.game));s.game.playerStates[0]!.hand.push(card);assert.equal(spiritProjectionIsConsistent(s.game),false);
});
test('Blight reveal and aid assignment use existing blight and card sound cues',()=>{
 const before=playing().game,after=structuredClone(before);after.gameRevision=parse(SpiritPlayingPlatformSnapshotV2Schema,{...playing(),game:{...after,gameRevision:1}}).game.gameRevision;after.blighted=true;after.blightCard='LESSER';after.log=[{id:1,kind:'BLIGHT',text:'오염 카드 공개',landId:null,playerId:null},{id:2,kind:'CARD',text:'작은 정령 능력 배정',landId:null,playerId:null}];assert.deepEqual(spiritTransitionCues(before,after),['BLIGHT','CARD']);
});

test('France UI: core hides France while expansion setup and live supply explain cumulative rules',()=>{
 const s=playing();s.game.stage='SELECT';s.game.playerStates[0]!.spirit=null;
 let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.ok(!html.includes('value="FRANCE"'));
 s.game.settings.expansion='BRANCH_CLAW';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/value="FRANCE"/);assert.match(html,/프랑스 0–6단계/);
 s.game.stage='PREPARE';s.game.playerStates[0]!.spirit='RIVER';s.game.settings.adversary='FRANCE';s.game.settings.level=6;s.game.franceTownSupply=2;s.game.franceBlight=1;s.game.rebellionIn=4;
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));for(const text of ['프랑스 대적 진행','2 / 7','1 / 3','이벤트 4장째 예정','모두 사용한 뒤 추가로 놓으려 하면 패배','공포의 탐험가 제거는 밀기로 변경'])assert.ok(html.includes(text),text);
});
test('Slave Rebellion UI: stage II still uses early branch and Dahan precedes recurrence',()=>{
 const s=playing();s.game.settings.expansion='BRANCH_CLAW';s.game.currentEvent='REBELLION';s.game.round=2;s.game.eventInvaderStage=2;
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/공개 시 침략 2단계/);assert.ok(html.indexOf('다한 이벤트')<html.indexOf('다음 이벤트'));assert.ok(!html.includes('<b>토큰 이벤트</b>'));
});

for(const scenario of ['WARD','FLAME','FORGOTTEN','SECOND_WAVE'] as const)test(`Scenario UI: ${scenario} exposes its own controls and instructions`,()=>{
 const s=playing();s.game.settings.expansion='BRANCH_CLAW';s.game.settings.scenario=scenario;
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/시나리오 진행/);assert.match(html,scenario==='WARD'?/수호 능력으로 뒤집을 카드/:scenario==='FLAME'?/망각할 불 원소 카드/:scenario==='FORGOTTEN'?/침략자 2개/:/1번째 물결/);
});
test('Scenario UI: wards and flames are labeled on the map and ward defense appears in preview',()=>{
 const s=playing();s.game.wards=['A1','A1'];s.game.flames=['A2'];assert.equal(ravagePreview(s.game,s.game.lands[0]!).defend,6);
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/aria-label="수호 표식"/);assert.match(html,/aria-label="불꽃 표식"/);
});

for(const transition of ['TIME_TO_PREPARE','FORGET','EVENT_DISCARD','SECOND_WAVE'] as const)test(`Spirit UI stale card selection: ${transition} renders only current cards`,()=>{
 const snapshot=playing(),g=snapshot.game,p=g.playerStates[0]!,card=p.hand[0]!;
 p.hand=p.hand.filter(c=>c.cardId!==card.cardId);p.played=[card];
 const requested=[card.cardId];assert.ok(spiritCardDraft(g,[...p.hand,...p.played],requested,null).cost>0);
 // Server update arrives while React still holds the previous local draft.
 p.played=[];if(transition==='FORGET')p.discard=[];else p.discard=[card];
 if(transition==='TIME_TO_PREPARE'){g.round++;g.stage='PREPARE';p.grown=false;}
 if(transition==='SECOND_WAVE'){g.waveNumber=2;g.stage='SELECT';p.hand=[];p.spirit=null;}
 const draft=spiritCardDraft(g,[...p.hand,...p.played],requested,card.cardId);
 assert.deepEqual(draft,{ids:[],ward:null,cost:0});
 g.privateState.hand=p.hand;assert.doesNotThrow(()=>renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot})));
});
test('Spirit UI draft keeps surviving cards and resets a removed ward before an effect runs',()=>{
 const g=playing().game,p=g.playerStates[0]!,a=p.hand[0]!,b=p.hand[1]!;g.settings.scenario='WARD';
 assert.deepEqual(spiritCardDraft(g,p.hand,[a.cardId,b.cardId],a.cardId),{ids:[a.cardId,b.cardId],ward:a.cardId,cost:SPIRIT_POWERS.find(c=>c.key===b.key)!.cost});
 assert.deepEqual(spiritCardDraft(g,[b],[a.cardId,b.cardId,b.cardId],a.cardId),{ids:[b.cardId],ward:null,cost:SPIRIT_POWERS.find(c=>c.key===b.key)!.cost});
});

 test('Spirit cards identify their deck independently of cost and speed in a mixed hand', () => {
 const s = playing();
 const powers = ['RIVER', 'MINOR', 'MAJOR'].map(deck => {
 const power = SPIRIT_POWERS.find(p => p.deck === deck);
 assert.ok(power);
 return power;
 });
 const hand = powers.map(p => ({cardId: p.key, key: p.key}));
 s.game.playerStates[0]!.hand = hand;
 s.game.privateState.hand = hand;
 const html = renderToStaticMarkup(createElement(SpiritScreen, {...handlers, snapshot:s}));
 for (const [kind,label] of [['unique','고유 능력'],['minor','보조 능력'],['major','주요 능력']]) {
 assert.ok(html.includes(`si-card-kind-${kind}">${label}</span>`));
 }
 });

test('Spirit help is available beside invite in lobby and play without replacing the board', () => {
 for (const snapshot of [lobby(), playing()]) {
 const html = renderToStaticMarkup(createElement(SpiritScreen, {...handlers, snapshot}));
 assert.match(html, /초대 링크<\/button><button type="button" aria-haspopup="dialog">게임 방법<\/button>/);
 assert.match(html, /<dialog class="si-help" aria-labelledby="si-help-title">/);
 assert.doesNotMatch(html, /<dialog[^>]*\sopen(?:[\s=>])/);
 for (const title of ['오염은 언제 생기고, 무엇이 나쁜가요?', '오염을 없애거나 예방하는 법', '침략자를 없애거나 행동을 막는 법', '승리와 패배']) assert.ok(html.includes(title), title);
 assert.match(html, /게임 방법 닫기/);
 if (snapshot.game) assert.match(html, /class="si-land si-terrain-/);
 }
});

test('Spirit map renders the assigned solo board instead of assuming A',()=>{
 for(const board of ['B','C','D'] as const){
  const s=playing();s.game.playerStates[0]!.board=board;
  const links=spiritBoardLinks([board]);
  s.game.lands=s.game.lands.map(l=>({...l,id:`${board}${l.number}`,board,terrain:SPIRIT_BOARD_DATA[board].terrains[l.number-1]!,adjacent:links.flatMap(([a,b])=>a===`${board}${l.number}`?[b]:b===`${board}${l.number}`?[a]:[])}));
  const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
  assert.ok(html.includes(`aria-label="${board} 섬 구역"`));assert.ok(!html.includes('aria-label="A 섬 구역"'));
  assert.equal((html.match(/class="si-land si-terrain-/g)??[]).length,8);
 }
});

test('Spirit elements always expose names, counts and distinct SVG shapes without hovering',()=>{
 const icons=new Set<string>();
 for(const element of SPIRIT_ELEMENTS){
  const html=renderToStaticMarkup(createElement(ElementBadge,{element,count:2}));
  assert.ok(html.includes(`aria-label="${SPIRIT_ELEMENT_LABELS[element]} 2개"`));
  assert.ok(html.includes(`class="si-element-name">${SPIRIT_ELEMENT_LABELS[element]}</span>`));
  assert.match(html,/class="si-element-count">2<\/b>/);
  icons.add(html.match(/<svg.*?<\/svg>/)![0]);
  const card=renderToStaticMarkup(createElement(ElementBadge,{element}));assert.ok(!card.includes('si-element-count'));
 }
 assert.equal(icons.size,8);
 const s=playing();s.game.playerStates[0]!.elements=['SUN','EARTH','EARTH','PLANT'];
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/aria-label="땅 2개"/);assert.match(html,/aria-label="물 0개"/);
 assert.match(html,/si-element-empty/);
});

test('Growth exposes readable hand and discard cards before choosing growth, then reflects reclaim', () => {
 const s=playing(),p=s.game.playerStates[0]!;
 p.grown=false;
 const used=p.hand.splice(0,2);p.discard=used;s.game.privateState.hand=p.hand;
 let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 const inventory=html.slice(html.indexOf('<details class="si-card-inventory"'),html.indexOf('<div class="si-growth">'));
 assert.match(inventory,/open=""/);
 assert.match(inventory,/손패 2장 · 회수 대기 2장 · 이번 라운드 0장/);
 for(const card of [...p.hand,...used]) {
  const power=SPIRIT_POWERS.find(c=>c.key===card.key)!;
  assert.ok(inventory.includes(power.title));assert.ok(inventory.includes(power.description));
 }
 assert.equal((inventory.match(/<article /g)??[]).length,4);
 assert.doesNotMatch(inventory,/<button/);
 assert.match(inventory,/회수 효과로 손에 가져와야/);
 p.hand.push(...p.discard);p.discard=[];p.grown=true;
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/손패 4장 · 회수 대기 0장/);
 assert.match(html,/회수 대기 중인 카드가 없습니다/);
 assert.doesNotMatch(html,/<details class="si-card-inventory" open/);
 assert.match(html,/카드 준비 확정/);
});

test('Card reference separates resolved and waiting played cards and remains available in invader stages', () => {
 const s=playing(),p=s.game.playerStates[0]!;
 p.played=p.hand.splice(0,2);p.resolved=[p.played[0]!.cardId];s.game.privateState.hand=p.hand;s.game.stage='RAVAGE';
 let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/손패 2장 · 회수 대기 0장 · 이번 라운드 2장/);
 assert.match(html,/능력 사용 완료/);assert.match(html,/능력 사용 대기/);
 p.discard.push(...p.played);p.played=[];p.resolved=[];p.grown=false;s.game.stage='PREPARE';
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/손패 2장 · 회수 대기 2장 · 이번 라운드 0장/);
 p.discard.push(...p.hand);p.hand=[];s.game.privateState.hand=[];
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/손에 남은 카드가 없습니다/);
});

test('Pending effect name and rule are visible above the map and in the confirmation panel', () => {
 const s=playing();s.game.stage='FEAR';
 const title='빨라지는 이주 · 공포 1 · 각자 해안에서 탐험가 1개 제거.';
 s.game.pending={choiceId:'fear-choice',playerId:s.self.playerId,title,options:[{id:'o0',label:'A2',landId:'A2',pieceId:null}]};
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 const notice=html.indexOf('aria-label="현재 해결 중인 효과"');
 assert.ok(notice>=0&&notice<html.indexOf('class="si-table-layout"'));
 assert.ok(html.slice(notice,html.indexOf('class="si-table-layout"')).includes(title));
 assert.ok(html.slice(html.indexOf('id="si-current-choice"')).includes(title));
 assert.match(html,/선택지 확인 ↓/);
});

test('Fear progress explains actual threshold, earned cards after reset, and phase timing', () => {
 const s=playing(),render=()=>renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 s.game.fear=3;s.game.log=[{id:1,kind:'FEAR',text:'공포 +3',playerId:s.self.playerId,landId:null}];
 let html=render();assert.match(html,/공포 <b>1개<\/b> 더 모으면/);assert.match(html,/최근 공포 기록/);assert.match(html,/공포 \+3/);
 assert.match(html,/aria-label="다음 공포 카드까지 모은 공포" max="4" value="3"/);
 s.game.fear=0;s.game.earnedFearCount=1;html=render();assert.match(html,/해결 대기 <strong>1장/);assert.match(html,/이번 라운드.*공포 단계/);assert.match(html,/공포 수치가 0으로 돌아가도/);
 s.game.stage='SLOW';html=render();assert.match(html,/다음 라운드.*공포 단계/);
 s.game.stage='FEAR';html=render();assert.match(html,/현재 해결 중인 카드는 대기 장수에서 빠집니다/);
 s.game.fearPool=10;s.game.fear=6;html=render();assert.match(html,/공포 <b>4개<\/b> 더 모으면/);
 s.game.settings.scenario='RITUAL';html=render();assert.match(html,/공포 카드 효과를 실행하지 않습니다/);assert.doesNotMatch(html,/class="si-fear-timing"/);
});

test('Preparation shows carried balance, income separately, and paid-card budget without charging twice', () => {
 const s=playing(),p=s.game.playerStates[0]!;p.energy=7;p.grown=false;s.game.round=2;
 let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/현재 보유 에너지 · 이월분 포함<\/span><strong>7/);
 assert.match(html,/현재 트랙 수입 · 라운드당/);assert.match(html,/쓰지 않은 에너지는 다음 라운드에도 남습니다/);
 assert.doesNotMatch(html,/이 선택 확정 후 잔액/);
 const paid=p.hand.find(c=>SPIRIT_POWERS.find(power=>power.key===c.key)!.cost>0)!;
 p.hand=p.hand.filter(c=>c!==paid);p.played=[paid];s.game.privateState.hand=p.hand;p.grown=true;
 const paidCost=SPIRIT_POWERS.find(power=>power.key===paid.key)!.cost;
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.ok(html.includes(`카드 준비에 쓸 수 있는 에너지</dt><dd>${7+paidCost}`));
 assert.match(html,/이 선택 확정 후 잔액<\/dt><dd>7/);
 assert.match(html,/수입을 다시 더하지 않습니다/);
 s.game.stage='FAST';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.doesNotMatch(html,/aria-label="성장과 준비 에너지 안내"/);
});

test('Resolved automatic fear remains explained even with no queued cards', () => {
 const s=playing();s.game.stage='RAVAGE';s.game.earnedFearCount=0;
 s.game.log=[{id:1,kind:'FEAR',text:'방어 +2 적용 완료 · A5 · 이번 라운드',playerId:s.self.playerId,landId:null},{id:2,kind:'FEAR',text:'해결 완료 · 2라운드 · 공포 카드 믿음이 뿌리내리다 · 공포 수준 1 · 현신이 있는 모든 지역에 방어 2.',playerId:s.self.playerId,landId:null}];
 const html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 assert.match(html,/aria-label="최근 공포 카드 효과"/);assert.match(html,/현신이 있는 모든 지역에 방어 2/);assert.match(html,/방어 \+2 적용 완료 · A5/);assert.match(html,/해결 대기 0장은 남은 카드가 없다는 뜻/);
});

test('Invader board separates ordered actions, public terrain, hidden exploration and next-round tracks', () => {
 const s=playing();s.game.ravage=null;s.game.build={stage:1,terrains:['WETLAND'],coastal:false};
 let html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));
 const board=html.slice(html.indexOf('aria-label="침략자 보드"'),html.indexOf('id="si-fear-status"'));
 assert.ok(board.indexOf('1. 약탈 (파괴)')<board.indexOf('2. 건설'));assert.ok(board.indexOf('2. 건설')<board.indexOf('3. 탐험'));
 assert.match(board,/카드 없음/);assert.match(board,/이 칸의 기본 행동은 없습니다/);assert.match(board,/습지/);assert.match(board,/A2 · A5/);assert.match(board,/미공개/);assert.match(board,/탐험할 때 공개/);
 s.game.stage='BUILD';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/aria-label="건설" aria-current="step"/);
 s.game.stage='SLOW';html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/카드 이동 완료 · 다음 라운드 대비/);
 s.game.explore={stage:2,terrains:[],coastal:true};s.game.pending={choiceId:'choice',playerId:s.self.playerId,title:'심화 효과 선택',options:[]};
 html=renderToStaticMarkup(createElement(SpiritScreen,{...handlers,snapshot:s}));assert.match(html,/선택 효과 처리 중 · 현재 카드 배치/);assert.doesNotMatch(html,/카드 이동 완료/);assert.match(html,/<strong>해안<\/strong>/);
});
