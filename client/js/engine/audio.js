import { installEngineMethods } from './engine-methods.js';
import { AudioMusic } from './audio-music.js';
import { AudioAmbient } from './audio-ambient.js';
import { AudioEffects } from './audio-effects.js';

/** Owns Web Audio lifecycle and shared buses used by music, ambience and effects. */
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
}

installEngineMethods(AudioEngine,
  AudioMusic,
  AudioAmbient,
  AudioEffects,
);

export const audio = new AudioEngine();
