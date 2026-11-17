// combat.js — on-foot shooting: hitscan with tracer, muzzle flash, damage to
// pedestrians and officers, and a simple melee shove when unarmed up close.
import * as THREE from 'three';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.ammo = 12;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.tracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    this.tracer.visible = false;
    scene.add(this.tracer);
    this.flash = new THREE.PointLight(0xffd23f, 0, 18);
    scene.add(this.flash);
    this.flashTimer = 0;
  }
  // Returns {hit: 'ped'|'officer'|'car'|null, target} — caller applies effects.
  shoot(origin, dir, targets) {
    if (this.cooldown > 0 || this.reloadTimer > 0 || this.ammo <= 0) return null;
    this.ammo--; this.cooldown = 0.28; this.flashTimer = 0.07;
    this.flash.position.copy(origin).addScaledVector(dir, 2);
    this.flash.intensity = 60;
    const ray = new THREE.Raycaster(origin, dir, 0.1, 90);
    let best = null, bestDist = 90;
    for (const t of targets) {
      const pos = t.mesh ? t.mesh.position : t.position;
      const to = new THREE.Vector3(pos.x - origin.x, 1.2 - origin.y, pos.z - origin.z);
      const along = to.dot(dir);
      if (along < 0 || along > 90) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < 1.6 && along < bestDist) { best = t; bestDist = along; }
    }
    const end = origin.clone().addScaledVector(dir, best ? bestDist : 60);
    this.showTracer(origin, end);
    if (best) {
      return { hit: best.kind, target: best, dist: bestDist };
    }
    return { hit: null, target: null, dist: 0 };
  }
  showTracer(from, to) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    this.tracer.position.copy(mid);
    this.tracer.scale.set(1, from.distanceTo(to), 1);
    this.tracer.lookAt(to);
    this.tracer.rotateX(Math.PI / 2);
    this.tracer.visible = true;
    setTimeout(() => { this.tracer.visible = false; }, 60);
  }
  reload() {
    if (this.reloadTimer > 0 || this.ammo === 12) return;
    this.reloadTimer = 1.1;
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = 12;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
  }
}
