import { ARNAK_TRAVEL_NAMES, arnakCostText, arnakGuardian } from '@hangul-rummikub/shared';
import { ArnakWorldArt } from './ArnakWorldArt.js';
import { describeArnakEffect } from './effect-description.js';

export function ArnakGuardianPreview({ definitionId }: { definitionId: string }) {
    const guardian = arnakGuardian(definitionId);
    return <section className="ar-guardian-preview" aria-label="수호자 비용과 축복">
        <ArnakWorldArt definitionId={definitionId} expanded/>
        <h3>{guardian.name} · 5점</h3>
        <p className="ar-guardian-cost">극복 비용: {arnakCostText(guardian.cost)}
            {guardian.travel.length ? ' · ' + guardian.travel.map(t => ARNAK_TRAVEL_NAMES[t]).join(' + ') : ''}
            {guardian.discard ? ' · 손패 1장 버리기' : ''}</p>
        <div className="ar-guardian-boon"><strong>극복 후 축복 · 한 번 사용</strong>
            <p className="ar-ability-effect">{guardian.boon.map(describeArnakEffect).join(' · ')}</p>
            <small>극복하면 이 축복을 사용할 수 있습니다. 사용 후에도 수호자 점수 5점은 유지됩니다.</small>
        </div>
    </section>;
}
