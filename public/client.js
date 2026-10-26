import {W,H,createGame,step,action} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('pitch'),ctx=canvas.getContext('2d');
const COLORS=['#ff836b','#8acbea'];let game=createGame(),mode='lobby',team=0,session=null,stream=null,connected=false,onlineStatus='waiting',lastPacket=0,lastTime=0,accumulator=0,chargeStart=0,noticeUntil=0,lastMessage='',inputBusy=false;
const keys=new Set(),touch={x:0,y:0,sprint:false},controller={index:null,x:0,y:0,sprint:false,buttons:[],shooting:false},renderPositions=new Map();
let input={x:0,y:0,sprint:false};const ox=75,oy=60;canvas.width=2400;canvas.height=1600;ctx.scale(2,2);
let requestedView='2d',view3D=null,loading3D=null,cameraMode='follow';
function updateViewUI(){const active=!!view3D&&requestedView==='3d';canvas.hidden=active;$('pitch3d').hidden=!active;$('view2dButton').ariaPressed=String(!active);$('view3dButton').ariaPressed=String(active);$('cameraButton').hidden=!active;$('viewHint').textContent=active?'3D prototype · same controls':'Try a new angle. Same match, same controls.';}
function unavailable3D(){requestedView='2d';$('view3dButton').disabled=true;updateViewUI();$('viewHint').textContent='3D could not start in this browser. You can keep playing in 2D.';}
async function chooseView(value){requestedView=value;if(value==='2d'){updateViewUI();return;}if(typeof WebGL2RenderingContext==='undefined'){unavailable3D();return;}if(!view3D){$('viewHint').textContent='Getting the 3D pitch ready…';try{loading3D??=import('./view-3d.js').then(module=>module.create3DView($('pitch3d'),unavailable3D));view3D=await loading3D;}catch{unavailable3D();return;}}updateViewUI();}
$('view2dButton').onclick=()=>chooseView('2d');$('view3dButton').onclick=()=>chooseView('3d');
$('cameraButton').onclick=()=>{cameraMode=cameraMode==='wide'?'follow':'wide';view3D?.setCameraMode(cameraMode);$('cameraButton').textContent='Camera: '+(cameraMode==='wide'?'full pitch':'broadcast');$('cameraButton').ariaPressed=String(cameraMode==='follow');};
function matchLayout(playing){document.querySelector('.app').classList.toggle('playing',playing);if(playing)window.scrollTo({top:0,behavior:'instant'});}
let transport='sse',networkError=null;
async function configureNetwork(){const r=await fetch('/api/config');const data=await r.json();if(!r.ok)throw new Error(data.error||'Connection failed');transport=data.transport==='poll'?'poll':'sse';networkError=null;}
const networkReady=location.protocol==='file:'?Promise.resolve():configureNetwork().catch(e=>{networkError=e;});
const deadzone=value=>{const magnitude=Math.abs(Number(value)||0);return magnitude<.16?0:Math.sign(value)*Math.min(1,(magnitude-.16)/.84);};
function readInput(){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(controller.x||controller.y){x=controller.x;y=controller.y;}if(touch.x||touch.y){x=touch.x;y=touch.y;}return {x,y,sprint:keys.has('shift')||touch.sprint||controller.sprint};}
function setController(pad){
  if(!pad){if(controller.index!==null)$('controllerStatus').textContent='Controller disconnected';controller.index=null;controller.x=controller.y=0;controller.sprint=false;controller.buttons=[];controller.shooting=false;return;}
  if(controller.index!==pad.index){controller.index=pad.index;controller.buttons=[];$('controllerStatus').textContent=`Controller connected · ${pad.id||'Gamepad'}`;if(mode!=='lobby')notify('CONTROLLER CONNECTED');}
}
function pollController(now){
  if(typeof navigator.getGamepads!=='function')return;
  const pads=[...navigator.getGamepads()].filter(Boolean);let pad=pads.find(item=>item.index===controller.index);
  if(!pad)pad=pads.find(item=>item.mapping==='standard')||pads[0];setController(pad);if(!pad)return;
  const pressed=index=>!!pad.buttons?.[index]?.pressed,justPressed=index=>pressed(index)&&!controller.buttons[index];
  if($('help').open){controller.x=controller.y=0;controller.sprint=false;controller.buttons=Array.from(pad.buttons||[],button=>!!button.pressed);return;}
  let x=deadzone(pad.axes?.[0]),y=deadzone(pad.axes?.[1]);
  if(pressed(14))x=-1;if(pressed(15))x=1;if(pressed(12))y=-1;if(pressed(13))y=1;
  const magnitude=Math.hypot(x,y);if(magnitude>1){x/=magnitude;y/=magnitude;}controller.x=x;controller.y=y;controller.sprint=pressed(7);input=readInput();
  if(justPressed(0))sendAction('pass');if(justPressed(3))sendAction('through');if(justPressed(4))sendAction('switch');if(justPressed(1))sendAction('tackle');
  if(pressed(2)&&!controller.shooting&&mode!=='lobby'){controller.shooting=true;chargeStart=now;}
  if(!pressed(2)&&controller.shooting){sendAction('shoot',Math.min(1,.2+(now-chargeStart)/900));controller.shooting=false;chargeStart=0;}
  controller.buttons=Array.from(pad.buttons||[],button=>!!button.pressed);
}
function uiStatus(label,live=false){$('status').textContent=label;$('statusDot').classList.toggle('live',live);}
async function api(path,data={},auth=true){const u=new URL(path,location.href);if(auth&&session)u.searchParams.set('room',session.room);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(u,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',...(auth&&session?{Authorization:`Bearer ${session.token}`}:{})},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Object.assign(new Error(v.error||'Connection failed'),{status:r.status});return v;}finally{clearTimeout(timeout);}}
function notify(message){$('matchNotice').textContent=message;$('matchNotice').hidden=false;noticeUntil=performance.now()+2500;}
function sendAction(kind,power=.65){if(mode==='lobby')return;if(mode==='practice'){action(game,team,kind,input.x,input.y,power);return;}if(!connected)return;api('/api/action',{kind,x:input.x,y:input.y,power}).catch(e=>notify(e.message));}
function clearInput(){keys.clear();touch.x=touch.y=0;touch.sprint=false;controller.x=controller.y=0;controller.sprint=false;controller.shooting=false;input=readInput();chargeStart=0;$('stick').style.transform='';if(mode==='online')api('/api/input',input).catch(()=>{});}
function enterPractice(){leave(false);mode='practice';matchLayout(true);team=0;game=createGame();game.bot=[false,true];renderPositions.clear();$('lobby').hidden=true;$('leaveButton').hidden=false;$('roomBanner').hidden=true;uiStatus('WARM UP · VS COMPUTER',true);}
function connect(s){session=s;mode='online';matchLayout(true);team=s.team;connected=false;onlineStatus='waiting';renderPositions.clear();try{sessionStorage.setItem('touchline-session',JSON.stringify(s));}catch{}$('lobby').hidden=true;$('leaveButton').hidden=false;$('roomBanner').hidden=false;$('roomCode').textContent=s.room;$('roomHint').textContent='Share the code with your opponent.';uiStatus('CONNECTING');
  if(transport==='poll'){syncRoom();return;}
  stream=new EventSource(`/api/events?room=${encodeURIComponent(s.room)}&token=${encodeURIComponent(s.token)}`);
  stream.onmessage=e=>applySnapshot(JSON.parse(e.data));
  stream.onerror=()=>{connected=false;uiStatus('RECONNECTING');notify('Connection lost. Reconnecting… Match paused.');};
}
function applySnapshot(data){game=data.game;lastPacket=performance.now();connected=true;onlineStatus=data.status;uiStatus(data.status==='connected'?'LIVE MATCH':data.status==='waiting'?'WAITING FOR RIVAL':'MATCH PAUSED',data.status==='connected');$('roomHint').textContent=data.status==='waiting'?'Waiting for your opponent to join.':data.status==='paused'?'Opponent disconnected. The match is paused.':'You are '+(team===0?'Coral FC · attack right →':'Sky United · attack left ←');if(data.rematch?.[team])$('rematchButton').textContent='Waiting for rival…';}
async function syncRoom(){if(inputBusy||mode!=='online'||!session)return;inputBusy=true;const activeSession=session;try{const data=await api('/api/sync',input);if(session===activeSession&&mode==='online')applySnapshot(data);}catch(e){if(session!==activeSession)return;connected=false;uiStatus('RECONNECTING');if(e.status===404||e.status===403){leave();$('error').textContent=e.message;}}finally{inputBusy=false;}}
async function startRoom(join=false){$('error').textContent='';if(location.protocol==='file:'){notify('This downloaded demo supports warm-up. Run the included project for online rooms.');$('error').textContent='Online rooms require the included Node server.';return;}
  $('createButton').disabled=true;$('joinForm').querySelector('button').disabled=true;
  try{await networkReady;if(networkError)await configureNetwork();const s=await api(join?'/api/join':'/api/create',join?{room:$('roomInput').value}:{},false);connect(s);}catch(e){$('error').textContent=e.message;}finally{$('createButton').disabled=false;$('joinForm').querySelector('button').disabled=false;}
}
function leave(showLobby=true){if(stream){stream.close();stream=null;}if(session){api('/api/leave').catch(()=>{});session=null;}try{sessionStorage.removeItem('touchline-session');}catch{}mode='lobby';matchLayout(false);connected=false;clearInput();if(showLobby){game=createGame();renderPositions.clear();$('lobby').hidden=false;$('roomBanner').hidden=true;$('leaveButton').hidden=true;$('rematchButton').hidden=true;$('matchNotice').hidden=true;uiStatus('READY TO PLAY');}}
$('createButton').onclick=()=>startRoom();$('joinForm').onsubmit=e=>{e.preventDefault();startRoom(true);};$('practiceButton').onclick=enterPractice;$('leaveButton').onclick=()=>leave();
$('rematchButton').onclick=()=>{if(mode==='practice'){game=createGame();game.bot=[false,true];$('rematchButton').hidden=true;}else api('/api/rematch').catch(e=>notify(e.message));};
$('copyButton').onclick=async()=>{const link=new URL(location.href);link.search='';link.searchParams.set('room',session.room);if(requestedView==='3d')link.searchParams.set('view','3d');try{await navigator.clipboard.writeText(link.href);$('copyButton').textContent='Invite copied ✓';setTimeout(()=>$('copyButton').textContent='Copy invite ↗',2000);}catch{notify(`Share room code: ${session.room}`);}};
$('helpButton').onclick=()=>{clearInput();$('help').showModal();};$('closeHelp').onclick=()=>$('help').close();
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(mode==='lobby')window.scrollTo({top:0,behavior:'smooth'});else notify('Use Leave match to return to the lobby.');};
addEventListener('keydown',e=>{if(e.target.matches('input')||$('help').open)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k))e.preventDefault();keys.add(k);input=readInput();if(e.repeat)return;const map={j:'pass',l:'through',q:'switch',e:'tackle'};if(map[k])sendAction(map[k]);if(k==='k'&&mode!=='lobby')chargeStart=performance.now();});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys.delete(k);input=readInput();if(k==='k'&&chargeStart){sendAction('shoot',Math.min(1,.2+(performance.now()-chargeStart)/900));chargeStart=0;}});
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
const joystick=$('joystick');let pointer=null;
function joystickMove(e){if(e.pointerId!==pointer)return;const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),scale=Math.min(1,36/(d||1));touch.x=dx*scale/36;touch.y=dy*scale/36;$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;input=readInput();}
joystick.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;joystick.setPointerCapture(pointer);joystickMove(e);};joystick.onpointermove=joystickMove;
function releaseJoystick(){pointer=null;touch.x=touch.y=0;$('stick').style.transform='';input=readInput();}joystick.onpointerup=releaseJoystick;joystick.onpointercancel=releaseJoystick;
for(const button of document.querySelectorAll('[data-action]')){button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input=readInput();if(button.dataset.action==='shoot')chargeStart=performance.now();else sendAction(button.dataset.action);};button.onpointerup=e=>{e.preventDefault();if(button.dataset.action==='shoot'&&chargeStart){sendAction('shoot',Math.min(1,.2+(performance.now()-chargeStart)/900));chargeStart=0;}};button.onpointercancel=()=>{chargeStart=0;};}
$('sprintTouch').onpointerdown=e=>{e.preventDefault();e.target.setPointerCapture(e.pointerId);touch.sprint=true;};for(const k of ['onpointerup','onpointercancel'])$('sprintTouch')[k]=()=>touch.sprint=false;
setInterval(()=>{input=readInput();if(mode==='online'&&transport==='poll'){syncRoom();return;}if(mode==='online'&&connected&&!inputBusy){inputBusy=true;api('/api/input',input).catch(()=>{connected=false;}).finally(()=>inputBusy=false);}},50);
function line(x1,y1,x2,y2,color='#c7dec682',width=1.7){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,fill,stroke,width=1.5){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function pitch(){
  ctx.clearRect(0,0,1200,800);ctx.fillStyle='#1d3934';ctx.fillRect(0,0,1200,800);
  // Stadium apron with restrained technical details.
  for(let i=0;i<20;i++){ctx.fillStyle=i%2?'#28463c':'#27443c';ctx.fillRect(ox+i*W/20,oy,W/20,H);}
  ctx.fillStyle='#325344';ctx.fillRect(ox-24,oy-24,W+48,16);ctx.fillRect(ox-24,oy+H+8,W+48,16);
  ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.fillStyle='#9fb48a';for(let i=0;i<5;i++){ctx.fillText(i%2?'MAKE THE PLAY':'TOUCHLINE DUEL',ox+95+i*215,oy-13);ctx.fillText(i%2?'TOUCHLINE DUEL':'READ THE GAME',ox+95+i*215,oy+H+19);}
  ctx.save();ctx.translate(ox,oy);ctx.strokeStyle='#c7dec682';ctx.lineWidth=1.7;ctx.strokeRect(0,0,W,H);line(W/2,0,W/2,H);circle(W/2,H/2,91,null,'#c7dec682');circle(W/2,H/2,3,'#c7dec6');
  ctx.strokeRect(0,138,165,404);ctx.strokeRect(W-165,138,165,404);ctx.strokeRect(0,248,55,184);ctx.strokeRect(W-55,248,55,184);circle(110,340,2.4,'#c7dec6');circle(W-110,340,2.4,'#c7dec6');
  ctx.beginPath();ctx.arc(110,340,91,-.93,.93);ctx.stroke();ctx.beginPath();ctx.arc(W-110,340,91,Math.PI-.93,Math.PI+.93);ctx.stroke();
  for(const x of [0,W]){const gx=x===0?-24:W;ctx.fillStyle='#b5c3b516';ctx.fillRect(gx,303.4,24,73.2);ctx.strokeStyle='#dae3d6aa';ctx.strokeRect(gx,303.4,24,73.2);for(let y=308;y<376;y+=10)line(gx,y,gx+24,y,'#dce9dd22',.7);for(let z=6;z<24;z+=6)line(gx+z,303.4,gx+z,376.6,'#dce9dd22',.7);}
  ctx.restore();ctx.fillStyle='#a6bd9644';ctx.textAlign='left';ctx.font='8px Arial';ctx.fillText('CORAL FC   →',ox,oy+H+43);ctx.textAlign='right';ctx.fillText('←   SKY UNITED',ox+W,oy+H+43);
}
function draw(now){const active=game.players[game.selected[team]];if(view3D&&requestedView==='3d'){try{view3D.render(game,{team,mode,input,chargeStart,now});}catch{unavailable3D();}}if(!(view3D&&requestedView==='3d')){pitch();const fade=mode==='lobby'?.65:1;ctx.globalAlpha=fade;
  // Directional pass hint; only visible for the current ball carrier.
  if(mode!=='lobby'&&game.ball.owner===active?.id){const d=Math.hypot(input.x,input.y)||1,dx=input.x||(!input.y?active.fx:0),dy=input.y||(!input.x?active.fy:0);ctx.setLineDash([5,6]);line(ox+active.x,oy+active.y,ox+active.x+dx/d*65,oy+active.y+dy/d*65,'#d5f58188',1);ctx.setLineDash([]);}
  for(const p of [...game.players].sort((a,b)=>a.y-b.y)){
    let v=renderPositions.get(p.id);if(!v||Math.hypot(v.x-p.x,v.y-p.y)>120)v={x:p.x,y:p.y};const blend=mode==='online'?.55:1;v.x+=(p.x-v.x)*blend;v.y+=(p.y-v.y)*blend;renderPositions.set(p.id,v);
    const x=ox+v.x,y=oy+v.y,selected=mode!=='lobby'&&p.id===game.selected[team],opponent=mode==='online'&&p.id===game.selected[1-team];
    ctx.save();ctx.translate(x,y);circle(1,5,11,'#07191155');if(selected){circle(0,0,15,null,'#d5f581',2);ctx.fillStyle='#d5f581';ctx.beginPath();ctx.moveTo(-4,-24);ctx.lineTo(4,-24);ctx.lineTo(0,-18);ctx.fill();}if(opponent)circle(0,0,14,null,'#ffffff66',1);
    circle(0,0,9,p.n===1?'#e4c76f':COLORS[p.team],'#112c30',1.5);line(p.fx*5,p.fy*5,p.fx*10,p.fy*10,'#172d34',2.8);
    ctx.font='bold 8px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#142b30';ctx.fillText(p.n,0,1);
    if(selected){ctx.fillStyle='#10251c';ctx.fillRect(-13,19,26,3);ctx.fillStyle='#d5f581';ctx.fillRect(-13,19,26*p.stamina,3);}ctx.restore();
  }
  const b=game.ball;circle(ox+b.x+1.5,oy+b.y+2,3.7,'#001b1955');circle(ox+b.x,oy+b.y,3.2,'#faf9e8','#182d2c',.9);circle(ox+b.x+.4,oy+b.y-.3,1,'#405249');ctx.globalAlpha=1;
  if(chargeStart&&mode!=='lobby'&&active){const power=Math.min(1,(now-chargeStart)/900);ctx.fillStyle='#10211d';ctx.fillRect(ox+active.x-25,oy+active.y-38,50,5);ctx.fillStyle=power>.8?'#ff836b':'#d5f581';ctx.fillRect(ox+active.x-25,oy+active.y-38,50*power,5);}
  }
  drawRadar();
  $('scoreA').textContent=game.score[0];$('scoreB').textContent=game.score[1];const seconds=Math.ceil(game.clock);$('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(mode!=='lobby'){
    $('playerLabel').innerHTML=`<i class="selected-icon"></i> ${team===0?'CORAL':'SKY'} · #${active.n} ${active.role}`;
    $('eventLabel').textContent=active.controlTime>0?'FIRST TOUCH · NEXT ACTION CAN BE QUEUED':game.message;
    let persistent='';if(mode==='online'&&!connected)persistent='RECONNECTING · MATCH PAUSED';else if(mode==='online'&&onlineStatus==='waiting')persistent=`ROOM ${session.room} · WAITING FOR YOUR RIVAL`;else if(mode==='online'&&onlineStatus==='paused')persistent='OPPONENT DISCONNECTED · MATCH PAUSED';else if(game.phase!=='playing')persistent=game.message;
    if(persistent){$('matchNotice').textContent=persistent;$('matchNotice').hidden=false;}else if(now>noticeUntil)$('matchNotice').hidden=true;
    $('rematchButton').hidden=game.phase!=='ended';if(game.phase!=='ended')$('rematchButton').textContent='Play again ↗';
  }
}
function frame(now){const elapsed=Math.min((now-lastTime)/1000,.1);lastTime=now;pollController(now);input=readInput();if(mode==='practice'){accumulator+=elapsed;let n=0;while(accumulator>=1/60&&n++<6){step(game,[input,{}],1/60);accumulator-=1/60;}}else accumulator=0;if(mode==='online'&&connected&&now-lastPacket>3000){connected=false;uiStatus('RECONNECTING');}draw(now);requestAnimationFrame(frame);}
const room=new URLSearchParams(location.search).get('room');if(room)$('roomInput').value=room.slice(0,6).toUpperCase();
try{const s=JSON.parse(sessionStorage.getItem('touchline-session'));if(s?.token&&s.room&&location.protocol!=='file:')networkReady.then(()=>{if(!networkError)connect(s);else $('error').textContent=networkError.message;});}catch{}
updateViewUI();if(new URLSearchParams(location.search).get('view')!=='2d'&&typeof WebGL2RenderingContext!=='undefined')chooseView('3d');
requestAnimationFrame(frame);

function drawRadar(){
  const radar=$('radar');radar.hidden=mode==='lobby'||!view3D||requestedView!=='3d';if(radar.hidden)return;
  const c=radar.getContext('2d'),sx=210/W,sy=136/H;
  c.clearRect(0,0,210,136);c.fillStyle='#10281fdf';c.fillRect(0,0,210,136);c.strokeStyle='#b7cbb280';c.lineWidth=1;c.strokeRect(1,1,208,134);c.beginPath();c.moveTo(105,0);c.lineTo(105,136);c.stroke();c.beginPath();c.arc(105,68,18,0,Math.PI*2);c.stroke();
  for(const p of game.players){c.beginPath();c.arc(p.x*sx,p.y*sy,p.id===game.selected[team]?3.7:2.3,0,Math.PI*2);c.fillStyle=p.id===game.selected[team]?'#d5f581':COLORS[p.team];c.fill();}
  c.beginPath();c.arc(game.ball.x*sx,game.ball.y*sy,2.3,0,Math.PI*2);c.fillStyle='#fff';c.fill();
}
