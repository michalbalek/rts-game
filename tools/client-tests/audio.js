import { AudioEngine } from '../../client/js/engine/audio.js';

export function testAudio(assert) {
  console.log('\n--- Zvuk bez nepřetržitého šumění ---');
  const originalWindow = globalThis.window;
  const sources = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {}
  });
  const node = () => ({
    gain: param(),
    frequency: param(),
    connect(target) { return target; }
  });
  class MockAudioContext {
    constructor() {
      this.sampleRate = 100;
      this.currentTime = 1;
      this.state = 'running';
      this.destination = node();
    }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createBuffer(channels, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      const source = {
        ...node(),
        loop: false,
        start() { this.started = true; },
        stop() { this.stopped = true; }
      };
      sources.push(source);
      return source;
    }
  }

  const engine = new AudioEngine();
  globalThis.window = { AudioContext: MockAudioContext };
  try {
    engine.setBiome('oasis');
    engine.unlock();
    assert(engine.started && sources.length === 0,
      'odemčení zvuku v menu nespouští žádný nepřetržitý šum');
    for (const biome of ['desert', 'canyon', 'oasis']) {
      engine.setBiome(biome);
      assert(engine.biome === biome && sources.length === 0,
        `změna biomu ${biome} nespouští šumění`);
    }
    engine.noise(0.5, 900, 0.03);
    assert(sources.length === 1 && sources[0].buffer === engine.noiseBuffer &&
      sources[0].started && sources[0].stopped && !sources[0].loop,
    'krátké šumové efekty zůstávají dostupné');

    let chirps = 0;
    engine.chirp = () => { chirps++; };
    engine.setMusicMode('game');
    engine.update(1);
    assert(chirps === 1, 'v oáze zůstává ptačí cvrlikání');
  } finally {
    clearInterval(engine.schedulerTimer);
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}
