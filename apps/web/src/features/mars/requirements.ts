import { MARS_RESOURCE_NAMES, MARS_TAG_NAMES, type MarsDefinition } from '@hangul-rummikub/shared';

/** Printed conditions only. The server separately applies allowances and decides playability. */
export function marsPrintedRequirements(card: MarsDefinition): string {
    const describe = (kind: string, amount: number, maximum = false): string => {
        const comparison = maximum ? '이하' : '이상';
        if (kind === 'temperature') return `기온 ${amount}°C ${comparison}`;
        if (kind === 'oxygen') return `산소 ${amount}% ${comparison}`;
        if (kind === 'oceans') return `해양 ${amount}개 ${comparison}`;
        if (kind === 'greenery') return `내 녹지 ${amount}개 ${comparison}`;
        if (MARS_TAG_NAMES[kind]) return `${MARS_TAG_NAMES[kind]} 태그 ${amount}개 ${comparison}`;
        return `${kind} ${amount} ${comparison}`;
    };
    if (card.corporateRequirements) return card.corporateRequirements.map(req => {
        switch (req.kind) {
            case 'global': return describe(req.track, req.amount, req.max);
            case 'tag': return describe(req.tag, req.amount);
            case 'production': return `${MARS_RESOURCE_NAMES[req.resource]} 생산 ${req.amount} 이상`;
            case 'cities': return `전체 도시 ${req.amount}개 이상`;
        }
    }).join(' · ');
    return card.requirements.map(req => describe(req.kind, req.amount, req.max)).join(' · ');
}
