export class AudioEffects {
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
      case 'alarm':
        // Dva tóny válečného rohu.
        this.tone(294, 0.34, 'sawtooth', 0.045 * vol, 288);
        this.tone(220, 0.5, 'sawtooth', 0.045 * vol, 214, 0.32);
        this.tone(147, 0.8, 'triangle', 0.04 * vol, 140, 0.32);
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
}
