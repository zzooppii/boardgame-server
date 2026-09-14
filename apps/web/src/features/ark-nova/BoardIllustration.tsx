/** Painted textures are separate from the authoritative hex geometry and hit targets. */
export function BoardIllustrationDefs() {
  const atlas='/images/ark-nova/terrain-atlas-v1.png';
  return <defs>
    <pattern id="ark-painted-grass" width="180" height="180" patternUnits="userSpaceOnUse"><image href={atlas} width="360" height="360"/></pattern>
    <pattern id="ark-painted-earth" width="180" height="180" patternUnits="userSpaceOnUse"><image href={atlas} x="-180" width="360" height="360"/></pattern>
    <pattern id="ark-painted-water" width="1" height="1" viewBox="0 0 1 1" patternContentUnits="objectBoundingBox"><image href={atlas} y="-1" width="2" height="2"/></pattern>
    <pattern id="ark-painted-rock" width="1" height="1" viewBox="0 0 1 1" patternContentUnits="objectBoundingBox"><image href={atlas} x="-1" y="-1" width="2" height="2"/></pattern>
  </defs>;
}
export function BoardBonus({x,y,label,restricted=false}:{x:number;y:number;label:string;restricted?:boolean}) {
  return <g className={`ark-board-bonus ${restricted?'is-restricted':''}`} transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true">
    <path d="M0-14 14-4 9 13H-9L-14-4Z"/>
    <text y="5">{label}</text>
  </g>;
}
