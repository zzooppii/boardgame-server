/** Optional real Chrome integration: npm run build first, then set PLAYWRIGHT_MODULE and MARS_CHROME_PATH. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHttpServer} from '../apps/server/dist/server.js';
import {marsOffers,parseMarsState,applyMarsAction} from '../apps/server/dist/games/mars/domain/game.js';
import {transitionMars} from '../apps/server/dist/games/mars/application/service.js';
import {marsCard} from '../packages/shared/dist/index.js';
const require=createRequire(import.meta.url);

test('Mars Prelude: independent lobby option, private 2-of-4 choice, keyboard, reconnect, mobile execution and sound mute', {timeout:120000}, async t=>{
 const webDistPath=await mkdtemp(join(tmpdir(),'mars-prelude-assets-'));
 t.after(()=>rm(webDistPath,{recursive:true,force:true}));
 await cp(new URL('../apps/web/dist/',import.meta.url),webDistPath,{recursive:true});
 const server=createHttpServer({serveWeb:true,webDistPath});t.after(()=>server.shutdown());
 await new Promise(resolve=>server.httpServer.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.httpServer.address().port}`;
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.MARS_CHROME_PATH?{executablePath:process.env.MARS_CHROME_PATH}:{})});
 const output=await mkdtemp(join(tmpdir(),'mars-prelude-browser-')),pages=[],errors=[];
 t.after(async()=>{for(const [i,page] of pages.entries())if(!page.isClosed())await page.screenshot({path:join(output,`final-${i}.png`),fullPage:true});await browser.close();});
 for(let i=0;i<2;i++){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.marsAudioGains=[];const create=AudioContext.prototype.createGain;AudioContext.prototype.createGain=function(){const gain=create.call(this);window.marsAudioGains.push(gain);return gain;};});await page.goto(url);pages.push(page);}
 const [host,guest]=pages;
 await host.getByLabel('닉네임',{exact:true}).fill('프렐류드방장');await host.locator('.game-option').filter({hasText:'테라포밍 마스'}).click();await host.getByRole('button',{name:'선택한 게임으로 방 만들기',exact:true}).click();
 const invite=host.getByRole('button',{name:/초대 ·/});await invite.waitFor();const code=(await invite.innerText()).split(' · ')[1];
 await guest.getByLabel('닉네임',{exact:true}).fill('프렐류드참가자');await guest.locator('#room-code').fill(code);await guest.getByRole('button',{name:'방 참가하기',exact:true}).click();await guest.locator('.tm-lobby').waitFor();
 assert.equal(await guest.getByRole('checkbox',{name:/프렐류드/}).isDisabled(),true);
 await host.getByRole('checkbox',{name:/프렐류드/}).click();await guest.getByText('프로젝트 144장',{exact:true}).waitFor();await host.getByText('프로젝트 144장',{exact:true}).waitFor();
 assert.equal(await host.getByRole('checkbox',{name:/기업시대/}).isChecked(),false);
 await host.getByRole('checkbox',{name:/기업시대/}).click();await guest.getByText('프로젝트 215장',{exact:true}).waitFor();
 await host.reload();await host.getByText('프로젝트 215장',{exact:true}).waitFor();assert.equal(await host.getByRole('checkbox',{name:/프렐류드/}).isChecked(),true);
 await host.screenshot({path:join(output,'prelude-lobby.png'),fullPage:true});
 await host.getByRole('button',{name:'테라포밍 시작 →'}).click();
 for(const page of pages){const panel=page.getByRole('region',{name:'프렐류드 선택'});await panel.waitFor();
  const setupRoom=await server.runtime.persistence.findByCode(code),setupOwner=setupRoom.players.find(p=>p.nickname===(page===host?'프렐류드방장':'프렐류드참가자'));
  const research=setupRoom.game.state.players.find(p=>p.playerId===setupOwner.playerId).research;
  assert.equal(await page.locator('.tm-research .tm-card-requirements').count(),research.filter(c=>{const d=marsCard(c.definitionId);return (d.corporateRequirements??d.requirements).length>0;}).length,'Initial purchase shows every printed requirement before confirmation');
  assert.equal(await panel.locator('.tm-card').count(),4);assert.equal(await page.getByRole('button',{name:'선택 확정',exact:true}).isDisabled(),true);await panel.locator('.tm-card').nth(0).focus();await panel.locator('.tm-card').nth(0).press('Space');await panel.locator('.tm-card').nth(1).click();assert.equal(await panel.locator('.tm-card').nth(2).isDisabled(),true);
  if(page===host){await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);await panel.screenshot({path:join(output,'prelude-choice-mobile.png')});}
  await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 }
 const room=()=>server.runtime.persistence.findByCode(code);
 async function waitRevision(revision){for(let i=0;i<500;i++){const current=await room();if(current.game.state.revision>revision)return current;await delay(10);}throw new Error('No server revision after UI command');}
 let stored=await room();for(let i=0;i<100&&stored.game.state.stage==='SETUP';i++){await delay(10);stored=await room();}
 assert.equal(stored.game.state.stage,'PRELUDE');
 await host.reload();await host.getByRole('region',{name:'프렐류드 실행'}).waitFor();assert.equal(await host.getByRole('region',{name:'프렐류드 실행'}).locator('.tm-card').count(),2);
 for(let i=0;i<100;i++){
  stored=await room();const s=stored.game.state;if(s.stage==='ACTION')break;
  const owner=stored.players.find(p=>p.playerId===s.activePlayerId),page=owner.nickname==='프렐류드방장'?host:guest;
  if(s.payment){await page.getByRole('button',{name:'지불·실행 확정',exact:true}).click();}
  else if(s.cardChoice){const panel=page.locator('.tm-card-choice'),choice=s.cardChoice.view;if(choice.kind==='KEEP'){for(let n=0;n<choice.keepCount;n++)await panel.locator('.tm-card').nth(n).click();await panel.getByRole('button',{name:`${choice.keepCount}장 선택 확정`,exact:true}).click();}else throw new Error('Unexpected private choice');}
  else {const offer=marsOffers(s,s.activePlayerId)[0];assert.ok(offer);
   if(offer.kind==='CARD'){const c=s.players.flatMap(p=>[...p.hand,...p.preludes]).find(c=>c.tileId===offer.targetId);const section=offer.id.startsWith('prelude:')?page.getByRole('region',{name:'프렐류드 실행'}):page.locator('.tm-hand-row');await section.locator('.tm-card').filter({hasText:marsCard(c.definitionId).englishName}).click();await page.getByRole('button',{name:'행동 확정',exact:true}).click();}
   else if(offer.kind==='PLACE'){await page.locator('.tm-hex.legal').first().click();await page.getByRole('button',{name:'배치 확정',exact:true}).click();}
   else {await page.locator('.tm-offer').first().click();await page.getByRole('button',{name:'행동 확정',exact:true}).click();}
  }
  await waitRevision(s.revision);
 }
 stored=await room();assert.equal(stored.game.state.stage,'ACTION');assert.equal(stored.game.state.actionsTaken,0);assert.equal(stored.game.state.activePlayerId,stored.game.state.startingPlayerId);
 await host.locator('.tm-sound summary').click();await host.getByRole('button',{name:'해양 소리 듣기',exact:true}).click();await host.getByRole('button',{name:'음소거',exact:true}).click();assert.equal(await host.locator('.tm-sound input').inputValue(),'0');await host.waitForFunction(()=>window.marsAudioGains.length>0&&window.marsAudioGains[0].gain.value<.001);
 await host.screenshot({path:join(output,'prelude-after-mobile.png'),fullPage:true});
 // Trusted fixture uses real card payment and inventory; all UI commands still pass through the server.
 stored=await room();const state=parseMarsState(stored.game.state),player=state.players.find(p=>p.playerId===state.activePlayerId);
 const payer=stored.players.find(p=>p.playerId===player.playerId).nickname==='프렐류드방장'?host:guest;
 function moveCard(id,to){for(const zone of [state.deck,state.discard,...state.players.flatMap(p=>[p.hand,p.played,p.research])]){const i=zone.findIndex(c=>c.definitionId===id);if(i>=0){const [card]=zone.splice(i,1);to.push(card);return card;}}throw new Error(id);}
 player.corporationId='Helion';player.initialActionDone=true;player.resources.money=20;player.resources.heat=2;
 const microbe=moveCard('Psychrophiles',player.played);microbe.resources=3;
 const plant=moveCard('AdaptedLichen',player.hand);state.players.forEach(p=>p.handCount=p.hand.length);
 const service=server.runtime.marsService,opened=applyMarsAction(parseMarsState(state),player.playerId,{type:'TAKE',actionId:`card:${plant.tileId}`},service.deps.clock.now(),service.deps.ids.generateTurnId(),service.deps.random);
 assert.ok(opened.ok);
 const replaced=await server.runtime.persistence.replace({candidate:transitionMars(stored,opened.state,service.deps.clock.now()),expectedRoomRevision:stored.roomRevision,expectedStorageRevision:stored.storageRevision});assert.equal(replaced.status,'REPLACED');
 await service.notify(stored.roomId);await payer.setViewportSize({width:320,height:740});
 const payment=payer.locator('.tm-payment'),cash=payment.locator('label').filter({hasText:/^M€/}).locator('input');await payment.waitFor();
 const cost=opened.state.payment.cost;assert.equal(await cash.inputValue(),String(cost));
 await payment.getByLabel('지불할 미생물',{exact:true}).fill('2');
 await payment.locator('label').filter({hasText:/^열/}).locator('input').fill('1');
 await payment.getByRole('button',{name:'부족분 M€로 맞추기',exact:true}).click();
 assert.equal(await cash.inputValue(),String(cost-5));
 await payment.getByText('보유 3 · 지불 후 1 · 식물 태그 카드 전용',{exact:true}).waitFor();
 assert.equal((await room()).game.state.players.find(p=>p.playerId===player.playerId).resources.money,20,'Adjustment alone never spends resources');
 assert.equal(await payer.evaluate(()=>document.documentElement.scrollWidth),320);
 await payment.screenshot({path:join(output,'mixed-payment-mobile.png')});
 await payment.getByRole('button',{name:'지불·실행 확정',exact:true}).click();await payment.waitFor({state:'detached'});
 const paid=(await room()).game.state.players.find(p=>p.playerId===player.playerId);
 assert.equal(paid.resources.money,20-(cost-5));assert.equal(paid.resources.heat,1);assert.equal(paid.played.find(c=>c.tileId===microbe.tileId).resources,1);assert.ok(paid.played.some(c=>c.tileId===plant.tileId));
 await payer.getByRole('button',{name:'낸 카드',exact:true}).click();
 const psychrophiles=payer.locator('.tm-engine .tm-card').filter({hasText:'Psychrophiles'});
 await psychrophiles.locator('.tm-card-requirements').getByText('기온 -20°C 이하',{exact:false}).waitFor();
 assert.match(await psychrophiles.getAttribute('aria-label'),/인쇄 조건: 기온 -20°C 이하/);
 await psychrophiles.focus();await psychrophiles.press('Enter');
 await payer.locator('.tm-detail .tm-requirements').getByText('기온 -20°C 이하',{exact:false}).waitFor();
 assert.equal(await payer.evaluate(()=>document.documentElement.scrollWidth),320);
 await psychrophiles.screenshot({path:join(output,'printed-condition-mobile.png')});
 assert.deepEqual(errors,[]);console.log('Prelude screenshots:',output);
});
