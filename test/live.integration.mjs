import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {setTimeout as wait} from 'node:timers/promises';

const base=new URL(process.env.TOUCHLINE_TEST_URL||'https://soccer.walju.net'),latencies=[];
let recoveredResponses=0;
const agent=new https.Agent({keepAlive:true,maxSockets:4});
function request(path,{data,session,method=data===undefined?'GET':'POST'}={}){
  const url=new URL(path,base);if(session)url.searchParams.set('room',session.room);
  const body=data===undefined?null:JSON.stringify(data),started=performance.now();
  const options={method,agent,headers:{...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),Origin:base.origin}:{}),
    ...(session?{Authorization:`Bearer ${session.token}`}:{})}};
  // Optional DNS override retains hostname/SNI and normal TLS certificate checks.
  // Useful while a freshly created custom domain is propagating to local DNS.
  if(process.env.TOUCHLINE_TEST_IPV4)options.lookup=(_host,settings,callback)=>{
    const address=process.env.TOUCHLINE_TEST_IPV4;
    settings.all?callback(null,[{address,family:4}]):callback(null,address,4);
  };
  return new Promise((resolve,reject)=>{
    const req=https.request(url,options,res=>{
      const chunks=[];res.on('data',part=>chunks.push(part));res.on('end',()=>{
        latencies.push(performance.now()-started);const text=Buffer.concat(chunks).toString('utf8');
        resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)});
      });res.on('error',reject);
    });
    req.setTimeout(10000,()=>req.destroy(new Error('Live request timed out')));req.on('error',reject);if(body)req.write(body);req.end();
  });
}
async function post(operation,data={},session){
  for(let attempt=0;attempt<5;attempt++){
    const result=await request(`/api/${operation}`,{data,session});
    // Match the browser's automatic sync retry after temporary upstream errors.
    // Auth/room failures remain fatal, and actions are never replayed.
    if(operation==='sync'&&attempt<4&&([502,503,504].includes(result.status)||
      result.status===404&&result.text.includes('DEPLOYMENT_NOT_FOUND'))){
      recoveredResponses++;await wait(200);continue;
    }
    assert.equal(result.status,200,`${operation}: ${result.text}`);return result.json();
  }
}
test('production game and storage health are publicly accessible without a login',async()=>{
  const home=await request('/');assert.equal(home.status,200);assert.match(home.text,/<title>Touchline Duel/);assert.match(home.text,/id="pitch3d"/);
  assert.equal((await request('/health')).json().ok,true);
  assert.equal((await request('/api/config')).json().transport,'poll');
  for(const path of ['/client.js','/engine.js','/style.css','/view-3d.js','/three-LICENSE.txt'])assert.equal((await request(path)).status,200);
  assert.equal((await request('/.env.local')).status,404);
});
test('published two-player match supports movement, passing, switching, reconnect, full time and rematch',{timeout:270000},async()=>{
  const host=await post('create');let guest;
  try{
    assert.equal((await post('sync',{},host)).status,'waiting');
    guest=await post('join',{room:host.room.toLowerCase()});
    assert.equal((await request('/api/join',{data:{room:host.room}})).status,409);
    assert.equal((await request('/api/sync',{data:{},session:{...host,token:'wrong'}})).status,403);
    const pair=async(hostInput={})=>Promise.all([post('sync',hostInput,host),post('sync',{},guest)]);
    let packets=await pair();
    while(packets[0].game.phase!=='playing'){await wait(100);packets=await pair();}
    assert.ok(packets.every(p=>p.status==='connected'&&p.game.players.length===22));
    // Pass at kickoff before dribbling into a pressing opponent.
    const id=packets[0].game.selected[0];
    await post('action',{kind:'pass',x:1,y:0},host);packets=await pair();
    assert.equal(packets[0].game.selected[0],id);assert.equal(packets[0].game.ball.owner,null);
    for(let n=0;n<25&&packets[0].game.selected[0]===id;n++){await wait(100);packets=await pair();}
    assert.notEqual(packets[0].game.selected[0],id,JSON.stringify({phase:packets[0].game.phase,owner:packets[0].game.ball.owner,selected:packets[0].game.selected,message:packets[0].game.message,cool:packets[0].game.players[id].cool}));
    assert.equal(packets[0].game.selected[0],packets[0].game.ball.owner);
    const receiver=packets[0].game.selected[0],before=packets[0].game.players[receiver].x;
    await pair({x:1});await wait(100);packets=await pair({x:1});assert.ok(packets[0].game.players[receiver].x>before);
    const defender=packets[1].game.selected[1];await post('action',{kind:'switch'},guest);packets=await pair();
    assert.notEqual(packets[1].game.selected[1],defender);
    assert.ok(!JSON.stringify(packets).includes(host.token));assert.ok(!JSON.stringify(packets).includes(guest.token));
    await post('leave',{},guest);const paused=await post('sync',{},host);assert.equal(paused.status,'paused');
    await wait(150);assert.equal((await post('sync',{},host)).game.clock,paused.game.clock);
    // The host's first response can precede the guest's reconnect commit.
    await pair();packets=await pair();assert.ok(packets.every(p=>p.status==='connected'));
    let reportAt=Date.now()+30000;
    console.log('Live match: controls, authentication and reconnect passed; checking the three-minute match loop.');
    while(packets[0].game.phase!=='ended'){
      await wait(150);packets=await pair();
      if(Date.now()>=reportAt){console.log(`Live match remaining: ${Math.ceil(packets[0].game.clock)} seconds`);reportAt=Date.now()+30000;}
    }
    assert.equal(packets[0].game.clock,0);assert.deepEqual(packets[0].game.score,packets[1].game.score);
    await post('rematch',{},host);assert.equal((await post('sync',{},host)).game.phase,'ended');
    await post('rematch',{},guest);const fresh=await post('sync',{},host);
    assert.equal(fresh.game.clock,180);assert.deepEqual(fresh.game.score,[0,0]);
    const sorted=latencies.toSorted((a,b)=>a-b);
    console.log(`Public match passed. Requests: ${latencies.length}; median ${Math.round(sorted[Math.floor(sorted.length*.5)])} ms; p95 ${Math.round(sorted[Math.floor(sorted.length*.95)])} ms; recovered upstream responses: ${recoveredResponses}.`);
  }finally{await post('leave',{},host).catch(()=>{});if(guest)await post('leave',{},guest).catch(()=>{});agent.destroy();}
});
