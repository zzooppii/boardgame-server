import type {CSSProperties} from 'react';
import {ARK_CARDS} from '@hangul-rummikub/shared';

// Measured row boundaries keep adjacent illustrations out of each crop.
const atlasRows=[[0,256,512,768,1024],[0,245,492,748,1024],[0,250,495,742,1024],[0,245,495,738,1024],[0,256,512,768,1024],[0,255,508,750,1024],[0,255,512,768,1024],[0,256,512,768,1024]] as const;

/** Each base animal has its own cell; never substitute a different species. */
export function arkAnimalArt(key:string):CSSProperties|undefined {
  const card=ARK_CARDS.find(c=>c.key===key&&c.kind==='ANIMAL');
  if(!card)return undefined;
  const index=card.key==='487'?87:card.key==='488'?86:Number(card.key)-401;
  if(!Number.isInteger(index)||index<0||index>=128)return undefined;
  const sheet=Math.floor(index/16),row=Math.floor(index%16/4),bounds=atlasRows[sheet]!;
  const centerY=(bounds[row]!+bounds[row+1]!)/2048,centerX=(index%4+.5)/4,scale=4.24;
  return {backgroundImage:`url('/images/ark-nova/animals/species-${Math.floor(index/16)+1}.png')`,backgroundSize:'424% 424%',backgroundPosition:`${(centerX*scale-.5)/(scale-1)*100}% ${(centerY*scale-.5)/(scale-1)*100}%`};
}
export function ArkAnimalArt({cardKey}:{cardKey:string}) {
  const card=ARK_CARDS.find(c=>c.key===cardKey),style=arkAnimalArt(cardKey);
  return <div role="img" aria-label={style?`${card?.name} 일러스트`:'동물원 풍경'} className={`ark-family-art ${style?'ark-species-art':'ark-sponsor-art'}`} style={style}><span aria-hidden="true">{style?'WILDLIFE':'ZOO PARTNERS'}</span></div>;
}
