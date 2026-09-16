import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,ARNAK_CARDS,arnakCard,arnakResources,ArnakPlayingProjectionSchema,type ArnakOffer} from '@hangul-rummikub/shared';
import {createArnakGame,applyArnakAction,arnakOffers,parseArnakState,type ArnakState} from './games/arnak/domain/game.js';
import {projectArnak} from './games/arnak/compatibility/projector.js';
let serial=0;
function rng(seed:number){return {nextInt(max:number){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;}};}
const now=v.parse(ServerTimeSchema,1000),random=rng(42);
function create(n=2,seed=42){return createArnakGame({generateTileId:()=>v.parse(TileIdSchema,'arnak-card-'+(++serial)),gameId:v.parse(GameIdSchema,'arnak-game'),playerIds:Array.from({length:n},(_,i)=>v.parse(PlayerIdSchema,'arnak-player-'+i)),now,turnId:v.parse(TurnIdSchema,'arnak-turn-0'),random:rng(seed)});}
function act(s:ArnakState,predicate:(o:ArnakOffer)=>boolean){const offer=arnakOffers(s,s.activePlayerId).find(predicate);assert.ok(offer,'Expected legal offer');const next=applyArnakAction(s,s.activePlayerId,{type:'TAKE',actionId:offer.id},now,v.parse(TurnIdSchema,'arnak-turn-'+(++serial)),random);assert.ok(next.ok);return next.state;}
function settle(s:ArnakState){for(let i=0;s.jobs.length&&i<100;i++)s=act(s,o=>o.kind==='EFFECT'||o.kind==='PASS');assert.equal(s.jobs.length,0);return s;}
function give(s:ArnakState,id:string){const p=s.players.find(p=>p.playerId===s.activePlayerId)!;for(const source of [s.itemDeck,s.artifactDeck,s.market]){const i=source.findIndex(c=>c.definitionId===id);if(i>=0){p.hand.push(...source.splice(i,1));p.handCount=p.hand.length;return;}}throw new Error('Card missing');}
test('Arnak base catalog and 2–4 player setup have conserved opaque cards, correct sites, blocking and private projection',()=>{
 assert.equal(ARNAK_CARDS.filter(c=>c.type==='item').length,40);assert.equal(ARNAK_CARDS.filter(c=>c.type==='artifact').length,35);
 for(const n of [2,3,4]){const s=create(n);assert.equal(s.sites.length,17);assert.equal(s.sites.reduce((a,b)=>a+b.blocked.filter(Boolean).length,0),n===2?5:n===3?3:0);assert.equal(s.market.length,6);assert.equal(s.inventory.length,94+n*4);for(const p of s.players){assert.equal(p.hand.length,5);assert.equal(p.deck.length,1);const g=projectArnak({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:null,state:s},p.playerId);assert.ok(g);v.parse(ArnakPlayingProjectionSchema,g);const wire=JSON.stringify(g);for(const other of s.players.filter(o=>o!==p))for(const card of [...other.hand,...other.deck])assert.equal(wire.includes(JSON.stringify(card.tileId)),false);assert.equal(wire.includes(JSON.stringify(s.itemDeck[0]!.tileId)),false);}}
});
test('Arnak rejects forged offers and out-of-turn commands without mutations',()=>{const s=create(),before=structuredClone(s);assert.deepEqual(applyArnakAction(s,s.players[1]!.playerId,{type:'TAKE',actionId:'action-0'},now,s.transitionId,random),{ok:false,reason:'NOT_YOUR_TURN'});assert.equal(applyArnakAction(s,s.activePlayerId,{type:'TAKE',actionId:'forged'},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);const corrupt=structuredClone(s);corrupt.players[0]!.hand.push(corrupt.players[0]!.hand[0]!);assert.throws(()=>parseArnakState(corrupt));});
test('Arnak free cards produce resources, digging spends a card and a worker, only one main action',()=>{let s=create();const p=s.players[0]!,card=p.hand.find(c=>c.definitionId.startsWith('funding'));assert.ok(card);s=act(s,o=>o.kind==='CARD'&&o.targetId===card.tileId);assert.equal(s.mainActionUsed,false);s=settle(s);assert.equal(s.players[0]!.resources.coin,3);const hand=s.players[0]!.hand.length;s=act(s,o=>o.kind==='DIG'&&o.targetId==='base-0'&&o.cards.length===1);s=settle(s);assert.equal(s.players[0]!.resources.coin,5);assert.equal(s.players[0]!.hand.length,hand-1);assert.equal(s.players[0]!.workers,1);assert.equal(arnakOffers(s,s.activePlayerId).some(o=>o.kind==='DIG'),false);s=act(s,o=>o.kind==='END');assert.notEqual(s.activePlayerId,p.playerId);});
test('Arnak pass card is an alternative, not a bonus on an already-used card',()=>{let s=create();give(s,'0108');s=act(s,o=>o.kind==='CARD'&&o.label.includes('패스 보상'));s=settle(s);assert.equal(s.stage,'CLEANUP');assert.equal(s.players[0]!.resources.coin,5);});
test('Arnak notebook cannot overtake magnifier and research obtains assistants',()=>{let s=create();s.players[0]!.resources=arnakResources({coin:20,compass:20,tablet:20,arrow:20,jewel:20});assert.equal(arnakOffers(s,s.activePlayerId).some(o=>o.label.startsWith('수첩')),false);s=act(s,o=>o.kind==='RESEARCH'&&o.targetId==='1L');s=settle(s);s.mainActionUsed=false;s=act(s,o=>o.label.startsWith('수첩')&&o.targetId==='1L');s=settle(s);assert.equal(s.players[0]!.assistants.length,1);});
test('Arnak each base card can be used and its pending selections resolve without corrupting inventory',()=>{for(const card of ARNAK_CARDS.filter(c=>c.type==='item'||c.type==='artifact')){let s=create();give(s,card.id);s.players[0]!.resources=arnakResources({coin:30,compass:30,tablet:30,arrow:30,jewel:30});const c=s.players[0]!.hand.find(c=>c.definitionId===card.id)!;s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);try{s=settle(s);parseArnakState(s);}catch(error){throw new Error(card.name+' '+String(error));}}});
test('Arnak seeded complete games terminate after five rounds and preserve every physical card',()=>{for(const n of [2,3,4])for(let seed=1;seed<=4;seed++){let s=create(n,seed);const r=rng(seed),types=new Set<string>();for(let steps=0;s.phase==='PLAYING'&&steps<1600;steps++){const all=arnakOffers(s,s.activePlayerId);assert.ok(all.length,'No deadlock');let candidates=all.filter(o=>s.jobs.length?o.kind==='EFFECT'||o.kind==='PASS':s.stage==='CLEANUP'?o.kind==='PASS':o.kind==='CARD'||o.kind==='DIG'||o.kind==='DISCOVER'||o.kind==='RESEARCH'||o.kind==='GUARDIAN'||o.kind==='BUY'||o.kind==='END');if(!candidates.length)candidates=all.filter(o=>o.kind==='PASS');const choice=candidates[r.nextInt(candidates.length)]!;types.add(choice.kind);s=act(s,o=>o.id===choice.id);}assert.equal(s.phase,'FINISHED');assert.equal(s.round,5);assert.equal(s.result?.scores.length,n);assert.ok(types.has('DIG'));}});
test('Arnak private peek choices never publish the selected hidden card in public history',()=>{let s=create();give(s,'0214');s.players[0]!.resources.tablet=1;const source=s.players[0]!.hand.find(c=>c.definitionId==='0214')!;s=act(s,o=>o.kind==='CARD'&&o.targetId===source.tileId);s=act(s,o=>o.kind==='EFFECT'&&o.label==='카드 1장 확인');assert.equal(s.peek.length,1);const hidden=s.peek[0]!;const other=s.players[1]!;const wire=JSON.stringify(projectArnak({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:null,state:s},other.playerId));assert.equal(wire.includes(JSON.stringify(hidden.tileId)),false);s=act(s,o=>o.targetId===hidden.tileId);assert.equal(s.history.at(-1)!.text,'확인한 카드의 배치를 마쳤습니다');});

test('Arnak market refills only at turn end, on the outer edge of the matching deck', () => {
 let s=create();s.round=2;s.players[0]!.resources=arnakResources({coin:20,compass:20});
 const second=s.artifactDeck.shift()!;s.market.unshift(second);s.exiled.push(s.market.pop()!);
 const item=s.market.find(c=>arnakCard(c.definitionId).type==='item')!;
 s=act(s,o=>o.kind==='BUY'&&o.targetId===item.tileId);
 assert.equal(s.market.some(c=>c.tileId===item.tileId),false);
 assert.equal(s.market.length,5,'Buying must leave one empty slot until the turn ends');
 const nextItem=s.itemDeck[0]!;s=act(s,o=>o.kind==='END');
 assert.equal(s.market.at(-1)!.tileId,nextItem.tileId);
 // A shortage of artifacts must not be replaced with extra items.
 s.exiled.push(...s.artifactDeck.splice(0),...s.market.filter(c=>arnakCard(c.definitionId).type==='artifact'));
 s.market=s.market.filter(c=>arnakCard(c.definitionId).type==='item');s.mainActionUsed=true;
 s=act(s,o=>o.kind==='END');assert.equal(s.market.length,4);
});

test('Arnak a purchased artifact leaves its slot empty throughout nested effects', () => {
 let s=create();const artifact=s.market.find(c=>arnakCard(c.definitionId).type==='artifact')!;
 s.players[0]!.resources=arnakResources({coin:20,compass:20});const top=s.artifactDeck[0]!;
 s=act(s,o=>o.kind==='BUY'&&o.targetId===artifact.tileId);
 assert.equal(s.market.some(c=>c.tileId===top.tileId),false);
 s=settle(s);s=act(s,o=>o.kind==='END');assert.equal(s.market[0]!.tileId,top.tileId);
});

test('Arnak research discount artifacts buy temple tiles and never turn notebook research into a temple tile', () => {
 for(const id of ['0224','0233']){let s=create();give(s,id);const p=s.players[0]!;
 p.magnifier='8';s.templeArrival=[p.playerId];p.resources=arnakResources({tablet:1});
 const card=p.hand.find(c=>c.definitionId===id)!;s=act(s,o=>o.kind==='CARD'&&o.targetId===card.tileId);
 s=act(s,o=>o.kind==='RESEARCH'&&o.targetId==='temple'&&o.cost.jewel===0);
 assert.equal(s.players[0]!.templePoints,2);assert.equal(s.templeSupply[1],1);assert.equal(s.players[0]!.resources.tablet,0);}
 let s=create();give(s,'0101');s.players[0]!.magnifier='8';s.templeArrival=[s.activePlayerId];
 const card=s.players[0]!.hand.find(c=>c.definitionId==='0101')!;s=act(s,o=>o.kind==='CARD'&&o.targetId===card.tileId);
 assert.equal(arnakOffers(s,s.activePlayerId).some(o=>o.targetId==='temple'),false);
});

test('Arnak projections hide every assistant below each supply stack top', () => {
 const s=create();for(const p of s.players){const g=projectArnak({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:null,state:s},p.playerId)!;
 assert.deepEqual(g.assistantSupply,s.assistantSupply.map(stack=>stack.slice(0,1)));
 for(const id of s.assistantSupply.flatMap(stack=>stack.slice(1)))assert.equal(JSON.stringify(g).includes('"'+id+'"'),false);}
});

test('Arnak round cleanup keeps the selected hand, draws purchased items first and refreshes assistants', () => {
 let s=create();const p=s.players[0]!,kept=p.hand[0]!;give(s,'0116');
 const purchased=p.hand.pop()!;p.deck.push(purchased);p.handCount=p.hand.length;p.deckCount=p.deck.length;
 const assistant=s.assistantSupply[0]!.shift()!;p.assistants.push({definitionId:assistant,gold:true,ready:false});
 s=act(s,o=>o.kind==='PASS');s=act(s,o=>o.kind==='KEEP'&&o.targetId===kept.tileId);s=act(s,o=>o.kind==='PASS');
 s=act(s,o=>o.kind==='PASS');s=act(s,o=>o.kind==='PASS');
 assert.equal(s.round,2);assert.equal(s.startingPlayerId,s.players[1]!.playerId);
 assert.equal(s.players[0]!.hand[0]!.tileId,kept.tileId);
 assert.equal(s.players[0]!.hand[2]!.tileId,purchased.tileId);
 assert.equal(s.players[0]!.assistants[0]!.ready,true);
 assert.equal(s.players[0]!.hand.length,5);assert.equal(s.players[0]!.played.length,0);
});

test('Arnak final round applies guardian fear before scoring and leaves unused guardian boons worth five points', () => {
 let s=create();s.round=5;const p=s.players[0]!,site=s.sites[5]!;
 site.definitionId=s.siteDeck1.shift()!;site.guardianId=s.guardianDeck.shift()!;site.occupants[0]=p.playerId;p.workers=1;
 p.guardians.push({definitionId:s.guardianDeck.shift()!,used:false});const initialFear=[...p.hand,...p.deck,...p.played].filter(c=>c.definitionId==='fear').length;
 for(let i=0;i<4;i++)s=act(s,o=>o.kind==='PASS');
 assert.equal(s.phase,'FINISHED');const score=s.result!.scores.find(row=>row.playerId===p.playerId)!;
 assert.equal(score.fear,initialFear+1);assert.equal(score.guardians,5);
 assert.equal(s.players[0]!.workers,2);assert.equal(s.sites[5]!.occupants[0],null);
 assert.equal(score.total,score.research+score.temple+score.guardians+score.idols+score.slots+score.cards-score.fear);
});

import { ARNAK_GUARDIANS } from '@hangul-rummikub/shared';
for(const compasses of [3,6])test(`Arnak navigator and giant toad boats combine but level II still needs six compasses (${compasses})`,()=>{
 let s=create();const p=s.players[0]!;
 const stack=s.assistantSupply.find(ids=>ids.includes('assistant-8'))!;stack.splice(stack.indexOf('assistant-8'),1);
 p.assistants.push({definitionId:'assistant-8',gold:false,ready:true});
 const toad=ARNAK_GUARDIANS.find(g=>g.name==='거대 두꺼비')!;
 s.guardianDeck.splice(s.guardianDeck.indexOf(toad.id),1);p.guardians.push({definitionId:toad.id,used:false});
 p.resources=arnakResources({compass:compasses});
 s=act(s,o=>o.kind==='ASSISTANT'&&o.targetId==='assistant-8');
 s=act(s,o=>o.kind==='EFFECT'&&o.label==='이동 수단');
 s=act(s,o=>o.kind==='BOON'&&o.targetId===toad.id);
 assert.deepEqual(s.players[0]!.travel,['boat','boat']);assert.equal(s.mainActionUsed,false);
 const discover=arnakOffers(s,s.activePlayerId).find(o=>o.kind==='DISCOVER'&&o.targetId==='region-2-2'&&o.cards.length===0&&o.cost.coin===0);
 assert.equal(Boolean(discover),compasses===6);
 if(compasses===6){
  s=act(s,o=>o.id===discover!.id);assert.equal(s.players[0]!.resources.compass,0);assert.deepEqual(s.players[0]!.travel,[]);assert.equal(s.players[0]!.workers,1);
 }else{
  s=act(s,o=>o.kind==='PASS');s=act(s,o=>o.kind==='PASS');assert.deepEqual(s.players[0]!.travel,[]);
 }
});

import { arnakActionHints } from './games/arnak/domain/action-hints.js';
import { arnakPayments } from './games/arnak/domain/game.js';
test('Arnak action hints explain resources, workers, occupancy, research path, main action and turn without mutating state',()=>{
 const s=create(),p=s.players[0]!;
 p.resources=arnakResources({compass:3,jewel:2});p.travel=['boat','boat'];
 const hints=()=>arnakActionHints(s,p.playerId,arnakOffers(s,p.playerId));
 const reasons=(target:string,label:string)=>hints().find(h=>h.targetId===target&&h.label===label)?.reasons??[];
 const before=structuredClone(s);
 assert.ok(reasons('region-2-2','발견').includes('나침반 3개 부족'));
 assert.deepEqual(s,before);
 p.magnifier='1R';assert.ok(reasons('2L','돋보기').some(r=>r.includes('연결된 바로 윗칸')));
 assert.ok(reasons('2R','돋보기').includes('석판 1개 부족'));
 p.workers=0;assert.ok(reasons('region-2-2','발견').includes('남은 탐험가가 없습니다.'));
 s.sites.find(site=>site.id==='region-2-2')!.occupants[0]=s.players[1]!.playerId;
 assert.ok(reasons('region-2-2','발견').includes('배치할 수 있는 빈칸이 없습니다.'));
 s.mainActionUsed=true;assert.deepEqual(reasons('region-2-2','발견'),['이번 차례 주 행동을 이미 사용했습니다.']);
 s.activePlayerId=s.players[1]!.playerId;assert.deepEqual(reasons('region-2-2','발견'),['내 차례가 아닙니다.']);
});
test('Arnak acquired travel projection is viewer scoped and offer payment metadata matches consumed stock',()=>{
 let s=create();const actor=s.players[0]!.playerId;
 s.players[0]!.resources=arnakResources({compass:6});s.players[0]!.travel=['boat','boat'];
 const project=(viewer:typeof actor)=>projectArnak({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:null,state:s},viewer)!;
 assert.deepEqual(project(actor).privateState.travel,['boat','boat']);
 assert.deepEqual(project(s.players[1]!.playerId).privateState.travel,[]);
 assert.equal('travel' in project(s.players[1]!.playerId).playerStates[0]!,false);
 const offer=arnakOffers(s,actor).find(o=>o.kind==='DISCOVER'&&o.targetId==='region-2-2'&&!o.cards.length&&!o.cost.coin)!;
 assert.deepEqual(offer.travelUsed,['boat','boat']);
 assert.equal(project(actor).privateState.blockedActions?.some(h=>h.targetId===offer.targetId&&h.label==='발견'),false);
 s=act(s,o=>o.id===offer.id);assert.deepEqual(project(actor).privateState.travel,[]);
});
test('Arnak travel metadata distinguishes acquired icons from card icons and coin substitutions',()=>{
 const p=create().players[0]!;p.travel=['boat'];p.resources=arnakResources({coin:2});
 const choices=arnakPayments(p,['boat']);
 assert.ok(choices.some(c=>c.cards.length===0&&c.coins===0&&c.travelUsed?.join()==='boat'));
 assert.ok(choices.some(c=>c.cards.length===0&&c.coins===2&&c.travelUsed?.length===0&&c.remaining.includes('boat')));
 assert.ok(choices.some(c=>c.cards.length===1&&c.travelUsed?.length===0&&c.remaining.includes('boat')));
});
test('Arnak pending effects do not report misleading ordinary action costs and spent abilities explain readiness',()=>{
 let s=create();const p=s.players[0]!;
 const stack=s.assistantSupply.find(ids=>ids.includes('assistant-8'))!;stack.splice(stack.indexOf('assistant-8'),1);
 p.assistants.push({definitionId:'assistant-8',ready:true,gold:false});
 s=act(s,o=>o.kind==='ASSISTANT'&&o.targetId==='assistant-8');
 const hints=arnakActionHints(s,p.playerId,arnakOffers(s,p.playerId));
 assert.deepEqual(hints.find(h=>h.targetId==='region-2-2')!.reasons,['진행 중인 효과 선택을 먼저 마치세요.']);
 assert.match(hints.find(h=>h.targetId==='assistant-8')!.reasons.join(),/다시 준비/);
});
