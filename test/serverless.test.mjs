import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRoomService,PRESENCE_MS} from '../lib/room-service.mjs';
import {createServerlessHandler} from '../lib/serverless-handler.mjs';
import {memoryStore} from './helpers/memory-store.mjs';
async function fixture(){
  let now=100000;const store=memoryStore(),a=createRoomService(store,{clock:()=>now}),b=createRoomService(store,{clock:()=>now});
  const host=await a('create'),guest=await b('join',{room:host.room.toLowerCase()});
  return {store,a,b,host,guest,advance:ms=>{now+=ms;}};
}

test('separate serverless instances share both humans, clock, passing and defender switching',async()=>{
  const f=await fixture();let state=await f.a('sync',{},f.host);assert.equal(state.status,'paused');assert.equal(state.game.clock,180);
  f.advance(10000);state=await f.b('sync',{},f.guest);assert.equal(state.status,'paused');assert.equal(state.game.clock,180);
  await f.a('sync',{},f.host);f.advance(1300);
  const [host,guest]=await Promise.all([f.a('sync',{x:1},f.host),f.b('sync',{x:-1},f.guest)]);
  assert.equal(guest.status,'connected');assert.equal(guest.game.phase,'playing');assert.ok(guest.game.clock>179&&guest.game.clock<180);
  assert.equal(host.game.clock,guest.game.clock);assert.equal(guest.game.players.length,22);assert.ok(f.store.conflicts>0);
  f.advance(100);await f.a('action',{kind:'pass',x:1,y:0},f.host);
  state=await f.b('sync',{},f.guest);assert.notEqual(state.game.selected[0],9);assert.equal(state.game.ball.owner,null);
  const old=state.game.selected[1];await f.b('action',{kind:'switch'},f.guest);
  state=await f.a('sync',{},f.host);assert.notEqual(state.game.selected[1],old);
  assert.ok(!JSON.stringify(state).includes(f.host.token));assert.ok(!JSON.stringify(state).includes(f.guest.token));
});
test('concurrent join requests reserve exactly one guest seat',async()=>{
  const store=memoryStore(),a=createRoomService(store),b=createRoomService(store),host=await a('create');
  const results=await Promise.allSettled([a('join',{room:host.room}),b('join',{room:host.room})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
test('expired presence pauses the clock, reconnect resumes, and rematch needs both votes',async()=>{
  const f=await fixture();await f.a('sync',{},f.host);await f.b('sync',{},f.guest);f.advance(1300);await f.a('sync',{},f.host);
  f.advance(PRESENCE_MS+100);await f.a('sync',{},f.host);const paused=(await f.a('sync',{},f.host)).game.clock;
  f.advance(5000);assert.equal((await f.a('sync',{},f.host)).game.clock,paused);
  await f.b('sync',{},f.guest);f.advance(100);assert.ok((await f.a('sync',{},f.host)).game.clock<paused);
  const saved=f.store.rooms.get(f.host.room);saved.room.game.clock=.01;f.advance(100);
  assert.equal((await f.b('sync',{},f.guest)).game.phase,'ended');
  await f.a('rematch',{},f.host);assert.equal((await f.b('sync',{},f.guest)).game.phase,'ended');
  await f.b('rematch',{},f.guest);const fresh=await f.a('sync',{},f.host);assert.equal(fresh.game.clock,180);assert.deepEqual(fresh.game.score,[0,0]);
});
test('invalid credentials and malformed actions cannot mutate shared rooms',async()=>{
  const f=await fixture(),version=f.store.rooms.get(f.host.room).version;
  for(const token of [undefined,'bad',null])await assert.rejects(f.a('sync',{}, {...f.host,token}),{status:403});
  await assert.rejects(f.a('action',{kind:'shoot',x:null},f.host),{status:400});
  assert.equal(f.store.rooms.get(f.host.room).version,version);
  f.advance(1200001);await assert.rejects(f.a('sync',{},f.host),{status:404});
});
test('serverless HTTP routes validate bodies and origins and expose polling configuration',async()=>{
  const server=http.createServer(createServerlessHandler(memoryStore()));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await (await fetch(base+'/api/config')).json()).transport,'poll');
    assert.equal((await fetch(base+'/health')).status,200);
    const post=(data,headers={})=>fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
    for(const bad of [null,[],true,'oops'])assert.equal((await post(bad)).status,400);
    assert.equal((await post({padding:'x'.repeat(4096)})).status,413);
    assert.equal((await post({}, {Origin:'https://unrelated.example'})).status,403);
    const res=await post({});assert.equal(res.status,200);assert.match((await res.json()).room,/^[A-F0-9]{6}$/);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
