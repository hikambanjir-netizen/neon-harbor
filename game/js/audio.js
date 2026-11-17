// audio.js — all sound is synthesized with WebAudio: engine hum, two-tone
// sirens, gunshots, UI blips and a laid-back bass-and-hats music loop.
// No audio files, no network.
export class SoundEngine {
  constructor() {
    this.ctx = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null;
    this.musicTimer = null; this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth + lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.startMusic();
    } catch { this.ctx = null; }
  }
  setEngine(speedNorm, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 160, t, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : (inCar ? 0.05 + speedNorm * 0.09 : 0), t, 0.1);
  }
  blip(freq = 880, dur = 0.08, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  gunshot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(this.master); src.start();
  }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 260;
      this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 800;
      this.sirenLfo.start();
    }
    if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : (on ? 0.045 : 0), this.ctx.currentTime, 0.2);
    }
  }
  cash() { this.blip(1320, 0.1, 'sine', 0.25); setTimeout(() => this.blip(1760, 0.14, 'sine', 0.25), 90); }
  startMusic() {
    // A slow 96 BPM loop: root bass notes + soft hats, original pattern.
    const bassNotes = [55, 0, 55, 65.4, 0, 49, 0, 58.3];
    const stepDur = 60 / 96 / 2;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) { this.musicStep++; return; }
      const note = bassNotes[this.musicStep % 8];
      if (note) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = note;
        g.gain.setValueAtTime(0.12, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + stepDur * 1.8);
        o.connect(g).connect(this.master); o.start(); o.stop(this.ctx.currentTime + stepDur * 2);
      }
      if (this.musicStep % 2 === 0) this.blip(6000, 0.02, 'square', 0.02);
      this.musicStep++;
    }, stepDur * 1000);
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
