// pedestrians.js — Port Solano's walkers: beachgoers, commuters, dock workers.
// They stroll the sidewalks, scatter when gunfire starts, and cross streets.
import * as THREE from 'three';

const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const PANTS = [0x2b2e35, 0x3d5a80, 0x6b4a2a, 0x44506b];

export function makePedMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(Math.random() * SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(Math.random() * PANTS.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xe8b98a, 0xc98a5a, 0x8a5a3a][Math.floor(Math.random() * 3)] });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirt);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.75; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), pants);
  legL.position.set(-0.14, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirt);
  armL.position.set(-0.36, 1.2, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.36; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function spawnPed(scene, x, z) {
  const mesh = makePedMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, heading: Math.random() * Math.PI * 2, speed: 1 + Math.random() * 0.8,
    panic: 0, walkPhase: Math.random() * 6, target: null };
}

export function updatePeds(peds, dt, dangerPos, dangerRadius) {
  for (const p of peds) {
    const dx = p.mesh.position.x - dangerPos.x, dz = p.mesh.position.z - dangerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < dangerRadius) p.panic = 3;
    if (p.panic > 0) {
      p.panic -= dt;
      p.heading = Math.atan2(dx, dz);
      p.speed = 5.5;
    } else {
      p.speed = 1.4;
      if (!p.target || Math.hypot(p.target.x - p.mesh.position.x, p.target.z - p.mesh.position.z) < 4) {
        p.target = { x: -200 + Math.random() * 400, z: -200 + Math.random() * 400 };
      }
      p.heading = Math.atan2(p.target.x - p.mesh.position.x, p.target.z - p.mesh.position.z);
    }
    p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
    p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;
    p.mesh.position.x = Math.max(-250, Math.min(250, p.mesh.position.x));
    p.mesh.position.z = Math.max(-250, Math.min(250, p.mesh.position.z));
    p.mesh.rotation.y = p.heading;
    p.walkPhase += dt * p.speed * 2.4;
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
  }
}
