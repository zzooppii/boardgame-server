import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'valibot';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainPlayingProjectionSchema, TRAIN_ROUTES, TRAIN_RULES_VERSION, type TrainProjection } from '@hangul-rummikub/shared';
import { trainClaimBlockReason, trainPayments, trainRouteOpen, trainCanDraw } from '../features/train/ui.js';
import { TrainBoard, trainRouteGeometry } from '../features/train/TrainBoard.js';
function game(n = 2): TrainProjection {
    return parse(TrainPlayingProjectionSchema, { gameType: 'TRAIN', rulesVersion: TRAIN_RULES_VERSION, gameId: 'g', gameRevision: 1, startingPlayerId: 'p0', round: 1, finalTurnsRemaining: null, finalTriggerPlayerId: null, market: [], deckCount: 105, discardCount: 0, ticketDeckCount: 30, claims: [], playerStates: Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, trains: 45, routePoints: 0, handCount: i === 0 ? 5 : 0, ticketCount: 0, pendingTicketCount: 0 })), privateState: { playerId: 'p0', hand: [{ cardId: 'r1', color: 'RED' }, { cardId: 'r2', color: 'RED' }, { cardId: 'b1', color: 'BLUE' }, { cardId: 'w1', color: 'LOCOMOTIVE' }, { cardId: 'w2', color: 'LOCOMOTIVE' }], tickets: [], pendingTickets: [], minimumKeep: 0 }, feedback: null, phase: 'PLAYING', deadlineAt: 91_000, turnId: 't', activePlayerId: 'p0', step: 'TURN' });
}
test('TRAIN payment UI offers distinct valid combinations, conserving wildcards first', () => {
    const g = game(), r = TRAIN_ROUTES.find(r => r.color === 'GRAY' && r.length === 2)!;
    const options = trainPayments(g, r);
    assert.deepEqual(options.map(p => [p.color, p.ordinary, p.wild]), [['RED', 2, 0], ['RED', 1, 1], ['BLUE', 1, 1], ['LOCOMOTIVE', 0, 2]]);
    for (const p of options) {
        assert.equal(new Set(p.cardIds).size, 2);
        assert.ok(p.cardIds.every(id => g.privateState.hand.some(c => c.cardId === id)));
    }
    const colored = TRAIN_ROUTES.find(r => r.color === 'BLUE' && r.length === 2)!;
    assert.deepEqual(trainPayments(g, colored).map(p => p.color), ['BLUE', 'LOCOMOTIVE']);
});
test('TRAIN UI excludes claimed/blocked doubles and respects second-draw/actor constraints', () => {
    const pair = TRAIN_ROUTES.filter(r => r.group === 'seattle--vancouver');
    for (const n of [2, 3, 4, 5]) {
        const g = game(n);
        g.claims.push({ routeId: pair[0]!.routeId, playerId: g.playerStates[1]!.playerId });
        assert.equal(trainRouteOpen(g, pair[1]!, 'p0'), n >= 4);
        assert.equal(trainRouteOpen(g, pair[0]!, 'p0'), false);
        assert.equal(trainRouteOpen(g, pair[1]!, 'p1'), false);
    }
    const g = game();
    assert.ok(g.phase === 'PLAYING');
    g.step = 'DRAW_SECOND';
    assert.equal(trainCanDraw(g, 'p0', 'LOCOMOTIVE'), false);
    assert.equal(trainCanDraw(g, 'p0', 'DECK'), true);
    assert.equal(trainCanDraw(g, 'p1', 'DECK'), false);
    g.step = 'CHOOSE_TICKETS';
    assert.equal(trainCanDraw(g, 'p0', 'DECK'), false);
});
test('TRAIN map renders all 100 accessible route controls and finite geometry for 309 pieces', () => {
    let count = 0;
    for (const r of TRAIN_ROUTES) {
        const geometry = trainRouteGeometry(r);
        assert.equal(geometry.segments.length, r.length);
        for (const p of geometry.segments) {
            assert.ok([p.x, p.y, p.angle, p.width].every(Number.isFinite));
            assert.ok(p.width > 0);
        }
        count += geometry.segments.length;
    }
    assert.equal(count, 309);
    const html = renderToStaticMarkup(createElement(TrainBoard, { game: game(), selected: null, onSelect() { }, names: { p0: '나', p1: '친구' } }));
    assert.equal((html.match(/role="button"/g) ?? []).length, 100);
    assert.ok(html.includes('지도 확대'));
    assert.ok(html.includes('밴쿠버'));
    assert.ok(html.includes('마이애미'));
});

test('TRAIN sound cues do not replay snapshots and unavailable audio fails gracefully', async () => {
    const { trainTransitionCues, TrainAudio } = await import('../features/train/sound.js');
    const before = game(), after = structuredClone(before);
    assert.ok(after.phase === 'PLAYING');
    after.gameRevision = parse(TrainPlayingProjectionSchema, { ...after, gameRevision: 2 }).gameRevision;
    after.feedback = parse(TrainPlayingProjectionSchema, { ...after, feedback: { playerId: 'p0', kind: 'CLAIM_ROUTE', routeId: TRAIN_ROUTES[0]!.routeId, at: 1000 } }).feedback;
    assert.deepEqual(trainTransitionCues(null, after, 'p0'), []);
    assert.deepEqual(trainTransitionCues(after, after, 'p0'), []);
    assert.deepEqual(trainTransitionCues(before, after, 'p0'), ['CLAIM_ROUTE']);
    const audio = new TrainAudio(() => null);
    assert.doesNotThrow(() => { audio.unlock(); audio.setVolume(0); audio.play(['CLAIM_ROUTE']); audio.dispose(); });
});

test('TRAIN explains insufficient pieces independently of enough cards and still permits drawing',()=>{
    const g=game(), route=TRAIN_ROUTES.find(r=>r.group==='montreal--toronto')!;
    g.playerStates[0]!.trains=1;
    assert.match(trainClaimBlockReason(g,route)!,/남은 기차 말이 1개.*3개/);
    assert.equal(trainCanDraw(g,'p0','DECK'),true);
    g.playerStates[0]!.trains=4;
    assert.equal(trainClaimBlockReason(g,route),null);
    g.privateState.hand=[];
    assert.match(trainClaimBlockReason(g,route)!,/열차 카드가 부족/);
});
test('TRAIN timer uses server time, clamps expiry and does not exceed 90 seconds',async()=>{
    const {trainSecondsLeft}=await import('../features/train/turn-timer.js');
    assert.equal(trainSecondsLeft(91_000,1000),90);
    assert.equal(trainSecondsLeft(91_000,1000,89_500),1);
    assert.equal(trainSecondsLeft(91_000,1000,90_000),0);
    assert.equal(trainSecondsLeft(91_000,91_500),0);
    assert.equal(trainSecondsLeft(null,1000),0);
});

test('TRAIN Korea board uses its own cities, routes, geography and payment catalog',()=>{
    const g=game();g.mapId='KOREA';g.rulesVersion='train-korea-original-v1';
    const html=renderToStaticMarkup(createElement(TrainBoard,{game:g,selected:null,onSelect:()=>undefined,names:{}}));
    assert.match(html,/한국 창작 지도/);assert.match(html,/서울/);assert.match(html,/부산/);assert.doesNotMatch(html,/밴쿠버|CANADA|몬트리올/);
    assert.equal(trainPayments(g,TRAIN_ROUTES[0]!).length,0);
});

test('TRAIN Korea geometry stays finite, inside map bounds, with one distinct segment per train', async()=>{
    const {getTrainMap}=await import('@hangul-rummikub/shared');const map=getTrainMap('KOREA');
    for(const route of map.routes){
        const geometry=trainRouteGeometry(route,'KOREA');
        assert.equal(geometry.segments.length,route.length);
        assert.equal(new Set(geometry.segments.map(p=>`${p.x}:${p.y}`)).size,route.length);
        for(const segment of geometry.segments){assert.ok(Number.isFinite(segment.angle));assert.ok(segment.x>0&&segment.x<1200&&segment.y>0&&segment.y<1250,route.routeId);}
    }
});


test('TRAIN map camera keeps USA and portrait Korea edges reachable without blank overscroll', async () => {
    const { clampTrainMapPan } = await import('../features/train/map-viewport.js');
    for (const bounds of [{width:1200,height:800},{width:1200,height:1250}]) {
        for (const zoom of [1,1.4,2.2,3.5]) {
            const pan=clampTrainMapPan(bounds,zoom,{x:10000,y:-10000});
            const left=(bounds.width-bounds.width/zoom)/2-pan.x;
            const bottom=(bounds.height-bounds.height/zoom)/2-pan.y+bounds.height/zoom;
            assert.ok(Math.abs(left)<1e-9);
            assert.ok(Math.abs(bottom-bounds.height)<1e-9);
            const reset=clampTrainMapPan(bounds,1,pan);
            assert.equal(Math.abs(reset.x),0);assert.equal(Math.abs(reset.y),0);
        }
    }
});


test('TRAIN Japan renders original cities and ordinary route controls with bounded geometry', async () => {
    const { getTrainMap } = await import('@hangul-rummikub/shared');
    const g=game();g.mapId='JAPAN';g.rulesVersion='train-japan-original-v1';
    const html=renderToStaticMarkup(createElement(TrainBoard,{game:g,selected:null,onSelect:()=>undefined,names:{}}));
    assert.match(html,/일본 창작 지도/);assert.match(html,/도쿄/);assert.match(html,/삿포로/);
    assert.doesNotMatch(html,/밴쿠버|서울|CANADA/);
    assert.equal((html.match(/role="button"/g)??[]).length,75);
    assert.equal(trainPayments(g,TRAIN_ROUTES[0]!).length,0);
    for(const route of getTrainMap('JAPAN').routes) {
        const geometry=trainRouteGeometry(route,'JAPAN');
        assert.equal(geometry.segments.length,route.length);
        for(const point of geometry.segments) assert.ok(Number.isFinite(point.angle)&&point.x>0&&point.x<1200&&point.y>0&&point.y<1500,route.routeId);
    }
});
