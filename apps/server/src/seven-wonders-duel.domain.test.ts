import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,duelCard,DUEL_CONSPIRACIES,DUEL_GODS,DUEL_BASE_CARDS,type DuelSettings} from '@hangul-rummikub/shared';
import {createDuelGame,applyDuelAction,parseDuelState,type DuelState} from './games/seven-wonders-duel/domain/game.js';
import {task,type DuelSeat} from './games/seven-wonders-duel/domain/state.js';
import {choices,decisionActor,available} from './games/seven-wonders-duel/domain/choices.js';
import {quote,science,scores} from './games/seven-wonders-duel/domain/economy.js';
import {projectDuel} from './games/seven-wonders-duel/compatibility/projector.js';
let serial=0;const now=parse(ServerTimeSchema,1000),random={nextInt:(n:number)=>(++serial*73)%n};
function fixture(settings:Omit<DuelSettings,'turnDurationSeconds'>&Partial<Pick<DuelSettings,'turnDurationSeconds'>>={pantheon:true,agora:true},seed=1){return createDuelGame({generateTileId:()=>parse(TileIdSchema,`opaque-${++serial}`),gameId:parse(GameIdSchema,'duel'),playerIds:[parse(PlayerIdSchema,'alice'),parse(PlayerIdSchema,'bob')],turnId:parse(TurnIdSchema,'initial'),now,settings:{turnDurationSeconds:60,...settings},random:{nextInt(n){seed=(seed*1664525+1013904223)>>>0;return seed%n;}}});}
function act(s:DuelState,index=0){const selected=choices(s)[index];assert.ok(selected,`No choice: ${JSON.stringify(s.tasks)} ${s.stage}`);const before=structuredClone(s),r=applyDuelAction(s,s.players[decisionActor(s)]!.playerId,{type:'SELECT',optionId:selected.view.id},now,parse(TurnIdSchema,`turn-${++serial}`),random);assert.deepEqual(s,before);assert.ok(r.ok);return r.state;}
function op(s:DuelState,kind:string,a?:string){const index=choices(s).findIndex(c=>c.operation.kind===kind&&(a===undefined||c.operation.a===a));assert.ok(index>=0,`${kind} not available`);return act(s,index);}
function ready(s:DuelState){let count=0;while(s.stage==='DRAFT'&&count++<30)s=act(s);return s;}
function view(s:DuelState,p:DuelSeat){return projectDuel({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:s.finishedAt,state:s},s.players[p]!.playerId)!;}
function city(s:DuelState,id:string,p:DuelSeat){const c=s.cards.find(c=>c.definitionId===id)!;c.zone='CITY';c.owner=p;c.slot=null;c.under=null;return c;}
for(const pantheon of [false,true])for(const agora of [false,true])for(let seed=1;seed<=12;seed++)test(`Duel complete seeded game P=${pantheon} A=${agora} seed=${seed}`,()=>{
 let s=fixture({pantheon,agora},seed),steps=0;const ids=s.cards.map(c=>c.tileId).sort();
 assert.equal(s.cards.filter(c=>c.zone==='BOARD').length,agora?25:20);
 while(s.phase==='PLAYING'&&steps++<450){const opts=choices(s);assert.ok(opts.length,`${s.stage} ${JSON.stringify(s.tasks)}`);let i=(steps*37+seed*13)%opts.length;if(seed%3===0&&!s.tasks.length&&s.stage!=='DRAFT'&&s.stage!=='NEXT_AGE'){const disc=opts.findIndex(c=>c.operation.kind==='DISCARD');if(disc>=0)i=disc;}s=act(s,i);assert.deepEqual(s.cards.map(c=>c.tileId).sort(),ids);parseDuelState(s);for(const p of [0,1] as const){const g=view(s,p);assert.equal(g.privateState.playerId,s.players[p]!.playerId);if(p!==decisionActor(s))assert.deepEqual(g.privateState.options,[]);assert.equal(JSON.stringify(g).includes('conspiracyOrder'),false);}}
 assert.equal(s.phase,'FINISHED',`${steps} moves ${JSON.stringify(s.tasks)}`);assert.ok(s.result!.scores.length===2);
});
test('Duel costs: bank uses rival raw production, flexible production, chained buildings and economy discounts',()=>{
 const s=ready(fixture({pantheon:false,agora:false})),p=s.active,opp=p===0?1:0;
 const target=duelCard('baths');assert.equal(quote(s,p,target).total,2);city(s,'quarry',opp);assert.equal(quote(s,p,target).total,3);
 city(s,'stone-pit',p);assert.equal(quote(s,p,target).total,0);
 city(s,'theater',p);assert.equal(quote(s,p,duelCard('statue')).method,'CHAIN');
});
test('Duel invalid actor/options reject without mutating canonical state; hidden projections differ',()=>{
 const s=fixture(),before=structuredClone(s),p=decisionActor(s);assert.equal(applyDuelAction(s,s.players[p===0?1:0]!.playerId,{type:'SELECT',optionId:'option-0'},now,s.transitionId,random).ok,false);assert.equal(applyDuelAction(s,s.players[p]!.playerId,{type:'SELECT',optionId:'option-9999'},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 const g=view(s,p);assert.ok(g.board.some(c=>c.definitionId===null));assert.deepEqual(view(s,p===0?1:0).privateState.options,[]);assert.ok(!JSON.stringify(g).includes('godDecks'));
});
test('Duel catalog numeric regression checks',()=>{assert.equal(DUEL_BASE_CARDS.length,73);assert.equal(duelCard('palisade').coins,2);assert.equal(duelCard('senate').points,5);assert.equal(duelCard('walls').cost.stone,2);assert.equal(DUEL_GODS.length,16);assert.equal(DUEL_CONSPIRACIES.length,16);});
test('Duel prepared conspiracy is a turn-start action followed by a main action, and remains private before trigger',()=>{
 let s=ready(fixture());const p=s.active,c=s.conspiracies.find(c=>c.definitionId==='blackmail')!;s.conspiracyOrder=s.conspiracyOrder.filter(id=>id!==c.id);c.zone='HAND';c.owner=p;
 const card=s.cards.find(c=>available(s,c))!;card.zone='PREPARED';card.owner=p;card.under=c.id;card.slot=null;
 assert.equal(view(s,p===0?1:0).playerStates[p]!.conspiracies[0]!.definitionId,null);s=op(s,'TRIGGER',c.id);while(s.tasks.length)s=op(s,'SKIP');assert.equal(s.stage,'ACTION');assert.equal(choices(s).some(c=>c.operation.kind==='TRIGGER'),false);assert.equal(view(s,p===0?1:0).playerStates[p]!.conspiracies[0]!.definitionId,'blackmail');
});
test('Duel all conspiracy effects resolve from a populated fixture without hidden-state leakage',()=>{
 for(const d of DUEL_CONSPIRACIES){let s=ready(fixture()),p=s.active,c=s.conspiracies.find(c=>c.definitionId===d.id)!;s.conspiracyOrder=s.conspiracyOrder.filter(id=>id!==c.id);c.zone='HAND';c.owner=p;const card=s.cards.find(c=>available(s,c))!;card.zone='PREPARED';card.owner=p;card.under=c.id;card.slot=null;s.players[p]!.influence[0]=1;s.players[p===0?1:0]!.influence[1]=1;
 s=op(s,'TRIGGER',c.id);let guard=0;while(s.phase==='PLAYING'&&s.tasks.length&&guard++<30)s=act(s);assert.ok(guard<30,d.id);parseDuelState(s);view(s,p);}
});
test('Duel all gods including gate/theater choices finish their effect queues',()=>{
 for(const d of DUEL_GODS){let s=ready(fixture()),p=s.active;s.age=2;s.players[p]!.coins=100;for(const deck of s.godDecks)deck.ids=deck.ids.filter(id=>id!==d.id);s.pantheon[0]=d.id;s.pantheonKnown[0]=[0,1];if(d.id==='enki'){const tokens=s.progress.filter(t=>t.zone==='BOX').slice(0,2);tokens.forEach(t=>t.zone='ENKI');}
 s=op(s,'INVOKE','0');let guard=0;while(s.phase==='PLAYING'&&s.tasks.length&&guard++<30)s=act(s);assert.ok(guard<30,d.id);parseDuelState(s);view(s,p);}
});
test('Duel science pairs award one progress token; scoring records every component',()=>{
 let s=ready(fixture({pantheon:false,agora:false})),p=s.active;
 const groups=DUEL_BASE_CARDS.filter(d=>d.science),first=groups[0]!,second=groups.find(d=>d.id!==first.id&&d.science===first.science)!;city(s,first.id,p);const c=s.cards.find(c=>c.definitionId===second.id)!;c.zone='DISCARD';c.owner=-1;c.slot=null;s.tasks=[task('RESURRECT',p)];s=op(s,'FREE_BUILD',c.tileId);assert.equal(science(s,p).filter(x=>x===first.science).length,2);assert.equal(s.tasks[0]?.kind,'PROGRESS');s=act(s);assert.equal(s.progress.filter(t=>t.zone==='PLAYER'&&t.owner===p).length,1);const score=scores(s)[p]!;assert.equal(score.total,score.green+score.blue+score.yellow+score.guild+score.wonders+score.progress+score.coins+score.military+score.gods+score.temples+score.senate);
});
test('Duel military: Agora second token moves then removes influence, without base coin penalty',()=>{
 let s=ready(fixture()),p=s.active;s.military=p===0?5:-5;s.players[p]!.influence[0]=1;s.players[p===0?1:0]!.influence[1]=1;const coins=s.players[p===0?1:0]!.coins;
 const red=s.cards.find(c=>duelCard(c.definitionId).shields===1)!;red.zone='DISCARD';red.owner=-1;red.slot=null;s.tasks=[task('RESURRECT',p)];s=op(s,'FREE_BUILD',red.tileId);assert.equal(s.tasks[0]?.kind,'MOVE');assert.equal(s.tasks[1]?.kind,'REMOVE');assert.equal(s.players[p===0?1:0]!.coins,coins);
});
test('Duel military: Minerva stops whole decree transfer movement before its marked square',()=>{
 let s=ready(fixture()),p=s.active,opp=p===0?1:0;s.decrees=[{id:9,chamber:0,revealed:true}];s.players[opp]!.influence=[1,0,0,0,0,0];s.players[p]!.influence=[0,1,0,0,0,0];s.military=0;s.minerva=p===0?1:-1;s.tasks=[task('MOVE_DECREE',p)];s=act(s,choices(s).findIndex(c=>c.operation.kind==='DECREE'&&c.operation.a==='9'&&c.operation.b==='1'));assert.equal(s.military,0);assert.equal(s.minerva,null);
});
test('Duel Anubis removes ongoing wonder shields, keeps instant coins and allows rebuilding',()=>{
 let s=ready(fixture()),p=s.active,w=s.wonders.find(w=>w.id==='wonder-colossus');if(!w){s.wonders[0]!.id='wonder-colossus';w=s.wonders[0]!;}w.owner=p;w.built=true;const c=s.cards.find(c=>available(s,c))!;c.zone='WONDER';c.owner=p;c.under=w.id;c.slot=null;s.military=p===0?2:-2;const coins=s.players[p]!.coins;s.tasks=[task('ANUBIS',p)];s=op(s,'ANUBIS','wonder-colossus');assert.equal(s.military,0);assert.equal(s.players[p]!.coins,coins);assert.equal(s.wonders.find(w=>w.id==='wonder-colossus')!.built,false);assert.equal(s.wonders.find(w=>w.id==='wonder-colossus')!.removed,false);
});
test('Duel politicians have at most three senate actions even with 6+ blue buildings',()=>{
 let s=ready(fixture()),p=s.active;for(const d of DUEL_BASE_CARDS.filter(c=>c.color==='BLUE').slice(0,7))city(s,d.id,p);const c=s.cards.find(c=>c.definitionId==='politician-0')!;c.zone='DISCARD';c.owner=-1;c.slot=null;s.tasks=[task('RESURRECT',p)];s=op(s,'FREE_BUILD',c.tileId);assert.equal(s.tasks[0]!.kind,'SENATE');assert.equal(s.tasks[0]!.remaining,3);
});
test('Duel unchosen Enki revealed through Gate returns its public progress to the box',()=>{
 let s=ready(fixture()),p=s.active;s.age=2;s.players[p]!.coins=100;const deck=s.godDecks.find(d=>d.mythology==='MESOPOTAMIAN')!;deck.ids=['enki',...deck.ids.filter(id=>id!=='enki')];s.pantheon[0]='gate';s=op(s,'INVOKE','0');assert.equal(s.progress.filter(t=>t.zone==='ENKI').length,2);assert.ok(view(s,p===0?1:0).revealedGods.includes('enki'));const otherGod=choices(s).findIndex(c=>c.operation.a!=='enki');s=act(s,otherGod);assert.equal(s.progress.filter(t=>t.zone==='ENKI').length,0);
});
test('Duel seven distinct wonder limit stays removed after Anubis and Sabotage',()=>{
 let s=ready(fixture({pantheon:true,agora:false})),p=s.active;const owned=s.wonders[0]!;owned.owner=p;
 for(const w of s.wonders.slice(1,7)){w.built=true;const c=s.cards.find(c=>available(s,c))!;c.zone='WONDER';c.owner=w.owner;c.under=w.id;c.slot=null;}
 const discarded=s.cards.find(c=>available(s,c))!;discarded.zone='DISCARD';discarded.owner=-1;discarded.slot=null;s.tasks=[task('ISIS',p)];s=op(s,'FREE_WONDER',discarded.tileId);const removed=s.wonders.find(w=>w.removed)!;assert.ok(removed);s.tasks=[task('ANUBIS',p)];s=op(s,'ANUBIS',owned.id);assert.equal(s.wonders.find(w=>w.id===removed.id)!.removed,true);
});
test('Duel conservation validation rejects missing progress, orphan preparation and duplicate card identity',()=>{const s=fixture();assert.throws(()=>parseDuelState({...s,progress:s.progress.slice(1)}));assert.throws(()=>parseDuelState({...s,cards:s.cards.slice(1)}));const bad=structuredClone(s);bad.cards[0]!.zone='PREPARED';bad.cards[0]!.owner=0;bad.cards[0]!.slot=null;bad.cards[0]!.under='missing';assert.throws(()=>parseDuelState(bad));});
test('Duel Zeus and hidden-decree choices never reveal concealed definitions through labels or source IDs',()=>{
 const s=ready(fixture()),p=s.active;s.tasks=[task('DISCARD_ANY',p)];const hidden=s.cards.filter(c=>c.zone==='BOARD'&&c.slot!==null&&!s.slots[c.slot]!.faceUp);assert.ok(hidden.length);const options=view(s,p).privateState.options;for(const c of hidden){const choice=options.find(o=>o.sourceId===c.tileId)!;assert.equal(choice.definitionId,null);assert.ok(!choice.label.includes(duelCard(c.definitionId).name));}
 s.tasks=[task('MOVE_DECREE',p)];const hiddenDecrees=s.decrees.filter(d=>!d.revealed);assert.ok(hiddenDecrees.length);for(const o of view(s,p).privateState.options){assert.match(o.sourceId!,/^decree-position-/);assert.equal(o.definitionId,null);}
});
test('Duel draft projections hide the next wonder batch and board arrays use layout order, never catalog order',()=>{
 const base=fixture({pantheon:false,agora:false});assert.equal(view(base,0).wonders.length,4);assert.deepEqual(view(base,0).board,[]);
 let s=fixture();const unshown=s.wonders.slice(4).map(w=>w.id);for(const id of unshown)assert.ok(!view(s,0).wonders.some(w=>w.id===id));s=ready(s);assert.equal(view(s,0).wonders.length,8);const order=view(s,0).board.map(c=>c.slot!);assert.deepEqual(order,[...order].sort((a,b)=>a-b));s.tasks=[task('DISCARD_ANY',s.active)];assert.deepEqual(choices(s).map(c=>c.view.sourceId),view(s,s.active).board.map(c=>c.tileId));
});

test('Duel a turn-start conspiracy that consumes the last structure card completes the age after its effects', () => {
 for (const pantheon of [false, true]) for (const age of [1, 3] as const) {
  let s = ready(fixture({pantheon, agora:true}));
  const p = s.active;
  s.age = age;
  const conspiracy = s.conspiracies.find(c => c.definitionId === 'turn-of-events')!;
  assert.ok(conspiracy);
  conspiracy.zone = 'HAND'; conspiracy.owner = p;
  s.conspiracyOrder = s.conspiracyOrder.filter(id => id !== conspiracy.id);
  const board = s.cards.filter(c => c.zone === 'BOARD');
  const last = board.find(c => available(s,c))!;
  for (const c of board.filter(c => c !== last)) { c.zone='DISCARD'; c.slot=null; }
  const preparation = board.find(c => c !== last)!;
  preparation.zone='PREPARED'; preparation.owner=p; preparation.under=conspiracy.id;
  s = op(s,'TRIGGER',conspiracy.id);
  s = op(s,'DISCARD_EFFECT',last.tileId);
  while(s.tasks.length) s=op(s,'SKIP');
  if(age===1) { assert.equal(s.age,2); assert.equal(s.stage,'NEXT_AGE'); assert.ok(choices(s).every(c=>c.operation.kind==='STARTER')); }
  else { assert.equal(s.phase,'FINISHED'); assert.equal(s.result?.reason,'SCORED'); }
 }
});

test('Duel Minerva destination descriptions follow the choosing player for both seats', () => {
 const s=ready(fixture());
 for(const p of [0,1] as const) {
  s.tasks=[task('MINERVA',p)];
  assert.match(choices(s).find(c=>c.operation.n===(p===0?9:-9))!.view.label,/상대 수도 방향 9칸/);
  assert.match(choices(s).find(c=>c.operation.n===(p===0?-9:9))!.view.label,/내 수도 방향 9칸/);
 }
});

test('Duel Coercion simultaneous science pairs resolve active player first and preserve existing progress', () => {
 let s=ready(fixture()), p=s.active, opponent:DuelSeat=p===0?1:0;
 const groups=[...new Set(DUEL_BASE_CARDS.flatMap(c=>c.science?[c.science]:[]))].map(symbol=>DUEL_BASE_CARDS.filter(c=>c.science===symbol));
 const a=groups.find(g=>g.length>=2)!, b=groups.find(g=>g.length>=2&&g!==a)!;
 city(s,a[0]!.id,p); const give=city(s,b[0]!.id,p);
 city(s,b[1]!.id,opponent); const take=city(s,a[1]!.id,opponent);
 s.tasks=[task('SWAP',p)];
 s=act(s,choices(s).findIndex(c=>c.operation.a===take.tileId&&c.operation.b===give.tileId));
 assert.deepEqual(s.tasks.map(t=>[t.kind,t.actor]),[['PROGRESS',p],['PROGRESS',opponent]]);
 s=act(s); assert.equal(decisionActor(s),opponent);
 s=act(s); assert.equal(s.progress.filter(t=>t.zone==='PLAYER').length,2);
 s.tasks=[task('SWAP',p)];
 s=act(s,choices(s).findIndex(c=>c.operation.a===give.tileId&&c.operation.b===take.tileId));
 assert.equal(s.progress.filter(t=>t.zone==='PLAYER').length,2);
 assert.equal(s.tasks.length,0);
});

test('Duel science supremacy ends before pending influence effects can be applied', () => {
 let s=ready(fixture()),p=s.active;
 const groups=[...new Set(DUEL_BASE_CARDS.flatMap(c=>c.science?[c.science]:[]))];
 for(const symbol of groups.slice(0,5)) city(s,DUEL_BASE_CARDS.find(c=>c.science===symbol)!.id,p);
 const last=s.cards.find(c=>duelCard(c.definitionId).science===groups[5])!;
 last.zone='DISCARD';last.slot=null;last.owner=-1;
 s.tasks=[task('RESURRECT',p),task('PLACE',p)];
 s=op(s,'FREE_BUILD',last.tileId);
 assert.equal(s.result?.reason,'SCIENCE');assert.deepEqual(s.tasks,[]);assert.deepEqual(choices(s),[]);
});

function installGod(s:DuelState,id:string,slot=0) {
 for(const d of s.godDecks) d.ids=d.ids.filter(x=>x!==id);
 for(let i=0;i<s.pantheon.length;i++) if(s.pantheon[i]===id)s.pantheon[i]=null;
 s.pantheon[slot]=id;s.age=2;s.players[s.active]!.coins=100;
}
function ownConspiracy(s:DuelState,id:string,p:DuelSeat,prepared=false) {
 const c=s.conspiracies.find(c=>c.definitionId===id)!;
 c.owner=p;c.zone='HAND';s.conspiracyOrder=s.conspiracyOrder.filter(x=>x!==c.id);
 if(prepared){const card=s.cards.find(c=>available(s,c))!;card.zone='PREPARED';card.owner=p;card.slot=null;card.under=c.id;}
 return c.id;
}
function chainWonders(s:DuelState,p:DuelSeat) {
 const ids=['wonder-divine-theater','wonder-curia-julia','wonder-mausoleum','wonder-knossos','wonder-colossus','wonder-library','wonder-sanctuary','wonder-sphinx'];
 s.wonders=ids.map(id=>({id,owner:p,built:false,removed:false}));
}

test('Duel Hades → politician → shield decree resolves military token before the next Senate action',()=>{
 let s=ready(fixture()),p=s.active;
 city(s,'theater',p);city(s,'altar',p);
 s.decrees=[{id:9,chamber:0,revealed:true}];s.players.forEach(x=>x.influence=[0,0,0,0,0,0]);
 s.military=p===0?2:-2;
 const c=s.cards.find(c=>c.definitionId==='politician-0')!;c.zone='DISCARD';c.slot=null;c.owner=-1;
 installGod(s,'hades');s=op(s,'INVOKE','0');s=op(s,'FREE_BUILD',c.tileId);
 assert.equal(s.tasks[0]?.kind,'SENATE');assert.equal(s.tasks[0]?.remaining,2);
 s=op(s,'PLACE','0');
 assert.deepEqual(s.tasks.slice(0,2).map(t=>[t.kind,t.remaining]),[['PLACE',1],['SENATE',1]]);
 s=op(s,'PLACE','5');s=op(s,'SKIP');
 assert.equal(s.active,p===0?1:0);assert.equal(s.stage,'TURN_START');
 assert.equal(s.players[p]!.influence[5],1);
});

test('Duel Theater → Isis → Curia Julia → conspiracy finishes before god ordering and grants one replay',()=>{
 let s=ready(fixture()),p=s.active;chainWonders(s,p);
 const id=ownConspiracy(s,'blackmail',p);
 const discarded=s.cards.find(c=>available(s,c))!;discarded.zone='DISCARD';discarded.slot=null;
 for(const d of s.godDecks)d.ids=d.ids.filter(id=>id!=='isis');
 s.godDecks.find(d=>d.mythology==='EGYPTIAN')!.ids.push('isis');
 s.players[p]!.coins=100;
 const card=s.cards.find(c=>available(s,c))!;
 s=act(s,choices(s).findIndex(c=>c.operation.kind==='WONDER'&&c.operation.a===card.tileId&&c.operation.b==='wonder-divine-theater'));
 s=op(s,'GOD_DECK','EGYPTIAN');s=op(s,'FREE_GOD','isis');
 s=act(s,choices(s).findIndex(c=>c.operation.kind==='FREE_WONDER'&&c.operation.a===discarded.tileId&&c.operation.b==='wonder-curia-julia'));
 assert.equal(s.tasks[0]?.kind,'UNPREPARED');s=op(s,'TRIGGER',id);
 let guard=0;while(s.tasks.length&&guard++<25)s=act(s);
 assert.ok(guard<25);assert.equal(s.stage,'TURN_START');assert.equal(s.active,p);
 assert.equal(s.conspiracies.find(c=>c.id===id)!.triggered,true);
 assert.ok(s.wonders.find(w=>w.id==='wonder-curia-julia')!.built);assert.deepEqual(s.revealedGods,[]);
 s=op(s,'DISCARD');while(s.tasks.length)s=act(s);
 assert.equal(s.active,p===0?1:0);
});

test('Duel Gate → Enki → Law with Ishtar creates a pair and resolves the public progress choice',()=>{
 let s=ready(fixture()),p=s.active;
 for(const d of s.godDecks)d.ids=d.ids.filter(id=>id!=='ishtar'&&id!=='enki');
 s.pantheon=s.pantheon.map(id=>id==='ishtar'||id==='enki'?null:id);
 s.players[p]!.gods.push('ishtar');s.godDecks.find(d=>d.mythology==='MESOPOTAMIAN')!.ids.unshift('enki');
 const law=s.progress.find(t=>t.id==='law')!;law.zone='BOX';law.owner=-1;
 installGod(s,'gate');s=op(s,'INVOKE','0');
 // Fix Enki's random draw to the two eligible public tokens for this effect fixture.
 for(const t of s.progress)if(t.zone==='ENKI')t.zone='BOX';
 s.progress.find(t=>t.id==='law')!.zone='ENKI';s.progress.find(t=>t.zone==='BOX'&&t.id!=='law')!.zone='ENKI';
 s=op(s,'FREE_GOD','enki');s=op(s,'PROGRESS','law');
 assert.equal(science(s,p).filter(x=>x==='LAW').length,2);assert.equal(s.tasks[0]?.kind,'PROGRESS');
 s=act(s);assert.equal(s.progress.filter(t=>t.zone==='PLAYER'&&t.owner===p).length,2);
 assert.equal(s.progress.filter(t=>t.zone==='ENKI').length,0);assert.equal(s.active,p===0?1:0);
});

test('Duel Neptune can trigger political supremacy before the remaining removal effect',()=>{
 let s=ready(fixture()),p=s.active,opp:DuelSeat=p===0?1:0;
 s.decrees=[];s.players[p]!.influence=[1,1,1,1,2,0];s.players[opp]!.influence=[0,0,0,0,0,0];
 installGod(s,'neptune');s=op(s,'INVOKE','0');
 s=op(s,'NEPTUNE_DISCARD','-3');s=op(s,'NEPTUNE_APPLY','6');
 s=act(s,choices(s).findIndex(c=>c.operation.kind==='MOVE'&&c.operation.a==='4'&&c.operation.n===5));
 assert.equal(s.result?.reason,'POLITICAL');assert.deepEqual(s.result?.winnerPlayerIds,[s.players[p]!.playerId]);assert.deepEqual(s.tasks,[]);
});

test('Duel Astarte treasure is protected from Blackmail and pays building shortfalls only',()=>{
 let s=ready(fixture()),p=s.active,opp:DuelSeat=p===0?1:0;
 s.players[opp]!.coins=5;s.players[opp]!.protectedCoins=7;
 const id=ownConspiracy(s,'blackmail',p,true),before=s.players[p]!.coins;
 s=op(s,'TRIGGER',id);while(s.tasks.length)s=act(s);
 assert.equal(s.players[opp]!.coins,2);assert.equal(s.players[opp]!.protectedCoins,7);assert.equal(s.players[p]!.coins,before+3);
 s.active=opp;s.stage='TURN_START';s.players[opp]!.coins=1;
 const c=s.cards.find(c=>available(s,c)&&quote(s,opp,duelCard(c.definitionId)).total>1&&quote(s,opp,duelCard(c.definitionId)).total<=8)!;
 assert.ok(c);const cost=quote(s,opp,duelCard(c.definitionId)).total;
 s=op(s,'BUILD',c.tileId);assert.equal(s.players[opp]!.protectedCoins,8-cost);
 assert.equal(scores(s)[opp]!.gods,8-cost);
});

test('Duel Coercion gives a shared victory when both cities simultaneously reach six science symbols',()=>{
 let s=ready(fixture()),p=s.active,opp:DuelSeat=p===0?1:0;
 const symbols=[...new Set(DUEL_BASE_CARDS.flatMap(c=>c.science?[c.science]:[]))];
 const groups=symbols.map(symbol=>DUEL_BASE_CARDS.filter(c=>c.science===symbol));
 assert.equal(groups.length,6);assert.ok(groups.every(g=>g.length>=2));
 const give=city(s,groups[0]![0]!.id,p);city(s,groups[0]![1]!.id,p);
 const take=city(s,groups[1]![0]!.id,opp);city(s,groups[1]![1]!.id,opp);
 for(const group of groups.slice(2)){city(s,group[0]!.id,p);city(s,group[1]!.id,opp);}
 s.tasks=[task('SWAP',p),task('MOVE',p)];
 s=act(s,choices(s).findIndex(c=>c.operation.a===take.tileId&&c.operation.b===give.tileId));
 assert.equal(s.result?.reason,'SCIENCE');assert.equal(s.result?.winnerPlayerIds.length,2);assert.deepEqual(s.tasks,[]);
});

test('Duel Anubis → Isis rebuilds the Mausoleum and can resurrect its newly discarded construction card',()=>{
 let s=ready(fixture()),p=s.active;chainWonders(s,p);
 const wonder=s.wonders.find(w=>w.id==='wonder-mausoleum')!;wonder.built=true;
 const under=s.cards.find(c=>available(s,c))!;under.zone='WONDER';under.owner=p;under.under=wonder.id;under.slot=null;
 installGod(s,'anubis');installGod(s,'isis',1);
 s=op(s,'INVOKE','0');s=op(s,'ANUBIS',wonder.id);
 s=op(s,'DISCARD');while(s.tasks.length)s=act(s);
 assert.equal(s.active,p);
 const material=s.cards.find(c=>c.zone==='DISCARD'&&c.tileId!==under.tileId)!;
 s=op(s,'INVOKE','1');s=act(s,choices(s).findIndex(c=>c.operation.kind==='FREE_WONDER'&&c.operation.a===material.tileId&&c.operation.b===wonder.id));
 assert.equal(s.tasks[0]?.kind,'RESURRECT');s=op(s,'FREE_BUILD',under.tileId);
 while(s.tasks.length)s=act(s);
 assert.ok(s.wonders.find(w=>w.id===wonder.id)!.built);assert.equal(s.cards.find(c=>c.tileId===under.tileId)!.zone,'CITY');
});

test('Duel hidden card locations are unique and Pantheon identifiers cannot collide with Senate choices',()=>{
 const s=ready(fixture()),p=s.active;s.tasks=[task('DISCARD_ANY',p)];
 const hidden=choices(s).filter(c=>c.view.definitionId===null);
 assert.ok(hidden.length>1);assert.equal(new Set(hidden.map(c=>c.view.label)).size,hidden.length);
 s.tasks=[];installGod(s,'mars');
 assert.ok(choices(s).filter(c=>c.operation.kind==='INVOKE').every(c=>c.view.sourceId===`pantheon-${c.operation.a}`));
});

for(const seconds of [30,60,90] as const)test(`Duel timer ${seconds}s: exact deadline rejects manual input and draft auto-selects`,async()=>{
 const {timeoutDuel}=await import('./games/seven-wonders-duel/domain/game.js');
 const s=fixture({pantheon:false,agora:false,turnDurationSeconds:seconds}),before=structuredClone(s),at=parse(ServerTimeSchema,now+seconds*1000),actor=s.players[decisionActor(s)]!.playerId;
 assert.equal(s.deadlineAt,at);assert.equal(timeoutDuel(s,parse(ServerTimeSchema,at-1),s.transitionId,random),null);
 const r=applyDuelAction(s,actor,{type:'SELECT',optionId:choices(s)[0]!.view.id},at,s.transitionId,random);assert.deepEqual(r,{ok:false,reason:'TURN_EXPIRED'});
 const next=timeoutDuel(s,at,parse(TurnIdSchema,'timeout'),random)!;assert.equal(next.draftCount,1);assert.equal(next.deadlineAt,at+seconds*1000);assert.equal(next.history.at(-1)!.text.startsWith('시간 초과'),true);assert.deepEqual(s,before);
});
test('Duel timer: nested decisions share time, opponent pauses budget, replay receives new budget',()=>{
 let s=ready(fixture({pantheon:false,agora:false}));const p=s.active,opp=p===0?1:0;
 s.tasks=[task('PLACE',p),task('PLACE',opp),task('PLACE',p),task('HANDOFF',p)];s.replay=true;
 const selectAt=(state:DuelState,time:number)=>{const c=choices(state).find(c=>c.operation.kind==='PLACE')!;const result=applyDuelAction(state,state.players[decisionActor(state)]!.playerId,{type:'SELECT',optionId:c.view.id},parse(ServerTimeSchema,time),parse(TurnIdSchema,`clock-${time}`),random);assert.ok(result.ok);return result.state;};
 s=selectAt(s,11000);assert.equal(s.timerRemaining[p],50000);assert.equal(s.deadlineAt,71000);
 s=selectAt(s,21000);assert.equal(s.deadlineAt,71000);assert.equal(s.timerRemaining[opp],50000);
 s=selectAt(s,31000);assert.equal(s.active,p);assert.equal(s.deadlineAt,91000);assert.deepEqual(s.timerRemaining,[60000,60000]);
});
test('Duel timer: expired main action discards a legal card; expired mandatory chain settles without extra budgets',async()=>{
 const {timeoutDuel}=await import('./games/seven-wonders-duel/domain/game.js');
 let s=ready(fixture({pantheon:false,agora:false}));const p=s.active,coins=s.players[p]!.coins,discard=choices(s).find(c=>c.operation.kind==='DISCARD')!;
 const next=timeoutDuel(s,s.deadlineAt!,parse(TurnIdSchema,'auto-discard'),random)!;
 assert.equal(next.cards.find(c=>c.tileId===discard.operation.a)!.zone,'DISCARD');assert.equal(next.players[p]!.coins,coins+2);assert.equal(next.active,p===0?1:0);
 s=ready(fixture({pantheon:true,agora:true}));s.tasks=[task('PROGRESS',s.active),task('PLACE',s.active),task('HANDOFF',s.active)];
 const done=timeoutDuel(s,s.deadlineAt!,parse(TurnIdSchema,'auto-chain'),random)!;
 assert.equal(done.tasks.length,0);assert.ok(done.revision>s.revision+1);assert.equal(done.progress.filter(t=>t.zone==='PLAYER').length,1);assert.ok(done.deadlineAt!>s.deadlineAt!);
});
for(const pantheon of [false,true])for(const agora of [false,true])test(`Duel timed automatic game finishes with P=${pantheon} A=${agora}`,async()=>{
 const {timeoutDuel}=await import('./games/seven-wonders-duel/domain/game.js');let s=fixture({pantheon,agora});let steps=0;
 while(s.phase==='PLAYING'&&steps++<200){s=timeoutDuel(s,s.deadlineAt!,parse(TurnIdSchema,`auto-${steps}`),random)!;assert.ok(s);parseDuelState(s);}
 assert.equal(s.phase,'FINISHED');assert.equal(s.deadlineAt,null);assert.equal(s.result?.reason,'SCORED');
});

test('Duel unlimited: no deadline, no timeout, late manual choices and full game remain valid',async()=>{
 const {timeoutDuel}=await import('./games/seven-wonders-duel/domain/game.js');
 const {DuelGameStateAdapter}=await import('./games/seven-wonders-duel/compatibility/adapter.js');
 let s=fixture({pantheon:true,agora:true,turnDurationSeconds:0});const late=parse(ServerTimeSchema,now+86400000);
 const adapter=new DuelGameStateAdapter();let moves=0;
 while(s.phase==='PLAYING'&&moves++<250){
  assert.equal(s.deadlineAt,null);assert.deepEqual(s.timerRemaining,[0,0]);assert.equal(timeoutDuel(s,late,parse(TurnIdSchema,'no-timeout'),random),null);
  const lifecycle=adapter.inspectLifecycle({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:s.finishedAt,state:s});assert.equal(lifecycle.lifecycle,'RUNNING');if(lifecycle.lifecycle==='RUNNING')assert.equal(lifecycle.activeTurn,null);
  assert.equal(view(s,decisionActor(s)).phase,'PLAYING');
  const all=choices(s),c=all.find(c=>c.operation.kind==='DISCARD')??all.find(c=>c.operation.kind==='SKIP')??all[0]!;
  const result=applyDuelAction(s,s.players[decisionActor(s)]!.playerId,{type:'SELECT',optionId:c.view.id},late,parse(TurnIdSchema,`unlimited-${moves}`),random);assert.ok(result.ok);s=result.state;
 }
 assert.equal(s.phase,'FINISHED');assert.equal(s.result?.reason,'SCORED');
});

test('Duel Agora starts with chambers 1/3/5 public and 2/4/6 hidden for both viewers',()=>{
 for(const pantheon of [false,true])for(let seed=1;seed<=12;seed++){
  const s=fixture({pantheon,agora:true},seed);
  assert.equal(s.stage,'DRAFT');assert.equal(s.draftCount,0);
  assert.deepEqual(s.decrees.map(d=>d.revealed),[true,false,true,false,true,false]);
  assert.equal(new Set(s.decrees.map(d=>d.id)).size,6);
  for(const seat of [0,1] as const){
   const projected=view(s,seat);
   assert.deepEqual(projected.decrees.map(ch=>ch.ids[0]!==null),[true,false,true,false,true,false]);
   for(const ch of projected.decrees)assert.deepEqual(ch.ids,[ch.chamber%2===0?s.decrees[ch.chamber]!.id:null]);
  }
 }
 assert.deepEqual(fixture({pantheon:false,agora:false}).decrees,[]);
});

test('Duel expansion audit: Pantheon setup shows Age I and tokens during wonder selection',()=>{
 for(const agora of [false,true]){
  const s=fixture({pantheon:true,agora});
  for(const p of [0,1] as const){
   const v=view(s,p);assert.equal(v.board.length,agora?25:20);assert.equal(v.slots.filter(x=>x.mythology).length,5);
   for(const c of v.board)assert.equal(c.definitionId===null,!s.slots[c.slot!]!.faceUp);
  }
 }
 assert.equal(view(fixture({pantheon:false,agora:false}),0).board.length,0);
});

test('Duel expansion audit: Turn of Events requires first discard but allows skipping the second',()=>{
 let s=ready(fixture()),p=s.active;const id=ownConspiracy(s,'turn-of-events',p,true);
 s=op(s,'TRIGGER',id);assert.equal(s.tasks[0]!.kind,'DISCARD_TWO');
 assert.equal(choices(s).some(c=>c.operation.kind==='SKIP'),false);
 s=op(s,'DISCARD_EFFECT');while(s.tasks[0]?.kind==='GOD_PLACE'||s.tasks[0]?.kind==='GOD_SLOT')s=act(s);
 assert.equal(s.tasks[0]?.kind,'DISCARD_TWO');assert.ok(choices(s).some(c=>c.operation.kind==='SKIP'));
 s=op(s,'SKIP');assert.equal(s.tasks[0]?.kind,'MOVE');s=op(s,'SKIP');assert.equal(s.stage,'ACTION');assert.equal(s.active,p);
});

test('Duel expansion audit: age inventories, senator distribution, tokens and temple replacement',async()=>{
 const {setupAge}=await import('./games/seven-wonders-duel/domain/setup.js');
 for(const pantheon of [false,true])for(const agora of [false,true]){
  const s=fixture({pantheon,agora});
  assert.equal(s.progress.length,10+(pantheon?3:0)+(agora?2:0));assert.equal(s.progress.filter(t=>t.zone==='BOARD').length,5);
  assert.equal(s.conspiracies.length,agora?16:0);
  for(const age of [1,2,3] as const){
   const cards=s.cards.filter(c=>c.age===age&&(c.zone==='DECK'||c.zone==='BOARD'));
   assert.equal(cards.length,agora?(age===3?23:25):20);
   assert.equal(cards.filter(c=>['WHITE','BLACK'].includes(duelCard(c.definitionId).color)).length,agora?(age===3?3:5):0);
   assert.equal(s.cards.filter(c=>c.age===age&&c.zone==='BOX').length,3);
  }
  assert.equal(s.cards.filter(c=>c.zone==='DECK'&&duelCard(c.definitionId).color==='TEMPLE').length,pantheon?3:0);
  assert.equal(s.cards.filter(c=>c.zone==='DECK'&&duelCard(c.definitionId).color==='PURPLE').length,pantheon?0:3);
  assert.equal(s.slots.filter(t=>t.mythology).length,pantheon?5:0);
  assert.ok(s.slots.filter(t=>t.mythology).every(t=>!t.faceUp));
  s.cards.filter(c=>c.zone==='BOARD').forEach(c=>{c.zone='DISCARD';c.slot=null;});s.age=2;setupAge(s,random);
  assert.deepEqual(s.slots.filter(t=>t.offering).map(t=>t.offering).sort(),pantheon?[2,3,4]:[]);
  assert.ok(s.slots.filter(t=>t.offering).every(t=>!t.faceUp));
 }
});

test('Duel expansion audit: invocation consumes offerings, not board cards; Sanctuary discounts Gate',async()=>{
 const {godCost}=await import('./games/seven-wonders-duel/domain/economy.js');
 for(const agora of [false,true]){
  let s=ready(fixture({pantheon:true,agora})),p=s.active;installGod(s,'tanit');s.players[p]!.offerings=[2,3];
  const before=s.players[p]!.coins,board=s.cards.filter(c=>c.zone==='BOARD').map(c=>c.tileId).sort();
  const i=choices(s).findIndex(c=>c.operation.kind==='INVOKE'&&c.operation.n===3);const cost=choices(s)[i]!.view.cost!;
  s=act(s,i);assert.equal(s.players[p]!.coins,before-cost+12);assert.deepEqual(s.players[p]!.offerings,[]);
  assert.deepEqual(s.cards.filter(c=>c.zone==='BOARD').map(c=>c.tileId).sort(),board);assert.equal(s.active,p===0?1:0);assert.equal(s.pantheon[0],null);
  s.wonders[0]={id:'wonder-sanctuary',owner:p,built:true,removed:false};s.pantheon[0]='gate';
  assert.equal(godCost(s,p,0,0),(p===0?3:8)*2-2);assert.equal(godCost(s,p,0,99),0);
 }
});

test('Duel expansion audit: temple chains and Mysticism scoring use retained tokens',async()=>{
 const {DUEL_CARDS}=await import('@hangul-rummikub/shared');
 let s=ready(fixture()),p=s.active;const temples=DUEL_CARDS.filter(c=>c.color==='TEMPLE');
 s.players[p]!.mythology=[temples[0]!.mythology!];
 assert.equal(quote(s,p,temples[0]!).method,'CHAIN');assert.equal(quote(s,p,temples[0]!).total,0);
 for(let n=1;n<=3;n++){city(s,temples[n-1]!.id,p);assert.equal(scores(s)[p]!.temples,[5,12,21][n-1]);}
 const mysticism=s.progress.find(t=>t.id==='mysticism')!;mysticism.zone='PLAYER';mysticism.owner=p;
 s.players[p]!.offerings=[2,4];assert.equal(scores(s)[p]!.progress,6);s.players[p]!.offerings.pop();assert.equal(scores(s)[p]!.progress,4);
});

test('Duel expansion audit: Corruption and Organized Crime apply to both Senator categories',()=>{
 let s=ready(fixture()),p=s.active;city(s,'politician-0',p);city(s,'conspirator-0',p);
 for(const id of ['politician-1','conspirator-1'])assert.equal(quote(s,p,duelCard(id)).total,2);
 const corruption=s.progress.find(t=>t.id==='corruption')!;corruption.zone='PLAYER';corruption.owner=p;
 for(const id of ['politician-1','conspirator-1'])assert.equal(quote(s,p,duelCard(id)).total,0);
 const organized=s.progress.find(t=>t.id==='organized-crime')!;organized.zone='PLAYER';organized.owner=p;
 const ids=s.conspiracyOrder.slice(0,2);s.tasks=[task('CONSPIRE',p)];s=op(s,'DRAW_CONSPIRACY');
 for(const id of ids)assert.equal(s.conspiracies.find(c=>c.id===id)!.zone,'HAND');
 assert.equal(s.tasks.some(t=>t.kind==='CONSPIRACY_PICK'||t.kind==='CONSPIRACY_RETURN'),false);
 assert.ok(view(s,p===0?1:0).playerStates[p]!.conspiracies.every(c=>c.definitionId===null));
});
