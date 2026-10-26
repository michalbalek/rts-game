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

export class AudioMusic {
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
}
