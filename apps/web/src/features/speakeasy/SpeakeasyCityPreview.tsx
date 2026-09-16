import {useEffect,useRef,useState} from 'react';
import {SpeakeasyToken} from './art.js';
import {CITY_PREVIEW_TILES,startCityPreview,cityPreviewStep,cityPreviewRows,cityPreviewReturns,cityPreviewSelectable,type CityPreviewAction} from './city-preview.js';
import type {useSpeakeasyAudio,SpeakeasyCue} from './sound.js';

export function SpeakeasyCityPreview({audio}:{audio:ReturnType<typeof useSpeakeasyAudio>}) {
  const [state,setState]=useState(startCityPreview), current=useRef(state), heading=useRef<HTMLHeadingElement>(null), soundRevision=useRef(0);
  useEffect(()=>{heading.current?.focus();},[state.phase]);
  useEffect(()=>()=>{soundRevision.current++;},[]);
  function act(action:CityPreviewAction,cue:SpeakeasyCue='SELECT') {
    const next=cityPreviewStep(current.current,action);
    if(next===current.current) return;
    current.current=next;setState(next);
    const revision=++soundRevision.current;
    void audio.unlock().then(()=>{if(soundRevision.current===revision)audio.play(next.phase==='DONE'?'SETTLE':cue);});
  }
  const selected=CITY_PREVIEW_TILES.find(t=>t.id===state.selected), rows=cityPreviewRows(state);
  const stages=['USE','DRAW','RETURN','DONE'], stage=stages.indexOf(state.phase);
  const title={USE:'오늘 밤, 어떤 타일을 쓸까요?',DRAW:'돌려놓기 전에, 카드 한 장.',RETURN:'사용한 타일을 도시에 돌려주세요.',DONE:'정리를 마쳤습니다.'}[state.phase];
  return <section className="sp-city-experience" aria-label="도시 타일 절차 체험" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();act({type:'SELECT',id:null},'CANCEL');}}}>
    <header className="sp-city-intro"><div><p className="sp-eyebrow">THE RESTAURANT · CITY TILES</p><h2 ref={heading} tabIndex={-1}>{title}</h2><p>타일 6개를 얻은 상황의 절차 체험입니다. 개별 타일 효과와 비용은 적용하지 않습니다.</p></div><button type="button" onClick={()=>act({type:'RESET'},'CANCEL')}>체험 다시 시작</button></header>
    <ol className="sp-city-steps" aria-label="도시 타일 진행 단계">{['최대 2개 사용','운영 카드 뽑기','타일 반환','다음 차례'].map((label,i)=><li key={label} aria-current={stage===i?'step':undefined} className={i<stage?'is-done':''}><span>{i<stage?'✓':i+1}</span>{label}</li>)}</ol>
    <div className="sp-city-grid"><div className="sp-city-table">
      <section className="sp-city-hand" aria-label="내 도시 타일"><header><h3>내 도시 타일</h3><span>사용 {state.used.length}/2 · 보유 {state.held.length}개</span></header>
        <div className="sp-city-tiles">{state.held.map(id=>{
          const tile=CITY_PREVIEW_TILES.find(t=>t.id===id)!, used=state.used.includes(id), enabled=cityPreviewSelectable(state,id);
          return <button key={id} type="button" className={`sp-city-tile ${used?'is-used':''}`} aria-pressed={state.selected===id} disabled={!enabled} onClick={()=>act({type:'SELECT',id})} aria-label={`${tile.label}${used?' · 사용됨 · 반환 대상':''}`}>
            <span className="sp-city-tile-number">CITY / {CITY_PREVIEW_TILES.indexOf(tile)+1}</span><SpeakeasyToken kind={tile.symbol}/><strong>{tile.label}</strong><span className="sp-city-tile-status">{used?'✓ 사용됨':state.phase==='RETURN'?(enabled?'초과분으로 반환 가능':'보관할 타일'):'도시 타일'}</span>
          </button>;
        })}</div>
        <p className="sp-city-note">{state.phase==='USE'?'선택만으로 사용되지 않습니다. 사용한 타일도 아직 전시장으로 보내지 마세요.':state.phase==='RETURN'?'사용한 타일은 반드시 반환하고, 미사용 타일은 최대 4개까지 남깁니다.':state.phase==='DONE'?'남은 미사용 타일은 다음 차례를 위해 보관합니다.':'운영 카드를 확인한 뒤 사용한 타일과 초과분을 반환합니다.'}</p>
      </section>
      <section className="sp-city-display" aria-label="도시 타일 전시장 중앙 열"><header><div><p className="sp-eyebrow">BACK TO THE CITY</p><h3>전시장 · 중앙 열</h3></div><span>빈칸부터 고르게</span></header>
        <div className="sp-city-piles">{state.piles.map((pile,row)=><button type="button" key={row} className={`sp-city-pile ${rows.includes(row)?'is-available':''}`} disabled={!rows.includes(row)} onClick={()=>act({type:'RETURN',row},'TILE_RETURN')} aria-label={`${row+1}번 칸에 반환 · 현재 ${pile.length}개`}>
          <span className="sp-city-pile-index">0{row+1}</span><span className="sp-city-pile-art" key={pile.join('-')}>{pile.length?<><SpeakeasyToken kind={CITY_PREVIEW_TILES.find(t=>t.id===pile[0])?.symbol??"BOOK"}/><strong>{CITY_PREVIEW_TILES.find(t=>t.id===pile[0])?.label??'전시 타일'}</strong></>:<strong>빈칸</strong>}</span><span>{pile.length}개{rows.includes(row)?' · 여기에 반환':''}</span>
        </button>)}</div>
        <p className="sp-city-note">반환할 타일을 먼저 선택하세요. 가장 적게 쌓인 칸에 놓고, 수가 같으면 원하는 칸을 고릅니다.</p>
      </section>
    </div><aside className="sp-action-card sp-city-guide" aria-label="도시 타일 선택 안내">
      <p className="sp-eyebrow">YOUR NEXT MOVE</p><h3>{state.phase==='USE'?'선택을 확인하세요':state.phase==='DRAW'?'운영 카드 1장':state.phase==='RETURN'?`${cityPreviewReturns(state)}개 반환 대기`:'이제 다음 차례'}</h3>
      <div className="sp-city-detail">{selected?<><strong>{selected.label}</strong><p>{selected.detail}</p><small>{state.phase==='USE'?'이번 체험에서는 사용 표시와 반환 흐름만 적용합니다.':'전시장에서 강조된 반환 칸을 누르세요.'}</small></>:<p>{state.phase==='USE'?'내 도시 타일을 눌러 살펴보세요.':state.phase==='DRAW'?'새 카드를 확인한 뒤 남길 도시 타일을 선택합니다.':state.phase==='RETURN'?'사용됨 표시가 있는 타일과 초과 보유분을 정리하세요.':'미사용 타일 4개를 보관했습니다. 모든 반환이 끝나야 다음 플레이어의 차례가 됩니다.'}</p>}</div>
      {state.phase==='USE'&&<><button type="button" className="sp-primary" disabled={!selected||state.used.length>=2} onClick={()=>act({type:'USE'},'TILE_USE')}>선택한 타일 사용</button><button type="button" className="sp-city-finish" onClick={()=>act({type:'FINISH'})}>사용 마치고 카드 뽑기 →</button></>}
      {state.phase==='DRAW'&&<button type="button" className="sp-primary" onClick={()=>act({type:'DRAW'},'CARD_DRAW')}>예시 운영 카드 뽑기</button>}
      {(state.phase==='RETURN'||state.phase==='DONE')&&<div className="sp-city-drawn"><span>방금 뽑은 카드 · 고정 예시</span><strong>PARTY / 파티</strong><span>카드를 확인한 뒤 타일을 반환합니다.</span></div>}
      {state.phase==='DONE'&&<div className="sp-confirmed">✓ 도시 타일 정리 완료</div>}
      <p className="sp-city-status" role="status" aria-live="polite" aria-atomic="true">{state.message}</p>
      <p className="sp-rule-note">Tab으로 이동 · Enter/Space로 선택 · Escape로 선택 취소. 소리 없이도 모든 결과를 확인할 수 있습니다.</p>
    </aside></div>
    {state.phase==='USE'&&selected&&<button type="button" className="sp-mobile-review" onClick={()=>act({type:'USE'},'TILE_USE')}>{selected.label} 사용 확정</button>}
  </section>;
}
