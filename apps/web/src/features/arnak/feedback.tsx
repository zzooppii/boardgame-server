import { useEffect, useRef, useState } from 'react';
import { ARNAK_RESOURCES, ARNAK_RESOURCE_NAMES, type ArnakResources, type ArnakProjection } from '@hangul-rummikub/shared';

export type ArnakFeedbackSnapshot = { gameId: string; revision: number; resources: ArnakResources };
export function arnakResourceChanges(previous: ArnakFeedbackSnapshot | null, next: ArnakFeedbackSnapshot): string[] {
    if (!previous || previous.gameId !== next.gameId || next.revision !== previous.revision + 1) return [];
    return ARNAK_RESOURCES.flatMap(key => {
        const amount = next.resources[key] - previous.resources[key];
        return amount ? [`${ARNAK_RESOURCE_NAMES[key]} ${amount > 0 ? '+' : '−'}${Math.abs(amount)}`] : [];
    });
}

export function ArnakFeedback({ game, self, connected }: { game: ArnakProjection; self: string; connected: boolean }) {
    const previous = useRef<ArnakFeedbackSnapshot | null>(null);
    const [message, setMessage] = useState('');
    const resources = game.playerStates.find(p => p.playerId === self)!.resources;
    useEffect(() => {
        const next = { gameId: game.gameId, revision: game.gameRevision, resources };
        const changes = connected ? arnakResourceChanges(previous.current, next) : [];
        previous.current = connected ? next : null;
        setMessage(changes.join(' · '));
        const timer = window.setTimeout(() => setMessage(''), 3500);
        return () => window.clearTimeout(timer);
    }, [game.gameId, game.gameRevision, connected, self]);
    return <div className="ar-feedback" role="status" aria-live="polite" aria-atomic="true">
        {message && <span key={game.gameRevision}>{message}</span>}
    </div>;
}
