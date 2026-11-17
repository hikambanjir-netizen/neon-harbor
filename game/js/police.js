// police.js — the wanted system: stars 0–5, police cruisers and foot officers
// who chase, ram, and arrest. Heat rises with crimes and cools when unseen.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';

export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.heat = 0;          // 0..100, drives star count
    this.coolTimer = 0;
    this.bustedTimer = 0;
  }
  addCrime(amount, reason) {
    this.heat = Math.min(100, this.heat + amount);
    this.coolTimer = 0;
    this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
    return reason;
  }
  update(dt, playerHidden) {
    if (this.heat <= 0) { this.stars = 0; return; }
    if (playerHidden) {
      this.coolTimer += dt;
      if (this.coolTimer > 4) {
        this.heat = Math.max(0, this.heat - dt * 6);
        this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
      }
    } else {
      this.coolTimer = 0;
    }
  }
  clear() { this.stars = 0; this.heat = 0; this.coolTimer = 0; }
}

export function spawnPoliceCar(scene, x, z) {
  const mesh = makeCarMesh(null, true);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, speed: 0, heading: 0, sirenPhase: Math.random() * 6 };
}

export function spawnOfficer(scene, x, z) {
  const mesh = makePedMesh();
  // Navy uniform: recolor the shirt box.
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, heading: 0, speed: 0, walkPhase: 0, isOfficer: true };
}

// Police cars chase the player's position, ramming when close; officers on
// foot sprint at the player and arrest on contact.
export function updatePolice(cars, officers, dt, playerPos, playerInCar, wanted) {
  const chaseSpeed = 16 + wanted.stars * 2.5;
  for (const car of cars) {
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    car.speed += ((dist > 8 ? chaseSpeed : chaseSpeed * 0.4) - car.speed) * Math.min(1, dt * 1.5);
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    car.sirenPhase += dt * 6;
    const on = Math.sin(car.sirenPhase) > 0;
    if (car.mesh.userData.lightR) {
      car.mesh.userData.lightR.material.emissive.setHex(on ? 0xff0000 : 0x330000);
      car.mesh.userData.lightB.material.emissive.setHex(on ? 0x000033 : 0x0000ff);
    }
  }
  let arrest = false;
  for (const o of officers) {
    const dx = playerPos.x - o.mesh.position.x;
    const dz = playerPos.z - o.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    o.heading = Math.atan2(dx, dz);
    o.speed = dist > 2 ? 6.5 : 0;
    o.mesh.position.x += Math.sin(o.heading) * o.speed * dt;
    o.mesh.position.z += Math.cos(o.heading) * o.speed * dt;
    o.mesh.rotation.y = o.heading;
    o.walkPhase += dt * o.speed * 2.4;
    const swing = Math.sin(o.walkPhase) * 0.5;
    o.mesh.userData.legL.rotation.x = swing;
    o.mesh.userData.legR.rotation.x = -swing;
    if (!playerInCar && dist < 1.6) arrest = true;
  }
  return arrest;
}
