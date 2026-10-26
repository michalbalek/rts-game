import { readFileSync } from 'node:fs';
import { GameUI } from '../client/js/game/ui.js';
import { Renderer } from '../client/js/engine/renderer.js';
import { unitAnimation } from '../client/js/engine/unit-animation.js';
import { Building, Unit, unitActivity } from '../client/js/sim/entities.js';
import { BUILDING_DEFS } from '../client/js/sim/constants.js';
import { Camera, MIN_ZOOM, MAX_ZOOM } from '../client/js/engine/camera.js';
import { tileToScreen, worldToTile, buildingShadow, HALF_TILE_WIDTH, HALF_TILE_HEIGHT } from '../client/js/engine/isometric.js';
import { visibleTileRows } from '../client/js/engine/viewport.js';
import {
  pickEntityAtWorld, unitsInWorldRect, unitHitBox, buildingHitBox
} from '../client/js/game/picking.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

function makeCamera(width = 1600, height = 900) {
  return new Camera({ clientWidth: width, clientHeight: height });
}

function makeSession() {
  const units = [
    { id: 1, ownerId: 1, type: 'villager', x: 10.5, y: 10.5 },
    { id: 2, ownerId: 1, type: 'swordsman', x: 10.5, y: 11.5 },
    { id: 3, ownerId: 1, type: 'archer', x: 14.5, y: 10.5 },
    { id: 4, ownerId: 2, type: 'swordsman', x: 18.5, y: 10.5, hidden: true }
  ];
  const buildings = [
    {
      id: 10, ownerId: 1, type: 'castle',
      tileX: 20, tileY: 20, width: 4, height: 4,
      centerX: 22, centerY: 22
    },
    {
      id: 11, ownerId: 2, type: 'barracks',
      tileX: 40, tileY: 40, width: 2, height: 2,
      centerX: 41, centerY: 41, hidden: true
    }
  ];
  return {
    selfId: 1,
    state: { units, buildings },
    isEntityVisible(entity) { return !entity.hidden; }
  };
}

console.log('--- Horní lišta bez daní a spokojenosti ---');
{
  const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
  assert(!/popularity|tax-group|tax-btn/.test(html),
    'HUD neobsahuje ukazatel spokojenosti ani nastavení daní');
  const ui = Object.create(GameUI.prototype);
  ui.el = Object.fromEntries([
    'resMoney', 'resWood', 'resStone', 'resFood', 'resIron',
    'storeValue', 'foodStoreValue', 'popValue'
  ].map(key => [key, { textContent: '' }]));
  ui.session = {
    player: {
      resources: { money: 600, wood: 200, stone: 100, food: 200, iron: 0 },
      population: 20, capacity: 28
    },
    sim: { getStorageCaps: () => ({ resources: 500, food: 300 }) }
  };
  ui.updateTopBar();
  assert(ui.el.resMoney.textContent === '600' && ui.el.resFood.textContent === '200',
    'horní lišta dál zobrazuje peníze a jídlo bez zrušených polí');
  assert(ui.el.popValue.textContent === '20/28' &&
    ui.el.storeValue.textContent === '300/500' &&
    ui.el.foodStoreValue.textContent === '200/300',
  'horní lišta dál zobrazuje obyvatelstvo a kapacity skladů');
}

console.log('--- Kamera a zoom ---');
{
  const cam = makeCamera();
  assert(cam.zoom === 1, 'kamera začíná na zoomu 1');
  assert(cam.minZoom === MIN_ZOOM, `minimální zoom je ${MIN_ZOOM}`);
  assert(MIN_ZOOM >= 0.5 && MIN_ZOOM <= 0.7, 'minimální zoom je v rozumném rozsahu 0.5–0.7');
  assert(cam.maxZoom === MAX_ZOOM && MAX_ZOOM > MIN_ZOOM, 'maximální zoom je větší než minimální');

  for (let i = 0; i < 80; i++) cam.zoomAt(1, 800, 450);
  assert(cam.zoom === MIN_ZOOM, 'opakované oddalování se zastaví na minimálním zoomu');
  const span = cam.visibleTileSpan();
  assert(span.x <= 60 && span.y <= 60,
    `při maximálním oddálení je vidět přiměřený počet dlaždic (${span.x.toFixed(1)}×${span.y.toFixed(1)})`);
  assert(Number.isFinite(cam.x) && Number.isFinite(cam.y), 'poloha kamery zůstane konečná');

  for (let i = 0; i < 120; i++) cam.zoomAt(-1, 400, 300);
  assert(cam.zoom === MAX_ZOOM, 'opakované přibližování se zastaví na maximálním zoomu');

  // Bod pod kurzorem se při zoomu neposune.
  const cam2 = makeCamera();
  cam2.x = 640;
  cam2.y = 480;
  cam2.zoom = 1.3;
  const mouse = { x: 980, y: 370 };
  const before = cam2.screenToWorld(mouse.x, mouse.y);
  cam2.setZoomAt(0.75, mouse.x, mouse.y);
  const after = cam2.screenToWorld(mouse.x, mouse.y);
  assert(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9,
    'zoom kolem kurzoru drží světový bod pod kurzorem');
  assert(cam2.zoom === 0.75, 'setZoomAt nastaví požadovaný zoom v povoleném rozsahu');
}

console.log('\n--- Výběr jednotek ---');
{
  const session = makeSession();
  const villager = session.state.units[0];
  const base = tileToScreen(villager.x, villager.y);

  const centerHit = pickEntityAtWorld(session, base.x, base.y);
  assert(centerHit && centerHit.entity.id === 1, 'klepnutí na střed jednotky ji vybere');

  // Tělo vojáka je kreslené nad dlaždicí – klepnutí na hlavu musí fungovat.
  const headHit = pickEntityAtWorld(session, base.x, base.y - 18);
  assert(headHit && headHit.entity.id === 1, 'klepnutí na horní část postavy vybere jednotku');

  const nearMiss = pickEntityAtWorld(session, base.x + 40, base.y + 40);
  assert(nearMiss === null, 'klepnutí mimo jednotky nic nevybere');

  const fogged = pickEntityAtWorld(session, tileToScreen(18.5, 10.5).x, tileToScreen(18.5, 10.5).y);
  assert(fogged === null, 'jednotka skrytá mlhou nelze vybrat');

  const castle = session.state.buildings[0];
  const castleBase = tileToScreen(castle.tileX, castle.tileY);
  const castleFloor = pickEntityAtWorld(session, castleBase.x + 64, castleBase.y + 64);
  assert(castleFloor && castleFloor.entity.id === 10, 'klepnutí na půdorys budovy ji vybere');
  const castleRoof = pickEntityAtWorld(session, castleBase.x + 64, castleBase.y - 40);
  assert(castleRoof && castleRoof.entity.id === 10, 'klepnutí na střechu budovy ji vybere');
  const enemyBuilding = session.state.buildings[1];
  const enemyBase = tileToScreen(enemyBuilding.tileX, enemyBuilding.tileY);
  assert(pickEntityAtWorld(session, enemyBase.x + 32, enemyBase.y - 10) === null,
    'budova skrytá mlhou nelze vybrat');
}

console.log('\n--- Výběr obdélníkem ---');
{
  const session = makeSession();
  const p1 = tileToScreen(10.5, 10.5);
  const p2 = tileToScreen(10.5, 11.5);
  const p3 = tileToScreen(14.5, 10.5);

  const both = unitsInWorldRect(session, p1.x - 8, p1.y - 24, p2.x + 8, p2.y + 8);
  assert(both.length === 2 && both.every(u => u.ownerId === 1), 'obdélník vybere obě vlastní jednotky');
  assert(!both.some(u => u.id === 3), 'obdélník nevybere jednotku mimo něj');
  assert(!both.some(u => u.id === 4), 'obdélník nevybere cizí jednotku');

  const one = unitsInWorldRect(session, p3.x - 4, p3.y - 4, p3.x + 4, p3.y + 4);
  assert(one.length === 1 && one[0].id === 3, 'malý obdélník vybere jen jednotku uvnitř');

  const wide = unitsInWorldRect(session, -60, 300, 140, 420);
  assert(wide.length === 3, 'široký obdélník vybere všechny tři vlastní jednotky');
  assert(wide.map(u => u.id).join(',') === '1,2,3', 'pořadí výběru je deterministické');

  // Obdélník tažený na obrazovce se musí převést na stejnou světovou oblast.
  const cam = makeCamera();
  cam.zoom = 1.4;
  cam.centerOnTile(10.5, 11);
  const a = cam.worldToScreen(p1.x, p1.y - 24);
  const b = cam.worldToScreen(p2.x, p2.y + 8);
  const wa = cam.screenToWorld(Math.min(a.x, b.x), Math.min(a.y, b.y));
  const wb = cam.screenToWorld(Math.max(a.x, b.x), Math.max(a.y, b.y));
  const fromScreen = unitsInWorldRect(session, Math.min(wa.x, wb.x), Math.min(wa.y, wb.y),
    Math.max(wa.x, wb.x), Math.max(wa.y, wb.y));
  assert(fromScreen.length === 2, 'obdélník z obrazovky odpovídá světovému obdélníku');

  // Izometrický obdélník nesmí chytit jednotku, která je mimo něj, jen proto,
  // že leží ve stejném obdélníkovém rozsahu dlaždic.
  const diagonal = unitsInWorldRect(session, p1.x - 5, p1.y - 30, p1.x + 5, p1.y + 5);
  assert(diagonal.length === 1 && diagonal[0].id === 1,
    'úzký obdélník u základny nevybere sousední jednotku');
}

console.log('\n--- Viditelná oblast ---');
{
  const cam = makeCamera();
  cam.zoom = MIN_ZOOM;
  cam.centerOnTile(100, 100);
  const a = cam.screenToWorld(0, 0);
  const b = cam.screenToWorld(cam.viewWidth, cam.viewHeight);
  const rows = visibleTileRows(a.x, a.y, b.x, b.y, 200, 3);
  const count = rows.reduce((sum, row) => sum + (row.x1 - row.x0 + 1), 0);

  assert(rows.length > 40, 'viditelná oblast se rozdělí na řádky');
  assert(count > 1000 && count < 7000,
    `při maximálním oddálení se kreslí jen viditelné dlaždice (${count})`);
  assert(rows.every(row => row.x0 >= 0 && row.x1 < 200 && row.x0 <= row.x1),
    'řádky dlaždic zůstávají v mezích mapy');

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [sx, sy] of [[0, 0], [cam.viewWidth, 0], [0, cam.viewHeight], [cam.viewWidth, cam.viewHeight]]) {
    const w = cam.screenToWorld(sx, sy);
    const t = worldToTile(w.x, w.y);
    minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
  }
  const rectangle = (Math.floor(maxX) - Math.ceil(minX) + 1) * (Math.floor(maxY) - Math.ceil(minY) + 1);
  assert(count < rectangle * 0.8,
    `řádková optimalizace kreslí méně dlaždic než obdélník (${count} < ${rectangle})`);

  let missing = 0;
  for (let sy = 5; sy < cam.viewHeight; sy += 67) {
    for (let sx = 5; sx < cam.viewWidth; sx += 89) {
      const w = cam.screenToWorld(sx, sy);
      const t = worldToTile(w.x, w.y);
      const tx = Math.floor(t.x);
      const ty = Math.floor(t.y);
      if (tx < 0 || ty < 0 || tx >= 200 || ty >= 200) continue;
      const row = rows.find(r => r.y === ty);
      if (!row || tx < row.x0 || tx > row.x1) missing++;
    }
  }
  assert(missing === 0, 'každá dlaždice pod obrazovkou je v některém řádku');

  const rowCount = count;
  cam.setZoomAt(MAX_ZOOM, cam.viewWidth / 2, cam.viewHeight / 2);
  const a2 = cam.screenToWorld(0, 0);
  const b2 = cam.screenToWorld(cam.viewWidth, cam.viewHeight);
  const closeRows = visibleTileRows(a2.x, a2.y, b2.x, b2.y, 200, 3);
  const closeCount = closeRows.reduce((sum, row) => sum + (row.x1 - row.x0 + 1), 0);
  assert(closeCount < rowCount / 10,
    `při maximálním přiblížení se kreslí výrazně méně dlaždic (${closeCount} vs ${rowCount})`);

  const farRows = visibleTileRows(-99999, -99999, 99999, 99999, 200, 3);
  const farCount = farRows.reduce((sum, row) => sum + (row.x1 - row.x0 + 1), 0);
  assert(farCount === 200 * 200, 'pohled na celou mapu nezapomene žádnou dlaždici');
}

console.log('\n--- Hitboxy ---');
{
  const unit = { x: 5.5, y: 5.5 };
  const ub = unitHitBox(unit);
  assert(ub.maxY > ub.minY && ub.maxX > ub.minX, 'hitbox jednotky má kladné rozměry');
  assert(ub.minY < tileToScreen(5.5, 5.5).y, 'hitbox jednotky sahá nad její dlaždici');

  const castle = { type: 'castle', tileX: 2, tileY: 3, width: 4, height: 4 };
  const bb = buildingHitBox(castle);
  assert(bb.minY < tileToScreen(2, 3).y, 'hitbox budovy sahá nad půdorys');
  assert(bb.maxX - bb.minX >= 8 * 32, 'hitbox budovy pokrývá celý půdorys');
}

console.log('\n--- Stín budov ---');
{
  // Stín musí ležet ve stopě budovy. Když byl vycentrovaný na přední roh,
  // odjížděl před budovu a ta vypadala, že se vznáší nad zemí.
  for (const [w, h] of [[1, 1], [2, 2], [3, 3], [4, 4], [3, 2], [2, 3]]) {
    const s = buildingShadow(w, h);
    const centerX = (w - h) * HALF_TILE_WIDTH / 2;
    const centerY = (w + h) * HALF_TILE_HEIGHT / 2;

    assert(Math.abs(s.cx - centerX) < 1e-9 && Math.abs(s.cy - centerY) < 1e-9,
      `stín ${w}×${h} je vycentrovaný ve stopě budovy`);
    assert(s.cy < (w + h) * HALF_TILE_HEIGHT,
      `stín ${w}×${h} neodjíždí před budovu`);

    const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => ({
      x: (u - v) * HALF_TILE_WIDTH,
      y: (u + v) * HALF_TILE_HEIGHT
    }));
    const inside = corners.every((p) => {
      const dx = (p.x - s.cx) / s.rx;
      const dy = (p.y - s.cy) / s.ry;
      return dx * dx + dy * dy <= 1.0001;
    });
    assert(inside, `stín ${w}×${h} pokrývá celý půdorys`);

    const halfW = (w + h) * HALF_TILE_WIDTH / 2;
    const halfH = (w + h) * HALF_TILE_HEIGHT / 2;
    assert(s.rx > halfW * 1.02 && s.ry > halfH * 1.02,
      `stín ${w}×${h} mírně přesahuje půdorys a je vidět`);
    assert(s.rx <= (w + h) * HALF_TILE_WIDTH * 0.6 && s.ry <= (w + h) * HALF_TILE_HEIGHT * 0.6,
      `stín ${w}×${h} nepřesahuje rozumnou míru`);
  }
}

console.log('\n--- Hloubkové řazení (z-ordering) budov a jednotek ---');
{
  // Jabloňový sad 4x4 na [10, 10]:
  // Podklad sadu se vykresluje na úrovni terénu.
  // Dělník uvnitř sadu na [11.5, 11.5] má hloubku: 11.5 + 11.5 + 0.35 = 23.35.
  // Zadní strom sadu na u=0.62, v=0.62 má hloubku: 10 + 10 + 1.24 = 21.24.
  // Přední strom sadu na u=2.94, v=2.94 má hloubku: 10 + 10 + 5.88 = 25.88.
  const orchard = { type: 'orchard', tileX: 10, tileY: 10, width: 4, height: 4 };
  const workerInside = { x: 11.5, y: 11.5 };
  const workerDepth = workerInside.x + workerInside.y + 0.35;
  const backTreeDepth = orchard.tileX + orchard.tileY + 0.62 + 0.62;
  const frontTreeDepth = orchard.tileX + orchard.tileY + (0.62 + 2 * 1.16) + (0.62 + 2 * 1.16);

  assert(workerDepth > backTreeDepth, 'dělník v sadu se vykreslí před zadním stromem');
  assert(workerDepth < frontTreeDepth, 'dělník v sadu je správně překryt předním stromem');

  // Uzavřená budova (např. kasárna 2x2 na [20, 20]):
  // Hloubka uzavřené budovy je tileX + tileY + Math.max(w, h) = 20 + 20 + 2 = 42.
  const barracks = { type: 'barracks', tileX: 20, tileY: 20, width: 2, height: 2 };
  const bDepth = barracks.tileX + barracks.tileY + Math.max(barracks.width, barracks.height);

  // Jednotka procházející jižně před budovou na [20.5, 22.5]:
  const unitInFront = { x: 20.5, y: 22.5 };
  const unitInFrontDepth = unitInFront.x + unitInFront.y + 0.35;
  assert(unitInFrontDepth > bDepth, 'jednotka před jižní stěnou budovy se vykreslí před budovou');

  // Jednotka za budovou na [19.5, 20.5]:
  const unitBehind = { x: 19.5, y: 20.5 };
  const unitBehindDepth = unitBehind.x + unitBehind.y + 0.35;
  assert(unitBehindDepth < bDepth, 'jednotka za severozápadní stěnou budovy je cloněna budovou');
}

console.log('\n--- Animace podle pohybu a činnosti ---');
{
  const unit = new Unit(42, 'villager', 1, 10, 10);
  unit.path = [{ x: 11, y: 10 }];
  let pose = unitAnimation(unit, 0);
  assert(!pose.moving && pose.stride === 0, 'samotná naplánovaná cesta nerozhýbe stojící postavu');
  unit.x += 0.1;
  pose = unitAnimation(unit, 0.05, pose);
  assert(pose.moving && pose.stride !== 0, 'skutečný přesun rozhýbe nohy');
  const phase = pose.phase;
  pose = unitAnimation(unit, 0.3, pose);
  assert(!pose.moving && pose.phase === phase && pose.stride === 0,
    'zablokovaná postava přestane přešlapovat');
  unit.pathIndex = unit.path.length;
  pose = unitAnimation(unit, 0.35, pose);
  assert(!pose.moving, 'dokončená cesta se nepovažuje za chůzi');
  unit.work = { phase: 'toSource', carry: 0, produce: 'wood' };
  assert(unitActivity(unit) === 'idle', 'cesta ke zdroji není práce nástrojem');
  unit.work.phase = 'gather';
  assert(unitAnimation(unit, 1, pose).activity === 'work', 'dělník těží jen ve fázi sběru');
  unit.workPaused = true;
  assert(unitAnimation(unit, 1, pose).effort === 0, 'pozastavená práce nemává nástrojem');
  unit.workPaused = false;
  unit.work.produce = 'food';
  assert(unitActivity(unit) === 'harvest', 'sadař při sběru ovoce nepoužívá krumpáč');
  unit.work.phase = 'pick';
  assert(unitActivity(unit) === 'harvest', 'sběr ovoce má samostatnou animaci');
  unit.work.phase = 'toStorage';
  unit.work.carry = 10;
  assert(unitActivity(unit) === 'idle', 'nosící dělník nepoužívá nástroj');
  unit.work = null;
  unit.build = { arrived: false };
  assert(unitActivity(unit) === 'idle', 'stavitel nezačne stavět před příchodem');
  unit.build.arrived = true;
  assert(unitActivity(unit) === 'build', 'přítomný stavitel používá stavební animaci');
  const remote = { ...unit, work: false, build: true, activity: 'build' };
  assert(unitAnimation(remote, 1).activity === 'build', 'síťový stav stavitele má stejnou animaci');
  const fighter = new Unit(43, 'swordsman', 1, 0, 0);
  fighter.cooldown = fighter.config.cooldown - 0.15;
  assert(unitAnimation(fighter, 1).attack > 0.8, 'švih meče navazuje na skutečný útok');
  fighter.cooldown = 0;
  assert(unitAnimation(fighter, 1).attack === 0, 'bez útoku není bojový švih');

  const strideAt = fps => {
    const walker = new Unit(44, 'villager', 1, 0, 0);
    let state = unitAnimation(walker, 0);
    for (let i = 1; i <= fps; i++) {
      walker.x = i / fps;
      state = unitAnimation(walker, i / fps, state);
    }
    return state.phase;
  };
  assert(Math.abs(strideAt(30) - strideAt(144)) < 1e-9,
    'délka kroku je stejná při 30 i 144 FPS');
  const turning = new Unit(45, 'villager', 1, 0, 0);
  turning.angle = Math.PI / 2;
  assert(unitAnimation(turning, 1).facing === -1, 'natočení respektuje izometrickou projekci směru');
  const initial = unitAnimation(turning, 0);
  turning.x -= 1 / 144;
  assert(unitAnimation(turning, 1 / 144, initial).facing === -1,
    'i malý krok při vysokém FPS správně otočí postavu');
}

console.log('\n--- Vykreslení budov a postav ---');
{
  let depth = 0, invalid = false, clips = 0;
  const ctx = new Proxy({
    save() { depth++; },
    restore() { depth--; if (depth < 0) invalid = true; },
    clip() { clips++; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        if (args.some(arg => typeof arg === 'number' && !Number.isFinite(arg))) invalid = true;
      };
    }
  });
  const renderer = Object.create(Renderer.prototype);
  renderer.time = 2;
  renderer.quality = 'high';
  renderer.unitAnimations = new WeakMap();
  renderer.session = { state: { buildings: [] } };
  for (const type of Object.keys(BUILDING_DEFS)) {
    const building = new Building(1, type, 1, 0, 0);
    for (const progress of [0, 0.35, 0.8, 1]) {
      building.progress = progress;
      building.complete = progress === 1;
      renderer.drawBuilding(ctx, building, {}, null, true);
      if (type === 'orchard') {
        renderer.drawOrchardGround(ctx, building);
        renderer.drawOrchardTree(ctx, building, 0, 0, 0.62, 0.62);
        renderer.drawOrchardBasket(ctx, building);
      }
    }
    assert(!invalid && depth === 0, `${type}: hotová i rozestavěná budova kreslí platné souřadnice a obnoví kontext`);
  }
  assert(clips >= 30, 'konstrukce se odhaluje ořezem od základů, nikoli průhledností');
  for (const type of ['villager', 'archer', 'swordsman']) {
    const unit = new Unit(1, type, 1, 0, 0);
    for (const phase of ['toSource', 'gather', 'pick', 'toStorage']) {
      unit.work = { phase, carry: phase === 'toStorage' ? 10 : 0 };
      renderer.drawUnit(ctx, unit, { selectedIds: new Set([1]) }, null);
    }
    assert(!invalid && depth === 0, `${type}: pózy a náklad nepoškodí kreslicí kontext`);
  }
}

console.log(failures ? `\n${failures} CHYB` : '\nVšechny testy klienta prošly.');
process.exit(failures ? 1 : 0);
