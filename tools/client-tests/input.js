import { onRightClick } from '../../client/js/game/input-selection.js';
import { audio } from '../../client/js/engine/audio.js';
import { Input } from '../../client/js/game/input.js';
import { LocalSession, RemoteSession } from '../../client/js/game/session.js';
import { Camera } from '../../client/js/engine/camera.js';
import { tileToScreen } from '../../client/js/engine/isometric.js';
import { pickResourceAtWorld } from '../../client/js/game/picking.js';
import { RESOURCE_TYPES } from '../../client/js/sim/constants.js';
import { setLanguage, getLanguage, t } from '../../client/js/i18n/index.js';

export function testLumberPlacementPreview(assert) {
  console.log('\n--- Náhled umístění dřevorubce ---');
  const local = new LocalSession({
    seed: 1234, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Test', isBot: false }]
  });
  const remote = new RemoteSession({
    seed: 1234, mapType: 'desert', selfId: local.selfId, players: local.state.players
  }, null);
  local.sim.getPlayer(local.selfId).marketRules.stone = { buyTo: 50, sellTo: 100 };
  remote.applySnapshot(local.sim.serialize(local.selfId));
  assert(remote.player.marketRules.stone.buyTo === 50 && remote.player.marketRules.stone.sellTo === 100,
    'multiplayerový klient přijme vlastní pravidla obchodu ze snímku');
  remote.map = local.sim.map;
  remote.state.buildings = local.state.buildings;
  remote.state.units = local.state.units;
  let spot = null;
  for (let y = 1; y < local.state.map.size - 1 && !spot; y++) {
    for (let x = 1; x < local.state.map.size - 1; x++) {
      if (local.canPlace('lumberjack', x, y).valid) {
        spot = { x, y };
        break;
      }
    }
  }
  assert(!!spot, 'existuje volné místo pro náhled stavby');
  if (!spot) return;
  const { x, y } = spot;
  assert(local.canPlace('lumberjack', x, y).valid && remote.canPlace('lumberjack', x, y).valid,
    'lokální i síťový náhled povolí místo bez stromu');
  local.sim.map.setResource(x, y, RESOURCE_TYPES.TREE);
  const localCheck = local.canPlace('lumberjack', x, y);
  const remoteCheck = remote.canPlace('lumberjack', x, y);
  assert(!localCheck.valid && !remoteCheck.valid && localCheck.reason === remoteCheck.reason,
    'lokální i síťový náhled shodně zakáží stavbu na stromě');
  const previousLanguage = getLanguage();
  try {
    setLanguage('en');
    assert(t(remoteCheck.reason) === 'A Lumber Camp must stand on a site without trees, my lord!',
      'důvod odmítnutí se překládá do angličtiny');
  } finally {
    setLanguage(previousLanguage);
  }
}

export function testCameraNavigation(assert) {
  console.log('\n--- Posun kamery myší ---');
  function eventTarget() {
    const listeners = new Map();
    return {
      addEventListener(type, handler) { listeners.set(type, handler); },
      removeEventListener(type, handler) {
        if (listeners.get(type) === handler) listeners.delete(type);
      },
      emit(type, event = {}) {
        const handler = listeners.get(type);
        if (handler) handler(event);
      },
      hasListener(type) { return listeners.has(type); }
    };
  }

  const originalWindow = globalThis.window;
  const win = Object.assign(eventTarget(), { innerWidth: 1600, innerHeight: 900 });
  globalThis.window = win;
  try {
    const canvas = Object.assign(eventTarget(), {
      classList: { add() {}, remove() {} }
    });
    const minimap = Object.assign(eventTarget(), {
      getBoundingClientRect: () => ({ left: 1400, top: 700, width: 200, height: 200 })
    });
    const moves = [];
    const centers = [];
    const camera = {
      pan(x, y) { moves.push({ x, y }); },
      clampToMap() {},
      centerOnTile(x, y) { centers.push({ x, y }); }
    };
    let blocked = false;
    const input = new Input({
      canvas, minimapCanvas: minimap, camera,
      session: { state: { map: { size: 100 } } },
      ui: {}, settings: { cameraSpeed: 'medium' },
      isBlocked: () => blocked
    });
    let hovers = 0;
    input.setHover = () => { hovers++; };

    input.update(0.1);
    assert(moves.length === 0, 'kamera se nepohybuje před prvním pohybem myši');
    canvas.emit('mousemove', { clientX: 800, clientY: 300 });
    win.emit('mousemove', { clientX: 800, clientY: 300 });
    input.update(0.1);
    canvas.emit('mouseleave');
    assert(hovers === 2 && input.ui.hoverTile === null && input.ui.hoverEntity === null,
      'přejetí z mapy na panel zruší zvýraznění na mapě');
    const cases = [
      ['nahoru přes horní lištu', 800, 1, 0, 56],
      ['dolů přes spodní panel', 800, 899, 0, -56],
      ['doleva', 1, 450, 56, 0],
      ['doprava', 1599, 450, -56, 0]
    ];
    for (const [label, x, y, dx, dy] of cases) {
      win.emit('mousemove', { clientX: x, clientY: y });
      input.update(0.1);
      const move = moves.pop();
      assert(move && move.x === dx && move.y === dy, `kamera se posune ${label}`);
    }
    assert(hovers === 2, 'kurzor nad panelem nevybírá objekty na mapě');

    win.emit('mousemove', { clientX: 1, clientY: 1 });
    input.update(0.1);
    const diagonal = moves.pop();
    assert(diagonal && Math.abs(Math.hypot(diagonal.x, diagonal.y) - 56) < 1e-9 &&
      diagonal.x > 0 && diagonal.y > 0, 'diagonální posun má stejnou rychlost');
    win.emit('mouseout', { relatedTarget: {} });
    input.update(0.1);
    assert(moves.length === 1, 'přechod mezi prvky stránky nezastaví posun');
    moves.length = 0;
    const exits = [
      ['nahoru', 800, -1, 0, 56],
      ['dolů', 800, 900, 0, -56],
      ['doleva', -1, 450, 56, 0],
      ['doprava', 1600, 450, -56, 0]
    ];
    for (const [label, x, y, dx, dy] of exits) {
      win.emit('mousemove', { clientX: 800, clientY: 450 });
      win.emit('mouseout', { relatedTarget: null, clientX: x, clientY: y });
      input.update(0.1);
      input.update(0.1);
      assert(moves.length === 2 && moves.every(move => move.x === dx && move.y === dy),
        `po vyjetí z okna pokračuje posun ${label}`);
      moves.length = 0;
    }

    win.emit('mousemove', { clientX: -1, clientY: 1 });
    input.update(0.1);
    const outsideDiagonal = moves.pop();
    assert(outsideDiagonal && outsideDiagonal.x > 0 && outsideDiagonal.y > 0 &&
      Math.abs(Math.hypot(outsideDiagonal.x, outsideDiagonal.y) - 56) < 1e-9,
    'pohyb mimo okno zachovává normalizovaný diagonální posun');
    win.emit('mousemove', { clientX: 800, clientY: 450 });
    input.update(0.1);
    assert(moves.length === 0, 'návrat kurzoru mimo okraj posun zastaví');
    win.emit('mousemove', { clientX: 800, clientY: 1 });
    blocked = true;
    input.update(0.1);
    assert(moves.length === 0, 'otevřený dialog brání posunu');
    blocked = false;

    minimap.emit('mousedown', { clientX: 1590, clientY: 890, preventDefault() {} });
    win.emit('mousemove', { clientX: 1599, clientY: 899 });
    input.update(0.1);
    assert(centers.length === 2 && moves.length === 0,
      'při tažení minimapy se kamera nepohybuje současně i od okraje');
    win.emit('mouseup', { button: 0 });
    input.update(0.1);
    assert(moves.length === 1, 'po ukončení tažení minimapy se posun obnoví');
    moves.length = 0;

    win.emit('blur');
    input.update(0.1);
    assert(moves.length === 0, 'ztráta zaměření okna zastaví posun');
    input.keys.add('w');
    input.update(0.1);
    assert(moves.length === 1 && moves[0].y === 56, 'pohyb klávesnicí zůstává funkční');
    input.detach();
    assert(!win.hasListener('mouseout'), 'odpojení odstraní posluchač opuštění okna');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}

export function testRightClick(assert) {
  console.log('\n--- Pravé kliknutí na staveniště ---');
  const villager = { id: 1, ownerId: 1, isVillager: true };
  const helper = { id: 2, ownerId: 1, isVillager: true };
  const soldier = { id: 3, ownerId: 1, isMilitary: true };
  const foreignVillager = { id: 4, ownerId: 2, isVillager: true };
  const site = { type: 'building', entity: { id: 10, ownerId: 1, complete: false } };
  const enemySite = { type: 'building', entity: { ...site.entity, ownerId: 2 } };
  const complete = { type: 'building', entity: { ...site.entity, complete: true } };
  const cases = [
    ['jeden poddaný začne stavět', [villager], site, 'construct', [1]],
    ['více poddaných začne stavět', [villager, helper], site, 'construct', [1, 2]],
    ['smíšený výběr přiřadí pouze poddané', [villager, soldier], site, 'construct', [1]],
    ['cizí poddaný nedostane příkaz', [villager, foreignVillager], site, 'construct', [1]],
    ['samotní vojáci dostanou přesun', [soldier], site, 'move', [3]],
    ['hotová budova zůstává cílem přesunu', [villager], complete, 'move', [1]],
    ['volný terén zůstává cílem přesunu', [villager, soldier], null, 'move', [1, 3]],
    ['cizí staveniště poddaným stavbu nezadá', [villager], enemySite, 'move', [1]],
    ['vojáci nadále útočí na nepřátelské staveniště', [villager, soldier], enemySite, 'attack', [3]],
    ['vlastní jednotka není staveniště', [villager], { type: 'unit', entity: helper }, 'move', [1]],
    ['bez výběru se příkaz neodešle', [], site, null, []],
    ['samotná cizí jednotka příkaz nedostane', [foreignVillager], site, null, []]
  ];
  const originalPlay = audio.play;
  const sounds = [];
  audio.play = name => sounds.push(name);
  try {
    for (const [label, selection, target, op, ids] of cases) {
      const commands = [];
      const input = {
        session: {
          selfId: 1, selection,
          command(cmd) { commands.push(cmd); return { ok: true }; }
        },
        ui: { hoverTile: null, hoverEntity: null },
        setHover() { this.ui.hoverTile = { x: 20, y: 22 }; this.ui.hoverEntity = target; }
      };
      const event = { clientX: 100, clientY: 200 };
      onRightClick.call(input, event);
      const command = commands[0];
      assert(op === null ? !commands.length
        : commands.length === 1 && command.op === op && command.unitIds.join() === ids.join(),
      label);
      if (op === 'construct') {
        assert(command.buildingId === site.entity.id, 'příkaz míří na vybrané staveniště');
        input.session.command = cmd => {
          commands.push(cmd);
          return { ok: false, reason: 'Ke stavbě nelze dojít.' };
        };
        const errors = [];
        input.ui.toast = (text, kind) => errors.push({ text, kind });
        onRightClick.call(input, event);
        assert(errors.length === 1 && errors[0].text === 'Ke stavbě nelze dojít.' &&
          errors[0].kind === 'error' && sounds.at(-1) === 'error' &&
          commands.length === 2 && commands[1].op === 'construct',
        'odmítnutí stavby zobrazí chybu a nezadá náhradní přesun');
      }
      if (op === 'move') {
        assert(command.x === 20.5 && command.y === 22.5, 'přesun zachová souřadnice cíle');
      }
      if (op === 'attack') {
        assert(command.targetId === enemySite.entity.id, 'útok zachová nepřátelský cíl');
      }
      const before = commands.length;
      input.ui.buildMode = 'dwelling';
      input.ui.setBuildMode = mode => { input.ui.buildMode = mode; };
      onRightClick.call(input, event);
      assert(input.ui.buildMode === null && commands.length === before,
        'pravé kliknutí v režimu umístění pouze zruší stavbu');
    }
    testConstructionClick(assert);
    testGatheringClick(assert);
  } finally {
    audio.play = originalPlay;
  }
}

function testGatheringClick(assert) {
  const session = new LocalSession({
    seed: 1234, mapType: 'desert', mode: 'sandbox', capital: 'rich', fog: false,
    players: [{ name: 'Test', isBot: false }]
  });
  const villager = session.state.units.find(u => u.isVillager);
  const tree = session.sim.findTreeSource(villager, session.castle);
  assert(!!tree, 'pro kliknutí existuje dostupný strom');
  if (!tree) return;
  const point = tileToScreen(tree.sx, tree.sy);
  const hit = pickResourceAtWorld(session, point.x, point.y - 16);
  assert(hit && hit.x === tree.sx && hit.y === tree.sy, 'koruna stromu patří ke správné dlaždici');
  const soldier = session.sim.addUnit('swordsman', session.selfId, villager.x, villager.y);
  soldier.moveTarget = { x: 10, y: 10 };
  session.selectUnits([villager, soldier]);
  const camera = new Camera({ clientWidth: 1600, clientHeight: 900 });
  camera.centerOnTile(tree.sx, tree.sy);
  const click = camera.worldToScreen(point.x, point.y - 16);
  const input = {
    session, camera,
    ui: { hoverTile: null, hoverEntity: null, toast() {} },
    setHover: Input.prototype.setHover
  };
  onRightClick.call(input, { clientX: click.x, clientY: click.y });
  assert(villager.work && villager.work.direct && villager.work.targetX === tree.sx &&
    villager.work.targetY === tree.sy, 'pravé kliknutí na korunu zadá přímou těžbu stromu');
  assert(soldier.moveTarget && soldier.moveTarget.x === 10 && soldier.moveTarget.y === 10,
    'příkaz ke sběru ve smíšeném výběru nemění rozkaz vojáka');
}

function testConstructionClick(assert) {
  const session = new LocalSession({
    seed: 4242, mapType: 'desert', mode: 'sandbox', capital: 'rich',
    players: [{ name: 'Test', isBot: false }]
  });
  let spot;
  for (let y = 4; y < session.state.map.size - 4 && !spot; y++) {
    for (let x = 4; x < session.state.map.size - 4; x++) {
      if (session.canPlace('dwelling', x, y).valid) {
        spot = { x, y };
        break;
      }
    }
  }
  assert(!!spot, 'pro test kliknutí existuje platné místo stavby');
  if (!spot) return;
  const result = session.command({ op: 'build', buildingType: 'dwelling', ...spot });
  assert(result.ok, 'pro test kliknutí vznikne skutečné staveniště');
  if (!result.ok) return;
  const site = session.state.buildings.find(b => b.id === result.buildingId);
  const crew = session.state.units.filter(u => u.ownerId === session.selfId && u.isVillager).slice(0, 2);
  session.selectUnits(crew);
  const camera = new Camera({ clientWidth: 1600, clientHeight: 900 });
  camera.centerOnTile(site.centerX, site.centerY);
  const world = tileToScreen(site.tileX, site.tileY);
  const click = camera.worldToScreen(world.x, world.y - 15);
  const errors = [];
  const input = {
    session, camera,
    ui: { buildMode: null, toast: text => errors.push(text) },
    setHover: Input.prototype.setHover
  };
  onRightClick.call(input, { clientX: click.x, clientY: click.y });
  assert(crew.length === 2 && crew.every(u => u.build && u.build.buildingId === site.id),
    'pravé kliknutí přes skutečný hitbox přiřadí oba poddané ke stavbě');
  for (let i = 0; i < 20 * 180 && !site.complete; i++) session.tick(1 / 20);
  assert(site.complete && site.progress === 1,
    'poddaní po pravém kliknutí dojdou na místo a stavbu dokončí');
  assert(crew.every(u => !u.build) && errors.length === 0,
    'po dokončení jsou stavitelé uvolněni a nevznikla chyba');
}
