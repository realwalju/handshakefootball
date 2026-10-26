import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,action,W,H} from '../public/engine.js';
const playing=()=>{const g=createGame();g.phase='playing';for(const p of g.players)p.cool=100;return g;};
const run=(g,frames,input=[{},{}])=>{for(let i=0;i<frames;i++)step(g,input);};

test('human movement accelerates, brakes and reverses with momentum',()=>{
  const g=playing(),p=g.players[g.selected[0]];step(g,[{x:1},{}]);
  assert.ok(p.vx>0&&p.vx<10);run(g,15,[{x:1},{}]);const speed=p.vx;
  assert.ok(speed>=45&&speed<=58);step(g,[{x:-1},{}]);assert.ok(p.vx>0&&p.vx<speed);
  const slowing=p.vx;step(g,[{},{}]);assert.ok(p.vx>=0&&p.vx<slowing);
  run(g,20);assert.ok(Math.hypot(p.vx,p.vy)<1);
});
test('teammates create independent support angles and preserve width behind a stationary carrier',t=>{
  const g=playing(),start=g.players.map(p=>({...p}));run(g,120);
  const carrier=g.players[9],teammates=g.players.filter(p=>p.team===0&&p.n!==1&&p.id!==9);
  const moved=teammates.filter(p=>Math.hypot(p.x-start[p.id].x,p.y-start[p.id].y)>40);
  const nearby=teammates.filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<240);
  const angles=new Set(moved.map(p=>Math.round(Math.atan2(p.y-start[p.id].y,p.x-start[p.id].x)/.6)));
  t.diagnostic(`Moved: ${moved.length}; support options: ${nearby.length}; distinct run directions: ${angles.size}`);
  assert.ok(moved.length>=5);assert.ok(nearby.length>=2);assert.ok(angles.size>=3);
  assert.ok(teammates.some(p=>p.y<100)&&teammates.some(p=>p.y>H-100));
  assert.deepEqual(new Set(teammates.map(p=>p.intent).filter(i=>/option|diagonal/.test(i))),new Set(['wall pass option','forward diagonal','recycle option']));
  assert.ok(teammates.some(p=>p.intent==='line-breaking run'));
  assert.ok(g.players[2].x<carrier.x&&g.players[3].x<carrier.x);
});
test('directional passing exposes a wall option, forward diagonal and recycle outlet',()=>{
  const base=playing();run(base,120);const found=new Set(),receivers=new Set();
  for(const [x,y] of [[1,0],[0,-1],[-1,0]]){const g=structuredClone(base);g.players[g.ball.owner].cool=0;assert.equal(action(g,0,'pass',x,y),true);const receiver=g.players[g.selected[0]];found.add(receiver.intent);receivers.add(receiver.id);}
  assert.deepEqual(found,new Set(['forward diagonal','wall pass option','recycle option']));assert.equal(receivers.size,3);
});
test('defenders press and cover without every player chasing the ball',t=>{
  const g=playing();run(g,100);const b=g.ball,defenders=g.players.filter(p=>p.team===1&&p.n!==1);
  const close=defenders.filter(p=>Math.hypot(p.x-b.x,p.y-b.y)<45),cover=defenders.filter(p=>p.x>b.x+45);
  t.diagnostic(`Challenging at close range: ${close.length}; goal-side defenders: ${cover.length}`);
  assert.ok(close.length>=1&&close.length<=2);assert.ok(cover.length>=3);
});
function throughFixture(){
  const g=playing();for(const p of g.players){p.x=p.team?950:180;p.y=70;}
  Object.assign(g.players[9],{x:500,y:340,cool:0});Object.assign(g.players[10],{x:650,y:400,cool:0});
  g.ball={x:512,y:340,vx:0,vy:0,owner:9,lock:0,last:0};return g;
}
test('a through-ball receiver runs onto the pass without input while the passer moves forward',()=>{
  const g=throughFixture(),receiverX=g.players[10].x;assert.equal(action(g,0,'through',1,0),true);assert.equal(g.selected[0],10);
  assert.ok(g.pass.x>receiverX);assert.ok(Math.hypot(g.ball.vx,g.ball.vy)>=195&&Math.hypot(g.ball.vx,g.ball.vy)<=285);
  run(g,30);assert.ok(g.players[10].x>680);assert.ok(g.players[9].x>545);
  assert.equal(g.ball.owner,10);
});
test('manual steering overrides the receiving run immediately',()=>{
  const g=throughFixture();action(g,0,'through',1,0);run(g,10,[{x:-1},{}]);
  assert.ok(g.players[10].x<650);assert.ok(g.players[10].vx<0);
});
test('automatic pressure must stay goal-side before committing a challenge',()=>{
  const g=playing();for(const p of g.players.filter(p=>p.team===1))Object.assign(p,{x:900,y:80});
  const defender=g.players[21];Object.assign(defender,{x:540,y:340,fx:-1,fy:0,cool:0});
  step(g);assert.equal(g.ball.owner,9);
  run(g,18);assert.notEqual(g.ball.owner,21);
});
test('a standing tackle knocks an exposed ball loose and has a recovery window',()=>{
  const g=playing(),p=g.players[20];Object.assign(p,{x:530,y:340,fx:-1,fy:0,cool:0});
  assert.equal(action(g,1,'tackle'),true);assert.equal(g.ball.owner,null);assert.ok(g.ball.vx<0);
  run(g,7);assert.equal(action(g,1,'tackle'),false);
});
test('a first touch settles an incoming pass and queues the next action',()=>{
  const g=playing(),p=g.players[5];g.selected[0]=p.id;p.cool=0;
  for(const q of g.players)if(q.id!==p.id){q.x=q.team?990:90;q.y=80;}
  g.ball={x:p.x-13,y:p.y,vx:180,vy:0,owner:null,lock:0,last:1};
  step(g,[{},{}],.05);assert.equal(g.ball.owner,p.id);assert.ok(p.controlTime>0);
  assert.equal(action(g,0,'pass',1,0),true);assert.equal(g.ball.owner,p.id);assert.equal(p.buffer.kind,'pass');
  for(let n=0;n<20&&g.ball.owner===p.id;n++)step(g);
  assert.equal(g.ball.owner,null);assert.equal(p.buffer,null);
});
test('tactical decisions remain deterministic for the shared server simulation',()=>{
  const a=createGame(),b=createGame();a.bot=b.bot=[true,true];
  for(let i=0;i<600;i++){step(a);step(b);}assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('rooms created before the movement update can continue safely',()=>{
  const g=playing();delete g.press;delete g.pressHold;delete g.pass;
  for(const p of g.players){delete p.planTime;delete p.runTime;delete p.keeperHold;delete p.decisionTime;}
  run(g,60);for(const p of g.players){assert.ok(Number.isFinite(p.x+p.y+p.vx+p.vy));assert.ok(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H);}
});
