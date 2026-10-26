import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';

test('room creation, joining, authenticated input, shared snapshots, disconnect pause and rematch',async()=>{
 const {server,rooms}=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const controllers=[];
 async function post(path,data={},s){const u=new URL(path,base);if(s)u.searchParams.set('room',s.room);return fetch(u,{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:`Bearer ${s.token}`}:{})},body:JSON.stringify(data)});}
 async function stream(s){const c=new AbortController();controllers.push(c);const r=await fetch(`${base}/api/events?room=${s.room}&token=${s.token}`,{signal:c.signal});const reader=r.body.getReader();let buffer='';return {controller:c,async next(){const timeout=setTimeout(()=>c.abort(),3000);try{while(true){const pos=buffer.indexOf('\n\n');if(pos>=0){const block=buffer.slice(0,pos);buffer=buffer.slice(pos+2);const data=block.split('\n').find(l=>l.startsWith('data: '));if(data)return JSON.parse(data.slice(6));}const v=await reader.read();if(v.done)throw Error('Stream ended');buffer+=new TextDecoder().decode(v.value);}}finally{clearTimeout(timeout);}}};}
 try{
  const host=await (await post('/api/create')).json();assert.match(host.room,/^[A-F0-9]{6}$/);assert.equal(host.team,0);
  const bad=await fetch(`${base}/api/events?room=${host.room}&token=wrong`);assert.equal(bad.status,403);
  const hs=await stream(host);assert.equal((await hs.next()).status,'waiting');
  const guest=await (await post('/api/join',{room:host.room.toLowerCase()})).json();assert.equal(guest.team,1);assert.equal((await post('/api/join',{room:host.room})).status,409);
  const gs=await stream(guest);assert.equal((await gs.next()).status,'connected');
  const r=rooms.get(host.room);r.game.phase='playing';const before=r.game.players[9].x;await post('/api/input',{x:1,y:0},host);
  let packet;for(let i=0;i<12;i++){packet=await gs.next();if(packet.game.players[9].x>before+1)break;}assert.ok(packet.game.players[9].x>before+1);assert.equal(packet.game.players.length,22);
  assert.equal((await post('/api/input',{x:1}, {...host,token:'bad'})).status,403);
  gs.controller.abort();await new Promise(resolve=>setTimeout(resolve,60));const frozen=r.game.clock;await new Promise(resolve=>setTimeout(resolve,90));assert.equal(r.game.clock,frozen);
  const re=await stream(guest);assert.equal((await re.next()).status,'connected');r.game.phase='ended';await post('/api/rematch',{},host);assert.equal(r.game.phase,'ended');await post('/api/rematch',{},guest);assert.equal(r.game.phase,'kickoff');assert.deepEqual(r.game.score,[0,0]);
 }finally{for(const c of controllers)c.abort();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
