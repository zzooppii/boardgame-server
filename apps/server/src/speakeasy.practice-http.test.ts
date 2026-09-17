import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import express from 'express';
import {registerSpeakeasyPractice} from './games/speakeasy/practice/http.js';
import {safeParse} from 'valibot';
import {SpeakeasyPracticeReplySchema} from '@hangul-rummikub/shared';

test('Practice HTTP authenticates sessions, validates bodies, handles replay and closes a game',async()=>{
  const app=express();registerSpeakeasyPractice(app);const server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const address=server.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}/api/speakeasy-practice`;
    const created=await fetch(url,{method:'POST'});assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'no-store');
    const body:unknown=await created.json();assert.ok(typeof body==='object'&&body!==null&&'token' in body&&typeof body.token==='string'&&'view' in body);
    const parsed=safeParse(SpeakeasyPracticeReplySchema,{ok:true,view:body.view});assert.ok(parsed.success&&parsed.output.ok);
    const headers={Authorization:`Bearer ${body.token}`,'Content-Type':'application/json'};
    assert.equal((await fetch(url)).status,401);
    const command={gameId:parsed.output.view.gameId,revision:0,requestId:'once',action:{type:'PRODUCE'}};
    const results=await Promise.all(Array.from({length:4},()=>fetch(`${url}/command`,{method:'POST',headers,body:JSON.stringify(command)}).then(r=>r.json())));
    for(const result of results){const reply=safeParse(SpeakeasyPracticeReplySchema,result);assert.ok(reply.success&&reply.output.ok);assert.equal(reply.output.view.revision,1);assert.equal(reply.output.view.stock,2);assert.equal(JSON.stringify(reply.output).includes(body.token),false);}
    const malformed=await fetch(`${url}/command`,{method:'POST',headers,body:'{'});assert.equal(malformed.status,400);
    assert.deepEqual(await malformed.json(),{ok:false,reason:'INVALID_COMMAND'});
    const attack=await fetch(`${url}/command`,{method:'POST',headers,body:JSON.stringify({...command,requestId:'forge',revision:1,action:{type:'PRODUCE',quantity:1000}})});
    assert.deepEqual(await attack.json(),{ok:false,reason:'INVALID_COMMAND'});
    assert.equal((await fetch(url,{method:'DELETE',headers})).status,204);
    assert.deepEqual(await (await fetch(url,{headers})).json(),{ok:false,reason:'SESSION_EXPIRED'});
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
