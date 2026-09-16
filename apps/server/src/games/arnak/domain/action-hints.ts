import { ARNAK_RESOURCES, ARNAK_RESOURCE_NAMES, ARNAK_TRAVEL_NAMES, ARNAK_RESEARCH, ARNAK_TEMPLE_COSTS, arnakCard, arnakGuardian, arnakResearch, arnakAssistant, type ArnakResources, type ArnakTravel, type ArnakOffer, type PlayerId } from '@hangul-rummikub/shared';
import { arnakPayments, type ArnakState } from './game.js';

/** Private, advisory explanations. Offers remain the sole executable authority. */
export function arnakActionHints(s: ArnakState, viewer: PlayerId, offers: readonly ArnakOffer[]) {
    const player = s.players.find(candidate => candidate.playerId === viewer);
    if (!player) return [];
    const p = player;
    const hints: { targetId: string; label: string; reasons: string[] }[] = [];
    const shortage = (cost: Partial<ArnakResources>) => ARNAK_RESOURCES.flatMap(k => (cost[k] ?? 0) > p.resources[k] ? [`${ARNAK_RESOURCE_NAMES[k]} ${(cost[k] ?? 0) - p.resources[k]}개 부족`] : []);
    const common = (main: boolean): string[] => {
        if (s.phase !== 'PLAYING') return ['게임이 종료되었습니다.'];
        if (s.activePlayerId !== viewer) return ['내 차례가 아닙니다.'];
        if (s.stage === 'CLEANUP') return ['라운드 정리 중입니다. 보관할 카드를 정하고 패스를 확정하세요.'];
        if (main && s.jobs.length) return ['진행 중인 효과 선택을 먼저 마치세요.'];
        if (main && s.mainActionUsed) return ['이번 차례 주 행동을 이미 사용했습니다.'];
        return [];
    };
    function add(targetId: string, kind: ArnakOffer['kind'], label: string, main: boolean, details: () => string[]) {
        if (offers.some(o => o.targetId === targetId && o.kind === kind && (kind !== 'RESEARCH' || o.label.startsWith(label)))) return;
        const global = common(main), reasons = global.length ? global : details();
        if (reasons.length) hints.push({ targetId, label, reasons: [...new Set(reasons)] });
    }
    function travel(needs: readonly ArnakTravel[], cost: Partial<ArnakResources> = {}, discard = false) {
        const resources = { ...p.resources, coin: Math.max(0, p.resources.coin - (cost.coin ?? 0)) };
        const payments = arnakPayments({ ...p, resources }, needs);
        if (!payments.length) return [`이동 비용 부족: ${needs.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ')} 필요 (손패·획득 이동 또는 이동 1개당 금화 2개)`];
        if (discard && !payments.some(payment => p.hand.some(c => !payment.cards.includes(c.tileId)))) return ['이동 지불 후 추가로 버릴 손패 1장이 필요합니다.'];
        return [];
    }
    for (const site of s.sites) {
        add(site.id, site.definitionId ? 'DIG' : 'DISCOVER', site.definitionId ? '발굴' : '발견', true, () => {
            const reasons = p.workers ? [] : ['남은 탐험가가 없습니다.'];
            const slots = site.travel.filter((_, i) => !site.blocked[i] && !site.occupants[i]);
            if (!slots.length) reasons.push('배치할 수 있는 빈칸이 없습니다.');
            if (!site.definitionId) reasons.push(...shortage({ compass: site.level === 1 ? 3 : 6 }));
            if (slots.length && slots.every(needs => travel(needs).length)) reasons.push(...travel(slots.reduce((a, b) => a.length <= b.length ? a : b)));
            return reasons;
        });
        if (site.guardianId) {
            const guardian = arnakGuardian(site.guardianId);
            add(site.id, 'GUARDIAN', '수호자 극복', true, () => [
                ...(!site.occupants.includes(viewer) ? ['이 장소에 내 탐험가가 있어야 합니다.'] : []),
                ...shortage(guardian.cost), ...travel(guardian.travel, guardian.cost, guardian.discard),
            ]);
        }
    }
    for (const node of ARNAK_RESEARCH.filter(n => n.row > 0)) for (const token of ['magnifier', 'notebook'] as const) {
        const label = token === 'magnifier' ? '돋보기' : '수첩';
        add(node.id, 'RESEARCH', label, true, () => {
            if (p[token] === node.id) return ['이미 이 칸에 있습니다.'];
            if (!(node.from as readonly string[]).includes(p[token])) return ['현재 연구 칸에서 연결된 바로 윗칸이 아닙니다.'];
            if (token === 'notebook' && (node.row === 8 || node.row > arnakResearch(p.magnifier).row)) return ['수첩은 돋보기보다 높은 단계나 사원 도착 칸으로 갈 수 없습니다.'];
            return shortage(node.cost);
        });
    }
    add('temple', 'RESEARCH', '사원 타일', true, () => p.magnifier !== '8' ? ['돋보기가 사원에 도착해야 합니다.'] : s.templeSupply.every(n => n === 0) ? ['남은 사원 타일이 없습니다.'] : ARNAK_TEMPLE_COSTS.flatMap((cost, i) => s.templeSupply[i] ? [`${[2,2,2,6,6,11][i]}점 타일: ${shortage(cost).join(' · ')}`] : []));
    for (const card of s.market) {
        const d = arnakCard(card.definitionId);
        add(card.tileId, 'BUY', '구매', true, () => shortage({ [d.type === 'artifact' ? 'compass' : 'coin']: d.cost }));
    }
    for (const card of p.hand) {
        const d = arnakCard(card.definitionId);
        add(card.tileId, 'CARD', '카드 사용', !d.free, () => !d.effects.length ? ['사용 효과가 없는 카드입니다. 이동 지불에 사용할 수 있습니다.'] : shortage(d.type === 'artifact' ? { tablet: 1 } : {}));
    }
    for (const assistant of p.assistants) add(assistant.definitionId, 'ASSISTANT', '조수 사용', !arnakAssistant(assistant.definitionId).free, () => assistant.ready ? [] : ['이번 라운드에 사용한 조수입니다. 다시 준비해야 합니다.']);
    for (const guardian of p.guardians) add(guardian.definitionId, 'BOON', '축복 사용', false, () => guardian.used ? ['이미 사용한 일회성 축복입니다.'] : []);
    add('idol', 'IDOL', '우상 사용', false, () => p.idolSlots >= 4 ? ['우상 슬롯을 모두 사용했습니다.'] : p.idols <= p.idolSlots ? ['사용 가능한 우상이 없습니다.'] : []);
    return hints;
}
