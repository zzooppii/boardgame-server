import type {SpeakeasyPracticeView} from '@hangul-rummikub/shared';

export type PracticeBusinessView = Pick<SpeakeasyPracticeView, 'viewerId' | 'districts' | 'choices' | 'finished' | 'actionsLeft'>;
export type PracticeBusinessFilter = 'ALL' | 'SELL' | 'CLOSED' | 'UNPROTECTED';

/** Show owned public buildings and attach only the server's exact executable choices. */
export function practiceBusinesses(view: PracticeBusinessView) {
  return view.districts.flatMap(district => district.slots.flatMap((building, slot) => {
    if (!building || building.ownerId !== view.viewerId) return [];
    const choices = view.finished || view.actionsLeft === 0 ? [] : view.choices.filter(choice => {
      const action = choice.action;
      if ('buildingId' in action) return action.buildingId === building.tileId;
      return action.type === 'PRODUCE' && choice.preview.targets.some(target => target.district === district.id && target.slot === slot);
    });
    return [{building, district: district.id, slot, cop: district.cop, choices,
      canSell: choices.some(choice => choice.action.type === 'SELL')}];
  }));
}
export type PracticeBusiness = ReturnType<typeof practiceBusinesses>[number];
export function filterPracticeBusinesses(businesses: readonly PracticeBusiness[], filter: PracticeBusinessFilter) {
  return businesses.filter(item => filter === 'ALL' || (filter === 'SELL' ? item.canSell : filter === 'CLOSED' ? !item.building.operating : !item.building.protected));
}
