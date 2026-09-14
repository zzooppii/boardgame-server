import test from 'node:test';
import assert from 'node:assert/strict';
import { arkInitialBuildings, ARK_MAP_A_PROJECT_BONUSES, arkProjectSupportsAreConsistent } from '@hangul-rummikub/shared';
import { supportArkProject, type ArkProjectSupportState } from '../../games/ark-nova/domain/project-support.js';
import { arkProjectBonusEffect, arkProjectBonusIncome } from '../../games/ark-nova/domain/project-bonuses.js';
import { arkProjectEligibility } from '../../games/ark-nova/domain/project-requirements.js';
const card=(key:string)=>({key,cardId:`project-fixture-${key}`});
function state():ArkProjectSupportState {return {hand:[card('130'),card('132'),card('103')],display:Array.from({length:6},()=>null),discarded:[],pouched:{},sponsorTokens:{},
  played:[card('404'),card('415'),card('223'),card('428'),card('516')],buildings:arkInitialBuildings(),baseProjects:[card('104')],playedProjects:[],projectSupports:[],
  activatedProjectBonuses:[],supportedProjects:0,partners:['Africa'],universities:[],reputation:3,appeal:30,money:25,workers:4,busyWorkers:0,taskWorkers:{}};}
const choice=(key:string,bonus:'MONEY_12'|'X_3'|'REPUTATION_2'|'CONSERVATION_1'='MONEY_12')=>({cardId:card(key).cardId,slot:2,bonus,animalId:null,housingId:null});
test('Project support pays staff, claims only one slot and returns project and map rewards as simultaneous effects',()=>{
  const s=state(),before=structuredClone(s),result=supportArkProject(s,false,5,choice('130'));assert.ok(result.ok);
  assert.deepEqual(s,before);assert.equal(result.state.busyWorkers,1);assert.equal(result.state.supportedProjects,1);
  assert.equal(result.state.hand.length,2);assert.equal(result.state.playedProjects[0]!.key,'130');assert.equal(result.state.money,25);
  assert.deepEqual(result.effects.map(j=>j.effect),[{kind:'GAIN',resource:'CONSERVATION',amount:2},{kind:'GAIN',resource:'MONEY',amount:12}]);
  assert.equal(supportArkProject(result.state,true,5,choice('130','X_3')).ok,false);
  assert.equal(supportArkProject(result.state,true,5,choice('132')).ok,false);
  const second=supportArkProject(result.state,true,5,choice('132','X_3'));assert.ok(second.ok);assert.equal(second.state.busyWorkers,3);
  assert.equal(supportArkProject(second.state,true,5,choice('103','REPUTATION_2')).ok,false);
});
test('New projects displace the oldest public card and its claim, retaining lifetime support and activated bonuses',()=>{
  let s=state();
  for(const [key,bonus] of [['130','X_3'],['132','REPUTATION_2'],['103','MONEY_12']] as const) {
    s.busyWorkers=0;s.taskWorkers={};const result=supportArkProject(s,false,5,choice(key,bonus));assert.ok(result.ok);s=result.state;
  }
  assert.deepEqual(s.playedProjects.map(c=>c.key),['103','132']);assert.deepEqual(s.discarded.map(c=>c.key),['130']);
  assert.deepEqual(s.projectSupports.map(c=>c.cardId),[card('132').cardId,card('103').cardId]);
  assert.equal(s.supportedProjects,3);assert.equal(s.activatedProjectBonuses.length,3);assert.equal(s.baseProjects[0]!.key,'104');
});
test('Release loses printed appeal and empties the qualifying enclosure before granting conservation or activation effects',()=>{
  const s=state();s.hand=[card('116')];s.played=[card('404')];s.buildings[1]!.occupied=true;
  const command={...choice('116','CONSERVATION_1'),animalId:card('404').cardId,housingId:'initial-enclosure'};
  assert.equal(supportArkProject(s,false,5,{...command,housingId:null}).ok,false);
  const result=supportArkProject(s,false,5,command);assert.ok(result.ok);
  assert.equal(result.state.appeal,26);assert.equal(result.state.played.length,0);assert.equal(result.state.buildings[1]!.occupied,false);
  assert.equal(result.state.discarded[0]!.key,'404');
  assert.deepEqual(result.effects.map(j=>j.effect),[{kind:'GAIN',resource:'REPUTATION',amount:1},{kind:'GAIN',resource:'CONSERVATION',amount:3},{kind:'GAIN',resource:'CONSERVATION',amount:1}]);
});
test('Market projects require Association II, reputation range, affordability and immediate eligibility',()=>{
  const s=state();s.reputation=4;s.hand=s.hand.filter(c=>c.key!=='130');s.display[2]=card('130');
  assert.equal(supportArkProject(s,false,5,choice('130')).ok,false);
  const poor={...s,money:2};assert.equal(supportArkProject(poor,true,5,choice('130')).ok,false);
  assert.equal(supportArkProject({...s,reputation:2},true,5,choice('130')).ok,false);
  const result=supportArkProject(s,true,5,choice('130'));assert.ok(result.ok);assert.equal(result.state.money,22);assert.equal(result.state.display[2],null);
  assert.equal(supportArkProject(s,true,4,choice('130')).ok,false);
  const vet={...s,played:[...s.played,card('203')]};const allowed=supportArkProject(vet,true,4,choice('130'));assert.ok(allowed.ok);assert.equal(allowed.cost,4);
});
test('Map A has seven distinct activations and only four recurring project incomes',()=>{
  assert.equal(ARK_MAP_A_PROJECT_BONUSES.length,7);
  assert.deepEqual(arkProjectBonusIncome([...ARK_MAP_A_PROJECT_BONUSES]).map(j=>j.effect.kind),['SNAP','FREE_BUILD','GAIN','GAIN']);
  assert.deepEqual(arkProjectBonusEffect('ENCLOSURE_2'),{kind:'FREE_BUILD',buildings:['ENCLOSURE_2'],amount:1,ignoreBuildUpgrade:false});
  assert.deepEqual(arkProjectBonusEffect('SNAP_1'),{kind:'SNAP',amount:1,mayRefillBetween:false});
  const s=state();s.activatedProjectBonuses=[...ARK_MAP_A_PROJECT_BONUSES];s.supportedProjects=7;
  for(const bonus of ARK_MAP_A_PROJECT_BONUSES)assert.equal(supportArkProject(s,true,5,{...choice('130'),bonus}).ok,false);
});
test('Base-row projects remain fixed when supported and cannot be supported again at another level',()=>{
  const s=state();s.baseProjects=[card('103')];s.hand=s.hand.filter(c=>c.key!=='103');
  const first=supportArkProject(s,false,5,choice('103'));assert.ok(first.ok);
  assert.deepEqual(first.state.baseProjects,[card('103')]);assert.equal(first.state.playedProjects.length,0);
  first.state.played.push(card('405'));
  assert.equal(supportArkProject(first.state,true,5,{...choice('103','X_3'),slot:1}).ok,false);
});
test('Breeding support requires an actual animal with its matching partner and grants the chosen slot rewards',()=>{
  const s=state();s.hand=[card('124')];
  const selected={...choice('124','X_3'),slot:0,animalId:card('404').cardId};
  assert.equal(supportArkProject(s,false,5,{...selected,animalId:card('415').cardId}).ok,false);
  const result=supportArkProject(s,false,5,selected);assert.ok(result.ok);
  assert.deepEqual(result.effects.map(j=>j.effect),[{kind:'GAIN',resource:'CONSERVATION',amount:2},{kind:'GAIN',resource:'REPUTATION',amount:2},{kind:'GAIN',resource:'X',amount:3}]);
  assert.deepEqual(result.state.played,s.played);
});
test('Migration Recording supports different release slots, adds a conservation point each time and retains staff costs',()=>{
  const s=state();s.hand=[card('116')];s.played=[card('404'),card('403'),card('224')];s.buildings[1]!.occupied=true;
  const first=supportArkProject(s,false,5,{...choice('116'),animalId:card('404').cardId,housingId:'initial-enclosure'});assert.ok(first.ok);
  assert.equal(first.effects.filter(j=>j.sourceId===card('224').cardId&&j.effect.kind==='GAIN'&&j.effect.resource==='CONSERVATION'&&j.effect.amount===1).length,1);
  const next={...choice('116','X_3'),slot:1,animalId:card('403').cardId};
  const without=structuredClone(first.state);without.played=without.played.filter(c=>c.key!=='224');
  assert.equal(supportArkProject(without,false,5,next).ok,false);
  const before=structuredClone(first.state),second=supportArkProject(first.state,false,5,next);assert.ok(second.ok);
  assert.deepEqual(first.state,before);assert.equal(second.state.busyWorkers,3);assert.equal(second.state.supportedProjects,2);
  assert.deepEqual(second.state.projectSupports.map(p=>p.slot),[2,1]);assert.equal(second.state.appeal,19);
  assert.deepEqual(second.effects.map(j=>j.effect),[{kind:'GAIN',resource:'CONSERVATION',amount:4},{kind:'GAIN',resource:'CONSERVATION',amount:1},{kind:'GAIN',resource:'X',amount:3}]);
  assert.equal(arkProjectSupportsAreConsistent(second.state),true);
  const occupied=structuredClone(first.state);occupied.played.push(card('405'));
  assert.equal(supportArkProject(occupied,false,5,{...choice('116','X_3'),animalId:card('405').cardId}).ok,false);
  assert.equal(arkProjectSupportsAreConsistent({...second.state,projectSupports:[second.state.projectSupports[0]!,second.state.projectSupports[0]!]}),false);
  assert.equal(arkProjectSupportsAreConsistent({...second.state,played:second.state.played.filter(c=>c.key!=='224')}),false);
});
test('Migration Recording does not permit repeated ordinary or breeding projects and gives no bonus for them',()=>{
  const s=state();s.played.push(card('224'));
  const first=supportArkProject(s,false,5,choice('130'));assert.ok(first.ok);
  assert.equal(first.effects.some(j=>j.sourceId===card('224').cardId),false);
  assert.equal(supportArkProject(first.state,false,5,{...choice('130','X_3'),slot:1}).ok,false);
  assert.equal(arkProjectSupportsAreConsistent({...first.state,projectSupports:[{cardId:card('130').cardId,slot:2},{cardId:card('130').cardId,slot:1}]}),false);
  s.hand=[card('124')];
  const breed=supportArkProject(s,false,5,{...choice('124'),slot:0,animalId:card('404').cardId});assert.ok(breed.ok);
  assert.equal(breed.effects.some(j=>j.sourceId===card('224').cardId),false);
  assert.equal(supportArkProject(breed.state,false,5,{...choice('124','X_3'),slot:1,animalId:card('404').cardId}).ok,false);
});
test('Release slots accept the printed 4+, exactly 3 and 2- size groups without allowing a lower group for a large animal',()=>{
  const s=state();s.played=['401','402','403','404','405'].map(card);
  assert.deepEqual(arkProjectEligibility('118',0,s).animals,['401','402'].map(k=>card(k).cardId));
  assert.deepEqual(arkProjectEligibility('118',1,s).animals,[card('403').cardId]);
  assert.deepEqual(arkProjectEligibility('118',2,s).animals,['404','405'].map(k=>card(k).cardId));
  s.hand=[card('118')];
  for(const [key,slot] of [['401',0],['405',2]] as const) {
    const result=supportArkProject(s,false,5,{...choice('118'),slot,animalId:card(key).cardId});assert.ok(result.ok);
    assert.ok(result.state.discarded.some(c=>c.key===key));
  }
  assert.equal(supportArkProject(s,false,5,{...choice('118'),animalId:card('401').cardId}).ok,false);
});
test('Base-project support can spend one token from each breeding sponsor atomically',()=>{
  const s=state();s.baseProjects=[card('103')];s.hand=s.hand.filter(c=>c.key!=='103');
  s.played=[card('404'),card('215'),card('218')];s.sponsorTokens={[card('215').cardId]:2,[card('218').cardId]:2};
  const input={...choice('103'),slot:1,sponsorTokenIds:[card('215').cardId,card('218').cardId]},before=structuredClone(s);
  assert.equal(supportArkProject(s,false,5,{...input,sponsorTokenIds:[]}).ok,false);
  assert.equal(supportArkProject(s,false,5,{...input,sponsorTokenIds:[card('215').cardId]}).ok,false);
  assert.equal(supportArkProject(s,false,5,{...input,sponsorTokenIds:[card('215').cardId,card('215').cardId]}).ok,false);
  assert.deepEqual(s,before);
  const result=supportArkProject(s,false,5,input);assert.ok(result.ok);assert.deepEqual(s,before);
  assert.deepEqual(Object.values(result.state.sponsorTokens),[1,1]);assert.equal(result.state.supportedProjects,1);
  assert.deepEqual(result.effects[0]!.effect,{kind:'GAIN',resource:'CONSERVATION',amount:3});
});
test('Breeding tokens require a played eligible sponsor with supply and a project below the association board',()=>{
  const s=state();s.played.push(card('215'));s.sponsorTokens[card('215').cardId]=2;
  const input={...choice('103'),sponsorTokenIds:[card('215').cardId]};
  assert.equal(supportArkProject(s,false,5,input).ok,false); // Base card acquired into the hand is not a base-row project.
  assert.equal(supportArkProject(s,false,5,{...choice('130'),sponsorTokenIds:input.sponsorTokenIds}).ok,false);
  s.hand=s.hand.filter(c=>c.key!=='103');s.baseProjects=[card('103')];
  for(const id of ['missing',card('404').cardId,'__proto__'])assert.equal(supportArkProject(s,false,5,{...input,sponsorTokenIds:[id]}).ok,false);
  s.sponsorTokens[card('215').cardId]=0;assert.equal(supportArkProject(s,false,5,input).ok,false);
  s.sponsorTokens[card('215').cardId]=2;s.played=s.played.filter(c=>c.key!=='215');s.hand.push(card('215'));
  assert.equal(supportArkProject(s,false,5,input).ok,false);
});
test('A breeding token replaces a missing category for species diversity without creating a permanent icon',()=>{
  const s=state();s.baseProjects=[card('101')];s.played=s.played.filter(c=>c.key!=='415');s.played.push(card('218'));s.sponsorTokens[card('218').cardId]=2;
  const iconsBefore=arkProjectEligibility('101',1,s).value;
  assert.equal(iconsBefore,3);
  const result=supportArkProject(s,false,5,{...choice('101'),slot:1,sponsorTokenIds:[card('218').cardId]});assert.ok(result.ok);
  assert.equal(result.state.sponsorTokens[card('218').cardId],1);
  assert.equal(arkProjectEligibility('101',1,result.state).value,3);
  assert.deepEqual(result.state.played,s.played);
});
