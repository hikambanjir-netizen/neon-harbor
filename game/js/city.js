// city.js — builds Port Solano: street grid, downtown towers, beach, harbor,
// palm boulevard, lamps and props. Returns collision boxes and key locations.
import * as THREE from 'three';

const PALETTE = [0x2e4a7a, 0x7a4a2e, 0x3d6b52, 0x8a6d2f, 0x5b3a6e, 0x2f6b7a, 0x9c4a5a, 0x44506b];
const WINDOW = new THREE.MeshLambertMaterial({ color: 0xbfd9ff, emissive: 0x223344 });

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildCity(scene) {
  const rand = seededRandom(20261117);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grass/asphalt base, sand beach (west), harbor water (east).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x3f7a44 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(90, 560),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-255, 0.05, 0); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 560),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-340, 0.1, 0); group.add(sea);
  const harborWater = new THREE.Mesh(new THREE.PlaneGeometry(110, 560),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }));
  harborWater.rotation.x = -Math.PI / 2; harborWater.position.set(265, 0.1, 0); group.add(harborWater);

  // Roads: grid every 60 units from -210..210, plus the palm boulevard.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2e35 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xd8c95a });
  const roads = [];
  for (let c = -210; c <= 210; c += 60) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(440, 14), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.06, horizontal ? c : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      group.add(road);
      roads.push({ x: horizontal ? 0 : c, z: horizontal ? c : 0, horizontal });
      // dashed centre line
      for (let d = -200; d <= 200; d += 20) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.6), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? d : c, 0.08, horizontal ? c : d);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        group.add(dash);
      }
    }
  }

  // Buildings: one per block cell, skipped on roads/beach/harbor.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mats = PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const winGeo = new THREE.BoxGeometry(1.02, 0.7, 1.02);
  let buildingCount = 0;
  for (let bx = -180; bx <= 180; bx += 60) {
    for (let bz = -180; bz <= 180; bz += 60) {
      if (Math.abs(bx) < 45 && Math.abs(bz) < 45) continue; // central plaza
      const w = 22 + rand() * 18, d = 22 + rand() * 18;
      const h = (Math.abs(bx) < 90 && Math.abs(bz) < 90)
        ? 26 + rand() * 46 : 8 + rand() * 16;
      const mat = mats[Math.floor(rand() * mats.length)];
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d); b.position.set(bx, h / 2, bz); group.add(b);
      const win = new THREE.Mesh(winGeo, WINDOW);
      win.scale.set(w * 0.92, h * 0.7, d * 0.92); win.position.set(bx, h / 2, bz); group.add(win);
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x222831 }));
      roof.scale.set(w * 0.5, 1.6, d * 0.5); roof.position.set(bx, h + 0.8, bz); group.add(roof);
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      buildingCount++;
    }
  }

  // Central plaza: fountain, benches, the "Solano Spire" landmark tower.
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 70, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8b25a, emissive: 0x332200 }));
  spire.position.set(0, 35, 0); group.add(spire);
  colliders.push({ minX: -9, maxX: 9, minZ: -9, maxZ: 9 });
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x3fa7c7 }));
  fountain.position.set(28, 0.6, 20); group.add(fountain);
  colliders.push({ minX: 18, maxX: 38, minZ: 10, maxZ: 30 });

  // Palm boulevard along z = -210 road (north edge) and the beach promenade.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8a3d });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.4, 3.2, 6);
  for (let x = -200; x <= 200; x += 20) {
    for (const z of [-218, -202]) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x + (rand() - 0.5) * 4, 4.5, z); group.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x, 10, z); group.add(leaves);
    }
  }
  // Beach palms + umbrellas
  for (let z = -220; z <= 220; z += 40) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(-238, 4.5, z); group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(-238, 10, z); group.add(leaves);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 8),
      new THREE.MeshLambertMaterial({ color: 0xff5a7a }));
    umb.position.set(-248, 3, z + 12); group.add(umb);
  }

  // Harbor: docks, containers, cranes.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
  for (const z of [-120, 0, 120]) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(40, 1, 18); dock.position.set(228, 0.5, z); group.add(dock);
  }
  const contColors = [0xc23b2e, 0x2e7ac2, 0x3fae5a, 0xd8a02e];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(boxGeo,
      new THREE.MeshLambertMaterial({ color: contColors[i % 4] }));
    c.scale.set(12, 3, 3.4);
    c.position.set(216 + (i % 2) * 8, 1.5 + Math.floor(i / 7) * 3.2, -150 + (i % 7) * 48);
    group.add(c);
    colliders.push({ minX: c.position.x - 6, maxX: c.position.x + 6,
      minZ: c.position.z - 1.7, maxZ: c.position.z + 1.7 });
  }
  // Cranes (visual only, tall legs at dock edge)
  for (const z of [-60, 60]) {
    const crane = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    crane.scale.set(3, 34, 3); crane.position.set(236, 17, z); group.add(crane);
    const arm = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    arm.scale.set(26, 2, 2); arm.position.set(224, 32, z); group.add(arm);
  }

  // Street lamps along the main roads.
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 7, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (let x = -180; x <= 180; x += 60) {
    for (const z of [-150, -90, -30, 30, 90, 150]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 9, 3.5, z + 9); group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lampMat);
      lamp.position.set(x + 9, 7.2, z + 9); group.add(lamp);
    }
  }

  return {
    colliders, buildingCount,
    bounds: 260,
    spots: {
      start: { x: 30, z: 0 },
      fixer: { x: -30, z: -30 },
      pickup: { x: 150, z: -150 },
      harbor: { x: 228, z: 0 },
      beach: { x: -240, z: 90 },
      hideout: { x: -150, z: 150 },
      plaza: { x: 0, z: 0 },
    },
  };
}

// Keep a point out of building colliders: push it to the nearest free edge.
export function resolveCollision(pos, radius, colliders) {
  for (const c of colliders) {
    if (pos.x > c.minX - radius && pos.x < c.maxX + radius &&
        pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
      const dxl = pos.x - (c.minX - radius), dxr = (c.maxX + radius) - pos.x;
      const dzl = pos.z - (c.minZ - radius), dzr = (c.maxZ + radius) - pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = c.minX - radius;
      else if (m === dxr) pos.x = c.maxX + radius;
      else if (m === dzl) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}
