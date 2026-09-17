import * as v from 'valibot';
import {PlayerIdSchema, TileIdSchema, SpeakeasySetupCommandSchema, type PlayerId, type TileId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow, type SpeakeasyGameFlow} from './game-flow.js';
import {buildSpeakeasy} from './economy.js';
import {cityTileInventory, cityTileDefinitions, type SpeakeasyCityTiles} from './city-tiles.js';
import {speakeasyInventory, ruleFailure, type SpeakeasyEconomy, type SpeakeasyRuleResult} from './model.js';

const State = v.strictObject({flow:v.unknown(), dockPlayers:v.array(PlayerIdSchema),
  openings:v.array(v.strictObject({playerId:PlayerIdSchema,pieceId:TileIdSchema,cardId:v.nullable(TileIdSchema)}))});
export type SpeakeasyPlayerSetup = Omit<v.InferOutput<typeof State>,'flow'> & {flow:SpeakeasyGameFlow};
export type SpeakeasySetupStep = {stage:'DOCK'|'BUILD'|'OPERATION';actorId:PlayerId}|{stage:'READY';actorId:null};
export type SpeakeasySetupEffectState = {economy:SpeakeasyEconomy;city:SpeakeasyCityTiles;decks:SpeakeasyGameFlow['round']['decks']};
/** A fully resolved server benefit, including any required choices. No printed values are invented here. */
export type SpeakeasySetupBenefit = (s:SpeakeasySetupEffectState,actor:PlayerId)=>SpeakeasyRuleResult<SpeakeasySetupEffectState>;
export type SpeakeasySetupCatalog = Readonly<{
  docks:readonly {zone:0|1|2;space:number;benefit:SpeakeasySetupBenefit}[];
  buildings:ReadonlyMap<TileId,SpeakeasySetupBenefit>;
  operationBenefits:ReadonlyMap<TileId,SpeakeasySetupBenefit>;
}>;

export function speakeasySetupStep(s:SpeakeasyPlayerSetup):SpeakeasySetupStep {
  const reverse=[...s.flow.round.clock.order].reverse();
  if(reverse.length===2&&s.dockPlayers.length<2) return {stage:'DOCK',actorId:reverse[s.dockPlayers.length]!};
  const last=s.openings.at(-1);
  if(last?.cardId===null) return {stage:'OPERATION',actorId:last.playerId};
  if(s.openings.length<reverse.length) return {stage:'BUILD',actorId:reverse[s.openings.length]!};
  return {stage:'READY',actorId:null};
}
export function parseSpeakeasyPlayerSetup(input:unknown):SpeakeasyPlayerSetup {
  const raw=v.parse(State,input),s={...raw,flow:parseSpeakeasyGameFlow(raw.flow)},f=s.flow,r=f.round;
  const reverse=[...r.clock.order].reverse();
  if(r.clock.act!==1||r.clock.round!==1||r.clock.seat!==0||r.phase!=='PLAYING'||r.lastSettlement||
    r.lowerRow.some(Boolean)||f.active||f.awaitingCityReturn||f.capos.some(p=>p.placed.length)) throw new Error('Invalid setup flow.');
  if(s.dockPlayers.length>(reverse.length===2?2:0)||s.dockPlayers.some((id,i)=>id!==reverse[i])||
    (reverse.length===2&&s.dockPlayers.length<2&&s.openings.length)||s.openings.length>reverse.length) throw new Error('Invalid setup order.');
  if(s.dockPlayers.some(id=>!r.economy.docks.some(d=>d.ownerId===id))) throw new Error('Missing setup dock placement.');
  for(const [i,opening] of s.openings.entries()) {
    const p=r.economy.players.find(p=>p.playerId===opening.playerId);
    if(opening.playerId!==reverse[i]||!p||!r.economy.districts.some(d=>d.slots.some(b=>b?.ownerId===p.playerId&&b.piece.tileId===opening.pieceId))||
      (opening.cardId===null ? i!==s.openings.length-1 : !p.operations.some(c=>c.tileId===opening.cardId))) throw new Error('Invalid setup opening.');
  }
  for(const tile of f.city.buildings) {
    const d=r.economy.districts[tile.district-1]!;
    if(d.blocked||tile.slot>=d.slots.length||d.slots[tile.slot]!==null) throw new Error('Invalid setup city position.');
  }
  return s;
}
/** Seed must already contain the verified/dealt cards, pieces and prepared board. */
export function startSpeakeasyPlayerSetup(seed:unknown):SpeakeasyPlayerSetup {
  const s=parseSpeakeasyPlayerSetup({flow:seed,dockPlayers:[],openings:[]}),e=s.flow.round.economy;
  if(e.districts.some(d=>d.slots.some(Boolean))||e.docks.length||e.placedBooks.length||e.players.some(p=>
    p.operations.length||p.hand.length!==4||new Set(p.hand.map(c=>c.operation)).size!==4||
    p.cash!==15||p.safe!==30||Object.values(p.levels).some(level=>level!==1)||p.cityTileCount!==0)) throw new Error('Invalid player setup seed.');
  return s;
}
function inventory(f:SpeakeasyGameFlow):string {
  return JSON.stringify([...speakeasyInventory(f.round.economy),...cityTileInventory(f.city),
    ...Object.values(f.round.decks).flatMap(d=>d.map(c=>c.tileId))].sort());
}
function benefit(s:SpeakeasyPlayerSetup,actor:PlayerId,resolve:SpeakeasySetupBenefit):SpeakeasyRuleResult<SpeakeasyPlayerSetup> {
  const result=resolve({economy:s.flow.round.economy,city:s.flow.city,decks:s.flow.round.decks},actor);
  if(!result.ok) return result;
  s.flow.round.economy=result.value.economy;s.flow.round.decks=result.value.decks;s.flow.city=result.value.city;
  for(const p of s.flow.round.economy.players) {
    const held=s.flow.city.held.find(h=>h.playerId===p.playerId);
    if(!held) throw new Error('Missing setup city owner.');
    p.cityTileCount=held.tiles.length;
  }
  return {ok:true,value:s};
}
/** Actor comes from authentication. Every step, its benefit and progress commit together. */
export function chooseSpeakeasyPlayerSetup(original:SpeakeasyPlayerSetup,actor:PlayerId,input:unknown,
  catalog:SpeakeasySetupCatalog):SpeakeasyRuleResult<SpeakeasyPlayerSetup> {
  const parsed=v.safeParse(SpeakeasySetupCommandSchema,input),step=speakeasySetupStep(original),r=original.flow.round;
  if(!parsed.success||step.actorId!==actor||parsed.output.command.gameId!==r.gameId||parsed.output.command.revision!==r.revision) return ruleFailure('INVALID_ACTION');
  const action=parsed.output,s=parseSpeakeasyPlayerSetup(original),p=s.flow.round.economy.players.find(p=>p.playerId===actor)!;
  let resolve:SpeakeasySetupBenefit|undefined;
  if(action.type==='SETUP_DOCK') {
    if(step.stage!=='DOCK') return ruleFailure('INVALID_ACTION');
    const {zone,space}=action.command;
    if(new Set(catalog.docks.map(d=>`${d.zone}:${d.space}`)).size!==catalog.docks.length) throw new Error('Duplicate setup dock catalog.');
    resolve=catalog.docks.find(d=>d.zone===zone&&d.space===space)?.benefit;
    if(!resolve||!p.familyReserve.length||s.flow.round.economy.docks.some(d=>d.zone===zone&&d.space===space)) return ruleFailure('INVALID_ACTION');
    s.flow.round.economy.docks.push({zone,space,ownerId:actor,familyId:p.familyReserve.shift()!});
    s.dockPlayers.push(actor);
  } else if(action.type==='SETUP_BUILD') {
    if(step.stage!=='BUILD') return ruleFailure('INVALID_ACTION');
    const c=action.command,d=s.flow.round.economy.districts[c.district-1]!,piece=p.reserves.find(b=>b.tileId===c.pieceId);
    resolve=catalog.buildings.get(c.pieceId);
    if(!resolve||!piece||d.slots[c.slot]!==null||d.mobsterSlots.includes(c.slot)) return ruleFailure('INVALID_ACTION');
    const built=buildSpeakeasy(s.flow.round.economy,actor,{...c,goons:0,useAssociate:false,freeAssociate:false,discardIds:[],cashToSpend:piece.cost},
      {kinds:['SPEAKEASY','STILLS'],upgrade:false});
    if(!built.ok) return built;
    s.flow.round.economy=built.value;
    const at=s.flow.city.buildings.findIndex(t=>t.district===c.district&&t.slot===c.slot);
    if(at>=0) s.flow.city.held.find(h=>h.playerId===actor)!.tiles.push(s.flow.city.buildings.splice(at,1)[0]!.tile);
    s.flow.round.economy.players.find(p=>p.playerId===actor)!.cityTileCount=s.flow.city.held.find(h=>h.playerId===actor)!.tiles.length;
    s.openings.push({playerId:actor,pieceId:c.pieceId,cardId:null});
  } else {
    if(step.stage!=='OPERATION') return ruleFailure('INVALID_ACTION');
    const index=p.hand.findIndex(c=>c.tileId===action.command.cardId);
    resolve=catalog.operationBenefits.get(action.command.cardId);
    if(!resolve||index<0||p.operations.length) return ruleFailure('INVALID_ACTION');
    p.operations.push(p.hand.splice(index,1)[0]!);
    s.openings.at(-1)!.cardId=action.command.cardId;
  }
  const applied=benefit(s,actor,resolve);
  if(!applied.ok) return applied;
  s.flow.round.revision++;
  const checked=parseSpeakeasyPlayerSetup(s);
  if(inventory(original.flow)!==inventory(checked.flow)||cityTileDefinitions(original.flow.city)!==cityTileDefinitions(checked.flow.city)) throw new Error('Setup piece conservation.');
  return {ok:true,value:checked};
}
/** Only the completed setup may be registered with the normal game command service. */
export function completeSpeakeasyPlayerSetup(input:SpeakeasyPlayerSetup):SpeakeasyRuleResult<SpeakeasyGameFlow> {
  const s=parseSpeakeasyPlayerSetup(input);
  return speakeasySetupStep(s).stage==='READY'?{ok:true,value:s.flow}:ruleFailure('INVALID_ACTION');
}
