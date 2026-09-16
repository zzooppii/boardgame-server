import assert from 'node:assert/strict';
import test from 'node:test';
import * as v from 'valibot';
import {GameIdSchema,PlayerIdSchema,TileIdSchema,TurnIdSchema,ServerTimeSchema,MARS_CORPORATE_CARDS,MARS_ALL_CARDS,MARS_BOARD,marsResources,marsCard,type MarsAction,type MarsCard} from '@hangul-rummikub/shared';
import {createMarsGame,applyMarsAction,marsOffers,marsCardReason,parseMarsState,scoreMars,type MarsState} from './games/mars/domain/game.js';
import {projectMars} from './games/mars/compatibility/projector.js';
let serial=0;
const now=v.parse(ServerTimeSchema,1000),random={nextInt:(n:number)=>Math.floor(n/2)};
function command(s:MarsState,a:MarsAction,actor=s.activePlayerId){const r=applyMarsAction(s,actor,a,now,v.parse(TurnIdSchema,`corporate-turn-${++serial}`),random);assert.ok(r.ok,JSON.stringify(a));return r.state;}
function create(n=2){return createMarsGame({corporateEra:true,generateTileId:()=>v.parse(TileIdSchema,`corporate-card-${++serial}`),gameId:v.parse(GameIdSchema,'corporate-game'),playerIds:Array.from({length:n},(_,i)=>v.parse(PlayerIdSchema,`corporate-player-${i}`)),now,turnId:v.parse(TurnIdSchema,`corporate-turn-${++serial}`),random});}
function ready(n=2){let s=create(n);for(const p of s.players)s=command(s,{type:'SETUP',corporationId:'Beginner',cardIds:[]},p.playerId);return s;}
function give(s:MarsState,id:string,played=false):MarsCard{
 for(const list of [s.deck,s.discard,...s.players.flatMap(p=>[p.hand,p.research,p.played])]){const i=list.findIndex(c=>c.definitionId===id);if(i>=0){const c=list.splice(i,1)[0]!;(played?s.players[0]!.played:s.players[0]!.hand).push(c);s.players.forEach(p=>p.handCount=p.hand.length);return c;}}
 throw new Error(id);
}
function settle(s:MarsState){for(let i=0;i<150&&(s.payment||s.cardChoice||s.current||s.frames.length);i++){
 if(s.payment)s=command(s,{type:'PAY',payment:{money:s.payment.cost,steel:0,titanium:0,heat:0}});
 else if(s.cardChoice){const c=s.cardChoice.view;s=command(s,{type:'CHOOSE_CARDS',choiceId:c.id,cardIds:c.kind==='KEEP'?c.cards.slice(0,c.keepCount).map(c=>c.tileId):[]});}
 else {const o=marsOffers(s,s.activePlayerId)[0];assert.ok(o,'No legal corporate continuation');s=command(s,{type:'TAKE',actionId:o.id});}
 }assert.equal(s.frames.length,0);assert.equal(s.current,null);assert.equal(s.payment,null);assert.equal(s.cardChoice,null);return s;}
function rich(s:MarsState){for(const p of s.players){p.resources=marsResources({money:500,steel:30,titanium:30,plants:30,energy:30,heat:30});p.production=marsResources({money:5,steel:5,titanium:5,plants:5,energy:5,heat:5});}}

test('Mars corporate variant has exact 208-card inventory and no base production bonus for 2–5 players',()=>{
 for(const n of [2,3,4,5]){const s=ready(n);assert.equal(s.inventory.length,208);assert.equal(new Set(s.inventory.map(c=>c.definitionId)).size,208);assert.equal(s.deck.length,208-n*10);for(const p of s.players){assert.deepEqual(p.production,marsResources());assert.equal(p.hand.length,10);}parseMarsState(s);}
 const s=ready();s.corporateEra=false;assert.throws(()=>parseMarsState(s));
});
test('Mars all 71 corporate projects can pay, resolve actual effects, and use available printed actions once per generation',()=>{
 for(const d of MARS_CORPORATE_CARDS){let s=ready();rich(s);const owner=s.players[0]!;
  for(const id of ['AdaptationTechnology','InventorsGuild','MarsUniversity','Research','GeneRepair','QuantumExtractor','PowerPlant','Windmills'])if(id!==d.id)give(s,id,true);
  const fish=give(s,'Fish',true);fish.resources=1;
  s.temperature=0;s.tiles.push({spaceId:'2-1',kind:'city',ownerId:owner.playerId,source:'city'},{spaceId:'2-4',kind:'city',ownerId:s.players[1]!.playerId,source:'city'});
  const card=give(s,d.id);assert.equal(marsCardReason(s,owner,d),null,d.id);
  try{s=command(s,{type:'TAKE',actionId:`card:${card.tileId}`});s=settle(s);assert.ok(s.players[0]!.played.some(c=>c.tileId===card.tileId));parseMarsState(s);
   if(d.actions){const o=marsOffers(s,s.activePlayerId).find(o=>o.id===`action:${card.tileId}`);assert.ok(o,d.id+' action');s=command(s,{type:'TAKE',actionId:o.id});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===card.tileId)!.usedGeneration,s.generation);s.activePlayerId=owner.playerId;s.actionsTaken=0;assert.equal(marsOffers(s,owner.playerId).some(o=>o.id===`action:${card.tileId}`),false);}
  }catch(error){throw new Error(d.id+': '+String(error));}
 }
});
test('Mars corporate science and biological reactions include self and duplicate tags, and resource choices are card-scoped',()=>{
 let s=ready();rich(s);const olympus=give(s,'OlympusConference');s=command(s,{type:'TAKE',actionId:`card:${olympus.tileId}`});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===olympus.tileId)!.resources,1);
 s.actionsTaken=0;const research=give(s,'Research');s=command(s,{type:'TAKE',actionId:`card:${research.tileId}`});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===olympus.tileId)!.resources,3);
 s.actionsTaken=0;const viral=give(s,'ViralEnhancers'),plants=s.players[0]!.resources.plants;s=command(s,{type:'TAKE',actionId:`card:${viral.tileId}`});s=settle(s);assert.equal(s.players[0]!.resources.plants,plants+1);
 s.actionsTaken=0;s.temperature=2;s.oxygen=8;const fish=give(s,'Fish');s=command(s,{type:'TAKE',actionId:`card:${fish.tileId}`});s=command(s,{type:'PAY',payment:{money:s.payment!.cost,steel:0,titanium:0,heat:0}});
 while(!s.current){const o=marsOffers(s,s.activePlayerId).find(o=>o.label.includes('바이러스 강화제'));assert.ok(o);s=command(s,{type:'TAKE',actionId:o.id});}
 const resource=marsOffers(s,s.activePlayerId).find(o=>o.id==='viral:resource');assert.equal(resource?.targetId,fish.tileId);s=command(s,{type:'TAKE',actionId:'viral:resource'});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===fish.tileId)!.resources,1);
});
test('Mars commercial district counts adjacent cities only, and corporate point multipliers are retained',()=>{
 const s=ready();give(s,'CommercialDistrict',true);s.tiles.push({spaceId:'2-2',kind:'special',ownerId:s.activePlayerId,source:'CommercialDistrict'},{spaceId:'2-1',kind:'city',ownerId:s.players[1]!.playerId,source:'city'});assert.equal(scoreMars(s)[0]!.cards,1);
 const physics=give(s,'PhysicsComplex',true);physics.resources=3;const fleet=give(s,'SecurityFleet',true);fleet.resources=2;assert.equal(scoreMars(s)[0]!.cards,9);
 assert.equal(MARS_ALL_CARDS.length,208);assert.equal(marsCard('BribedCommittee').points,-2);
});
test('Mars corporate projection preserves variant and never exposes opponents hands or deck identities',()=>{
 const s=ready();const p=projectMars({gameId:s.gameId,gameRevision:s.revision,startedAt:s.startedAt,finishedAt:null,state:s},s.activePlayerId)!;assert.equal(p.corporateEra,true);const wire=JSON.stringify(p);for(const c of [...s.deck,...s.players[1]!.hand])assert.equal(wire.includes(c.tileId),false);assert.equal(MARS_BOARD.length,61);
});

test('Mars Saturn and Teractor are selectable corporations with zero base production, Jovian reactions and earth discounts',()=>{
 let s=create();s.players[0]!.corporations=['SaturnSystems','CrediCor'];s.players[1]!.corporations=['Teractor','EcoLine'];
 s=command(s,{type:'SETUP',corporationId:'SaturnSystems',cardIds:[]},s.players[0]!.playerId);s=command(s,{type:'SETUP',corporationId:'Teractor',cardIds:[]},s.players[1]!.playerId);
 assert.deepEqual(s.players[0]!.production,marsResources({money:1,titanium:1}));assert.equal(s.players[0]!.resources.money,42);assert.equal(s.players[1]!.resources.money,60);assert.deepEqual(s.players[1]!.production,marsResources());
 const ganymede=give(s,'TerraformingGanymede');s=command(s,{type:'TAKE',actionId:`card:${ganymede.tileId}`});s=settle(s);assert.equal(s.players[0]!.tr,22);assert.equal(s.players[0]!.production.money,2);
 s=command(s,{type:'TAKE',actionId:'end'});const sponsor=give(s,'Sponsors');s.players[0]!.hand.splice(s.players[0]!.hand.indexOf(sponsor),1);s.players[1]!.hand.push(sponsor);s.players.forEach(p=>p.handCount=p.hand.length);
 s=command(s,{type:'TAKE',actionId:`card:${sponsor.tileId}`});assert.equal(s.payment!.cost,3);s=settle(s);assert.equal(s.players[1]!.resources.money,57);assert.equal(s.players[1]!.production.money,2);
});
test('Mars energy conversion validates quantity and CEO resource copying requires an already populated own card',()=>{
 let s=ready();rich(s);const ceo=give(s,'CEOsFavoriteProject');assert.notEqual(marsCardReason(s,s.players[0]!,marsCard(ceo.definitionId)),null);
 const fish=give(s,'Fish',true);assert.notEqual(marsCardReason(s,s.players[0]!,marsCard(ceo.definitionId)),null);fish.resources=2;
 s=command(s,{type:'TAKE',actionId:`card:${ceo.tileId}`});s=settle(s);assert.equal(s.players[0]!.played.find(c=>c.tileId===fish.tileId)!.resources,3);
 const power=give(s,'PowerInfrastructure',true);s.players[0]!.resources.energy=4;const money=s.players[0]!.resources.money;s=command(s,{type:'TAKE',actionId:`action:${power.tileId}`});
 const before=structuredClone(s);assert.equal(applyMarsAction(s,s.activePlayerId,{type:'TAKE',actionId:'energy-sale:5'},now,s.transitionId,random).ok,false);assert.deepEqual(s,before);
 s=command(s,{type:'TAKE',actionId:'energy-sale:3'});assert.equal(s.players[0]!.resources.energy,1);assert.equal(s.players[0]!.resources.money,money+3);
});
