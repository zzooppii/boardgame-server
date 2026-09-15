import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {safeParse} from 'valibot';
import {ARK_MAP_A,ArkSoloViewSchema,arkCardName} from '@hangul-rummikub/shared';
import {ArkNovaBoard} from '../features/ark-nova/ArkNovaBoard.js';
import {ArkNovaTable} from '../features/ark-nova/ArkNovaTable.js';
import {ArkNovaRewards} from '../features/ark-nova/ArkNovaRewards.js';
import {arkSoloSetupFixture} from '../features/ark-nova/test-fixture.js';

test('Ark live setup displays only projected owner cards and requires choosing four before start',()=>{
  assert.ok(safeParse(ArkSoloViewSchema,arkSoloSetupFixture).success);
  const html=renderToStaticMarkup(createElement(ArkNovaTable,{state:arkSoloSetupFixture,disabled:false,onCommand:()=>{},onCue:()=>{}}));
  for(const card of arkSoloSetupFixture.hand)assert.ok(html.includes(arkCardName(card.key)));
  assert.match(html,/선택한 0\/4장으로 시작/);
  assert.match(html,/<button disabled="">선택한 0\/4장으로 시작/);
  assert.doesNotMatch(html,/후원자 카드 사용|공개 카드 낚아채기|모금<\/button>/);
  assert.equal(Object.hasOwn(arkSoloSetupFixture,'zooDeck'),false);
  assert.ok(html.indexOf('시작 손패 선택')<html.indexOf('MY ZOO'));
  assert.equal((html.match(/시작 손패 선택/g)??[]).length,1);
});
test('Ark live board reflects server occupation and exposes a single keyboard entry point',()=>{
  const buildings=structuredClone(arkSoloSetupFixture.buildings);
  buildings[0]!.occupied=true;
  const before=structuredClone(buildings);
  const html=renderToStaticMarkup(createElement(ArkNovaBoard,{buildings,selected:null,disabled:false,onSelect:()=>{}}));
  assert.equal((html.match(/role="button"/g)??[]).length,ARK_MAP_A.length);
  assert.equal((html.match(/tabindex="0"/g)??[]).length,1);
  assert.match(html,/동물 입주/);assert.match(html,/terrain-atlas-v1.png/);
  assert.deepEqual(buildings,before);
});
test('Ark reward controls show worker alternative and only non-upgraded actions',()=>{
  const state=structuredClone(arkSoloSetupFixture);
  state.pending={kind:'REWARD',choiceId:'reward-choice'};
  state.rewards=[{id:'reward',kind:'UPGRADE_OR_WORKER',amount:1}];
  state.actions=state.actions.map(a=>({...a,upgraded:a.kind==='CARDS'}));
  const html=renderToStaticMarkup(createElement(ArkNovaRewards,{state,disabled:false,onCommand:()=>{}}));
  assert.match(html,/직원 받기/);assert.match(html,/건설 II/);assert.doesNotMatch(html,/>카드 II</);
  assert.match(html,/동물 II 조건이 있는 동물/);assert.match(html,/행동력의 2배/);assert.match(html,/제휴 동물원 보유 한도/);assert.match(html,/파충류관·대형 조류관/);assert.doesNotMatch(html,/평판 상한 9/);
});

test('Ark effect panel renders only published conservation rewards and offers the money alternative',async()=>{
  const {ArkNovaEffects}=await import('../features/ark-nova/ArkNovaEffects.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.activeEffect={id:1,kind:'CONSERVATION_BONUS',sourceId:'reward',guide:{resource:null,amount:null,actions:[],buildings:[],slots:[],mayRefill:false,bonuses:['X_3']}};
  const html=renderToStaticMarkup(createElement(ArkNovaEffects,{state,disabled:false,onSelect:()=>{},placement:null,cell:null,housingId:null,onUniqueCard:()=>{},onBuilding:()=>{},onRotate:()=>{},onReflect:()=>{}}));
  assert.match(html,/X 토큰 3/);assert.match(html,/돈 5 받기/);assert.doesNotMatch(html,/돈 10|대학/);
});
test('Ark reveal panel requires the prescribed keep count and filters Hunter to animals',async()=>{
  const {ArkNovaEffects}=await import('../features/ark-nova/ArkNovaEffects.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.activeEffect={id:1,kind:'HUNTER',sourceId:'hunter',guide:{resource:null,amount:2,actions:[],buildings:[],slots:[],mayRefill:false,bonuses:[]}};
  state.revealedCards={kind:'HUNTER',choiceId:'reveal',candidates:[{cardId:'animal',key:'401'},{cardId:'sponsor',key:'201'}],keep:1};
  const html=renderToStaticMarkup(createElement(ArkNovaEffects,{state,disabled:false,onSelect:()=>{},placement:null,cell:null,housingId:null,onUniqueCard:()=>{},onBuilding:()=>{},onRotate:()=>{},onReflect:()=>{}}));
  assert.match(html,/<button disabled="">선택 확정/);assert.ok(html.includes(arkCardName('401')));assert.ok(!html.includes(arkCardName('201')));
});

test('Ark board strips terrain and bonus metadata before producing a strict placement command',async()=>{
  const {arkBoardCellInput}=await import('../features/ark-nova/ArkNovaBoard.js');
  const {ArkPlacementSchema}=await import('@hangul-rummikub/shared');
  const cell=ARK_MAP_A[0]!;
  const placement={building:'ENCLOSURE_1',anchor:cell,rotation:0,reflected:false};
  assert.equal(safeParse(ArkPlacementSchema,placement).success,false);
  assert.equal(safeParse(ArkPlacementSchema,{...placement,anchor:arkBoardCellInput(cell)}).success,true);
});

test('Ark public display preserves six server slots when a card was taken before refill',async()=>{
  const {ArkNovaDisplay}=await import('../features/ark-nova/ArkNovaCards.js');
  const cards=[null,{cardId:'public-card',key:'401'},null,null,null,null];
  const html=renderToStaticMarkup(createElement(ArkNovaDisplay,{cards,selected:null,disabled:false,onSelect:()=>{}}));
  assert.equal((html.match(/aria-label="공개 카드 [1-6]번 칸"/g)??[]).length,6);
  assert.equal((html.match(/다음 보충을 기다리는 빈 칸/g)??[]).length,5);
  assert.match(html,/aria-label="공개 카드 2번 칸"[\s\S]*?치타/);
});

test('Ark effect choices distinguish resources before selection and explain dynamic amounts',async()=>{
  const {arkEffectSummary}=await import('../features/ark-nova/ArkNovaEffects.js');
  const guide={resource:'MONEY' as const,amount:5,actions:[],buildings:[],slots:[],mayRefill:false,bonuses:[]};
  assert.equal(arkEffectSummary('GAIN',guide),'돈 +5');
  assert.equal(arkEffectSummary('GAIN',{...guide,resource:'CONSERVATION',amount:2}),'보전 +2');
  assert.equal(arkEffectSummary('GAIN',{...guide,amount:null}),'돈 획득 · 효과 처리 시 계산');
  const state=structuredClone(arkSoloSetupFixture);
  state.pending={kind:'EFFECT',choiceId:'effects'};
  state.effectOptions=[{id:1,kind:'GAIN',sourceId:'first',guide},{id:2,kind:'GAIN',sourceId:'second',guide:{...guide,resource:'CONSERVATION',amount:2}}];
  const html=renderToStaticMarkup(createElement(ArkNovaTable,{state,disabled:false,onCommand:()=>{},onCue:()=>{}}));
  assert.match(html,/>돈 \+5<\/button>/);assert.match(html,/>보전 \+2<\/button>/);
});

test('Ark action controls follow extra and repeat modes without allowing an unrelated turn',async()=>{
  const {arkActionControls}=await import('../features/ark-nova/action-controls.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.extraAction={action:'BUILD',started:false,depth:1};
  assert.deepEqual(arkActionControls(state,'BUILD'),{regular:true,takeX:false});
  assert.deepEqual(arkActionControls(state,'CARDS'),{regular:false,takeX:false});
  state.extraAction={action:'TAKE_X',started:false,depth:1};
  assert.deepEqual(arkActionControls(state,'BUILD'),{regular:false,takeX:true});
  state.extraAction=null;
  state.repeatedAction={action:'CARDS',mode:'REGULAR',baseStrength:5,remaining:1,completed:1,awaiting:true};
  assert.deepEqual(arkActionControls(state,'CARDS'),{regular:true,takeX:false});
  assert.deepEqual(arkActionControls(state,'BUILD'),{regular:false,takeX:false});
  state.repeatedAction.mode='TAKE_X';
  assert.deepEqual(arkActionControls(state,'CARDS'),{regular:false,takeX:true});
  state.repeatedAction.awaiting=false;
  assert.deepEqual(arkActionControls(state,'CARDS'),{regular:false,takeX:false});
});

test('Ark construction hint identifies occupied cells and map boundaries without changing state',async()=>{
  const {arkBuildPlacementHint}=await import('../features/ark-nova/action-controls.js');
  const state=structuredClone(arkSoloSetupFixture),before=structuredClone(state);
  const placement={building:'ENCLOSURE_1',anchor:state.buildings[0]!.cells[0]!,rotation:0 as const,reflected:false};
  assert.equal(arkBuildPlacementHint(state,placement),'이미 건물이 있는 칸입니다.');
  assert.equal(arkBuildPlacementHint(state,{...placement,anchor:{q:99,r:99}}),'동물원 경계를 벗어났습니다.');
  assert.deepEqual(state,before);
});

test('Ark action strength includes X, constriction and the frozen repeat position',async()=>{
  const {arkDisplayedStrength}=await import('../features/ark-nova/action-controls.js');
  const state=structuredClone(arkSoloSetupFixture);state.x=2;
  const index=state.actions.findIndex(a=>a.kind==='ANIMALS');
  assert.equal(arkDisplayedStrength(state,'ANIMALS',1),index+2);
  state.actions[index]!.constriction=true;
  assert.equal(arkDisplayedStrength(state,'ANIMALS',1),index);
  state.repeatedAction={action:'ANIMALS',mode:'REGULAR',baseStrength:5,remaining:1,completed:1,awaiting:true};
  assert.equal(arkDisplayedStrength(state,'ANIMALS',2),5);
  assert.equal(arkDisplayedStrength(state,'ANIMALS',3),0);
});
test('Ark zoo selection explains exhausted actions, wrong cards, display upgrade and reputation limits',async()=>{
  const {arkZooSelectionHint}=await import('../features/ark-nova/action-controls.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.hand=[{cardId:'animal',key:'401'},{cardId:'sponsor',key:'230'}];
  state.display=[null,{cardId:'public-animal',key:'402'},null,null,null,null];
  state.zooWork={action:'ANIMALS',upgraded:false,remaining:1,playedCount:0,stage:'PLAYING'};
  assert.equal(arkZooSelectionHint(state,'animal'),null);
  assert.match(arkZooSelectionHint(state,'sponsor')!,/동물 카드/);
  assert.match(arkZooSelectionHint(state,'public-animal')!,/업그레이드/);
  state.zooWork.upgraded=true;state.reputation=1;
  assert.match(arkZooSelectionHint(state,'public-animal')!,/평판/);
  state.reputation=2;assert.equal(arkZooSelectionHint(state,'public-animal'),null);
  state.zooWork.remaining=0;assert.match(arkZooSelectionHint(state,'animal')!,/사용을 마쳤/);
  state.zooWork={action:'SPONSORS',upgraded:false,remaining:4,playedCount:1,stage:'PLAYING'};
  assert.match(arkZooSelectionHint(state,'sponsor')!,/사용을 마쳤/);
  state.zooWork.upgraded=true;state.zooWork.remaining=3;
  assert.match(arkZooSelectionHint(state,'sponsor')!,/후원 등급/);
  state.zooWork.remaining=4;assert.equal(arkZooSelectionHint(state,'sponsor'),null);
});

test('Ark live cards show all eleven solo replacements instead of multiplayer attack instructions',async()=>{
  const {ArkNovaCard}=await import('../features/ark-nova/ArkNovaCards.js');
  const {ARK_SOLO_ABILITIES}=await import('@hangul-rummikub/shared');
  assert.equal(Object.keys(ARK_SOLO_ABILITIES).length,11);
  for(const key of Object.keys(ARK_SOLO_ABILITIES)){
    const html=renderToStaticMarkup(createElement(ArkNovaCard,{card:{key,cardId:`card-${key}`}}));
    assert.match(html,/솔로 전용 효과/);assert.doesNotMatch(html,/독 토큰|대상|도둑질|최면|조이기/);
  }
  const {arkAbilityCopy}=await import('../features/ark-nova/card-copy.js');
  assert.match(arkAbilityCopy({key:'JUMPING',value:3,tag:''},true),/전진시키지 않습니다/);
});

test('Every base sponsor has visible rules prose including timing and end-game conditions',async()=>{
  const {ARK_CARDS}=await import('@hangul-rummikub/shared');
  const {ArkNovaCard}=await import('../features/ark-nova/ArkNovaCards.js');
  const {arkSponsorCopy}=await import('../features/ark-nova/sponsor-copy.js');
  const sponsors=ARK_CARDS.filter(c=>c.kind==='SPONSOR');
  assert.equal(sponsors.length,64);assert.deepEqual(Object.keys(arkSponsorCopy).sort(),sponsors.map(c=>c.key).sort());
  for(const card of sponsors){
    const lines=arkSponsorCopy[card.key]!;assert.ok(lines.length>0,card.key);
    const html=renderToStaticMarkup(createElement(ArkNovaCard,{card:{key:card.key,cardId:`sponsor-${card.key}`}}));
    for(const line of lines)assert.ok(html.includes(line),card.key);
  }
  assert.ok(arkSponsorCopy['203']!.some(s=>s.includes('대학 3개면 보전 1')));
  assert.ok(arkSponsorCopy['217']!.some(s=>s.includes('매력 5')));
  assert.ok(arkSponsorCopy['227']!.some(s=>s.includes('더 이상 사용할 수 없습니다')));
});

test('Ark goal descriptions explain what is counted, threshold awards and the excluded solo goal',async()=>{
  const {ARK_GOALS}=await import('@hangul-rummikub/shared');
  const {arkGoalCopy}=await import('../features/ark-nova/goal-copy.js');
  const copy=(key:string)=>arkGoalCopy(ARK_GOALS.find(g=>g.key===key)!).join(' ');
  for(const goal of ARK_GOALS)assert.ok(arkGoalCopy(goal).length>0);
  assert.match(copy('001'),/대형 동물 수/);assert.match(copy('002'),/체험 동물/);
  assert.match(copy('006'),/건설 II가 필요한 빈 칸/);assert.match(copy('006'),/6 \/ 12 \/ 18 \/ 24/);
  assert.match(copy('004'),/조건마다 보전 1/);assert.match(copy('009'),/다른 목표로 교체/);
  assert.match(copy('010'),/지도 바위 칸의 수가 아닙니다/);
});
test('Ark final result displays the authoritative total and per-card ledger without summing twice',async()=>{
  const {ArkNovaResult}=await import('../features/ark-nova/ArkNovaResult.js');
  const state=structuredClone(arkSoloSetupFixture);
  state.goals=[{cardId:'goal',key:'001'}];state.played=[{cardId:'engineer',key:'217'}];
  state.result={appeal:70,conservation:20,goalPoints:2,sponsorPoints:0,sponsorAppeal:5,total:6,won:true,details:[{cardId:'goal',conservation:2,appeal:0},{cardId:'engineer',conservation:0,appeal:5}]};
  const before=structuredClone(state);
  const html=renderToStaticMarkup(createElement(ArkNovaResult,{state}));
  assert.match(html,/>6점</);assert.match(html,/최종 매력 70/);assert.match(html,/최종 수치에 포함/);
  assert.match(html,/대형 동물원/);assert.match(html,/기술자/);assert.match(html,/보전 \+0 · 매력 \+5/);
  assert.deepEqual(state,before);
});

test('Ark project copy distinguishes release size, breeding partner conditions and reputation rewards',async()=>{
  const {ARK_PROJECTS}=await import('@hangul-rummikub/shared');
  const {arkProjectCopy,arkProjectSlotCopy}=await import('../features/ark-nova/project-copy.js');
  const release=ARK_PROJECTS.find(p=>p.key==='113')!,breed=ARK_PROJECTS.find(p=>p.key==='123')!;
  assert.match(arkProjectCopy(release),/인쇄된 기본 매력/);
  assert.match(arkProjectSlotCopy(release,0),/4·5칸 동물/);assert.match(arkProjectSlotCopy(release,2),/체험 동물/);
  assert.match(arkProjectCopy(breed),/제휴 동물원과 같은 대륙/);
  assert.match(arkProjectSlotCopy(breed,0),/보전 \+2 · 평판 \+2/);
  assert.doesNotMatch(arkProjectSlotCopy(breed,2),/평판/);
});

test('Ark reputation choices preserve holes and do not pull a later card into reach',async()=>{
  const {arkReachableDisplayCards}=await import('../features/ark-nova/action-controls.js');
  const state=structuredClone(arkSoloSetupFixture);state.reputation=2;
  state.display=[null,{cardId:'reachable',key:'201'},{cardId:'far',key:'205'},null,null,null];
  assert.deepEqual(arkReachableDisplayCards(state).map(c=>c.cardId),['reachable']);
  state.reputation=4;assert.deepEqual(arkReachableDisplayCards(state).map(c=>c.cardId),['reachable','far']);
});
test('Ark card rewards expose only reachable display cards and disable an empty deck',()=>{
  const state=structuredClone(arkSoloSetupFixture);state.reputation=1;state.deckCount=0;
  state.display=[{cardId:'near',key:'201'},{cardId:'far',key:'205'},null,null,null,null];
  state.pending={kind:'REWARD',choiceId:'pick'};state.rewards=[{id:'reward',kind:'CARD',amount:1}];
  const html=renderToStaticMarkup(createElement(ArkNovaRewards,{state,disabled:false,onCommand:()=>{}}));
  assert.ok(html.includes(arkCardName('201')));assert.ok(!html.includes(arkCardName('205')));
  assert.match(html,/<button disabled="">덱에서 가져오기/);
});

test('Animal advice explains exact payment, matching partner and physical housing without changing state',async()=>{
  const {arkAnimalSelectionAdvice}=await import('../features/ark-nova/action-controls.js');
  const s=structuredClone(arkSoloSetupFixture);s.hand=[{key:'404',cardId:'caracal'},{key:'461',cardId:'tarsier'}];s.money=5;
  const before=structuredClone(s),advice=arkAnimalSelectionAdvice(s,'caracal')!;
  assert.equal(advice.price,9);assert.match(advice.issues.join(' '),/돈 4 부족/);assert.ok(advice.housingIds.includes('initial-enclosure'));assert.deepEqual(s,before);
  s.partners=['Europe'];assert.match(arkAnimalSelectionAdvice(s,'tarsier')!.issues.join(' '),/같은 대륙/);
  s.partners=['Asia'];assert.doesNotMatch(arkAnimalSelectionAdvice(s,'tarsier')!.issues.join(' '),/같은 대륙/);
  s.played=[{cardId:'expert',key:'229'}];s.partners=['Africa'];s.money=3;
  assert.equal(arkAnimalSelectionAdvice(s,'caracal')!.price,3);assert.deepEqual(arkAnimalSelectionAdvice(s,'caracal')!.issues,[]);
  s.hand=[];s.display=[null,null,{key:'404',cardId:'market'},null,null,null];
  assert.equal(arkAnimalSelectionAdvice(s,'market')!.price,6);
});
test('Animal advice handles WAZA condition waiver, specialization and flock housing exceptions',async()=>{
  const {arkAnimalSelectionAdvice}=await import('../features/ark-nova/action-controls.js');
  const s=structuredClone(arkSoloSetupFixture);s.money=100;s.hand=[{key:'403',cardId:'leopard'},{key:'436',cardId:'bison'}];
  s.wazaFocus='SMALL';assert.ok(arkAnimalSelectionAdvice(s,'bison')!.issues.some(x=>x.includes('WAZA')));
  s.wazaFocus=null;s.played=[{key:'263',cardId:'waza'},{key:'426',cardId:'elephant'},{key:'230',cardId:'large'}];
  // Bison's three America requirements still exceed its one-condition waiver.
  assert.ok(arkAnimalSelectionAdvice(s,'bison')!.issues.some(x=>x.includes('부족한 조건')));
  assert.equal(arkAnimalSelectionAdvice(s,'bison')!.flock,false);
  s.hand.push({key:'438',cardId:'flock-reindeer'});
  assert.equal(arkAnimalSelectionAdvice(s,'flock-reindeer')!.flock,true);
  s.buildings.push({id:'large-empty',kind:'ENCLOSURE_5',cells:[{q:0,r:0},{q:0,r:1},{q:0,r:2},{q:1,r:0},{q:1,r:1}],occupied:false,used:0});
  s.played.push({key:'438',cardId:'reindeer'},{key:'439',cardId:'llama'});
  assert.equal(arkAnimalSelectionAdvice(s,'bison')!.issues.length,0);
});
test('Eligible enclosure is exposed accessibly and receives its visual highlight',()=>{
  const html=renderToStaticMarkup(createElement(ArkNovaBoard,{buildings:arkSoloSetupFixture.buildings,selected:null,eligibleHousingIds:['initial-enclosure'],onSelect:()=>{}}));
  assert.match(html,/3칸 우리, 입주 가능/);assert.match(html,/is-eligible-housing/);
});
test('Board exposes touch rotation and reflection only for an active preview and disables edits while waiting',()=>{
  const base={buildings:arkSoloSetupFixture.buildings,selected:{q:0,r:1},ghost:[{q:0,r:1}],onSelect:()=>{},onRotate:()=>{},onReflect:()=>{},onCancel:()=>{}};
  const html=renderToStaticMarkup(createElement(ArkNovaBoard,base));
  assert.match(html,/지도 확대/);assert.match(html,/배치 회전/);assert.match(html,/배치 반전/);assert.match(html,/선택: 1열 2칸/);
  const waiting=renderToStaticMarkup(createElement(ArkNovaBoard,{...base,disabled:true}));
  assert.match(waiting,/<button type="button" disabled="">배치 회전/);assert.match(waiting,/<button type="button" disabled="">선택 해제/);
  const idle=renderToStaticMarkup(createElement(ArkNovaBoard,{...base,ghost:[],selected:null}));
  assert.doesNotMatch(idle,/배치 회전/);assert.doesNotMatch(idle,/배치 반전/);assert.match(idle,/<button type="button" disabled="">선택 해제/);
  const unique=renderToStaticMarkup(createElement(ArkNovaBoard,{buildings:base.buildings,selected:base.selected,ghost:base.ghost,onSelect:base.onSelect,onRotate:base.onRotate}));assert.doesNotMatch(unique,/배치 반전/);
});
