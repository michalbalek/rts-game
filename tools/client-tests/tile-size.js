import { TILE_WIDTH, TILE_HEIGHT, HALF_TILE_WIDTH, tileToScreen, worldToTile } from '../../client/js/engine/isometric.js';
import { Camera } from '../../client/js/engine/camera.js';
import { AudioAmbient } from '../../client/js/engine/audio-ambient.js';
import { RendererFortifications } from '../../client/js/engine/renderer-fortifications.js';
import { BUILDING_TOP } from '../../client/js/engine/renderer-building-status.js';
import { buildingHitBox, pickEntityAtWorld } from '../../client/js/game/picking.js';

export function testTileSize(assert) {
  console.log('\n--- Velikost dlaždic a výška hradeb ---');
  assert(TILE_WIDTH === 56 && TILE_HEIGHT === 28, 'dlaždice jsou menší a zachovávají poměr 2:1');
  for (const [x, y] of [[0, 0], [10.5, 37.25], [199, 199]]) {
    const screen = tileToScreen(x, y);
    const tile = worldToTile(screen.x, screen.y);
    assert(Math.abs(tile.x - x) < 1e-9 && Math.abs(tile.y - y) < 1e-9,
      `projekce a výběr se shodují na souřadnicích ${x}, ${y}`);
  }
  const camera = new Camera({ clientWidth: 1400, clientHeight: 700 });
  camera.zoom = 1;
  assert(camera.visibleTileSpan().x === 25 && camera.visibleTileSpan().y === 25,
    'kamera používá novou velikost dlaždic pro viditelný rozsah');
  camera.x = 99999;
  camera.y = 99999;
  camera.clampToMap(200);
  assert(camera.x === 199 * HALF_TILE_WIDTH + 240 && camera.y === 199 * TILE_HEIGHT + 240,
    'hranice kamery odpovídají nové velikosti mapy');

  const calls = [];
  RendererFortifications.prototype.drawWall.call({
    isoMasonry(...args) { calls.push(args.slice(1)); },
    isoBox() {},
    isoGround() {}
  }, {});
  const body = calls[0];
  const top = Math.max(...calls.map(args => args[5]));
  assert(body[0] === 0 && body[1] === 0 && body[2] === 1 && body[3] === 1 &&
    body[5] === 31 && top === 43, 'hradba je vyšší a její půdorys zůstává 1×1');
  const wall = { id: 1, type: 'wall', tileX: 10, tileY: 10, width: 1, height: 1 };
  const wallBase = tileToScreen(wall.tileX, wall.tileY);
  const hit = buildingHitBox(wall);
  const session = { state: { buildings: [wall], units: [] } };
  assert(hit.minY === wallBase.y - 43 && BUILDING_TOP.wall >= top &&
    pickEntityAtWorld(session, wallBase.x, wallBase.y - 42)?.entity === wall,
  'výběr i ukazatele pokrývají zvýšené cimbuří');

  const originalRandom = Math.random;
  const sounds = [];
  const ambient = {
    ctx: {}, sfxMuted: false, started: true, musicMode: 'game', ambientTimer: 0,
    play(name, opts) { sounds.push({ name, ...opts }); }
  };
  const building = { type: 'castle', ownerId: 1, centerX: 100, centerY: 100, complete: true };
  try {
    Math.random = () => 0;
    camera.centerOnTile(building.centerX, building.centerY);
    AudioAmbient.prototype.updateAmbient.call(ambient, 1, {
      selfId: 1, state: { buildings: [building] }
    }, camera);
    assert(sounds.length === 1 && sounds[0].name === 'fire' && Math.abs(sounds[0].volume - 0.8) < 1e-9,
      'prostorový zvuk zůstává soustředěný na skutečnou polohu budovy');
  } finally {
    Math.random = originalRandom;
  }
}
