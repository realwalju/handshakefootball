import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,action,W,H} from '../public/engine.js';
const playable=()=>{const g=createGame();g.phase='playing';return g;};
test('two complete teams, opposing formations, and a human-controlled kickoff',()=>{const g=createGame();assert.equal(g.players.length,22);assert.equal(g.players.filter(p=>p.n===1).length,2);assert.equal(g.ball.owner,g.selected[0]);assert.ok(g.players[11].x>g.players[0].x);});
test('roles carry distinct pace, control and awareness traits',()=>{const g=createGame(),winger=g.players[5],centreBack=g.players[2],midfielder=g.players[7];assert.ok(winger.pace>centreBack.pace);assert.ok(midfielder.control>centreBack.control);assert.ok(midfielder.awareness>winger.awareness);});
test('a pass keeps the passer selected until somebody controls the ball',()=>{const g=playable(),id=g.ball.owner;for(const p of g.players.filter(p=>p.team===1)){p.x=1000;p.y=60;}assert.equal(action(g,0,'pass',1,0),true);const target=g.pass.to;assert.equal(g.ball.owner,null);assert.equal(g.selected[0],id);const speed=Math.hypot(g.ball.vx,g.ball.vy);assert.ok(speed>=155&&speed<=245);for(let n=0;n<180&&g.ball.owner===null;n++){assert.equal(g.selected[0],id);step(g);}assert.equal(g.ball.owner,target);assert.equal(g.selected[0],target);});
test('the opponent cannot pass a ball it does not possess',()=>{const g=playable();assert.equal(action(g,1,'pass',-1,0),false);assert.equal(g.ball.owner,9);});
test('each human can switch defenders and send a through ball without an early handoff',()=>{
 for(const team of [0,1]){
  const g=playable(),old=g.selected[team];g.ball.owner=null;
  assert.equal(action(g,team,'switch'),true);assert.notEqual(g.selected[team],old);assert.equal(g.players[g.selected[team]].team,team);assert.notEqual(g.players[g.selected[team]].n,1);
  const carrier=g.players[team*11+9];g.selected[team]=carrier.id;g.ball.owner=carrier.id;
  assert.equal(action(g,team,'through',team?-1:1,0),true);assert.equal(g.ball.owner,null);assert.equal(g.selected[team],carrier.id);assert.equal(g.players[g.pass.to].team,team);
 }
});
test('an interception transfers the defending player only after contact',()=>{const g=playable(),passer=g.selected[0],interceptor=g.players[16];g.selected[1]=20;for(const p of g.players){p.x=80;p.y=80;}Object.assign(interceptor,{x:500,y:340});g.pass={team:0,from:passer,to:10,x:700,y:340,through:false,time:2};g.ball={x:487,y:340,vx:180,vy:0,owner:null,lock:0,last:0};assert.equal(g.selected[0],passer);assert.notEqual(g.selected[1],interceptor.id);step(g,[{},{}],.05);assert.equal(g.ball.owner,interceptor.id);assert.equal(g.selected[0],passer);assert.equal(g.selected[1],interceptor.id);});
test('invalid action directions cannot corrupt the shared simulation',()=>{
 for(const bad of [null,'left',{},NaN,Infinity]){
  const g=playable(),before=JSON.stringify(g);
  assert.equal(action(g,0,'shoot',bad,0),false);assert.equal(JSON.stringify(g),before);
  assert.equal(action(g,0,'pass',1,bad),false);assert.equal(JSON.stringify(g),before);
 }
});
test('a keeper catches passes but parries hard shots without tunnelling',()=>{
 const fixture=speed=>{const g=playable();for(const p of g.players){p.x=400;p.y=80;}const keeper=g.players[11];keeper.x=W-30;keeper.y=340;g.ball={x:W-35,y:340,vx:speed,vy:0,owner:null,lock:0,last:0};return {g,keeper};};
 let {g,keeper}=fixture(180);g.pass={team:0,to:10,time:1};step(g,[{},{}],.05);assert.equal(g.ball.owner,keeper.id);
 ({g,keeper}=fixture(900));step(g,[{},{}],.05);assert.equal(g.ball.owner,null);assert.equal(g.message,'SAVE · LOOSE BALL');assert.ok(g.ball.vx<900);assert.deepEqual(g.score,[0,0]);
});
test('crossing the goal line scores once and restarts with the conceding team',()=>{const g=playable();g.ball={x:W-1,y:340,vx:900,vy:0,owner:null,lock:1,last:0};step(g);assert.deepEqual(g.score,[1,0]);assert.equal(g.phase,'goal');assert.equal(g.players[g.ball.owner].team,1);for(let i=0;i<30;i++)step(g);assert.deepEqual(g.score,[1,0]);});
test('touchline exit awards possession to the other team',()=>{const g=playable();g.ball={x:400,y:1,vx:0,vy:-400,owner:null,lock:1,last:0};step(g);assert.equal(g.phase,'restart');assert.equal(g.message,'THROW IN');assert.equal(g.players[g.ball.owner].team,1);});
test('keeper distributes before control transfers to the receiving outfielder',()=>{const g=playable();g.ball.owner=0;g.selected[0]=0;g.players[0].cool=.8;for(let i=0;i<60&&g.ball.owner===0;i++)step(g);assert.equal(g.ball.owner,null);assert.equal(g.selected[0],0);for(let i=0;i<180&&g.ball.owner===null;i++)step(g);assert.notEqual(g.ball.owner,0);assert.equal(g.selected[0],g.ball.owner);});
test('a full match ends with finite positions and cannot score afterward',()=>{const g=playable();g.bot=[true,true];for(let i=0;i<12000&&g.phase!=='ended';i++){step(g,[{},{}]);for(const p of g.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H);}}assert.equal(g.phase,'ended');assert.equal(g.clock,0);const score=[...g.score];step(g);assert.deepEqual(g.score,score);});
