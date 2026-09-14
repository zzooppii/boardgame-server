import test from 'node:test';
import assert from 'node:assert/strict';
import {ARK_CARDS,ARK_MAP_A,arkBorder,arkInitialBuildings,type ArkBuilding} from '@hangul-rummikub/shared';
import {calculateArkSoloFinalScore} from '../../games/ark-nova/domain/final-scoring.js';
const context=(key:string)=>({played:[{cardId:'sponsor',key}],buildings:arkInitialBuildings(),universityResearch:0,universities:[] as string[],x:0,supportedProjects:0,reputation:0,appeal:20,conservation:0,partners:[] as string[],goals:[{cardId:'goal',key:'001'}]});
const detail=(s:ReturnType<typeof context>)=>calculateArkSoloFinalScore(s).details.find(d=>d.cardId==='sponsor');
const tiles=(kind:string,count:number,occupied=false):ArkBuilding[]=>ARK_MAP_A.filter(c=>c.terrain==='LAND').slice(0,count).map((c,i)=>({id:`tile-${i}`,kind,cells:[{q:c.q,r:c.r}],occupied,used:0}));
test('University and reputation sponsor finals score at their exact thresholds',()=>{
  for(const key of ['203','209']){
    assert.equal(detail({...context(key),universities:['HAND_LIMIT','RESEARCH_2']})?.conservation,0);
    assert.equal(detail({...context(key),universities:['HAND_LIMIT','RESEARCH_2','RESEARCH_REPUTATION']})?.conservation,1);
  }
  for(const key of ['216','220']){
    assert.equal(detail({...context(key),reputation:8})?.conservation,0);
    assert.equal(detail({...context(key),reputation:9})?.conservation,1);
  }
});
test('Kiosk and occupied one-space enclosure finals count facilities, not empty spaces',()=>{
  assert.equal(detail({...context('210'),buildings:tiles('KIOSK',4)})?.conservation,0);
  assert.equal(detail({...context('210'),buildings:tiles('KIOSK',5)})?.conservation,1);
  assert.equal(detail({...context('211'),buildings:tiles('ENCLOSURE_1',5,false)})?.conservation,0);
  assert.equal(detail({...context('211'),buildings:tiles('ENCLOSURE_1',5,true)})?.conservation,1);
});
test('Africa expert, engineer and diversity researcher add appeal without generating conservation rewards',()=>{
  assert.equal(detail({...context('214'),x:5})?.appeal,5);
  const land=tiles('ENCLOSURE_1',ARK_MAP_A.filter(c=>c.terrain==='LAND').length);
  assert.equal(detail({...context('217'),buildings:land})?.appeal,5);
  assert.equal(detail({...context('217'),buildings:land.slice(1)})?.appeal,0);
  const state=context('219');
  state.played.push(...ARK_CARDS.filter(c=>c.water>0||(c.rock??0)>0).map(c=>({cardId:`icon-${c.key}`,key:c.key})));
  assert.equal(detail(state)?.appeal,6);
});
test('Archaeologist final requires every land border but no water or rock coverage',()=>{
  const border=ARK_MAP_A.filter(c=>c.terrain==='LAND'&&arkBorder(c)).map((c,i)=>({id:`edge-${i}`,kind:'ENCLOSURE_1',cells:[{q:c.q,r:c.r}],occupied:false,used:0}));
  assert.equal(detail({...context('221'),buildings:border})?.conservation,1);
  assert.equal(detail({...context('221'),buildings:border.slice(1)})?.conservation,0);
});
