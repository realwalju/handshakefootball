import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {createPostgresStore} from '../lib/postgres-store.mjs';
import {createRoomService} from '../lib/room-service.mjs';

test('real Postgres serializes two independent players without losing state',async()=>{
  const storeA=createPostgresStore(),storeB=createPostgresStore();await storeA.setup();await storeB.ping();
  const a=createRoomService(storeA),b=createRoomService(storeB),host=await a('create',{}, {},'database-integration-test');let guest;
  try{
    const joins=await Promise.allSettled([a('join',{room:host.room}),b('join',{room:host.room})]);
    assert.equal(joins.filter(r=>r.status==='fulfilled').length,1);assert.equal(joins.find(r=>r.status==='rejected').reason.status,409);
    guest=joins.find(r=>r.status==='fulfilled').value;
    await a('sync',{},host);await b('sync',{},guest);
    const saved=await storeA.read(host.room,Date.now());saved.room.game.phase='playing';
    assert.equal(await storeA.compareAndSet(host.room,saved.version,saved.room,Date.now()),true);
    const stale=structuredClone(saved.room);assert.equal(await storeB.compareAndSet(host.room,saved.version,stale,Date.now()),false);
    await Promise.all([a('sync',{x:1},host),b('sync',{x:-1},guest)]);
    const before=(await storeA.read(host.room,Date.now())).room.game.players[9].x;
    await wait(100);const packets=await Promise.all([a('sync',{x:1},host),b('sync',{x:-1},guest)]);
    assert.ok(packets.every(p=>p.status==='connected'));assert.ok(packets.some(p=>p.game.players[9].x>before));
    await a('action',{kind:'pass',x:1,y:0},host);const next=await b('sync',{},guest);
    assert.notEqual(next.game.selected[0],9);assert.equal(next.game.players.length,22);
    assert.ok(!JSON.stringify(next).includes(host.token));assert.ok(!JSON.stringify(next).includes(guest.token));
    await a('leave',{},host);assert.equal((await b('sync',{},guest)).status,'paused');
  }finally{
    await a('leave',{},host).catch(()=>{});if(guest)await b('leave',{},guest).catch(()=>{});
  }
});
