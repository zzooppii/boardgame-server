import type {CSSProperties} from 'react';
export function arkTerrainStyle(prefix:string):CSSProperties & Record<`--ark-${string}`,string> {
  return {'--ark-grass':`url(#${prefix}-grass)`,'--ark-earth':`url(#${prefix}-earth)`,'--ark-water':`url(#${prefix}-water)`,'--ark-rock':`url(#${prefix}-rock)`};
}
/** Painted textures are separate from the authoritative hex geometry and hit targets. */
export function BoardIllustrationDefs({prefix}:{prefix:string}) {
  const atlas='/images/ark-nova/terrain-atlas-v1.png';
  return <defs>
    <pattern id={`${prefix}-grass`} width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" fill="#80a856"/><image href={atlas} width="360" height="360"/></pattern>
    <pattern id={`${prefix}-earth`} width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" fill="#d9bb7d"/><image href={atlas} x="-180" width="360" height="360"/></pattern>
    <pattern id={`${prefix}-water`} width="1" height="1" viewBox="0 0 1 1" patternContentUnits="objectBoundingBox"><rect width="1" height="1" fill="#409fc3"/><image href={atlas} y="-1" width="2" height="2"/></pattern>
    <pattern id={`${prefix}-rock`} width="1" height="1" viewBox="0 0 1 1" patternContentUnits="objectBoundingBox"><rect width="1" height="1" fill="#91959c"/><image href={atlas} x="-1" y="-1" width="2" height="2"/></pattern>
  </defs>;
}
export function BoardBonus({x,y,label,restricted=false}:{x:number;y:number;label:string;restricted?:boolean}) {
  return <g className={`ark-board-bonus ${restricted?'is-restricted':''}`} transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true">
    <path d="M0-14 14-4 9 13H-9L-14-4Z"/>
    <text y="5">{label}</text>
  </g>;
}
