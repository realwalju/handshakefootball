import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld,createPlayerModel,updatePlayerModel,fitWideCamera,followFrame} from '../src/view-3d.js';
import {W,H} from '../public/engine.js';

test('3D world has 22 articulated players, two goals and a grounded ball',()=>{
  const world=createWorld();assert.equal(world.players.size,22);
  assert.ok(world.scene.getObjectByName('goal-left'));assert.ok(world.scene.getObjectByName('goal-right'));
  assert.equal(world.ball.name,'match-ball');assert.ok(world.ball.position.y>0);
  for(const [id,model] of world.players){
    assert.equal(model.name,`player-${id}`);assert.equal(model.userData.jerseyNumber,id%11+1);
    assert.equal(model.userData.limbs.length,2);const height=new THREE.Box3().setFromObject(model).max.y;assert.ok(height>1.8&&height<2.05);
  }
});
test('broadcast camera includes the controlled player and ball with a stable minimum distance',()=>{
  const frame=followFrame(new THREE.Vector3(20,0,10),new THREE.Vector3(-10,0,-5),1.5);
  assert.deepEqual(frame.focus.toArray(),[9.5,0,4.75]);assert.equal(frame.distance,68);
  assert.equal(followFrame(new THREE.Vector3(),new THREE.Vector3(),1.5).distance,38);
});
test('3D models map pitch coordinates, face movement and animate without mutating simulation data',()=>{
  const player={id:9,n:10,team:0,x:W/2+100,y:H/2-50,fx:1,fy:0,vx:145,vy:0},before=JSON.stringify(player);
  const model=createPlayerModel(player);updatePlayerModel(model,player,1000);
  assert.equal(model.position.x,10);assert.equal(model.position.z,-5);assert.ok(Math.abs(model.rotation.y-Math.PI/2)<1e-9);
  assert.notEqual(model.userData.limbs[0].leg.rotation.x,0);assert.equal(JSON.stringify(player),before);
  const moving=Math.abs(model.userData.limbs[0].leg.rotation.x);updatePlayerModel(model,{...player,vx:0},1100);
  assert.ok(Math.abs(model.userData.limbs[0].leg.rotation.x)<moving);
  const arm=model.userData.limbs[0].arm,restingArm=Math.abs(arm.rotation.z);updatePlayerModel(model,{...player,vx:0,motion:'block',motionTime:.17},1150);assert.ok(Math.abs(arm.rotation.z)>restingArm);
  for(let i=0;i<60;i++)updatePlayerModel(model,{...player,vx:0},1200+i*17);
  assert.ok(Math.abs(model.userData.limbs[0].leg.rotation.x)<.001);
});
test('wide 3D camera keeps both goals and the full pitch in frame across viewport shapes',()=>{
  for(const aspect of [.75,1.2,1.5,2]){
    const camera=new THREE.PerspectiveCamera(43,aspect,.1,1000);fitWideCamera(camera,aspect);
    for(const x of [-W/20-5,W/20+5])for(const z of [-H/20-6,H/20+6])for(const y of [0,4]){
      const point=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(point.x)<=.92&&Math.abs(point.y)<=.92,`clipped pitch at aspect ${aspect}`);
      assert.ok(point.z>-1&&point.z<1);
    }
  }
});
