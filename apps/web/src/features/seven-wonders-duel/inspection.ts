import type { DuelOption } from '@hangul-rummikub/shared';

export function duelInspectionOptions(options: readonly DuelOption[], inspect: {id: string | null; source: string}): DuelOption[] {
    return options.filter(o => o.sourceId === inspect.source || o.targetId === inspect.source || inspect.id !== null && o.definitionId === inspect.id);
}
