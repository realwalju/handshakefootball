export const W = 1050, H = 680, DURATION = 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const unit = (x,y) => {const d=Math.hypot(x,y)||1;return [x/d,y/d];};
const formation = [[55,340],[230,95],[200,255],[200,425],[230,585],[430,130],[385,275],[385,405],[430,550],[650,260],[650,420]];
const roles = ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'];
export function createGame() {
  const g={players:[],ball:{x:525,y:340,vx:0,vy:0,owner:null,lock:0,last:0},selected:[9,20],score:[0,0],clock:DURATION,phase:'kickoff',pause:1.2,message:'KICKOFF',kickTeam:0,bot:[false,false],aiTick:0};
  for(let t=0;t<2;t++) formation.forEach(([x,y],n)=>g.players.push({id:t*11+n,team:t,n:n+1,role:roles[n],x:t?W-x:x,y,homeX:t?W-x:x,homeY:y,vx:0,vy:0,fx:t?-1:1,fy:0,stamina:1,cool:0}));
  resetPositions(g,0);return g;
}
function resetPositions(g,team) {
  for(const p of g.players){p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;p.cool=0;}
  const k=g.players[team*11+9];k.x=team?540:510;k.y=340;
  const other=g.players[team*11+10];other.x=team?600:450;other.y=400;
  for(const p of g.players) if(p.team!==team) p.x=p.team?Math.max(p.x,570):Math.min(p.x,480);
  g.selected=[9,20];g.selected[team]=k.id;g.ball={x:k.x+(team?-12:12),y:k.y,vx:0,vy:0,owner:k.id,lock:0,last:team};
  g.kickTeam=team;
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
  const p=g.players[g.selected[team]], b=g.ball;
  if(kind==='switch'){switchPlayer(g,team);return true;}
  if(p.cool>0)return false;
  if(kind==='tackle') {
    p.cool=.55; const owner=g.players[b.owner];
    if(owner&&owner.team!==team&&dist(p,owner)<32){b.owner=p.id;b.lock=.22;b.last=team;g.message='BALL WON';}
    return true;
  }
  if(b.owner!==p.id)return false;
  let dx=aimX,dy=aimY;if(Math.hypot(dx,dy)<.1){dx=p.fx;dy=p.fy;}
  [dx,dy]=unit(dx,dy);
  let speed=0;
  if(kind==='pass'||kind==='through'){
    const candidates=g.players.filter(q=>q.team===team&&q.id!==p.id&&q.n!==1).map(q=>{
      const d=dist(p,q), dot=((q.x-p.x)*dx+(q.y-p.y)*dy)/(d||1);
      return {q,d,dot,rank:dot*450-d*.5};
    }).filter(q=>q.d>25&&q.d<500).sort((a,b)=>b.rank-a.rank);
    const target=(candidates.find(c=>c.dot>.15)||candidates[0])?.q;if(!target)return false;
    const lead=kind==='through'?100:Math.min(35,dist(p,target)/9);
    let tx=target.x+target.vx*.22+(kind==='through'?(team?-lead:lead):0),ty=target.y+target.vy*.22;
    [dx,dy]=unit(clamp(tx,15,W-15)-p.x,clamp(ty,15,H-15)-p.y);
    speed=kind==='through'?520:clamp(dist(p,target)*1.1+220,350,620);
    g.selected[team]=target.id;g.message=kind==='through'?'THROUGH BALL':'PASS';
  }else if(kind==='shoot'){
    power=clamp(Number(power)||.65,.2,1);
    // Default facing shoots toward goal, directional input allows manual aiming.
    if(Math.hypot(aimX,aimY)<.1){[dx,dy]=unit((team?0:W)-p.x,340-p.y);}
    speed=610+power*300;g.message='SHOT';
  }else return false;
  b.owner=null;b.x=p.x+dx*18;b.y=p.y+dy*18;b.vx=dx*speed;b.vy=dy*speed;b.lock=.16;b.last=team;p.cool=.2;
  return true;
}
function move(p,tx,ty,speed,dt) {
  const d=Math.hypot(tx-p.x,ty-p.y);if(d<2){p.vx=p.vy=0;return;}
  const [dx,dy]=unit(tx-p.x,ty-p.y),v=Math.min(speed,d/dt);p.vx=dx*v;p.vy=dy*v;
  p.x=clamp(p.x+p.vx*dt,9,W-9);p.y=clamp(p.y+p.vy*dt,9,H-9);p.fx=dx;p.fy=dy;
}
function restart(g,team,x,y,message) {
  const p=nearest(g,team,x,y);p.x=clamp(x,25,W-25);p.y=clamp(y,25,H-25);
  g.ball={x:p.x,y:p.y,vx:0,vy:0,owner:p.id,lock:.5,last:team};g.selected[team]=p.id;
  g.phase='restart';g.pause=.8;g.message=message;
  for(const q of g.players)if(q.team!==team&&dist(p,q)<70)q.x=clamp(q.x+(q.team?-75:75),15,W-15);
}
export function step(g,inputs=[{},{}],dt=1/30) {
  dt=clamp(dt,0,.05);if(g.phase==='ended')return;
  if(g.phase!=='playing'){
    g.pause-=dt;if(g.pause<=0){g.phase='playing';g.message='PLAY';}return;
  }
  g.clock=Math.max(0,g.clock-dt);if(g.clock<=0){g.phase='ended';g.message=g.score[0]===g.score[1]?'FULL TIME · DRAW':`FULL TIME · ${g.score[0]>g.score[1]?'CORAL':'SKY'} WINS`;return;}
  g.aiTick+=dt;const b=g.ball; b.lock=Math.max(0,b.lock-dt);
  const owner=g.players[b.owner], possession=owner?.team;
  const chasers=[nearest(g,0,b.x,b.y),nearest(g,1,b.x,b.y)];
  for(const p of g.players){
    p.cool=Math.max(0,p.cool-dt);
    const inp=inputs[p.team]||{};
    if(p.id===g.selected[p.team]&&!g.bot[p.team]){
      let dx=Number.isFinite(inp.x)?clamp(inp.x,-1,1):0,dy=Number.isFinite(inp.y)?clamp(inp.y,-1,1):0;
      if(Math.hypot(dx,dy)>1)[dx,dy]=unit(dx,dy);
      const sprint=inp.sprint&&p.stamina>.03;
      p.stamina=clamp(p.stamina+(sprint?-.22:.14)*dt,0,1);
      const speed=(sprint?205:145)*(b.owner===p.id?.94:1);
      p.vx=dx*speed;p.vy=dy*speed;p.x=clamp(p.x+p.vx*dt,9,W-9);p.y=clamp(p.y+p.vy*dt,9,H-9);
      if(Math.hypot(dx,dy)>.01){[p.fx,p.fy]=unit(dx,dy);}continue;
    }
    let tx=p.homeX,ty=p.homeY,speed=125;
    const sign=p.team?-1:1;
    if(p.n===1){
      if(b.owner===p.id&&g.aiTick>1.05){g.selected[p.team]=p.id;action(g,p.team,'pass',sign,0);}
      tx=p.team?W-40:40;ty=clamp(340+(b.y-340)*.48,270,410);speed=155;
      if(b.x<(p.team?W:150)&&b.x>(p.team?W-150:0)&&Math.abs(b.y-340)<150&&(!owner||possession!==p.team)){tx=clamp(b.x,p.team?W-100:20,p.team?W-20:100);ty=b.y;}
    }else if(owner?.id===p.id){
      tx=p.team?55:W-55;ty=340+(p.homeY-340)*.2;speed=125;
      if(p.cool===0){
        if(Math.abs(p.x-(p.team?0:W))<280){g.selected[p.team]=p.id;action(g,p.team,'shoot',0,0,.7);}
        else if(g.aiTick>1.1&&g.players.some(q=>q.team!==p.team&&dist(p,q)<50)){g.selected[p.team]=p.id;action(g,p.team,'pass',sign,0);}
      }
    }else if((!owner||possession!==p.team)&&chasers[p.team]?.id===p.id){tx=b.x;ty=b.y;speed=153;}
    else{
      const advance=possession===p.team?85:possession===undefined?0:-55;
      tx=clamp(p.homeX+(b.x-525)*.32+sign*advance,75,W-75);
      ty=clamp(p.homeY+(b.y-340)*.26,30,H-30);
    }
    move(p,tx,ty,speed,dt);
    // Only the active pressing defender tackles automatically, at close range.
    const current=g.players[b.owner];
    if(current&&current.team!==p.team&&p.cool===0&&dist(p,current)<18){b.owner=p.id;b.last=p.team;b.lock=.25;p.cool=.7;}
  }
  // Soft player separation prevents a pile-up around the ball.
  for(let i=0;i<g.players.length;i++)for(let j=i+1;j<g.players.length;j++){
    const a=g.players[i],c=g.players[j],d=dist(a,c);if(d<17){const [dx,dy]=unit(c.x-a.x||.1,c.y-a.y);const n=(17-d)*.25;a.x=clamp(a.x-dx*n,9,W-9);a.y=clamp(a.y-dy*n,9,H-9);c.x=clamp(c.x+dx*n,9,W-9);c.y=clamp(c.y+dy*n,9,H-9);}
  }
  if(b.owner!==null){const p=g.players[b.owner];b.x=p.x+p.fx*12;b.y=p.y+p.fy*12;b.vx=p.vx;b.vy=p.vy;}
  else{
    const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;const drag=Math.exp(-.48*dt);b.vx*=drag;b.vy*=drag;
    // Swept collision: fast shots cannot tunnel through a keeper or defender.
    if(b.lock<=0){const candidates=[];const vx=b.x-oldX,vy=b.y-oldY,len=vx*vx+vy*vy;
      for(const p of g.players){const t=len?clamp(((p.x-oldX)*vx+(p.y-oldY)*vy)/len,0,1):0;const d=Math.hypot(p.x-(oldX+t*vx),p.y-(oldY+t*vy));
        const radius=p.n===1?22:12;if(d<radius&&!(p.cool>0&&p.team===b.last))candidates.push({p,t});}
      candidates.sort((a,c)=>a.t-c.t);if(candidates.length){const p=candidates[0].p;b.owner=p.id;b.x=p.x+p.fx*12;b.y=p.y+p.fy*12;b.last=p.team;b.lock=.1;if(p.n!==1)g.selected[p.team]=p.id;}
    }
  }
  if(b.x<0||b.x>W){
    if(b.y>H/2-75&&b.y<H/2+75){const scorer=b.x>W?0:1;g.score[scorer]++;g.phase='goal';g.pause=2;g.message=`GOAL · ${scorer===0?'CORAL':'SKY'}`;resetPositions(g,1-scorer);}
    else{const defending=b.x<0?0:1;if(b.last===defending)restart(g,1-defending,b.x<0?18:W-18,b.y<H/2?18:H-18,'CORNER');else restart(g,defending,b.x<0?95:W-95,340,'GOAL KICK');}
  }else if(b.y<0||b.y>H)restart(g,1-b.last,b.x,b.y<0?12:H-12,'THROW IN');
  if(g.aiTick>1.1)g.aiTick=0;
}
