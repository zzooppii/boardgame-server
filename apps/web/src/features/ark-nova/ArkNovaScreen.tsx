import {RealtimeClientError} from "../../lib/realtime-client.js";
import {useEffect,useRef,useState} from 'react';
import {PROTOCOL_VERSION,type ArkNovaActCommand,type ArkNovaLobbyPlatformSnapshotV2,type ArkNovaPlayingPlatformSnapshotV2,type ArkNovaFinishedPlatformSnapshotV2,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {getGameStartControl} from '../../lib/game-start.js';
import {createRequestId} from '../../lib/request-id.js';
import {ArkNovaCommandRejected} from '../../lib/ark-nova-command-error.js';
import {ArkNovaTable} from './ArkNovaTable.js';
import {ArkAudio,readArkSoundPreferences,saveArkSoundPreferences,type ArkCue} from './sound.js';
import './ark-nova.css';
function soundStorage():Storage|undefined {
  try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined; /* Optional browser preferences. */}
}
export type ArkNovaScreenProps={snapshot:ArkNovaLobbyPlatformSnapshotV2|ArkNovaPlayingPlatformSnapshotV2|ArkNovaFinishedPlatformSnapshotV2;connected:boolean;pending:boolean;error:string|null;connectionLabel:string;onStart():void;onLeave():void;onRematch():void;onCommand(command:ArkNovaActCommand):Promise<void>};
export function ArkNovaScreen(props:ArkNovaScreenProps) {
  const {snapshot:s}=props,start=getGameStartControl(s,props.pending||!props.connected);
  return <section className="ark-live-screen" aria-label="아크노바 솔로"><header className="ark-live-header"><div><small>ARK NOVA · SOLO</small><h1>나의 동물원</h1></div><div><span role="status">{props.connectionLabel}</span><button disabled={props.pending} onClick={props.onLeave}>나가기</button></div></header>
    {props.error&&<p className="ark-live-error" role="alert">{props.error}</p>}
    {s.game===null?<div className="ark-live-lobby"><div className="ark-live-lobby-art"/><h2>작은 동물원에서 시작하는 보전 이야기</h2><p>전체 기본판 · 지도 A · 공식 솔로 6라운드, 총 27턴</p><p>기본 난도에서 매력 20으로 시작합니다. 휴식마다 자원을 정리하고 마지막에 목표와 후원자를 정산합니다.</p><p>{start.guidance}</p><button disabled={!start.canStart} onClick={props.onStart}>솔로 동물원 시작</button></div>:<LiveGame key={s.game.gameId} {...props} game={s.game}/>}
  </section>;
}
function LiveGame({game, ...props}:ArkNovaScreenProps&{game:NonNullable<ArkNovaScreenProps['snapshot']['game']>}) {
  const [flight,setFlight]=useState(false),[retry,setRetry]=useState<ArkNovaActCommand|null>(null),[message,setMessage]=useState<string|null>(null);
  const busy=useRef(false),mounted=useRef(true),audio=useRef<ArkAudio|null>(null);
  const [sound,setSound]=useState(()=>readArkSoundPreferences(soundStorage()));
  useEffect(()=>{mounted.current=true;audio.current=new ArkAudio();return()=>{mounted.current=false;audio.current?.dispose();};},[]);
  useEffect(()=>{audio.current?.setPreferences(sound);saveArkSoundPreferences(sound,soundStorage());},[sound]);
  function cue(kind:ArkCue){audio.current?.play(kind);}
  async function execute(command:ArkNovaActCommand) {
    if(busy.current||!props.connected)return;
    busy.current=true;setFlight(true);setMessage(null);
    try {await props.onCommand(command);if(mounted.current){setRetry(null);}}
    catch(error:unknown){if(mounted.current){const invalid=error instanceof RealtimeClientError&&error.code==='INVALID_COMMAND';setRetry(error instanceof ArkNovaCommandRejected||invalid?null:command);setMessage(invalid?'선택한 입력을 확인하고 다시 시도해주세요.':error instanceof Error?error.message:'요청 결과를 확인하지 못했습니다.');cue('ERROR');}}
    finally{busy.current=false;if(mounted.current)setFlight(false);}
  }
  function send(payload:ArkSoloCommand) {
    if(busy.current||retry||props.pending||!props.connected)return;
    void execute({kind:'arkNova:act',protocolVersion:PROTOCOL_VERSION,requestId:createRequestId(),gameId:game.gameId,expectedGameRevision:game.gameRevision,turnId:game.state.transitionId,payload});
  }
  return <><div className="ark-live-audio"><label><input type="checkbox" checked={sound.enabled} onChange={e=>{const next={...sound,enabled:e.target.checked};audio.current?.setPreferences(next);audio.current?.unlock();setSound(next);}}/> 효과음</label><input aria-label="효과음 음량" type="range" min="0" max="1" step="0.05" value={sound.volume} onChange={e=>setSound({...sound,volume:Number(e.target.value)})}/></div>
    {message&&<p className="ark-live-error" role="alert">{message}</p>}{retry&&<div className="ark-live-error"><p>요청의 처리 결과를 확인해야 합니다. 같은 요청으로 다시 확인하세요.</p><button disabled={flight||!props.connected} onClick={()=>void execute(retry)}>처리 결과 다시 확인</button></div>}
    <ArkNovaTable state={game.state} disabled={props.pending||flight||!!retry||!props.connected} onCommand={send} onCue={cue}/>
    {game.phase==='FINISHED'&&<button className="ark-live-rematch" disabled={props.pending||flight||!!retry||!props.connected} onClick={props.onRematch}>새 동물원 준비</button>}
  </>;
}
