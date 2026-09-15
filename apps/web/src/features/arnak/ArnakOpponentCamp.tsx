import { arnakAssistant, arnakCard, arnakGuardian, arnakResearch, type ArnakPlayerPublic, type ArnakCard } from '@hangul-rummikub/shared';
import { ArnakCardArt } from './ArnakCardArt.js';
import { ArnakWorldArt } from './ArnakWorldArt.js';
import { describeArnakEffect } from './effect-description.js';

/** Read-only public projection. No hand/deck contents, offers or command callbacks are accepted. */
export function ArnakOpponentCamp({ player, onInspectCard }: { player: ArnakPlayerPublic; onInspectCard(cardId: ArnakCard['tileId']): void }) {
    const position = (id: string) => id === '0' ? '출발' : `${arnakResearch(id).row}단계 (${id})`;
    return <section className="ar-public-camp" aria-label="탐험대 공개 정보">
        <dl className="ar-public-stats">
            <div><dt>손패 / 덱</dt><dd>{player.handCount}장 / {player.deckCount}장</dd></div>
            <div><dt>남은 탐험가</dt><dd>{player.workers}명</dd></div>
            <div><dt>돋보기</dt><dd>{position(player.magnifier)}</dd></div>
            <div><dt>수첩</dt><dd>{position(player.notebook)}</dd></div>
            <div><dt>우상 / 사용한 슬롯</dt><dd>{player.idols}개 / {player.idolSlots}칸</dd></div>
            <div><dt>사원 타일</dt><dd>{player.templePoints}점</dd></div>
            <div><dt>공포 대체 타일</dt><dd>{player.fearTiles}개</dd></div>
        </dl>
        <h3>조수 <small>{player.assistants.length}명</small></h3>
        {player.assistants.length ? <div className="ar-public-abilities">{player.assistants.map(assistant => {
            const d = arnakAssistant(assistant.definitionId);
            return <details className="ar-public-ability" key={d.id}><summary><ArnakWorldArt definitionId={d.id}/><span><strong>{d.name}</strong><small>{assistant.gold ? '금색' : '은색'} · {assistant.ready ? '사용 가능' : '사용 완료'}</small></span><span className="ar-public-expand">능력 보기</span></summary>
                <p>{(assistant.gold ? d.gold : d.silver).map(describeArnakEffect).join(' · ')}</p><small>{d.free ? '자유 행동' : '주 행동'}</small>
            </details>;
        })}</div> : <p className="ar-muted">고용한 조수가 없습니다.</p>}
        <h3>극복한 수호자 <small>{player.guardians.length}종</small></h3>
        {player.guardians.length ? <div className="ar-public-abilities">{player.guardians.map(guardian => {
            const d = arnakGuardian(guardian.definitionId);
            return <details className="ar-public-ability" key={d.id}><summary><ArnakWorldArt definitionId={d.id}/><span><strong>{d.name}</strong><small>{guardian.used ? '축복 사용 완료' : '축복 사용 가능'} · 5점</small></span><span className="ar-public-expand">능력 보기</span></summary><p>{d.boon.map(describeArnakEffect).join(' · ')}</p>
            </details>;
        })}</div> : <p className="ar-muted">극복한 수호자가 없습니다.</p>}
        <h3>사용한 카드 <small>{player.played.length}장</small></h3>
        {player.played.length ? <div className="ar-public-cards">{player.played.map(card => <button type="button" key={card.tileId} onClick={() => onInspectCard(card.tileId)} aria-label={arnakCard(card.definitionId).name + ' 카드 상세 보기'}><ArnakCardArt definitionId={card.definitionId}/><span>{arnakCard(card.definitionId).name} ↗</span></button>)}</div> : <p className="ar-muted">사용한 카드가 없습니다.</p>}
        <small className="ar-public-note">손패와 덱은 장수만 공개됩니다. 카드 그림을 누르면 상세 설명을 볼 수 있습니다.</small>
    </section>;
}
