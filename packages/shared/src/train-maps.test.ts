import assert from 'node:assert/strict';
import test from 'node:test';
import { getTrainMap, TRAIN_MAP_OPTIONS, TrainSettingsSchema } from './games/train/maps.js';
import { safeParse } from 'valibot';

test('TRAIN map catalogs have isolated IDs, connected routes, valid costs and unique destinations', () => {
    const allRouteIds = new Set<string>(), allTicketIds = new Set<string>();
    for (const option of TRAIN_MAP_OPTIONS) {
        const map=getTrainMap(option.mapId), cities=map.cities.map(city=>city.cityId);
        assert.equal(new Set(cities).size,cities.length);
        for(const city of map.cities) assert.ok(city.x>0&&city.x<map.viewBox.width&&city.y>0&&city.y<map.viewBox.height);
        const distances=cities.map((_,a)=>cities.map((_,b)=>a===b?0:Infinity));
        const pairs=new Set<string>();
        for(const route of map.routes){
            assert.ok(!allRouteIds.has(route.routeId));allRouteIds.add(route.routeId);
            const a=cities.indexOf(route.a),b=cities.indexOf(route.b);
            assert.ok(a>=0&&b>=0&&a!==b);
            assert.ok(Number.isInteger(route.length)&&route.length>=1&&route.length<=6);
            assert.ok(map.routePoints[route.length]);
            distances[a]![b]=Math.min(distances[a]![b]!,route.length);distances[b]![a]=distances[a]![b]!;
            const siblings=map.routes.filter(other=>other.group===route.group);
            assert.ok(siblings.length<=2);
            for(const other of siblings){assert.equal(other.length,route.length);assert.deepEqual(new Set([other.a,other.b]),new Set([route.a,route.b]));}
        }
        // Independent all-pairs shortest paths; not the production connectivity algorithm.
        for(let k=0;k<cities.length;k++) for(let a=0;a<cities.length;a++) for(let b=0;b<cities.length;b++)
            distances[a]![b]=Math.min(distances[a]![b]!,distances[a]![k]!+distances[k]![b]!);
        assert.ok(distances.every(row=>row.every(Number.isFinite)));
        for(const ticket of map.tickets){
            assert.ok(!allTicketIds.has(ticket.ticketId));allTicketIds.add(ticket.ticketId);
            const a=cities.indexOf(ticket.a),b=cities.indexOf(ticket.b),key=[ticket.a,ticket.b].sort().join(':');
            assert.ok(a>=0&&b>=0&&a!==b);assert.ok(!pairs.has(key));pairs.add(key);
            if(map.mapId!=='USA')assert.equal(ticket.points,distances[a]![b],ticket.ticketId);
        }
        assert.ok(map.routes.reduce((sum,route)=>sum+route.length,0)>=5*43);
    }
    assert.equal(getTrainMap('JAPAN').cities.length,32);
    assert.equal(getTrainMap('JAPAN').routes.length,75);
    assert.equal(getTrainMap('JAPAN').tickets.length,30);
    assert.equal(getTrainMap('KOREA').cities.length,30);
    assert.equal(getTrainMap('KOREA').routes.length,81);
    assert.equal(getTrainMap('KOREA').tickets.length,30);
    assert.equal(safeParse(TrainSettingsSchema,{mapId:'MARS'}).success,false);
});

test('TRAIN original map destinations remain reachable when any one route corridor is blocked', () => {
    for (const mapId of ['KOREA', 'JAPAN'] as const) {
    const map = getTrainMap(mapId);
    for (const blocked of new Set(map.routes.map(route => route.group))) {
        const seen = new Set([map.cities[0]!.cityId]);
        const pending = [...seen];
        while (pending.length) {
            const city = pending.pop()!;
            for (const route of map.routes) {
                if (route.group === blocked) continue;
                const next = route.a === city ? route.b : route.b === city ? route.a : null;
                if (next !== null && !seen.has(next)) { seen.add(next); pending.push(next); }
            }
        }
        assert.equal(seen.size, map.cities.length, `No alternative around ${blocked}`);
    }
    }
});
