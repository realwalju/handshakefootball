import {randomBytes,createHash} from 'node:crypto';
import {createGame,step,action} from '../public/engine.js';

export const PRESENCE_MS=2000,INPUT_MS=400,TICK_MS=1000/30;
export const fail=(status,message)=>Object.assign(new Error(message),{status});
const member=token=>({token,online:false,seen:0,inputAt:0,input:{},lastAction:0});
const live=(m,now)=>!!m?.online&&now-m.seen<PRESENCE_MS;
const credentials=(room,token)=>{
  const team=typeof token==='string'&&token?room.members.findIndex(m=>m&&m.token===token):-1;
  if(team<0)throw fail(403,'Invalid player session');
  return team;
};
function advance(room,now){
  const until=Math.min(now,...room.members.map(m=>m?.online?m.seen+PRESENCE_MS:-Infinity));
  // Never simulate time during a disconnect or an unbounded serverless cold start.
  room.lastTick=Math.max(room.lastTick,until-PRESENCE_MS);
  while(room.lastTick+TICK_MS<=until){
    room.lastTick+=TICK_MS;
    step(room.game,room.members.map(m=>room.lastTick-m.inputAt<=INPUT_MS?m.input:{}),1/30);
  }
  if(until<now)room.lastTick=now;
}
function snapshot(room,now){
  const connected=room.members.map(m=>live(m,now));
  return {game:room.game,room:room.code,connected,rematch:room.votes,
    status:connected.every(Boolean)?'connected':room.members[1]?'paused':'waiting'};
}

export function createRoomService(store,{clock=Date.now}={}){
  return async function perform(operation,data={},session={},ip='unknown'){
    const now=clock();
    if(operation==='create'){
      const key=createHash('sha256').update(ip).digest('hex');
      if(!await store.allowCreate(key,now))throw fail(429,'Too many new matches. Please wait a minute.');
      for(let attempt=0;attempt<5;attempt++){
        const code=randomBytes(3).toString('hex').toUpperCase(),token=randomBytes(24).toString('hex');
        const room={code,game:createGame(),members:[member(token),null],votes:[false,false],lastTick:now};
        if(await store.create(code,room,now))return {room:code,token,team:0};
      }
      throw fail(503,'All rooms are busy. Try again shortly.');
    }
    const code=String(operation==='join'?data.room:session.room||'').trim().toUpperCase();
    if(!/^[A-F0-9]{6}$/.test(code))throw fail(404,'Room not found. Check the six-character code.');
    if(operation==='action'&&(!['pass','through','shoot','switch','tackle'].includes(data.kind)||
      ['x','y','power'].some(k=>data[k]!==undefined&&!Number.isFinite(data[k]))))throw fail(400,'Invalid action or direction');
    for(let attempt=0;attempt<12;attempt++){
      const saved=await store.read(code,now);
      if(!saved)throw fail(404,'Room not found. Create a new match.');
      const room=saved.room;
      // Authenticate before advancing; unauthorized requests cannot move the clock.
      const team=operation==='join'?-1:credentials(room,session.token);
      advance(room,now);
      let result={ok:true};
      if(operation==='join'){
        if(room.members[1])throw fail(409,'This room already has two players.');
        const token=randomBytes(24).toString('hex');room.members[1]=member(token);
        result={room:code,token,team:1};
      }else{
        const m=room.members[team];
        if(operation==='sync'||operation==='input'){
          if(now>=m.inputAt){m.input={x:Number.isFinite(data.x)?Math.max(-1,Math.min(1,data.x)):0,
            y:Number.isFinite(data.y)?Math.max(-1,Math.min(1,data.y)):0,sprint:!!data.sprint};m.inputAt=now;}
          m.seen=Math.max(now,m.seen);m.online=true;
        }
        if(operation==='action'&&room.members.every(p=>live(p,now))&&now-m.lastAction>=80){
          action(room.game,team,data.kind,data.x,data.y,data.power);m.lastAction=now;
        }
        if(operation==='rematch'&&room.game.phase==='ended'){
          room.votes[team]=true;
          if(room.votes.every(Boolean)){room.game=createGame();room.votes=[false,false];room.lastTick=now;}
        }
        if(operation==='leave'){m.online=false;m.input={};}
        if(operation==='sync')result=snapshot(room,now);
      }
      if(await store.compareAndSet(code,saved.version,room,now))return result;
    }
    throw fail(503,'The match is busy. Please try again.');
  };
}
