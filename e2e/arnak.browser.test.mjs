/**
 * Real UI regression against a disposable local production server.
 * ARNAK_BROWSER_URL=http://127.0.0.1:3026 PLAYWRIGHT_MODULE=/path/to/playwright
 * ARNAK_CHROME_PATH=/path/to/chrome node --test e2e/arnak.browser.test.mjs
 * Two fresh contexts; every game mutation is performed through rendered controls.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);

async function assertCampControlContrast(button){
 const ratios=await button.evaluate(element=>{
  const luminance=color=>{
   const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const s=value/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
   return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
  };
  const background=luminance(getComputedStyle(element).backgroundColor);
  return [element,...element.querySelectorAll('small')].map(node=>{
   const foreground=luminance(getComputedStyle(node).color);
   return (Math.max(background,foreground)+0.05)/(Math.min(background,foreground)+0.05);
  });
 });
 assert.ok(ratios.every(ratio=>ratio>=4.5),`Camp control text contrast is too low: ${ratios.join(', ')}`);
}


test('Arnak desktop/mobile: cards, dig, cleanup, five rounds, resume, results, rematch, research, purchase and discovery', {timeout:240000}, async t=>{
 const url=process.env.ARNAK_BROWSER_URL;
 assert.ok(url,'Set ARNAK_BROWSER_URL to a disposable local server.');
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Use a local test server.');
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.ARNAK_CHROME_PATH?{executablePath:process.env.ARNAK_CHROME_PATH}:{})});
 const output=await mkdtemp(join(tmpdir(),'arnak-browser-')),pages=[],errors=[];
 let complete=false;
 t.after(async()=>{
  try {if(!complete){t.diagnostic('Page errors: '+JSON.stringify(errors));for(const [i,page] of pages.entries()){if(page.isClosed())continue;t.diagnostic((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:join(output,`failure-${i}.png`),fullPage:true});}}}
  finally {await browser.close();t.diagnostic(`Screenshots: ${output}`);}
 });
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();pages.push(page);page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   // Observe actual sound synthesis without changing game or transport behavior.
   window.arnakAudioStarts=0;const start=OscillatorNode.prototype.start;
   OscillatorNode.prototype.start=function(...args){window.arnakAudioStarts++;return start.apply(this,args);};
  });await page.goto(url);
 }
 const [host,guest]=pages,names=['유적탐험가','모바일탐험가'];
 await host.getByLabel('닉네임',{exact:true}).fill(names[0]);
 await host.locator('.game-option').filter({hasText:'아르낙'}).click();
 await host.getByRole('button',{name:'선택한 게임으로 방 만들기',exact:true}).click();
 const invite=host.getByRole('button',{name:/초대 ·/});await invite.waitFor();
 const code=(await invite.innerText()).split(' · ')[1];assert.ok(code);
 await guest.getByLabel('닉네임',{exact:true}).fill(names[1]);await guest.locator('#room-code').fill(code);
 await guest.getByRole('button',{name:'방 참가하기',exact:true}).click();await guest.locator('.ar-lobby').waitFor();
 await host.getByRole('button',{name:'탐험 시작 →',exact:true}).click();
 for(const page of pages){await page.locator('.ar-hand').waitFor();assert.equal(await page.locator('.ar-hand .ar-card').count(),5);}
 const history=page=>page.locator('.ar-log summary');
 const all=page=>page.locator('#ar-actions').getByRole('button',{name:'전체',exact:true});
 async function confirm(page){
  const before=await history(page).innerText();
  await page.locator('.ar-confirm').getByRole('button',{name:'선택 확정 →',exact:true}).click();
  for(const peer of pages)await peer.waitForFunction(before=>document.querySelector('.ar-log summary')?.textContent!==before,before);
  assert.equal(await page.locator('#ar-actions [role="alert"]').count(),0);
 }
 async function choose(page,label){
  await all(page).click();
  const group=page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:label})});
  assert.equal(await group.count(),1,`Expected one offer group: ${label}`);
  await group.getByRole('button').first().click();await confirm(page);
 }
 async function active(){
  const label=await host.locator('.ar-roundbar b').innerText();
  const index=names.findIndex(name=>label===`${name}의 차례`);assert.ok(index>=0,`Unknown active player: ${label}`);return pages[index];
 }
 // Inspect and play a free starting card via the actual hand and confirmation panel.
 let page=await active();
 await page.bringToFront();await page.locator('.ar-sound-controls summary').click();
 const audioBefore=await page.evaluate(()=>window.arnakAudioStarts);
 await page.locator('.ar-sound-controls').getByRole('button',{name:'발굴',exact:true}).click();
 await page.waitForFunction(before=>window.arnakAudioStarts>before,audioBefore);
 await page.getByRole('button',{name:'음소거',exact:true}).click();
 assert.equal(await page.locator('.ar-sound-controls').getByRole('button',{name:'발굴',exact:true}).isEnabled(),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('arnak-volume')),'0');
 await page.locator('.ar-sound-controls summary').click();
 await page.locator('.ar-hand').getByRole('button',{name:/^자금 지원,/}).first().click();
 await page.getByRole('button',{name:'일러스트·효과 크게 보기 ↗',exact:true}).click();
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.getByRole('button',{name:'일러스트·효과 크게 보기 ↗'}).evaluate(el=>el===document.activeElement),true);
 const coin=Number(await page.locator('.ar-camp-heading .coin b').innerText());await confirm(page);
 assert.equal(Number(await page.locator('.ar-camp-heading .coin b').innerText()),coin+1);
 assert.equal(await page.locator('.ar-hand .ar-card').count(),4);
 const beforeReload=await page.locator('.ar-camp-heading').innerText(),beforeLog=await history(page).innerText();
 await page.reload();await page.locator('.ar-hand').waitFor();
 assert.equal(await page.locator('.ar-camp-heading').innerText(),beforeReload);assert.equal(await history(page).innerText(),beforeLog);
 assert.equal(await page.locator('.ar-feedback span').count(),0,'Reload does not replay an old resource notice.');
 const rounds=new Set(),dug=new Set(),kept=new Set(),digPlayers=new Set();let commands=1;
 for(let step=0;step<100;step++){
  if(await host.getByRole('region',{name:'탐험 결과',exact:true}).count())break;
  page=await active();
  const round=['I','II','III','IV','V'].indexOf(await page.locator('.ar-roundbar li.current').innerText())+1;assert.ok(round>0);rounds.add(round);
  const key=`${pages.indexOf(page)}:${round}`;
  if(await page.getByRole('region',{name:'라운드 정리 손패',exact:true}).count()){
   // Keep one actual instance, then verify the server-confirmed group after reload.
   if(!kept.has(key)&&round<5&&await page.locator('.ar-cleanup-cards button').count()){
    const candidate=page.locator('.ar-cleanup-cards button').first();const cardLabel=await candidate.getAttribute('aria-label');assert.ok(cardLabel?.endsWith('보관 선택'));
    await candidate.click();await confirm(page);commands++;
    await page.locator('.ar-cleanup').getByRole('heading',{name:'보관할 손패 1장',exact:true}).waitFor();
    if(kept.size===0){await page.reload();await page.locator('.ar-cleanup').waitFor();await page.locator('.ar-cleanup').getByRole('heading',{name:'보관할 손패 1장',exact:true}).waitFor();assert.equal(await page.locator('.ar-cleanup').getByRole('button',{name:cardLabel.replace('보관 선택','보관 해제 선택'),exact:true}).count(),1);}
    kept.add(key);
   }
   await choose(page,/^패스 확정$/);commands++;continue;
  }
  await all(page).click();
  const end=page.locator('.ar-offer-group legend').filter({hasText:/^차례 마치기$/});
  if(await end.count()){await choose(page,/^차례 마치기$/);commands++;continue;}
  if(!dug.has(key)){
   const dig=page.locator('.ar-action-browser details').filter({has:page.locator('summary').filter({hasText:/^발굴/})});
   if(await dig.count()){
    await dig.locator('summary').click();
    const target=dig.getByRole('button',{name:/해안 야영지|탐험가의 길|석판 채석장/}).first();
    if(await target.count()){
     const workers=(await page.locator('.ar-camp-heading p').innerText()).match(/탐험가 (\d)/)?.[1];
     await target.click();const payment=page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:/발굴/})});
     await payment.getByRole('button').first().click();await confirm(page);commands++;dug.add(key);digPlayers.add(pages.indexOf(page));
     assert.match(await page.locator('.ar-camp-heading p').innerText(),new RegExp(`탐험가 ${Number(workers)-1}/2`));continue;
    }
   }
   dug.add(key);
  }
  await choose(page,/^이번 라운드 패스$/);commands++;
 }
 assert.deepEqual([...rounds],[1,2,3,4,5]);assert.ok(commands>20);assert.ok(kept.size>0);assert.deepEqual([...digPlayers].sort(),[0,1],'Both desktop and mobile must perform a real dig.');
 for(const peer of pages){await peer.getByRole('region',{name:'탐험 결과',exact:true}).waitFor();assert.equal(await peer.locator('.ar-result-cards article').count(),2);await peer.locator('.ar-score-details summary').click();assert.equal(await peer.locator('.ar-score-scroll tbody tr').count(),7);}
 assert.equal(await host.locator('.ar-results h2').innerText(),await guest.locator('.ar-results h2').innerText());
 assert.deepEqual(await host.locator('.ar-score-scroll tfoot td').allTextContents(),await guest.locator('.ar-score-scroll tfoot td').allTextContents());
 assert.equal(await guest.getByRole('button',{name:'새로운 탐험 준비 →',exact:true}).count(),0);
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth),390);
 await host.screenshot({path:join(output,'desktop-results.png'),fullPage:true});await guest.screenshot({path:join(output,'mobile-results.png'),fullPage:true});
 await host.getByRole('button',{name:'새로운 탐험 준비 →',exact:true}).click();
 for(const peer of pages)await peer.locator('.ar-lobby').waitFor();
 await host.getByRole('button',{name:'탐험 시작 →',exact:true}).click();
 for(const peer of pages){await peer.locator('.ar-hand').waitFor();assert.equal(await peer.locator('.ar-roundbar li.current').innerText(),'I');assert.equal(await peer.locator('.ar-hand .ar-card').count(),5);assert.equal(await history(peer).innerText(),'탐험 기록 · 0건');}
 // The first player always starts with two coins. Spend exactly one funding and
 // one exploration card, leaving three cards for two foot payments regardless of shuffle.
 const researcher=await active(),other=pages.find(peer=>peer!==researcher);
 const resource=async key=>Number(await researcher.locator(`.ar-camp-heading .${key} b`).innerText());
 for(const name of [/^자금 지원,/,/^탐험,/]){
  await researcher.locator('.ar-hand').getByRole('button',{name}).first().click();await confirm(researcher);
 }
 async function digAt(name){
  await researcher.locator('.ar-sites.level-0').getByRole('button',{name:new RegExp(name)}).click();
  const payment=researcher.locator('.ar-offer-group').filter({has:researcher.locator('legend').filter({hasText:/발굴/})});
  // A hand card pays travel; retain all coins for the later purchase.
  await payment.getByRole('button').filter({hasText:'자원 지불 없음'}).first().click();await confirm(researcher);
 }
 await digAt('고대 제단');assert.equal(await resource('arrow'),1);
 await choose(researcher,/^차례 마치기$/);assert.equal(await active(),other);
 await choose(other,/^이번 라운드 패스$/);await choose(other,/^패스 확정$/);
 assert.equal(await active(),researcher);
 const researchCoin=await resource('coin'),researchCompass=await resource('compass');
 await researcher.getByRole('button',{name:/^연구 1L ·/}).click();
 const preview=researcher.getByRole('region',{name:'연구 칸 안내'});
 assert.match(await preview.innerText(),/나침반 1.*화살촉 1/s);
 assert.match(await preview.innerText(),/돋보기 보상/);
 const researchOffer=researcher.locator('.ar-offer-group').filter({has:researcher.locator('legend').filter({hasText:/^돋보기 연구 → 1$/})});
 await researchOffer.getByRole('button').click();await confirm(researcher);
 assert.equal(await resource('arrow'),0);assert.equal(await resource('compass'),researchCompass-1);assert.equal(await resource('coin'),researchCoin+1);
 const tokenTitle=names[pages.indexOf(researcher)]+' 돋보기';
 for(const peer of pages)assert.equal(await peer.getByRole('button',{name:/^연구 1L ·/}).getByTitle(tokenTitle,{exact:true}).count(),1);
 await researcher.reload();await researcher.locator('.ar-hand').waitFor();
 assert.equal(await researcher.getByRole('button',{name:/^연구 1L ·/}).getByTitle(tokenTitle,{exact:true}).count(),1);
 await choose(researcher,/^차례 마치기$/);await digAt('해안 야영지');await choose(researcher,/^차례 마치기$/);
 assert.ok(await resource('coin')>=6,'The scenario earns enough for every base-game item.');
 const item=researcher.locator('.ar-market .ar-card.item.available').first();assert.ok(await item.count());
 const itemName=await item.locator('.ar-card-title strong').innerText(),price=Number((await item.locator('.ar-card-foot span').innerText()).replace('◉','').trim());
 const coinsBefore=await resource('coin'),handBefore=await researcher.locator('.ar-hand .ar-card').count();
 const deckBefore=Number((await researcher.locator('.ar-camp-heading p').innerText()).match(/덱 (\d+)장/)[1]);
 const marketBefore=await researcher.locator('.ar-market .ar-card').count();
 await item.click();await researcher.locator('.ar-offer-group').filter({hasText:itemName+' 획득'}).getByRole('button').click();await confirm(researcher);
 assert.equal(await resource('coin'),coinsBefore-price);
 assert.equal(await researcher.locator('.ar-hand .ar-card').count(),handBefore,'An item enters the deck, not the hand.');
 assert.match(await researcher.locator('.ar-camp-heading p').innerText(),new RegExp(`덱 ${deckBefore+1}장`));
 for(const peer of pages){assert.equal(await peer.locator('.ar-market .ar-card').count(),marketBefore-1);assert.equal(await peer.locator('.ar-market .ar-card-title strong').filter({hasText:new RegExp('^'+itemName+'$')}).count(),0);}
 await researcher.reload();await researcher.locator('.ar-hand').waitFor();
 assert.equal(await resource('coin'),coinsBefore-price);
 assert.match(await researcher.locator('.ar-camp-heading p').innerText(),new RegExp(`덱 ${deckBefore+1}장`));
 await choose(researcher,/^차례 마치기$/);
 for(const peer of pages)assert.equal(await peer.locator('.ar-market .ar-card').count(),marketBefore);
 await host.screenshot({path:join(output,'desktop-research-purchase.png'),fullPage:true});
 await guest.screenshot({path:join(output,'mobile-research-purchase.png'),fullPage:true});
 t.diagnostic('Verified research cost, reward, token on both screens, reload, item cost, deck placement and market refill through UI.');
 // Round two uses the other player's untouched starter deck. Gather compasses,
 // discover through the map, and resolve whichever public reward choices are drawn.
 await choose(researcher,/^이번 라운드 패스$/);await choose(researcher,/^패스 확정$/);
 assert.equal(await active(),other);assert.equal(await other.locator('.ar-roundbar li.current').innerText(),'II');
 await other.locator('.ar-hand').getByRole('button',{name:/^탐험,/}).first().click();await confirm(other);
 await other.locator('.ar-sites.level-0').getByRole('button',{name:/탐험가의 길/}).click();
 await other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:/발굴/})}).getByRole('button').filter({hasText:'자원 지불 없음'}).first().click();await confirm(other);
 await choose(other,/^차례 마치기$/);
 await choose(researcher,/^이번 라운드 패스$/);await choose(researcher,/^패스 확정$/);
 assert.equal(await active(),other);
 const discovery=other.locator('.ar-sites.level-1 .hidden-site.available').first();assert.ok(await discovery.count(),'A level-one discovery must be affordable.');
 await discovery.click();
 assert.match(await other.locator('.ar-card-inspector').innerText(),/발견 비용: 나침반 3 · 우상 1개/);
 await other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:/1단계 유적 발견/})}).getByRole('button').first().click();
 assert.match(await other.locator('.ar-confirm > p').first().innerText(),/나침반 3/);await confirm(other);
 assert.equal(await other.locator('.ar-idol-slots > button').innerText(),'𓅓 우상 1');
 assert.match(await other.locator('.ar-camp-heading p').innerText(),/탐험가 0\/2/);
 let choices=0;
 for(;choices<12;choices++){
  await all(other).click();
  if(await other.locator('.ar-offer-group legend').filter({hasText:/^차례 마치기$/}).count())break;
  assert.equal(await other.locator('.ar-action-help').innerText(),'추가 효과를 처리하세요.');
  const pendingLabel=await other.locator('.ar-roundbar small').innerText();
  await other.reload();await other.locator('.ar-hand').waitFor();
  assert.equal(await other.locator('.ar-roundbar small').innerText(),pendingLabel,'Pending reward survives reload.');
  await other.locator('.ar-offer-group button').first().click();await confirm(other);
 }
 assert.ok(choices<12,'Discovery rewards must settle within the bounded choice loop.');
 const revealed=peer=>peer.locator('.ar-sites.level-1 .ar-site.revealed');
 const siteName=await revealed(other).locator('strong').innerText();
 const guardianName=await revealed(other).locator('.ar-site-guardian').getAttribute('title');assert.ok(guardianName);
 let guardianDetails;
 for(const peer of pages){
  assert.equal(await revealed(peer).count(),1);assert.equal(await revealed(peer).locator('strong').innerText(),siteName);
  assert.equal(await revealed(peer).locator('.ar-site-guardian').getAttribute('title'),guardianName);
  assert.equal(await revealed(peer).locator('.ar-worker-slots .ar-pawn').count(),1);
  await revealed(peer).click();
  const inspector=peer.locator('.ar-card-inspector');assert.ok((await inspector.innerText()).includes(guardianName+' · 5점'));
  const details=await inspector.innerText();assert.match(details,/극복 비용:/);
  if(guardianDetails===undefined)guardianDetails=details;else assert.equal(details,guardianDetails);
 }
 await other.reload();await other.locator('.ar-hand').waitFor();
 assert.equal(await revealed(other).locator('.ar-site-guardian').getAttribute('title'),guardianName);
 // No card acquisition/exile occurs between these readings: the unopposed guardian
 // adds exactly one fear card at round end, visible in total owned card counts.
 async function cardTotal(peer){
  const camp=await peer.locator('.ar-camp-heading p').innerText();
  return Number(camp.match(/덱 (\d+)장/)[1])+Number(camp.match(/사용한 카드 (\d+)장/)[1])+await peer.locator('.ar-hand .ar-card').count();
 }
 const cardsBeforeFear=await cardTotal(other);
 for(const peer of pages)await revealed(peer).click();
 await host.screenshot({path:join(output,'desktop-discovery.png'),fullPage:true});
 await guest.screenshot({path:join(output,'mobile-discovery.png'),fullPage:true});
 await choose(other,/^차례 마치기$/);await choose(other,/^이번 라운드 패스$/);await choose(other,/^패스 확정$/);
 for(const peer of pages){
  assert.equal(await peer.locator('.ar-roundbar li.current').innerText(),'III');
  assert.equal(await revealed(peer).locator('.ar-site-guardian').getAttribute('title'),guardianName);
  assert.equal(await revealed(peer).locator('.ar-worker-slots .ar-pawn').count(),0);
 }
 assert.equal(await cardTotal(other),cardsBeforeFear+1,'Leaving a guardian adds one fear card at round end.');
 assert.match(await other.locator('.ar-camp-heading p').innerText(),/탐험가 2\/2/);
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth),390);
 t.diagnostic(`Verified discovery, idol, ${choices} pending choices, guardian preview/resume, worker recall and round-end fear.`);
 // Continue with public costs and UI actions only: prepare, revisit and overcome.
 const resourceNames={coin:'금화',compass:'나침반',tablet:'석판',arrow:'화살촉',jewel:'보석'};
 const readResources=async()=>Object.fromEntries(await Promise.all(Object.keys(resourceNames).map(async key=>[key,Number(await other.locator(`.ar-camp-heading .${key} b`).innerText())])));
 const parseCost=text=>Object.fromEntries(Object.entries(resourceNames).map(([key,name])=>[key,Number(text.match(new RegExp(name+' (\\d+)'))?.[1]??0)]));
 async function settleEffects(){
  for(let step=0;step<16;step++){
   await all(other).click();
   if(await other.locator('.ar-offer-group legend').filter({hasText:/^차례 마치기$/}).count())return;
   assert.equal(await other.locator('.ar-action-help').innerText(),'추가 효과를 처리하세요.');
   const skip=other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:/이 효과 건너뛰기|획득하지 않기|구매하지 않기|두 번째 배치 생략/})});
   await (await skip.count()?skip.first().getByRole('button'):other.locator('.ar-offer-group button').first()).click();await confirm(other);
  }
  assert.fail('Follow-up effects did not settle.');
 }
 async function finishTurn(){
  await choose(other,/^차례 마치기$/);
  if(await active()===researcher){await choose(researcher,/^이번 라운드 패스$/);await choose(researcher,/^패스 확정$/);}
 }
 async function playStarters(name){
  for(let i=0;i<2;i++){
   const card=other.locator('.ar-hand').getByRole('button',{name}).first();if(!await card.count())break;
   await card.click();await confirm(other);
  }
 }
 async function payDig(target){
  await target.click();
  const buttons=other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:/발굴/})}).getByRole('button');
  const options=await buttons.allTextContents();assert.ok(options.length,'Expected an affordable dig.');
  // Prefer a free foot payment with fear, keeping useful transport cards for the ruin.
  const ranked=options.map((text,index)=>({index,rank:parseCost(text).coin*100+(text.includes('공포')?0:10)})).sort((a,b)=>a.rank-b.rank);
  await buttons.nth(ranked[0].index).click();await confirm(other);await settleEffects();await finishTurn();
 }
 await choose(researcher,/^이번 라운드 패스$/);await choose(researcher,/^패스 확정$/);
 assert.equal(await active(),other);
 await playStarters(/^자금 지원,/);
 const required=parseCost(guardianDetails.split('극복 비용:')[1]);
 let stock=await readResources();
 if(stock.compass<required.compass)await playStarters(/^탐험,/);
 stock=await readResources();
 const idolLabel=stock.jewel<required.jewel?/금화 1 → 보석 1/:stock.arrow<required.arrow?/화살촉 1/:stock.tablet<required.tablet?/석판 2/:/금화 1.*나침반 1/;
 await other.locator('.ar-idol-slots > button').click();
 await other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:idolLabel})}).getByRole('button').click();await confirm(other);
 stock=await readResources();
 await payDig(other.locator('.ar-sites.level-0').getByRole('button',{name:stock.tablet<required.tablet?/석판 채석장/:/해안 야영지/}));
 await payDig(revealed(other));
 await revealed(other).click();
 const overcome=other.locator('.ar-offer-group').filter({has:other.locator('legend').filter({hasText:/극복/})});
 assert.ok(await overcome.count(),`Prepared resources must cover ${guardianName}: ${JSON.stringify(await readResources())}`);
 await overcome.first().getByRole('button').first().click();
 const paid=parseCost(await other.locator('.ar-confirm > p').first().innerText()),beforeOvercome=await readResources();
 const paymentCards=await other.locator('.ar-hand .payment').count(),handBeforeOvercome=await other.locator('.ar-hand .ar-card').count();
 await confirm(other);
 const afterOvercome=await readResources();
 for(const key of Object.keys(resourceNames))assert.equal(afterOvercome[key],beforeOvercome[key]-paid[key]);
 assert.equal(await other.locator('.ar-hand .ar-card').count(),handBeforeOvercome-paymentCards);
 for(const peer of pages)assert.equal(await revealed(peer).locator('.ar-site-guardian').count(),0);
 const ownedGuardian=()=>other.locator('.ar-assistants[aria-label="내 조수와 수호자"]').getByRole('button').filter({hasText:guardianName});
 assert.match(await ownedGuardian().innerText(),/축복 사용 가능.*5 VP/);await assertCampControlContrast(ownedGuardian());
 await other.reload();await other.locator('.ar-hand').waitFor();assert.match(await ownedGuardian().innerText(),/축복 사용 가능.*5 VP/);
 const boonText=await ownedGuardian().locator('.ar-ability-effect').innerText();assert.ok(boonText.trim());
 await ownedGuardian().click();assert.equal(await ownedGuardian().getAttribute('aria-pressed'),'true');
 assert.ok((await other.locator('.ar-card-inspector').innerText()).includes(boonText));await confirm(other);await settleEffects();assert.match(await ownedGuardian().innerText(),/축복 사용 완료.*5 VP/);await assertCampControlContrast(ownedGuardian());
 const beforeSafeReturn=await cardTotal(other);
 await finishTurn();await choose(other,/^이번 라운드 패스$/);await choose(other,/^패스 확정$/);
 assert.equal(await other.locator('.ar-roundbar li.current').innerText(),'IV');
 assert.equal(await cardTotal(other),beforeSafeReturn,'An overcome guardian causes no round-end fear.');
 // Accumulate compasses over at most two rounds, then buy a real market artifact.
 let artifactName;
 for(let attempt=0;attempt<2&&!artifactName;attempt++){
  if(await active()===researcher){await choose(researcher,/^이번 라운드 패스$/);await choose(researcher,/^패스 확정$/);}
  await playStarters(/^탐험,/);
  await payDig(other.locator('.ar-sites.level-0').getByRole('button',{name:/탐험가의 길/}));
  const artifact=other.locator('.ar-market .ar-card.artifact.available').first();
  if(!await artifact.count()){await choose(other,/^이번 라운드 패스$/);await choose(other,/^패스 확정$/);continue;}
  artifactName=await artifact.locator('.ar-card-title strong').innerText();
  const artifactPrice=Number((await artifact.locator('.ar-card-foot span').innerText()).replace('✥','').trim());
  const printedText=(await artifact.locator('.ar-card-effect').innerText()).replace(/^ϟ\s*/,'');
  const printedEffects=printedText.split(/ · | → /);
  const simpleEffects=printedEffects.every(effect=>/^(금화|나침반|석판|화살촉|보석) \d+$|^카드 \d+장 뽑기$|^공포 1장 받기$/.test(effect));
  const beforeArtifact=await readResources(),cardsBeforeArtifact=await cardTotal(other);
  await artifact.click();await other.locator('.ar-offer-group').filter({hasText:artifactName+' 획득'}).getByRole('button').click();
  assert.equal(parseCost(await other.locator('.ar-confirm > p').first().innerText()).compass,artifactPrice);
  await confirm(other);
  assert.equal(await other.locator('.ar-played button').filter({hasText:artifactName}).count(),1,'Purchased artifact is immediately played.');
  if(simpleEffects){
   // A fear cost followed by an arrow needs an explicit choice before its rewards apply.
   if(printedText.includes(' → ')){
    assert.ok(printedText.startsWith('공포 1장 받기 → '));
    assert.deepEqual(await readResources(),{...beforeArtifact,compass:beforeArtifact.compass-artifactPrice});
    assert.equal(await cardTotal(other),cardsBeforeArtifact+1);
    await choose(other,/공포 받고 효과 적용$/);
   }
   const afterArtifact=await readResources();
   for(const key of Object.keys(resourceNames)){
    const gained=printedEffects.reduce((sum,effect)=>sum+parseCost(effect)[key],0);
    assert.equal(afterArtifact[key],beforeArtifact[key]-(key==='compass'?artifactPrice:0)+gained,`Immediate ${key} effect of ${artifactName}`);
   }
   assert.equal(await cardTotal(other),cardsBeforeArtifact+1+printedEffects.filter(effect=>effect==='공포 1장 받기').length);
   t.diagnostic(`Checked printed resource/card effects of ${artifactName}.`);
  }
  for(const peer of pages)assert.equal(await peer.locator('.ar-market .ar-card-title strong').filter({hasText:new RegExp('^'+artifactName+'$')}).count(),0);
  await other.reload();await other.locator('.ar-hand').waitFor();
  assert.equal(await other.locator('.ar-played button').filter({hasText:artifactName}).count(),1);
  await settleEffects();await finishTurn();
  for(const peer of pages)assert.equal(await peer.locator('.ar-market .ar-card').count(),6);
 }
 assert.ok(artifactName,'Must purchase an artifact before the game ends.');
 await host.screenshot({path:join(output,'desktop-guardian-artifact.png'),fullPage:true});
 await guest.screenshot({path:join(output,'mobile-guardian-artifact.png'),fullPage:true});
 t.diagnostic(`Verified ${guardianName} overcome, exact payment, boon and no fear; purchased and resolved ${artifactName}.`);
 assert.deepEqual(errors,[]);complete=true;t.diagnostic(`Completed five rounds using ${commands} UI-confirmed actions.`);
});

for(const playerCount of [3,4]){
 test(`Arnak ${playerCount} players: seat order, digs, round rotation, resume and scores`,{timeout:180000},async t=>{
  const url=process.env.ARNAK_BROWSER_URL;
  assert.ok(url,'Set ARNAK_BROWSER_URL to a disposable local server.');
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,...(process.env.ARNAK_CHROME_PATH?{executablePath:process.env.ARNAK_CHROME_PATH}:{})});
  const output=await mkdtemp(join(tmpdir(),`arnak-${playerCount}p-`)),pages=[],errors=[];
  let complete=false;
  t.after(async()=>{
   try {if(!complete)for(const [index,page] of pages.entries())if(!page.isClosed()){
    t.diagnostic((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:join(output,`failure-${index}.png`),fullPage:true});
   }}finally{await browser.close();t.diagnostic(`Screenshots: ${output}`);}
  });
  const names=Array.from({length:playerCount},(_,i)=>`탐험대${i+1}`);
  for(let index=0;index<playerCount;index++){
   const context=await browser.newContext({viewport:index===playerCount-1?{width:390,height:844}:{width:1440,height:1000},reducedMotion:'reduce'});
   const page=await context.newPage();pages.push(page);page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
   await page.goto(url);await page.getByLabel('닉네임',{exact:true}).fill(names[index]);
   if(index===0){
    await page.locator('.game-option').filter({hasText:'아르낙'}).click();await page.getByRole('button',{name:'선택한 게임으로 방 만들기',exact:true}).click();
   }else{
    const code=(await pages[0].getByRole('button',{name:/초대 ·/}).innerText()).split(' · ')[1];assert.ok(code);
    await page.locator('#room-code').fill(code);await page.getByRole('button',{name:'방 참가하기',exact:true}).click();
   }
   await page.locator('.ar-lobby').waitFor();
  }
  const host=pages[0];await host.getByRole('button',{name:'탐험 시작 →',exact:true}).click();
  for(const page of pages){await page.locator('.ar-hand').waitFor();assert.equal(await page.locator('.ar-hand .ar-card').count(),5);assert.equal(await page.locator('.ar-opponents > details').count(),playerCount-1);}
  assert.equal(await host.locator('.ar-sites.level-0 .ar-worker-slots .blocked').count(),playerCount===3?3:0);
  const active=async()=>{
   const label=await host.locator('.ar-roundbar b').innerText();const index=names.findIndex(name=>label===name+'의 차례');assert.ok(index>=0,label);return index;
  };
  const initial=await active();let commands=0;
  async function confirm(page){
   const before=await page.locator('.ar-log summary').innerText();
   await page.locator('.ar-confirm').getByRole('button',{name:'선택 확정 →',exact:true}).click();
   for(const peer of pages)await peer.waitForFunction(before=>document.querySelector('.ar-log summary')?.textContent!==before,before);
   assert.equal(await page.locator('#ar-actions [role="alert"]').count(),0);commands++;
  }
  async function choose(page,label){
   await page.locator('#ar-actions').getByRole('button',{name:'전체',exact:true}).click();
   const group=page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:label})});assert.equal(await group.count(),1);
   await group.getByRole('button').first().click();await confirm(page);
  }
  const sites=['해안 야영지','탐험가의 길','석판 채석장','고대 제단'];
  for(let round=1;round<=5;round++){
   const first=(initial+round-1)%playerCount;
   assert.equal(await active(),first,'Starting player rotates one seat each round.');
   for(let offset=0;offset<playerCount;offset++){
    const index=(first+offset)%playerCount,page=pages[index];assert.equal(await active(),index);
    for(const peer of pages){assert.equal(await peer.locator('.ar-roundbar li.current').innerText(),['I','II','III','IV','V'][round-1]);if(peer!==page)assert.equal(await peer.locator('.ar-action-browser').count(),0);}
    if(round===1){
     const coinBefore=Number(await page.locator('.ar-camp-heading .coin b').innerText());
     await page.locator('.ar-hand').getByRole('button',{name:/^자금 지원,/}).first().click();await confirm(page);
     assert.equal(Number(await page.locator('.ar-camp-heading .coin b').innerText()),coinBefore+1);
    }
    const researchTurn=index===playerCount-1&&(round===2||round===3);
    if(researchTurn){await page.locator('.ar-hand').getByRole('button',{name:/^탐험,/}).first().click();await confirm(page);}
    await page.locator('.ar-sites.level-0').getByRole('button',{name:new RegExp(researchTurn?'고대 제단':sites[index])}).click();
    await page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:/발굴/})}).getByRole('button').filter({hasText:'자원 지불 없음'}).first().click();await confirm(page);
    assert.match(await page.locator('.ar-camp-heading p').innerText(),/탐험가 1\/2/);
    await choose(page,/^차례 마치기$/);assert.equal(await active(),(index+1)%playerCount);
    if(round===2&&offset===0){
     const hand=await page.locator('.ar-hand .ar-card').allTextContents(),camp=await page.locator('.ar-camp-heading').innerText();
     await page.reload();await page.locator('.ar-hand').waitFor();
     assert.deepEqual(await page.locator('.ar-hand .ar-card').allTextContents(),hand);assert.equal(await page.locator('.ar-camp-heading').innerText(),camp);
     assert.equal(await active(),(index+1)%playerCount,'Rejoining does not steal the active turn.');
    }
   }
   for(let offset=0;offset<playerCount;offset++){
    const index=(first+offset)%playerCount,page=pages[index];assert.equal(await active(),index);
    if(index===playerCount-1&&(round===2||round===3)){
     const compass=Number(await page.locator('.ar-camp-heading .compass b').innerText()),arrow=Number(await page.locator('.ar-camp-heading .arrow b').innerText());
     await page.getByRole('button',{name:/^연구 1L ·/}).click();
     const token=round===2?'돋보기':'수첩';
     const offer=page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:new RegExp('^'+token+' 연구 → 1$')})});
     await offer.getByRole('button').click();await confirm(page);
     assert.equal(Number(await page.locator('.ar-camp-heading .compass b').innerText()),compass-1);
     assert.equal(Number(await page.locator('.ar-camp-heading .arrow b').innerText()),arrow-1);
     for(const peer of pages)assert.equal(await peer.getByRole('button',{name:/^연구 1L ·/}).getByTitle(names[index]+' '+token,{exact:true}).count(),1);
     if(round===3){
      await page.locator('#ar-actions').getByRole('button',{name:'전체',exact:true}).click();
      const hiring=()=>page.locator('.ar-offer-group').filter({has:page.locator('legend').filter({hasText:/고용$/})});
      const choices=await hiring().locator('legend').allTextContents();assert.equal(choices.length,3);
      assert.equal(await hiring().locator('.ar-offer-assistant').count(),3);
      await hiring().first().screenshot({path:join(output,'mobile-hiring-choice.png')});
      const historyBeforePreview=await page.locator('.ar-log summary').innerText();
      await page.locator('.ar-supply summary').click();
      const supply=page.locator('.ar-assistant-market button');assert.equal(await supply.count(),3);
      for(let choice=0;choice<3;choice++){
       const card=supply.nth(choice),silverText=await card.locator('.ar-silver-effect').innerText(),goldText=await card.locator('.ar-gold-effect').innerText();
       await page.locator('#ar-actions').getByRole('button',{name:'전체',exact:true}).click();
       const preview=hiring().filter({hasText:(await card.locator('strong').innerText())+' 고용'}).locator('.ar-offer-assistant');
       assert.equal(await preview.locator('.ar-silver-effect').innerText(),silverText);
       assert.equal(await preview.locator('.ar-gold-effect').innerText(),goldText);
       assert.equal(await preview.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
       assert.ok(silverText.trim());assert.ok(goldText.trim());await assertCampControlContrast(card);
       assert.equal(await card.evaluate(button=>button.scrollWidth<=button.clientWidth),true);
       await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');
       const details=page.locator('.ar-card-inspector');
       assert.equal(await details.locator('h4').filter({hasText:'은색 능력'}).locator('xpath=following-sibling::p[1]').innerText(),silverText);
       assert.equal(await details.locator('h4').filter({hasText:'금색 능력'}).locator('xpath=following-sibling::p[1]').innerText(),goldText);
      }
      assert.equal(await page.locator('.ar-log summary').innerText(),historyBeforePreview,'Comparing candidates must not hire or spend an action.');
      await supply.first().screenshot({path:join(output,'mobile-assistant-comparison.png')});
      await page.locator('#ar-actions').getByRole('button',{name:'전체',exact:true}).click();
      assert.deepEqual(await hiring().locator('legend').allTextContents(),choices);

      assert.equal(await page.locator('.ar-offer-group legend').filter({hasText:/^차례 마치기$/}).count(),0,'Hiring must resolve before ending the turn.');
      await page.reload();await page.locator('.ar-hand').waitFor();
      assert.deepEqual(await hiring().locator('legend').allTextContents(),choices,'Same public hiring choices survive reload.');
      const assistant=choices[0].replace(/^ϟ\s*/,'').replace(/ 고용$/,'');
      await hiring().first().getByRole('button').click();await confirm(page);
      const owned=()=>page.locator('.ar-assistants[aria-label="내 조수와 수호자"] button').filter({hasText:assistant});
      assert.equal(await owned().count(),1);assert.match(await owned().innerText(),/☆.*사용 가능/s);await assertCampControlContrast(owned());
      for(const peer of pages){
       assert.equal(await peer.locator('.ar-supply button').filter({hasText:assistant}).count(),0);
       if(peer!==page){
        const opponent=peer.locator('.ar-opponents > details').filter({has:peer.locator('summary > b').filter({hasText:names[index]})});
        await opponent.locator('summary').first().click();
        assert.equal(await opponent.locator('.ar-public-ability strong').filter({hasText:assistant}).count(),1);
       }
      }
      const abilityText=await owned().locator('.ar-ability-effect').innerText();assert.ok(abilityText.trim());
      assert.match(await owned().innerText(),/자유 행동|주 행동/);
      await owned().click();assert.equal(await owned().getAttribute('aria-pressed'),'true');
      const silver=page.locator('.ar-card-inspector h4').filter({hasText:'은색 능력'});assert.equal(await silver.locator('xpath=following-sibling::p[1]').innerText(),abilityText);
      await page.reload();await page.locator('.ar-hand').waitFor();assert.equal(await owned().count(),1);
      assert.equal(await owned().locator('.ar-ability-effect').innerText(),abilityText);
      assert.equal(await owned().evaluate(button=>button.scrollWidth<=button.clientWidth),true,'Ability text fits the mobile card.');
      await page.locator('.ar-owned-abilities').screenshot({path:join(output,'mobile-abilities.png')});
      await page.screenshot({path:join(output,'mobile-hired-assistant.png'),fullPage:true});
     }
     await choose(page,/^차례 마치기$/);
     continue;
    }
    await choose(page,/^이번 라운드 패스$/);assert.equal(await active(),index,'Cleanup belongs to the passing player until confirmed.');
    await page.getByRole('region',{name:'라운드 정리 손패',exact:true}).waitFor();await choose(page,/^패스 확정$/);
    if(offset<playerCount-1)assert.equal(await active(),(index+1)%playerCount);
   }
   if(round===2||round===3){
    const page=pages[playerCount-1];assert.equal(await active(),playerCount-1);
    await choose(page,/^이번 라운드 패스$/);await choose(page,/^패스 확정$/);
   }
  }
  let expectedScores,expectedWinner;
  for(const [index,page] of pages.entries()){
   await page.getByRole('region',{name:'탐험 결과',exact:true}).waitFor();assert.equal(await page.locator('.ar-result-cards article').count(),playerCount);
   await page.locator('.ar-score-details summary').click();assert.equal(await page.locator('.ar-score-scroll tbody tr').count(),7);
   const scores=await page.locator('.ar-score-scroll tfoot td').allTextContents(),winner=await page.locator('.ar-results h2').innerText();
   assert.equal(scores.length,playerCount);
   assert.equal(winner,names.at(-1)+'의 승리','Research breaks the otherwise equal starting-deck scores.');
   if(index===0){expectedScores=scores;expectedWinner=winner;}else{assert.deepEqual(scores,expectedScores);assert.equal(winner,expectedWinner);assert.equal(await page.getByRole('button',{name:'새로운 탐험 준비 →',exact:true}).count(),0);}
  }
  assert.equal(await pages.at(-1).evaluate(()=>document.documentElement.scrollWidth),390);
  await host.screenshot({path:join(output,'desktop-results.png'),fullPage:true});await pages.at(-1).screenshot({path:join(output,'mobile-results.png'),fullPage:true});
  assert.equal(commands,playerCount*21+7);assert.deepEqual(errors,[]);complete=true;t.diagnostic(`${playerCount} players completed five rounds with ${commands} UI-confirmed actions.`);
 });
}
