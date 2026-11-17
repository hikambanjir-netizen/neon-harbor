// main.js — Neon Harbor: wires the city, traffic, pedestrians, police,
// missions, combat, HUD and sound into one playable open-world loop.
// Port Solano is original: its streets, people, cars and story are invented here.
import * as THREE from 'three';
import { buildCity, resolveCollision } from './city.js';
import { makeCarMesh, spawnTrafficCar, updateTraffic, nearestCar } from './vehicles.js';
import { spawnPed, updatePeds } from './pedestrians.js';
import { WantedSystem, spawnPoliceCar, spawnOfficer, updatePolice } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';

const SAVE_KEY = 'neonharbor-save-v1';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // cover | drive | chase | mission | null

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
scene.fog = new THREE.Fog(0x9ec4e8, 120, 420);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

// Sun-soaked lighting: warm sun + sky bounce, slowly moving with the clock.
const sun = new THREE.DirectionalLight(0xffe8b0, 2.2);
sun.position.set(120, 180, 60); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3a5a3a, 1.1));

const city = buildCity(scene);
const hud = new Hud();
const sound = new SoundEngine();
const wanted = new WantedSystem();
const missions = new MissionManager(scene);
const combat = new Combat(scene, camera);

// --- Player state -----------------------------------------------------------
const player = {
  pos: new THREE.Vector3(city.spots.start.x, 0, city.spots.start.z),
  heading: 0, hp: 100, cash: 150, inCar: false, car: null,
  speed: 0, camYaw: Math.PI, camPitch: 0.32, day: 1, hour: 9,
};
const playerMesh = makePlayerMesh();
scene.add(playerMesh);

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd23b2e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), jacket);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.78; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.82; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), jeans);
  legL.position.set(-0.15, 0.4, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  g.userData = { legL, legR };
  return g;
}

// --- World population -------------------------------------------------------
const traffic = [];
const peds = [];
const policeCars = [];
const officers = [];
let playerCar = null; // the car Mara owns/drives (persists when she exits)

function spawnWorld() {
  // Parked cars the player can steal, plus moving traffic.
  const parkedSpots = [[-30, 30], [30, -30], [90, 30], [-90, -90], [150, 90], [-150, -30], [30, 150], [-30, -150]];
  for (const [x, z] of parkedSpots) {
    const car = spawnTrafficCar(scene, x, z, Math.random() * Math.PI * 2);
    car.speed = 0; car.curSpeed = 0; car.parked = true;
    traffic.push(car);
  }
  for (let i = 0; i < 10; i++) {
    const road = -180 + Math.floor(Math.random() * 7) * 60;
    const car = spawnTrafficCar(scene, road, -200 + Math.random() * 400, Math.random() < 0.5 ? 0 : Math.PI);
    car.parked = false;
    traffic.push(car);
  }
  for (let i = 0; i < 22; i++) {
    peds.push(spawnPed(scene, -200 + Math.random() * 400, -200 + Math.random() * 400));
  }
}
spawnWorld();

// --- Input ------------------------------------------------------------------
const keys = {};
let mouseDown = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyM') hud.toast(sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyT') tryStartJob();
  if (e.code === 'KeyR') combat.reload();
  if (e.code === 'Escape') togglePause();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (world.mode !== 'playing') return;
  player.camYaw -= e.movementX * 0.0032;
  player.camPitch = Math.max(-0.15, Math.min(0.9, player.camPitch + e.movementY * 0.0022));
});
addEventListener('mousedown', (e) => {
  if (world.mode !== 'playing' || player.inCar) return;
  mouseDown = true; sound.ensure(); tryShoot();
});
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
document.getElementById('playbtn').addEventListener('click', () => startGame(false));
document.getElementById('continuebtn').addEventListener('click', () => startGame(true));
document.getElementById('resumebtn').addEventListener('click', togglePause);
document.getElementById('savebtn').addEventListener('click', () => { saveGame(); hud.toast('GAME SAVED'); });
document.getElementById('quitbtn').addEventListener('click', () => { saveGame(); location.reload(); });
document.getElementById('bustedbtn').addEventListener('click', () => respawnAfter('busted'));
document.getElementById('wastedbtn').addEventListener('click', () => respawnAfter('wasted'));
canvas.addEventListener('click', () => { if (world.mode === 'playing') canvas.requestPointerLock?.(); });

const world = {
  mode: 'title', paused: false, time: 0, cash: 150,
  get wantedStars() { return wanted.stars; },
};
window.__neon = { world, player, wanted, missions, traffic, peds, policeCars, officers };

// --- Game flow --------------------------------------------------------------
function startGame(loadSave) {
  sound.ensure();
  document.getElementById('startscreen').classList.add('hidden');
  if (loadSave) loadGame();
  world.mode = 'playing';
  hud.toast('Welcome to Port Solano — press T for your first job');
  hud.setObjective(missions.objectiveText());
}
function togglePause() {
  if (world.mode !== 'playing' && world.mode !== 'paused') return;
  world.mode = world.mode === 'paused' ? 'playing' : 'paused';
  document.getElementById('pausescreen').classList.toggle('hidden', world.mode !== 'paused');
  if (world.mode === 'paused') {
    document.getElementById('pausestats').textContent =
      `Cash $${player.cash} · Wanted ${wanted.stars}★ · Jobs done ${missions.missionIndex} of ${MISSIONS.length}`;
  }
}
function saveGame() {
  const data = { cash: player.cash, hp: player.hp, x: player.pos.x, z: player.pos.z,
    day: player.day, hour: player.hour, missions: missions.serialize() };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
}
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data) { hud.toast('No save found — fresh start'); return; }
    player.cash = data.cash ?? 150; player.hp = data.hp ?? 100;
    player.pos.set(data.x ?? 0, 0, data.z ?? 60);
    player.day = data.day ?? 1; player.hour = data.hour ?? 9;
    missions.restore(data.missions);
    hud.toast('Save loaded — welcome back, Mara');
  } catch { hud.toast('Save could not be read'); }
}
function respawnAfter(kind) {
  document.getElementById(kind).classList.add('hidden');
  player.cash = Math.max(0, player.cash - (kind === 'busted' ? 250 : 150));
  player.hp = 100; wanted.clear();
  clearPolice();
  player.pos.set(city.spots.hideout.x, 0, city.spots.hideout.z);
  if (player.inCar) exitCar();
  world.mode = 'playing';
  hud.toast(kind === 'busted' ? 'Dario posted your bail. Stay clean, Mara.' : 'Patched up at St. Anselm\'s. Get back to work.');
}

function tryStartJob() {
  if (world.mode !== 'playing') return;
  if (!missions.active && missions.missionIndex < MISSIONS.length) {
    const m = missions.startMission();
    hud.toast(m.title); sound.blip(660, 0.12); sound.cash();
    hud.setObjective(missions.objectiveText(), m.title);
    showDialogue(m.intro);
  } else if (!missions.active && !missions.fare) {
    if (missions.startFare()) { hud.toast('FARE ACCEPTED — follow the gold marker'); sound.blip(990, 0.1); }
  }
}
let dialogueTimer = null;
function showDialogue(text) {
  hud.setObjective(text);
  clearTimeout(dialogueTimer);
  // In a staged shot the dialogue must still be on screen when the
  // screenshot lands, so it never reverts there.
  if (!SHOT) dialogueTimer = setTimeout(() => hud.setObjective(missions.objectiveText()), 5000);
}

function tryEnterExitCar() {
  if (world.mode !== 'playing') return;
  if (player.inCar) { exitCar(); return; }
  const car = nearestCar(traffic, player.pos, 4.5);
  if (!car) { hud.setPrompt(''); return; }
  enterCar(car);
}
function enterCar(car) {
  player.inCar = true; player.car = car; playerCar = car;
  car.parked = false;
  playerMesh.visible = false;
  if (!car.stolen) {
    car.stolen = true;
    wanted.addCrime(20, 'Grand theft auto');
    hud.toast('CAR JACKED — the law is coming');
    sound.blip(220, 0.2, 'square', 0.3);
  }
  sound.ensure();
}
function exitCar() {
  if (!player.car) return;
  player.inCar = false;
  const c = player.car.mesh.position;
  player.pos.set(c.x + Math.sin(player.car.heading + Math.PI / 2) * 3, 0, c.z + Math.cos(player.car.heading + Math.PI / 2) * 3);
  player.car = null;
  playerMesh.visible = true;
}

function tryShoot() {
  if (player.inCar || combat.cooldown > 0) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  const targets = [
    ...peds.map((p) => ({ kind: 'ped', mesh: p.mesh, ref: p })),
    ...officers.map((o) => ({ kind: 'officer', mesh: o.mesh, ref: o })),
    ...traffic.map((c) => ({ kind: 'car', mesh: c.mesh, ref: c })),
  ];
  const result = combat.shoot(origin, dir, targets);
  if (!result) return;
  sound.gunshot();
  for (const p of peds) { p.panic = 3; }
  if (result.hit === 'ped') {
    scene.remove(result.target.ref.mesh);
    peds.splice(peds.indexOf(result.target.ref), 1);
    wanted.addCrime(25, 'Assault');
    hud.toast('A pedestrian is down — witnesses called it in');
  } else if (result.hit === 'officer') {
    scene.remove(result.target.ref.mesh);
    officers.splice(officers.indexOf(result.target.ref), 1);
    wanted.addCrime(40, 'Shot an officer');
    hud.toast('You shot an officer — every cruiser in Port Solano is coming');
  } else if (result.hit === 'car') {
    result.target.ref.hits = (result.target.ref.hits ?? 0) + 1;
    if (result.target.ref.hits >= 3) { result.target.ref.speed = 0; result.target.ref.curSpeed = 0; result.target.ref.parked = true; }
    wanted.addCrime(10, 'Property damage');
  } else {
    wanted.addCrime(5, 'Discharged a weapon');
  }
}

// --- Police management ------------------------------------------------------
function clearPolice() {
  for (const c of policeCars) scene.remove(c.mesh);
  for (const o of officers) scene.remove(o.mesh);
  policeCars.length = 0; officers.length = 0;
}
function maintainPolice(dt) {
  const wantCars = wanted.stars >= 1 ? Math.min(wanted.stars, 4) : 0;
  while (policeCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    policeCars.push(spawnPoliceCar(scene, player.pos.x + Math.sin(a) * 70, player.pos.z + Math.cos(a) * 70));
  }
  while (policeCars.length > wantCars) scene.remove(policeCars.pop().mesh);
  const wantOfficers = (!player.inCar && wanted.stars >= 2) ? 2 : 0;
  while (officers.length < wantOfficers) {
    const a = Math.random() * Math.PI * 2;
    officers.push(spawnOfficer(scene, player.pos.x + Math.sin(a) * 25, player.pos.z + Math.cos(a) * 25));
  }
  while (officers.length > wantOfficers) scene.remove(officers.pop().mesh);
  // Officers at close range wear the player down.
  if (!player.inCar) {
    for (const o of officers) {
      const d = Math.hypot(o.mesh.position.x - player.pos.x, o.mesh.position.z - player.pos.z);
      if (d < 9) player.hp -= 9 * dt;
    }
  }
}

// --- Movement ---------------------------------------------------------------
function updatePlayer(dt) {
  const sprint = keys.ShiftLeft || keys.ShiftRight ? 1.6 : 1;
  if (player.inCar && player.car) {
    const car = player.car;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const handbrake = keys.Space ? true : false;
    const accel = fwd > 0 ? 16 : (fwd < 0 ? -11 : 0);
    car.speed += accel * dt;
    car.speed *= handbrake ? Math.max(0, 1 - dt * 2.2) : Math.max(0, 1 - dt * 0.35);
    car.speed = Math.max(-9, Math.min(34, car.speed));
    if (Math.abs(car.speed) > 0.3) {
      car.heading += steer * dt * 1.9 * Math.sign(car.speed) * (handbrake ? 1.5 : 1);
    }
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    const before = { x: car.mesh.position.x, z: car.mesh.position.z };
    resolveCollision(car.mesh.position, 2.4, city.colliders);
    if (car.mesh.position.x !== before.x || car.mesh.position.z !== before.z) car.speed *= 0.4;
    car.mesh.position.x = Math.max(-258, Math.min(258, car.mesh.position.x));
    car.mesh.position.z = Math.max(-258, Math.min(258, car.mesh.position.z));
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -steer * Math.min(1, Math.abs(car.speed) / 20) * 0.06;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
    player.pos.copy(car.mesh.position);
    player.heading = car.heading;
    sound.setEngine(Math.abs(car.speed) / 34, true);
    // Ram damage from police cruisers.
    for (const pc of policeCars) {
      const d = Math.hypot(pc.mesh.position.x - car.mesh.position.x, pc.mesh.position.z - car.mesh.position.z);
      if (d < 3.4) { player.hp -= 6 * dt; car.speed *= 0.98; }
    }
  } else {
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const speed = 6 * sprint;
    const sin = Math.sin(player.camYaw), cos = Math.cos(player.camYaw);
    const mx = (-sin * fwd + cos * strafe) * speed * dt;
    const mz = (-cos * fwd - sin * strafe) * speed * dt;
    player.pos.x += mx; player.pos.z += mz;
    resolveCollision(player.pos, 0.9, city.colliders);
    player.pos.x = Math.max(-258, Math.min(258, player.pos.x));
    player.pos.z = Math.max(-258, Math.min(258, player.pos.z));
    const moving = Math.abs(mx) + Math.abs(mz) > 0.001;
    if (moving) {
      player.heading = Math.atan2(mx, mz);
      playerMesh.userData.legL.rotation.x = Math.sin(world.time * 12) * 0.6;
      playerMesh.userData.legR.rotation.x = -Math.sin(world.time * 12) * 0.6;
    } else {
      playerMesh.userData.legL.rotation.x = 0;
      playerMesh.userData.legR.rotation.x = 0;
    }
    playerMesh.position.copy(player.pos);
    playerMesh.rotation.y = player.heading;
    sound.setEngine(0, false);
  }
  // Camera: third-person orbit, pulled back and higher in a car.
  const dist = player.inCar ? 11 : 7.5;
  const height = player.inCar ? 4.2 : 3.2;
  const cy = player.inCar ? player.heading + Math.PI : player.camYaw;
  const cx = player.pos.x + Math.sin(cy) * Math.cos(player.camPitch) * dist;
  const cz = player.pos.z + Math.cos(cy) * Math.cos(player.camPitch) * dist;
  camera.position.set(cx, player.pos.y + height + Math.sin(player.camPitch) * dist * 0.6,
    cz);
  camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
}

// --- Shot staging (deterministic poses for screenshots) ----------------------
function applyShotMode() {
  document.getElementById('startscreen').classList.add('hidden');
  world.mode = 'playing';
  sound.muted = true;
  if (SHOT === 'cover') {
    // Mara on the east-west boulevard, her stolen Comet beside her, the
    // road and the Solano Spire ahead of her.
    player.pos.set(-30, 0, -86);
    player.camYaw = -Math.PI / 2; player.camPitch = 0.22;
    const car = traffic[0];
    car.mesh.position.set(-24, 0, -90); car.mesh.rotation.y = Math.PI / 2;
    // Bright Sunset Orange livery so the car reads clearly on the cover.
    car.mesh.children[0].material.color.setHex(0xff7a2e);
    player.heading = -Math.PI / 2;
    hud.setObjective('NEON HARBOR — Port Solano. Steal cars, outrun the law, run the jobs.');
  } else if (SHOT === 'drive') {
    const car = traffic[2];
    enterCar(car);
    car.mesh.position.set(-30, 0, -90); car.heading = Math.PI / 2; car.speed = 26;
    player.camYaw = 0; player.camPitch = 0.18;
    wanted.clear();
    hud.setObjective('Driving the boulevard — W A S D to drive, E to step out, Space to handbrake.');
  } else if (SHOT === 'chase') {
    const car = traffic[3];
    enterCar(car);
    // Long straight on road z=-30, heading east, clear of the plaza spire.
    car.mesh.position.set(-150, 0, -30); car.heading = Math.PI / 2; car.speed = 22;
    wanted.heat = 65; wanted.stars = 3;
    // Cruisers ahead of the player car so they are in frame, facing her.
    const cx = car.mesh.position.x, cz = car.mesh.position.z;
    for (const [ox, oz] of [[30, -8], [35, 8], [22, 2]]) {
      const pc = spawnPoliceCar(scene, cx + ox, cz + oz);
      pc.heading = -Math.PI / 2; pc.mesh.rotation.y = -Math.PI / 2;
      policeCars.push(pc);
    }
    hud.setObjective('WANTED ★★★ — lose the cruisers! Outrun them until the stars cool off.');
  } else if (SHOT === 'mission') {
    missions.startMission();
    player.pos.set(138, 0, -138);
    player.camYaw = -Math.PI / 4; player.camPitch = 0.25;
    hud.setObjective(missions.objectiveText(), MISSIONS[0].title);
    showDialogue(MISSIONS[0].intro);
  }
}

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
let readyFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (world.mode === 'playing') {
    world.time += dt;
    player.hour += dt / 120; // 1 game hour per 2 real minutes
    if (player.hour >= 24) { player.hour = 0; player.day++; }
    // Sun swings with the clock; stays bright and warm by day.
    const sunAngle = (player.hour - 6) / 12 * Math.PI;
    sun.position.set(Math.cos(sunAngle) * 160, 120 + Math.sin(sunAngle) * 80, 60);
    sun.intensity = player.hour > 6 && player.hour < 19 ? 2.2 : 1.1;
    scene.background.setHex(player.hour > 6 && player.hour < 19 ? 0x87b8e8 : 0x2a3a5e);

    updatePlayer(dt);
    updateTraffic(traffic.filter((c) => !c.parked && c !== player.car), dt, player.pos);
    updatePeds(peds, dt, player.pos, player.inCar ? 4 : 12);
    combat.update(dt);
    missions.update(dt);
    // Wanted cools only when no police can see the player.
    const nearestPolice = policeCars.length
      ? Math.min(...policeCars.map((c) => Math.hypot(c.mesh.position.x - player.pos.x, c.mesh.position.z - player.pos.z)))
      : 999;
    wanted.update(dt, nearestPolice > 55 && officers.length === 0);
    maintainPolice(dt);
    if (wanted.stars > 0) {
      const arrested = updatePolice(policeCars, officers, dt, player.pos, player.inCar, wanted);
      sound.siren(true);
      if (arrested) { world.mode = 'busted'; document.getElementById('busted').classList.remove('hidden'); }
    } else {
      sound.siren(false);
    }
    if (player.hp < 100 && wanted.stars === 0) player.hp = Math.min(100, player.hp + dt * 2);
    if (player.hp <= 0) { world.mode = 'wasted'; document.getElementById('wasted').classList.remove('hidden'); }

    // Mission / fare arrivals.
    const arrival = missions.checkArrival(player.pos);
    if (arrival) {
      player.cash += arrival.reward;
      sound.cash();
      if (arrival.kind === 'step') hud.toast('Objective complete — next marker lit');
      if (arrival.kind === 'mission') {
        hud.toast(`JOB DONE — +$${arrival.reward}`);
        hud.setObjective(missions.objectiveText());
        saveGame();
      }
      if (arrival.kind === 'all-done') {
        hud.toast(`STORY COMPLETE — +$${arrival.reward}. Port Solano is yours, Mara.`);
        saveGame();
      }
    }
    const fareReward = missions.checkFare(player.pos);
    if (fareReward > 0) { player.cash += fareReward; sound.cash(); hud.toast(`FARE PAID — +$${fareReward}`); }

    // Prompt when a car is close enough to steal.
    const near = !player.inCar ? nearestCar(traffic, player.pos, 4.5) : null;
    hud.setPrompt(near ? `Press E — steal the ${near.livery.name}` : '');
    if (!player.inCar && !missions.active && missions.missionIndex < MISSIONS.length) {
      // keep the objective hint visible without spamming
    }

    hud.setWanted(wanted.stars);
    hud.setCash(player.cash);
    hud.setHealth(player.hp);
    hud.setSpeed(player.inCar && player.car ? Math.abs(player.car.speed) * 2.2 : 0, player.inCar);
    hud.setClock(player.day, player.hour);
    hud.setCrosshair(!player.inCar);
    hud.setObjective(hud.el.objective.textContent || missions.objectiveText());
    hud.drawMinimap({
      player: { x: player.pos.x, z: player.pos.z, heading: player.heading },
      traffic, policeCars, officers, peds, marker: missions.markerPos(),
    });
  }
  renderer.render(scene, camera);
  if (SHOT) {
    readyFrames++;
    if (readyFrames === 12) window.__neonReady = true;
  }
}

if (SHOT) applyShotMode();
requestAnimationFrame(loop);
