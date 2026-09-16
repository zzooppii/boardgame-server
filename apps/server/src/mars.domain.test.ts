import { marsCorporationStart } from './games/mars/domain/corporation-start.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,MARS_CARDS,MARS_CORPORATE_ERA_PROTECTION_EFFECTS,MARS_CORPORATE_ERA_ECONOMIC_EFFECTS,MARS_BOARD,MARS_CORPORATIONS,marsResources,MarsPlayingProjectionSchema,type MarsAction,type MarsOffer,type MarsCard,type MarsEffect} from '@hangul-rummikub/shared';
import {createMarsGame,applyMarsAction,marsOffers,parseMarsState,marsSpaces,marsCardReason,scoreMars,cancelMars,type MarsState} from './games/mars/domain/game.js';
import {projectMars} from './games/mars/compatibility/projector.js';
let serial=0;const now=v.parse(ServerTimeSchema,1000);
function rng(seed=42){return {nextInt(max:number){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;}};}
const random=rng();
function create(n=2,seed=42){return createMarsGame({generateTileId:()=>v.parse(TileIdSchema,'mars-card-'+(++serial)),gameId:v.parse(GameIdSchema,'mars-game'),playerIds:Array.from({length:n},(_,i)=>v.parse(PlayerIdSchema,'mars-player-'+i)),now,turnId:v.parse(TurnIdSchema,'mars-turn-'+(++serial)),random:rng(seed)});}
function command(s:MarsState,payload:MarsAction,id=s.activePlayerId){const result=applyMarsAction(s,id,payload,now,v.parse(TurnIdSchema,'mars-turn-'+(++serial)),random);assert.ok(result.ok,JSON.stringify(payload));return result.state;}
function ready(n=2,seed=42){let s=create(n,seed);for(const p of s.players)s=command(s,{type:'SETUP',corporationId:'Beginner',cardIds:[]},p.playerId);return s;}
function act(s:MarsState,predicate:(o:MarsOffer)=>boolean){const o=marsOffers(s,s.activePlayerId).find(predicate);assert.ok(o,'Expected legal offer');return command(s,{type:'TAKE',actionId:o.id});}
function settle(s:MarsState){for(let i=0;i<100&&(s.frames.length||s.current||s.payment);i++){if(s.payment)s=command(s,{type:'PAY',payment:{money:s.payment.cost,steel:0,titanium:0,heat:0}});else s=act(s,()=>true);}assert.equal(s.frames.length,0);assert.equal(s.current,null);assert.equal(s.payment,null);return s;}
function give(s:MarsState,id:string,owner=s.activePlayerId,played=false):MarsCard{const zones=[s.deck,s.discard,...s.players.flatMap(p=>[p.hand,p.research,p.played])],p=s.players.find(p=>p.playerId===owner)!;let found:MarsCard|undefined;for(const zone of zones){const i=zone.findIndex(c=>c.definitionId===id);if(i>=0){found=zone.splice(i,1)[0];break;}}assert.ok(found);(played?p.played:p.hand).push(found);for(const x of s.players)x.handCount=x.hand.length;return found;}
function rich(s:MarsState){for(const p of s.players){p.resources=marsResources({money:500,steel:20,titanium:20,plants:20,energy:20,heat:20});p.production=marsResources({money:10,steel:10,titanium:10,plants:10,energy:10,heat:10});}}
function projection(s:MarsState,id=s.activePlayerId){return projectMars({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:s.finishedAt,state:s},id)!;}
test('Mars base inventory, 61-space map, 2–5 participants and private research projections',()=>{assert.equal(MARS_CARDS.length,137);assert.equal(MARS_CORPORATIONS.length,10);assert.equal(MARS_BOARD.length,61);assert.equal(MARS_BOARD.filter(b=>b.ocean).length,12);for(const n of [2,3,4,5]){let s=create(n);assert.equal(s.inventory.length,137);for(const p of s.players){assert.equal(p.research.length,10);const g=projection(s,p.playerId);v.parse(MarsPlayingProjectionSchema,g);const wire=JSON.stringify(g);for(const other of s.players.filter(o=>o!==p))for(const c of other.research)assert.equal(wire.includes(c.tileId),false);assert.equal(wire.includes(s.deck[0]!.tileId),false);}const first=s.players[0]!;s=command(s,{type:'SETUP',corporationId:first.corporations[0]!,cardIds:[first.research[0]!.tileId]},first.playerId);const otherView=projection(s,s.players[1]!.playerId);assert.equal(otherView.playerStates[0]!.corporationId,null);assert.equal(otherView.playerStates[0]!.resources.money,0);}});
test('Mars forged, foreign and malformed actions never change state',()=>{const s=ready(),before=structuredClone(s);assert.equal(applyMarsAction(s,s.players[1]!.playerId,{type:'TAKE',actionId:'pass'},now,s.transitionId,random).ok,false);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:'card:'+s.players[1]!.hand[0]!.tileId},now,s.transitionId,random).ok,false);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:-1,steel:0,titanium:0,heat:0}},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);const corrupt=structuredClone(s);corrupt.deck[0]=corrupt.deck[1]!;assert.throws(()=>parseMarsState(corrupt));});
test('Mars setup charges selected cards, applies corporation bonuses and rejects duplicate selections',()=>{let s=create();const p=s.players[0]!;p.corporations=['EcoLine','Helion'];const ids=p.research.slice(0,2).map(c=>c.tileId);const before=structuredClone(s);assert.equal(applyMarsAction(s,p.playerId,{type:'SETUP',corporationId:'EcoLine',cardIds:[ids[0],ids[0]]},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);s=command(s,{type:'SETUP',corporationId:'EcoLine',cardIds:ids},p.playerId);assert.equal(s.players[0]!.resources.money,30);assert.equal(s.players[0]!.resources.plants,3);assert.equal(s.players[0]!.production.plants,3);assert.equal(s.players[0]!.hand.length,2);assert.equal(s.discard.length,8);});
test('Mars one action may end the turn but does not pass the generation',()=>{let s=ready();const owner=s.activePlayerId;s=act(s,o=>o.id==='project:power');assert.ok(s.payment);assert.equal(s.players[0]!.production.energy,1,'Unpaid project cannot grant its reward');assert.equal(marsOffers(s,owner).length,0);s=settle(s);assert.equal(s.actionsTaken,1);assert.equal(s.players[0]!.production.energy,2);assert.equal(marsOffers(s,owner).some(o=>o.kind==='PASS'),false);s=act(s,o=>o.kind==='END');assert.notEqual(s.activePlayerId,owner);assert.equal(s.players[0]!.passed,false);s=act(s,o=>o.kind==='PASS');assert.equal(s.activePlayerId,owner);});
test('Mars mixed card payment, no refund for material overpayment and generation-limited actions',()=>{let s=ready();rich(s);const c=give(s,'Ironworks');s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);const before=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:0,steel:0,titanium:4,heat:0}},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);s=command(s,{type:'PAY',payment:{money:0,steel:6,titanium:0,heat:0}});assert.equal(s.players[0]!.resources.steel,14);assert.equal(s.players[0]!.resources.money,500);s=act(s,o=>o.kind==='ACTION'&&o.targetId===c.tileId);s=settle(s);assert.equal(s.players[0]!.resources.energy,16);assert.equal(s.players[0]!.resources.steel,15);assert.equal(s.oxygen,1);s.activePlayerId=s.players[0]!.playerId;s.actionsTaken=0;assert.equal(marsOffers(s,s.activePlayerId).some(o=>o.kind==='ACTION'&&o.targetId===c.tileId),false);});
test('Mars greenery triggers oxygen 8%, temperature zero, bonus ocean, TR and ocean adjacency',()=>{let s=ready();rich(s);s.oxygen=7;s.temperature=-2;const owner=s.activePlayerId;const original=s.players[0]!.tr;s=act(s,o=>o.id==='plants');s=act(s,o=>o.kind==='PLACE'&&o.targetId==='4-7');assert.equal(s.oxygen,8);assert.equal(s.temperature,0);assert.ok(s.current?.effect.kind==='place');s=act(s,o=>o.kind==='PLACE'&&o.targetId==='4-8');assert.equal(s.oceans,1);assert.equal(s.players[0]!.tr,original+3);assert.equal(s.actionsTaken,1);assert.equal(s.activePlayerId,owner);});
test('Mars placement respects ocean, ownership, adjacent cities and reserved tiles',()=>{const s=ready(),id=s.activePlayerId;s.tiles.push({spaceId:'4-4',kind:'city',ownerId:id,source:'city'});assert.equal(marsSpaces(s,id,'city').includes('4-5'),false);assert.equal(marsSpaces(s,id,'greenery').includes('4-5'),true);assert.equal(marsSpaces(s,id,'greenery').includes('1-1'),false);assert.equal(marsSpaces(s,id,'city').includes('5-3'),false);assert.deepEqual(marsSpaces(s,id,'city','noctis'),['5-3']);assert.ok(marsSpaces(s,id,'greenery','greeneryOcean').every(x=>MARS_BOARD.find(b=>b.id===x)?.ocean));assert.ok(marsSpaces(s,id,'ocean','oceanLand').every(x=>!MARS_BOARD.find(b=>b.id===x)?.ocean));});
test('Mars production converts old energy before generating fresh energy, and rotates first player',()=>{let s=ready();s.players[0]!.resources.energy=5;s.players[0]!.resources.heat=3;s.players[0]!.production.energy=2;s.players[0]!.production.heat=4;const money=s.players[0]!.resources.money;s=act(s,o=>o.id==='pass');s=act(s,o=>o.id==='pass');assert.equal(s.generation,2);assert.equal(s.stage,'RESEARCH');assert.equal(s.players[0]!.resources.heat,12);assert.equal(s.players[0]!.resources.energy,2);assert.equal(s.players[0]!.resources.money,money+21);assert.equal(s.startingPlayerId,s.players[1]!.playerId);assert.equal(s.players[0]!.research.length,4);assert.equal(s.players[0]!.hand.length,10);});
test('Mars every basic project passes real requirements, payment and pending effects without deadlock',()=>{for(const d of MARS_CARDS){let s=ready();rich(s);const p=s.players[0]!;const c=give(s,d.id);
 for(const req of d.requirements){if(req.kind==='oxygen')s.oxygen=req.amount;else if(req.kind==='temperature')s.temperature=req.amount;else if(req.kind==='oceans'){for(const b of MARS_BOARD.filter(b=>b.ocean).slice(0,req.amount))s.tiles.push({spaceId:b.id,kind:'ocean',ownerId:null,source:'ocean'});s.oceans=req.amount;}else if(req.kind==='greenery')s.tiles.push({spaceId:'7-4',kind:'greenery',ownerId:p.playerId,source:'greenery'});else{for(const tagCard of MARS_CARDS.filter(x=>x.id!==d.id&&x.type!=='event'&&x.tags.includes(req.kind)).slice(0,req.amount))give(s,tagCard.id,p.playerId,true);}}
 if(d.id==='UrbanizedArea'){s.tiles.push({spaceId:'4-3',kind:'city',ownerId:p.playerId,source:'city'},{spaceId:'4-5',kind:'city',ownerId:p.playerId,source:'city'});}
 try{assert.equal(marsCardReason(s,p,d),null,d.id);s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);s=settle(s);assert.ok(s.players[0]!.played.some(x=>x.tileId===c.tileId));parseMarsState(s);}catch(e){throw new Error(d.id+': '+String(e));}
}});
test('Mars final production, last greenery and city adjacency score are included before winner selection',()=>{let s=ready();s.oxygen=14;s.temperature=8;for(const b of MARS_BOARD.filter(b=>b.ocean).slice(0,9))s.tiles.push({spaceId:b.id,kind:'ocean',ownerId:null,source:'ocean'});s.oceans=9;s.players[0]!.resources.plants=7;s=act(s,o=>o.id==='pass');s=act(s,o=>o.id==='pass');assert.equal(s.stage,'FINAL_GREENERY');assert.equal(s.phase,'PLAYING');s=act(s,o=>o.id==='final-greenery');s=settle(s);s=act(s,o=>o.id==='final-pass');s=act(s,o=>o.id==='final-pass');assert.equal(s.phase,'FINISHED');assert.equal(s.result!.scores[0]!.greenery,1);assert.equal(s.result!.scores.length,2);});
test('Mars award ties give shared first, shared second, and two-player awards omit second place',()=>{const s=ready(4),ids=s.players.map(p=>p.playerId);s.awards=[{id:'thermalist',playerId:ids[3]!}];s.players.forEach((p,i)=>p.resources.heat=[8,8,3,1][i]!);assert.deepEqual(scoreMars(s).map(p=>p.awards),[5,5,0,0]);s.players.forEach((p,i)=>p.resources.heat=[8,3,3,1][i]!);assert.deepEqual(scoreMars(s).map(p=>p.awards),[5,2,2,0]);const two=ready();two.awards=[{id:'thermalist',playerId:two.players[0]!.playerId}];two.players[0]!.resources.heat=4;assert.deepEqual(scoreMars(two).map(p=>p.awards),[5,0]);});
test('Mars 2–5-player seeded games finish using actual standard projects, conversions, production and final greenery',()=>{for(const n of [2,3,4,5]){let s=ready(n,n*31);const kinds=new Set<string>();for(let step=0;s.phase==='PLAYING'&&step<2500;step++){
 if(s.stage==='RESEARCH'){const p=s.players.find(p=>!p.ready)!;s=command(s,{type:'RESEARCH',cardIds:[]},p.playerId);continue;}
 if(s.payment){s=command(s,{type:'PAY',payment:{money:s.payment.cost,steel:0,titanium:0,heat:0}});continue;}
 const offers=marsOffers(s,s.activePlayerId);const selected=s.current||s.frames.length?offers[0]:offers.find(o=>o.id==='plants'&&s.oxygen<14)||offers.find(o=>o.id==='heat')||offers.find(o=>o.id==='project:aquifer')||offers.find(o=>o.id==='project:greenery'&&s.oxygen<14)||offers.find(o=>o.id==='project:asteroid')||offers.find(o=>o.id==='final-greenery')||offers.find(o=>o.kind==='END'||o.kind==='PASS');assert.ok(selected,'No deadlock in '+n+'p');kinds.add(selected.kind);s=command(s,{type:'TAKE',actionId:selected.id});}
 assert.equal(s.phase,'FINISHED');assert.equal(s.oceans,9);assert.equal(s.oxygen,14);assert.equal(s.temperature,8);assert.equal(s.result?.scores.length,n);assert.ok(kinds.has('PLACE'));assert.ok(kinds.has('CONVERT'));}});

test('Mars sells multiple patents for one action and rejects duplicate or foreign cards',()=>{let s=ready();const ids=s.players[0]!.hand.slice(0,3).map(c=>c.tileId);const before=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'SELL',cardIds:[ids[0],ids[0]]},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);s=command(s,{type:'SELL',cardIds:ids});assert.equal(s.actionsTaken,1);assert.equal(s.players[0]!.hand.length,7);assert.equal(s.players[0]!.resources.money,45);});
test('Mars Helion can fund research using heat, other corporations cannot',()=>{let s=ready();s=act(s,o=>o.id==='pass');s=act(s,o=>o.id==='pass');const p=s.players[0]!;p.corporationId='Helion';p.resources.money=0;p.resources.heat=6;const ids=p.research.slice(0,2).map(c=>c.tileId);s=command(s,{type:'RESEARCH',cardIds:ids,heat:6},p.playerId);assert.equal(s.players[0]!.resources.heat,0);assert.equal(s.players[0]!.hand.length,12);const other=s.players[1]!;other.resources.heat=20;assert.equal(applyMarsAction(s,other.playerId,{type:'RESEARCH',cardIds:[other.research[0]!.tileId],heat:3},now,s.transitionId,random).ok,false);});

test('Mars herbivores trigger only for their owner and flooding resolves its own ocean first',()=>{let s=ready();rich(s);const herb=give(s,'Herbivores',s.players[1]!.playerId,true);s=act(s,o=>o.id==='plants');s=settle(s);assert.equal(s.players[1]!.played.find(c=>c.tileId===herb.tileId)!.resources,0);s.actionsTaken=0;const flood=give(s,'Flooding');s=act(s,o=>o.kind==='CARD'&&o.targetId===flood.tileId);s=command(s,{type:'PAY',payment:{money:7,steel:0,titanium:0,heat:0}});assert.ok(marsOffers(s,s.activePlayerId).every(o=>o.kind==='PLACE'));s=act(s,o=>o.kind==='PLACE');assert.ok(marsOffers(s,s.activePlayerId).some(o=>o.id==='skip'));s=settle(s);assert.equal(s.oceans,1);});

test('Mars Helion reserves mandatory heat costs before offering or paying for a card',()=>{let s=ready();const p=s.players[0]!;p.corporationId='Helion';p.resources.money=0;p.resources.heat=5;const c=give(s,'LocalHeatTrapping');assert.equal(marsOffers(s,p.playerId).some(o=>o.kind==='CARD'&&o.targetId===c.tileId),false);p.resources.money=1;s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);const before=structuredClone(s);assert.equal(applyMarsAction(s,p.playerId,{type:'PAY',payment:{money:0,steel:0,titanium:0,heat:1}},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);s=command(s,{type:'PAY',payment:{money:1,steel:0,titanium:0,heat:0}});s=settle(s);assert.equal(s.players[0]!.resources.heat,0);assert.equal(s.players[0]!.resources.plants,4);});

test('Mars action payment identifies the card by its readable name',()=>{let s=ready();rich(s);const c=give(s,'AquiferPumping',s.activePlayerId,true);s=act(s,o=>o.kind==='ACTION'&&o.targetId===c.tileId);assert.equal(projection(s).privateState.payment?.label,'대수층 펌프');assert.equal(projection(s).privateState.payment?.steel,true);});

test('Mars receiving available animal resources is mandatory, missing receivers may be skipped',()=>{
 let s=ready();rich(s);const fish=give(s,'Fish',s.activePlayerId,true),nitrogen=give(s,'ImportedNitrogen');
 s=act(s,o=>o.kind==='CARD'&&o.targetId===nitrogen.tileId);s=command(s,{type:'PAY',payment:{money:23,steel:0,titanium:0,heat:0}});
 s=act(s,o=>o.kind==='EFFECT'&&o.label.includes('동물'));
 assert.equal(marsOffers(s,s.activePlayerId).some(o=>o.id==='skip'),false);
 s=act(s,o=>o.id==='add:'+fish.tileId);assert.equal(s.players[0]!.played.find(c=>c.tileId===fish.tileId)!.resources,2);
 s=act(s,o=>o.kind==='EFFECT'&&o.label.includes('미생물'));assert.ok(marsOffers(s,s.activePlayerId).some(o=>o.id==='skip'));s=settle(s);
});
test('Mars stacked space discounts and Phobolog titanium pay the discounted amount',()=>{
 let s=ready();rich(s);const p=s.players[0]!;p.corporationId='PhoboLog';give(s,'ResearchOutpost',p.playerId,true);give(s,'Shuttles',p.playerId,true);const c=give(s,'Asteroid');
 s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);assert.equal(s.payment!.cost,11);
 s=command(s,{type:'PAY',payment:{money:3,steel:0,titanium:2,heat:0}});s=settle(s);assert.equal(s.players[0]!.resources.money,497);assert.equal(s.players[0]!.resources.titanium,20);assert.equal(s.temperature,-28);
});
test('Mars cinematic and aerobraking refunds trigger together once per space event',()=>{
 let s=ready();rich(s);s.players[0]!.corporationId='InterplanetaryCinematics';give(s,'OptimalAerobraking',s.activePlayerId,true);const c=give(s,'Asteroid');
 s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);s=settle(s);assert.equal(s.players[0]!.resources.money,491);assert.equal(s.players[0]!.resources.heat,23);assert.equal(s.players[1]!.resources.money,500);
});
test('Mars Credicor uses printed price after discounts and refunds standard greenery too',()=>{
 let s=ready();rich(s);s.players[0]!.corporationId='CrediCor';give(s,'ResearchOutpost',s.activePlayerId,true);give(s,'Shuttles',s.activePlayerId,true);const c=give(s,'Comet');
 s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);assert.equal(s.payment!.cost,18);s=settle(s);assert.equal(s.players[0]!.resources.money,486);
 s=act(s,o=>o.id==='project:greenery');assert.equal(s.payment!.cost,23);s=command(s,{type:'PAY',payment:{money:23,steel:0,titanium:0,heat:0}});s=act(s,o=>o.kind==='EFFECT'&&o.label.includes('녹지'));s=act(s,o=>o.kind==='PLACE'&&o.targetId==='3-4');s=settle(s);assert.equal(s.players[0]!.resources.money,467);
});
test('Mars city placement combines Tharsis, Immigrant City, Rover Construction and Pets; offworld excludes Tharsis income',()=>{
 let s=ready();rich(s);const p=s.players[0]!;p.corporationId='TharsisRepublic';give(s,'ImmigrantCity',p.playerId,true);give(s,'RoverConstruction',p.playerId,true);const pets=give(s,'Pets',p.playerId,true);
 s=act(s,o=>o.id==='project:city');s=command(s,{type:'PAY',payment:{money:25,steel:0,titanium:0,heat:0}});s=act(s,o=>o.kind==='EFFECT'&&o.label.includes('도시'));s=act(s,o=>o.kind==='PLACE'&&o.targetId==='1-3');s=settle(s);
 assert.equal(s.players[0]!.production.money,13);assert.equal(s.players[0]!.resources.money,480);assert.equal(s.players[0]!.played.find(c=>c.tileId===pets.tileId)!.resources,1);
 const phobos=give(s,'PhobosSpaceHaven');s=act(s,o=>o.kind==='CARD'&&o.targetId===phobos.tileId);s=settle(s);assert.equal(s.players[0]!.production.money,14);assert.equal(s.players[0]!.played.find(c=>c.tileId===pets.tileId)!.resources,2);
});
test('Mars Mining Guild gains one production per metal placement, in addition to Mining Rights production',()=>{
 let s=ready();rich(s);s.players[0]!.corporationId='MiningGuild';const c=give(s,'MiningRights');s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);s=command(s,{type:'PAY',payment:{money:9,steel:0,titanium:0,heat:0}});s=act(s,o=>o.kind==='PLACE'&&o.targetId==='1-1');assert.equal(s.players[0]!.resources.steel,22);assert.equal(s.players[0]!.production.steel,12);
});
test('Mars Decomposers and Ecological Zone count both printed life tags including the played card itself',()=>{
 let s=ready();rich(s);s.oxygen=3;give(s,'Decomposers',s.activePlayerId,true);s.tiles.push({spaceId:'7-4',kind:'greenery',ownerId:s.activePlayerId,source:'greenery'});const c=give(s,'EcologicalZone');s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.definitionId==='Decomposers')!.resources,2);assert.equal(s.players[0]!.played.find(c=>c.definitionId==='EcologicalZone')!.resources,2);
});

test('Mars setup reveals only readiness until every corporation is selected and preserves owner reconnect projection',()=>{
 let s=create(3);const owner=s.players[0]!,other=s.players[1]!,card=owner.research[0]!,corp=owner.corporations[0]!;
 s=command(s,{type:'SETUP',corporationId:corp,cardIds:[card.tileId]},owner.playerId);
 const mine=projection(s,owner.playerId),theirs=projection(s,other.playerId),hidden=theirs.playerStates.find(p=>p.playerId===owner.playerId)!;
 assert.equal(hidden.corporationId,null);assert.deepEqual(hidden.resources,marsResources());assert.deepEqual(hidden.production,marsResources());assert.equal(hidden.ready,true);
 assert.equal(JSON.stringify(theirs).includes(card.tileId),false);assert.equal(mine.playerStates.find(p=>p.playerId===owner.playerId)!.corporationId,corp);assert.ok(mine.privateState.hand.some(c=>c.tileId===card.tileId));
 assert.deepEqual(projection(parseMarsState(structuredClone(s)),owner.playerId),mine);
 for(const p of s.players.filter(p=>!p.ready))s=command(s,{type:'SETUP',corporationId:'Beginner',cardIds:[]},p.playerId);
 assert.equal(projection(s,other.playerId).playerStates.find(p=>p.playerId===owner.playerId)!.corporationId,corp);
});
test('Mars cancelling an unpaid card preserves resources, private cards, special design and action allowance',()=>{
 let s=ready();rich(s);const c=give(s,'PowerPlant');s.players[0]!.specialDesign=true;const before=structuredClone(s);
 s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);const pending=projection(s);assert.equal(pending.privateState.payment?.cancelable,true);
 assert.equal(projection(s,s.players[1]!.playerId).privateState.payment,null);
 const invalid=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:0,steel:0,titanium:0,heat:0}},now,s.transitionId,random).ok,false);assert.deepEqual(s,invalid);
 s=act(s,o=>o.kind==='CANCEL');assert.equal(s.payment,null);assert.deepEqual(s.players,before.players);assert.deepEqual(s.history,before.history);assert.equal(s.actionsTaken,before.actionsTaken);assert.equal(s.activePlayerId,before.activePlayerId);assert.equal(s.revision,before.revision+2);
});

test('Mars Landlord includes Phobos and Ganymede ownership, special tiles and shared first place',()=>{
 for(const count of [2,3]){
  let s=ready(count);rich(s);const owner=s.activePlayerId,opponent=s.players[1]!.playerId;
  s.tiles.push({spaceId:'1-3',kind:'special',ownerId:owner,source:'NaturalPreserve'},
   {spaceId:'2-2',kind:'city',ownerId:opponent,source:'city'},
   {spaceId:'3-3',kind:'greenery',ownerId:opponent,source:'greenery'});
  s.awards=[{id:'landlord',playerId:opponent}];
  const phobos=give(s,'PhobosSpaceHaven');s=act(s,o=>o.kind==='CARD'&&o.targetId===phobos.tileId);s=settle(s);
  assert.deepEqual(scoreMars(s).map(p=>p.awards),count===2?[5,5]:[5,5,0]);
  const ganymede=give(s,'GanymedeColony');s=act(s,o=>o.kind==='CARD'&&o.targetId===ganymede.tileId);s=settle(s);
  assert.deepEqual(scoreMars(s).map(p=>p.awards),count===2?[5,0]:[5,2,0]);
  // Ocean tiles have no owner and must not change this ranking.
  s.tiles.push({spaceId:'1-4',kind:'ocean',ownerId:null,source:'ocean'});s.oceans=1;
  assert.deepEqual(scoreMars(parseMarsState(s)).map(p=>p.awards),count===2?[5,0]:[5,2,0]);
 }
});


test('Mars Corporate Era setup omits only the base production bonus and keeps each corporation starting resources',()=>{
 for(const id of ['Beginner',...MARS_CORPORATIONS.map(c=>c.id)]){
  const base=marsCorporationStart(id,'base'),corporate=marsCorporationStart(id,'corporate-era');
  assert.deepEqual(corporate.resources,base.resources,id);
  for(const resource of ['money','steel','titanium','plants','energy','heat'] as const) assert.equal(corporate.production[resource],base.production[resource]-1,id+' '+resource);
 }
 const starts=[
  ['Beginner',42,{},{}],['CrediCor',57,{},{}],['EcoLine',36,{plants:3},{plants:2}],
  ['Helion',42,{},{heat:3}],['InterplanetaryCinematics',30,{steel:20},{}],['Inventrix',45,{},{}],
  ['MiningGuild',30,{steel:5},{steel:1}],['PhoboLog',23,{titanium:10},{}],
  ['TharsisRepublic',40,{},{}],['Thorgate',48,{},{energy:1}],['UnitedNationsMarsInitiative',40,{},{}],
 ] as const;
 for(const [id,money,stock,production] of starts) assert.deepEqual(marsCorporationStart(id,'corporate-era'),{resources:marsResources({money,...stock}),production:marsResources(production)},id);
 assert.deepEqual(marsCorporationStart('EcoLine','corporate-era').production,marsResources({plants:2}));
 assert.deepEqual(marsCorporationStart('Helion','corporate-era').production,marsResources({heat:3}));
 assert.deepEqual(marsCorporationStart('SaturnSystems','corporate-era'),{resources:marsResources({money:42}),production:marsResources({money:1,titanium:1})});
 assert.deepEqual(marsCorporationStart('Teractor','corporate-era'),{resources:marsResources({money:60}),production:marsResources()});
 assert.throws(()=>marsCorporationStart('SaturnSystems','base'),/Unknown Mars corporation/);
 assert.throws(()=>marsCorporationStart('Teractor','base'),/Unknown Mars corporation/);
 assert.throws(()=>marsCorporationStart('unknown','corporate-era'),/Unknown Mars corporation/);
});

test('Mars live base setup rejects unimplemented Corporate Era corporations without changing the game',()=>{
 const s=create(5),before=structuredClone(s);
 for(const corporationId of ['SaturnSystems','Teractor']){
  const result=applyMarsAction(s,s.players[0]!.playerId,{type:'SETUP',corporationId,cardIds:[]},now,s.transitionId,random);
  assert.equal(result.ok,false);assert.deepEqual(s,before);
 }
 assert.equal(s.inventory.length,137);
 assert.equal(new Set(s.players.flatMap(p=>p.corporations)).size,10);
});

test('Mars production effect queue executes economy rules against actual base tags and excludes opponents events',()=>{
 let s=ready();rich(s);const owner=s.activePlayerId,other=s.players[1]!.playerId;
 s.players[0]!.corporationId='UnitedNationsMarsInitiative';s.players[1]!.corporationId='Helion';
 for(const id of ['ResearchOutpost','PowerPlant','GanymedeColony'])give(s,id,owner,true);
 for(const id of ['Shuttles','Asteroid'])give(s,id,other,true);
 const before=s.players[0]!.production.money;
 s.frames=[[...(['earthIncome','buildingIncome','spaceIncome','opponentsSpaceIncome'] as const).map(rule=>({id:s.nextJob++,source:'경제 생산 효과',effect:{kind:'dynamic' as const,rule}}))]];
 s.actionInProgress=true;s=settle(s);
 assert.equal(s.players[0]!.production.money,before+5);
 assert.equal(s.players[1]!.production.money,10);assert.equal(s.actionsTaken,1);
});

test('Mars payment projection exposes canonical metal values and rejects client-supplied multipliers atomically',()=>{
 let s=ready();rich(s);s.players[0]!.corporationId='PhoboLog';const c=give(s,'Asteroid');
 s=act(s,o=>o.kind==='CARD'&&o.targetId===c.tileId);
 assert.equal(projection(s).privateState.payment!.steelValue,2);assert.equal(projection(s).privateState.payment!.titaniumValue,4);
 const before=structuredClone(s);
 assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:0,steel:0,titanium:3,heat:0,titaniumValue:5}},now,s.transitionId,random).ok,false);
 assert.deepEqual(s,before);
 assert.equal(applyMarsAction(s,s.activePlayerId,{type:'PAY',payment:{money:0,steel:0,titanium:3,heat:0}},now,s.transitionId,random).ok,false);
 assert.deepEqual(s,before);
 s=command(s,{type:'PAY',payment:{money:2,steel:0,titanium:3,heat:0}});s=settle(s);
 assert.equal(s.players[0]!.resources.money,498);assert.equal(s.players[0]!.resources.titanium,19);
});

function peek(s:MarsState,effect:MarsEffect){s.frames=[[{id:s.nextJob++,source:'비공개 열람 검증',effect}]];s.actionInProgress=true;return act(s,o=>o.kind==='EFFECT');}
test('Mars keep-card effects hold private cards outside the hand and restore the same pending choice',()=>{
 let s=peek(ready(3),{kind:'keepCards',count:4,keep:2});const choice=s.cardChoice!.view,owner=s.activePlayerId,other=s.players[1]!.playerId;
 assert.equal(choice.kind,'KEEP');assert.equal(choice.cards.length,4);assert.equal(s.deck.length,103);assert.equal(s.players[0]!.hand.length,10);
 assert.deepEqual(marsOffers(s,owner),[]);assert.deepEqual(projection(parseMarsState(structuredClone(s)),owner),projection(s,owner));
 const wire=JSON.stringify(projection(s,other));assert.equal(projection(s,other).privateState.cardChoice,null);
 for(const c of choice.cards){assert.equal(wire.includes(c.tileId),false);assert.equal(wire.includes(c.definitionId),false);}
 const kept=choice.cards.slice(0,2).map(c=>c.tileId),before=structuredClone(s);
 for(const payload of [
  {type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[]},
  {type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[kept[0],kept[0]]},
  {type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[kept[0],s.players[1]!.hand[0]!.tileId]},
  {type:'CHOOSE_CARDS',choiceId:choice.id+1,cardIds:kept},
  {type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:kept,heat:1},
  {type:'TAKE',actionId:'pass'},
  {type:'SELL',cardIds:[s.players[0]!.hand[0]!.tileId]},
 ]){assert.equal(applyMarsAction(s,owner,payload,now,s.transitionId,random).ok,false);assert.deepEqual(s,before);}
 assert.equal(applyMarsAction(s,other,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:kept},now,s.transitionId,random).ok,false);
 s=command(s,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:kept});
 assert.equal(s.cardChoice,null);assert.equal(s.players[0]!.hand.length,12);assert.equal(s.discard.length,2);assert.equal(s.players[0]!.resources.money,42);assert.equal(s.actionsTaken,1);
 const publicHistory=JSON.stringify(s.history);for(const c of choice.cards){assert.equal(publicHistory.includes(c.tileId),false);assert.equal(publicHistory.includes(c.definitionId),false);}
 assert.equal(applyMarsAction(s,owner,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:kept},now,s.transitionId,random).ok,false);
});

test('Mars buying a viewed card costs three without card discounts and Helion can pay with heat',()=>{
 let s=ready();s.players[0]!.corporationId='Helion';give(s,'ResearchOutpost',s.activePlayerId,true);s.players[0]!.resources.money=1;s.players[0]!.resources.heat=2;
 s=peek(s,{kind:'buyCard'});const choice=s.cardChoice!.view;assert.equal(choice.kind,'BUY');assert.equal(projection(s).privateState.cardChoice?.kind,'BUY');
 const cards=[choice.cards[0]!.tileId],before=structuredClone(s);
 for(const heat of [0,1,3]){assert.equal(applyMarsAction(s,s.activePlayerId,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:cards,heat},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);}
 s=command(s,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:cards,heat:2});assert.equal(s.players[0]!.resources.money,0);assert.equal(s.players[0]!.resources.heat,0);assert.ok(s.players[0]!.hand.some(c=>c.tileId===cards[0]));assert.equal(s.cardChoice,null);
 let other=ready();other.players[0]!.resources.money=0;other.players[0]!.resources.heat=3;other=peek(other,{kind:'buyCard'});const c=other.cardChoice!.view;
 assert.equal(applyMarsAction(other,other.activePlayerId,{type:'CHOOSE_CARDS',choiceId:c.id,cardIds:[c.cards[0]!.tileId],heat:3},now,other.transitionId,random).ok,false);
 other=command(other,{type:'CHOOSE_CARDS',choiceId:c.id,cardIds:[]});assert.equal(other.players[0]!.resources.heat,3);assert.equal(other.discard[0]!.tileId,c.cards[0]!.tileId);assert.equal(other.actionsTaken,1);
});

test('Mars viewed cards stay conserved when the deck reshuffles or has fewer cards than requested',()=>{
 let s=ready();s.discard.push(...s.deck.splice(1));s=peek(s,{kind:'keepCards',count:4,keep:2});assert.equal(new Set(s.cardChoice!.view.cards.map(c=>c.tileId)).size,4);parseMarsState(s);
 for(const available of [0,1]){
  let short=ready();short.players[1]!.hand.push(...short.deck.splice(available));short.players[1]!.handCount=short.players[1]!.hand.length;
  short=peek(short,{kind:'keepCards',count:4,keep:2});
  if(available){const c=short.cardChoice!.view;assert.ok(c.kind==='KEEP');assert.equal(c.keepCount,1);short=command(short,{type:'CHOOSE_CARDS',choiceId:c.id,cardIds:c.cards.map(c=>c.tileId)});assert.equal(short.players[0]!.hand.length,11);}
  assert.equal(short.cardChoice,null);assert.equal(short.actionsTaken,1);parseMarsState(short);
 }
});

test('Mars cancelling while viewing cards clears the choice without losing cards or leaking them',()=>{
 const s=peek(ready(),{kind:'keepCards',count:3,keep:1}),cards=s.cardChoice!.view.cards;
 const invalid=structuredClone(s);invalid.cardChoice!.ownerId=s.players[1]!.playerId;assert.throws(()=>parseMarsState(invalid),/private card choice/);
 const duplicate=structuredClone(s);duplicate.deck.push(duplicate.cardChoice!.view.cards[0]!);assert.throws(()=>parseMarsState(duplicate),/inventory/);
 const ended=cancelMars(s,now);assert.equal(ended.phase,'FINISHED');assert.equal(ended.cardChoice,null);for(const c of cards)assert.ok(ended.discard.some(d=>d.tileId===c.tileId));
 assert.equal(projection(ended).privateState.cardChoice,null);parseMarsState(ended);
});


test('Mars next-card discount combines with permanent discounts and is consumed only by successful card payment',()=>{
 let s=peek(ready(),MARS_CORPORATE_ERA_ECONOMIC_EFFECTS.IndenturedWorkers[0]);
 const id=s.activePlayerId;
 give(s,'ResearchOutpost',id,true);
 const card=give(s,'PowerGrid');
 assert.equal(projection(s).privateState.nextCardDiscount,8);
 assert.equal(projection(s).privateState.cardStatus.find(c=>c.tileId===card.tileId)!.cost,9);
 s=act(s,o=>o.id==='card:'+card.tileId);
 assert.equal(s.payment!.cost,9);
 const before=structuredClone(s);
 assert.equal(applyMarsAction(s,id,{type:'PAY',payment:{money:8,steel:0,titanium:0,heat:0}},now,s.transitionId,random).ok,false);
 assert.deepEqual(s,before);
 s=act(s,o=>o.id==='cancel');assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,8);
 s=act(s,o=>o.id==='card:'+card.tileId);
 s=command(s,{type:'PAY',payment:{money:9,steel:0,titanium:0,heat:0}});
 assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,0);
 assert.equal(s.players.find(p=>p.playerId===id)!.resources.money,33);
 assert.equal(projection(s,id).privateState.nextCardDiscount,0);
});

test('Mars unused next-card discount survives standard projects, selling and turn changes but expires at production',()=>{
 let s=peek(ready(),MARS_CORPORATE_ERA_ECONOMIC_EFFECTS.IndenturedWorkers[0]);
 const id=s.activePlayerId;
 s=act(s,o=>o.id==='project:power');assert.equal(s.payment!.cost,11);
 s=command(s,{type:'PAY',payment:{money:11,steel:0,titanium:0,heat:0}});
 assert.notEqual(s.activePlayerId,id);assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,8);
 s=act(s,o=>o.id==='pass');assert.equal(s.activePlayerId,id);
 const sold=s.players.find(p=>p.playerId===id)!.hand[0]!;
 s=command(s,{type:'SELL',cardIds:[sold.tileId]});assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,8);
 s=act(s,o=>o.id==='end');s=act(s,o=>o.id==='pass');assert.equal(s.stage,'RESEARCH');assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,0);
});

test('Mars next-card discount is not a card-purchase discount and never carries a surplus to a second project',()=>{
 let s=peek(ready(),MARS_CORPORATE_ERA_ECONOMIC_EFFECTS.IndenturedWorkers[0]);
 const id=s.activePlayerId;
 s=peek(s,{kind:'buyCard'});const choice=s.cardChoice!.view;
 s=command(s,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[choice.cards[0]!.tileId]});
 assert.equal(s.players.find(p=>p.playerId===id)!.resources.money,39);
 assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,8);
 s=act(s,o=>o.id==='pass');assert.equal(s.activePlayerId,id);
 const cheap=give(s,'SearchForLife');
 s=act(s,o=>o.id==='card:'+cheap.tileId);assert.equal(s.payment!.cost,0);
 s=command(s,{type:'PAY',payment:{money:0,steel:0,titanium:0,heat:0}});
 assert.equal(s.players.find(p=>p.playerId===id)!.nextCardDiscount,0);
 const next=give(s,'PowerPlant');assert.equal(projection(s,id).privateState.cardStatus.find(c=>c.tileId===next.tileId)!.cost,4);
});


test('Mars optional hand exchange preserves privacy, rejects invalid discards and draws only after confirmation',()=>{
 let s=peek(ready(3),{kind:'exchangeCard'});const owner=s.activePlayerId,p=s.players.find(p=>p.playerId===owner)!,choice=s.cardChoice!.view;
 assert.equal(choice.kind,'EXCHANGE');assert.deepEqual(choice.cards,[]);assert.equal(p.hand.length,10);
 const card=p.hand[0]!,next=s.deck[0]!,before=structuredClone(s);
 for(const cards of [[s.players[1]!.hand[0]!.tileId],[card.tileId,card.tileId],[card.tileId,p.hand[1]!.tileId]])assert.equal(applyMarsAction(s,owner,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:cards},now,s.transitionId,random).ok,false);
 assert.equal(applyMarsAction(s,owner,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[card.tileId],heat:1},now,s.transitionId,random).ok,false);
 assert.deepEqual(s,before);assert.equal(projection(s,s.players[1]!.playerId).privateState.cardChoice,null);
 assert.deepEqual(projection(parseMarsState(structuredClone(s))).privateState,projection(s).privateState);
 s=command(s,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[card.tileId]});const after=s.players.find(p=>p.playerId===owner)!;
 assert.equal(after.hand.length,10);assert.ok(after.hand.some(c=>c.tileId===next.tileId));assert.ok(!after.hand.some(c=>c.tileId===card.tileId));assert.ok(s.discard.some(c=>c.tileId===card.tileId));
 assert.equal(s.actionsTaken,1);assert.equal(after.resources.money,42);assert.equal(s.cardChoice,null);
 for(const c of [card,next])assert.equal(JSON.stringify(s.history).includes(c.tileId),false);
 const cancelled=cancelMars(before,now);assert.deepEqual(cancelled.players.find(p=>p.playerId===owner)!.hand,p.hand);parseMarsState(cancelled);
});

test('Mars repeated exchanges rebuild choices from the updated hand and may be skipped independently',()=>{
 let s=ready();s.frames=[[{id:s.nextJob++,source:'Mars University',effect:{kind:'exchangeCard'}},{id:s.nextJob++,source:'Mars University',effect:{kind:'exchangeCard'}}]];s.actionInProgress=true;
 s=act(s,o=>o.kind==='EFFECT');const first=s.cardChoice!.view,hand=s.players[0]!.hand.map(c=>c.tileId);
 s=command(s,{type:'CHOOSE_CARDS',choiceId:first.id,cardIds:[]});assert.equal(s.actionsTaken,0);assert.notEqual(s.cardChoice!.view.id,first.id);assert.deepEqual(s.players[0]!.hand.map(c=>c.tileId),hand);
 const second=s.cardChoice!.view;s=command(s,{type:'CHOOSE_CARDS',choiceId:second.id,cardIds:[hand[0]!]});assert.equal(s.cardChoice,null);assert.equal(s.actionsTaken,1);
 let twice=ready();twice.frames=[[{id:twice.nextJob++,source:'Mars University',effect:{kind:'exchangeCard'}},{id:twice.nextJob++,source:'Mars University',effect:{kind:'exchangeCard'}}]];twice.actionInProgress=true;
 twice=act(twice,o=>o.kind==='EFFECT');const firstId=twice.cardChoice!.view.id,drawn=twice.deck[0]!;
 twice=command(twice,{type:'CHOOSE_CARDS',choiceId:firstId,cardIds:[twice.players[0]!.hand[0]!.tileId]});
 assert.ok(twice.players[0]!.hand.some(c=>c.tileId===drawn.tileId));
 assert.equal(applyMarsAction(twice,twice.activePlayerId,{type:'CHOOSE_CARDS',choiceId:firstId,cardIds:[drawn.tileId]},now,twice.transitionId,random).ok,false);
 twice=command(twice,{type:'CHOOSE_CARDS',choiceId:twice.cardChoice!.view.id,cardIds:[drawn.tileId]});assert.ok(twice.discard.some(c=>c.tileId===drawn.tileId));assert.equal(twice.actionsTaken,1);
 const empty=ready();empty.deck.push(...empty.players[0]!.hand.splice(0));empty.players[0]!.handCount=0;
 const skipped=peek(empty,{kind:'exchangeCard'});assert.equal(skipped.cardChoice,null);assert.equal(skipped.actionsTaken,1);
});

test('Mars hand exchange discards before reshuffling an exhausted deck and conserves all cards',()=>{
 let s=ready();s.players[1]!.hand.push(...s.deck.splice(0));s.players[1]!.handCount=s.players[1]!.hand.length;
 s=peek(s,{kind:'exchangeCard'});const card=s.players[0]!.hand[0]!,choice=s.cardChoice!.view;
 s=command(s,{type:'CHOOSE_CARDS',choiceId:choice.id,cardIds:[card.tileId]});
 assert.ok(s.players[0]!.hand.some(c=>c.tileId===card.tileId),'The only discarded card is available when the empty deck reshuffles.');
 assert.equal(s.players[0]!.hand.length,10);assert.equal(s.discard.length,0);parseMarsState(s);
});

test('Mars protected habitats blocks opposing plant removal but permits own removal and production reduction',()=>{
 let s=peek(ready(),MARS_CORPORATE_ERA_PROTECTION_EFFECTS.ProtectedHabitats[0]);
 const owner=s.activePlayerId;assert.equal(s.players[0]!.protectedHabitats,true);assert.equal(projection(s,s.players[1]!.playerId).playerStates[0]!.protectedHabitats,true);
 s.players[0]!.resources.plants=6;s=act(s,o=>o.id==='end');
 s=peek(s,{kind:'removePlants',amount:4});
 assert.equal(marsOffers(s,s.activePlayerId).some(o=>o.id.startsWith('burn:'+owner)),false);
 const before=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:`burn:${owner}:4`},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 s=act(s,o=>o.id==='skip');assert.equal(s.players[0]!.resources.plants,6);
 s=peek(s,{kind:'attackProduction',resource:'plants',amount:1});s=act(s,o=>o.targetId===owner);assert.equal(s.players[0]!.production.plants,0);
 assert.equal(s.activePlayerId,owner);
 s=peek(s,{kind:'removePlants',amount:2});s=act(s,o=>o.id===`burn:${owner}:2`);assert.equal(s.players[0]!.resources.plants,4);
 while(s.stage==='ACTION')s=act(s,o=>o.id===(s.actionsTaken===1?'end':'pass'));
 assert.equal(s.generation,2);assert.equal(s.players.find(p=>p.playerId===owner)!.protectedHabitats,true);
});

test('Mars protected animal and microbe targets are excluded from both action eligibility and authoritative offers',()=>{
 for(const [attacker,prey] of [['Predators','Fish'],['Ants','NitriteReducingBacteria']]){
  let s=ready();const actor=s.activePlayerId,opponent=s.players[1]!;
  const source=give(s,attacker!,actor,true),target=give(s,prey!,opponent.playerId,true);target.resources=2;opponent.protectedHabitats=true;
  const pets=give(s,'Pets',actor,true);pets.resources=3;
  assert.equal(marsOffers(s,actor).some(o=>o.id==='action:'+source.tileId),false);
  const own=give(s,attacker==='Predators'?'Birds':'GHGProducingBacteria',actor,true);own.resources=1;s.players[0]!.protectedHabitats=true;
  s=act(s,o=>o.id==='action:'+source.tileId);
  const offers=marsOffers(s,actor);assert.ok(offers.some(o=>o.id==='steal:'+own.tileId));assert.equal(offers.some(o=>o.id==='steal:'+target.tileId),false);assert.equal(offers.some(o=>o.id==='steal:'+pets.tileId),false);
  const before=structuredClone(s);assert.equal(applyMarsAction(s,actor,{type:'TAKE',actionId:'steal:'+target.tileId},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
  s=act(s,o=>o.id==='steal:'+own.tileId);
  assert.equal(s.players[0]!.played.find(c=>c.tileId===source.tileId)!.resources,1);assert.equal(s.players[1]!.played.find(c=>c.tileId===target.tileId)!.resources,2);parseMarsState(s);
 }
});

test('Mars production copy excludes placement, immediate resources and global bonuses while reapplying production costs',()=>{
 let s=ready();const owner=s.activePlayerId,p=s.players[0]!;p.production.energy=2;
 const card=give(s,'DomedCrater',owner,true);give(s,'ResearchOutpost',owner,true);give(s,'Asteroid',owner,true);const foreign=give(s,'PowerPlant',s.players[1]!.playerId,true);
 s=peek(s,MARS_CORPORATE_ERA_ECONOMIC_EFFECTS.RoboticWorkforce[0]);const before=structuredClone(s),offers=marsOffers(s,owner);
 assert.ok(offers.some(o=>o.id==='copy-production:'+card.tileId));assert.equal(offers.length,1);
 assert.equal(applyMarsAction(s,owner,{type:'TAKE',actionId:'copy-production:'+foreign.tileId},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 assert.deepEqual(projection(parseMarsState(structuredClone(s))).privateState,projection(s).privateState);
 s=settle(act(s,o=>o.id==='copy-production:'+card.tileId));
 assert.equal(s.players[0]!.production.energy,1);assert.equal(s.players[0]!.production.money,4);
 assert.deepEqual(s.players[0]!.resources,before.players[0]!.resources);assert.deepEqual(s.tiles,before.tiles);assert.equal(s.oxygen,before.oxygen);assert.equal(s.actionsTaken,1);
});

test('Mars production copy rejects unaffordable decreases and applies the money production floor',()=>{
 let s=ready();const owner=s.activePlayerId,city=give(s,'Capital',owner,true),plant=give(s,'PowerPlant',owner,true),power=give(s,'NuclearPower',owner,true);
 s.players[0]!.production.energy=1;s.players[0]!.production.money=-4;
 s=peek(s,{kind:'copyProduction'});let offers=marsOffers(s,owner);
 assert.equal(offers.some(o=>o.targetId===city.tileId||o.targetId===power.tileId),false);assert.ok(offers.some(o=>o.targetId===plant.tileId));
 const before=structuredClone(s);assert.equal(applyMarsAction(s,owner,{type:'TAKE',actionId:'copy-production:'+power.tileId},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 s.players[0]!.production.money=-3;offers=marsOffers(s,owner);assert.ok(offers.some(o=>o.targetId===power.tileId));
 s=settle(act(s,o=>o.targetId===power.tileId));assert.equal(s.players[0]!.production.money,-5);assert.equal(s.players[0]!.production.energy,4);
});

test('Mars copied mining production follows its original metal without placing another tile',()=>{
 let s=ready();const owner=s.activePlayerId,card=give(s,'MiningRights',owner,true),space=MARS_BOARD.find(b=>!b.ocean&&b.bonus.includes('titanium'))!;
 s.tiles.push({spaceId:space.id,kind:'special',ownerId:owner,source:'MiningRights'});
 s=peek(s,{kind:'copyProduction'});const before=structuredClone(s);
 s=settle(act(s,o=>o.targetId===card.tileId));assert.equal(s.players[0]!.production.titanium,2);assert.deepEqual(s.tiles,before.tiles);assert.deepEqual(s.players[0]!.resources,before.players[0]!.resources);
});

import { MARS_CORPORATE_ERA_BOARD_EFFECTS, marsLandClaimsAreConsistent } from '@hangul-rummikub/shared';
import { marsClaimableSpaces } from './games/mars/domain/game.js';
test('Mars land claim is public but grants no tile, bonus, score or adjacency ownership',()=>{
 let s=ready();const owner=s.activePlayerId,other=s.players[1]!.playerId,before=structuredClone(s);
 s=peek(s,MARS_CORPORATE_ERA_BOARD_EFFECTS.LandClaim[0]);
 const offers=marsOffers(s,owner);assert.ok(offers.length>0);
 assert.ok(offers.every(o=>MARS_BOARD.some(b=>b.id===o.targetId&&!b.ocean&&!b.reserved)));
 s=act(s,o=>o.targetId==='4-4');
 assert.deepEqual(s.landClaims,[{spaceId:'4-4',ownerId:owner}]);assert.equal(s.actionsTaken,1);
 assert.deepEqual(s.tiles,before.tiles);assert.deepEqual(s.players[0]!.resources,before.players[0]!.resources);assert.deepEqual(scoreMars(s),scoreMars(before));
 assert.deepEqual(marsSpaces(s,owner,'greenery'),marsSpaces(before,owner,'greenery'));
 assert.equal(marsSpaces(s,other,'special').includes('4-4'),false);assert.equal(marsSpaces(s,owner,'special').includes('4-4'),true);
 for(const p of s.players){const g=projection(s,p.playerId);assert.deepEqual(g.landClaims,s.landClaims);assert.ok(marsLandClaimsAreConsistent(g,s.players.map(p=>p.playerId)));}
 assert.deepEqual(parseMarsState(JSON.parse(JSON.stringify(s))).landClaims,s.landClaims);
});
test('Mars land claim rejects reserved, occupied and repeated spaces atomically',()=>{
 let s=ready();s.tiles.push({spaceId:'4-4',kind:'special',ownerId:s.activePlayerId,source:'test'});
 s.landClaims.push({spaceId:'4-5',ownerId:s.players[1]!.playerId});s=peek(s,{kind:'claimLand'});const before=structuredClone(s);
 for(const id of ['4-4','4-5','5-3','phobos',MARS_BOARD.find(b=>b.ocean)!.id]){
  assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:'claim-land:'+id},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 }
 for(const mutation of [
  (x:MarsState)=>x.landClaims.push({...x.landClaims[0]!}),
  (x:MarsState)=>{x.landClaims[0]!.spaceId='5-3';},
  (x:MarsState)=>{x.landClaims[0]!.spaceId='4-4';},
  (x:MarsState)=>{x.landClaims[0]!.ownerId=v.parse(PlayerIdSchema,'outsider');},
 ]){const corrupt=structuredClone(s);mutation(corrupt);assert.throws(()=>parseMarsState(corrupt));}
});
test('Mars placement consumes only the owner reservation and grants the normal bonus once',()=>{
 let s=ready();const owner=s.activePlayerId,other=s.players[1]!.playerId;
 const b=MARS_BOARD.find(b=>!b.ocean&&!b.reserved&&b.bonus.length>0&&!b.bonus.includes('card'))!;
 s.landClaims=[{spaceId:b.id,ownerId:owner}];const before=structuredClone(s.players[0]!.resources);
 s.activePlayerId=other;s=peek(s,{kind:'place',tile:'special',rule:'normal'});const blocked=structuredClone(s);
 assert.equal(applyMarsAction(s,other,{type:'TAKE',actionId:'place:'+b.id},now,s.transitionId,random).ok,false);assert.deepEqual(s,blocked);
 s.activePlayerId=owner;s=act(s,o=>o.targetId===b.id);
 assert.equal(s.landClaims.length,0);assert.equal(s.tiles[0]!.ownerId,owner);
 for(const resource of ['money','steel','titanium','plants','energy','heat'] as const)assert.equal(s.players[0]!.resources[resource],before[resource]+b.bonus.filter(k=>k===resource).length);
 assert.ok(!marsClaimableSpaces(s).includes(b.id));
});
test('Mars reservations retain city adjacency and final greenery rules and survive generation change',()=>{
 let s=ready();const owner=s.activePlayerId;s.landClaims=[{spaceId:'4-5',ownerId:owner}];
 s.tiles.push({spaceId:'4-4',kind:'city',ownerId:owner,source:'city'});
 assert.equal(marsSpaces(s,owner,'city').includes('4-5'),false);assert.equal(marsSpaces(s,owner,'greenery').includes('4-5'),true);
 s=act(s,o=>o.id==='pass');s=act(s,o=>o.id==='pass');assert.deepEqual(s.landClaims,[{spaceId:'4-5',ownerId:owner}]);
 s.stage='FINAL_GREENERY';s.activePlayerId=owner;s.players[0]!.resources.plants=8;
 s=act(s,o=>o.id==='final-greenery');s=act(s,o=>o.targetId==='4-5');assert.equal(s.landClaims.length,0);assert.equal(s.tiles.at(-1)?.kind,'greenery');
});

import {MARS_CORPORATE_ERA_ATTACK_EFFECTS} from '@hangul-rummikub/shared';
test('Mars Hired Raiders transfers only the chosen available amount from one opponent for one action',()=>{
 let s=ready(3);const owner=s.activePlayerId,target=s.players[1]!,other=s.players[2]!;target.resources.steel=1;other.resources.steel=3;
 const before=structuredClone(s);s=peek(s,MARS_CORPORATE_ERA_ATTACK_EFFECTS.HiredRaiders[0]);s=act(s,o=>o.id==='choice:0');
 const offers=marsOffers(s,owner);assert.ok(offers.some(o=>o.id===`attack-stock:${target.playerId}:steel:1`));
 assert.ok(!offers.some(o=>o.id===`attack-stock:${target.playerId}:steel:2`));assert.ok(!offers.some(o=>o.targetId===owner));
 const pending=structuredClone(s);assert.equal(applyMarsAction(s,owner,{type:'TAKE',actionId:`attack-stock:${target.playerId}:steel:2`},now,s.transitionId,random).ok,false);assert.deepEqual(s,pending);
 s=parseMarsState(JSON.parse(JSON.stringify(s)));s=act(s,o=>o.id===`attack-stock:${target.playerId}:steel:1`);
 assert.equal(s.players[0]!.resources.steel,before.players[0]!.resources.steel+1);assert.equal(s.players[1]!.resources.steel,0);assert.equal(s.players[2]!.resources.steel,3);assert.equal(s.actionsTaken,1);
 assert.deepEqual(s.players.map(p=>p.production),before.players.map(p=>p.production));assert.equal(s.history.at(-1)?.kind,'ATTACK');
});
test('Mars Sabotage removes partial amounts without income, and protected habitats do not protect metals or money',()=>{
 for(const [branch,resource] of [[0,'titanium'],[1,'steel'],[2,'money']] as const){
  let s=ready();const owner=s.activePlayerId,target=s.players[1]!;target.protectedHabitats=true;target.resources[resource]=9;
  const before=structuredClone(s.players[0]!.resources);s=peek(s,MARS_CORPORATE_ERA_ATTACK_EFFECTS.Sabotage[0]);s=act(s,o=>o.id==='choice:'+branch);
  s=act(s,o=>o.id===`attack-stock:${target.playerId}:${resource}:2`);assert.equal(s.players[1]!.resources[resource],7);assert.deepEqual(s.players[0]!.resources,before);assert.equal(s.activePlayerId,owner);
 }
});
test('Mars Virus animal removal honors protected habitats and Pets, never transfers animals and allows skip',()=>{
 let s=ready();const owner=s.activePlayerId,target=s.players[1]!,animal=give(s,'Birds',target.playerId,true),pet=give(s,'Pets',target.playerId,true),own=give(s,'Fish',owner,true);animal.resources=3;pet.resources=4;own.resources=2;
 target.protectedHabitats=true;s=peek(s,MARS_CORPORATE_ERA_ATTACK_EFFECTS.Virus[0]);s=act(s,o=>o.id==='choice:0');
 assert.ok(!marsOffers(s,owner).some(o=>o.id.startsWith('attack-card:'+animal.tileId)||o.id.startsWith('attack-card:'+pet.tileId)));
 const before=structuredClone(s);assert.equal(applyMarsAction(s,owner,{type:'TAKE',actionId:`attack-card:${animal.tileId}:2`},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 s.players[1]!.protectedHabitats=false;s=act(s,o=>o.id===`attack-card:${animal.tileId}:1`);
 assert.equal(s.players[1]!.played.find(c=>c.tileId===animal.tileId)!.resources,2);assert.equal(s.players[0]!.played.find(c=>c.tileId===own.tileId)!.resources,2);
 s.actionsTaken=0;s=peek(s,{kind:'removeCardResource',resource:'animal',amount:2});const untouched=s.players.map(p=>structuredClone(p.played));s=act(s,o=>o.id==='skip');assert.deepEqual(s.players.map(p=>p.played),untouched);
});
test('Mars optional attacks with no resources always allow completing the action without creating resources',()=>{
 for(const effect of [{kind:'attackStock',resource:'steel',amount:2,steal:true},{kind:'removeCardResource',resource:'animal',amount:2}] as const){
  let s=ready();s.players.forEach(p=>p.resources=marsResources());s=peek(s,effect);assert.deepEqual(marsOffers(s,s.activePlayerId).map(o=>o.id),['skip']);s=act(s,o=>o.id==='skip');assert.equal(s.actionsTaken,1);assert.ok(s.players.every(p=>Object.values(p.resources).every(n=>n===0)));
 }
});

test('Mars real card resource actions remain once per generation and final resource scoring stays card-local',()=>{
 let s=ready();const owner=s.activePlayerId,fish=give(s,'Fish',owner,true),animals=give(s,'SmallAnimals',owner,true);fish.resources=1;animals.resources=3;
 const before=scoreMars(s)[0]!.cards;s=act(s,o=>o.id==='action:'+fish.tileId);
 assert.equal(s.players[0]!.played.find(c=>c.tileId===fish.tileId)!.resources,2);
 assert.equal(scoreMars(s)[0]!.cards,before+1);assert.equal(s.actionsTaken,1);
 const snapshot=structuredClone(s);assert.equal(applyMarsAction(s,owner,{type:'TAKE',actionId:'action:'+fish.tileId},now,s.transitionId,random).ok,false);assert.deepEqual(s,snapshot);
 const saved=parseMarsState(JSON.parse(JSON.stringify(s)));assert.deepEqual(scoreMars(saved),scoreMars(s));
});

test('Mars Hackers applies its own energy cost and money gain while reducing a protected opponent exactly to -5',()=>{
 let s=ready();const owner=s.activePlayerId,target=s.players[1]!;target.production.money=-3;target.protectedHabitats=true;
 const before=structuredClone(s.players);s=peek(s,{kind:'choice',options:[{label:'Hackers effect',effects:MARS_CORPORATE_ERA_ATTACK_EFFECTS.Hackers}]});s=act(s,o=>o.id==='choice:0');
 s=act(s,o=>o.label.includes('생산 −2'));const offers=marsOffers(s,owner);assert.ok(offers.some(o=>o.targetId===target.playerId));assert.ok(!offers.some(o=>o.id==='skip'));
 assert.match(offers.find(o=>o.targetId===target.playerId)!.detail,/-3 → -5/);
 const restored=parseMarsState(JSON.parse(JSON.stringify(s)));s=act(restored,o=>o.targetId===target.playerId);s=settle(s);
 assert.equal(s.players[1]!.production.money,-5);assert.equal(s.players[0]!.production.energy,before[0]!.production.energy-1);assert.equal(s.players[0]!.production.money,before[0]!.production.money+2);
 assert.deepEqual(s.players.map(p=>p.resources),before.map(p=>p.resources));assert.equal(s.actionsTaken,1);assert.ok(s.history.some(h=>h.kind==='ATTACK'));
});
test('Mars production attack rejects insufficient targets and missing mandatory energy cost atomically',()=>{
 let s=ready();s.players[0]!.production.money=-4;s.players[1]!.production.money=-5;
 const rule={...MARS_CARDS[0]!,requirements:[],cost:0,effects:MARS_CORPORATE_ERA_ATTACK_EFFECTS.Hackers};
 assert.notEqual(marsCardReason(s,s.players[0]!,rule),null);
 s.players[0]!.production.money=0;s.players[0]!.production.energy=0;assert.notEqual(marsCardReason(s,s.players[0]!,rule),null);
 s.players[0]!.production.energy=1;s=peek(s,{kind:'attackProduction',resource:'money',amount:2});const before=structuredClone(s);
 assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:'reduce:'+s.players[1]!.playerId},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
});
test('Mars mining consortium can reduce its own titanium production and restore it within one action',()=>{
 let s=ready();const owner=s.activePlayerId;s.players[0]!.production.titanium=1;s.players[1]!.production.titanium=0;
 s=peek(s,{kind:'choice',options:[{label:'Consortium effect',effects:MARS_CORPORATE_ERA_ATTACK_EFFECTS.AsteroidMiningConsortium}]});s=act(s,o=>o.id==='choice:0');s=act(s,o=>o.label.includes('생산 −1'));
 assert.deepEqual(marsOffers(s,owner).map(o=>o.targetId),[owner]);assert.match(marsOffers(s,owner)[0]!.detail,/내 생산량 감소/);
 s=act(s,o=>o.targetId===owner);s=settle(s);assert.equal(s.players[0]!.production.titanium,1);assert.equal(s.players[1]!.production.titanium,0);assert.equal(s.actionsTaken,1);
});

import {MARS_PREPARED_CORPORATE_CARDS} from '@hangul-rummikub/shared';
function preparedCorporate(id:string){const c=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(c,id);return c;}
function corporateSequence(s:MarsState,effects:readonly MarsEffect[]){return peek(s,{kind:'choice',options:[{label:'기업시대 효과 검증',effects}]});}
test('Mars prepared draw and conversion actions reserve costs, reject underfunded choices atomically, and pay rewards once',()=>{
 for(const [id,resource,cost] of [['DevelopmentCenter','energy',1],['CaretakerContract','heat',8],['SpaceElevator','steel',1]] as const){
  const card=preparedCorporate(id);assert.ok(card.actions);let s=ready();s.players[0]!.resources[resource]=cost-1;
  s=corporateSequence(s,card.actions);assert.equal(marsOffers(s,s.activePlayerId).length,0);
  const before=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:'choice:0'},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
  s.players[0]!.resources[resource]=cost;const hand=s.players[0]!.hand.length,money=s.players[0]!.resources.money,tr=s.players[0]!.tr,temperature=s.temperature;
  s=act(s,o=>o.id==='choice:0');assert.equal(s.players[0]!.resources[resource],0);s=settle(s);
  assert.equal(s.players[0]!.hand.length,hand+(id==='DevelopmentCenter'?1:0));assert.equal(s.players[0]!.resources.money,money+(id==='SpaceElevator'?5:0));
  assert.equal(s.players[0]!.tr,tr+(id==='CaretakerContract'?1:0));assert.equal(s.temperature,temperature);assert.equal(s.actionsTaken,1);parseMarsState(s);
 }
});
test('Mars AI Central requires initial energy production and its draw effect keeps cards private',()=>{
 const card=preparedCorporate('AICentral');assert.ok(card.actions);let s=ready();s.players[0]!.production.energy=0;
 const rule={...MARS_CARDS[0]!,cost:0,requirements:[],effects:card.effects};assert.notEqual(marsCardReason(s,s.players[0]!,rule),null);
 s.players[0]!.production.energy=1;s=corporateSequence(s,card.effects);s=act(s,o=>o.id==='choice:0');s=settle(s);assert.equal(s.players[0]!.production.energy,0);
 s.actionsTaken=0;const hand=s.players[0]!.hand.length,deck=s.deck.length;s=corporateSequence(s,card.actions);s=act(s,o=>o.id==='choice:0');s=settle(s);
 assert.equal(s.players[0]!.hand.length,hand+2);assert.equal(s.deck.length,deck-2);
 const other=JSON.stringify(projection(s,s.players[1]!.playerId));for(const drawn of s.players[0]!.hand.slice(-2))assert.equal(other.includes(drawn.tileId),false);
 assert.equal(s.actionsTaken,1);parseMarsState(s);
});
test('Mars prepared immediate effects apply TR, income and titanium production without changing stocks',()=>{
 for(const [id,resource,amount] of [['RadSuits','money',1],['SpaceElevator','titanium',1]] as const){
  let s=ready();const before=structuredClone(s.players[0]!);s=corporateSequence(s,preparedCorporate(id).effects);s=act(s,o=>o.id==='choice:0');s=settle(s);
  assert.equal(s.players[0]!.production[resource],before.production[resource]+amount);assert.deepEqual(s.players[0]!.resources,before.resources);
 }
 let s=ready();const tr=s.players[0]!.tr;s=corporateSequence(s,preparedCorporate('BribedCommittee').effects);s=act(s,o=>o.id==='choice:0');s=settle(s);
 assert.equal(s.players[0]!.tr,tr+2);assert.equal(s.temperature,-30);assert.equal(s.oxygen,0);
});
test('Mars Corporate Stronghold applies mandatory energy cost and normal city placement, preserving the pending placement on reconnect',()=>{
 const card=preparedCorporate('CorporateStronghold');let s=ready();s.players[0]!.production.energy=0;
 assert.notEqual(marsCardReason(s,s.players[0]!,{...MARS_CARDS[0]!,requirements:[],cost:0,effects:card.effects}),null);
 s.players[0]!.production.energy=1;s=corporateSequence(s,card.effects);s=act(s,o=>o.id==='choice:0');assert.equal(s.players[0]!.production.energy,0);
 s=act(s,o=>o.label.includes('도시'));const legal=marsOffers(s,s.activePlayerId).map(o=>o.targetId).sort();assert.deepEqual(legal,marsSpaces(s,s.activePlayerId,'city').sort());
 s=parseMarsState(JSON.parse(JSON.stringify(s)));s=act(s,o=>o.kind==='PLACE');s=settle(s);
 assert.equal(s.tiles.filter(t=>t.kind==='city'&&t.ownerId===s.activePlayerId).length,1);assert.equal(s.players[0]!.production.money,4);assert.equal(s.actionsTaken,1);
});
test('Mars Great Escarpment production attack offers legal self and protected opponents, never an empty producer',()=>{
 for(const self of [false,true]){
  let s=ready(3);const owner=s.activePlayerId;s.players[0]!.production.steel=1;s.players[1]!.production.steel=1;s.players[1]!.protectedHabitats=true;s.players[2]!.production.steel=0;
  const stocks=s.players.map(p=>({...p.resources}));s=corporateSequence(s,preparedCorporate('GreatEscarpmentConsortium').effects);s=act(s,o=>o.id==='choice:0');s=act(s,o=>o.label.includes('생산 −1'));
  assert.deepEqual(marsOffers(s,owner).map(o=>o.targetId).sort(),[owner,s.players[1]!.playerId].sort());
  s=act(s,o=>o.targetId===(self?owner:s.players[1]!.playerId));s=settle(s);
  assert.equal(s.players[0]!.production.steel,self?1:2);assert.equal(s.players[1]!.production.steel,self?1:0);assert.deepEqual(s.players.map(p=>p.resources),stocks);assert.equal(s.actionsTaken,1);
 }
});
test('Mars Business Network setup cost reaches -5 but cannot cross it, and buying cards remains separate from discounts',()=>{
 const network=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id==='BusinessNetwork');assert.ok(network);assert.ok(network.actions);
 let s=ready();s.players[0]!.production.money=-5;
 const rule={...MARS_CARDS[0]!,requirements:[],cost:network.cost,tags:network.tags,effects:network.effects};
 assert.notEqual(marsCardReason(s,s.players[0]!,rule),null);
 s.players[0]!.production.money=-4;assert.equal(marsCardReason(s,s.players[0]!,rule),null);
 s=peek(s,{kind:'choice',options:[{label:'Business Network setup',effects:network.effects}]});s=act(s,o=>o.id==='choice:0');assert.equal(s.players[0]!.production.money,-5);assert.equal(s.actionsTaken,1);
 s.players[0]!.nextCardDiscount=8;s=peek(s,network.actions[0]!);assert.equal(s.cardChoice?.view.kind,'BUY');
 if(s.cardChoice?.view.kind!=='BUY')throw new Error('Expected purchase');assert.equal(s.cardChoice.view.cost,3);
 s=command(s,{type:'CHOOSE_CARDS',choiceId:s.cardChoice.view.id,cardIds:[]});assert.equal(s.players[0]!.nextCardDiscount,8);
});
