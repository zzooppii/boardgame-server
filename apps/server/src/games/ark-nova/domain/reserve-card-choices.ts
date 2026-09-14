import * as v from 'valibot';
import { ARK_GOALS, ARK_PROJECTS, ArkCardSchema, ArkRefSchema, type ArkCard } from '@hangul-rummikub/shared';
export const ArkGoalRevealSchema=v.pipe(v.strictObject({choiceId:ArkRefSchema,candidates:v.pipe(v.array(ArkCardSchema),v.length(2))}),
  v.check(s=>new Set(s.candidates.map(c=>c.cardId)).size===2&&s.candidates.every(c=>c.key!=='009'&&ARK_GOALS.some(g=>g.key===c.key))));
export type ArkGoalReveal=v.InferOutput<typeof ArkGoalRevealSchema>;
export type ArkGoalZones={goalDeck:ArkCard[];goals:ArkCard[];discardedGoals:ArkCard[];goalReveal:ArkGoalReveal|null};
/** Resistance uses a separate goal-card zone, never the zoo deck or zoo discard. */
export function beginArkResistance<T extends ArkGoalZones>(current:T,choiceId:string):{ok:true;state:T}|{ok:false} {
  if(current.goalReveal||!v.safeParse(ArkRefSchema,choiceId).success)return {ok:false};
  const s=structuredClone(current),candidates:ArkCard[]=[];
  while(candidates.length<2) {
    const card=s.goalDeck.shift();if(!card)return {ok:false};
    if(card.key==='009')s.discardedGoals.push(card);else candidates.push(card);
  }
  s.goalReveal=v.parse(ArkGoalRevealSchema,{choiceId,candidates});return {ok:true,state:s};
}
const GoalSelection=v.strictObject({choiceId:ArkRefSchema,keep:ArkRefSchema});
export function resolveArkResistance<T extends ArkGoalZones>(current:T,input:unknown):{ok:true;state:T}|{ok:false} {
  const selected=v.safeParse(GoalSelection,input);
  if(!selected.success||!current.goalReveal)return {ok:false};
  const reveal=v.parse(ArkGoalRevealSchema,current.goalReveal);
  if(selected.output.choiceId!==reveal.choiceId||!reveal.candidates.some(c=>c.cardId===selected.output.keep))return {ok:false};
  const s=structuredClone(current);
  s.goals.push(...reveal.candidates.filter(c=>c.cardId===selected.output.keep));
  s.discardedGoals.push(...reveal.candidates.filter(c=>c.cardId!==selected.output.keep));
  s.goalReveal=null;return {ok:true,state:s};
}
const ProjectSelection=v.strictObject({cardId:v.nullable(ArkRefSchema)});
/** An acquired base card remains a base inventory instance even while it is held in the private hand. */
export function takeArkReserveProject<T extends {baseProjectReserve:ArkCard[];hand:ArkCard[]}>(current:T,kind:'ASSERTION'|'DOMINANCE',input:unknown):{ok:true;state:T}|{ok:false} {
  const selection=v.safeParse(ProjectSelection,input);if(!selection.success)return {ok:false};
  const id=selection.output.cardId,s=structuredClone(current);
  if(id===null)return {ok:true,state:s};
  const index=s.baseProjectReserve.findIndex(c=>c.cardId===id),card=s.baseProjectReserve[index];
  if(!card||!ARK_PROJECTS.some(p=>p.key===card.key&&p.kind==='BASE'&&(kind==='ASSERTION'||p.tag==='Primate')))return {ok:false};
  s.hand.push(...s.baseProjectReserve.splice(index,1));return {ok:true,state:s};
}
