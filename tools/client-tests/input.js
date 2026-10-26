import { onRightClick } from '../../client/js/game/input-selection.js';
import { audio } from '../../client/js/engine/audio.js';
import { Input } from '../../client/js/game/input.js';
import { LocalSession } from '../../client/js/game/session.js';
import { Camera } from '../../client/js/engine/camera.js';
import { tileToScreen } from '../../client/js/engine/isometric.js';

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
  } finally {
    audio.play = originalPlay;
  }
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
