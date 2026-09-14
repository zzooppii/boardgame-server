import * as v from 'valibot';
import { TRAIN_CITIES, TRAIN_ROUTES, TRAIN_TICKETS, TRAIN_ROUTE_POINTS, TRAIN_RULES_VERSION, type TrainCity, type TrainRoute, type TrainTicket } from './catalog.js';

import { JAPAN_CITIES, JAPAN_ROUTES, JAPAN_TICKETS } from './japan-catalog.js';
import { KOREA_CITIES, KOREA_ROUTES, KOREA_TICKETS } from './korea-catalog.js';

export const TrainMapIdSchema = v.picklist(['USA', 'KOREA', 'JAPAN']);
export type TrainMapId = v.InferOutput<typeof TrainMapIdSchema>;
export const TrainSettingsSchema = v.strictObject({ mapId: TrainMapIdSchema });
export type TrainSettings = v.InferOutput<typeof TrainSettingsSchema>;
export type TrainMapDefinition = Readonly<{
    mapId: TrainMapId;
    rulesVersion: string;
    label: string;
    cities: readonly TrainCity[];
    routes: readonly TrainRoute[];
    tickets: readonly TrainTicket[];
    trains: number;
    initialHand: number;
    initialTickets: number;
    minimumInitialTickets: number;
    drawTickets: number;
    routePoints: Readonly<Record<number, number>>;
    longestBonus: number;
    viewBox: Readonly<{ width: number; height: number }>;
}>;

export const TRAIN_MAP_OPTIONS = [
    { mapId: 'USA', label: '북아메리카', subtitle: '대륙을 잇는 첫 여정', available: true, image: '/images/train/journey.jpg', rules: ['2–5인', '목적지 연결', '최장 노선 +10점'] },
    { mapId: 'KOREA', label: '한국 창작 지도', subtitle: '익숙한 규칙으로 떠나는 새로운 여정', available: true, image: '/images/train/korea-journey.png', rules: ['2–5인', '미국판 기본 규칙', '최장 노선 +10점'] },
    { mapId: 'JAPAN', label: '일본 창작 지도', subtitle: '벚꽃과 바다를 따라 잇는 철도 여행', available: true, image: '/images/train/japan-journey.jpg', rules: ['2–5인', '미국판 기본 규칙', '최장 노선 +10점'] },
] as const;

const usa: TrainMapDefinition = Object.freeze({
    mapId: 'USA', rulesVersion: TRAIN_RULES_VERSION, label: '북아메리카',
    cities: TRAIN_CITIES, routes: TRAIN_ROUTES, tickets: TRAIN_TICKETS,
    trains: 45, initialHand: 4, initialTickets: 3, minimumInitialTickets: 2,
    drawTickets: 3, routePoints: TRAIN_ROUTE_POINTS, longestBonus: 10,
    viewBox: { width: 1200, height: 800 },
});

const korea: TrainMapDefinition = Object.freeze({
    ...usa, mapId: 'KOREA', rulesVersion: 'train-korea-original-v1', label: '한국 창작 지도',
    cities: KOREA_CITIES, routes: KOREA_ROUTES, tickets: KOREA_TICKETS,
    viewBox: {width: 1200, height: 1250},
});

const japan: TrainMapDefinition = Object.freeze({
    ...usa, mapId: 'JAPAN', rulesVersion: 'train-japan-original-v1', label: '일본 창작 지도',
    cities: JAPAN_CITIES, routes: JAPAN_ROUTES, tickets: JAPAN_TICKETS,
    viewBox: {width: 1200, height: 1500},
});

/** USA and explicitly original Korea/Japan catalogs remain separate. */
export function isTrainMapAvailable(mapId: TrainMapId): boolean {
    return TRAIN_MAP_OPTIONS.some(map => map.mapId === mapId && map.available);
}
export function getTrainMap(mapId: TrainMapId = 'USA'): TrainMapDefinition {
    switch (mapId) {
        case 'USA': return usa;
        case 'KOREA': return korea;
        case 'JAPAN': return japan;
        default: throw new Error('Unknown train map.');
    }
}
export function trainMapCityName(cityId: string, mapId: TrainMapId = 'USA'): string {
    return getTrainMap(mapId).cities.find(city => city.cityId === cityId)?.label ?? cityId;
}
