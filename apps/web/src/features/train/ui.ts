import { TRAIN_COLORS, getTrainMap, type TrainColor, type TrainRoute, type TrainProjection, type TrainCardId } from '@hangul-rummikub/shared';
export const TRAIN_LABELS: Record<TrainColor | string, string> = { RED: '빨강', ORANGE: '주황', YELLOW: '노랑', GREEN: '초록', BLUE: '파랑', PURPLE: '보라', WHITE: '흰색', BLACK: '검정', GRAY: '아무 한 색', LOCOMOTIVE: '기관차' };
export const TRAIN_PAINT: Record<TrainColor | string, string> = { RED: '#bb3c3a', ORANGE: '#d68032', YELLOW: '#e7bd3f', GREEN: '#5d9161', BLUE: '#398ab0', PURPLE: '#b26e98', WHITE: '#ece6d5', BLACK: '#41464a', GRAY: '#a8a397', LOCOMOTIVE: '#bf984e' };
export const TRAIN_SYMBOLS: Record<TrainColor | string, string> = { RED: '●', ORANGE: '◆', YELLOW: '☀', GREEN: '✚', BLUE: '■', PURPLE: '✿', WHITE: '◇', BLACK: '▲', GRAY: '○', LOCOMOTIVE: '★' };
export const TRAIN_PLAYER_PAINT = ['#c84945', '#23769f', '#448755', '#d49d25', '#6b526f'];
export const TRAIN_ACTION_LABELS: Record<string, string> = { DRAW_DECK: '열차 카드 뽑기', DRAW_MARKET: '공개 카드 가져오기', CLAIM_ROUTE: '노선 점유', DRAW_TICKETS: '목적지 뽑기', KEEP_TICKETS: '목적지 선택 완료', PASS: '가능한 행동 없음', TIMEOUT: '90초 초과 · 자동 행동 완료' };
export function trainRouteOpen(g: TrainProjection, route: TrainRoute, self: string) { return getTrainMap(g.mapId).routes.some(r => r.routeId === route.routeId) && !g.claims.some(c => c.routeId === route.routeId || getTrainMap(g.mapId).routes.find(r => r.routeId === c.routeId)?.group === route.group && (g.playerStates.length < 4 || c.playerId === self)); }
export type TrainPayment = {
    color: TrainColor;
    ordinary: number;
    wild: number;
    cardIds: TrainCardId[];
};
export function trainPayments(g: TrainProjection, route: TrainRoute): TrainPayment[] {
    const me = g.playerStates.find(p => p.playerId === g.privateState.playerId);
    if (!me || me.trains < route.length || !trainRouteOpen(g, route, me.playerId))
        return [];
    const hand = g.privateState.hand, wild = hand.filter(c => c.color === 'LOCOMOTIVE'), result: TrainPayment[] = [];
    for (const color of TRAIN_COLORS) {
        if (color === 'LOCOMOTIVE' || route.color !== 'GRAY' && route.color !== color)
            continue;
        const ordinary = hand.filter(c => c.color === color);
        for (let n = Math.min(route.length, ordinary.length); n >= 1; n--) {
            const w = route.length - n;
            if (w <= wild.length)
                result.push({ color, ordinary: n, wild: w, cardIds: [...ordinary.slice(0, n), ...wild.slice(0, w)].map(c => c.cardId) });
        }
    }
    if (wild.length >= route.length)
        result.push({ color: 'LOCOMOTIVE', ordinary: 0, wild: route.length, cardIds: wild.slice(0, route.length).map(c => c.cardId) });
    return result.sort((a, b) => a.wild - b.wild);
}
export function trainCanDraw(g: TrainProjection, self: string, source: 'DECK' | TrainColor): boolean { return g.phase === 'PLAYING' && g.activePlayerId === self && (g.step === 'TURN' || g.step === 'DRAW_SECOND') && (source === 'DECK' ? g.deckCount + g.discardCount > 0 : !(source === 'LOCOMOTIVE' && g.step === 'DRAW_SECOND')); }
export function trainCanPass(g: TrainProjection): boolean { return g.phase === 'PLAYING' && g.step === 'TURN' && g.deckCount + g.discardCount + g.market.length + g.ticketDeckCount === 0 && !getTrainMap(g.mapId).routes.some(r => trainPayments(g, r).length > 0); }

export function trainClaimBlockReason(g: TrainProjection, route: TrainRoute): string | null {
    const me = g.playerStates.find(p => p.playerId === g.privateState.playerId);
    if (!me) return '플레이어 정보를 확인할 수 없습니다.';
    if (!trainRouteOpen(g,route,me.playerId)) return '이미 점유되었거나 복선 규칙에 따라 사용할 수 없는 노선입니다.';
    if (me.trains < route.length) return `남은 기차 말이 ${me.trains}개입니다. 이 노선에는 ${route.length}개가 필요합니다. 열차 카드를 뽑아 차례를 마칠 수도 있습니다.`;
    if (trainPayments(g,route).length === 0) return `이 노선을 점유할 열차 카드가 부족합니다. ${TRAIN_LABELS[route.color]} 카드와 기관차를 합쳐 ${route.length}장이 필요합니다.`;
    return null;
}
