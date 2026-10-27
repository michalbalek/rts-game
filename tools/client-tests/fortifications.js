import { Input } from '../../client/js/game/input.js';
import { onRightClick } from '../../client/js/game/input-selection.js';
import { audio } from '../../client/js/engine/audio.js';
import { unitHitBox } from '../../client/js/game/picking.js';
import { GameUI } from '../../client/js/game/ui.js';

export function testFortificationInput(assert) {
  console.log('\n--- Ovládání opevnění ---');
  const commands = [];
  const errors = [];
  const input = {
    mouse: {}, drag: null, wallDrag: null, minimapDragging: false,
    canvas: { classList: { add() {}, remove() {} } },
    isBlocked: () => false,
    setHover(x, y) { this.ui.hoverTile = { x, y }; },
    session: {
      canPlaceWall: () => ({ valid: true }),
      command(cmd) { commands.push(cmd); return { ok: true }; }
    },
    ui: {
      buildMode: 'wall',
      setBuildMode(mode) { this.buildMode = mode; },
      toast(text) { errors.push(text); }
    }
  };
  Input.prototype.onMouseDown.call(input, { button: 0, clientX: 10, clientY: 20 });
  Input.prototype.onWindowMove.call(input, { clientX: 13, clientY: 20 });
  assert(input.ui.wallDrag.end.x === 13, 'tažení aktualizuje náhled hradeb');
  Input.prototype.onMouseUp.call(input, { button: 0, clientX: 13, clientY: 20 });
  assert(commands.length === 1 && commands[0].op === 'build-wall' &&
    commands[0].x1 === 10 && commands[0].y1 === 20 && commands[0].x2 === 13 && commands[0].y2 === 20 &&
    input.ui.buildMode === null, 'puštění tlačítka odešle jediný příkaz pro úsek');
  input.ui.buildMode = 'wall';
  input.session.canPlaceWall = () => ({ valid: false, reason: 'Chyba' });
  Input.prototype.onMouseDown.call(input, { button: 0, clientX: 10, clientY: 20 });
  Input.prototype.onMouseUp.call(input, { button: 0, clientX: 13, clientY: 20 });
  assert(commands.length === 1 && errors[0] === 'Chyba' && input.ui.buildMode === 'wall',
    'neplatné tažení zobrazí chybu a zůstane v režimu stavby');

  const oldPlay = audio.play;
  audio.play = () => {};
  try {
    const orders = [];
    const tower = { type: 'building', entity: { id: 8, type: 'tower', ownerId: 1, complete: true } };
    const rightClick = {
      session: {
        selfId: 1,
        selection: [{ id: 1, type: 'archer', isMilitary: true, ownerId: 1 },
          { id: 2, type: 'villager', isVillager: true, ownerId: 1 }],
        command(cmd) { orders.push(cmd); return { ok: true }; }
      },
      ui: {},
      setHover() { this.ui.hoverTile = { x: 10, y: 10 }; this.ui.hoverEntity = tower; }
    };
    onRightClick.call(rightClick, { clientX: 0, clientY: 0 });
    assert(orders.length === 1 && orders[0].op === 'garrison' &&
      orders[0].buildingId === 8 && orders[0].unitIds.join() === '1',
    'pravé kliknutí na věž vyšle pouze vybrané lučištníky');
  } finally {
    audio.play = oldPlay;
  }
  const ground = unitHitBox({ x: 10, y: 10 });
  const rooftop = unitHitBox({ x: 10, y: 10, garrison: { entered: true } });
  assert(rooftop.baseY === ground.baseY - 60, 'výběr lučištníka odpovídá jeho výšce na věži');
  const archer = { type: 'archer', ownerId: 1, hp: 60, maxHp: 60, garrison: { entered: true } };
  const panel = GameUI.prototype.unitsPanelHtml.call({
    session: { selfId: 1 }, constructSectionHtml: () => ''
  }, [archer]);
  assert(panel.includes('<span>Dostřel</span><b>8</b>'),
    'panel obsazeného lučištníka zobrazuje zvýšený dostřel');

  const documentBefore = globalThis.document;
  const animationBefore = globalThis.requestAnimationFrame;
  const timeoutBefore = globalThis.setTimeout;
  try {
    const node = { classList: { add() {}, remove() {} }, remove() {} };
    globalThis.document = { createElement: () => node };
    globalThis.requestAnimationFrame = callback => callback();
    globalThis.setTimeout = () => 0;
    const root = { children: [], appendChild(child) { this.children.push(child); } };
    GameUI.prototype.toast.call({ el: { toastRoot: root } }, 'Stavba zahájena', 'info');
    assert(root.children.length === 1 && node.innerHTML.includes('Stavba zahájena'),
      'hláška o zahájení stavby se vykreslí bez chyby');
  } finally {
    globalThis.document = documentBefore;
    globalThis.requestAnimationFrame = animationBefore;
    globalThis.setTimeout = timeoutBefore;
  }
}
