import assert from 'node:assert/strict';
import test from 'node:test';
import { marsPaymentValue, marsResources, marsCard, MARS_CORPORATE_ERA_CARD_FACTS } from '@hangul-rummikub/shared';
import { marsEconomyTags, marsMetalValues, marsDiscountedCost, marsCardIncome, marsStandardProjectIncome, marsJovianProduction, marsTagProduction, type MarsEconomyPlayer } from './games/mars/domain/economy.js';

const player = (corporationId: string, ...ids: string[]): MarsEconomyPlayer => ({ corporationId, played: ids.map(definitionId => ({ definitionId })) });
const printed = (id: string) => {
    const result = MARS_CORPORATE_ERA_CARD_FACTS.find(c => c.id === id);
    assert.ok(result, id);
    return result;
};

test('Mars economy stacks global, space and earth discounts once per card and floors costs at zero', () => {
    const earth = player('Teractor', 'EarthOffice', 'EarthCatapult', 'AntiGravityTechnology', 'ResearchOutpost');
    assert.equal(marsDiscountedCost(earth, printed('AcquiredCompany')), 0);
    assert.equal(marsDiscountedCost(earth, printed('InterstellarColonyShip')), 13);
    const space = player('Teractor', 'EarthOffice', 'EarthCatapult', 'AntiGravityTechnology', 'ResearchOutpost', 'Shuttles', 'SpaceStation', 'QuantumExtractor', 'MassConverter');
    assert.equal(marsDiscountedCost(space, printed('InterstellarColonyShip')), 5);
    assert.equal(marsDiscountedCost(space, printed('IoMiningIndustries')), 28);
    assert.equal(marsDiscountedCost(space, printed('GeneRepair')), 7);
    assert.equal(marsDiscountedCost(player('Thorgate', 'EarthCatapult'), printed('LightningHarvest')), 3);
    // A discount card does not discount itself before it has been paid and entered play.
    assert.equal(marsDiscountedCost(player('Beginner'), printed('EarthCatapult')), 23);
    assert.equal(marsDiscountedCost(player('Beginner', 'EarthCatapult'), printed('EarthCatapult')), 21);
    assert.equal(marsDiscountedCost(earth, { cost: 20, tags: ['earth', 'earth'] }), 9);
});

test('Mars economy combines Advanced Alloys and Phobolog and uses the same payment arithmetic as the client', () => {
    assert.deepEqual(marsMetalValues(player('Beginner')), { steelValue: 2, titaniumValue: 3 });
    assert.deepEqual(marsMetalValues(player('PhoboLog')), { steelValue: 2, titaniumValue: 4 });
    assert.deepEqual(marsMetalValues(player('Beginner', 'AdvancedAlloys')), { steelValue: 3, titaniumValue: 4 });
    const values = marsMetalValues(player('PhoboLog', 'AdvancedAlloys'));
    assert.deepEqual(values, { steelValue: 3, titaniumValue: 5 });
    assert.equal(marsPaymentValue({ money: 1, steel: 2, titanium: 3, heat: 4 }, values), 26);
});

test('Mars economy stacks event income without awarding event income for automated cards', () => {
    const p = player('InterplanetaryCinematics', 'MediaGroup', 'OptimalAerobraking');
    assert.deepEqual(marsCardIncome(p, marsCard('Asteroid')), marsResources({ money: 8, heat: 3 }));
    assert.deepEqual(marsCardIncome(p, printed('MineralDeposit')), marsResources({ money: 5 }));
    assert.deepEqual(marsCardIncome(p, printed('LagrangeObservatory')), marsResources());
    const credicor = player('CrediCor', 'EarthCatapult', 'AntiGravityTechnology', 'ResearchOutpost', 'MediaGroup', 'OptimalAerobraking');
    assert.equal(marsDiscountedCost(credicor, marsCard('Comet')), 16);
    assert.deepEqual(marsCardIncome(credicor, marsCard('Comet')), marsResources({ money: 10, heat: 3 }));
});

test('Mars economy gives standard project refunds after payment, never for selling patents', () => {
    const p = player('CrediCor', 'StandardTechnology');
    assert.equal(marsStandardProjectIncome(p, 'city', 25), 7);
    assert.equal(marsStandardProjectIncome(p, 'greenery', 23), 7);
    assert.equal(marsStandardProjectIncome(p, 'aquifer', 18), 3);
    assert.equal(marsStandardProjectIncome(p, 'sell', 0), 0);
    assert.equal(marsStandardProjectIncome(player('Thorgate', 'StandardTechnology'), 'power', 8), 3);
});

test('Mars economy counts corporate and duplicate tags but excludes played event tags', () => {
    const p = player('SaturnSystems', 'Research', 'TechnologyDemonstration', 'IoMiningIndustries');
    assert.equal(marsEconomyTags(p, 'science'), 2);
    assert.equal(marsEconomyTags(p, 'space'), 1);
    assert.equal(marsEconomyTags(p, 'jovian'), 2);
    assert.equal(marsEconomyTags(player('MiningGuild', 'MedicalLab'), 'building'), 3);
    assert.equal(marsJovianProduction(p, printed('IoMiningIndustries')), 1);
    assert.equal(marsJovianProduction(p, printed('Research')), 0);
    assert.equal(marsJovianProduction(player('Teractor'), printed('IoMiningIndustries')), 0);
});

test('Mars economy production counts the newly played card, floors pairs and isolates opponent tags', () => {
    assert.deepEqual(marsTagProduction(player('Teractor', 'Cartel', 'EarthOffice'), [], 'earthIncome'), marsResources({ money: 3 }));
    assert.deepEqual(marsTagProduction(player('MiningGuild', 'MedicalLab'), [], 'buildingIncome'), marsResources({ money: 1 }));
    assert.deepEqual(marsTagProduction(player('MiningGuild', 'MedicalLab', 'Mine'), [], 'buildingIncome'), marsResources({ money: 2 }));
    const owner = player('PhoboLog', 'Satellites', 'Asteroid'), opponents = [player('Helion', 'Shuttles', 'TechnologyDemonstration'), player('Teractor', 'IoMiningIndustries')];
    assert.deepEqual(marsTagProduction(owner, opponents, 'spaceIncome'), marsResources({ money: 2 }));
    assert.deepEqual(marsTagProduction(owner, opponents, 'opponentsSpaceIncome'), marsResources({ money: 3 }));
    assert.deepEqual(marsTagProduction(owner, [], 'opponentsSpaceIncome'), marsResources());
});


import { marsScienceExchangeEffects } from './games/mars/domain/science.js';
test('Mars University reacts once per played science tag, including its own, without reacting for other owners',()=>{
 const owner=player('Beginner','MarsUniversity');
 assert.deepEqual(marsScienceExchangeEffects(owner,printed('MarsUniversity')),[{kind:'exchangeCard'}]);
 assert.deepEqual(marsScienceExchangeEffects(owner,printed('Research')),[{kind:'exchangeCard'},{kind:'exchangeCard'}]);
 assert.deepEqual(marsScienceExchangeEffects(owner,marsCard('PowerPlant')),[]);
 assert.deepEqual(marsScienceExchangeEffects(player('Beginner'),printed('Research')),[]);
});

import { marsCanRemoveResource } from './games/mars/domain/protection.js';
import { PlayerIdSchema } from '@hangul-rummikub/shared';
import { parse } from 'valibot';
test('Mars habitat protection applies only to opponents removing plants, animals or microbes',()=>{
 const owner={playerId:parse(PlayerIdSchema,'habitat-owner'),protectedHabitats:true},other=parse(PlayerIdSchema,'habitat-other');
 for(const resource of ['plants','animal','microbe'] as const){assert.equal(marsCanRemoveResource(other,owner,resource),false);assert.equal(marsCanRemoveResource(owner.playerId,owner,resource),true);}
 for(const resource of ['money','steel','titanium','heat','energy','science'] as const)assert.equal(marsCanRemoveResource(other,owner,resource),true);
 assert.equal(marsCanRemoveResource(owner.playerId,owner,'animal','Pets'),false);
 assert.equal(marsCanRemoveResource(other,{...owner,protectedHabitats:false},'microbe'),true);
});

import { marsProductionBox } from './games/mars/domain/production-copy.js';
test('Mars production box extraction excludes actions, tags, instant plants and TR but includes opponent production reductions',()=>{
 assert.deepEqual(marsProductionBox(marsCard('Greenhouses'),[]),[]);
 assert.deepEqual(marsProductionBox(marsCard('Ironworks'),[]),[]);
 assert.deepEqual(marsProductionBox(marsCard('RadChemFactory'),[]),[{kind:'production',resource:'energy',amount:-1}]);
 assert.deepEqual(marsProductionBox(marsCard('BiomassCombustors'),[]),[{kind:'attackProduction',resource:'plants',amount:1},{kind:'production',resource:'energy',amount:2}]);
 assert.deepEqual(marsProductionBox({...marsCard('PowerPlant'),effects:[{kind:'dynamic',rule:'buildingIncome'}]},[]),[{kind:'dynamic',rule:'buildingIncome'}]);
});

import { MARS_CARDS, MARS_CORPORATE_ERA_RESOURCE_ACTIONS } from '@hangul-rummikub/shared';
import { marsCardResourcePoints, marsAddedCardResources } from './games/mars/domain/card-resources.js';
test('Mars resource scoring separates complete groups from points per group for every base and corporate resource card',()=>{
 for(const card of MARS_CARDS.filter(c=>c.score==='resources')){
  assert.ok(card.resourceScore);for(const count of [0,1,2,3,4,7,11])assert.equal(marsCardResourcePoints(count,card.resourceScore),Math.floor(count/card.points),card.id);
 }
 for(const [id,counts] of [['PhysicsComplex',[0,2,4,6,8]],['SecurityFleet',[0,1,2,3,4]],['Tardigrades',[0,0,0,0,1]]] as const){
  const rule=printed(id).score;assert.equal(rule.kind,'resources');if(rule.kind!=='resources')throw new Error('Expected resource score');
  for(let n=0;n<counts.length;n++)assert.equal(marsCardResourcePoints(n,rule),counts[n],id);
 }
 assert.equal(marsCardResourcePoints(7,{per:4,points:1}),1);assert.equal(marsCardResourcePoints(8,{per:4,points:1}),2);
 assert.throws(()=>marsCardResourcePoints(2,{per:0,points:1}));
});
test('Mars resource actions use printed costs and never mix fighters with science, animals or microbes',()=>{
 assert.deepEqual(MARS_CORPORATE_ERA_RESOURCE_ACTIONS.SecurityFleet,[{kind:'stock',resource:'titanium',amount:-1},{kind:'add',resource:'fighter',amount:1,self:true}]);
 assert.deepEqual(MARS_CORPORATE_ERA_RESOURCE_ACTIONS.PhysicsComplex,[{kind:'stock',resource:'energy',amount:-6},{kind:'add',resource:'science',amount:1,self:true}]);
 assert.equal(marsAddedCardResources(2,'fighter','fighter',1),3);
 for(const resource of ['animal','microbe','science',null])assert.throws(()=>marsAddedCardResources(2,resource,'fighter',1));
 assert.equal(marsAddedCardResources(0,'science','science',1),1);
});

import {marsBaseRequirements,marsRequirementReason,type MarsRequirementContext} from './games/mars/domain/requirements.js';
const requirementContext=(overrides:Partial<MarsRequirementContext>={}):MarsRequirementContext=>({oxygen:0,temperature:-30,oceans:0,cities:0,ownGreenery:0,production:marsResources(),globalAllowance:0,tagCount:()=>0,...overrides});
test('Mars requirement allowance changes global tracks only and temperature uses two-degree steps',()=>{
 const requirement=[{kind:'global',track:'temperature',amount:0,max:false}] as const;
 assert.equal(marsRequirementReason(requirement,requirementContext({temperature:-4,globalAllowance:2})),null);
 assert.match(marsRequirementReason(requirement,requirementContext({temperature:-6,globalAllowance:2}))??'',/기온 조건/);
 for(const track of ['oxygen','oceans'] as const){
  assert.equal(marsRequirementReason([{kind:'global',track,amount:4,max:false}],requirementContext({[track]:2,globalAllowance:2})),null);
  assert.notEqual(marsRequirementReason([{kind:'global',track,amount:4,max:false}],requirementContext({[track]:1,globalAllowance:2})),null);
 }
 assert.equal(marsRequirementReason([{kind:'global',track:'oxygen',amount:8,max:true}],requirementContext({oxygen:10,globalAllowance:2})),null);
 assert.notEqual(marsRequirementReason([{kind:'global',track:'oxygen',amount:8,max:true}],requirementContext({oxygen:11,globalAllowance:2})),null);
});
test('Mars corporate production, tags and cities never receive global allowance',()=>{
 const ctx=requirementContext({globalAllowance:6});
 assert.match(marsRequirementReason(printed('AsteroidMiningConsortium').requirements,ctx)??'',/티타늄 생산 조건/);
 assert.equal(marsRequirementReason(printed('AsteroidMiningConsortium').requirements,{...ctx,production:marsResources({titanium:1})}),null);
 assert.notEqual(marsRequirementReason(printed('MassConverter').requirements,{...ctx,tagCount:()=>4}),null);
 assert.equal(marsRequirementReason(printed('MassConverter').requirements,{...ctx,tagCount:()=>5}),null);
 assert.notEqual(marsRequirementReason(printed('RadSuits').requirements,{...ctx,cities:1}),null);
 assert.equal(marsRequirementReason(printed('RadSuits').requirements,{...ctx,cities:2}),null);
});
test('Mars base requirement adaptation preserves own greenery and exact tag minimums',()=>{
 const greenery=marsBaseRequirements([{kind:'greenery',amount:1,max:false}]);
 assert.notEqual(marsRequirementReason(greenery,requirementContext({cities:5,globalAllowance:6})),null);
 assert.equal(marsRequirementReason(greenery,requirementContext({ownGreenery:1})),null);
 const tags=marsBaseRequirements([{kind:'science',amount:3,max:false}]);
 assert.notEqual(marsRequirementReason(tags,requirementContext({tagCount:()=>2,globalAllowance:6})),null);
 assert.equal(marsRequirementReason(tags,requirementContext({tagCount:tag=>tag==='science'?3:0})),null);
});

import {MARS_PREPARED_CORPORATE_CARDS} from '@hangul-rummikub/shared';
test('Mars prepared standard cards preserve science, steel production and temperature requirement boundaries',()=>{
 const requirements=(id:string)=>{const c=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(c);return c.requirements;};
 for(const [id,count] of [['AICentral',3],['InterstellarColonyShip',5]] as const){
  assert.notEqual(marsRequirementReason(requirements(id),requirementContext({tagCount:()=>count-1,globalAllowance:6})),null);
  assert.equal(marsRequirementReason(requirements(id),requirementContext({tagCount:tag=>tag==='science'?count:0})),null);
 }
 assert.notEqual(marsRequirementReason(requirements('GreatEscarpmentConsortium'),requirementContext({globalAllowance:6})),null);
 assert.equal(marsRequirementReason(requirements('GreatEscarpmentConsortium'),requirementContext({production:marsResources({steel:1})})),null);
 assert.notEqual(marsRequirementReason(requirements('CaretakerContract'),requirementContext({temperature:-2})),null);
 assert.equal(marsRequirementReason(requirements('CaretakerContract'),requirementContext({temperature:0})),null);
 assert.equal(marsRequirementReason(requirements('CaretakerContract'),requirementContext({temperature:-4,globalAllowance:2})),null);
});
test('Mars prepared economy definitions compose actual discounts, metal value and post-payment rewards',()=>{
 const card=(id:string)=>{const c=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(c,id);return c;};
 const owner=player('Teractor','AntiGravityTechnology','EarthCatapult','EarthOffice','SpaceStation','AdvancedAlloys','MediaGroup','StandardTechnology');
 assert.equal(marsDiscountedCost(owner,card('BusinessNetwork')),0);
 assert.equal(marsDiscountedCost(owner,card('SecurityFleet')),6);
 assert.equal(marsDiscountedCost(player('Beginner'),card('EarthCatapult')),23,'The new card does not discount its own purchase');
 assert.deepEqual(marsMetalValues(owner),{steelValue:3,titaniumValue:4});
 assert.equal(marsCardIncome(owner,card('HiredRaiders')).money,3);
 assert.equal(marsCardIncome(owner,card('BusinessNetwork')).money,0);
 assert.equal(marsStandardProjectIncome(owner,'city',25),3);assert.equal(marsStandardProjectIncome(owner,'sell',0),0);
});
