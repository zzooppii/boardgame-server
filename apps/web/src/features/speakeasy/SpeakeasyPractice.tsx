import {useEffect,useRef,useState} from 'react';
import {safeParse} from 'valibot';
import {SPEAKEASY_PRACTICE_RULES,SpeakeasyPracticeReplySchema,SpeakeasyPracticeViewSchema,SPEAKEASY_BUILDING_LABELS,
  type SpeakeasyPracticeView,type SpeakeasyPracticeAction} from '@hangul-rummikub/shared';
import {PracticeGuide} from './PracticeGuide.js';
import {practiceDistrictChoices,practiceDistrictFilter} from './practice-guide.js';
import {SpeakeasyBuildingArt,SpeakeasyToken} from './art.js';
import {useSpeakeasyAudio,type SpeakeasyCue} from './sound.js';

function ResourceChanges({delta}:{delta:NonNullable<SpeakeasyPracticeView['feedback']>['delta']}) {
  const names={cash:'현금',safe:'금고',stock:'저장 주류',family:'조직원',truckLoad:'트럭 주류'};
  const keys=(['cash','safe','stock','family','truckLoad'] as const).filter(key=>delta[key]!==0);
  return <ul className="sp-practice-deltas" aria-label="내 자원 변화">{keys.length?keys.map(key=><li key={key} className={delta[key]>0?'is-gain':'is-spend'}>{names[key]} <strong>{delta[key]>0?'+':'−'}{key==='cash'||key==='safe'?'$':''}{Math.abs(delta[key])}</strong></li>):<li>내 자원 변화 없음</li>}</ul>;
}
const api='/api/speakeasy-practice';
const cues:Record<SpeakeasyPracticeAction['type'],SpeakeasyCue>={MOVE:'DELIVER',BUILD:'BUILD',PRODUCE:'PRODUCE',DELIVER:'DELIVER',SELL:'SELL',PROTECT:'PROTECT',END_TURN:'CARD_DRAW'};
const labels:Record<SpeakeasyPracticeAction['type'],string>={MOVE:'이동',BUILD:'건설',PRODUCE:'생산',DELIVER:'운송',SELL:'판매',PROTECT:'보호',END_TURN:'턴 종료'};
const problems={INVALID_COMMAND:'지금은 이 행동을 할 수 없습니다. 최신 상태를 확인해 주세요.',STALE_REVISION:'진행 상태가 바뀌었습니다. 최신 화면을 불러왔습니다.',SESSION_EXPIRED:'연습 대국이 종료되었거나 서버가 재시작되었습니다. 새 대국을 시작해 주세요.',CAPACITY:'연습 서버가 가득 찼습니다. 잠시 뒤 다시 시도해 주세요.',INTERNAL_ERROR:'서버가 행동을 처리하지 못했습니다. 현재 상태를 다시 확인해 주세요.'};
export function SpeakeasyPractice({onExit}:{onExit():void}) {
  const [view,setView]=useState<SpeakeasyPracticeView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [filter,setFilter]=useState<SpeakeasyPracticeAction['type']>('PRODUCE'),[district,setDistrict]=useState<number|null>(null);
  const [selected,setSelected]=useState<SpeakeasyPracticeView['choices'][number]|null>(null),[endConfirm,setEndConfirm]=useState(false),[exitConfirm,setExitConfirm]=useState(false);
  const token=useRef<string|null>(null),pending=useRef(false),mounted=useRef(true),audio=useSpeakeasyAudio();
  const mapPanel=useRef<HTMLDivElement>(null),actionPanel=useRef<HTMLElement>(null),message=useRef<HTMLParagraphElement>(null),results=useRef<HTMLElement>(null);
  useEffect(()=>{if(view?.finished){results.current?.scrollIntoView({block:'start'});results.current?.focus({preventScroll:true});}},[view?.finished]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(token.current)void fetch(api,{method:'DELETE',headers:{Authorization:`Bearer ${token.current}`},keepalive:true}).catch(()=>{/* Session also expires automatically. */});};},[]);
  async function request(url:string,init:RequestInit):Promise<unknown>{
    const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),12000);
    try{const response=await fetch(url,{...init,signal:controller.signal});return response.status===204?null:await response.json();}finally{window.clearTimeout(timer);}
  }
  async function start(){
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{
      if(token.current)await request(api,{method:'DELETE',headers:{Authorization:`Bearer ${token.current}`}});token.current=null;
      const result:unknown=await request(api,{method:'POST'});
      if(!mounted.current)return;
      if(typeof result!=='object'||result===null||!('token' in result)||typeof result.token!=='string'||!('view' in result))throw new Error('start');
      const parsed=safeParse(SpeakeasyPracticeViewSchema,result.view);if(!parsed.success)throw new Error('view');
      token.current=result.token;setView(parsed.output);setSelected(null);setDistrict(null);setFilter('PRODUCE');setEndConfirm(false);audio.play('CARD_DRAW');
    }catch{if(mounted.current)setError('연습 서버에 연결하지 못했습니다. 서버 실행 상태를 확인한 뒤 다시 시작해 주세요.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  }
  async function refresh(){
    if(!token.current)return;
    const result=safeParse(SpeakeasyPracticeReplySchema,await request(api,{headers:{Authorization:`Bearer ${token.current}`}}));
    if(!mounted.current)return;
    if(!result.success)throw new Error('view');
    if(result.output.ok){setView(result.output.view);setSelected(null);setEndConfirm(false);}
    else{setError(problems[result.output.reason]);if(result.output.reason==='SESSION_EXPIRED'){token.current=null;setView(null);}}
  }
  async function retry(){
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{await refresh();}catch{if(mounted.current)setError('서버에 연결하지 못했습니다. 다시 확인해 주세요.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  }
  async function submit(action:SpeakeasyPracticeAction){
    if(!view||!token.current||pending.current)return;pending.current=true;setBusy(true);setError('');
    try{
      const result=safeParse(SpeakeasyPracticeReplySchema,await request(`${api}/command`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token.current}`},
        body:JSON.stringify({gameId:view.gameId,revision:view.revision,requestId:crypto.randomUUID(),action})}));
      if(!mounted.current)return;if(!result.success)throw new Error('reply');
      if(result.output.ok){setView(result.output.view);setSelected(null);setEndConfirm(false);audio.play(result.output.view.finished?'SETTLE':cues[action.type]);}
      else{setError(problems[result.output.reason]);audio.play('ERROR');await refresh();}
    }catch{
      if(mounted.current){setError('응답을 확인하고 있습니다.');
        try{await refresh();if(token.current)setError('연결이 잠시 끊어졌습니다. 최신 상태를 불러왔으니 행동 기록을 확인해 주세요.');}catch{setError('연결이 끊어졌습니다. “현재 상태 다시 확인”을 눌러 적용 여부를 확인해 주세요.');}audio.play('ERROR');}
    }finally{pending.current=false;if(mounted.current)setBusy(false);}
  }
  function choose(choice:SpeakeasyPracticeView['choices'][number]){setSelected(choice);setEndConfirm(false);audio.play('SELECT');actionPanel.current?.scrollIntoView({block:'nearest',behavior:'auto'});}
  const own=(owner:string)=>owner===view?.viewerId?'나':'컴퓨터';
  const scopedChoices=practiceDistrictChoices(view?.choices??[],district);
  const visible=scopedChoices.filter(c=>c.action.type===filter);
  function openGuide(type:SpeakeasyPracticeAction['type']) {
    if(!view||pending.current)return;
    setDistrict(null);setSelected(null);setEndConfirm(false);
    if(type==='END_TURN')setEndConfirm(true);
    else {
      setFilter(type);
      const choices=view.choices.filter(c=>c.action.type===type);
      if(choices.length===1)setSelected(choices[0]!);
    }
    audio.play('SELECT');actionPanel.current?.scrollIntoView({block:'start'});actionPanel.current?.focus({preventScroll:true});
  }
  return <main className="sp-root sp-practice" onPointerDown={()=>void audio.unlock()} onKeyDown={e=>{void audio.unlock();if(e.key==='Escape'){setSelected(null);setEndConfirm(false);setExitConfirm(false);audio.play('CANCEL');}}}>
    <header className="sp-header"><button type="button" onClick={()=>view&&!view.finished?setExitConfirm(true):onExit()}>← 나가기</button><div className="sp-wordmark">SPEAKEASY<span>PRACTICE TABLE</span></div><span className="sp-preview-tag">원작과 다른 연습 규칙</span></header>
    <section className="sp-practice-intro"><p className="sp-eyebrow">LEARN BY PLAYING</p><h1>{view?'당신의 밤을 경영하세요':'첫 사업을 시작하세요'}</h1><p>컴퓨터 패밀리와 11턴 · 건설, 생산, 운송, 판매, 보호를 직접 선택하는 연습 대국</p>
      <details><summary>연습 규칙과 원작에서 생략한 요소</summary><ul>{SPEAKEASY_PRACTICE_RULES.map(rule=><li key={rule}>{rule}</li>)}</ul><p>공식 솔로 모드가 아닙니다. 서버 재시작 또는 이 화면을 나가면 대국이 종료됩니다.</p></details>
      <div className="sp-practice-audio"><label>효과음 <input type="range" min="0" max="100" value={audio.volume} onChange={e=>audio.setVolume(Number(e.target.value))}/></label><button type="button" onClick={()=>audio.setVolume(audio.volume?0:30)}>{audio.volume?'음소거':'소리 켜기'}</button>{!audio.available&&<span>소리를 사용할 수 없습니다.</span>}</div>
    </section>
    <p className="sp-practice-error" role="alert" ref={message}>{error}</p>
    {error&&view&&<button type="button" disabled={busy} onClick={()=>void retry()}>현재 상태 다시 확인</button>}
    {!view?<section className="sp-practice-start"><SpeakeasyBuildingArt kind="SPEAKEASY"/><h2>증류소 하나, 주점 하나.<br/>이제 첫 잔을 팔 차례입니다.</h2><p>생산 → 운송 → 판매 순서로 시작해 보세요. 행동을 고르면 적용 전에 비용과 결과를 확인할 수 있습니다.</p><button type="button" disabled={busy} onClick={()=>void start()}>{busy?'테이블 준비 중…':'연습 대국 시작'}</button></section>:<>
      <section className="sp-practice-status" aria-label="현재 진행"><strong>{view.finished?'최종 정산':`${view.turn} / 11턴`}</strong><span>남은 행동 {view.actionsLeft} / 2</span><span>현금 ${view.cash}</span><span>금고 ${view.safe}</span><span>저장 주류 {view.stock}</span><span>조직원 {view.family}</span></section>
      {view.finished&&<section ref={results} tabIndex={-1} className="sp-practice-results" aria-label="최종 결과"><p className="sp-eyebrow">THE NIGHT IS YOURS</p><h2>{view.scores.filter(s=>s.winner).length>1?'두 패밀리가 공동 승리했습니다':view.scores.find(s=>s.playerId===view.viewerId)?.winner?'당신의 패밀리가 승리했습니다':'컴퓨터 패밀리가 승리했습니다'}</h2><p>동점은 보호 건물 수, 전체 건물 수, 남은 조직원 수로 판정합니다. 끝까지 같으면 공동 승리입니다.</p>{view.scores.map(s=><div key={s.playerId}><strong>{own(s.playerId)} {s.winner?'· 승자':''}</strong><span>현금 ${s.cash} + 금고 ${s.safe} + 보호 건물 ${s.buildings}</span><b>${s.total}</b></div>)}<button type="button" disabled={busy} onClick={()=>void start()}>새 연습 대국</button></section>}
      <PracticeGuide view={view} busy={busy} onOpen={openGuide}/>
      <div className="sp-practice-layout"><section><div className="sp-board-heading"><div><p className="sp-eyebrow">YOUR TRAINING CITY</p><h2>밤의 도시</h2></div><span>연습용 격자 · 상하좌우 연결</span></div><p>청록은 나 · 보라는 컴퓨터 · 구역을 선택하면 가능한 행동을 모아 볼 수 있습니다.</p>
        <button type="button" className="sp-practice-jump" onClick={()=>{actionPanel.current?.scrollIntoView({block:'start'});actionPanel.current?.focus({preventScroll:true});}}>행동 선택으로 ↓</button><div ref={mapPanel} tabIndex={-1} className="sp-practice-map" role="group" aria-label="연습 지도">{view.districts.map(d=><button type="button" key={d.id} className={[selected?.preview.targets.some(t=>t.district===d.id)?'is-target':'',selected?.preview.route.includes(d.id)?'is-route':''].join(' ')} aria-pressed={district===d.id} aria-label={`${d.id}구역${selected?.preview.targets.some(t=>t.district===d.id)?' · 선택한 행동 대상':''}${selected?.preview.route.includes(d.id)?' · 이동 경로':''}${d.cop?' · 경찰':''} · ${d.slots.map((b,i)=>b?`${i+1}번 칸 ${own(b.ownerId)} ${SPEAKEASY_BUILDING_LABELS[b.kind]}${b.protected?' 보호됨':''}${b.barrel?' 주류 있음':''}${b.operating?'':' 영업 중단'}`:`${i+1}번 빈칸`).join(', ')}`} onKeyDown={event=>{
          const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:event.key==='ArrowDown'?4:event.key==='ArrowUp'?-4:0;
          if(!delta)return;event.preventDefault();const next=d.id+delta;
          if(next<1||next>16||(delta===1&&d.id%4===0)||(delta===-1&&d.id%4===1))return;
          event.currentTarget.parentElement?.querySelectorAll('button')[next-1]?.focus();
        }} onClick={()=>{const next=district===d.id?null:d.id;setDistrict(next);if(next!==null)setFilter(practiceDistrictFilter(view.choices,next,filter));setSelected(null);setEndConfirm(false);audio.play('SELECT');if(window.matchMedia('(max-width: 760px)').matches){actionPanel.current?.scrollIntoView({block:'start'});actionPanel.current?.focus({preventScroll:true});}}}><span className="sp-practice-district-number">{d.id.toString().padStart(2,'0')}{d.cop&&<SpeakeasyToken kind="COP"/>}</span>{selected?.preview.route.includes(d.id)&&<span className="sp-practice-route-marker">경로 {selected.preview.route.flatMap((n,i)=>n===d.id?[i+1]:[]).join('·')}</span>}{selected?.preview.targets.some(t=>t.district===d.id)&&<span className="sp-practice-target-label">행동 대상</span>}<span className="sp-practice-lots">{d.slots.map((b,i)=><span key={i} className={`${b?`sp-owner-${b.ownerId===view.viewerId?0:2} ${b.operating?'':'is-closed'}`:'is-empty'} ${selected?.preview.targets.some(t=>t.district===d.id&&t.slot===i)?'is-target-lot':''}`}>{b?<><SpeakeasyBuildingArt kind={b.kind}/><small>{own(b.ownerId)} · {SPEAKEASY_BUILDING_LABELS[b.kind]}</small><span>{b.protected&&<SpeakeasyToken kind="FAMILY"/>}{b.barrel&&<SpeakeasyToken kind="BARREL"/>}</span>{!b.operating&&<small>영업 중단</small>}</>:<small>+ 빈칸</small>}</span>)}</span>{view.truck.district===d.id&&<span className="sp-practice-truck"><SpeakeasyToken kind="TRUCK"/> 내 트럭 {view.truck.load}/2</span>}</button>)}</div>
        {selected&&<p className="sp-practice-route-summary">{selected.preview.route.length?`이동 순서: ${view.truck.district===null?'지도 진입 → ':''}${selected.preview.route.map(n=>`${n}구역`).join(' → ')}`:'금색 테두리가 선택한 행동의 대상입니다.'}</p>}
        <p className="sp-rule-note">경찰 예정: 4턴 뒤 4구역 · 7턴 뒤 8구역 · 10턴 뒤 12구역</p>
      </section><aside ref={actionPanel} className="sp-practice-actions" tabIndex={-1} aria-label="행동 선택"><p className="sp-eyebrow">YOUR NEXT MOVE</p><h2>{view.finished?'대국 종료':view.actionsLeft?'다음 행동':'턴을 마칠 시간입니다'}</h2>
        {view.feedback&&<section className="sp-practice-feedback" role="status" aria-live="polite" aria-atomic="true"><p className="sp-eyebrow">방금 일어난 일</p><h3>{view.feedback.title}</h3><ResourceChanges delta={view.feedback.delta}/><ul>{view.feedback.events.map((event,i)=><li key={i}>{event}</li>)}</ul></section>}
        <p className="sp-practice-scope">{district===null?'도시 전체에서 가능한 행동':`${district}구역에서 가능한 행동`} · 숫자는 선택지 개수입니다.</p>
        <nav aria-label="행동 종류">{(['PRODUCE','DELIVER','SELL','BUILD','PROTECT','MOVE'] as const).map(type=><button type="button" key={type} aria-pressed={filter===type} onClick={()=>{setFilter(type);setSelected(null);setEndConfirm(false);audio.play('SELECT');}}>{labels[type]} <small>{scopedChoices.filter(c=>c.action.type===type).length}</small></button>)}</nav>
        {district!==null&&<button type="button" className="sp-practice-filter" onClick={()=>{setDistrict(null);setSelected(null);setEndConfirm(false);audio.play('SELECT');}}>{district}구역 선택 해제 · 전체 보기</button>}
        <div className="sp-practice-options">{visible.map((choice,i)=><button type="button" key={`${view.revision}-${i}`} disabled={busy} aria-pressed={selected===choice} onClick={()=>choose(choice)}><strong>{choice.label}</strong><small>{choice.detail}</small></button>)}{!visible.length&&<p>{view.finished?'최종 결과를 확인하세요.':view.actionsLeft===0?'이번 턴의 행동을 모두 사용했습니다. 턴을 마치면 컴퓨터가 행동합니다.':district!==null&&view.choices.some(c=>c.action.type===filter)?'이 구역에서는 선택할 수 없습니다. 구역 선택을 해제하면 다른 곳의 가능한 행동을 볼 수 있습니다.':filter==='MOVE'?'현재 위치에서 이동 3칸 이내의 다른 구역을 선택하세요.':filter==='DELIVER'?'배달할 빈 주점과 주류가 필요합니다. 증류소에서 주류를 생산하고 3칸 이내의 건물에 배달하세요.':filter==='SELL'?'주류가 배달된 영업 건물이 필요합니다.':filter==='PROTECT'?'남은 조직원과 보호되지 않은 내 건물이 필요합니다.':filter==='BUILD'?'선택한 구역의 빈칸과 건설 비용이 필요합니다. 나이트클럽은 각 구역권에 하나만 지을 수 있습니다.':'생산 가능한 영업 증류소가 필요합니다.'}</p>}</div>
        {selected&&<section className="sp-practice-confirm" aria-live="polite"><h3>{selected.label}</h3><p>{selected.detail}</p><ResourceChanges delta={selected.preview.delta}/><button type="button" className="sp-practice-map-link" onClick={()=>{mapPanel.current?.scrollIntoView({block:'start'});mapPanel.current?.focus({preventScroll:true});}}>지도에서 {selected.preview.route.length?'경로와 대상':'대상'} 보기</button><p>행동 1회 사용 · 확정 후 취소할 수 없습니다.</p><button type="button" disabled={busy} onClick={()=>void submit(selected.action)}>{busy?'처리 중…':'이 행동 확정'}</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);audio.play('CANCEL');}}>취소</button></section>}
        {!view.finished&&<div className="sp-practice-end">{endConfirm?<><p>{view.actionsLeft?`남은 행동 ${view.actionsLeft}회를 사용하지 않고 턴을 마칠까요?`:'컴퓨터가 행동한 뒤 다음 턴으로 이어집니다.'}</p><button type="button" disabled={busy} onClick={()=>void submit({type:'END_TURN'})}>{view.actionsLeft?'남은 행동 건너뛰고 턴 종료':'턴 종료 확정'}</button><button type="button" onClick={()=>setEndConfirm(false)}>돌아가기</button></>:<button type="button" disabled={busy} onClick={()=>view.actionsLeft?setEndConfirm(true):void submit({type:'END_TURN'})}>{busy?'서버 처리 중…':'턴 마치기 → 컴퓨터 차례'}</button>}</div>}
      </aside></div>
      <section className="sp-practice-log" aria-label="진행 기록"><h2>오늘 밤의 기록</h2><ol>{view.log.slice(-12).reverse().map((entry,i)=><li key={`${view.revision}-${i}`}>{entry}</li>)}</ol></section>
    </>}
    {exitConfirm&&<div className="sp-practice-overlay"><section role="dialog" aria-modal="true" aria-label="연습 대국 나가기" onKeyDown={event=>{
      if(event.key!=='Tab')return;const buttons=event.currentTarget.querySelectorAll('button');
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1]?.focus();}
      else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0]?.focus();}
    }}><h2>진행 중인 연습을 끝낼까요?</h2><p>나가면 현재 대국은 종료됩니다.</p><button type="button" autoFocus onClick={()=>setExitConfirm(false)}>계속 플레이</button><button type="button" onClick={onExit}>대국 종료하고 나가기</button></section></div>}
  </main>;
}
