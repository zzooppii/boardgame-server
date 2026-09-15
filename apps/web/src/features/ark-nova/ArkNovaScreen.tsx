import {RealtimeClientError} from "../../lib/realtime-client.js";
import {useEffect,useRef,useState} from 'react';
import {PROTOCOL_VERSION,type ArkNovaActCommand,type ArkNovaLobbyPlatformSnapshotV2,type ArkNovaPlayingPlatformSnapshotV2,type ArkNovaFinishedPlatformSnapshotV2,type ArkSoloCommand} from '@hangul-rummikub/shared';
import {getGameStartControl} from '../../lib/game-start.js';
import {createRequestId} from '../../lib/request-id.js';
import {ArkNovaCommandRejected} from '../../lib/ark-nova-command-error.js';
import {ArkNovaMultiplayer} from './ArkNovaMultiplayer.js';
import {ArkNovaMultiplayerContext} from './ArkNovaMode.js';
import {ArkNovaTable} from './ArkNovaTable.js';
import {ArkAudio,readArkSoundPreferences,saveArkSoundPreferences,type ArkCue} from './sound.js';
import './ark-nova.css';
function soundStorage():Storage|undefined {
  try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined; /* Optional browser preferences. */}
}
export type ArkNovaScreenProps={snapshot:ArkNovaLobbyPlatformSnapshotV2|ArkNovaPlayingPlatformSnapshotV2|ArkNovaFinishedPlatformSnapshotV2;connected:boolean;pending:boolean;error:string|null;connectionLabel:string;onStart():void;onLeave():void;onRematch():void;onCommand(command:ArkNovaActCommand):Promise<void>};
export function ArkNovaScreen(props:ArkNovaScreenProps) {
  const {snapshot:s}=props,start=getGameStartControl(s,props.pending||!props.connected);
  return <section className="ark-live-screen" aria-label="아크노바"><header className="ark-live-header"><div><small>ARK NOVA · {s.room.players.length===1?'SOLO':`${s.room.players.length} PLAYERS`}</small><h1>나의 동물원</h1></div><div><span role="status">{props.connectionLabel}</span><button disabled={props.pending} onClick={props.onLeave}>나가기</button></div></header>
    {props.error&&<p className="ark-live-error" role="alert">{props.error}</p>}
    {s.game===null?<div className="ark-live-lobby"><div className="ark-live-lobby-art"/><h2>작은 동물원에서 시작하는 보전 이야기</h2><p>전체 기본판 · 지도 A · 1인 솔로 또는 2–4인 대국</p><p>방 코드 <strong>{s.room.roomCode}</strong> · {s.room.players.map(p=>p.nickname).join(", ")}</p><p>혼자 시작하면 매력 20의 솔로 27턴, 함께 시작하면 공용 휴식 트랙과 점수 교차로 게임이 진행됩니다.</p><p>{start.guidance}</p><button disabled={!start.canStart} onClick={props.onStart}>동물원 시작</button></div>:<LiveGame key={s.game.gameId} {...props} game={s.game}/>}
  </section>;
}
function LiveGame({game, ...props}:ArkNovaScreenProps&{game:NonNullable<ArkNovaScreenProps['snapshot']['game']>}) {
  const [flight,setFlight]=useState(false),[retry,setRetry]=useState<ArkNovaActCommand|null>(null),[message,setMessage]=useState<string|null>(null);
  const busy=useRef(false),mounted=useRef(true),audio=useRef<ArkAudio|null>(null);
  const [sound,setSound]=useState(()=>readArkSoundPreferences(soundStorage()));
  useEffect(()=>{mounted.current=true;audio.current=new ArkAudio();return()=>{mounted.current=false;audio.current?.dispose();};},[]);
  useEffect(()=>{audio.current?.setPreferences(sound);saveArkSoundPreferences(sound,soundStorage());},[sound]);
  function cue(kind:ArkCue){if(document.visibilityState!=='hidden')audio.current?.play(kind);}
  useEffect(()=>{const hidden=()=>{if(document.visibilityState==='hidden')audio.current?.stop();};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
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
  return <div onPointerDownCapture={()=>audio.current?.unlock()} onKeyDownCapture={()=>audio.current?.unlock()}><div className="ark-live-audio"><label><input type="checkbox" checked={sound.enabled} onChange={e=>{const next={...sound,enabled:e.target.checked};audio.current?.setPreferences(next);audio.current?.unlock();setSound(next);}}/> 효과음</label><input aria-label="효과음 음량" type="range" min="0" max="1" step="0.05" value={sound.volume} onChange={e=>{const next={...sound,volume:Number(e.target.value)};audio.current?.setPreferences(next);setSound(next);}}/><span>{Math.round(sound.volume*100)}%</span><details><summary>효과음 미리 듣기</summary>{(['PLACE','ARRIVAL','CONSERVATION'] as const).map((kind,i)=><button type="button" key={kind} disabled={!sound.enabled||sound.volume===0} onClick={()=>cue(kind)}>{['건설','동물 입주','보전 달성'][i]}</button>)}</details></div>
    {message&&<p className="ark-live-error" role="alert">{message}</p>}{retry&&<div className="ark-live-error"><p>요청의 처리 결과를 확인해야 합니다. 같은 요청으로 다시 확인하세요.</p><button disabled={flight||!props.connected} onClick={()=>void execute(retry)}>처리 결과 다시 확인</button></div>}
    <ArkNovaMultiplayer state={game.state} players={props.snapshot.room.players} disabled={props.pending||flight||!!retry||!props.connected} onCommand={send}/>
    <ArkNovaMultiplayerContext.Provider value={!!game.state.table}><ArkNovaTable state={game.state} disabled={props.pending||flight||!!retry||!props.connected||!!game.state.table&&(game.state.table.stage==='SETUP'?game.state.table.readyPlayerIds.includes(game.state.playerId):game.state.table.activePlayerId!==game.state.playerId||['GOAL_DISCARD','INTERACTION','FINAL_SCORING'].includes(game.state.table.stage))} onCommand={send} onCue={cue} onRematch={props.onRematch}/></ArkNovaMultiplayerContext.Provider>
  </div>;
}
