import { arnakWorldArt } from './world-art.js';
export function ArnakWorldArt({ definitionId, expanded = false }: { definitionId: string | null | undefined; expanded?: boolean }) {
    const art = arnakWorldArt(definitionId);
    if (!art) return null;
    return <span className={'ar-art ar-world-art' + (expanded ? ' ar-world-preview' : '')}
        role={expanded ? 'img' : undefined} aria-label={expanded ? art.name + ' 테마 일러스트' : undefined} aria-hidden={expanded ? undefined : true}>
        <span className="ar-world-art-surface" style={art.style}/>
    </span>;
}
