import * as THREE from 'three';
import {W,H} from '../public/engine.js';

const SCALE=.1,HALF_X=W*SCALE/2,HALF_Z=H*SCALE/2;
const KIT=[0xff836b,0x8acbea],SKIN=[0xdca578,0xa16a48,0x754b36,0xe7ba93,0xbc8159];
const solid=color=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});
const white=solid(0xf0f1dd),dark=solid(0x203039);
const shapes={
  body:new THREE.CapsuleGeometry(.43,.72,3,8),head:new THREE.SphereGeometry(.32,8,6),
  boot:new THREE.BoxGeometry(.26,.14,.44),hand:new THREE.SphereGeometry(.13,7,5),
  upper:new THREE.CylinderGeometry(.135,.12,.4,6),lower:new THREE.CylinderGeometry(.12,.1,.37,6),
  shorts:new THREE.BoxGeometry(.75,.4,.54),hair:new THREE.SphereGeometry(.335,8,4,0,Math.PI*2,0,Math.PI/2)
};
function mesh(geometry,material,parent,x=0,y=0,z=0){
  const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);parent.add(object);return object;
}

// This little articulated model can later be replaced with a rigged GLTF asset.
export function createPlayerModel(player){
  const root=new THREE.Group();root.name=`player-${player.id}`;
  root.scale.setScalar(.68);
  const body=new THREE.Group();root.add(body);
  const skin=solid(SKIN[player.id%SKIN.length]),shirt=solid(player.n===1?0xe4c76f:KIT[player.team]);
  const torso=mesh(shapes.body,shirt,body,0,1.55);torso.castShadow=true;
  mesh(shapes.shorts,dark,body,0,.88);
  const head=mesh(shapes.head,skin,body,0,2.48);head.castShadow=true;
  mesh(shapes.hair,solid(player.id%3===0?0x9d704c:0x302722),body,0,2.5);
  mesh(new THREE.BoxGeometry(.55,.1,.04),white,body,0,1.64,.42);
  const limbs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.54,1.93,0);body.add(arm);
    mesh(shapes.upper,shirt,arm,0,-.2);arm.rotation.z=side*.12;
    const elbow=new THREE.Group();elbow.position.y=-.4;arm.add(elbow);mesh(shapes.lower,skin,elbow,0,-.18);mesh(shapes.hand,skin,elbow,0,-.42);
    const leg=new THREE.Group();leg.position.set(side*.22,.8,0);root.add(leg);
    mesh(shapes.upper,dark,leg,0,-.2);const knee=new THREE.Group();knee.position.y=-.4;leg.add(knee);
    mesh(shapes.lower,white,knee,0,-.18);const foot=mesh(shapes.boot,dark,knee,0,-.36,.13);
    limbs.push({arm,leg,side,knee,elbow,foot});
  }
  const shadow=mesh(new THREE.CircleGeometry(.88,16),new THREE.MeshBasicMaterial({color:0x071d22,transparent:true,opacity:.2,depthWrite:false}),root,0,.045);
  shadow.rotation.x=-Math.PI/2;
  root.userData={body,limbs,initialized:false,jerseyNumber:player.n,gaitPhase:player.id*2.39996,moveBlend:0,lastSpeed:0};
  return root;
}

export function updatePlayerModel(model,player,now,dt=1/60,interpolate=false,prediction=0){
  const x=(THREE.MathUtils.clamp(player.x+player.vx*prediction,9,W-9)-W/2)*SCALE,z=(THREE.MathUtils.clamp(player.y+player.vy*prediction,9,H-9)-H/2)*SCALE;
  const blend=interpolate?1-Math.exp(-22*dt):1;
  const fresh=!model.userData.initialized||Math.hypot(model.position.x-x,model.position.z-z)>12;
  if(fresh){model.position.set(x,0,z);model.userData.initialized=true;model.rotation.y=Math.atan2(player.fx,player.fy);}
  else{model.position.x+=(x-model.position.x)*blend;model.position.z+=(z-model.position.z)*blend;}
  const direction=Math.atan2(player.fx,player.fy),delta=direction-model.rotation.y;
  const turn=Math.atan2(Math.sin(delta),Math.cos(delta));model.rotation.y+=turn*(1-Math.exp(-14*dt));
  const speed=Math.hypot(player.vx,player.vy),targetStride=Math.min(speed/72,1.18);
  model.userData.moveBlend+=(targetStride-model.userData.moveBlend)*(1-Math.exp(-10*dt));
  model.userData.gaitPhase+=speed/(30+player.id%5)*Math.PI*2*dt;
  const phase=model.userData.gaitPhase,stride=model.userData.moveBlend,body=model.userData.body,acceleration=(speed-model.userData.lastSpeed)/Math.max(dt,1/240);model.userData.lastSpeed=speed;
  const breathing=Math.sin(now*.0018+player.id)*.008*(1-Math.min(1,stride));
  body.position.y=Math.abs(Math.cos(phase))*.045*stride+breathing;body.position.x=Math.sin(phase)*.018*stride;
  body.rotation.x=.065*stride+THREE.MathUtils.clamp(acceleration/950,-.065,.09);body.rotation.y=THREE.MathUtils.clamp(turn,-.5,.5)*.3*stride;body.rotation.z=-Math.sin(phase)*.018*stride;
  for(const {arm,leg,side,knee,elbow,foot} of model.userData.limbs){
    const swing=Math.sin(phase+(side>0?0:Math.PI));
    leg.rotation.x=swing*.58*stride;leg.position.y=.8+Math.max(0,-swing)*.035*stride;
    arm.rotation.x=-swing*.46*stride;arm.rotation.z=side*(.12+.025*stride);
    knee.rotation.x=(Math.max(0,-swing)*.72+Math.max(0,Math.cos(phase+(side>0?0:Math.PI)))*.18)*stride;
    elbow.rotation.x=-.22-.3*Math.max(0,swing)*stride;foot.rotation.x=-leg.rotation.x*.2-knee.rotation.x*.24;
    if(player.motionTime>0&&side===1){
      const duration=player.motion==='kick'?.32:player.motion==='tackle'?.4:.38;
      const motion=Math.sin(Math.min(1,player.motionTime/duration)*Math.PI);
      leg.rotation.x-=motion*(player.motion==='kick'?1.02:player.motion==='touch'?.42:.52);knee.rotation.x+=motion*.28;foot.rotation.x-=motion*.18;
    }
    if(player.motionTime>0&&player.motion==='block'){
      const motion=Math.sin(Math.min(1,player.motionTime/.34)*Math.PI);
      arm.rotation.z+=side*.7*motion;arm.rotation.x-=.35*motion;knee.rotation.x+=.22*motion;
    }
  }
}

function pitchMarkings(){
  const vertices=[];
  const line=(x1,z1,x2,z2,width=.13)=>{
    const d=Math.hypot(x2-x1,z2-z1),nx=-(z2-z1)/d*width/2,nz=(x2-x1)/d*width/2;
    vertices.push(x1+nx,.03,z1+nz,x1-nx,.03,z1-nz,x2+nx,.03,z2+nz,
      x2+nx,.03,z2+nz,x1-nx,.03,z1-nz,x2-nx,.03,z2-nz);
  };
  const rect=(x,z,w,h)=>{line(x,z,x+w,z);line(x+w,z,x+w,z+h);line(x+w,z+h,x,z+h);line(x,z+h,x,z);};
  const arc=(x,z,r,start=0,end=Math.PI*2)=>{for(let n=0;n<96;n++){const a=start+(end-start)*n/96,b=start+(end-start)*(n+1)/96;line(x+Math.cos(a)*r,z+Math.sin(a)*r,x+Math.cos(b)*r,z+Math.sin(b)*r);}};
  rect(-HALF_X,-HALF_Z,HALF_X*2,HALF_Z*2);line(0,-HALF_Z,0,HALF_Z);arc(0,0,9.1);arc(0,0,.2);
  for(const side of [-1,1]){
    rect(side<0?-HALF_X:HALF_X-16.5,-20.2,16.5,40.4);
    rect(side<0?-HALF_X:HALF_X-5.5,-9.2,5.5,18.4);
    arc(side*(HALF_X-11),0,.2);
    const middle=side<0?0:Math.PI;arc(side*(HALF_X-11),0,9.1,middle-.93,middle+.93);
    for(const end of [-1,1])arc(side*HALF_X,end*HALF_Z,1.2,side<0?(end<0?0:-Math.PI/2):(end<0?Math.PI/2:Math.PI),side<0?(end<0?Math.PI/2:0):(end<0?Math.PI:Math.PI*1.5));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xe4eed6,side:THREE.DoubleSide,toneMapped:false}));
}
function beam(parent,from,to,radius=.1){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),direction=b.clone().sub(a);
  const object=mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),8),white,parent);
  object.position.copy(a.add(b).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
}
function goal(side){
  const group=new THREE.Group();group.name=side<0?'goal-left':'goal-right';
  const x=side*HALF_X,back=x+side*2.8;
  for(const z of [-3.66,3.66]){beam(group,[x,0,z],[x,2.44,z]);beam(group,[x,2.44,z],[back,.1,z],.065);beam(group,[x,.1,z],[back,.1,z],.065);}
  beam(group,[x,2.44,-3.66],[x,2.44,3.66]);
  const points=[];const segment=(a,b)=>points.push(...a,...b);
  for(let z=-3.66;z<=3.66;z+=.4)segment([back,0,z],[back,2.44,z]);
  for(let y=0;y<=2.44;y+=.4){segment([back,y,-3.66],[back,y,3.66]);for(const z of [-3.66,3.66])segment([x,y,z],[back,y,z]);}
  const netGeometry=new THREE.BufferGeometry();netGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  group.add(new THREE.LineSegments(netGeometry,new THREE.LineBasicMaterial({color:0xd5e5d6,transparent:true,opacity:.25})));
  return group;
}
function selection(color){
  const group=new THREE.Group(),ring=mesh(new THREE.RingGeometry(1.05,1.27,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}),group,0,.09);
  ring.rotation.x=-Math.PI/2;
  const pointer=mesh(new THREE.ConeGeometry(.26,.55,3),new THREE.MeshBasicMaterial({color,toneMapped:false}),group,0,3.65);
  pointer.rotation.z=Math.PI;group.userData.pointer=pointer;return group;
}

export function fitWideCamera(camera,aspect){
  camera.aspect=aspect;camera.updateProjectionMatrix();let distance=90;
  const direction=new THREE.Vector3(0,1,.88).normalize(),point=new THREE.Vector3();
  for(let n=0;n<55;n++){
    camera.position.copy(direction).multiplyScalar(distance);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    let fits=true;
    for(const x of [-HALF_X-5,HALF_X+5])for(const z of [-HALF_Z-6,HALF_Z+6])for(const y of [0,4]){
      point.set(x,y,z).project(camera);if(Math.abs(point.x)>.92||Math.abs(point.y)>.92)fits=false;
    }
    if(fits)return distance;distance*=1.06;
  }
  return distance;
}

// Include the controlled receiver as well as the ball, so a pass never causes
// the camera to abandon the player the human needs to steer.
export function followFrame(ball,active,aspect=1.5){
  const focus=new THREE.Vector3(ball.x*.65+active.x*.35,0,ball.z*.65+active.z*.35);
  const spread=Math.max(Math.abs(ball.x-active.x)/Math.max(.65,aspect),Math.abs(ball.z-active.z));
  return {focus,distance:Math.max(38,spread*2+28)};
}

export function createWorld(){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x192f35);scene.fog=new THREE.Fog(0x192f35,180,370);
  scene.add(new THREE.HemisphereLight(0xf5f4dc,0x3c6650,2.4));
  const sun=new THREE.DirectionalLight(0xffe4bd,2.5);sun.position.set(-25,65,35);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-80,right:80,top:65,bottom:-65,near:.5,far:160});
  sun.shadow.normalBias=.08;sun.shadow.bias=-.0003;scene.add(sun);
  mesh(new THREE.BoxGeometry(124,.8,88),solid(0x244b40),scene,0,-.45);
  const grass=[solid(0x36724f),solid(0x30704b)];
  for(let n=0;n<20;n++){const stripe=mesh(new THREE.PlaneGeometry(W*SCALE/20,H*SCALE),grass[n%2],scene,-HALF_X+(n+.5)*W*SCALE/20,0);stripe.rotation.x=-Math.PI/2;stripe.receiveShadow=true;}
  scene.add(pitchMarkings(),goal(-1),goal(1));
  for(const side of [-1,1]){
    for(let row=0;row<3;row++)mesh(new THREE.BoxGeometry(110,.7+row*.45,1.1),solid(row%2?0x344b50:0x263e45),scene,0,-.1+row*.25,side*(38+row*1.4));
    for(const end of [-1,1]){
      const flag=new THREE.Group();flag.position.set(side*(HALF_X+.4),0,end*(HALF_Z+.4));
      beam(flag,[0,0,0],[0,1.6,0],.04);mesh(new THREE.PlaneGeometry(.65,.4),new THREE.MeshBasicMaterial({color:0xd5f581,side:THREE.DoubleSide}),flag,.3,1.35);scene.add(flag);
    }
  }
  const players=new Map();for(let id=0;id<22;id++){const model=createPlayerModel({id,team:Math.floor(id/11),n:id%11+1});players.set(id,model);scene.add(model);}
  const ballGeometry=new THREE.IcosahedronGeometry(.3,1),colors=[],color=new THREE.Color();
  for(let n=0;n<ballGeometry.attributes.position.count;n++){color.setHex(Math.floor(n/3)%5===0?0x24343a:0xf4f2e3);colors.push(color.r,color.g,color.b);}
  ballGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const ball=mesh(ballGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}),scene,0,.31);ball.castShadow=true;ball.name='match-ball';
  const ballShadow=mesh(new THREE.CircleGeometry(.38,16),new THREE.MeshBasicMaterial({color:0x071d22,transparent:true,opacity:.3,depthWrite:false}),scene,0,.06);ballShadow.rotation.x=-Math.PI/2;
  const selected=selection(0xd5f581),opponent=selection(0xd6e2e5);opponent.userData.pointer.visible=false;scene.add(selected,opponent);
  const receiver=selection(0xffd986);receiver.userData.pointer.visible=false;scene.add(receiver);
  const energy=new THREE.Group();mesh(new THREE.BoxGeometry(2.2,.12,.1),dark,energy);
  const energyFill=mesh(new THREE.BoxGeometry(2.1,.09,.12),new THREE.MeshBasicMaterial({color:0xd5f581,toneMapped:false}),energy);scene.add(energy);
  const charge=new THREE.Group();mesh(new THREE.BoxGeometry(3,.18,.12),dark,charge);
  const chargeFill=mesh(new THREE.BoxGeometry(2.9,.13,.14),new THREE.MeshBasicMaterial({color:0xffbb70,toneMapped:false}),charge);scene.add(charge);
  const aim=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),5,0xd5f581,1,.55);scene.add(aim);
  const camera=new THREE.PerspectiveCamera(43,1.5,.1,1000);fitWideCamera(camera,1.5);
  return {scene,camera,players,ball,ballShadow,selected,opponent,receiver,energy,energyFill,charge,chargeFill,aim};
}

function addJerseyNumbers(players){
  const materials=new Map();
  for(const model of players.values()){
    const number=model.userData.jerseyNumber;
    if(!materials.has(number)){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const context=canvas.getContext('2d');context.fillStyle='#182c32';context.font='bold 88px Arial';context.textAlign='center';context.textBaseline='middle';context.fillText(number,64,67);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      materials.set(number,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    }
    for(const side of [-1,1]){const label=mesh(new THREE.PlaneGeometry(.51,.51),materials.get(number),model.userData.body,0,1.5,side*.445);if(side<0)label.rotation.y=Math.PI;}
  }
}

export function create3DView(canvas,onUnavailable=()=>{}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const world=createWorld();addJerseyNumbers(world.players);
  let cameraMode='follow',lastTime=0,lastGame=null,snapshotAt=0,cameraReady=false,cameraDistance=38;const focus=new THREE.Vector3(),direction=new THREE.Vector3();
  const resize=()=>{
    const rect=canvas.parentElement.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
    renderer.setSize(width,height,false);world.camera.aspect=width/height;world.camera.updateProjectionMatrix();
    if(cameraMode==='wide')fitWideCamera(world.camera,width/height);
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();onUnavailable();});
  return {
    setCameraMode(value){cameraMode=value;cameraReady=false;resize();},
    render(game,{team=0,mode='lobby',input={},chargeStart=0,now=0}={}){
      const dt=Math.min(.1,Math.max(1/240,(now-lastTime)/1000));lastTime=now;
      if(game!==lastGame){lastGame=game;snapshotAt=now;}
      const prediction=mode==='online'&&game.phase==='playing'?Math.min(.1,(now-snapshotAt)/1000):0;
      for(const player of game.players){const model=world.players.get(player.id),pose=game.phase==='playing'?player:{...player,vx:0,vy:0};if(model)updatePlayerModel(model,pose,now,dt,mode==='online',prediction);}
      const active=world.players.get(game.selected[team]),rival=world.players.get(game.selected[1-team]);
      world.selected.visible=mode!=='lobby';world.opponent.visible=mode==='online';
      world.selected.position.copy(active.position);world.opponent.position.copy(rival.position);
      world.selected.userData.pointer.rotation.y=now*.001;
      world.energy.visible=mode!=='lobby';world.energy.position.copy(active.position);world.energy.position.y=2.25;
      const stamina=game.players[game.selected[team]].stamina;world.energyFill.scale.x=Math.max(.01,stamina);world.energyFill.position.x=-(1-stamina)*1.05;
      world.charge.visible=!!chargeStart&&mode!=='lobby';world.charge.position.copy(active.position);world.charge.position.y=4.15;
      const power=Math.min(1,Math.max(0,(now-chargeStart)/900));world.chargeFill.scale.x=Math.max(.01,power);world.chargeFill.position.x=-(1-power)*1.45;
      const bx=(game.ball.x+game.ball.vx*prediction-W/2)*SCALE,bz=(game.ball.y+game.ball.vy*prediction-H/2)*SCALE,blend=mode==='online'?1-Math.exp(-25*dt):1;
      if(Math.hypot(world.ball.position.x-bx,world.ball.position.z-bz)>12)world.ball.position.set(bx,.31,bz);
      else{world.ball.position.x+=(bx-world.ball.position.x)*blend;world.ball.position.z+=(bz-world.ball.position.z)*blend;}
      world.ball.rotation.z-=game.ball.vx*SCALE*dt/.3;world.ball.rotation.x+=game.ball.vy*SCALE*dt/.3;
      world.ballShadow.position.set(world.ball.position.x,.06,world.ball.position.z);
      world.receiver.visible=mode!=='lobby'&&!!game.pass;
      if(game.pass){world.receiver.position.set((game.pass.x-W/2)*SCALE,.02,(game.pass.y-H/2)*SCALE);world.receiver.scale.setScalar(.7);}
      world.aim.visible=mode!=='lobby'&&game.ball.owner===game.selected[team];
      if(world.aim.visible){const p=game.players[game.selected[team]],moving=Math.hypot(input.x||0,input.y||0)>.1;direction.set(moving?input.x:p.fx,0,moving?input.y:p.fy).normalize();world.aim.setDirection(direction);world.aim.position.copy(active.position).addScaledVector(direction,1.5);world.aim.position.y=.12;}
      if(cameraMode==='follow'){
        const frame=followFrame(world.ball.position,active.position,world.camera.aspect);
        if(!cameraReady){focus.copy(frame.focus);cameraDistance=frame.distance;cameraReady=true;}
        else{focus.lerp(frame.focus,1-Math.exp(-2.5*dt));cameraDistance+=(frame.distance-cameraDistance)*(1-Math.exp(-3*dt));}
        world.camera.position.set(focus.x,cameraDistance*.75,focus.z+cameraDistance*.66);world.camera.lookAt(focus);world.camera.updateMatrixWorld(true);
      }
      renderer.render(world.scene,world.camera);
    },
    dispose(){observer.disconnect();world.scene.traverse(object=>{object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)if(material){material.map?.dispose();material.dispose();}});renderer.dispose();}
  };
}
