// hud.js — the 2D overlay: wanted stars, cash, health, speed, objective,
// prompts, toasts, clock, and the live top-down minimap with blips.
export class Hud {
  constructor() {
    this.el = {
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      healthbar: document.getElementById('healthbar'),
      healthtext: document.getElementById('healthtext'),
      speed: document.getElementById('speed'),
      objective: document.getElementById('objective'),
      missiontitle: document.getElementById('missiontitle'),
      prompt: document.getElementById('prompt'),
      toast: document.getElementById('toast'),
      clock: document.getElementById('clock'),
      crosshair: document.getElementById('crosshair'),
    };
    this.map = document.getElementById('minimap');
    this.mctx = this.map.getContext('2d');
    this.toastTimer = null;
  }
  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? '' : 'dim'}">★</span>`;
    this.el.wanted.innerHTML = html;
  }
  setCash(cash) { this.el.cash.textContent = `$${cash.toLocaleString('en-US')}`; }
  setHealth(hp) {
    this.el.healthbar.style.width = `${Math.max(0, hp)}%`;
    this.el.healthtext.textContent = String(Math.max(0, Math.round(hp)));
  }
  setSpeed(mph, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(mph)} mph` : '';
  }
  setObjective(text, title) {
    this.el.objective.textContent = text;
    this.el.missiontitle.textContent = title || '';
  }
  setPrompt(text) { this.el.prompt.textContent = text || ''; }
  setClock(day, hour) {
    const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
    this.el.clock.textContent = `DAY ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  setCrosshair(onFoot) { this.el.crosshair.style.display = onFoot ? 'block' : 'none'; }
  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }
  // Top-down minimap: roads, beach, harbor, player arrow, cars, police, marker.
  drawMinimap(state) {
    const c = this.mctx, S = 220, half = 280;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#12203a'; c.fillRect(0, 0, S, S);
    // Beach (west) and harbor water (east).
    c.fillStyle = '#e8d29a'; c.fillRect(0, 0, 14, S);
    c.fillStyle = '#1e6f9e'; c.fillRect(S - 16, 0, 16, S);
    // Roads.
    c.strokeStyle = '#4a4f5a'; c.lineWidth = 4;
    for (let v = -210; v <= 210; v += 60) {
      const [x1] = toMap(v, 0); c.beginPath(); c.moveTo(x1, 0); c.lineTo(x1, S); c.stroke();
      const [, y1] = toMap(0, v); c.beginPath(); c.moveTo(0, y1); c.lineTo(S, y1); c.stroke();
    }
    // Mission marker (pulsing gold diamond).
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(mx, my - pulse); c.lineTo(mx + pulse, my);
      c.lineTo(mx, my + pulse); c.lineTo(mx - pulse, my); c.closePath(); c.fill();
    }
    const dot = (x, z, color, r) => {
      const [px, py] = toMap(x, z);
      c.fillStyle = color; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
    };
    for (const car of state.traffic) dot(car.mesh.position.x, car.mesh.position.z, '#cfe8ff', 2.5);
    for (const car of state.policeCars) dot(car.mesh.position.x, car.mesh.position.z, '#3fa7ff', 4);
    for (const o of state.officers) dot(o.mesh.position.x, o.mesh.position.z, '#3fa7ff', 3);
    for (const p of state.peds) dot(p.mesh.position.x, p.mesh.position.z, '#ffffff', 1.5);
    // Player arrow.
    const [px, py] = toMap(state.player.x, state.player.z);
    c.save(); c.translate(px, py); c.rotate(state.player.heading);
    c.fillStyle = '#ff5a5a';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    // North marker.
    c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.fillText('N', S / 2 - 4, 12);
  }
}
