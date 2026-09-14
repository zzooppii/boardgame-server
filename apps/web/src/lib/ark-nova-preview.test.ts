import test from 'node:test';
import assert from 'node:assert/strict';
import { ARK_BUILDINGS, ARK_CARDS, ARK_MAP_A, arkCellKey, arkShape, arkPlacementReason, arkTerrainCount } from '@hangul-rummikub/shared';
import { initialArkPreview, placeArkPreview, previewPlacementReason, searchArkCards, undoArkPreview } from '../features/ark-nova/presentation.js';
import { ArkAudio, readArkSoundPreferences, saveArkSoundPreferences } from '../features/ark-nova/sound.js';

test('Ark map has unique cells; every rotation/reflection preserves tile count and connectivity', () => {
  assert.equal(new Set(ARK_MAP_A.map(arkCellKey)).size, ARK_MAP_A.length);
  for (const [kind, definition] of Object.entries(ARK_BUILDINGS)) for (let rotation = 0; rotation < 6; rotation++) for (const reflected of [false, true]) {
    const shape = arkShape(kind, {q: 0, r: 0}, rotation, reflected);
    assert.equal(new Set(shape.map(arkCellKey)).size, definition.shape.length);
    const seen = new Set([arkCellKey(shape[0]!)]);
    for (let n = 0; n < shape.length; n++) for (const c of shape) if (shape.some(d => seen.has(arkCellKey(d)) && (Math.abs(c.q-d.q)+Math.abs(c.r-d.r)+Math.abs(c.q+c.r-d.q-d.r))/2===1)) seen.add(arkCellKey(c));
    assert.equal(seen.size, shape.length);
  }
});
test('Ark preview invalid placement is atomic, successful placement spends budget and undo restores exactly', () => {
  const state = initialArkPreview(), before = structuredClone(state);
  const draft = {kind:'ENCLOSURE_2', anchor:{q:0,r:3}, rotation:0, reflected:false, upgraded:false};
  assert.notEqual(previewPlacementReason(state,draft), null);
  assert.equal(placeArkPreview(state,draft),state);
  assert.deepEqual(state,before);
  const valid = ARK_MAP_A.map(anchor=>({...draft,anchor})).find(d=>previewPlacementReason(state,d)===null);
  assert.ok(valid);
  const placed=placeArkPreview(state,valid);
  assert.equal(placed.money,36); assert.equal(placed.buildings.length,state.buildings.length+1);
  assert.deepEqual(state,before);
  const undone=undoArkPreview(placed);
  assert.equal(undone.money,state.money); assert.deepEqual(undone.buildings,state.buildings); assert.deepEqual(undone.history,[]);
  const rePlaced=placeArkPreview(undone,valid);
  assert.notEqual(rePlaced.history[0]!.id,placed.history[0]!.id);
});
test('Ark preview rejects terrain, insufficient budget, unupgraded special buildings and unknown buildings', () => {
  const state=initialArkPreview(), draft={kind:'ENCLOSURE_1',anchor:ARK_MAP_A.find(c=>c.terrain==='WATER')!,rotation:0,reflected:false,upgraded:false};
  assert.match(previewPlacementReason(state,draft)??'',/물과 바위/);
  assert.match(previewPlacementReason({...state,money:0},{...draft,anchor:ARK_MAP_A[0]!})??'',/예산/);
  assert.match(previewPlacementReason(state,{...draft,kind:'ReptileHouse'})??'',/건설 II/);
  assert.equal(placeArkPreview(state,{...draft,kind:'invented'}),state);
});
test('Ark geometry rejects overlap, detached buildings and kiosks within two hexes', () => {
  const state=initialArkPreview();
  assert.match(arkPlacementReason(state.buildings,'ENCLOSURE_1',[{q:0,r:3}],false)??'',/이미/);
  assert.match(arkPlacementReason(state.buildings,'ENCLOSURE_1',[{q:8,r:0}],false)??'',/연결/);
  assert.match(arkPlacementReason(state.buildings,'KIOSK',[{q:0,r:2}],false)??'',/매점/);
  assert.match(arkPlacementReason([],'KIOSK',[{q:4,r:1}],false)??'',/가장자리/);
});
test('Covered terrain cannot count as adjacent terrain', () => {
  const allWater=ARK_MAP_A.filter(c=>c.terrain==='WATER');
  assert.equal(arkTerrainCount([...ARK_MAP_A], 'WATER'),0);
  assert.ok(allWater.length>0);
});
test('Ark card reference contains base counts and searchable Korean/English names', () => {
  assert.equal(ARK_CARDS.filter(c=>c.kind==='ANIMAL').length,128);
  assert.equal(ARK_CARDS.filter(c=>c.kind==='SPONSOR').length,64);
  assert.equal(new Set(ARK_CARDS.map(c=>c.key)).size,192);
  assert.equal(searchArkCards(ARK_CARDS,'  TIGER  ','ANIMAL').length,2);
  assert.equal(searchArkCards(ARK_CARDS,'시베리아호랑이','ALL')[0]?.key,'406');
  assert.equal(searchArkCards(ARK_CARDS,'406','SPONSOR').length,0);
});
test('Ark audio is opt-in, clamps preferences, tolerates denied storage and unavailable audio', () => {
  assert.deepEqual(readArkSoundPreferences(),{enabled:false,volume:.45});
  assert.deepEqual(readArkSoundPreferences({getItem:()=>'{"enabled":true,"volume":99}'}),{enabled:true,volume:1});
  assert.deepEqual(readArkSoundPreferences({getItem:()=>'{"enabled":"yes","volume":1}'}),{enabled:false,volume:.45});
  assert.doesNotThrow(()=>saveArkSoundPreferences({enabled:true,volume:.5},{setItem:()=>{throw new Error('Denied');}}));
  let factories=0;const audio=new ArkAudio(()=>{factories++;return null;});
  audio.play('PLACE');assert.equal(factories,0);
  audio.setPreferences({enabled:true,volume:.5});audio.play('PLACE');assert.equal(factories,1);
  assert.doesNotThrow(()=>audio.dispose());
});
