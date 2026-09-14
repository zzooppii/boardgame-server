import {ARK_CARDS, type ArkSoloView} from '@hangul-rummikub/shared';
export type ArkFeedback=Readonly<{revision:number;built:readonly string[];arrivals:readonly string[];animals:readonly string[];conservation:number}>;
/** Presentation-only comparison of consecutive authoritative snapshots. Reconnects do not celebrate old moves. */
export function arkFeedback(previous:ArkSoloView,next:ArkSoloView):ArkFeedback|null {
  if(next.revision!==previous.revision+1||previous.progress.stage==='SETUP')return null;
  const built=next.buildings.filter(b=>!previous.buildings.some(old=>old.id===b.id)).map(b=>b.id);
  const animals=next.played.filter(c=>!previous.played.some(old=>old.cardId===c.cardId)&&ARK_CARDS.some(d=>d.key===c.key&&d.kind==='ANIMAL')).map(c=>c.key);
  const arrivals=animals.length?next.buildings.filter(b=>{const old=previous.buildings.find(o=>o.id===b.id);return b.occupied&&!old?.occupied||b.used>(old?.used??0);}).map(b=>b.id):[];
  const conservation=Math.max(0,next.conservation-previous.conservation);
  return built.length||animals.length||conservation?{revision:next.revision,built,arrivals,animals,conservation}:null;
}
