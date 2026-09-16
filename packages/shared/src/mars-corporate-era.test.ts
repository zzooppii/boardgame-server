import assert from 'node:assert/strict';
import test from 'node:test';
import { MARS_CARD_FACTS } from './games/mars/card-facts.js';
import { MARS_CARDS, MARS_CORPORATIONS, marsCard, marsCorporation } from './games/mars/catalog.js';
import { MARS_CORPORATE_ERA_CARD_FACTS, MARS_CORPORATE_ERA_CORPORATION_FACTS, type MarsCorporateCardFact } from './games/mars/corporate-era-facts.js';

function fact(id: string): MarsCorporateCardFact {
    const found = MARS_CORPORATE_ERA_CARD_FACTS.find(c => c.id === id);
    assert.ok(found, id);
    return found;
}

test('Mars Corporate Era printed inventory completes 208 unique numbered projects without changing the playable base set', () => {
    assert.equal(MARS_CORPORATE_ERA_CARD_FACTS.length, 71);
    const all = [...MARS_CARD_FACTS, ...MARS_CORPORATE_ERA_CARD_FACTS];
    assert.equal(new Set(all.map(c => c.id)).size, 208);
    assert.equal(new Set(all.map(c => c.number)).size, 208);
    assert.deepEqual(all.map(c => Number(c.number)).sort((a, b) => a - b), Array.from({ length: 208 }, (_, i) => i + 1));
    assert.equal(MARS_CARDS.length, 137);
    assert.equal(fact('CEOsFavoriteProject').englishName, "CEO's Favorite Project");
    assert.equal(fact('InventorsGuild').englishName, "Inventors' Guild");
    for (const c of MARS_CORPORATE_ERA_CARD_FACTS) {
        assert.throws(() => marsCard(c.id), /Unknown Mars card/);
        assert.ok(Number.isSafeInteger(c.cost) && c.cost >= 0, c.id);
        assert.match(c.number, /^\d{3}$/);
        assert.ok(c.englishName.length > 0);
        assert.equal(c.englishName.includes("\\"), false, c.id);
    }
});

test('Mars Corporate Era retains production, global, tag and all-player city requirements separately', () => {
    assert.deepEqual(fact('AsteroidMiningConsortium').requirements, [{ kind: 'production', resource: 'titanium', amount: 1 }]);
    assert.deepEqual(fact('GreatEscarpmentConsortium').requirements, [{ kind: 'production', resource: 'steel', amount: 1 }]);
    assert.deepEqual(fact('ElectroCatapult').requirements, [{ kind: 'global', track: 'oxygen', amount: 8, max: true }]);
    assert.deepEqual(fact('CaretakerContract').requirements, [{ kind: 'global', track: 'temperature', amount: 0, max: false }]);
    assert.deepEqual(fact('AntiGravityTechnology').requirements, [{ kind: 'tag', tag: 'science', amount: 7 }]);
    assert.deepEqual(fact('PowerSupplyConsortium').requirements, [{ kind: 'tag', tag: 'power', amount: 2 }]);
    assert.deepEqual(fact('RadSuits').requirements, [{ kind: 'cities', scope: 'all', amount: 2 }]);
});

test('Mars Corporate Era preserves resource score multipliers, science tag multiplicity and inherited mining facts', () => {
    assert.deepEqual(fact('PhysicsComplex').score, { kind: 'resources', per: 1, points: 2 });
    assert.deepEqual(fact('Tardigrades').score, { kind: 'resources', per: 4, points: 1 });
    assert.deepEqual(fact('SecurityFleet').score, { kind: 'resources', per: 1, points: 1 });
    assert.equal(fact('SecurityFleet').resource, 'fighter');
    assert.deepEqual(fact('CommercialDistrict').score, { kind: 'adjacentCities', points: 1 });
    assert.deepEqual(fact('IoMiningIndustries').score, { kind: 'tag', tag: 'jovian', points: 1 });
    assert.deepEqual(fact('BribedCommittee').score, { kind: 'fixed', points: -2 });
    assert.deepEqual(fact('Research').tags, ['science', 'science']);
    assert.deepEqual(fact('MiningArea').tags, ['building']);
    assert.equal(fact('MiningArea').cost, 4);
    assert.equal(fact('MiningArea').type, 'automated');
});

test('Mars Corporate Era corporations record printed starts and passives but remain unavailable until implemented', () => {
    assert.equal(MARS_CORPORATE_ERA_CORPORATION_FACTS.length, 2);
    assert.equal(MARS_CORPORATIONS.length, 10);
    for (const c of MARS_CORPORATE_ERA_CORPORATION_FACTS) assert.throws(() => marsCorporation(c.id), /Unknown Mars corporation/);
    const [saturn, teractor] = MARS_CORPORATE_ERA_CORPORATION_FACTS;
    assert.equal(saturn.money, 42);
    assert.deepEqual(saturn.production, { titanium: 1 });
    assert.deepEqual(saturn.passive, { kind: 'jovianProduction', resource: 'money', amount: 1, scope: 'allPlayers', includesSelf: true });
    assert.equal(teractor.money, 60);
    assert.deepEqual(teractor.tags, ['earth']);
    assert.deepEqual(teractor.passive, { kind: 'cardDiscount', tag: 'earth', amount: 3 });
});

import * as v from 'valibot';
import { MarsPaymentViewSchema } from './games/mars/contracts.js';
import { marsPaymentValue } from './games/mars/payment.js';
import { MARS_CORPORATE_ERA_ECONOMIC_EFFECTS } from './games/mars/corporate-era-economy.js';
import { marsEffectText } from './games/mars/catalog.js';

test('Mars metal payment contract accepts supported values and rejects missing or forged multipliers', () => {
    const view = { label: '지불', cost: 14, steel: true, titanium: true, heat: true, steelValue: 3, titaniumValue: 5, cardId: null, cancelable: true };
    const parsed = v.parse(MarsPaymentViewSchema, view);
    assert.equal(marsPaymentValue({ money: 1, steel: 2, titanium: 1, heat: 2 }, parsed), 14);
    for (const invalid of [{ ...view, steelValue: 4 }, { ...view, steelValue: undefined }, { ...view, titaniumValue: 6 }, { ...view, titaniumValue: 4.5 }]) {
        assert.equal(v.safeParse(MarsPaymentViewSchema, invalid).success, false);
    }
});

test('Mars prepared economic effects have readable descriptions and remain outside the live base deck', () => {
    assert.equal(Object.keys(MARS_CORPORATE_ERA_ECONOMIC_EFFECTS).length, 26);
    for (const [id, effects] of Object.entries(MARS_CORPORATE_ERA_ECONOMIC_EFFECTS)) {
        fact(id);
        assert.throws(() => marsCard(id), /Unknown Mars card/);
        for (const effect of effects) assert.ok(marsEffectText(effect).length > 0, id);
    }
    assert.deepEqual(MARS_CORPORATE_ERA_ECONOMIC_EFFECTS.FuelFactory, [
        { kind: 'production', resource: 'energy', amount: -1 },
        { kind: 'production', resource: 'money', amount: 1 },
        { kind: 'production', resource: 'titanium', amount: 1 },
    ]);
});

import { MarsCardChoiceSchema } from './games/mars/contracts.js';
import { MarsActionSchema } from './games/mars/actions.js';
test('Mars private card choices enforce count bounds and commands identify the pending choice',()=>{
 const card={tileId:'private-card',definitionId:'PowerPlant',resources:0,usedGeneration:0};
 assert.equal(v.safeParse(MarsCardChoiceSchema,{id:1,label:'교환',kind:'EXCHANGE',cards:[]}).success,true);
 assert.equal(v.safeParse(MarsCardChoiceSchema,{id:1,label:'교환',kind:'EXCHANGE',cards:[card]}).success,false);
 assert.equal(v.safeParse(MarsCardChoiceSchema,{id:1,label:'선택',kind:'KEEP',cards:[card],keepCount:2}).success,false);
 assert.equal(v.safeParse(MarsCardChoiceSchema,{id:1,label:'선택',kind:'BUY',cards:[card],cost:2,canUseHeat:false}).success,false);
 assert.equal(v.safeParse(MarsActionSchema,{type:'CHOOSE_CARDS',cardIds:[]}).success,false);
 assert.equal(v.safeParse(MarsActionSchema,{type:'CHOOSE_CARDS',choiceId:1,cardIds:[],heat:0}).success,true);
 assert.equal(v.safeParse(MarsActionSchema,{type:'CHOOSE_CARDS',choiceId:1,cardIds:['private-card'],heat:1.5}).success,false);
});

import {MARS_PREPARED_CORPORATE_CARDS,MARS_PENDING_CORPORATE_CARD_IDS} from './games/mars/corporate-era-catalog.js';
test('Mars score-only corporate cards retain exact printed scores and have no invented effects',()=>{
 for(const [id,points] of [['InterstellarColonyShip',4],['TransNeptuneProbe',1]] as const){
  const card=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(card);
  assert.deepEqual(card.effects,[]);assert.equal(card.actions,undefined);assert.equal(card.passive,undefined);
  assert.deepEqual(card.score,{kind:'fixed',points});
 }
});
test('Mars prepared corporate definitions preserve all printed metadata and explicitly partition pending cards without changing the live deck',()=>{
 const ids=MARS_PREPARED_CORPORATE_CARDS.map(c=>c.id),all=[...ids,...MARS_PENDING_CORPORATE_CARD_IDS];
 assert.equal(new Set(all).size,71);assert.deepEqual([...all].sort(),MARS_CORPORATE_ERA_CARD_FACTS.map(c=>c.id).sort());
 for(const card of MARS_PREPARED_CORPORATE_CARDS){const {effects,actions,passive,...printed}=card;assert.deepEqual(printed,fact(card.id));if(!['InterstellarColonyShip','TransNeptuneProbe'].includes(card.id))assert.ok(effects.length||actions?.length||passive,card.id);assert.throws(()=>marsCard(card.id));}
 assert.equal(MARS_CARDS.length,137);assert.ok(MARS_PENDING_CORPORATE_CARD_IDS.includes('OlympusConference'));assert.ok(MARS_PENDING_CORPORATE_CARD_IDS.includes('ViralEnhancers'));
 assert.equal(ids.length,58);assert.equal(MARS_PENDING_CORPORATE_CARD_IDS.length,13);
});
test('Mars assembled cards retain mandatory costs, active actions, passive discounts and printed resource scoring',()=>{
 const prepared=(id:string)=>{const card=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(card,id);return card;};
 assert.equal(prepared('Hackers').cost,3);assert.deepEqual(prepared('Hackers').score,{kind:'fixed',points:-1});assert.equal(prepared('Hackers').effects.length,3);
 assert.deepEqual(prepared('AsteroidMiningConsortium').requirements,[{kind:'production',resource:'titanium',amount:1}]);
 assert.equal(prepared('SecurityFleet').resource,'fighter');assert.equal(prepared('SecurityFleet').actions?.length,2);
 assert.deepEqual(prepared('PhysicsComplex').score,{kind:'resources',per:1,points:2});
 assert.match(prepared('QuantumExtractor').passive??'',/2 M€/);assert.ok(prepared('QuantumExtractor').effects.length);
 assert.ok(prepared('MassConverter').passive);assert.ok(prepared('InventorsGuild').actions);assert.ok(prepared('MarsUniversity').passive);
});

test('Mars prepared economy cards include complete passive text and Business Network production cost with its purchase action',()=>{
 for(const id of ['AdvancedAlloys','AntiGravityTechnology','EarthCatapult','EarthOffice','MediaGroup','SpaceStation','StandardTechnology']){
  const card=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id===id);assert.ok(card,id);assert.ok(card.passive,id);assert.deepEqual(card.effects,[]);assert.equal(card.type,'active');assert.ok(!MARS_PENDING_CORPORATE_CARD_IDS.includes(id));
 }
 const network=MARS_PREPARED_CORPORATE_CARDS.find(c=>c.id==='BusinessNetwork');assert.ok(network);
 assert.equal(network.cost,4);assert.deepEqual(network.tags,['earth']);assert.deepEqual(network.effects,[{kind:'production',resource:'money',amount:-1}]);assert.deepEqual(network.actions,[{kind:'buyCard'}]);
});
