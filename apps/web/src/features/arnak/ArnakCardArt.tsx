import { arnakCard } from '@hangul-rummikub/shared';
import { arnakCardArtStyle } from './card-art.js';
export function ArnakCardArt({ definitionId, detail = false }: { definitionId: string; detail?: boolean }) {
    return <span className={'ar-card-art ' + (detail ? 'ar-detail-art' : 'ar-art')}
        role={detail ? 'img' : undefined} aria-label={detail ? arnakCard(definitionId).name + ' 테마 일러스트' : undefined} aria-hidden={detail ? undefined : true}>
        <span className="ar-card-art-surface" style={arnakCardArtStyle(definitionId)}/>
    </span>;
}
