import {canUseSpeakeasyHelper} from '../domain/helper-actions.js';
import * as v from 'valibot';
import {SpeakeasyBoardViewSchema, type SpeakeasyBoardView, type PlayerId} from '@hangul-rummikub/shared';
import {parseSpeakeasyGameFlow, type SpeakeasyGameFlow} from '../domain/game-flow.js';
import {projectSpeakeasyLuciano} from '../domain/luciano.js';
import {speakeasyOperating} from '../domain/economy.js';
import {speakeasyFinalScores,speakeasyWinners} from '../domain/scoring.js';
import {projectSpeakeasyFixedGoals} from './goal-projector.js';
import {projectSpeakeasyTurn} from './turn-projector.js';

/** Build each authenticated recipient's screen separately. Never room-broadcast this snapshot.
 * Explicit fields exclude reserves, hands, money and unseen components belonging to others.
 * Catalog/board geometry and transport integration remain separate from this projection.
 */
export function projectSpeakeasyBoard(original:SpeakeasyGameFlow,viewer:PlayerId):SpeakeasyBoardView|null {
  if(!original.round.clock.order.includes(viewer)) return null;
  const s=parseSpeakeasyGameFlow(original), economy=s.round.economy;
  const self=economy.players.find(p=>p.playerId===viewer)!;
  return v.parse(SpeakeasyBoardViewSchema,{
    turn:projectSpeakeasyTurn(s,viewer),
    helperMarket:{cards:economy.helperDisplay.map(h=>({tileId:h.tileId,bottle:h.bottle,value:h.value})),deckCount:economy.helperDeck.length},
    ports:economy.ports,ships:economy.ships.map(ship=>({tileId:ship.tileId,port:ship.port,barrels:ship.barrels.length,crate:ship.crate??null,prices:ship.prices})),
    districts:economy.districts.map(d=>({id:d.id,blocked:d.blocked,cop:d.cop,
      slots:d.slots.map(b=>b?{tileId:b.piece.tileId,ownerId:b.ownerId,kind:b.piece.kind,
        protected:b.familyId!==null,barrel:b.barrelId!==null,operating:speakeasyOperating(d.cop,b)}:null),
      mobsterSlots:d.mobsterSlots,mobsterStrength:d.mobsterStrength})),
    trucks:economy.players.flatMap(p=>p.trucks.flatMap(t=>t.district===null?[]:[{
      tileId:t.tileId,ownerId:p.playerId,district:t.district,load:t.barrels.length}])),
    docks:economy.docks.map(d=>({ownerId:d.ownerId,zone:d.zone,space:d.space})),
    placedBooks:economy.placedBooks.map(b=>({ownerId:b.ownerId,goalId:b.goalId,space:b.space})),
    self:{fixedGoals:projectSpeakeasyFixedGoals(s,viewer),levels:self.levels,leverageTokens:self.leverageTokens,
      operations:self.operations.map(c=>({tileId:c.tileId,operation:c.operation,leverage:c.leverage})),
      reserves:self.reserves.map(b=>({tileId:b.tileId,kind:b.kind,cost:b.cost,group:b.group})),
      vip:self.vip.length,familyReserve:self.familyReserve.length,goons:self.goons.length,
      stock:self.stock,trucks:self.trucks.map(t=>({tileId:t.tileId,district:t.district,barrels:t.barrels})),
      books:self.books,bookReserve:self.bookReserve,crates:self.crates,
      usableHelperIds:canUseSpeakeasyHelper(s,viewer)?self.helpers.filter(h=>!h.used).map(h=>h.tileId):[],
      helpers:self.helpers.map(h=>({tileId:h.tileId,bottle:h.bottle,value:h.value,used:h.used})),
      associate:self.associate?{district:self.associate.district,strength:self.associate.strength,fee:self.associate.fee,
        defenseBonus:self.associate.defenseBonus,protectionBonus:self.associate.protectionBonus,
        stillsImmune:self.associate.stillsImmune,freeUseAvailable:self.associate.freeUseAvailable,
        takeoverDiscount:self.associate.takeoverDiscount}:null},
    luciano:s.luciano?projectSpeakeasyLuciano(s.luciano,viewer):null,
    result:s.round.phase==='FINAL_SCORING'?{
      winners:speakeasyWinners(economy),
      scores:speakeasyFinalScores(economy).map(p=>({playerId:p.playerId,total:p.total,
        buildingMoney:p.buildingMoney,helperMoney:p.helperMoney,tieBreak:p.tieBreak})),
    }:null,
  });
}
