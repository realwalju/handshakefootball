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
    // Establish possession for the pass check: real request latency lets supporting
    // defenders move, so an uncontrolled match is not a deterministic pass fixture.
    const fixture=await storeA.read(host.room,Date.now()),game=fixture.room.game,carrier=game.selected[0];
    game.ball.owner=carrier;game.ball.lock=0;game.players[carrier].cool=0;
    game.players[carrier].x=500;game.players[carrier].y=340;game.players[carrier].fx=1;game.players[carrier].fy=0;
    for(const player of game.players)if(player.team===1){player.x=900;player.y=600;}
    for(const player of fixture.room.members){player.input={};player.inputAt=player.seen=Date.now();}
    fixture.room.lastTick=Date.now();
    assert.equal(await storeA.compareAndSet(host.room,fixture.version,fixture.room,Date.now()),true);
    await a('action',{kind:'pass',x:1,y:0},host);
    assert.equal((await storeA.read(host.room,Date.now())).room.game.selected[0],carrier);
    let next;for(let n=0;n<30;n++){await wait(80);const packets=await Promise.all([a('sync',{},host),b('sync',{},guest)]);next=packets[1];if(next.game.selected[0]!==carrier)break;}
    assert.notEqual(next.game.selected[0],carrier);assert.equal(next.game.selected[0],next.game.ball.owner);assert.equal(next.game.players.length,22);
    assert.ok(!JSON.stringify(next).includes(host.token));assert.ok(!JSON.stringify(next).includes(guest.token));
    await a('leave',{},host);assert.equal((await b('sync',{},guest)).status,'paused');
  }finally{
    await a('leave',{},host).catch(()=>{});if(guest)await b('leave',{},guest).catch(()=>{});
  }
});
