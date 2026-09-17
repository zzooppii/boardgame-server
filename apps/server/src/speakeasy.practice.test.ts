import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeParse} from 'valibot';
import {SpeakeasyPracticeViewSchema,type SpeakeasyPracticeAction} from '@hangul-rummikub/shared';
import {startPractice,actPractice,projectPractice,practiceChoices,type PracticeGame} from './games/speakeasy/practice/game.js';
import {SpeakeasyPracticeService} from './games/speakeasy/practice/service.js';
import {speakeasyInventory} from './games/speakeasy/domain/model.js';
const ids=()=>{let n=0;return()=>`training-${++n}`;};
function act(s:PracticeGame,action:SpeakeasyPracticeAction){const next=actPractice(s,s.player,{gameId:s.gameId,revision:s.revision,requestId:`request-${s.revision}`,action});assert.ok(next);return next;}
function choose(s:PracticeGame,type:SpeakeasyPracticeAction['type']){const choice=practiceChoices(s).find(c=>c.action.type===type);assert.ok(choice,`Missing ${type}`);return act(s,choice.action);}

test('Training has its own setup, opaque identities, no fabricated original cards, and private projections',()=>{
  const s=startPractice(ids()),view=projectPractice(s);assert.ok(safeParse(SpeakeasyPracticeViewSchema,view).success);
  assert.equal(s.economy.players.length,2);assert.equal(view.stock,0);assert.equal(view.family,4);assert.equal(view.cash,15);assert.equal(view.safe,30);
  assert.equal(view.districts.flatMap(d=>d.slots).filter(Boolean).length,4);
  assert.equal(s.economy.players.flatMap(p=>p.hand).length,0);
  const before=projectPractice(s);s.economy.players[1]!.safe+=100;assert.deepEqual(projectPractice(s),before);
  assert.equal('economy' in view,false);view.log.push('mutated');assert.equal(s.log.includes('mutated'),false);
});
test('Production, delivery and sales change real resources and preserve every piece',()=>{
  let s=startPractice(ids());const inventory=speakeasyInventory(s.economy),original=structuredClone(s);
  s=choose(s,'PRODUCE');assert.equal(projectPractice(s).stock,2);assert.equal(original.economy.players[0]!.stock.length,0);
  s=choose(s,'DELIVER');assert.equal(projectPractice(s).stock,0);assert.equal(projectPractice(s).truck.load,1);
  assert.equal(projectPractice(s).districts[1]!.slots[0]!.barrel,true);
  assert.equal(practiceChoices(s).length,0);
  const command={gameId:s.gameId,revision:s.revision,requestId:'over',action:{type:'PRODUCE'}};
  assert.equal(actPractice(s,s.player,command),null);
  s=act(s,{type:'END_TURN'});s=choose(s,'SELL');assert.equal(projectPractice(s).cash,25);
  assert.equal(projectPractice(s).districts[1]!.slots[0]!.barrel,false);assert.deepEqual(speakeasyInventory(s.economy),inventory);
});
test('Wrong actor, stale commands, forged rates and foreign building references are rejected atomically',()=>{
  const s=startPractice(ids()),before=structuredClone(s),command={gameId:s.gameId,revision:0,requestId:'id',action:{type:'PRODUCE'}};
  for(const input of [{...command,revision:1},{...command,gameId:'other'},{...command,actor:s.bot},{...command,action:{type:'PRODUCE',quantity:500}},
    {...command,action:{type:'SELL',buildingId:s.economy.districts[15]!.slots[0]!.piece.tileId}},
    {...command,action:{type:'BUILD',kind:'STILLS',district:2,slot:1}}])assert.equal(actPractice(s,s.player,input),null);
  assert.equal(actPractice(s,s.bot,command),null);assert.deepEqual(s,before);
});
test('Construction charges cash/safe and respects occupancy, supply and nightclub zone limit',()=>{
  let s=startPractice(ids());s.economy.players[0]!.cash=1;
  s=act(s,{type:'BUILD',kind:'SPEAKEASY',district:3,slot:0});assert.equal(projectPractice(s).cash,0);assert.equal(projectPractice(s).safe,26);
  assert.equal(practiceChoices(s).some(c=>c.action.type==='BUILD'&&c.action.district===3&&c.action.slot===0),false);
  s=act(s,{type:'BUILD',kind:'NIGHTCLUB',district:4,slot:0});s=act(s,{type:'END_TURN'});
  s.economy.players[0]!.cash=100;
  assert.equal(practiceChoices(s).some(c=>c.action.type==='BUILD'&&c.action.kind==='NIGHTCLUB'&&c.action.district<=6),false);
});
test('Police stops an unprotected building; protecting it restores operation and earns final building points',()=>{
  let s=startPractice(ids());s=act(s,{type:'BUILD',kind:'SPEAKEASY',district:4,slot:0});
  while(s.turn<=4)s=act(s,{type:'END_TURN'});
  assert.equal(projectPractice(s).districts[3]!.cop,true);assert.equal(projectPractice(s).districts[3]!.slots[0]!.operating,false);
  const id=s.economy.districts[3]!.slots[0]!.piece.tileId;
  s=act(s,{type:'PROTECT',buildingId:id});assert.equal(projectPractice(s).family,3);assert.equal(projectPractice(s).districts[3]!.slots[0]!.operating,true);
  while(!s.finished)s=act(s,{type:'END_TURN'});
  assert.equal(projectPractice(s).scores.find(p=>p.playerId===s.player)!.buildings,10);
});
test('A complete 11-turn game plays the economic cycle, settles three times and ends without deadlock',()=>{
  let s=startPractice(ids());const inventory=speakeasyInventory(s.economy);let commands=0;
  while(!s.finished){
    for(let n=0;n<2;n++){
      const available=practiceChoices(s);
      const choice=['SELL','DELIVER','PRODUCE','PROTECT','BUILD'].flatMap(type=>available.filter(c=>c.action.type===type))[0];
      if(choice){s=act(s,choice.action);commands++;}
    }
    s=act(s,{type:'END_TURN'});commands++;
  }
  const view=projectPractice(s);assert.equal(s.turn,11);assert.equal(commands,33);assert.equal(view.scores.length,2);assert.ok(view.scores.some(p=>p.winner));
  assert.equal(view.districts.filter(d=>d.cop).length,3);assert.deepEqual(speakeasyInventory(s.economy),inventory);
  assert.equal(actPractice(s,s.player,{gameId:s.gameId,revision:s.revision,requestId:'after',action:{type:'END_TURN'}}),null);
});
test('Session commands are isolated, replayed once and expire without disk persistence',()=>{
  let clock=0;const service=new SpeakeasyPracticeService(ids(),()=>clock),a=service.create()!,b=service.create()!;
  const command={gameId:a.view.gameId,revision:0,requestId:'same',action:{type:'PRODUCE'}};
  const first=service.command(a.token,command);assert.ok(first.ok);assert.equal(first.view.stock,2);
  assert.deepEqual(service.command(a.token,command),first);
  assert.deepEqual(service.command(a.token,{...command,action:{type:'END_TURN'}}),{ok:false,reason:'INVALID_COMMAND'});
  assert.deepEqual(service.command(b.token,command),{ok:false,reason:'INVALID_COMMAND'});
  assert.deepEqual(service.command('unknown',command),{ok:false,reason:'SESSION_EXPIRED'});
  const other=service.read(b.token);assert.ok(other.ok);assert.equal(other.view.revision,0);
  clock=2*60*60*1000;assert.deepEqual(service.read(a.token),{ok:false,reason:'SESSION_EXPIRED'});
});

test('Truck movement has a server-checked range and preserves cargo when repositioned',()=>{
  let s=startPractice(ids());s=choose(s,'PRODUCE');s=choose(s,'DELIVER');s=act(s,{type:'END_TURN'});
  const command={gameId:s.gameId,revision:s.revision,requestId:'move',action:{type:'MOVE',district:16}};
  assert.equal(actPractice(s,s.player,command),null);
  s=act(s,{type:'MOVE',district:5});assert.equal(projectPractice(s).truck.district,5);assert.equal(projectPractice(s).truck.load,1);
});

test('Every advertised preview matches authoritative execution, including safe spending and delivery routes',()=>{
  let s=startPractice(ids());s.economy.players[0]!.cash=1;
  for(let turn=0;turn<11;turn++){
    for(const choice of practiceChoices(s)){
      const before=projectPractice(s),after=projectPractice(act(s,choice.action));
      assert.deepEqual(choice.preview.delta,{cash:after.cash-before.cash,safe:after.safe-before.safe,
        stock:after.stock-before.stock,family:after.family-before.family,truckLoad:after.truck.load-before.truck.load});
      assert.deepEqual(after.feedback?.delta,choice.preview.delta);
      assert.equal(after.feedback?.events.length,1);
      const route=choice.preview.route;
      for(let i=1;i<route.length;i++){
        const a=route[i-1]!,b=route[i]!;
        assert.equal(Math.abs(Math.floor((a-1)/4)-Math.floor((b-1)/4))+Math.abs((a-1)%4-(b-1)%4),1);
      }
      if(route.length)assert.equal(route.at(-1),after.truck.district);
      for(const target of choice.preview.targets){
        if(choice.action.type==='BUILD')assert.equal(after.districts[target.district-1]!.slots[target.slot!]!.kind,choice.action.kind);
        else if('buildingId' in choice.action)assert.equal(before.districts[target.district-1]!.slots[target.slot!]!.tileId,choice.action.buildingId);
      }
    }
    const choices=practiceChoices(s),choice=choices.find(c=>c.action.type==='DELIVER')??choices.find(c=>c.action.type==='PRODUCE');
    if(choice)s=act(s,choice.action);
    s=act(s,{type:'END_TURN'});
  }
});
test('Feedback groups only the last command, survives log trimming, and is detached from state',()=>{
  let s=startPractice(ids());assert.equal(projectPractice(s).feedback,null);
  s.log=Array.from({length:60},(_,i)=>`old-${i}`);
  while(s.turn<4)s=act(s,{type:'END_TURN'});
  const before=projectPractice(s);s=act(s,{type:'END_TURN'});
  const view=projectPractice(s);assert.ok(view.feedback);
  assert.equal(view.feedback.title,'4턴 종료');assert.equal(view.feedback.delta.safe,view.safe-before.safe);
  assert.ok(view.feedback.events.includes('경찰 · 4구역 진입'));
  assert.equal(view.feedback.events.filter(e=>e.startsWith('컴퓨터 ·')&&!e.includes('정산')).length,2);
  assert.ok(view.feedback.events.every(e=>!e.startsWith('old-')));
  view.feedback.events.push('tamper');view.feedback.delta.cash=999;
  assert.ok(!s.feedback!.events.includes('tamper'));assert.notEqual(s.feedback!.delta.cash,999);
});
