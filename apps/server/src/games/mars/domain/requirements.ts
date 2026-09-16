import { MARS_RESOURCE_NAMES, MARS_TAG_NAMES, type MarsDefinition, type MarsResources, type MarsCorporateRequirement } from '@hangul-rummikub/shared';

type Requirement = MarsCorporateRequirement | Readonly<{ kind: 'greenery'; amount: number }> | Readonly<{ kind: 'tag'; tag: string; amount: number; max?: boolean }>;
export type MarsRequirementContext = Readonly<{
    oxygen: number; temperature: number; oceans: number; cities: number; ownGreenery: number;
    production: MarsResources; globalAllowance: number; tagCount(tag: string): number;
}>;

/** Adapt the existing base catalog without changing its printed definitions. */
export function marsBaseRequirements(requirements: MarsDefinition['requirements']): readonly Requirement[] {
    return requirements.map(req => {
        if (req.kind === 'oxygen' || req.kind === 'temperature' || req.kind === 'oceans')
            return { kind: 'global', track: req.kind, amount: req.amount, max: req.max };
        if (req.kind === 'greenery') return { kind: 'greenery', amount: req.amount };
        return { kind: 'tag', tag: req.kind, amount: req.amount, max: req.max };
    });
}

/** Requirements are evaluated before payment and before the new card contributes tags. */
export function marsRequirementReason(requirements: readonly Requirement[], context: MarsRequirementContext): string | null {
    for (const req of requirements) {
        let current: number, label: string, allowance = 0, maximum = false;
        switch (req.kind) {
            case 'global':
                current = context[req.track];
                label = { oxygen: '산소', temperature: '기온', oceans: '해양' }[req.track];
                allowance = context.globalAllowance * (req.track === 'temperature' ? 2 : 1);
                maximum = req.max;
                break;
            case 'tag': current = context.tagCount(req.tag); label = MARS_TAG_NAMES[req.tag] ?? req.tag; maximum = 'max' in req && req.max === true; break;
            case 'production': current = context.production[req.resource]; label = `${MARS_RESOURCE_NAMES[req.resource]} 생산`; break;
            case 'cities': current = context.cities; label = '전체 도시'; break;
            case 'greenery': current = context.ownGreenery; label = '내 녹지'; break;
        }
        if (maximum ? current > req.amount + allowance : current < req.amount - allowance)
            return `${label} 조건: ${req.amount}${maximum ? ' 이하' : ' 이상'} · 현재 ${current}${allowance ? ` · 완화 ${allowance}` : ''}`;
    }
    return null;
}
