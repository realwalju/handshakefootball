export const W = 1050, H = 680, DURATION = 180;
// Ten simulation units equal one metre on the 105 x 68 metre pitch.
export const PACE = Object.freeze({jog:58,sprint:88,dribble:50,dribbleSprint:72,passMin:155,passMax:245,through:225,shotMin:220,shotMax:310});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const unit = (x,y) => {const d=Math.hypot(x,y)||1;return [x/d,y/d];};
const formation = [[55,340],[230,95],[200,255],[200,425],[230,585],[430,130],[385,275],[385,405],[430,550],[650,260],[650,420]];
const roles = ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'];
export function createGame() {
  const g={players:[],ball:{x:525,y:340,vx:0,vy:0,owner:null,lock:0,last:0},selected:[9,20],score:[0,0],clock:DURATION,phase:'kickoff',pause:1.2,message:'KICKOFF',kickTeam:0,bot:[false,false],aiTick:0,pass:null,press:[-1,-1],pressHold:[0,0]};
  for(let t=0;t<2;t++) formation.forEach(([x,y],n)=>g.players.push({id:t*11+n,team:t,n:n+1,role:roles[n],x:t?W-x:x,y,homeX:t?W-x:x,homeY:y,vx:0,vy:0,fx:t?-1:1,fy:0,stamina:1,cool:0}));
  resetPositions(g,0);return g;
}
function resetPositions(g,team) {
  for(const p of g.players){p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;p.fx=p.team?-1:1;p.fy=0;p.cool=0;p.tackleCool=0;p.challengeTime=0;p.controlTime=0;p.buffer=null;p.motionTime=0;p.planTime=0;p.runTime=0;p.keeperHold=0;p.decisionTime=0;}
  const k=g.players[team*11+9];k.x=team?540:510;k.y=340;
  const other=g.players[team*11+10];other.x=team?600:450;other.y=400;
  for(const p of g.players) if(p.team!==team) p.x=p.team?Math.max(p.x,570):Math.min(p.x,480);
  g.selected=[9,20];g.selected[team]=k.id;g.ball={x:k.x+(team?-12:12),y:k.y,vx:0,vy:0,owner:k.id,lock:0,last:team};
  g.kickTeam=team;
  g.pass=null;g.press=[-1,-1];g.pressHold=[0,0];
}
function nearest(g,team,x,y,exclude=-1,keeper=false) {
  return g.players.filter(p=>p.team===team&&p.id!==exclude&&(keeper||p.n!==1)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
}
export function switchPlayer(g,team) {
  if(![0,1].includes(team)||g.phase==='ended')return;
  const owner=g.players[g.ball.owner];
  if(owner?.team===team){g.selected[team]=owner.id;return;}
  const next=nearest(g,team,g.ball.x,g.ball.y,g.selected[team]);if(next)g.selected[team]=next.id;
}
export function action(g,team,kind,aimX=0,aimY=0,power=.65) {
  if(g.phase!=='playing'||![0,1].includes(team))return false;
  if(!Number.isFinite(aimX)||!Number.isFinite(aimY)||!Number.isFinite(power))return false;
  const p=g.players[g.selected[team]], b=g.ball;
  if(kind==='switch'){switchPlayer(g,team);return true;}
  if(p.cool>0)return false;
  if(kind==='tackle') {
    if(p.tackleCool>0)return false;
    challenge(g,p);
    return true;
  }
  if(b.owner!==p.id)return false;
  if(!['pass','through','shoot'].includes(kind))return false;
  // A tap during a first touch is retained and released when the feet are set.
  if(p.controlTime>0){p.buffer={kind,aimX,aimY,power};return true;}
  let dx=aimX,dy=aimY;if(Math.hypot(dx,dy)<.1){dx=p.fx;dy=p.fy;}
  [dx,dy]=unit(dx,dy);
  let speed=0;
  if(kind==='pass'||kind==='through'){
    const candidates=g.players.filter(q=>q.team===team&&q.id!==p.id&&q.n!==1).map(q=>{
      const d=dist(p,q), dot=((q.x-p.x)*dx+(q.y-p.y)*dy)/(d||1);
      return {q,d,dot,rank:dot*420-d*.35+passSpace(g,p,q)*1.4};
    }).filter(q=>q.d>25&&q.d<500).sort((a,b)=>b.rank-a.rank);
    const target=(candidates.find(c=>c.dot>.15)||candidates[0])?.q;if(!target)return false;
    const lead=kind==='through'?65:0,flight=clamp(dist(p,target)/190,.2,1.4);
    let tx=target.x+target.vx*flight*.65+(kind==='through'?(team?-lead:lead):0),ty=target.y+target.vy*flight*.65;
    [dx,dy]=unit(clamp(tx,15,W-15)-p.x,clamp(ty,15,H-15)-p.y);
    speed=kind==='through'?Math.max(PACE.through,clamp(dist(p,{x:tx,y:ty})*.55+120,PACE.through,280)):clamp(dist(p,target)*.5+100,PACE.passMin,PACE.passMax);
    g.pass={team,from:p.id,to:target.id,x:clamp(tx,15,W-15),y:clamp(ty,15,H-15),through:kind==='through',time:clamp(dist(p,target)/speed*2+1.2,2,5)};
    p.runTime=3.6;p.runX=clamp(p.x+(team?-100:100),40,W-40);p.runY=clamp(p.y+(p.y<H/2?-38:38),45,H-45);p.planTime=0;
    g.selected[team]=target.id;g.message=kind==='through'?'THROUGH BALL':'PASS';
  }else if(kind==='shoot'){
    g.pass=null;
    power=clamp(Number(power)||.65,.2,1);
    // Default facing shoots toward goal, directional input allows manual aiming.
    if(Math.hypot(aimX,aimY)<.1){[dx,dy]=unit((team?0:W)-p.x,340-p.y);}
    speed=PACE.shotMin+power*(PACE.shotMax-PACE.shotMin);g.message='SHOT';
  }else return false;
  b.owner=null;b.x=p.x+dx*10;b.y=p.y+dy*10;b.vx=dx*speed;b.vy=dy*speed;b.lock=.06;b.last=team;b.control=0;p.cool=.28;
  p.fx=dx;p.fy=dy;p.motion='kick';p.motionTime=.32;
  return true;
}
function turn(p,x,y,dt,rate=7){
  if(Math.hypot(x,y)<.01)return;
  const current=Math.atan2(p.fy,p.fx),target=Math.atan2(y,x),difference=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  const angle=current+clamp(difference,-rate*dt,rate*dt);p.fx=Math.cos(angle);p.fy=Math.sin(angle);
}
function locomotion(p,vx,vy,dt,human=false){
  const dx=vx-p.vx,dy=vy-p.vy,d=Math.hypot(dx,dy),braking=vx*p.vx+vy*p.vy<0||Math.hypot(vx,vy)<Math.hypot(p.vx,p.vy);
  const acceleration=human?(braking?230:155):(braking?190:120),amount=Math.min(1,acceleration*dt/(d||1));
  p.vx+=dx*amount;p.vy+=dy*amount;
  if(Math.hypot(vx,vy)<.1&&Math.hypot(p.vx,p.vy)<2)p.vx=p.vy=0;
  const x=p.x+p.vx*dt,y=p.y+p.vy*dt;p.x=clamp(x,9,W-9);p.y=clamp(y,9,H-9);
  if(p.x!==x)p.vx=0;if(p.y!==y)p.vy=0;
  if(Math.hypot(p.vx,p.vy)>5)turn(p,p.vx,p.vy,dt,human?5:4);
}
function challenge(g,p){
  const b=g.ball,owner=g.players[b.owner];p.tackleCool=.85;p.cool=.16;p.motion='tackle';p.motionTime=.4;p.challengeTime=0;
  // Reach the exposed ball, rather than stealing it through the carrier's body.
  if(!owner||owner.team===p.team||b.lock>0||dist(p,b)>19)return;
  const [dx,dy]=unit(b.x-p.x,b.y-p.y);
  if(dx*p.fx+dy*p.fy<-.15)return;
  b.owner=null;b.vx=dx*70+p.vx*.3;b.vy=dy*70+p.vy*.3;b.lock=.07;b.last=p.team;b.control=0;
  owner.cool=.35;owner.controlTime=0;owner.buffer=null;g.pass=null;g.message='BALL CHALLENGED';
}
function receive(g,p,x,y){
  const b=g.ball,incoming=Math.hypot(b.vx-p.vx,b.vy-p.vy),alignment=p.fx*(-b.vx)+p.fy*(-b.vy);
  p.controlTime=clamp(.12+incoming/1300+(alignment<0?.06:0),.14,.38);
  p.motion='touch';p.motionTime=p.controlTime;p.vx*=.7;p.vy*=.7;p.challengeTime=0;
  b.owner=p.id;b.x=x;b.y=y;b.last=p.team;b.lock=.07;b.control=p.controlTime;
  g.pass=null;if(p.n!==1)g.selected[p.team]=p.id;
}
function laneDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function passSpace(g,carrier,target){
  let space=120,lane=80;
  for(const q of g.players)if(q.team!==carrier.team){space=Math.min(space,dist(q,target));lane=Math.min(lane,laneDistance(q,carrier,target));}
  return space*.45-Math.max(0,32-lane)*4;
}
function receivingPoint(g,p){
  const b=g.ball,pass=g.pass,speed=Math.hypot(b.vx,b.vy),time=clamp(dist(p,b)/(speed||1),.06,.45),travel=(1-Math.exp(-.48*time))/.48;
  const future={x:clamp(b.x+b.vx*travel,15,W-15),y:clamp(b.y+b.vy*travel,15,H-15)};
  const ballBehind=(b.x-p.x)*b.vx+(b.y-p.y)*b.vy<0;
  return pass?.through&&(dist(p,b)>95||ballBehind)?{x:pass.x,y:pass.y}:future;
}
function steeringVelocity(g,p,target,speed,avoid=true){
  const d=dist(p,target),desired=Math.min(speed,Math.sqrt(1100*Math.max(0,d-1)),speed*d/38);
  let [dx,dy]=unit(target.x-p.x,target.y-p.y),vx=dx*desired,vy=dy*desired;
  if(avoid)for(const q of g.players){
    if(q.id===p.id||q.id===g.ball.owner&&p.intent==='press')continue;
    const px=p.x+p.vx*.16-q.x-q.vx*.16,py=p.y+p.vy*.16-q.y-q.vy*.16,separation=Math.hypot(px,py);
    const radius=q.team===p.team?52:g.ball.owner===p.id?72:30;
    if(separation<radius&&separation>.01){const force=(1-separation/radius)*speed*.9;vx+=px/separation*force;vy+=py/separation*force;}
  }
  const magnitude=Math.hypot(vx,vy);if(magnitude>speed){vx*=speed/magnitude;vy*=speed/magnitude;}
  return {vx,vy};
}
function teamContext(g,team,inputs,dt){
  const sign=team?-1:1,b=g.ball,owner=g.players[b.owner],possession=owner?.team??g.pass?.team;
  const players=g.players.filter(p=>p.team===team&&p.n!==1),selected=g.players[g.selected[team]],input=inputs[team]||{};
  const manual=!g.bot[team],engaged=manual&&dist(selected,b)<95&&Math.hypot(input.x||0,input.y||0)>.15;
  const candidates=players.filter(p=>!manual||p.id!==selected.id);
  const score=p=>dist(p,b)+(p.role==='CB'&&sign*(b.x-W/2)>-80?65:0);
  candidates.sort((a,c)=>score(a)-score(c));
  g.pressHold[team]=Math.max(0,(g.pressHold[team]||0)-dt);
  const previous=candidates.find(p=>p.id===g.press[team]);
  let presser=engaged?selected:candidates[0];
  if(!engaged&&previous&&g.pressHold[team]>0&&score(previous)<score(presser)+75)presser=previous;
  if(presser?.id!==g.press[team]){g.press[team]=presser?.id??-1;g.pressHold[team]=.65;}
  const coverPoint={x:b.x-sign*65,y:b.y};
  const cover=candidates.filter(p=>p.id!==presser?.id).sort((a,c)=>dist(a,coverPoint)-dist(c,coverPoint))[0];
  const progress=p=>team?W-p.x:p.x,ballU=progress(b),marks=new Map(),used=new Set();
  if(possession!==team){
    const threats=g.players.filter(p=>p.team!==team&&p.n!==1&&p.id!==owner?.id&&progress(p)<670).sort((a,c)=>progress(a)-progress(c));
    for(const defender of players.filter(p=>p.n<=5||p.n===7||p.n===8)){
      if(defender.id===presser?.id||defender.id===cover?.id)continue;
      const threat=threats.filter(p=>!used.has(p.id)).sort((a,c)=>(dist(defender,a)+Math.abs(defender.homeY-a.y)*.3)-(dist(defender,c)+Math.abs(defender.homeY-c.y)*.3))[0];
      if(threat){marks.set(defender.id,threat);used.add(threat.id);}
    }
  }
  return {team,sign,b,owner,possession,ballU,progress,presser:presser?.id,cover:cover?.id,marks};
}
function openPosition(g,p,candidates,carrier){
  let best=candidates[0],bestScore=-Infinity;
  for(const target of candidates){
    target.x=clamp(target.x,45,W-45);target.y=clamp(target.y,35,H-35);
    let score=carrier?passSpace(g,carrier,target):0;
    for(const q of g.players)if(q.team===p.team&&q.id!==p.id)score-=Math.max(0,65-dist(q,target))*.8;
    score-=dist(p,target)*.055;
    if(score>bestScore){bestScore=score;best=target;}
  }
  return best;
}
function plan(g,p,context){
  const {sign,b,owner,possession,ballU,marks}=context,time=DURATION-g.clock;
  const lane=p.homeY<H/2?-1:1,phase=time*.65+p.id*2.17,pulse=(Math.sin(phase)+1)/2;
  const point=(u,y)=>({x:p.team?W-u:u,y});let target,speed=43+(p.n*7%12),intent='shape';
  if(p.n===1){
    target={x:p.team?W-32:32,y:clamp(340+(b.y-340)*.3,312,368)};speed=70;
    const ownDistance=p.team?W-b.x:b.x;
    if(ownDistance<140&&Math.abs(b.y-340)<145&&(!owner||possession!==p.team))target={x:clamp(b.x+b.vx*.12,p.team?W-105:20,p.team?W-20:105),y:clamp(b.y+b.vy*.12,210,470)};
    intent='keeper';
  }else if(g.pass?.to===p.id&&b.owner===null){target=receivingPoint(g,p);speed=78;intent='receive';}
  else if(owner?.id===p.id){
    target=point(W-45,340+(p.homeY-340)*.2);speed=PACE.dribble;
    const opponent=g.players.filter(q=>q.team!==p.team).sort((a,c)=>dist(p,a)-dist(p,c))[0];
    if(opponent&&dist(p,opponent)<100)target.y=clamp(p.y+(p.y>=opponent.y?85:-85),80,H-80);
    intent='carry';
  }else if(possession!==p.team&&p.id===context.presser){
    target={x:clamp(b.x+(owner?owner.vx:b.vx)*.18-sign*(owner?15:0),15,W-15),y:clamp(b.y+(owner?owner.vy:b.vy)*.18,15,H-15)};speed=68;intent='press';
  }else if(possession!==p.team&&p.id===context.cover){
    target={x:b.x-sign*68,y:clamp(b.y+lane*48,45,H-45)};speed=54;intent='cover';
  }else if(possession===p.team){
    if(p.runTime>0){target={x:p.runX,y:p.runY};speed=73;intent='pass-and-move';}
    else{
      let u,y=p.homeY;
      if(p.n<=5){
        u=clamp(ballU-285,95,650)+(p.role==='CB'?-12:20);y=340+(p.homeY-340)*.94+(b.y-340)*.12;
        if(p.role!=='CB'&&ballU>430&&lane*(b.y-340)>80){u=ballU-30+pulse*105;y=lane<0?55:H-55;intent='overlap';}
      }else if(p.n===6||p.n===9){
        u=clamp(ballU+35+pulse*95,300,W-65);y=lane<0?58:H-58;
        if(ballU>650&&lane*(b.y-340)>70){u=Math.min(W-45,ballU+110);y=340+lane*(105+40*pulse);}
        intent='wide run';
      }else if(p.n===7||p.n===8){
        const forward=p.n===8&&pulse>.4;u=clamp(ballU+(forward?45:-100),160,W-105);y=clamp(b.y+lane*(95+25*pulse),105,H-105);intent=forward?'support run':'show for pass';
      }else{
        const run=(Math.sin(time*.7+(p.n===10?0:Math.PI))+1)/2;
        u=clamp(ballU+(run>.45?135+run*65:15),430,W-48);y=340+lane*(75+55*run)+(b.y-340)*.19;intent=run>.45?'channel run':'drop for pass';
      }
      const base=point(u,y),options=[base,point(u-32,y+lane*32),point(u+35,y-lane*35)];
      target=openPosition(g,p,options,owner);speed=intent==='channel run'||intent==='overlap'?75:45+(p.n*7%12);
    }
  }else{
    const back=clamp(ballU-125,80,580),depth=p.n<=5?0:p.n<=9?125:255;
    target=point(clamp(back+depth+(p.n%2?12:-12),45,W-65),340+(p.homeY-340)*.78+(b.y-340)*.25);
    const mark=marks.get(p.id);
    if(mark){const weight=context.progress(mark)<400?.76:.45;target.x+=(mark.x-sign*27-target.x)*weight;target.y+=(mark.y+(b.y-mark.y)*.08-target.y)*weight;intent='track runner';}
  }
  p.intent=intent;p.targetX=clamp(target.x,12,W-12);p.targetY=clamp(target.y,15,H-15);p.targetSpeed=speed;
  p.planTime=.45+(p.id*13%37)/100;
}
function restart(g,team,x,y,message) {
  const p=nearest(g,team,x,y);p.x=clamp(x,25,W-25);p.y=clamp(y,25,H-25);
  for(const q of g.players){q.vx=q.vy=0;q.planTime=0;q.controlTime=0;q.challengeTime=0;q.buffer=null;q.motionTime=0;}p.cool=0;g.pass=null;
  g.ball={x:p.x,y:p.y,vx:0,vy:0,owner:p.id,lock:.5,last:team};g.selected[team]=p.id;
  g.phase='restart';g.pause=.8;g.message=message;
  for(const q of g.players)if(q.team!==team&&dist(p,q)<70)q.x=clamp(q.x+(q.team?-75:75),15,W-15);
}
export function step(g,inputs=[{},{}],dt=1/30) {
  dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(g.phase==='ended'||dt===0)return;
  if(g.phase!=='playing'){
    g.pause-=dt;if(g.pause<=0){g.phase='playing';g.message='PLAY';}return;
  }
  g.clock=Math.max(0,g.clock-dt);if(g.clock<=0){g.phase='ended';for(const p of g.players)p.vx=p.vy=0;g.ball.vx=g.ball.vy=0;g.message=g.score[0]===g.score[1]?'FULL TIME · DRAW':`FULL TIME · ${g.score[0]>g.score[1]?'CORAL':'SKY'} WINS`;return;}
  g.aiTick+=dt;const b=g.ball;b.lock=Math.max(0,b.lock-dt);
  if(g.pass){g.pass.time-=dt;if(g.pass.time<=0||b.owner!==null)g.pass=null;}
  g.press??=[-1,-1];g.pressHold??=[0,0];
  const owner=g.players[b.owner],possession=owner?.team??g.pass?.team;
  if(g.lastPossession!==possession){for(const p of g.players)p.planTime=Math.min(p.planTime||0,.12+p.id%5*.04);g.lastPossession=possession;}
  const contexts=[teamContext(g,0,inputs,dt),teamContext(g,1,inputs,dt)],movements=[];
  // Decide against the same snapshot before moving anyone. Each player rethinks
  // on a different cadence, while acceleration turns decisions into curved runs.
  for(const p of g.players){
    p.cool=Math.max(0,p.cool-dt);p.tackleCool=Math.max(0,(p.tackleCool||0)-dt);p.runTime=Math.max(0,(p.runTime||0)-dt);p.planTime=Math.max(0,(p.planTime||0)-dt);
    p.motionTime=Math.max(0,(p.motionTime||0)-dt);p.controlTime=Math.max(0,(p.controlTime||0)-dt);
    if(b.owner!==p.id){p.controlTime=0;p.buffer=null;}
    p.keeperHold=b.owner===p.id?(p.keeperHold||0)+dt:0;p.decisionTime=Math.max(0,(p.decisionTime||0)-dt);
    if(p.stamina<.04)p.exhausted=true;if(p.stamina>.35)p.exhausted=false;
    const inp=inputs[p.team]||{},human=p.id===g.selected[p.team]&&!g.bot[p.team]&&p.n!==1;
    let dx=Number.isFinite(inp.x)?clamp(inp.x,-1,1):0,dy=Number.isFinite(inp.y)?clamp(inp.y,-1,1):0;
    if(Math.hypot(dx,dy)>1)[dx,dy]=unit(dx,dy);
    const assist=human&&Math.hypot(dx,dy)<.05&&g.pass?.to===p.id&&b.owner===null;
    if(human&&!assist){
      const sprint=!!inp.sprint&&!p.exhausted&&Math.hypot(dx,dy)>.05;
      p.stamina=clamp(p.stamina+(sprint?-.22:.14)*dt,0,1);
      const carrying=b.owner===p.id,speed=(carrying?(sprint?PACE.dribbleSprint:PACE.dribble):(sprint?PACE.sprint:PACE.jog))*(p.controlTime>0?.55:1)*(p.motion==='tackle'&&p.motionTime>0?.45:1);movements.push({p,vx:dx*speed,vy:dy*speed,human:true});continue;
    }
    if(assist){p.intent='receive';const velocity=steeringVelocity(g,p,receivingPoint(g,p),78);movements.push({p,...velocity,human:true});continue;}
    const context=contexts[p.team];
    if(p.planTime<=0||p.n===1||p.id===owner?.id||(possession!==p.team&&p.id===context.presser)||g.pass?.to===p.id)plan(g,p,context);
    const target={x:p.targetX,y:p.targetY},sprint=p.targetSpeed>65&&!p.exhausted&&dist(p,target)>45;
    p.stamina=clamp(p.stamina+(sprint?-.12:.13)*dt,0,1);
    const speed=(p.exhausted?Math.min(52,p.targetSpeed):p.targetSpeed)*(p.controlTime>0?.55:1);
    movements.push({p,...steeringVelocity(g,p,target,speed)});
  }
  for(const movement of movements){const {p,vx,vy,human}=movement;locomotion(p,vx,vy,dt,human);if(!human&&Math.hypot(p.vx,p.vy)<8)turn(p,b.x-p.x,b.y-p.y,dt,4);}
  // One committed presser challenges; the rest screen lanes or track runners.
  const carrier=g.players[b.owner];
  if(carrier&&b.lock<=0){
    const challengers=g.players.filter(p=>p.team!==carrier.team&&p.cool===0&&p.tackleCool===0&&
      (p.n===1||p.id===contexts[p.team].presser)&&
      (p.n===1||g.bot[p.team]||p.id!==g.selected[p.team])&&dist(p,b)<(p.n===1?21:19));
    challengers.sort((a,c)=>dist(a,carrier)-dist(c,carrier));
    const challenger=challengers[0];
    for(const p of g.players){p.challengeTime=p===challenger?(p.challengeTime||0)+dt:0;}
    if(challenger&&challenger.challengeTime>(challenger.n===1?.18:.38))challenge(g,challenger);
  }
  const current=g.players[b.owner];
  if(current?.buffer&&current.controlTime<=0&&current.cool===0){const queued=current.buffer;current.buffer=null;const previous=g.selected[current.team];g.selected[current.team]=current.id;action(g,current.team,queued.kind,queued.aimX,queued.aimY,queued.power);if(b.owner===current.id)g.selected[current.team]=previous;}
  if(current&&current.cool===0){
    const sign=current.team?-1:1,previous=g.selected[current.team];
    if(current.n===1&&current.keeperHold>.72){g.selected[current.team]=current.id;if(!action(g,current.team,'pass',sign,0))g.selected[current.team]=previous;}
    else if(g.bot[current.team]&&current.n!==1&&current.decisionTime<=0){
      current.decisionTime=.7+(current.n*7%31)/100;
      const distanceToGoal=Math.abs(current.x-(current.team?0:W)),pressure=g.players.some(q=>q.team!==current.team&&dist(current,q)<82);
      g.selected[current.team]=current.id;
      if(distanceToGoal<235&&Math.abs(current.y-H/2)<190){const goalY=340+Math.sin(current.id+DURATION-g.clock)*43;action(g,current.team,'shoot',(current.team?0:W)-current.x,goalY-current.y,.72);}
      else if(pressure)action(g,current.team,'pass',sign,clamp((340-current.y)/300,-.6,.6));
    }
  }
  // Resolve only physical overlaps; anticipation and personal space do most work.
  for(let i=0;i<g.players.length;i++)for(let j=i+1;j<g.players.length;j++){
    const a=g.players[i],c=g.players[j],d=dist(a,c);if(d<18){const angle=(i+j*7)*2.39996,[dx,dy]=d>.01?unit(c.x-a.x,c.y-a.y):[Math.cos(angle),Math.sin(angle)];const n=(18-d)*(1-Math.exp(-10*dt))*.5;a.x=clamp(a.x-dx*n,9,W-9);a.y=clamp(a.y-dy*n,9,H-9);c.x=clamp(c.x+dx*n,9,W-9);c.y=clamp(c.y+dy*n,9,H-9);}
  }
  if(b.owner!==null){const p=g.players[b.owner],speed=Math.hypot(p.vx,p.vy),touch=7+Math.min(1,speed/72)*5*(.5+.5*Math.sin((DURATION-g.clock)*9+p.id));
    const blend=1-Math.exp(-(p.controlTime>0?10:24)*dt);b.x+=(p.x+p.fx*touch-b.x)*blend;b.y+=(p.y+p.fy*touch-b.y)*blend;b.vx=p.vx;b.vy=p.vy;b.control=p.controlTime;
  }
  else{
    const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;const drag=Math.exp(-.48*dt);b.vx*=drag;b.vy*=drag;
    // Swept collision: fast shots cannot tunnel through a keeper or defender.
    if(b.lock<=0){const candidates=[];const vx=b.x-oldX,vy=b.y-oldY,len=vx*vx+vy*vy;
      for(const p of g.players){const t=len?clamp(((p.x-oldX)*vx+(p.y-oldY)*vy)/len,0,1):0;const d=Math.hypot(p.x-(oldX+t*vx),p.y-(oldY+t*vy));
        const radius=p.n===1?22:12;if(d<radius&&!(p.cool>0&&p.team===b.last))candidates.push({p,t});}
      candidates.sort((a,c)=>a.t-c.t);if(candidates.length){const {p,t}=candidates[0];receive(g,p,oldX+t*vx,oldY+t*vy);}
    }
  }
  if(b.x<0||b.x>W){
    if(b.y>H/2-36.6&&b.y<H/2+36.6){const scorer=b.x>W?0:1;g.score[scorer]++;g.phase='goal';g.pause=2;g.message=`GOAL · ${scorer===0?'CORAL':'SKY'}`;resetPositions(g,1-scorer);}
    else{const defending=b.x<0?0:1;if(b.last===defending)restart(g,1-defending,b.x<0?18:W-18,b.y<H/2?18:H-18,'CORNER');else restart(g,defending,b.x<0?95:W-95,340,'GOAL KICK');}
  }else if(b.y<0||b.y>H)restart(g,1-b.last,b.x,b.y<0?12:H-12,'THROW IN');
  if(g.aiTick>1.1)g.aiTick=0;
}
