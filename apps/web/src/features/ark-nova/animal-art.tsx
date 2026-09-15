import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {loadArkArt} from './art-loading.js';
import {ARK_CARDS} from '@hangul-rummikub/shared';

// Measured row boundaries keep adjacent illustrations out of each crop.
const atlasRows=[[0,256,512,768,1024],[0,245,492,748,1024],[0,250,495,742,1024],[0,245,495,738,1024],[0,256,512,768,1024],[0,255,508,750,1024],[0,255,512,768,1024],[0,256,512,768,1024]] as const;

/** Each base animal has its own cell; never substitute a different species. */
export function arkAnimalArt(key:string):CSSProperties|undefined {
  const card=ARK_CARDS.find(c=>c.key===key&&c.kind==='ANIMAL');
  if(!card)return undefined;
  if(key==='516'||key==='518')return {backgroundImage:`url('/images/ark-nova/animals/${key}-v2.webp')`,backgroundSize:'100% 100%',backgroundPosition:'center'};
  const index=card.key==='487'?87:card.key==='488'?86:Number(card.key)-401;
  if(!Number.isInteger(index)||index<0||index>=128)return undefined;
  const sheet=Math.floor(index/16),row=Math.floor(index%16/4),bounds=atlasRows[sheet]!;
  // Keep all but two source pixels at each edge: prevents atlas bleed without the old 6% zoom crop.
  const left=index%4*384+2,top=bounds[row]!+2,width=380,height=bounds[row+1]!-bounds[row]!-4;
  return {backgroundImage:`url('/images/ark-nova/animals/species-${sheet+1}.webp')`,backgroundSize:`${1536/width*100}% ${1024/height*100}%`,backgroundPosition:`${left/(1536-width)*100}% ${top/(1024-height)*100}%`};
}
export function ArkAnimalArt({cardKey,eager=false}:{cardKey:string;eager?:boolean}) {
  const card=ARK_CARDS.find(c=>c.key===cardKey),style=arkAnimalArt(cardKey);
  const url=style?String(style.backgroundImage).slice(5,-2):'/images/ark-nova/zoo-landscape.png';
  const element=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState<{url:string;state:'loading'|'ready'|'error'}|null>(null);
  const state=status?.url===url?status.state:'loading';
  useEffect(()=>{
    let active=true;
    const start=()=>{loadArkArt(url).then(()=>{if(active)setStatus({url,state:'ready'});},()=>{if(active)setStatus({url,state:'error'});});};
    if(eager||typeof IntersectionObserver==='undefined'){start();return()=>{active=false;};}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'200px'});
    if(element.current)observer.observe(element.current);
    return()=>{active=false;observer.disconnect();};
  },[url,eager]);
  return <div ref={element} role="img" aria-label={style?`${card?.name} 일러스트`:'동물원 풍경'} aria-busy={state==='loading'} data-art-state={state} className={`ark-family-art ${style?'ark-species-art':'ark-sponsor-art'} ${state!=='ready'?'ark-art-placeholder':''}`} style={state==='ready'?style:{backgroundImage:'none'}}>{state!=='ready'&&<small className="ark-art-status">{state==='error'?'그림을 불러오지 못했습니다':'그림 준비 중'}</small>}<span aria-hidden="true">{style?'WILDLIFE':'ZOO PARTNERS'}</span></div>;
}
