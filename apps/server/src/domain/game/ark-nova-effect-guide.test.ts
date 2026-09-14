import test from 'node:test';
import assert from 'node:assert/strict';
import {ARK_ACTIONS,ArkEffectGuideSchema} from '@hangul-rummikub/shared';
import {safeParse} from 'valibot';
import {projectArkEffectGuide} from '../../games/ark-nova/domain/effect-guide.js';
const actions=ARK_ACTIONS.map(kind=>({kind,upgraded:kind==='BUILD',venom:false,constriction:false,multiplier:0}));
test('Ark effect guide exposes exact public action/build/bonus options without copying executable jobs',()=>{
  assert.deepEqual(projectArkEffectGuide({kind:'UPGRADE'},actions,[]).actions,['CARDS','ANIMALS','ASSOCIATION','SPONSORS']);
  assert.deepEqual(projectArkEffectGuide({kind:'MOVE_ACTION',action:'BUILD',slots:[5]},actions,[]).slots,[5]);
  assert.deepEqual(projectArkEffectGuide({kind:'MULTIPLIER',action:'ANIMALS'},actions,[]).actions,['ANIMALS']);
  const guide=projectArkEffectGuide({kind:'CONSERVATION_BONUS',track:5},actions,[{tile:'X_3',track:5},{tile:'MONEY_10',track:8}]);
  assert.deepEqual(guide.bonuses,['X_3']);assert.ok(safeParse(ArkEffectGuideSchema,guide).success);
  const gain=projectArkEffectGuide({kind:'GAIN',resource:'MONEY',amount:{kind:'ICONS',tag:'Bird',factor:2,cap:10}},actions,[]);
  assert.equal(gain.resource,'MONEY');assert.equal(gain.amount,null);assert.equal(Object.hasOwn(gain,'effect'),false);assert.equal(Object.hasOwn(gain,'tag'),false);
  assert.deepEqual(projectArkEffectGuide({kind:'FREE_BUILD',buildings:['ENCLOSURE_2'],amount:2,ignoreBuildUpgrade:false},actions,[]).buildings,['ENCLOSURE_2']);
});
test('Ark guide permits SNAP refill only between multiple picks and stops upgrades at four',()=>{
  assert.equal(projectArkEffectGuide({kind:'SNAP',amount:1,mayRefillBetween:true},actions,[]).mayRefill,false);
  assert.equal(projectArkEffectGuide({kind:'SNAP',amount:2,mayRefillBetween:true},actions,[]).mayRefill,true);
  assert.deepEqual(projectArkEffectGuide({kind:'UPGRADE'},actions.map((a,i)=>({...a,upgraded:i<4})),[]).actions,[]);
});

test('Ark effect guide reports each gain resource without granting client control over it',()=>{
  for(const resource of ['APPEAL','CONSERVATION','REPUTATION','MONEY','X','WORKER'] as const){
    const guide=projectArkEffectGuide({kind:'GAIN',resource,amount:3},actions,[]);
    assert.equal(guide.resource,resource);assert.equal(guide.amount,3);
    assert.ok(safeParse(ArkEffectGuideSchema,guide).success);
  }
  assert.equal(projectArkEffectGuide({kind:'DRAW',amount:2},actions,[]).resource,null);
});

test('Free building guide respects upgrade exceptions without upgrading the action',()=>{
  const basic=actions.map(a=>({...a,upgraded:false}));
  const effect={kind:'FREE_BUILD',buildings:['ENCLOSURE_2','ReptileHouse','LargeBirdAviary'],amount:1,ignoreBuildUpgrade:false} as const;
  assert.deepEqual(projectArkEffectGuide({...effect,buildings:[...effect.buildings]},basic,[]).buildings,['ENCLOSURE_2']);
  assert.deepEqual(projectArkEffectGuide({...effect,buildings:[...effect.buildings]},actions,[]).buildings,effect.buildings);
  assert.deepEqual(projectArkEffectGuide({...effect,buildings:[...effect.buildings],ignoreBuildUpgrade:true},basic,[]).buildings,effect.buildings);
  assert.ok(basic.every(a=>!a.upgraded));
});

test('Special move guide exposes only destination and a copied moved-card list',()=>{
  const moved=['public-animal'];const guide=projectArkEffectGuide({kind:'MOVE_TO_SPECIAL',buildingId:'public-aviary',moved},actions,[]);
  assert.deepEqual(guide.specialMove,{buildingId:'public-aviary',moved:['public-animal']});assert.ok(safeParse(ArkEffectGuideSchema,guide).success);
  moved.push('later');assert.deepEqual(guide.specialMove!.moved,['public-animal']);
  assert.equal(projectArkEffectGuide({kind:'UPGRADE'},actions,[]).specialMove,undefined);
  assert.equal(safeParse(ArkEffectGuideSchema,{...guide,specialMove:{buildingId:'public-aviary',moved:['public-animal'],privateQueue:[]}}).success,false);
});
