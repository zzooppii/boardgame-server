import test from 'node:test';import assert from 'node:assert/strict';
import {arkBuildOptionAdvice} from '../features/ark-nova/action-controls.js';
import {arkSoloSetupFixture as fixture} from '../features/ark-nova/test-fixture.js';
const state={...fixture,actions:[fixture.actions.find(a=>a.kind==='BUILD')!,...fixture.actions.filter(a=>a.kind!=='BUILD')]};
test('Build I at strength one only offers one-space buildings',()=>{
 for(const kind of ['ENCLOSURE_1','KIOSK','PAVILION'])assert.equal(arkBuildOptionAdvice(state,kind),null);
 for(let n=2;n<=5;n++)assert.equal(arkBuildOptionAdvice(state,`ENCLOSURE_${n}`),`행동력 ${n} 필요 · 현재 1`);
 assert.equal(arkBuildOptionAdvice(state,'ReptileHouse'),'건설 II 필요');
});
test('X boosts, money and remaining construction strength constrain choices',()=>{
 assert.equal(arkBuildOptionAdvice({...state,x:1},'ENCLOSURE_2',1),null);
 assert.equal(arkBuildOptionAdvice({...state,money:1},'ENCLOSURE_1'),'돈 2 필요 · 보유 1');
 assert.equal(arkBuildOptionAdvice({...state,activeBuild:{remaining:0,upgraded:true,builtKinds:['ENCLOSURE_1']}},'ENCLOSURE_2'),'행동력 2 필요 · 현재 0');
});
