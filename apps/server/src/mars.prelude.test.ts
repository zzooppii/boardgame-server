import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,MARS_PRELUDES,MARS_PRELUDE_PROJECTS,marsResources,marsCard,type MarsAction,type MarsCard} from '@hangul-rummikub/shared';
import {createMarsGame,applyMarsAction,marsOffers,marsCardReason,parseMarsState,scoreMars,marsCost,type MarsState} from './games/mars/domain/game.js';
import {projectMars} from './games/mars/compatibility/projector.js';
let serial=0;
const now=v.parse(ServerTimeSchema,1000),random={nextInt:(n:number)=>Math.floor(n/2)};
function command(s:MarsState,a:MarsAction,actor=s.activePlayerId){const r=applyMarsAction(s,actor,a,now,v.parse(TurnIdSchema,`prelude-turn-${++serial}`),random);assert.ok(r.ok,JSON.stringify(a));return r.state;}
function create(corporateEra=true,n=2){return createMarsGame({prelude:true,corporateEra,generateTileId:()=>v.parse(TileIdSchema,`prelude-card-${++serial}`),gameId:v.parse(GameIdSchema,'prelude-game'),playerIds:Array.from({length:n},(_,i)=>v.parse(PlayerIdSchema,`prelude-player-${i}`)),now,turnId:v.parse(TurnIdSchema,`prelude-turn-${++serial}`),random});}
function move(s:MarsState,id:string,to:MarsCard[]){for(const zone of [s.deck,s.discard,s.preludeDeck,s.preludeDiscard,...s.players.flatMap(p=>[p.hand,p.research,p.played,p.preludes])]){const i=zone.findIndex(c=>c.definitionId===id);if(i>=0){const c=zone.splice(i,1)[0]!;to.push(c);s.players.forEach(p=>p.handCount=p.hand.length);return c;}}throw new Error(id);}
function setup(s:MarsState){for(const p of s.players)s=command(s,{type:'SETUP',corporationId:'Beginner',cardIds:[],preludeIds:p.preludes.slice(0,2).map(c=>c.tileId)},p.playerId);return s;}
function settle(s:MarsState){for(let i=0;i<150&&(s.payment||s.current||s.cardChoice||s.frames.length);i++){
 if(s.payment)s=command(s,{type:'PAY',payment:{money:s.payment.cost,steel:0,titanium:0,heat:0}});
 else if(s.cardChoice){const c=s.cardChoice.view;s=command(s,{type:'CHOOSE_CARDS',choiceId:c.id,cardIds:c.kind==='KEEP'?c.cards.slice(0,c.keepCount).map(c=>c.tileId):[]});}
 else {const offer=marsOffers(s,s.activePlayerId)[0];assert.ok(offer,'Effect must have a legal continuation');s=command(s,{type:'TAKE',actionId:offer.id});}
 }assert.equal(s.current,null);assert.equal(s.payment,null);assert.equal(s.frames.length,0);return s;}
function actionReady(){let s=setup(create());for(let i=0;i<50&&s.stage==='PRELUDE';i++){const offer=marsOffers(s,s.activePlayerId)[0];assert.ok(offer);s=settle(command(s,{type:'TAKE',actionId:offer.id}));}assert.equal(s.stage,'ACTION');return s;}
function rich(s:MarsState){for(const p of s.players){p.resources=marsResources({money:200,steel:20,titanium:20,plants:20,energy:20,heat:20});p.production=marsResources({money:4,steel:4,titanium:4,plants:4,energy:4,heat:4});}}

test('Mars Prelude keeps exact separate inventories and private 4-card deals for both variants and 2–5 players',()=>{
 for(const corporate of [false,true])for(const count of [2,3,4,5]){const s=create(corporate,count);assert.equal(s.inventory.length,corporate?215:144);assert.equal(s.preludeInventory.length,35);assert.equal(s.preludeDeck.length,35-count*4);assert.ok(s.players.every(p=>p.preludes.length===4));const view=projectMars({gameId:s.gameId,gameRevision:s.revision,startedAt:now,finishedAt:null,state:s},s.players[0]!.playerId)!;assert.equal(view.privateState.preludes?.length,4);const json=JSON.stringify(view);for(const c of [...s.preludeDeck,...s.players[1]!.preludes])assert.equal(json.includes(c.tileId),false);s.prelude=false;assert.throws(()=>parseMarsState(s));}
});
test('Mars Prelude setup rejects missing, duplicate and other-player selections atomically',()=>{
 const s=create(),p=s.players[0]!,before=JSON.stringify(s);
 for(const preludeIds of [undefined,[p.preludes[0]!.tileId,p.preludes[0]!.tileId],[p.preludes[0]!.tileId,s.players[1]!.preludes[0]!.tileId]]){
 const r=applyMarsAction(s,p.playerId,{type:'SETUP',corporationId:'Beginner',cardIds:[],...(preludeIds?{preludeIds}:{})},now,s.transitionId,random);assert.equal(r.ok,false);assert.equal(JSON.stringify(s),before);}
});
test('Mars all 35 Prelude cards execute from their real catalog and leave tags in play without action consumption',()=>{
 for(const d of MARS_PRELUDES){let s=create();const owner=s.players[0]!,first=owner.playerId;const card=move(s,d.id,owner.preludes);owner.preludes=[card,...owner.preludes.filter(c=>c!==card)];s=setup(s);rich(s);move(s,'PowerPlant',s.players[0]!.hand);
  try {s=settle(command(s,{type:'TAKE',actionId:`prelude:${card.tileId}`}));assert.ok(s.players[0]!.played.some(c=>c.tileId===card.tileId),d.id);assert.equal(s.actionsTaken,0);assert.equal(s.activePlayerId,first);assert.equal(s.players[0]!.preludes.length,1);parseMarsState(s);}catch(error){throw new Error(d.id+': '+String(error));}
 }
});
test('Mars Prelude execution proceeds in seat order, survives parsing, then gives first player an ordinary turn',()=>{
 let s=setup(create(false,5));const first=s.startingPlayerId;let steps=0;
 while(s.stage==='PRELUDE'&&steps++<30){const actor=s.activePlayerId,offer=marsOffers(s,actor)[0];assert.ok(offer);s=settle(command(parseMarsState(s),{type:'TAKE',actionId:offer.id}));assert.equal(s.actionsTaken,0);}
 assert.equal(s.stage,'ACTION');assert.equal(s.activePlayerId,first);assert.ok(s.players.every(p=>p.preludes.length===0));
});
test('Mars impossible Prelude reveals and refunds only that card; first Prelude can fund the second',()=>{
 let s=create();const p=s.players[0]!,business=move(s,'BusinessEmpire',p.preludes),donation=move(s,'Donation',p.preludes);p.preludes=[business,donation,...p.preludes.filter(c=>c!==business&&c!==donation)];s=setup(s);s.players[0]!.resources.money=0;
 const invalid=marsOffers(s,s.activePlayerId).find(o=>o.targetId===business.tileId)!;assert.match(invalid.detail,/15 M€/);const refunded=settle(command(s,{type:'TAKE',actionId:invalid.id}));assert.equal(refunded.players[0]!.resources.money,15);assert.ok(refunded.preludeDiscard.some(c=>c.tileId===business.tileId));assert.equal(refunded.players[0]!.production.money,0);
 s=settle(command(s,{type:'TAKE',actionId:`prelude:${donation.tileId}`}));assert.equal(s.players[0]!.resources.money,21);assert.doesNotMatch(marsOffers(s,s.activePlayerId).find(o=>o.targetId===business.tileId)!.detail,/환급/);s=settle(command(s,{type:'TAKE',actionId:`prelude:${business.tileId}`}));assert.equal(s.players[0]!.resources.money,15);assert.equal(s.players[0]!.production.money,6);
});
test('Mars Prelude instant project discount is scoped to one payment, cancellation retains choice, and cannot bypass required tags',()=>{
 let s=create();const p=s.players[0]!,sponsor=move(s,'EccentricSponsor',p.preludes);p.preludes=[sponsor,...p.preludes.filter(c=>c!==sponsor)];s=setup(s);const card=move(s,'PowerPlant',s.players[0]!.hand);s=command(s,{type:'TAKE',actionId:`prelude:${sponsor.tileId}`});s=command(s,{type:'TAKE',actionId:`instant:${card.tileId}`});assert.equal(s.payment?.cost,0);s=command(s,{type:'TAKE',actionId:'cancel'});assert.equal(s.current?.effect.kind,'instantProject');s=command(s,{type:'TAKE',actionId:`instant:${card.tileId}`});s=settle(s);assert.ok(s.players[0]!.played.some(c=>c.tileId===card.tileId));assert.equal(s.current,null);assert.equal(s.players[0]!.nextCardDiscount,0);
});
test('Mars Prelude project cards play with actual payment, volcano ignores adjacent city, and wild tags never add final Jovian VP',()=>{
 for(const d of MARS_PRELUDE_PROJECTS){let s=actionReady();rich(s);const p=s.players[0]!;p.corporationId='UnitedNationsMarsInitiative';move(s,'Cartel',p.played);const c=move(s,d.id,p.hand);s.temperature=-30;s.oxygen=0;
  s=settle(command(s,{type:'TAKE',actionId:`card:${c.tileId}`}));assert.ok(s.players[0]!.played.some(x=>x.tileId===c.tileId),d.id);
 }
 let s=actionReady();rich(s);const p=s.players[0]!;move(s,'ResearchCoordination',p.played);move(s,'GanymedeColony',p.played);const before=scoreMars(s)[0]!.cards;move(s,'ResearchNetwork',p.played);assert.equal(scoreMars(s)[0]!.cards,before);
});
test('Mars Psychrophiles payment rejects microbes on non-plant cards and overdraw, and consumes exactly the submitted amount',()=>{
 let s=actionReady();rich(s);const p=s.players[0]!,microbe=move(s,'Psychrophiles',p.played);microbe.resources=3;const card=move(s,'AdaptedLichen',p.hand);s=command(s,{type:'TAKE',actionId:`card:${card.tileId}`});const cost=s.payment!.cost;
 const bad=applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:cost,steel:0,titanium:0,heat:0,microbes:4}},now,s.transitionId,random);assert.equal(bad.ok,false);s=command(s,{type:'PAY',payment:{money:Math.max(0,cost-4),steel:0,titanium:0,heat:0,microbes:2}});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===microbe.tileId)!.resources,1);
 s.actionsTaken=0;s.activePlayerId=p.playerId;const other=move(s,'PowerPlant',s.players[0]!.hand);s=command(s,{type:'TAKE',actionId:`card:${other.tileId}`});assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:s.payment!.cost,steel:0,titanium:0,heat:0,microbes:1}},now,s.transitionId,random).ok,false);
});
test('Mars wild tag cannot be spent twice on simultaneous biological requirements',()=>{
 const s=actionReady();rich(s);const p=s.players[0]!;// Remove Prelude tags without losing inventory.
 s.preludeDiscard.push(...p.played.filter(c=>marsCard(c.definitionId).type==='prelude'));p.played=p.played.filter(c=>marsCard(c.definitionId).type!=='prelude');p.corporationId='Beginner';
 move(s,'ResearchCoordination',p.played);assert.notEqual(marsCardReason(s,p,marsCard('AdvancedEcosystems')),null);move(s,'Fish',p.played);move(s,'Tardigrades',p.played);assert.equal(marsCardReason(s,p,marsCard('AdvancedEcosystems')),null);
});

test('Mars Prelude corporations apply setup effects, scoped discounts, Earth draws, free award and minimum production action',()=>{
 for(const id of ['CheungShingMARS','PointLuna','RobinsonIndustries','ValleyTrust','Vitor']){
  let s=create();s.players[0]!.corporations=[id,'CrediCor'];
  for(const [i,p] of s.players.entries())s=command(s,{type:'SETUP',corporationId:i===0?id:'Beginner',cardIds:[],preludeIds:p.preludes.slice(0,2).map(c=>c.tileId)},p.playerId);
  const p=s.players[0]!;
  if(id==='CheungShingMARS'){assert.equal(p.production.money,3);assert.equal(p.resources.money,44);}
  if(id==='PointLuna'){assert.equal(p.production.titanium,1);assert.equal(p.hand.length,1);}
  if(id==='Vitor')assert.equal(p.resources.money,48);
  // Isolate the corporate action after completing initial Prelude resolution.
  for(let i=0;i<40&&s.stage==='PRELUDE';i++)s=settle(command(s,{type:'TAKE',actionId:marsOffers(s,s.activePlayerId)[0]!.id}));
  s.activePlayerId=p.playerId;s.actionsTaken=0;rich(s);
  if(id==='ValleyTrust'){
   s=command(s,{type:'TAKE',actionId:'initial-prelude'});assert.equal(s.players[0]!.preludes.length,3);const before=s.players[0]!.played.length;
   s=settle(command(s,{type:'TAKE',actionId:marsOffers(s,s.activePlayerId)[0]!.id}));assert.equal(s.players[0]!.played.length,before+1);assert.equal(s.players[0]!.preludes.length,0);assert.equal(s.actionsTaken,1);
  }else if(id==='Vitor'){
   s=command(s,{type:'TAKE',actionId:'initial-award:banker'});assert.equal(s.awards.length,1);assert.equal(s.players[0]!.resources.money,200);
   const c=move(s,'SFMemorial',s.players[0]!.hand);s=settle(command(s,{type:'TAKE',actionId:`card:${c.tileId}`}));assert.equal(s.players[0]!.resources.money,196);
  }else if(id==='RobinsonIndustries'){
   s.players[0]!.production.money=-2;const options=marsOffers(s,s.activePlayerId).filter(o=>o.id.startsWith('robinson:'));assert.deepEqual(options.map(o=>o.id),['robinson:money']);s=settle(command(s,{type:'TAKE',actionId:options[0]!.id}));assert.equal(s.players[0]!.production.money,-1);assert.equal(s.players[0]!.resources.money,196);assert.equal(marsOffers(s,s.activePlayerId).some(o=>o.id.startsWith('robinson:')),false);
  }else{
   const c=move(s,id==='PointLuna'?'Sponsors':'PowerPlant',s.players[0]!.hand),before=s.players[0]!.hand.length;
   s=command(s,{type:'TAKE',actionId:`card:${c.tileId}`});assert.equal(s.payment!.cost,marsCard(c.definitionId).cost-(id==='CheungShingMARS'?2:0));s=settle(s);if(id==='PointLuna')assert.equal(s.players[0]!.hand.length,before);
  }
 }
});
test('Mars lava city can touch another city and Ecology Experts ignores globals only',()=>{
 let s=actionReady();rich(s);const p=s.players[0]!;s.tiles.push({spaceId:'2-1',kind:'city',ownerId:s.players[1]!.playerId,source:'city'});const c=move(s,'LavaTubeSettlement',p.hand);s=settle(command(s,{type:'TAKE',actionId:`card:${c.tileId}`}));assert.ok(s.tiles.some(t=>t.source==='LavaTubeSettlement'));
 s=actionReady();rich(s);const owner=s.players[0]!;s.current={id:s.nextJob++,source:'EcologyExperts',effect:{kind:'instantProject',discount:0,ignoreGlobal:true}};s.actionInProgress=true;s.temperature=-30;s.oxygen=0;
 assert.equal(marsCardReason(s,owner,marsCard('Fish')),null);s.preludeDiscard.push(...owner.played.filter(c=>marsCard(c.definitionId).type==='prelude'));owner.played=owner.played.filter(c=>marsCard(c.definitionId).type!=='prelude');owner.corporationId='Beginner';assert.notEqual(marsCardReason(s,owner,marsCard('AdvancedEcosystems')),null);owner.production.energy=0;assert.notEqual(marsCardReason(s,owner,marsCard('LavaTubeSettlement')),null);
});

test('Mars Valley Trust applies science discount for each printed tag, without turning wild into a discount',()=>{
 const s=actionReady(),p=s.players[0]!;p.corporationId='ValleyTrust';assert.equal(marsCost(p,marsCard('Research')),7);assert.equal(marsCost(p,marsCard('ResearchCoordination')),4);
});
