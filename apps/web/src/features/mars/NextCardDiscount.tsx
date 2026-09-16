import type { MarsProjection } from '@hangul-rummikub/shared';

export function NextCardDiscount({ game }: { game: MarsProjection }) {
    if (game.phase !== 'PLAYING' || game.privateState.nextCardDiscount === 0) return null;
    const payingCard = game.privateState.payment?.cardId != null;
    return <section className="tm-next-discount" aria-label="다음 카드 할인">
        <strong>다음 프로젝트 카드 −8 M€</strong>
        <p>{payingCard ? '표시된 필요 비용에 반영했습니다. 지불을 확정하면 할인을 모두 사용합니다.' : '이번 세대에만 적용됩니다. 손패에 표시된 비용에 이미 반영했습니다.'}</p>
        <small>일반 프로젝트·카드 구매에는 적용되지 않습니다. 지불을 취소하면 유지됩니다.</small>
    </section>;
}
