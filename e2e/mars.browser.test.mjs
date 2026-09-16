/**
 * Optional real-browser smoke test; run against a disposable local app server.
 * MARS_BROWSER_URL=http://127.0.0.1:3018 PLAYWRIGHT_MODULE=/path/to/playwright
 * MARS_CHROME_PATH=/path/to/chrome node --test e2e/mars.browser.test.mjs
 * Uses two fresh browser contexts and creates its own room. No saved credentials.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);

test('Mars desktop/mobile: hand tools, keyboard ocean placement, reconnect and sound', {timeout:120000}, async t=>{
 const url=process.env.MARS_BROWSER_URL;
 assert.ok(url,'Set MARS_BROWSER_URL to a disposable local server.');
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Use a local test server.');
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.MARS_CHROME_PATH?{executablePath:process.env.MARS_CHROME_PATH}:{})});
 let complete=false;
 t.after(async()=>{if(!complete){t.diagnostic('Page errors: '+JSON.stringify(errors));for(const [i,page] of pages.entries()){t.diagnostic((await page.locator('body').innerText()).slice(0,1200));await page.screenshot({path:join(output,`failure-${i}.png`),fullPage:true});}}await browser.close();});
 const output=await mkdtemp(join(tmpdir(),'mars-browser-'));
 const errors=[];
 const pages=[];
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.marsAudioStarts=0;
   const start=OscillatorNode.prototype.start;
   OscillatorNode.prototype.start=function(...args){window.marsAudioStarts++;return start.apply(this,args);};
  });
  await page.goto(url);pages.push(page);
 }
 const [host,guest]=pages;
 await host.getByLabel('닉네임',{exact:true}).fill('화성설계자');
 await host.locator('.game-option').filter({hasText:'테라포밍 마스'}).click();
 await host.getByRole('button',{name:'선택한 게임으로 방 만들기',exact:true}).click();
 const invite=host.getByRole('button',{name:/초대 ·/});await invite.waitFor();
 const code=(await invite.innerText()).split(' · ')[1];
 await guest.getByLabel('닉네임',{exact:true}).fill('바다연구원');
 await guest.locator('#room-code').fill(code);
 await guest.getByRole('button',{name:'방 참가하기',exact:true}).click();
 await guest.locator('.tm-lobby').waitFor();
 await host.getByRole('button',{name:'테라포밍 시작 →'}).click();
 for(const page of pages)await page.getByRole('button',{name:'선택 확정',exact:true}).click();
 for(const page of pages){
  await page.locator('.tm-hand').waitFor();
  assert.equal(await page.locator('.tm-hand-row .tm-card').count(),10);
  await page.getByLabel('카드 검색',{exact:true}).fill('찾을수없는프로젝트');
  await page.getByText('조건에 맞는 카드가 없습니다.',{exact:false}).waitFor();
  assert.equal(await page.locator('.tm-hand-row .tm-card').count(),0);
  await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
  assert.equal(await page.locator('.tm-hand-row .tm-card').count(),10);
  await page.locator('.tm-hand-row').evaluate(el=>{el.scrollLeft=400;});
  await page.getByLabel('손패 정렬',{exact:true}).selectOption('cost');
  await page.waitForFunction(()=>document.querySelector('.tm-hand-row')?.scrollLeft===0);
  const costs=await page.locator('.tm-hand .tm-card-top>b').allTextContents();
  const amounts=costs.map(s=>Number(s.replace('M€','')));
  assert.deepEqual(amounts,[...amounts].sort((a,b)=>a-b));
  await page.getByRole('button',{name:'낸 카드',exact:true}).click();
  await page.getByRole('region',{name:'내 기업 엔진 요약'}).waitFor();
  await page.getByRole('button',{name:'화성 지도',exact:true}).click();
 }
 const mobileNav=guest.getByRole('navigation',{name:'게임 영역 바로가기'});
 assert.equal(await host.getByRole('navigation',{name:'게임 영역 바로가기'}).count(),0,'Desktop has no visible mobile navigation.');
 for(const [button,selector] of [['손패','.tm-hand'],['행동','.tm-action-panel'],['지도','.tm-center']]){
  await mobileNav.getByRole('button',{name:new RegExp(button)}).click();
  await guest.waitForFunction(selector=>document.activeElement===document.querySelector(selector),selector);
  const position=await guest.locator(selector).boundingBox();assert.ok(position&&position.y>=0&&position.y<400,'Destination heading is visible above the bottom navigation.');
 }
 await guest.getByRole('button',{name:'낸 카드',exact:true}).click();
 await mobileNav.getByRole('button',{name:'지도',exact:true}).click();await guest.locator('.tm-map').waitFor();
 assert.equal(await guest.locator('.tm-hex[tabindex="0"]').count(),0,'Inactive map cells do not consume keyboard tab stops.');
 await guest.setViewportSize({width:320,height:740});
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth),320);
 for(const button of await mobileNav.getByRole('button').all()){
  const box=await button.boundingBox();assert.ok(box&&box.height>=44&&box.y+box.height<=740,'Navigation remains touchable within a narrow viewport.');
 }
 await mobileNav.getByRole('button',{name:/손패/}).click();
 await guest.waitForFunction(()=>document.activeElement===document.querySelector('.tm-hand'));
 await guest.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await guest.screenshot({path:join(output,'mobile-320.png')});
 await guest.setViewportSize({width:390,height:844});
 await host.screenshot({path:join(output,'desktop.png'),fullPage:true});
 await guest.screenshot({path:join(output,'mobile.png'),fullPage:true});
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth),390);
 const active=(await host.locator('.tm-status-copy').innerText()).includes('· 나')?host:guest;
 await active.setViewportSize({width:390,height:844});
 await active.getByRole('navigation',{name:'게임 영역 바로가기'}).getByRole('button',{name:/행동/}).click();
 await active.getByRole('button',{name:'일반 프로젝트',exact:true}).click();
 await active.getByRole('button',{name:/지하수 추출/}).click();
 await active.getByRole('button',{name:'행동 확정',exact:true}).click();
 await active.getByText('지불할 자원을 확인하세요',{exact:true}).waitFor();
 await active.locator('.tm-payment label').filter({hasText:'M€'}).getByText('보유 42 · 지불 후 24',{exact:true}).waitFor();
 await active.getByRole('button',{name:'지불·실행 확정',exact:true}).click();
 await active.locator('.tm-receipt').getByText('(-18)',{exact:true}).waitFor();
 await active.getByText('배치할 위치를 선택하세요',{exact:true}).waitFor();
 await active.getByRole('navigation',{name:'게임 영역 바로가기'}).getByRole('button',{name:/지도/}).click();
 assert.equal(await active.locator('.tm-hex[tabindex="0"]').count(),await active.locator('.tm-hex.legal').count());
 await active.locator('.tm-hex.legal').first().focus();await active.keyboard.press('Enter');
 assert.equal(await active.locator('.tm-hex.occupied').count(),0,'Selecting is not committing.');
 await active.getByRole('button',{name:'배치 확정',exact:true}).click();
 await active.locator('.tm-hex.occupied').waitFor();
 await active.locator('.tm-receipt').getByText('TR',{exact:true}).waitFor();
 await active.screenshot({path:join(output,'action-feedback.png'),fullPage:true});
 await active.reload();await active.locator('.tm-hand').waitFor();
 assert.equal(await active.locator('.tm-hex.occupied').count(),1);
 assert.equal(await active.locator('.tm-receipt li').count(),0,'Reload does not replay old resource changes.');
 await active.locator('.tm-sound summary').click();
 await active.getByRole('button',{name:'해양 소리 듣기',exact:true}).click();
 await active.waitForFunction(()=>window.marsAudioStarts>0);
 await active.getByRole('button',{name:'음소거',exact:true}).click();
 const muted=await active.evaluate(()=>window.marsAudioStarts);
 await active.getByRole('button',{name:'해양 소리 듣기',exact:true}).click();
 await active.waitForTimeout(250);
 assert.equal(await active.evaluate(()=>window.marsAudioStarts),muted);
 assert.equal(await active.evaluate(()=>localStorage.getItem('mars-sound-volume')),'0');
 await guest.getByLabel('지도 크기',{exact:true}).selectOption('1.5');
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth),390);
 assert.deepEqual(errors,[]);
 complete=true;
 t.diagnostic(`Screenshots: ${output}`);
});
