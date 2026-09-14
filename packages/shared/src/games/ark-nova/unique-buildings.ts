import type { ArkCell } from './actions.js';
/** Front-face outlines transcribed from the printed base sponsor cards 243–257; rotation only. */
export const ARK_UNIQUE_BUILDINGS:Readonly<Record<string,readonly ArkCell[]>>={
  '243':[{q:0,r:0},{q:1,r:-1},{q:2,r:-1}],
  '244':[{q:0,r:0},{q:1,r:0},{q:2,r:-1},{q:2,r:0}],
  '245':[{q:0,r:0},{q:1,r:-1},{q:2,r:-1},{q:2,r:0}],
  '246':[{q:0,r:0},{q:1,r:-1},{q:2,r:-2},{q:3,r:-3}],
  '247':[{q:0,r:0},{q:1,r:0},{q:2,r:0},{q:2,r:1}],
  '248':[{q:0,r:0},{q:1,r:-1},{q:2,r:-1},{q:3,r:-1}],
  '249':[{q:0,r:0},{q:1,r:0},{q:2,r:0}],
  '250':[{q:0,r:0},{q:1,r:0},{q:2,r:-1},{q:1,r:1}],
  '251':[{q:0,r:0},{q:1,r:-1},{q:2,r:-1},{q:3,r:-2}],
  '252':[{q:0,r:0},{q:1,r:0},{q:2,r:-1},{q:3,r:-2}],
  '253':[{q:0,r:0},{q:1,r:0},{q:2,r:-1},{q:3,r:-1}],
  '254':[{q:0,r:0},{q:1,r:0},{q:2,r:-1}],
  '255':[{q:0,r:0},{q:1,r:0}],
  '256':[{q:0,r:0},{q:1,r:0}],
  '257':[{q:0,r:0},{q:1,r:0}],
};
export function arkUniqueShape(key:string,anchor:ArkCell,rotation:number):ArkCell[] {
  const shape=Object.hasOwn(ARK_UNIQUE_BUILDINGS,key)?ARK_UNIQUE_BUILDINGS[key]:undefined;
  if (!shape||!Number.isInteger(rotation)||rotation<0||rotation>5) return [];
  return shape.map(c=>{let {q,r}=c;for(let i=0;i<rotation;i++){const next=-r;r=q+r;q=next;}return {q:q+anchor.q,r:r+anchor.r};});
}
