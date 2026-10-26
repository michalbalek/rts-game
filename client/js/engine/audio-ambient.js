export class AudioAmbient {
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
