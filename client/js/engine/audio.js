/**
 * Zvukový systém s procedurální syntézou v orientálním/středověkém stylu
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playClick() {
    this.playTone(720, 'triangle', 0.04, 0.08);
  }

  // Pískovcové stavění (úder kladiva a tesání kamene)
  playBuild() {
    if (this.muted) return;
    this.init();
    this.playTone(190, 'square', 0.09, 0.18);
    setTimeout(() => this.playTone(420, 'triangle', 0.14, 0.22), 80);
    setTimeout(() => this.playTone(280, 'sine', 0.1, 0.15), 160);
  }

  // Orientální fanfára (Phrygian Dominant stupnice)
  playRecruit() {
    if (this.muted) return;
    this.init();
    // Fanfárové tóny (D - Eb - F# - A)
    const notes = [293.66, 311.13, 369.99, 440.00];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.22, 0.12), i * 95);
    });
  }

  // Příchod nového rekruta k ohništi
  playSpawn() {
    if (this.muted) return;
    this.init();
    this.playTone(440, 'triangle', 0.16, 0.08);
    setTimeout(() => this.playTone(554.37, 'sine', 0.22, 0.09), 90);
  }

  playGather(type) {
    if (this.muted) return;
    this.init();
    if (type === 'wood') {
      // Sekera do palmy
      this.playTone(160, 'triangle', 0.1, 0.16);
    } else if (type === 'stone') {
      // Úder krumpáče o pískovec
      this.playTone(850, 'square', 0.04, 0.09);
      setTimeout(() => this.playTone(320, 'sawtooth', 0.08, 0.12), 25);
    } else {
      // Sběr čerstvých jablek do sýpky
      this.playTone(520, 'sine', 0.14, 0.08);
    }
  }

  playError() {
    this.playTone(140, 'sawtooth', 0.22, 0.16);
  }
}

export const sound = new SoundSystem();
