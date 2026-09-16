import { marsCorporationStart } from './games/mars/domain/corporation-start.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,MARS_CARDS,MARS_BOARD,MARS_CORPORATIONS,marsResources,MarsPlayingProjectionSchema,type MarsAction,type MarsOffer,type MarsCard} from '@hangul-rummikub/shared';
import {createMarsGame,applyMarsAction,marsOffers,parseMarsState,marsSpaces,marsCardReason,scoreMars,type MarsState} from './games/mars/domain/game.js';
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
