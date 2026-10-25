/**
 * Procedurální zvuk a hudba přes Web Audio API – bez externích souborů.
 * Hudba se skládá z orientálních motivů, ambient z větru, vody a ptáků.
 */
const MUSIC_MODES = {
  menu: {
    tempo: 54, root: 196, wave: 'triangle', melodyGain: 0.075, droneGain: 0.035,
    pattern: [0, 2, 4, 2, 3, 1, 0, -2, 0, 2, 5, 4, 3, 2, 1, 0], drone: true, perc: false
  },
  game: {
    tempo: 62, root: 174.6, wave: 'triangle', melodyGain: 0.06, droneGain: 0.04,
    pattern: [0, 3, 2, 4, 3, 5, 4, 2, 1, 3, 2, 0, -1, 1, 2, 3], drone: true, perc: false
  },
  battle: {
    tempo: 108, root: 146.8, wave: 'sawtooth', melodyGain: 0.05, droneGain: 0.03,
    pattern: [0, 0, 3, 2, 0, 4, 3, 2, 0, 0, 5, 4, 3, 2, 1, 0], drone: true, perc: true
  }
};

const SCALE = [0, 1, 4, 5, 7, 8, 11]; // Hijaz / orientální stupnice

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambientBus = null;
    this.noiseBuffer = null;

    this.musicVolume = 0.55;
    this.sfxVolume = 0.8;
    this.musicMuted = false;
    this.sfxMuted = false;

    this.musicMode = 'none';
    this.ducked = false;
    this.biome = 'desert';

    this.schedulerTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.battleTimer = 0;

    this.windSource = null;
    this.waterSource = null;
    this.windGain = null;
    this.waterGain = null;

    this.ambientTimer = 1.5;
    this.lastSfx = new Map();
    this.started = false;
  }

  /* ---------------------------------------------------------------- */
  /*  Inicializace                                                     */
  /* ---------------------------------------------------------------- */

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.5;
      this.ambientBus.connect(this.master);

      this.makeNoise();
      this.startAmbient();
      this.schedulerTimer = setInterval(() => this.scheduleMusic(), 180);
      return true;
    } catch (err) {
      console.warn('Audio se nepodařilo spustit', err);
      this.ctx = null;
      return false;
    }
  }

  unlock() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.started = true;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last;
    }
    this.noiseBuffer = buffer;
  }

  startAmbient() {
    // Vítr.
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(windFilter).connect(this.windGain).connect(this.ambientBus);
    wind.start();
    this.windSource = wind;

    // Voda (zapíná se v oáze).
    const water = this.ctx.createBufferSource();
    water.buffer = this.noiseBuffer;
    water.loop = true;
    const waterFilter = this.ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.value = 950;
    waterFilter.Q.value = 0.5;
    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.value = 0;
    water.connect(waterFilter).connect(this.waterGain).connect(this.ambientBus);
    water.start();
    this.waterSource = water;
  }

  setBiome(biome) {
    this.biome = biome || 'desert';
    if (!this.ctx) return;
    const target = this.biome === 'desert' ? 0.06 : this.biome === 'canyon' ? 0.035 : 0.028;
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
    const waterTarget = this.biome === 'oasis' ? 0.035 : this.biome === 'desert' ? 0.012 : 0;
    this.waterGain.gain.setTargetAtTime(waterTarget, this.ctx.currentTime, 0.6);
  }

  /* ---------------------------------------------------------------- */
  /*  Hlasitost                                                        */
  /* ---------------------------------------------------------------- */

  setVolumes(music, sfx) {
    this.musicVolume = Math.max(0, Math.min(1, music / 100));
    this.sfxVolume = Math.max(0, Math.min(1, sfx / 100));
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(this.musicVolume * (this.ducked ? 0.5 : 1), this.ctx.currentTime, 0.15);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
  }

  setMuted(musicMuted, sfxMuted) {
    this.musicMuted = !!musicMuted;
    this.sfxMuted = !!sfxMuted;
    this.setVolumes(this.musicVolume * 100, this.sfxVolume * 100);
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(
      this.musicMuted ? 0 : this.musicVolume * (this.ducked ? 0.5 : 1),
      this.ctx.currentTime, 0.12
    );
    this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime, 0.08);
  }

  duck(on) {
    this.ducked = !!on;
    if (!this.ctx) return;
    const target = this.musicMuted ? 0 : this.musicVolume * (on ? 0.5 : 1);
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  /* ---------------------------------------------------------------- */
  /*  Hudba                                                            */
  /* ---------------------------------------------------------------- */

  setMusicMode(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.step = 0;
    this.nextNoteTime = this.ctx ? this.ctx.currentTime + 0.08 : 0;
    if (mode === 'victory') this.playVictory();
    if (mode === 'defeat') this.playDefeat();
  }

  scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.musicMuted || this.musicVolume <= 0) return;
    const spec = MUSIC_MODES[this.musicMode];
    if (!spec) return;
    const stepDur = 30 / spec.tempo;
    while (this.nextNoteTime < this.ctx.currentTime + 0.5) {
      const t = Math.max(this.nextNoteTime, this.ctx.currentTime);
      const degree = spec.pattern[this.step % spec.pattern.length];
      if (degree !== null) {
        const semi = SCALE[((degree % SCALE.length) + SCALE.length) % SCALE.length] +
          Math.floor(degree / SCALE.length) * 12;
        const freq = spec.root * Math.pow(2, semi / 12);
        this.playPluck(freq, t, stepDur * 1.7, spec.melodyGain, spec.wave);
        if (this.step % 4 === 0) {
          this.playPluck(freq * 2, t + 0.03, stepDur * 0.7, spec.melodyGain * 0.45, 'sine');
        }
      }
      if (spec.drone && this.step % 8 === 0) {
        this.playDrone(spec.root / 2, t, stepDur * 8, spec.droneGain);
      }
      if (spec.perc) {
        if (this.step % 4 === 0) this.playDrum(t, 0.08, 90);
        if (this.step % 4 === 2) this.playDrum(t, 0.045, 150);
      }
      // Občasné orientální ozdoby.
      if (this.step % 16 === 7 && Math.random() < 0.5) {
        const freq = spec.root * Math.pow(2, SCALE[3] / 12) * 2;
        this.playPluck(freq, t + stepDur * 0.4, stepDur * 0.4, spec.melodyGain * 0.5, 'sine');
      }
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  playPluck(freq, time, dur, gain, wave = 'triangle') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter).connect(g).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  playDrone(freq, time, dur, gain) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.1);
  }

  playDrum(time, gain, baseFreq) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, time + 0.18);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(g).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  playVictory() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.1;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.playBrass(f, t0 + i * 0.22, 0.5, 0.12);
      if (i % 2 === 0) this.playDrum(t0 + i * 0.22, 0.1, 80);
    });
  }

  playDefeat() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.1;
    const notes = [392, 349.23, 311.13, 261.63, 196];
    notes.forEach((f, i) => {
      this.playBrass(f, t0 + i * 0.45, 0.9, 0.09);
    });
  }

  playBrass(freq, time, dur, gain) {
    if (!this.ctx) return;
    for (const detune of [0, 4]) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, time);
      filter.frequency.linearRampToValueAtTime(2200, time + dur * 0.4);
      filter.frequency.exponentialRampToValueAtTime(600, time + dur);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(gain, time + 0.05);
      g.gain.setValueAtTime(gain, time + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(filter).connect(g).connect(this.musicBus);
      osc.start(time);
      osc.stop(time + dur + 0.1);
    }
  }

  combat() {
    this.battleTimer = 9;
    if (this.musicMode === 'game' || this.musicMode === 'menu') this.setMusicMode('battle');
  }

  update(dt) {
    if (this.battleTimer > 0) {
      this.battleTimer -= dt;
      if (this.battleTimer <= 0 && this.musicMode === 'battle') {
        this.setMusicMode('game');
      }
    }
    // Občasné ptačí cvrlikání v oáze.
    if (this.ctx && this.biome === 'oasis' && (this.musicMode === 'game' || this.musicMode === 'menu')) {
      this.birdTimer = (this.birdTimer || 0) - dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 6 + Math.random() * 10;
        if (!this.musicMuted) this.chirp();
      }
    }
  }

  chirp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 1800 + Math.random() * 900;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.ambientBus);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /* ---------------------------------------------------------------- */
  /*  Zvukové efekty                                                   */
  /* ---------------------------------------------------------------- */

  throttle(name, ms) {
    const now = performance.now();
    const last = this.lastSfx.get(name) || 0;
    if (now - last < ms) return true;
    this.lastSfx.set(name, now);
    return false;
  }

  play(name, opts = {}) {
    if (!this.ctx || this.sfxMuted || this.sfxVolume <= 0) return;
    if (this.ctx.state === 'suspended') return;
    const vol = opts.volume === undefined ? 1 : opts.volume;
    if (this.throttle(name, opts.throttle || 60)) return;
    switch (name) {
      case 'click':
        this.tone(620, 0.05, 'triangle', 0.05 * vol, 760);
        break;
      case 'select':
        this.voice(420 + Math.random() * 90, 0.11, 0.05 * vol);
        this.tone(780, 0.06, 'sine', 0.03 * vol);
        break;
      case 'ack':
        this.voice(520 + Math.random() * 80, 0.13, 0.045 * vol);
        this.tone(660, 0.09, 'triangle', 0.03 * vol, 820);
        break;
      case 'build':
        this.noise(0.09, 700, 0.1 * vol);
        this.tone(160, 0.12, 'square', 0.045 * vol, 110);
        break;
      case 'hammer':
        this.noise(0.06, 1300, 0.075 * vol);
        this.tone(190, 0.08, 'triangle', 0.04 * vol, 120);
        break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.055 * vol, f, i * 0.09));
        break;
      case 'success':
        [660, 880].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.05 * vol, f, i * 0.1));
        break;
      case 'error':
        this.tone(180, 0.18, 'square', 0.05 * vol, 130);
        this.tone(140, 0.2, 'sawtooth', 0.03 * vol, 100, 0.06);
        break;
      case 'scribe':
        this.tone(420, 0.07, 'triangle', 0.025 * vol, 500);
        break;
      case 'gather':
        this.tone(880 + Math.random() * 180, 0.14, 'sine', 0.035 * vol);
        break;
      case 'destroy':
        this.noise(0.7, 260, 0.22 * vol);
        this.tone(70, 0.8, 'sine', 0.09 * vol, 40);
        break;
      case 'demolish':
        this.noise(1.1, 320, 0.2 * vol);
        this.tone(90, 1.0, 'sine', 0.07 * vol, 45);
        break;
      case 'repair':
        this.noise(0.07, 1500, 0.07 * vol);
        this.tone(210, 0.1, 'triangle', 0.035 * vol, 160);
        break;
      case 'deposit':
        this.tone(880, 0.5, 'sine', 0.05 * vol, 880);
        this.tone(1320, 0.6, 'sine', 0.03 * vol, 1320, 0.08);
        break;
      case 'tick':
        this.tone(900, 0.07, 'square', 0.04 * vol, 700);
        break;
      case 'water':
        this.noise(0.5, 900, 0.03 * vol);
        break;
      case 'axe':
        this.noise(0.09, 1100, 0.09 * vol);
        this.tone(160, 0.1, 'triangle', 0.04 * vol, 100);
        break;
      case 'quarry':
        this.noise(0.16, 500, 0.07 * vol);
        this.tone(120, 0.2, 'triangle', 0.035 * vol, 70);
        break;
      case 'mine':
        this.noise(0.2, 400, 0.05 * vol);
        this.tone(90, 0.3, 'sine', 0.045 * vol, 60);
        break;
      case 'fire':
        this.noise(0.35, 1600, 0.025 * vol);
        break;
      case 'arrow':
        this.noise(0.12, 2400, 0.04 * vol);
        break;
      case 'hit':
        this.tone(120, 0.12, 'square', 0.035 * vol, 80);
        break;
      case 'victory':
        this.playVictory();
        break;
      case 'defeat':
        this.playDefeat();
        break;
      default:
        break;
    }
  }

  tone(freq, dur, type = 'sine', gain = 0.05, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, filterFreq, gain = 0.1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  voice(freq, dur, gain) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [mult, detune] of [[1, 0], [1.5, 7]]) {
      const osc = this.ctx.createOscillator();
      const formant = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * mult, t);
      osc.frequency.linearRampToValueAtTime(freq * mult * 0.92, t + dur);
      osc.detune.value = detune;
      formant.type = 'bandpass';
      formant.frequency.value = 720;
      formant.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain / (mult * 1.2), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(formant).connect(g).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Zvuky budov v okolí kamery                                       */
  /* ---------------------------------------------------------------- */

  updateAmbient(dt, session, camera) {
    if (!this.ctx || this.sfxMuted || !this.started) return;
    if (this.musicMode !== 'game' && this.musicMode !== 'battle') return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 1.1;

    const buildings = session.state.buildings.filter(b =>
      b.ownerId === session.selfId && (b.width === undefined || b.centerX !== undefined)
    );
    const seen = new Set();
    for (const b of buildings) {
      if (b.type === 'castle' || b.type === 'lumberjack' || b.type === 'quarry' ||
          b.type === 'ironmine' || b.type === 'orchard') {
        if (seen.has(b.type)) continue;
        // Vzdálenost od středu kamery ve světových pixelech.
        const wx = (b.centerX - b.centerY) * 32;
        const wy = (b.centerX + b.centerY) * 16;
        const d = Math.hypot(wx - camera.x, wy - camera.y);
        const factor = 1 - Math.min(1, d / 1500);
        if (factor < 0.2) continue;
        seen.add(b.type);
        if (b.type === 'castle' && !b.complete) continue;
        if (!b.complete) {
          if (session.getBuilderInfo(b).active > 0 && Math.random() < 0.5) {
            this.play('hammer', { volume: factor * 0.7, throttle: 700 });
          }
          continue;
        }
        if (Math.random() > 0.45) continue;
        const base = b.type === 'castle' ? 'fire'
          : b.type === 'lumberjack' ? 'axe'
            : b.type === 'quarry' ? 'quarry'
              : b.type === 'ironmine' ? 'mine' : 'water';
        this.play(base, { volume: factor * 0.8, throttle: 900 });
      }
    }
  }
}

export const audio = new AudioEngine();
