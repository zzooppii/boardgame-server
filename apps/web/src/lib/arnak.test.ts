import assert from 'node:assert/strict';
import test from 'node:test';
import {GAME_CATALOG} from '../features/game-catalog/game-catalog.js';
import {WEB_SUPPORTED_GAME_TYPES} from './snapshot-wire-decoder.js';
import {readFileSync} from 'node:fs';
test('Arnak is available in browser catalog and capability advertisement',()=>{assert.ok(GAME_CATALOG.some(g=>g.gameType==='ARNAK'));assert.ok(WEB_SUPPORTED_GAME_TYPES.includes('ARNAK'));});
test('Arnak image files are present with valid WebP headers',()=>{
 for(const file of ['island.webp','camp.webp','atlas.webp'])assert.equal(readFileSync(new URL('../../public/images/arnak/'+file,import.meta.url)).subarray(8,12).toString(),'WEBP');
});
