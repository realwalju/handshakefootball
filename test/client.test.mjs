import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('client boots, starts warm-up, responds to movement and passing, and returns to lobby',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),elements=new Map(),events={};
 const noop=()=>{};const ctx=new Proxy({}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 function element(id){if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle:noop},matches:()=>false,querySelector:()=>({disabled:false}),showModal(){this.open=true;},close(){this.open=false;},getContext:()=>ctx});return elements.get(id);}
 for(const match of html.matchAll(/id="([^"]+)"/g))element(match[1]);
 const buttons=['pass','through','shoot','switch','tackle'].map(kind=>({dataset:{action:kind}}));let tick;
 const sandbox={console,URL,URLSearchParams,Math,JSON,Number,String,Map,Set,performance:{now:()=>1500},location:{href:'file:///touchline-duel-demo.html',protocol:'file:',search:''},sessionStorage:{getItem:()=>null,removeItem:noop},navigator:{},window:{scrollTo:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:f=>tick=f,addEventListener:(name,fn)=>events[name]=fn,document:{getElementById:id=>{assert.ok(elements.has(id),`missing #${id}`);return element(id);},querySelector:()=>element('brand'),querySelectorAll:()=>buttons,addEventListener:noop}};
 const context=vm.createContext(sandbox);let engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');vm.runInContext(engine.replace(/export /g,'')+'\n'+client.replace(/^import .*\n/,''),context);
 tick(0);element('practiceButton').onclick();for(let i=1;i<78;i++)tick(i*17);assert.equal(element('lobby').hidden,true);assert.match(element('status').textContent,/WARM UP/);
 const selected=vm.runInContext('game.selected[0]',context);events.keydown({key:'j',target:{matches:()=>false},repeat:false,preventDefault:noop});assert.notEqual(vm.runInContext('game.selected[0]',context),selected);
 const before=vm.runInContext('game.players[game.selected[0]].x',context);events.keydown({key:'d',target:{matches:()=>false},repeat:false,preventDefault:noop});for(let i=78;i<88;i++)tick(i*17);events.keyup({key:'d'});assert.ok(vm.runInContext('game.players[game.selected[0]].x',context)>before);assert.match(element('playerLabel').innerHTML,/CORAL/);
 element('leaveButton').onclick();assert.equal(element('lobby').hidden,false);assert.equal(element('status').textContent,'READY TO PLAY');
});
