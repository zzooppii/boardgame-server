import {useRef} from 'react';
import type {HarmoniesColor} from '@hangul-rummikub/shared';
import {TerrainToken} from './art.js';

function Example({colors,label,points}:{colors:readonly HarmoniesColor[];label:string;points:number}) {
  return <figure><TerrainToken colors={colors} size={70}/><figcaption>{label}<strong>{points}점</strong></figcaption></figure>;
}

export function HarmoniesScoreGuide() {
  const dialog=useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className="hm-rule-button" aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>점수 계산표</button>
    <dialog ref={dialog} className="hm-stack-guide hm-score-guide" aria-labelledby="hm-score-guide-title">
      <header className="hm-stack-guide-heading">
        <div><span className="hm-eyebrow">SCORING GUIDE · SIDE A</span><h2 id="hm-score-guide-title">내 풍경은 몇 점일까요?</h2></div>
        <button type="button" autoFocus onClick={()=>dialog.current?.close()}>닫기</button>
      </header>
      <p>지형 다섯 종류의 점수와 동물 카드 점수를 모두 더합니다.</p>
      <section className="hm-score-rule" aria-label="나무 점수">
        <h3>나무 <small>각 나무의 높이</small></h3>
        <div className="hm-score-examples">
          <Example colors={['WOOD']} label="줄기만" points={0}/>
          <Example colors={['LEAF']} label="잎 · 1층" points={1}/>
          <Example colors={['WOOD','LEAF']} label="나무 · 2층" points={3}/>
          <Example colors={['WOOD','WOOD','LEAF']} label="나무 · 3층" points={7}/>
        </div>
        <p>맨 위에 잎이 있어야 점수를 받아요. 줄기만 있으면 높이에 관계없이 0점입니다.</p>
      </section>
      <section className="hm-score-rule" aria-label="산 점수">
        <h3>산 <small>다른 산과 맞닿아야 해요</small></h3>
        <div className="hm-score-examples">
          <Example colors={['STONE','STONE','STONE']} label="혼자 있는 산" points={0}/>
          <Example colors={['STONE']} label="연결된 산 · 1층" points={1}/>
          <Example colors={['STONE','STONE']} label="연결된 산 · 2층" points={3}/>
          <Example colors={['STONE','STONE','STONE']} label="연결된 산 · 3층" points={7}/>
        </div>
        <p>맨 위가 회색인 다른 칸과 인접하면 각 산의 높이에 따른 점수를 받아요. 고립된 산은 높이에 관계없이 0점입니다.</p>
      </section>
      <section className="hm-score-rule" aria-label="들판 점수">
        <h3>들판 <small>연결된 무리마다 계산</small></h3>
        <div className="hm-score-examples hm-score-pair">
          <Example colors={['FIELD']} label="노랑 하나만" points={0}/>
          <figure><div className="hm-score-cluster"><TerrainToken colors={['FIELD']}/><TerrainToken colors={['FIELD']}/><span>＋</span></div><figcaption>노랑 2개 이상 연결<strong>무리당 5점</strong></figcaption></figure>
        </div>
        <p>한 무리가 3개·4개로 커져도 5점이에요. 떨어진 무리가 각각 조건을 만족하면 따로 점수를 받습니다.</p>
      </section>
      <section className="hm-score-rule" aria-label="건물 점수">
        <h3>건물 <small>주변 맨 위 토큰의 색 종류</small></h3>
        <div className="hm-score-examples hm-score-pair">
          <Example colors={['WOOD','RED']} label="주변 색 2종 이하" points={0}/>
          <Example colors={['STONE','RED']} label="주변 색 3종 이상" points={5}/>
        </div>
        <p>2층 건물마다 인접한 칸의 맨 위 색을 세어요. 같은 색은 한 종류로 셉니다. 건물 자신의 색은 포함하지 않으며, 빨강 1층은 0점이에요.</p>
      </section>
      <section className="hm-score-rule" aria-label="강 점수">
        <h3>강 <small>가장 좋은 강 하나</small></h3>
        <div className="hm-river-score">{[0,2,5,8,11,15].map((points,i)=><figure key={i}><TerrainToken colors={['WATER']} size={48}/><figcaption>{i+1}칸<strong>{points}점</strong></figcaption></figure>)}</div>
        <p><strong>7칸부터 한 칸 늘 때마다 +4점.</strong> 연결된 두 파란 칸 사이의 최단 경로 중 가장 긴 길이를 사용해요. 가지나 고리의 모든 토큰 수를 합산하지 않습니다.</p>
      </section>
      <section className="hm-score-rule" aria-label="동물 점수">
        <h3>동물 <small>카드마다 가장 높은 달성 점수</small></h3>
        <p>동물을 놓아 드러난 점수 중 가장 높은 값 하나를 받아요. 예를 들어 3·6·10·16점 카드에서 두 마리를 놓았다면 <strong>6점</strong>입니다. 카드의 숫자를 모두 더하지 않아요.</p>
      </section>
      <p className="hm-stack-return">닫기 또는 Esc로 돌아가세요. 보드 아래 점수 항목을 누르면 해당 지형의 계산 근거도 볼 수 있어요.</p>
    </dialog>
  </>;
}
