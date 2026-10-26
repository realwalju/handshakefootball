import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('client boots, starts warm-up, responds to movement and passing, and returns to lobby',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),elements=new Map(),events={};
 const noop=()=>{};const ctx=new Proxy({}, {get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 function element(id){if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle:noop},matches:()=>false,querySelector:()=>({disabled:false}),showModal(){this.open=true;},close(){this.open=false;},getContext:()=>ctx});return elements.get(id);}
 for(const match of html.matchAll(/id="([^"]+)"/g))element(match[1]);
 const buttons=['pass','through','shoot','switch','tackle'].map(kind=>({dataset:{action:kind}})),pad={id:'Test Standard Gamepad',index:0,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};let tick;
 const sandbox={console,URL,URLSearchParams,Math,JSON,Number,String,Map,Set,performance:{now:()=>1500},location:{href:'file:///touchline-duel-demo.html',protocol:'file:',search:''},sessionStorage:{getItem:()=>null,removeItem:noop},navigator:{getGamepads:()=>[pad]},window:{scrollTo:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:f=>tick=f,addEventListener:(name,fn)=>events[name]=fn,document:{getElementById:id=>{assert.ok(elements.has(id),`missing #${id}`);return element(id);},querySelector:()=>element('brand'),querySelectorAll:()=>buttons,addEventListener:noop}};
 const context=vm.createContext(sandbox);let engine=await readFile(new URL('../public/engine.js',import.meta.url),'utf8'),client=await readFile(new URL('../public/client.js',import.meta.url),'utf8');vm.runInContext(engine.replace(/export /g,'')+'\n'+client.replace(/^import [^\r\n]+\r?\n/,''),context);
 tick(0);await element('view3dButton').onclick();assert.equal(element('pitch').hidden,false);assert.match(element('viewHint').textContent,/keep playing in 2D/);element('practiceButton').onclick();for(let i=1;i<78;i++)tick(i*17);assert.equal(element('lobby').hidden,true);assert.match(element('status').textContent,/WARM UP/);
 assert.match(element('controllerStatus').textContent,/Test Standard Gamepad/);const selected=vm.runInContext('game.selected[0]',context),before=vm.runInContext('game.players[game.selected[0]].x',context);
 pad.axes[0]=1;for(let i=78;i<88;i++)tick(i*17);pad.axes[0]=0;tick(88*17);assert.ok(vm.runInContext('game.players[game.selected[0]].x',context)>before);
 pad.buttons[0].pressed=true;tick(89*17);pad.buttons[0].pressed=false;tick(90*17);assert.equal(vm.runInContext('game.selected[0]',context),selected);assert.equal(vm.runInContext('game.ball.owner',context),null);
 for(let i=91;i<220&&vm.runInContext('game.ball.owner===null',context);i++)tick(i*17);assert.equal(vm.runInContext('game.selected[0]===game.ball.owner',context),true);assert.notEqual(vm.runInContext('game.selected[0]',context),selected);assert.match(element('playerLabel').innerHTML,/CORAL/);
 element('leaveButton').onclick();assert.equal(element('lobby').hidden,false);assert.equal(element('status').textContent,'READY TO PLAY');
});
