export function CommandNotice({error,uncertain,busy,connected,onRetry}:{error:string|null;uncertain:boolean;busy:boolean;connected:boolean;onRetry:(()=>void)|null}){
 if(!error&&!uncertain)return null;
 return <div role="alert" className="tm-alert tm-command-notice">{error??'처리 결과를 아직 확인하지 못했습니다.'}{uncertain&&onRetry&&<button disabled={busy||!connected} onClick={onRetry}>같은 요청으로 결과 확인</button>}</div>;
}
