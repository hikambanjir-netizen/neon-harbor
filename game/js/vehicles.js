// vehicles.js — car meshes and traffic. Cars are built from boxes (body, cabin,
// wheels) in a palette of original liveries; traffic cars cruise the road grid.
import * as THREE from 'three';

const LIVERIES = [
  { body: 0xd23b2e, name: 'Crimson Comet' },
  { body: 0x2e7ac2, name: 'Harbor Blue' },
  { body: 0xe8c832, name: 'Taxi Sun' },
  { body: 0x3fae5a, name: 'Palm Green' },
  { body: 0x8a5ac2, name: 'Neon Violet' },
  { body: 0xe8e8e8, name: 'Pearl' },
  { body: 0x222831, name: 'Midnight' },
  { body: 0xff7a2e, name: 'Sunset Orange' },
];

export function makeCarMesh(livery, police = false) {
  const g = new THREE.Group();
  const bodyColor = police ? 0x1a2a4a : livery.body;
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1a24 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888888 }));
    bar.position.set(0, 1.75, -0.2); g.add(bar);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xcc0000 }));
    lightR.position.set(-0.32, 1.78, -0.2); g.add(lightR);
    const lightB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000cc }));
    lightB.position.set(0.32, 1.78, -0.2); g.add(lightB);
    g.userData.lightR = lightR; g.userData.lightB = lightB;
  } else {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.05),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    plate.position.set(0, 0.55, 2.22); g.add(plate);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnTrafficCar(scene, x, z, heading) {
  const livery = LIVERIES[Math.floor(Math.random() * LIVERIES.length)];
  const mesh = makeCarMesh(livery);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return { mesh, livery, speed: 6 + Math.random() * 5, heading,
    lane: Math.random() < 0.5 ? -1 : 1, axis: Math.random() < 0.5 ? 'x' : 'z',
    dir: Math.random() < 0.5 ? 1 : -1, stuck: 0 };
}

// Traffic drives along the road grid: pick an axis and a road line, cruise,
// turn at intersections, and slow down when another car is right ahead.
export function updateTraffic(cars, dt, playerPos) {
  for (const car of cars) {
    let ahead = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      if (Math.hypot(dx, dz) < 9) {
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        if (dx * fx + dz * fz > 0) { ahead = true; break; }
      }
    }
    const target = ahead ? 0 : car.speed;
    car.curSpeed = (car.curSpeed ?? car.speed) + (target - (car.curSpeed ?? car.speed)) * Math.min(1, dt * 2);
    const step = car.curSpeed * dt;
    car.mesh.position.x += Math.sin(car.heading) * step;
    car.mesh.position.z += Math.cos(car.heading) * step;
    // At an intersection, sometimes turn onto the cross street.
    const onRoadX = Math.abs(car.mesh.position.x % 60) < 2 || Math.abs((car.mesh.position.x % 60) - 60) < 2;
    const nearLine = Math.min(
      Math.abs(((car.mesh.position.x + 210) % 60)), Math.abs(((car.mesh.position.z + 210) % 60)));
    if (nearLine < 1.5 && Math.random() < dt * 0.25) {
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    if (Math.abs(car.mesh.position.x) > 215 || Math.abs(car.mesh.position.z) > 215) {
      car.heading += Math.PI; // turn around at the city edge
    }
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += step * 2;
    // Avoid the player: swerve a little.
    const pdx = car.mesh.position.x - playerPos.x, pdz = car.mesh.position.z - playerPos.z;
    if (Math.hypot(pdx, pdz) < 6 && car.curSpeed > 1) {
      car.mesh.position.x += (pdx / Math.hypot(pdx, pdz)) * dt * 3;
      car.mesh.position.z += (pdz / Math.hypot(pdx, pdz)) * dt * 3;
    }
  }
}

export function nearestCar(cars, pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
