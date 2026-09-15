import {useRef} from 'react';
import {type HarmoniesColor} from '@hangul-rummikub/shared';
import {TerrainToken} from './art.js';

const LEVELS: readonly (readonly (readonly HarmoniesColor[])[])[] = [
  [['STONE'], ['RED'], ['WOOD'], ['LEAF'], ['WATER'], ['FIELD']],
  [['STONE', 'STONE'], ['STONE', 'RED'], ['RED', 'RED'], ['WOOD', 'RED'], ['WOOD', 'WOOD'], ['WOOD', 'LEAF']],
  [['STONE', 'STONE', 'STONE'], ['WOOD', 'WOOD', 'LEAF']],
];
const LABELS: Record<HarmoniesColor, string> = {
  STONE: '회색', RED: '빨강', WOOD: '갈색', LEAF: '초록', WATER: '파랑', FIELD: '노랑',
};

export function HarmoniesStackGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="hm-rule-button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>쌓기 규칙</button>
    <dialog ref={dialog} className="hm-stack-guide" aria-labelledby="hm-stack-title">
      <header className="hm-stack-guide-heading">
        <div><span className="hm-eyebrow">LANDSCAPE GUIDE</span><h2 id="hm-stack-title">이렇게 쌓을 수 있어요</h2></div>
        <button type="button" autoFocus onClick={() => dialog.current?.close()}>닫기</button>
      </header>
      <p>아래 그림의 조합만 가능해요. 색 이름은 <strong>아래층 → 위층</strong> 순서입니다.</p>
      {LEVELS.map((stacks, index) => <section key={index} className="hm-stack-level" aria-label={`${index + 1}층 조합`}>
        <h3>{index + 1}층</h3>
        <div className="hm-stack-examples">{stacks.map(colors => <figure key={colors.join('-')}>
          <TerrainToken colors={colors} size={82}/>
          <figcaption>{colors.map(color => LABELS[color]).join(' → ')}</figcaption>
        </figure>)}</div>
      </section>)}
      <ul className="hm-stack-notes">
        <li>파랑·노랑·초록 위에는 토큰을 더 쌓을 수 없어요.</li>
        <li>동물이 올라간 칸에는 더 쌓을 수 없어요.</li>
        <li>기존 토큰 밑에 끼우거나 다른 칸으로 옮길 수 없어요.</li>
      </ul>
      <p className="hm-stack-return">닫기 또는 Esc를 누르면 배치 중이던 화면으로 돌아갑니다.</p>
    </dialog>
  </>;
}
