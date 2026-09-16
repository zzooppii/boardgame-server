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
