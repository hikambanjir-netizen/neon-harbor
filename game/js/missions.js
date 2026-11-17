// missions.js — the story of Neon Harbor: three jobs for fixer Dario Kess,
// plus repeatable taxi fares for cash. Each mission has steps with a map
// marker, objective text and dialogue shown in the HUD.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'pickup', title: 'JOB 1 · THE PICKUP',
    intro: 'DARIO KESS: "Mara. One package at the north docks. Bring it to the plaza — no police, no questions."',
    steps: [
      { text: 'Pick up the package at the north docks', pos: { x: 150, z: -150 } },
      { text: 'Deliver the package to Solano Plaza', pos: { x: 0, z: 0 } },
    ],
    reward: 400,
  },
  {
    id: 'harbor', title: 'JOB 2 · HARBOR RUN',
    intro: 'DARIO KESS: "The harbor crew hid a duffel in container row 7. Grab it, then lose anyone who follows you to the beach hideout."',
    steps: [
      { text: 'Grab the duffel at the harbor containers', pos: { x: 216, z: -60 } },
      { text: 'Reach the beach hideout at the west shore', pos: { x: -240, z: 90 } },
    ],
    reward: 700,
  },
  {
    id: 'getaway', title: 'JOB 3 · THE GETAWAY',
    intro: 'DARIO KESS: "Last one, Mara. The harbor master\'s ledger is in the plaza tower. Take it — then get clean. If the stars are on you, shake them before you come home."',
    steps: [
      { text: 'Steal the ledger from Solano Plaza', pos: { x: 0, z: 0 } },
      { text: 'Escape the police, then reach the hideout', pos: { x: -150, z: 150 } },
    ],
    reward: 1200,
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.fare = null; // repeatable taxi fare {pos, reward}
    this.beacon = this.makeBeacon();
    scene.add(this.beacon);
    this.beacon.visible = false;
  }
  makeBeacon() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 30; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    return g;
  }
  currentMission() { return MISSIONS[this.missionIndex] ?? null; }
  currentStep() {
    const m = this.currentMission();
    return m ? m.steps[this.stepIndex] : null;
  }
  startMission() {
    const m = this.currentMission();
    if (!m) return null;
    this.active = true; this.stepIndex = 0;
    this.placeBeacon(m.steps[0].pos);
    return m;
  }
  placeBeacon(pos) {
    this.beacon.position.set(pos.x, 0, pos.z);
    this.beacon.visible = true;
  }
  // Returns 'step' | 'mission' | 'all-done' | null.
  checkArrival(playerPos) {
    if (!this.active) return null;
    const step = this.currentStep();
    if (!step) return null;
    const d = Math.hypot(step.pos.x - playerPos.x, step.pos.z - playerPos.z);
    if (d > 7) return null;
    this.stepIndex++;
    const m = this.currentMission();
    if (this.stepIndex >= m.steps.length) {
      this.active = false; this.beacon.visible = false;
      const reward = m.reward;
      this.missionIndex++;
      if (this.missionIndex >= MISSIONS.length) return { kind: 'all-done', reward };
      return { kind: 'mission', reward };
    }
    this.placeBeacon(m.steps[this.stepIndex].pos);
    return { kind: 'step', reward: 0 };
  }
  objectiveText() {
    if (this.active) {
      const m = this.currentMission();
      return `${m.title} — ${m.steps[this.stepIndex].text}`;
    }
    if (this.fare) return `FARE — drop the passenger at the marker ($${this.fare.reward})`;
    if (this.missionIndex >= MISSIONS.length) return 'STORY COMPLETE — free roam. Press T for a taxi fare.';
    return 'Press T to start the next job for Dario Kess.';
  }
  markerPos() {
    if (this.active) return this.currentStep().pos;
    if (this.fare) return this.fare.pos;
    return null;
  }
  startFare() {
    if (this.active || this.fare) return false;
    const spots = [{ x: -150, z: -150 }, { x: 150, z: 150 }, { x: -30, z: 150 }, { x: 228, z: 120 }, { x: -240, z: -90 }];
    const pos = spots[Math.floor(Math.random() * spots.length)];
    this.fare = { pos, reward: 120 + Math.floor(Math.random() * 3) * 40 };
    this.placeBeacon(pos);
    return true;
  }
  checkFare(playerPos) {
    if (!this.fare) return 0;
    const d = Math.hypot(this.fare.pos.x - playerPos.x, this.fare.pos.z - playerPos.z);
    if (d > 7) return 0;
    const r = this.fare.reward;
    this.fare = null; this.beacon.visible = false;
    return r;
  }
  update(dt) {
    this.beacon.rotation.y += dt * 0.8;
    const s = 1 + Math.sin(performance.now() / 300) * 0.12;
    this.beacon.scale.set(s, 1, s);
  }
  serialize() { return { missionIndex: this.missionIndex, active: this.active, stepIndex: this.stepIndex }; }
  restore(data) {
    if (!data) return;
    this.missionIndex = data.missionIndex ?? 0;
    this.stepIndex = data.stepIndex ?? 0;
    this.active = !!data.active;
    if (this.active && this.currentStep()) this.placeBeacon(this.currentStep().pos);
  }
}
