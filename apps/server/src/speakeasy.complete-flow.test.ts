import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'valibot';
import {GameIdSchema, RoomIdSchema, ServerTimeSchema, type PlayerId} from '@hangul-rummikub/shared';
import {a,b,example,tile,exampleActPlans} from './speakeasy.fixture.js';
import {startSpeakeasyRoundLifecycle} from './games/speakeasy/domain/round-lifecycle.js';
import {startSpeakeasyGameFlow} from './games/speakeasy/domain/game-flow.js';
import {prepareSpeakeasyActPlans} from './games/speakeasy/application/advance-game.js';
import {SpeakeasyCommandService} from './games/speakeasy/application/command-service.js';
import {InMemorySpeakeasyCommandStore} from './games/speakeasy/infrastructure/in-memory-command-store.js';
import {KeyedSerialExecutor} from './infrastructure/keyed-serial-executor.js';

const roomId=parse(RoomIdSchema,'complete-room'),gameId=parse(GameIdSchema,'complete-game');
function initial() {
  const economy=example();
  for (const [seat,p] of economy.players.entries()) {
    // Extra synthetic hands allow Restaurant-only sequencing without invented card effects.
    for(let n=4;n<16;n++) p.hand.push({tileId:tile(`hand-${seat}-${n}`),operation:'PARTY',leverage:1});
    const piece=p.reserves.shift()!;
    economy.districts[0]!.slots[seat]={piece,ownerId:p.playerId,familyId:null,barrelId:null};
  }
  const p=economy.players[0]!,index=p.reserves.findIndex(piece=>piece.kind==='CASINO');
  economy.districts[15]!.slots[0]={piece:p.reserves.splice(index,1)[0]!,ownerId:a,familyId:p.vip.pop()!,barrelId:null};
  const deck=(operation:'VIP'|'PARTY'|'STILLS'|'FLEET')=>Array.from({length:12},(_,n)=>({tileId:tile(`deck-${operation}-${n}`),operation,leverage:1}));
  return startSpeakeasyGameFlow(startSpeakeasyRoundLifecycle({gameId,revision:0,economy,
    clock:{act:1,round:1,seat:0,order:[a,b]},decks:{VIP:deck('VIP'),PARTY:deck('PARTY'),STILLS:deck('STILLS'),FLEET:deck('FLEET')}}),
    [{id:'restaurant',location:'RESTAURANT'}],
    [a,b].map((playerId,i)=>({playerId,available:Array.from({length:4},(_,n)=>tile(`capo-${i}-${n}`)),placed:[],retired:[]})));
}
function harness(state=initial()) {
  const store=new InMemorySpeakeasyCommandStore();store.add(roomId,state,exampleActPlans());
  const service=new SpeakeasyCommandService({store,executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,1234)},
    catalog:{operations:new Map(),city:[{effectId:'test-return',resolve:state=>({ok:true,value:state})}],goals:[]}});
  const context=(actorPlayerId:PlayerId)=>({roomId,actorPlayerId,authorization:{isCurrent:()=>true}});
  const record=async()=>{const r=await store.read(roomId);assert.ok(r);return r;};
  const send=async(actor:PlayerId,type:string,fields:object={})=>{
    const before=await record();
    const body={requestId:`cmd-${before.state.round.revision}`,action:{type,command:{gameId,revision:before.state.round.revision,...fields}}};
    const reply=await service.command(context(actor),body);assert.ok(reply.ok,JSON.stringify(reply));
    assert.equal(reply.acceptedRevision,reply.view.turn.revision);
    const saved=await record();assert.equal(saved.version,before.version+1);assert.equal(saved.receipts.length,before.receipts.length+1);
    return {reply,body,saved};
  };
  return {store,service,context,record,send};
}
async function beforeDraw(h:ReturnType<typeof harness>, cityTileId?:string) {
  const s=(await h.record()).state,actor=s.round.clock.order[s.round.clock.seat]!,p=s.round.economy.players.find(p=>p.playerId===actor)!;
  const position=s.round.lowerRow.findIndex(id=>id===null);
  await h.send(actor,'PLACE_CAPO',{capoId:s.capos.find(p=>p.playerId===actor)!.available[0],spaceId:'restaurant',
    restaurant:{position,discardIds:p.hand.slice(0,position===0?1:2).map(c=>c.tileId)}});
  for(const action of ['BOOKS','CITY_TILES']) {
    await h.send(actor,'CHOOSE_RESTAURANT_ACTION',{action});
    if(action==='CITY_TILES'&&cityTileId) await h.send(actor,'USE_CITY_TILE',{tileId:cityTileId});
    await h.send(actor,'FINISH_RESTAURANT_ACTION');
  }
  await h.send(actor,'FINISH_RESTAURANT');return actor;
}
async function turn(h:ReturnType<typeof harness>) {
  const actor=await beforeDraw(h);return h.send(actor,'DRAW_OPERATION',{deck:'PARTY'});
}

test('Speakeasy service completes 22 turns, pauses for both defenders, settles all acts and publishes final scores',async()=>{
  const h=harness();let turns=0,defenses=0;const starts:number[]=[],bodies=[];
  while((await h.record()).state.round.phase!=='FINAL_SCORING') {
    const s=(await h.record()).state;
    if(s.round.clock.round===1&&s.round.clock.seat===0&&s.round.phase==='PLAYING') starts.push(s.round.clock.act);
    if(s.luciano?.phase==='DEFENSE') {
      const snapshot=await h.service.snapshot(h.context(a));assert.ok(snapshot.ok);
      const actor=snapshot.view.turn.actorId!;
      assert.equal(actor,defenses===0?a:b);
      assert.ok(!JSON.stringify(snapshot).includes('scheduled-0-1'));
      const buildingId=s.luciano.current!.pending.find(id=>s.round.economy.districts[0]!.slots.some(p=>p?.piece.tileId===id&&p.ownerId===actor))!;
      const invalid=await h.service.command(h.context(actor===a?b:a),{requestId:'wrong-defender',action:{type:'DEFEND',
        command:{gameId,revision:s.round.revision,buildingId,defend:true,goons:0,useAssociate:false,freeAssociate:false}}});
      assert.deepEqual(invalid,{ok:false,reason:'RULE_VIOLATION'});
      const done=await h.send(actor,'DEFEND',{buildingId,defend:true,goons:0,useAssociate:false,freeAssociate:false});
      bodies.push({actor,body:done.body});defenses++;
    } else {
      assert.equal(s.round.phase,'PLAYING');const actor=s.round.clock.order[s.round.clock.seat]!;
      const done=await turn(h);bodies.push({actor,body:done.body});turns++;
      if(turns===2) {assert.equal(done.reply.view.turn.round,2);assert.equal(done.reply.view.turn.stage,'PLACE_CAPO');}
    }
    assert.ok(turns<=22&&defenses<=2,'automatic progress must terminate');
  }
  const final=await h.record();assert.equal(turns,22);assert.equal(defenses,2);assert.deepEqual(starts,[1,2,3,4]);
  assert.equal(final.state.history.length,3);assert.ok(final.state.history.every(l=>l.phase==='COMPLETE'));
  assert.equal(final.state.round.economy.players[0]!.cash,15+11*5,'casino pays once per round including the final round');
  assert.equal(final.state.round.economy.districts.filter(d=>d.cop).length,12);
  assert.ok(final.state.capos.every(p=>p.available.length===0&&p.placed.length===1&&p.retired.length===3));
  for(const actor of [a,b]) {
    const snapshot=await h.service.snapshot(h.context(actor));assert.ok(snapshot.ok);assert.ok(snapshot.view.result);
    assert.equal(snapshot.view.turn.actorId,null);assert.equal(snapshot.view.result.scores.length,2);
    assert.ok(snapshot.view.result.scores.some(p=>p.playerId===a&&p.buildingMoney===20));
    assert.ok(!JSON.stringify(snapshot).includes('scheduled-2-'));
  }
  // Old requests, including final draw and the defense that triggered settlement, are receipts only.
  for(const {actor,body} of bodies) {const replay=await h.service.command(h.context(actor),body);assert.ok(replay.ok);assert.equal(replay.replayed,true);assert.ok(replay.view.result);}
  const denied=await h.service.command(h.context(a),{requestId:'after-finish',action:{type:'DRAW_OPERATION',command:{gameId,revision:final.state.round.revision,deck:'VIP'}}});
  assert.deepEqual(denied,{ok:false,reason:'INVALID_PHASE'});assert.deepEqual(await h.record(),final);
});

test('Speakeasy concurrent final draws advance the round and casino payment once',async()=>{
  const h=harness();await turn(h);const actor=await beforeDraw(h),before=await h.record();
  const body={requestId:'parallel-draw',action:{type:'DRAW_OPERATION',command:{gameId,revision:before.state.round.revision,deck:'PARTY'}}};
  const replies=await Promise.all(Array.from({length:10},()=>h.service.command(h.context(actor),body)));
  assert.equal(replies.filter(r=>r.ok&&!r.replayed).length,1);assert.equal(replies.filter(r=>r.ok&&r.replayed).length,9);
  const after=await h.record();assert.equal(after.version,before.version+1);assert.equal(after.state.round.clock.round,2);
  assert.equal(after.state.round.revision,before.state.round.revision+2);assert.equal(after.state.round.economy.players[0]!.cash,20);
});

test('Speakeasy automatic transition failure rolls back draw, settlement and receipt together',async()=>{
  // Inject invalid internal configuration through a test read; live state stays untouched.
  const h=harness();for(let n=0;n<7;n++) await turn(h);const actor=await beforeDraw(h),before=await h.record();
  const service=new SpeakeasyCommandService({store:{read:async id=>{const r=await h.store.read(id);if(r)r.actPlans[0]!.deck=[];return r;},commit:(c,a)=>h.store.commit(c,a)},
    executor:new KeyedSerialExecutor(),clock:{now:()=>parse(ServerTimeSchema,1234)},catalog:{operations:new Map(),city:[],goals:[]}});
  const body={requestId:'bad-plan',action:{type:'DRAW_OPERATION',command:{gameId,revision:before.state.round.revision,deck:'PARTY'}}};
  assert.deepEqual(await service.command(h.context(actor),body),{ok:false,reason:'INTERNAL_ERROR'});
  assert.deepEqual(await h.record(),before);
  assert.ok((await h.service.command(h.context(actor),body)).ok);
});

test('Speakeasy registration validates all private act plans and detaches caller data',async()=>{
  const state=initial(),plans=exampleActPlans();
  assert.equal(prepareSpeakeasyActPlans(state,plans).length,3);
  for(const alter of [
    (p:ReturnType<typeof exampleActPlans>)=>{p.pop();},
    (p:ReturnType<typeof exampleActPlans>)=>{p[1]!.districts[0]=1;},
    (p:ReturnType<typeof exampleActPlans>)=>{p[1]!.copDistricts[0]=1;},
    (p:ReturnType<typeof exampleActPlans>)=>{p[0]!.copDistricts.pop();},
    (p:ReturnType<typeof exampleActPlans>)=>{p[0]!.deck.pop();},
    (p:ReturnType<typeof exampleActPlans>)=>{p[0]!.deck[0]!.tileId=tile('capo-0-0');},
    (p:ReturnType<typeof exampleActPlans>)=>{p[2]!.deck[0]!.tileId=p[0]!.deck[0]!.tileId;},
  ]) {const bad=structuredClone(plans);alter(bad);assert.throws(()=>prepareSpeakeasyActPlans(state,bad));}
  const store=new InMemorySpeakeasyCommandStore();store.add(roomId,state,plans);plans[0]!.deck[0]!.strength=999;
  const saved=await store.read(roomId);assert.ok(saved);assert.equal(saved.actPlans[0]!.deck[0]!.strength,1);
  saved.actPlans[0]!.deck=[];assert.equal((await store.read(roomId))!.actPlans[0]!.deck.length,2);
});

test('Speakeasy exhausted mobster supply rejects automatic progress without accepting the triggering draw',async()=>{
  const state=initial();
  for(const d of state.round.economy.districts.slice(7)) {
    d.mobsterSlots=[0,1].filter(i=>d.slots[i]===null);d.mobsterStrength=1;
  }
  const h=harness(state);
  for(let n=0;n<19;n++) {
    await turn(h);
    while((await h.record()).state.luciano?.phase==='DEFENSE') {
      const view=await h.service.snapshot(h.context(a));assert.ok(view.ok);
      const s=(await h.record()).state,actor=view.view.turn.actorId!;
      const buildingId=s.luciano!.current!.pending.find(id=>s.round.economy.districts[0]!.slots.some(p=>p?.piece.tileId===id&&p.ownerId===actor))!;
      await h.send(actor,'DEFEND',{buildingId,defend:true,goons:0,useAssociate:false,freeAssociate:false});
    }
  }
  const actor=await beforeDraw(h),before=await h.record();
  assert.equal(before.state.round.economy.districts.reduce((n,d)=>n+d.mobsterSlots.length,0),23);
  const reply=await h.service.command(h.context(actor),{requestId:'capacity-draw',action:{type:'DRAW_OPERATION',command:{gameId,revision:before.state.round.revision,deck:'PARTY'}}});
  assert.deepEqual(reply,{ok:false,reason:'RULE_VIOLATION'});assert.deepEqual(await h.record(),before);
});


test('Speakeasy last player must return used city tiles before automatic round settlement',async()=>{
  const state=initial(),tileId=tile('city-to-return');
  state.city.held[1]!.tiles.push({tileId,effectId:'test-return'});state.round.economy.players[1]!.cityTileCount=1;
  const h=harness(state);await turn(h);const actor=await beforeDraw(h,tileId);
  const draw=await h.send(actor,'DRAW_OPERATION',{deck:'PARTY'});
  assert.equal(draw.reply.view.turn.stage,'RETURN_CITY');assert.equal(draw.reply.view.turn.actorId,b);
  assert.equal(draw.saved.state.round.economy.players[0]!.cash,15);
  assert.equal(draw.saved.state.round.clock.round,1);
  const returned=await h.send(actor,'RETURN_CITY_TILES',{placements:[{tileId,row:0}]});
  assert.equal(returned.reply.view.turn.stage,'PLACE_CAPO');assert.equal(returned.reply.view.turn.round,2);
  assert.equal(returned.saved.state.round.economy.players[0]!.cash,20);
  assert.equal(returned.saved.state.city.middle[0]![0]!.tileId,tileId);
  const replay=await h.service.command(h.context(actor),returned.body);assert.ok(replay.ok);assert.equal(replay.replayed,true);
  assert.deepEqual(await h.record(),returned.saved);
});
