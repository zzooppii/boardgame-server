import {speakeasyZone,type PlayerId,type SpeakeasyLocationChoice} from '@hangul-rummikub/shared';
import {speakeasyCandidate,type SpeakeasyEconomy,type SpeakeasyPlayer} from './model.js';
import {speakeasyOperating,speakeasyInfamy,quoteSpeakeasyPayment} from './economy.js';
import type {SpeakeasyLocationProgram} from './location-program.js';
type Choice=Extract<SpeakeasyLocationChoice,{kind:'AMBUSH'}>;
type Rules=Extract<SpeakeasyLocationProgram['rows'][number][number],{kind:'AMBUSH'}>;
/** Rules v19c p22: income is evaluated before moving the attacking family or awarding a barrel. */
function income(e:SpeakeasyEconomy,p:SpeakeasyPlayer,crate:number,zone:number):number {
  const buildings=e.districts.flatMap(d=>d.slots.filter(b=>b?.ownerId===p.playerId));
  switch(crate) {
    case 1:return Math.min(24,e.placedBooks.filter(b=>b.ownerId===p.playerId).length*4);
    case 2:return p.levels.PARTY*5;
    case 3:return p.vip.length*6;
    case 4:return p.goons.length*3;
    case 5:return p.levels.STRENGTH*5;
    case 6:return Math.min(24,(p.associate?.strength??0)*3);
    case 7:return p.cityTileCount*4;
    case 8:return Math.min(24,p.hand.length*3);
    case 9:return p.levels.FLEET*5;
    case 10:return Math.min(25,buildings.filter(b=>b?.barrelId!==null).length*5);
    case 11:return speakeasyInfamy(p);
    case 12:return Math.max(...Object.values(p.levels))*4;
    case 13:return buildings.filter(b=>b?.piece.kind==='NIGHTCLUB'||b?.piece.kind==='CASINO').length*4;
    case 14:return Math.min(24,p.helpers.length*4);
    case 15:return Math.min(24,buildings.filter(b=>b?.familyId!==null).length*4);
    case 16:return p.levels.VIP*5;
    case 17:return e.docks.filter(d=>d.zone===zone).length*4;
    case 18:return p.levels.STILLS*5;
    default:throw new Error('Unknown crate.');
  }
}
const crates=(e:SpeakeasyEconomy)=>[...e.crateSupply,...e.ships.flatMap(s=>s.crate===undefined?[]:[s.crate]),...e.players.flatMap(p=>p.crates)];
export function ambushSpeakeasyShip(original:SpeakeasyEconomy,actor:PlayerId,choice:Choice,rules:Rules) {
  const inventory=crates(original);
  if(new Set(inventory).size!==inventory.length) throw new Error('Duplicate crate inventory.');
  const result=speakeasyCandidate(original,e=>{
    const p=e.players.find(p=>p.playerId===actor),ship=e.ships.find(s=>s.tileId===choice.shipId);
    const defense=rules.defenses.find(d=>d.shipId===choice.shipId);
    if(!p||!ship||ship.crate===undefined||!defense||defense.byRemaining.length!==ship.prices.length+1||!e.crateSupply.length) return 'INVALID_ACTION';
    const zone=speakeasyZone(ship.port),own=e.docks.filter(d=>d.ownerId===actor&&d.zone===zone);
    const returning=own.find(d=>d.familyId===choice.familyId);
    if(!returning||new Set(choice.borrowedFamilyIds).size!==choice.borrowedFamilyIds.length||choice.goons>p.goons.length) return 'INVALID_ACTION';
    const borrowed=choice.borrowedFamilyIds.map(id=>e.docks.find(d=>d.familyId===id&&d.ownerId!==actor&&d.zone===zone));
    if(borrowed.some(d=>!d)) return 'INVALID_ACTION';
    const payment=quoteSpeakeasyPayment(p.cash,p.safe,borrowed.length,choice.cashToSpend);
    if(!payment.ok) return payment.reason;
    if(p.levels.STRENGTH*(own.length+borrowed.length)+choice.goons<=defense.byRemaining[ship.barrels.length]!) return 'INSUFFICIENT_STRENGTH';
    const buildings=e.districts.flatMap(d=>d.slots.flatMap(b=>b?.ownerId===actor&&speakeasyOperating(d.cop,b)?[b]:[]));
    const stills=buildings.some(b=>b.piece.kind==='STILLS'),empty=buildings.filter(b=>b.piece.kind!=='STILLS'&&b.barrelId===null);
    const destination=choice.destination;
    if((destination.kind==='BUILDING'&&!empty.some(b=>b.piece.tileId===destination.buildingId))||
      (destination.kind==='STILLS'&&!stills)||(destination.kind==='DISCARD'&&(stills||empty.length))) return 'INVALID_ACTION';
    // FAQ Apr 2026 p1: laundering costs 2 safe dollars, but the owner receives only 1 cash.
    p.cash-=payment.value.cash;p.safe-=payment.value.safe;
    for(const d of borrowed) e.players.find(other=>other.playerId===d!.ownerId)!.cash++;
    e.goonSupply.push(...p.goons.splice(0,choice.goons));
    p.cash+=income(e,p,ship.crate,zone);p.crates.push(ship.crate);ship.crate=e.crateSupply.shift()!;
    const barrel=ship.barrels.length?ship.barrels.pop():e.barrelSupply.shift();
    if(!barrel) return 'CAPACITY';
    if(destination.kind==='STILLS') p.stock.push(barrel);
    else if(destination.kind==='BUILDING') empty.find(b=>b.piece.tileId===destination.buildingId)!.barrelId=barrel;
    else e.barrelSupply.push(barrel);
    e.docks.splice(e.docks.indexOf(returning),1);
    if(p.vip.length<rules.vipCapacityByLevel[p.levels.VIP-1]!) p.vip.push(returning.familyId);
    else p.familyReserve.push(returning.familyId);
    const port=e.ports.indexOf(ship.port),next=Array.from({length:e.ports.length-1},(_,i)=>e.ports[(port+i+1)%e.ports.length]!).find(d=>!e.ships.some(s=>s.port===d));
    if(next===undefined) return 'INVALID_ACTION';ship.port=next;
    return null;
  });
  if(result.ok&&JSON.stringify(inventory.sort((a,b)=>a-b))!==JSON.stringify(crates(result.value).sort((a,b)=>a-b))) throw new Error('Crate conservation.');
  return result;
}
