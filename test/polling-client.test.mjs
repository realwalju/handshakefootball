import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRoomService} from '../lib/room-service.mjs';
import {memoryStore} from './helpers/memory-store.mjs';

async function boot(fetcher){
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),elements=new Map(),events={},storage=new Map();
  const noop=()=>{},ctx=new Proxy({}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
  function element(id){
    if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',style:{},dataset:{},
      classList:{toggle:noop},matches:()=>false,querySelector:()=>({disabled:false}),
      showModal(){this.open=true;},close(){this.open=false;},getContext:()=>ctx});
    return elements.get(id);
  }
  for(const match of html.matchAll(/id="([^"]+)"/g))element(match[1]);
  const buttons=['pass','through','shoot','switch','tackle'].map(kind=>({dataset:{action:kind}}));let tick,poll;
  const sandbox={console,URL,URLSearchParams,Math,JSON,Number,String,Map,Set,AbortController,
    performance:{now:()=>1500},location:{href:'https://soccer.example',protocol:'https:',search:''},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    fetch:fetcher,navigator:{},window:{scrollTo:noop},setTimeout,clearTimeout,setInterval:f=>{poll=f;},
    requestAnimationFrame:f=>{tick=f;},addEventListener:(name,fn)=>events[name]=fn,
    document:{getElementById:id=>{assert.ok(elements.has(id),`missing #${id}`);return element(id);},
      querySelector:()=>element('brand'),querySelectorAll:()=>buttons,addEventListener:noop}};
  const context=vm.createContext(sandbox),engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),
    client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');
  vm.runInContext(engine.replace(/export /g,'')+'\n'+client.replace(/^import [^\r\n]+\r?\n/,''),context);
  return {element,events,storage,tick:now=>tick(now),poll:()=>poll(),run:code=>vm.runInContext(code,context)};
}
const key=(client,name,down=true)=>client.events[down?'keydown':'keyup']({key:name,target:{matches:()=>false},repeat:false,preventDefault(){}});
async function until(condition){for(let n=0;n<50;n++){await new Promise(setImmediate);if(condition())return;}assert.fail('Client did not settle');}

test('two browser clients create and join through polling, move, pass, switch and recover from a transient error',async()=>{
  let now=100000,failNext=false;const store=memoryStore(),perform=createRoomService(store,{clock:()=>now});
  const fetcher=async(path,options={})=>{
    const url=new URL(path,'https://soccer.example');
    if(url.pathname==='/api/config')return Response.json({transport:'poll'});
    if(failNext&&url.pathname==='/api/sync'){failNext=false;return Response.json({error:'Temporary error'},{status:503});}
    try{return Response.json(await perform(url.pathname.split('/').pop(),JSON.parse(options.body||'{}'),
      {room:url.searchParams.get('room'),token:options.headers?.Authorization?.replace('Bearer ','')},'test-browser'));}
    catch(e){return Response.json({error:e.message},{status:e.status||500});}
  };
  const host=await boot(fetcher),guest=await boot(fetcher);
  await host.element('createButton').onclick();await until(()=>host.run('connected'));
  assert.equal(host.element('status').textContent,'WAITING FOR RIVAL');
  guest.element('roomInput').value=host.run('session.room');guest.element('joinForm').onsubmit({preventDefault(){}});
  await until(()=>guest.run('connected'));host.poll();await until(()=>!host.run('inputBusy'));
  assert.equal(host.element('status').textContent,'LIVE MATCH');assert.equal(guest.element('status').textContent,'LIVE MATCH');
  now+=1400;host.poll();await until(()=>!host.run('inputBusy'));guest.poll();await until(()=>!guest.run('inputBusy'));
  const before=host.run('game.players[game.selected[0]].x');key(host,'d');host.poll();await until(()=>!host.run('inputBusy'));
  now+=100;host.poll();await until(()=>!host.run('inputBusy'));assert.ok(host.run('game.players[game.selected[0]].x')>before);
  key(host,'d',false);const carrier=host.run('game.selected[0]');key(host,'j');
  await until(()=>store.rooms.get(host.run('session.room')).room.game.selected[0]!==carrier);
  host.poll();await until(()=>!host.run('inputBusy'));guest.poll();await until(()=>!guest.run('inputBusy'));
  assert.equal(host.run('game.selected[0]'),guest.run('game.selected[0]'));
  const old=guest.run('game.selected[1]');key(guest,'q');await until(()=>store.rooms.get(host.run('session.room')).room.game.selected[1]!==old);
  failNext=true;host.poll();await until(()=>!host.run('inputBusy'));assert.equal(host.run('connected'),false);
  host.poll();await until(()=>!host.run('inputBusy'));assert.equal(host.run('connected'),true);
  guest.run('session.token="invalid"');guest.poll();await until(()=>guest.run('mode')==='lobby');
  assert.match(guest.element('error').textContent,/Invalid player session/);
  host.element('leaveButton').onclick();await new Promise(setImmediate);
});
