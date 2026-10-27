import { Input } from '../../client/js/game/input.js';
import { onKeyDown } from '../../client/js/game/input-navigation.js';
import { tryPlaceBuilding } from '../../client/js/game/input-selection.js';
import { Renderer } from '../../client/js/engine/renderer.js';
import { tileToScreen } from '../../client/js/engine/isometric.js';
import { BUILDING_DEFS } from '../../client/js/sim/constants.js';
import { audio } from '../../client/js/engine/audio.js';

export function testBuildingRotationInput(assert) {
  console.log('\n--- Ovládání a náhled otáčení ---');
  const point = tileToScreen(50.5, 50.5);
  const commands = [];
  const checks = [];
  const input = {
    session: {
      canPlace(...args) { checks.push(args); return { valid: true }; },
      command(cmd) { commands.push(cmd); return { ok: true }; }
    },
    ui: { buildMode: 'gate_large', buildRotation: 0, setBuildMode(mode) { this.buildMode = mode; } },
    camera: { screenToWorld: () => point },
    mouse: { x: 100, y: 120, inside: true, valid: true },
    keys: new Set(),
    isBlocked: () => false,
    setHover: Input.prototype.setHover
  };
  const key = { code: 'KeyR', key: 'r', target: { tagName: 'BODY' }, preventDefault() {} };
  const oldPlay = audio.play;
  audio.play = () => {};
  try {
    input.setHover(100, 120);
    assert(input.ui.hoverTile.x === 49 && input.ui.hoverTile.y === 50, 'náhled vycentruje široký půdorys');
    onKeyDown.call(input, key);
    assert(input.ui.buildRotation === 1 && input.ui.hoverTile.x === 50 && input.ui.hoverTile.y === 49,
      'R otočí bránu a okamžitě přepočítá půdorys pod kurzorem');
    onKeyDown.call(input, { ...key, repeat: true });
    onKeyDown.call(input, { ...key, target: { tagName: 'INPUT' } });
    assert(input.ui.buildRotation === 1, 'opakovaná klávesa a psaní do pole nemění otočení');
    tryPlaceBuilding.call(input);
    assert(checks[0][3] === 1 && commands[0].rotation === 1 && commands[0].x === 50 && commands[0].y === 49,
      'kontrola i stavební příkaz obsahují stejné otočení a souřadnice');
  } finally {
    audio.play = oldPlay;
  }

  const renderer = Object.create(Renderer.prototype);
  renderer.quality = 'high';
  renderer.time = 0;
  renderer.map = { size: 200 };
  let previewCheck;
  renderer.session = { canPlace(...args) { previewCheck = args; return { valid: true }; } };
  let invalidCoordinate = false;
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        if (args.some(value => typeof value === 'number' && !Number.isFinite(value))) invalidCoordinate = true;
      };
    }
  });
  for (const [type, def] of Object.entries(BUILDING_DEFS)) {
    if (type === 'castle') continue;
    for (let rotation = 0; rotation < 4; rotation++) {
      const b = { id: 1, type, rotation, width: rotation % 2 ? def.h : def.w,
        height: rotation % 2 ? def.w : def.h, complete: true, gateOpen: false, workers: 0 };
      renderer.drawBuildingStructure(ctx, b, def);
    }
  }
  assert(!invalidCoordinate && !renderer.structureRotation,
    'všechny budovy se vykreslí ve čtyřech směrech a kontext otočení nezůstane aktivní');
  renderer.drawBuildGhost(ctx, { buildMode: 'gate_large', buildRotation: 3, hoverTile: { x: 20, y: 20 } });
  assert(previewCheck[0] === 'gate_large' && previewCheck[3] === 3 && !invalidCoordinate,
    'náhled ověřuje a vykresluje skutečnou otočenou bránu');
  renderer.structureRotation = { width: 4, height: 1, rotation: 1 };
  const bottom = renderer.isoPoint(2, 0.5, 0);
  const top = renderer.isoPoint(2, 0.5, 20);
  const box = renderer.rotatedBox(0, 0, 4, 1);
  assert(top.x === bottom.x && top.y === bottom.y - 20 &&
    box.u2 - box.u1 === 1 && box.v2 - box.v1 === 4,
  'izometrické otočení ponechává výšku svislou a správně otočí viditelné stěny');
}
