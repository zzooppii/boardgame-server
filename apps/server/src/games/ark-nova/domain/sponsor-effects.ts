import { ARK_CONTINENTS, ARK_MAP_A, arkBorder, arkCellKey, arkNeighbours, type ArkCard, type ArkBuilding } from '@hangul-rummikub/shared';
import { arkCardDefinition, arkZooIcons, ARK_ZOO_ANIMAL_CATEGORIES, type ArkZooIcons } from './zoo-icons.js';
import type { ArkZooEffect } from './animal-effects.js';
export type ArkSponsorContext=Readonly<{multiplayer?:unknown;played:readonly ArkCard[];partners:readonly string[];universities:readonly string[];buildings:readonly ArkBuilding[];supportedProjects:number}>;
const categories=['Primate','Reptile','Bird','Predator','Herbivore'] as const;
function icons(s:Pick<ArkSponsorContext,'played'|'partners'|'universities'>) {return arkZooIcons(s.played,s.partners,s.universities);}
function animals(s:ArkSponsorContext) {return s.played.map(arkCardDefinition).filter(c=>c.kind==='ANIMAL');}
function connected(s:ArkSponsorContext,predicate:(c:typeof ARK_MAP_A[number])=>boolean):number {
  const covered=new Set(s.buildings.flatMap(b=>b.cells.map(arkCellKey)));
  return ARK_MAP_A.filter(c=>predicate(c)&&!covered.has(arkCellKey(c))&&arkNeighbours(c).some(n=>covered.has(arkCellKey(n)))).length;
}
/** Invoke at effect resolution, after the sponsor and its printed icons entered the zoo. */
export function arkSponsorImmediate(key:string,s:ArkSponsorContext):ArkZooEffect[] {
  const card=arkCardDefinition({key,cardId:'definition'});if(card.kind!=='SPONSOR') throw new Error('Expected sponsor.');
  const result:ArkZooEffect[]=[],count=icons(s),n=Number(key);
  const gain=(resource:'APPEAL'|'CONSERVATION'|'REPUTATION'|'MONEY'|'X'|'WORKER',amount:number)=>{if(amount>0)result.push({kind:'GAIN',resource,amount});};
  gain('APPEAL',card.appeal);gain('CONSERVATION',card.conservation);gain('REPUTATION',card.reputation);
  if(n>=210&&n<=214) gain('APPEAL',count[['Americas','Europe','Australia','Asia','Africa'][n-210]!]??0);
  if(n>=231&&n<=235) gain('APPEAL',count[categories[n-231]!]??0);
  switch(key) {
    case '201': result.push({kind:'CARD_PICK',amount:1});break;
    case '203': gain('MONEY',[0,2,5,10][s.universities.length]??0);break;
    case '204': gain('MONEY',(count.Science??0)*2);break;
    case '206': gain('APPEAL',s.supportedProjects*2);break;
    case '207': gain('CONSERVATION',Math.floor([...ARK_ZOO_ANIMAL_CATEGORIES,...ARK_CONTINENTS].filter(t=>(count[t]??0)>0).length/2));break;
    case '208': gain('APPEAL',count.Science??0);break;
    case '209':case '224':case '225':gain('X',1);break;
    case '215':case '218':result.push({kind:'SPONSOR_TOKENS',amount:2});break;
    case '216':gain('WORKER',1);break;
    case '219':gain('MONEY',2*((count.Water??0)+(count.Rock??0)));break;
    case '220':gain('MONEY',3);break;
    case '222':gain('CONSERVATION',Math.min(3,count.Science??0));break;
    case '227':result.push({kind:'WAZA_FOCUS'});break;
    case '228':gain('MONEY',2*animals(s).filter(c=>c.size<=2).length);break;
    case '229':gain('APPEAL',animals(s).filter(c=>c.size<=2).length);break;
    case '230':gain('APPEAL',2*animals(s).filter(c=>c.size>=4).length);break;
    case '241':gain('APPEAL',count.Water??0);break;
    case '242':gain('APPEAL',3*Math.floor((count.Rock??0)/2));break;
    case '253':result.push({kind:'SPONSOR_TOKENS',amount:3});break;
    case '254':result.push({kind:'CARD_PICK',amount:1});break;
    case '258':gain('APPEAL',connected(s,c=>c.terrain==='WATER'));break;
    case '259':gain('APPEAL',connected(s,c=>c.terrain==='ROCK'));break;
    case '260':gain('APPEAL',connected(s,c=>c.terrain==='LAND'&&arkBorder(c)));break;
    case '262':gain('MONEY',2*[...ARK_ZOO_ANIMAL_CATEGORIES,...ARK_CONTINENTS].filter(t=>(count[t]??0)>0).length);break;
    case '263':result.push({kind:'FREE_BUILD',buildings:['ENCLOSURE_5'],amount:1,ignoreBuildUpgrade:false});break;
    case '264':gain('APPEAL',connected(s,c=>c.bonus!==null));break;
  }
  return result;
}
export type ArkTriggeredEffect={sourceId:string;effect:ArkZooEffect;timing:'IMMEDIATE'|'AFTER_FINISHING'};
/** Zoo icon entry events also cover universities and partners; double icons trigger twice. */
export function arkSponsorIconTriggers(s:Pick<ArkSponsorContext,'played'|'partners'|'universities'>,added:ArkZooIcons,previous:ArkZooIcons):ArkTriggeredEffect[] {
  const result:ArkTriggeredEffect[]=[],count=icons(s);
  for(const sponsor of s.played.filter(c=>arkCardDefinition(c).kind==='SPONSOR')) {
    const emit=(effect:ArkZooEffect)=>result.push({sourceId:sponsor.cardId,effect,timing:sponsor.key==='214'?'AFTER_FINISHING':'IMMEDIATE'});
    const gain=(resource:'APPEAL'|'CONSERVATION'|'REPUTATION'|'MONEY'|'X',amount:number)=>{if(amount>0)emit({kind:'GAIN',resource,amount});};
    const repeat=(tag:string,effect:ArkZooEffect)=>{for(let i=0;i<(added[tag]??0);i++)emit(structuredClone(effect));};
    const n=Number(sponsor.key);
    if(n>=236&&n<=240) gain('MONEY',3*(added[categories[n-236]!]??0));
    switch(sponsor.key) {
      case '202':gain('REPUTATION',added.Science??0);break;
      case '204':gain('CONSERVATION',added.Science??0);break;
      case '208':gain('MONEY',2*(added.Science??0));break;
      case '210':repeat('Americas',{kind:'FREE_BUILD',buildings:['KIOSK'],amount:1,ignoreBuildUpgrade:false});break;
      case '211':repeat('Europe',{kind:'FREE_BUILD',buildings:['ENCLOSURE_1'],amount:1,ignoreBuildUpgrade:false});break;
      case '212':repeat('Australia',{kind:'POUCH',amount:1});break;
      case '213':repeat('Asia',{kind:'FREE_BUILD',buildings:['PAVILION'],amount:1,ignoreBuildUpgrade:false});break;
      case '214':repeat('Africa',{kind:'MOVE_ACTION',action:null,slots:[1]});break;
      case '243':gain('APPEAL',2*(added.Herbivore??0));break;
      case '244':gain('APPEAL',2*(added.Bird??0));break;
      case '245':gain('APPEAL',2*(added.Water??0));break;
      case '246':gain('APPEAL',2*(added.Rock??0));break;
      case '247':gain('APPEAL',2*(added.Primate??0));break;
      case '248':gain('X',added.Primate??0);break;
      case '249':repeat('Bird',{kind:'PERCEPTION',amount:2,keep:1});break;
      case '250':repeat('Reptile',{kind:'SUNBATHING',amount:2});break;
      case '251':gain('APPEAL',2*(added.Bear??0));break;
      case '252':repeat('Predator',{kind:'HUNTER',amount:count.Predator??0});break;
      case '253':repeat('Herbivore',{kind:'PAID_SPONSOR',usesSponsorToken:true});break;
      case '262': {
        const novel=[...ARK_ZOO_ANIMAL_CATEGORIES,...ARK_CONTINENTS].filter(t=>(added[t]??0)>0&&(previous[t]??0)===0).length;
        gain('APPEAL',novel);gain('MONEY',novel*2);break;
      }
    }
  }
  return result;
}
export function arkSponsorIncome(s:ArkSponsorContext):ArkTriggeredEffect[] {
  const result:ArkTriggeredEffect[]=[],count=icons(s);
  for (const card of s.played) {
    const emit=(effect:ArkZooEffect)=>result.push({sourceId:card.cardId,effect,timing:'IMMEDIATE'});
    const n=Number(card.key);
    if(n>=231&&n<=235) {const amount=3*[1,3,5].filter(t=>(count[categories[n-231]!]??0)>=t).length;if(amount)emit({kind:'GAIN',resource:'MONEY',amount});}
    if(card.key==='201')emit({kind:'CARD_PICK',amount:1});
    if(card.key==='206')emit({kind:'GAIN',resource:'CONSERVATION',amount:1});
    if(card.key==='209')emit({kind:'GAIN',resource:'X',amount:1});
    if(card.key==='220')emit({kind:'GAIN',resource:'MONEY',amount:3});
    if(card.key==='257') {
      const entrance=s.buildings.find(b=>b.kind==='UNIQUE_257');
      if(entrance) {
        const neighbours=new Set(entrance.cells.flatMap(arkNeighbours).map(arkCellKey));
        const amount=2*s.buildings.filter(b=>b.id!==entrance.id&&(!b.kind.startsWith('ENCLOSURE_')||b.occupied)&&b.cells.some(c=>neighbours.has(arkCellKey(c)))).length;
        if(amount)emit({kind:'GAIN',resource:'MONEY',amount});
      }
    }
  }
  return result;
}
