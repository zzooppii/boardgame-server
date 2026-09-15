import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import {ARK_MAP_IDS,ARK_CARDS,ARK_ACTIONS,arkMapCells,arkOffset,arkInitialBuildings,arkEnclosureSize,arkAnimalHousingChoices,arkEnclosuresToEmpty,arkMapFeatureActive,arkMapProjectBonuses,arkIgnoredAnimalConditions,GameIdSchema,PlayerIdSchema,ServerTimeSchema,TurnIdSchema,type ArkBuilding,type ArkMapId,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {createArkSoloGame,applyArkSoloCommand,projectArkSoloGame,parseArkSoloState,type ArkSoloState} from '../../games/ark-nova/domain/game.js';
import {createArkMultiplayerGame,applyArkMultiplayerCommand,projectArkMultiplayerGame} from '../../games/ark-nova/domain/multiplayer.js';
import {arkNewBuildingEffects} from '../../games/ark-nova/domain/construction-effects.js';
import {arkSponsorIncome} from '../../games/ark-nova/domain/sponsor-effects.js';
import {arkProjectBonusIncome,arkProjectBonusEffect} from '../../games/ark-nova/domain/project-bonuses.js';
import {acquireArkAssociationTile} from '../../games/ark-nova/domain/association.js';
import {playArkZooCard,type ArkCardPlayState} from '../../games/ark-nova/domain/card-play.js';
import {arkCardEntryEffects} from '../../games/ark-nova/domain/card-entry-effects.js';
const now=v.parse(ServerTimeSchema,1000),random={nextInt:(max:number)=>max-1};let seq=0;
const next=()=>v.parse(TurnIdSchema,`map-transition-${++seq}`);
function create(){return createArkSoloGame({gameId:v.parse(GameIdSchema,'map-game'),playerId:v.parse(PlayerIdSchema,'map-owner'),difficulty:'STANDARD',now,transitionId:next(),random,nextCardId:()=>`map-card-${++seq}`});}
function act(s:ArkSoloState,a:ArkSoloCommand){const before=structuredClone(s),r=applyArkSoloCommand(s,s.playerId,s.revision,a,now,next(),random);assert.ok(r.ok,JSON.stringify(r));assert.deepEqual(s,before);const restored=parseArkSoloState(JSON.parse(JSON.stringify(r.state)));projectArkSoloGame(restored,restored.playerId);return restored;}
const building=(q:number,row:number,kind='ENCLOSURE_1',occupied=false):ArkBuilding=>({id:`building-${q}-${row}`,kind,cells:[arkOffset(q,row)],occupied,used:0});
for(const mapId of ARK_MAP_IDS)test(`Map ${mapId}: select, serialize, draw and finish a turn without replacing the chosen board`,()=>{
 let s=create();s=act(s,{kind:'INITIAL_HAND',mapId,keep:s.hand.slice(0,4).map(c=>c.cardId)});assert.equal(s.mapId,mapId);assert.equal(s.buildings.length,mapId==='A'?2:0);assert.equal(projectArkSoloGame(s,s.playerId).mapId,mapId);
 s=act(s,{kind:'FUNDRAISE',x:0});assert.equal(s.progress.turnsCompleted,1);assert.equal(s.mapId,mapId);
 assert.equal(arkMapCells(mapId).length,58);assert.equal(arkMapProjectBonuses(mapId).length,7);
 const cells=arkMapCells(mapId);assert.equal(new Set(cells.map(c=>`${c.q},${c.r}`)).size,58);
 for(const cell of cells)if(cell.bonus)assert.equal(cell.terrain,'LAND',`${mapId} ${JSON.stringify(cell)}`);
});
test('Invalid map identifiers reject atomically; old setup remains map A',()=>{
 const s=create(),before=structuredClone(s);assert.equal(applyArkSoloCommand(s,s.playerId,s.revision,{kind:'INITIAL_HAND',mapId:'9',keep:s.hand.slice(0,4).map(c=>c.cardId)},now,next()).ok,false);assert.deepEqual(s,before);assert.equal(arkInitialBuildings().length,2);
});
test('Four players retain different maps and advanced maps cannot be selected twice',()=>{
 const ids=[0,1,2,3].map(i=>v.parse(PlayerIdSchema,`map-player-${i}`));let s=createArkMultiplayerGame({gameId:v.parse(GameIdSchema,'map-multi'),playerIds:ids,now,transitionId:next(),random,nextCardId:()=>`map-multi-${++seq}`});
 for(const [i,p] of [...s.players].entries()){
   if(i===1)assert.equal(applyArkMultiplayerCommand(s,p.playerId,s.revision,{kind:'INITIAL_HAND',mapId:'1',keep:p.hand.slice(0,4).map(c=>c.cardId)},now,next(),random).ok,false);
   const r=applyArkMultiplayerCommand(s,p.playerId,s.revision,{kind:'INITIAL_HAND',mapId:ARK_MAP_IDS[i+2]!,keep:p.hand.slice(0,4).map(c=>c.cardId)},now,next(),random);assert.ok(r.ok);s=r.state;
 }
 for(const p of s.players)assert.deepEqual(projectArkMultiplayerGame(s,p.playerId).table!.players.map(p=>p.mapId),['1','2','3','4']);
});
test('Outdoor Areas increases effective enclosure size for admission and mandatory smallest release',()=>{
 const animal=ARK_CARDS.find(c=>c.kind==='ANIMAL'&&c.size===3&&c.standard&&c.water===0&&c.rock===0)!;
 const small=building(6,3),far=building(0,2);assert.equal(arkEnclosureSize(small,'2'),3);assert.equal(arkEnclosureSize(far,'2'),1);
 assert.deepEqual(arkAnimalHousingChoices([small,far],animal,false,'2'),[small.id]);assert.deepEqual(arkAnimalHousingChoices([small],animal,false,'A'),[]);
 assert.deepEqual(arkEnclosuresToEmpty([{...small,occupied:true}],animal,false,'2'),[small.id]);
});
test('Silver Lake money spaces and Hollywood H spaces trigger different kinds of rewards',()=>{
 assert.deepEqual(arkNewBuildingEffects([],building(0,2),[],'3'),[{kind:'GAIN',resource:'MONEY',amount:2}]);
 assert.deepEqual(arkNewBuildingEffects([],building(1,5),[{key:'221',cardId:'archaeologist'}],'8'),[{kind:'HOLLYWOOD'}]);
 assert.equal(arkMapCells('8').find(c=>c.q===1&&c.r===4)?.bonus,null);
});
const cardState=(mapId:ArkMapId):ArkCardPlayState=>({mapId,played:[],partners:[],universities:[],actions:ARK_ACTIONS.map(kind=>({kind,upgraded:false,venom:false,constriction:false,multiplier:0})),reputation:1,appeal:20,hand:[],display:Array.from({length:6},()=>null),buildings:[],money:40,wazaFocus:null});
test('Observation Tower rewards a newly occupied standard enclosure, but not flocking or an already occupied one',()=>{
 const before={...cardState('1'),supportedProjects:0,buildings:[building(2,2)]},after={...before,buildings:[building(2,2,'ENCLOSURE_1',true)]},card={key:'404',cardId:'animal'};
 const gain={kind:'GAIN',resource:'APPEAL',amount:2};assert.ok(arkCardEntryEffects(before,after,card).some(e=>JSON.stringify(e.effect)===JSON.stringify(gain)));assert.ok(!arkCardEntryEffects(after,after,card).some(e=>JSON.stringify(e.effect)===JSON.stringify(gain)));
});
test('Research Institute stacks with WAZA but does not waive habitat requirements',()=>{
 const s=cardState('6'),animal=ARK_CARDS.find(c=>c.key==='402')!;assert.equal(arkIgnoredAnimalConditions(animal,s),0);s.buildings=[building(0,5)];assert.equal(arkIgnoredAnimalConditions(animal,s),1);s.played=[{key:'263',cardId:'waza'}];assert.equal(arkIgnoredAnimalConditions(animal,s),2);
});
test('Hollywood reduction affects both strength and paid sponsor cost only when all H spaces are built',()=>{
 const s=cardState('8');s.hand=[{key:'223',cardId:'sponsor'}];s.buildings=[building(1,5),building(4,5),building(6,4)];
 const scope={kind:'SPONSOR',upgraded:false,remaining:2,paySponsorLevel:false} as const;const r=playArkZooCard(s,scope,{cardId:'sponsor',housingId:null});assert.ok(r.ok);assert.equal(r.remaining,0);assert.equal(r.paid,0);
 const paid=playArkZooCard(s,{...scope,paySponsorLevel:true},{cardId:'sponsor',housingId:null});assert.ok(paid.ok);assert.equal(paid.paid,2);s.buildings.pop();assert.equal(playArkZooCard(s,scope,{cardId:'sponsor',housingId:null}).ok,false);
});
test('Restaurant counts occupied hexes including empty enclosures; parlors pay for every kiosk only after unlocking',()=>{
 const s={...cardState('5'),supportedProjects:0,buildings:[building(3,2),building(3,3)]};assert.deepEqual(arkSponsorIncome(s).map(e=>e.effect),[{kind:'GAIN',resource:'MONEY',amount:2}]);
 const p={...cardState('7'),supportedProjects:0,buildings:[building(1,1),building(5,2),building(5,5),building(0,5,'KIOSK')]};assert.ok(arkMapFeatureActive('7',p.buildings));assert.deepEqual(arkSponsorIncome(p).map(e=>e.effect),[{kind:'GAIN',resource:'MONEY',amount:1}]);p.buildings.shift();assert.deepEqual(arkSponsorIncome(p),[]);
});
test('Map-specific project rewards distinguish recurring and immediate bonuses',()=>{
 assert.equal(arkProjectBonusIncome(['CONSERVATION_1'],'2').length,0);assert.equal(arkProjectBonusIncome(['CONSERVATION_1'],'0').length,1);assert.equal(arkProjectBonusIncome(['PAID_SPONSOR'],'1').length,1);assert.equal(arkProjectBonusIncome(['APPEAL_2'],'7').length,1);
 assert.deepEqual(arkProjectBonusEffect('SPECIAL_ENCLOSURE'),{kind:'FREE_BUILD',buildings:['ReptileHouse','LargeBirdAviary'],amount:1,ignoreBuildUpgrade:true});
 const s={mapId:'1' as const,partners:[],partnerSupply:[],universities:[],universitySupply:['RESEARCH_2']};assert.ok(acquireArkAssociationTile(s,false,{kind:'UNIVERSITY',university:'RESEARCH_2'},'bonus')?.some(r=>r.kind==='UPGRADE'));
});
for(const mapId of ARK_MAP_IDS.filter(id=>id!=='A'))test(`Map ${mapId}: construction uses that map's terrain and retains valid state`,()=>{
 let s=create();s=act(s,{kind:'INITIAL_HAND',mapId,keep:s.hand.slice(0,4).map(c=>c.cardId)});
 const cell=arkMapCells(mapId).find(c=>c.q===0&&c.terrain==='LAND'&&!c.restricted&&!c.bonus)!;assert.ok(cell);
 s=act(s,{kind:'BUILD',x:0,placement:{building:'ENCLOSURE_1',anchor:{q:cell.q,r:cell.r},rotation:0,reflected:false}});
 assert.equal(s.buildings.length,1);assert.equal(s.money,23);assert.equal(s.progress.turnsCompleted,1);
});
test('Harbor consumes a held card once per real turn, and is unavailable before connection',()=>{
 let s=create();s=act(s,{kind:'INITIAL_HAND',mapId:'4',keep:s.hand.slice(0,4).map(c=>c.cardId)});
 assert.equal(applyArkSoloCommand(s,s.playerId,s.revision,{kind:'HARBOR',cardId:s.hand[0]!.cardId},now,next()).ok,false);
 s=act(s,{kind:'BUILD',x:0,placement:{building:'ENCLOSURE_1',anchor:arkOffset(0,5),rotation:0,reflected:false}});
 const turns=s.progress.turnsCompleted,money=s.money;
 s=act(s,{kind:'HARBOR',cardId:s.hand[0]!.cardId});assert.equal(s.money,money+3);assert.equal(s.progress.turnsCompleted,turns);assert.equal(s.harborUsed,true);
 assert.equal(applyArkSoloCommand(s,s.playerId,s.revision,{kind:'HARBOR',cardId:s.hand[0]!.cardId},now,next()).ok,false);
 s=act(s,{kind:'TAKE_X',action:'BUILD'});assert.equal(s.harborUsed,false);s=act(s,{kind:'HARBOR',cardId:s.hand[0]!.cardId});assert.equal(s.harborUsed,true);
});
for(const mapId of ARK_MAP_IDS)test(`Map ${mapId}: solo break cycle and final scoring restore through all 27 turns`,()=>{
 let s=create();s=act(s,{kind:'INITIAL_HAND',mapId,keep:s.hand.slice(0,4).map(c=>c.cardId)});
 for(let guard=0;s.phase!=='FINISHED'&&guard<50;guard++){
   if(s.pending?.kind==='BREAK_DISCARD')s=act(s,{kind:'DISCARD',choiceId:s.pending.choiceId,cards:s.hand.slice(0,s.pending.count).map(c=>c.cardId)});
   else if(s.pending?.kind==='FINAL_GOAL')s=act(s,{kind:'FINAL_GOAL',choiceId:s.pending.choiceId,discard:s.goals[0]!.cardId});
   else s=act(s,{kind:'FUNDRAISE',x:0});
 }
 assert.equal(s.phase,'FINISHED');assert.equal(s.progress.turnsCompleted,27);assert.equal(s.mapId,mapId);
});
