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

  setBiome(biome) {
    this.biome = biome || 'desert';
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
