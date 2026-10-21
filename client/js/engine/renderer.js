import { TILE_WIDTH, TILE_HEIGHT, MAX_BUILD_RADIUS, tileToScreen } from './isometric.js';
import { TILE_TYPES, RESOURCE_TYPES, CASTLE_START_X, CASTLE_START_Y } from './map.js';
import { BUILDING_TYPES, BUILDING_CONFIG } from '../game/buildings.js';
import { UNIT_TYPES } from '../game/units.js';

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas.getContext('2d');

    this.time = 0;
  }

  render(camera, map, state) {
    this.time += 0.016;
    const ctx = this.ctx;
    const canvas = this.canvas;

    // Pouštní atmosférické pozadí
    ctx.fillStyle = '#b38b4d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    camera.applyTransform(ctx);

    const bounds = this.getVisibleTileBounds(camera, map);

    // 1. Vykreslení pouštního a oázového terénu
    this.renderTerrain(ctx, map, bounds);

    // 2. Vykreslení 100-blokového královského rádiusu křižáků
    this.renderKingdomRadius(ctx, map);

    // 3. Vykreslení prvků seřazených podle izometrické hloubky
    this.renderDepthSortedEntities(ctx, map, state, bounds);

    // 4. Náhled stavby
    if (state.buildMode) {
      this.renderBuildGhost(ctx, state);
    }

    // 5. Zvýraznění dlaždice pod myší
    this.renderHoverTile(ctx, state.hoverTile);

    // 6. Plovoucí texty
    this.renderFloatingTexts(ctx, state.floatingTexts);

    ctx.restore();

    // 7. Minimapa
    this.renderMinimap(camera, map, state);
  }

  getVisibleTileBounds(camera, map) {
    const halfW = (this.canvas.width / 2) / camera.zoom + 220;
    const halfH = (this.canvas.height / 2) / camera.zoom + 220;

    return {
      minX: Math.max(0, Math.floor((camera.y - halfH) / TILE_HEIGHT + (camera.x - halfW) / TILE_WIDTH) - 4),
      maxX: Math.min(map.size, Math.ceil((camera.y + halfH) / TILE_HEIGHT + (camera.x + halfW) / TILE_WIDTH) + 4),
      minY: Math.max(0, Math.floor((camera.y - halfH) / TILE_HEIGHT - (camera.x + halfW) / TILE_WIDTH) - 4),
      maxY: Math.min(map.size, Math.ceil((camera.y + halfH) / TILE_HEIGHT - (camera.x - halfW) / TILE_WIDTH) + 4)
    };
  }

  renderTerrain(ctx, map, bounds) {
    for (let y = bounds.minY; y < bounds.maxY; y++) {
      for (let x = bounds.minX; x < bounds.maxX; x++) {
        const tileType = map.getTile(x, y);
        if (tileType === null) continue;

        const pos = tileToScreen(x, y);
        this.drawTile(ctx, pos.x, pos.y, tileType, x, y);
      }
    }
  }

  drawTile(ctx, screenX, screenY, tileType, tileX, tileY) {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(screenX, screenY);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(halfW, halfH);
    ctx.lineTo(0, TILE_HEIGHT);
    ctx.lineTo(-halfW, halfH);
    ctx.closePath();

    // Barevná paleta: Písek, Duny, Voda oázy, Tráva
    let topColor = '#d9b372';
    if (tileType === TILE_TYPES.DESERT_SAND_2) topColor = '#caa05e';
    else if (tileType === TILE_TYPES.CRACKED_CLAY) topColor = '#b88d4d';
    else if (tileType === TILE_TYPES.OASIS_GRASS) topColor = '#3e7c2e';
    else if (tileType === TILE_TYPES.OASIS_WATER) topColor = '#227b87';

    ctx.fillStyle = topColor;
    ctx.fill();

    // Jemná textura a hrany
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vodní odlesky v oáze
    if (tileType === TILE_TYPES.OASIS_WATER) {
      const glint = Math.sin(this.time * 3 + tileX * 2 + tileY) * 0.3 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${glint * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(0, halfH, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Větrné vlnky na písku
    if (tileType === TILE_TYPES.DESERT_SAND_2) {
      ctx.strokeStyle = 'rgba(180, 130, 60, 0.25)';
      ctx.beginPath();
      ctx.moveTo(-10, halfH - 2);
      ctx.quadraticCurveTo(0, halfH - 6, 10, halfH - 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderKingdomRadius(ctx, map) {
    const castlePos = tileToScreen(CASTLE_START_X + 1.5, CASTLE_START_Y + 1.5);

    ctx.save();
    ctx.translate(castlePos.x, castlePos.y);

    const rx = MAX_BUILD_RADIUS * (TILE_WIDTH / 2) * 1.414;
    const ry = MAX_BUILD_RADIUS * (TILE_HEIGHT / 2) * 1.414;

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

    // Křižácká zlatá a červená hranice panství
    ctx.strokeStyle = 'rgba(217, 70, 38, 0.45)';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 14]);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240, 192, 90, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  renderDepthSortedEntities(ctx, map, state, bounds) {
    const renderList = [];

    // 1. Zdroje
    for (let y = bounds.minY; y < bounds.maxY; y++) {
      for (let x = bounds.minX; x < bounds.maxX; x++) {
        const res = map.getResource(x, y);
        if (res !== RESOURCE_TYPES.NONE) {
          renderList.push({
            type: 'resource',
            resType: res,
            tileX: x,
            tileY: y,
            depth: x + y + 0.5
          });
        }
      }
    }

    // 2. Budovy
    for (const b of state.buildings) {
      renderList.push({
        type: 'building',
        building: b,
        depth: b.tileX + b.tileY + b.width + b.height - 1
      });
    }

    // 3. Jednotky
    for (const u of state.units) {
      renderList.push({
        type: 'unit',
        unit: u,
        depth: u.x + u.y
      });
    }

    renderList.sort((a, b) => a.depth - b.depth);

    for (const item of renderList) {
      if (item.type === 'resource') {
        this.drawResource(ctx, item.tileX, item.tileY, item.resType);
      } else if (item.type === 'building') {
        this.drawBuilding(ctx, item.building, state.selectedEntity?.entity === item.building, state.unemployedCitizens);
      } else if (item.type === 'unit') {
        this.drawUnit(ctx, item.unit, state.selectedEntity?.entity === item.unit);
      }
    }
  }

  drawResource(ctx, tileX, tileY, resType) {
    const pos = tileToScreen(tileX, tileY);
    const centerX = pos.x;
    const centerY = pos.y + TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    if (resType === RESOURCE_TYPES.PALM_TREE) {
      // Stín palmy na písku
      ctx.fillStyle = 'rgba(70, 50, 20, 0.35)';
      ctx.beginPath();
      ctx.ellipse(6, 4, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Prohnutý kmen palmy
      ctx.strokeStyle = '#855128';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(4, -18, 2, -34);
      ctx.stroke();

      // Datle pod listy
      ctx.fillStyle = '#6b3612';
      ctx.beginPath();
      ctx.arc(2, -32, 2.5, 0, Math.PI * 2);
      ctx.arc(5, -31, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Široké palmové listy s lehkým větrem
      const sway = Math.sin(this.time * 2.2 + tileX) * 2;
      const palmLeaves = [
        { angle: -0.9, len: 20 },
        { angle: -0.3, len: 22 },
        { angle: 0.3, len: 22 },
        { angle: 0.9, len: 20 },
        { angle: -1.4, len: 16 },
        { angle: 1.4, len: 16 }
      ];

      ctx.save();
      ctx.translate(2 + sway, -34);
      for (const leaf of palmLeaves) {
        ctx.strokeStyle = '#2d6a1e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const lx = Math.cos(leaf.angle) * leaf.len;
        const ly = Math.sin(leaf.angle) * (leaf.len * 0.7);
        ctx.quadraticCurveTo(lx * 0.6, ly - 4, lx, ly + 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (resType === RESOURCE_TYPES.SANDSTONE_ROCK) {
      // Pískovcový skalní masiv
      ctx.fillStyle = 'rgba(70, 50, 20, 0.4)';
      ctx.beginPath();
      ctx.ellipse(3, 3, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pískovcové kamenné vrstvy
      ctx.fillStyle = '#b8894d';
      ctx.beginPath();
      ctx.moveTo(-12, 3);
      ctx.lineTo(-6, -16);
      ctx.lineTo(8, -13);
      ctx.lineTo(14, 2);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fill();

      // Světlá pískovcová hrana
      ctx.fillStyle = '#d9aa6b';
      ctx.beginPath();
      ctx.moveTo(-6, -16);
      ctx.lineTo(8, -13);
      ctx.lineTo(2, -3);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.fill();

      // Vrstvy sedimentu
      ctx.strokeStyle = '#8c6130';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(10, 0);
      ctx.moveTo(-4, -8);
      ctx.lineTo(6, -6);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Pomocná metoda pro přesný převod lokálních souřadnic budovy (u, v, z) na obrazovku
  isoPt(u, v, z = 0) {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    return {
      x: (u - v) * halfW,
      y: (u + v) * halfH - z
    };
  }

  // Vykreslení izometrického kvádru zarovnaného s osami mřížky
  drawIsoBox(ctx, u1, v1, u2, v2, z1, z2, colors = { top: '#deb370', left: '#caa05e', right: '#e8c280' }, strokeColor = 'rgba(0,0,0,0.25)') {
    const p_top_0 = this.isoPt(u1, v1, z2);
    const p_top_1 = this.isoPt(u2, v1, z2);
    const p_top_2 = this.isoPt(u2, v2, z2);
    const p_top_3 = this.isoPt(u1, v2, z2);

    const p_bot_1 = this.isoPt(u2, v1, z1);
    const p_bot_2 = this.isoPt(u2, v2, z1);
    const p_bot_3 = this.isoPt(u1, v2, z1);

    // 1. Levá stěna (jihozápadní strana v izometrii)
    ctx.fillStyle = colors.left || '#caa05e';
    ctx.beginPath();
    ctx.moveTo(p_bot_3.x, p_bot_3.y);
    ctx.lineTo(p_bot_2.x, p_bot_2.y);
    ctx.lineTo(p_top_2.x, p_top_2.y);
    ctx.lineTo(p_top_3.x, p_top_3.y);
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Pravá stěna (jihovýchodní strana v izometrii)
    ctx.fillStyle = colors.right || '#e8c280';
    ctx.beginPath();
    ctx.moveTo(p_bot_2.x, p_bot_2.y);
    ctx.lineTo(p_bot_1.x, p_bot_1.y);
    ctx.lineTo(p_top_1.x, p_top_1.y);
    ctx.lineTo(p_top_2.x, p_top_2.y);
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 3. Horní vodorovná plocha (střecha)
    ctx.fillStyle = colors.top || '#deb370';
    ctx.beginPath();
    ctx.moveTo(p_top_0.x, p_top_0.y);
    ctx.lineTo(p_top_1.x, p_top_1.y);
    ctx.lineTo(p_top_2.x, p_top_2.y);
    ctx.lineTo(p_top_3.x, p_top_3.y);
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Vykreslení horizontálního izometrického polygonu na mřížce
  drawIsoGround(ctx, u1, v1, u2, v2, z = 0, fillColor = '#2a5a22', strokeColor = null) {
    const p0 = this.isoPt(u1, v1, z);
    const p1 = this.isoPt(u2, v1, z);
    const p2 = this.isoPt(u2, v2, z);
    const p3 = this.isoPt(u1, v2, z);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  drawBuilding(ctx, building, isSelected, unemployedCount = 0) {
    const pos = tileToScreen(building.tileX, building.tileY);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const bW = building.width;
    const bH = building.height;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Výběrový rámeček přesně kopírující půdorys na mřížce
    if (isSelected) {
      ctx.save();
      ctx.fillStyle = 'rgba(240, 192, 90, 0.22)';
      ctx.strokeStyle = '#f0c05a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(bW * halfW, bW * halfH);
      ctx.lineTo((bW - bH) * halfW, (bW + bH) * halfH);
      ctx.lineTo(-bH * halfW, bH * halfH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Vykreslení konkrétní budovy s přesným izometrickým zarovnáním
    if (building.type === BUILDING_TYPES.CASTLE) {
      this.drawCastleStructure(ctx, bW, bH, unemployedCount);
    } else if (building.type === BUILDING_TYPES.BARRACKS) {
      this.drawBarracksStructure(ctx, bW, bH);
    } else if (building.type === BUILDING_TYPES.LUMBERJACK) {
      this.drawLumberjackStructure(ctx, bW, bH, building.assignedWorkers);
    } else if (building.type === BUILDING_TYPES.QUARRY) {
      this.drawQuarryStructure(ctx, bW, bH, building.assignedWorkers);
    } else if (building.type === BUILDING_TYPES.ORCHARD) {
      this.drawOrchardStructure(ctx, bW, bH, building.assignedWorkers);
    }

    // Indikátor pracovníků nad budovou
    if (building.assignedWorkers > 0) {
      const topPt = this.isoPt(bW / 2, bH / 2, 70);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`👥 ${building.assignedWorkers}/${building.config.maxWorkers}`, topPt.x, topPt.y);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // 1. Královský Donjon (3×3 bloky) přesně usazený na mřížce
  drawCastleStructure(ctx, bW, bH, unemployedCount) {
    // Základní kamenný sokl celého pozemku 3×3
    this.drawIsoBox(ctx, 0, 0, bW, bH, 0, 3, { top: '#caa05e', left: '#9a703a', right: '#deb370' });

    // Dlažba předního nádvoří
    this.drawIsoGround(ctx, 0.1, 1.8, 2.9, 2.9, 3, '#c29653');

    // Hlavní pevnost (Keep) zabírající zadní část pozemku
    this.drawIsoBox(ctx, 0.4, 0.4, 2.6, 1.8, 3, 44, { top: '#deb370', left: '#9a703a', right: '#deb370' });

    // Brána s padací mříží uprostřed přední stěny
    const gateP0 = this.isoPt(1.1, 1.8, 3);
    const gateP1 = this.isoPt(1.9, 1.8, 3);
    const gateTop1 = this.isoPt(1.9, 1.8, 22);
    const gateTop0 = this.isoPt(1.1, 1.8, 22);
    ctx.fillStyle = '#2d1808';
    ctx.beginPath();
    ctx.moveTo(gateP0.x, gateP0.y);
    ctx.lineTo(gateP1.x, gateP1.y);
    ctx.lineTo(gateTop1.x, gateTop1.y);
    ctx.lineTo(gateTop0.x, gateTop0.y);
    ctx.closePath();
    ctx.fill();

    // 4 Rohové obranné věže
    const towers = [
      { u1: 0.15, v1: 0.15, u2: 0.85, v2: 0.85 }, // Zadní věž
      { u1: 2.15, v1: 0.15, u2: 2.85, v2: 0.85 }, // Pravá věž
      { u1: 0.15, v1: 1.35, u2: 0.85, v2: 2.05 }, // Levá věž
      { u1: 2.15, v1: 1.35, u2: 2.85, v2: 2.05 }  // Přední pravá věž
    ];

    for (const t of towers) {
      this.drawIsoBox(ctx, t.u1, t.v1, t.u2, t.v2, 3, 56, { top: '#deb370', left: '#8c6230', right: '#deb370' });
      // Cimbuří věže
      this.drawIsoBox(ctx, t.u1, t.v1, t.u2, t.v2, 56, 60, { top: '#caa05e', left: '#785025', right: '#c29653' });
    }

    // Královská korouhev na vrcholu Donjonu
    const flagBase = this.isoPt(1.5, 1.1, 44);
    const flagTop = this.isoPt(1.5, 1.1, 74);
    ctx.strokeStyle = '#deb370';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(flagBase.x, flagBase.y);
    ctx.lineTo(flagTop.x, flagTop.y);
    ctx.stroke();

    const wave = Math.sin(this.time * 4) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(flagTop.x, flagTop.y);
    ctx.lineTo(flagTop.x + 18 + wave, flagTop.y + 6);
    ctx.lineTo(flagTop.x, flagTop.y + 12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(flagTop.x + 2, flagTop.y + 6);
    ctx.lineTo(flagTop.x + 15 + wave * 0.7, flagTop.y + 6);
    ctx.moveTo(flagTop.x + 7 + wave * 0.3, flagTop.y + 1);
    ctx.lineTo(flagTop.x + 7 + wave * 0.3, flagTop.y + 11);
    ctx.stroke();

    // Táborové ohniště na předním nádvoří hradu (u = 1.5, v = 2.4)
    const firePos = this.isoPt(1.5, 2.4, 3);
    ctx.fillStyle = '#654321';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const sx = firePos.x + Math.cos(a) * 9;
      const sy = firePos.y + Math.sin(a) * 5;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Uhlíky a plamen
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(firePos.x, firePos.y, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const flameH = 8 + Math.sin(this.time * 12) * 3;
    const flameWiggle = Math.sin(this.time * 16) * 2;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(firePos.x - 4, firePos.y);
    ctx.quadraticCurveTo(firePos.x + flameWiggle, firePos.y - flameH, firePos.x + 4, firePos.y);
    ctx.closePath();
    ctx.fill();

    // Poddaní sedící na dlaždicích nádvoří kolem ohniště
    const peasantsAround = Math.min(unemployedCount, 4);
    const peasantSlots = [
      { u: 1.15, v: 2.35 },
      { u: 1.85, v: 2.35 },
      { u: 1.35, v: 2.7 },
      { u: 1.65, v: 2.7 }
    ];

    for (let i = 0; i < peasantsAround; i++) {
      const slot = peasantSlots[i];
      const p = this.isoPt(slot.u, slot.v, 3);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(p.x - 2, p.y - 7, 4, 6);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 9, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Kasárna (2×2 bloky)
  drawBarracksStructure(ctx, bW, bH) {
    // Podkladový kamenný sokl 2×2
    this.drawIsoBox(ctx, 0, 0, bW, bH, 0, 2, { top: '#caa05e', left: '#9a703a', right: '#deb370' });

    // Budova kasáren na levé části pozemku
    this.drawIsoBox(ctx, 0.15, 0.15, 1.25, 1.85, 2, 26, { top: '#deb370', left: '#8c6230', right: '#deb370' });

    // Sedlová střecha kasáren
    const ridgeBack = this.isoPt(0.7, 0.15, 38);
    const ridgeFront = this.isoPt(0.7, 1.85, 38);
    const eavesLeftBack = this.isoPt(0.1, 0.15, 26);
    const eavesLeftFront = this.isoPt(0.1, 1.85, 26);
    const eavesRightBack = this.isoPt(1.3, 0.15, 26);
    const eavesRightFront = this.isoPt(1.3, 1.85, 26);

    // Levý sklon střechy
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(eavesLeftBack.x, eavesLeftBack.y);
    ctx.lineTo(eavesLeftFront.x, eavesLeftFront.y);
    ctx.lineTo(ridgeFront.x, ridgeFront.y);
    ctx.lineTo(ridgeBack.x, ridgeBack.y);
    ctx.closePath();
    ctx.fill();

    // Pravý sklon střechy
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(eavesRightBack.x, eavesRightBack.y);
    ctx.lineTo(eavesRightFront.x, eavesRightFront.y);
    ctx.lineTo(ridgeFront.x, ridgeFront.y);
    ctx.lineTo(ridgeBack.x, ridgeBack.y);
    ctx.closePath();
    ctx.fill();

    // Dveře do kasáren na pravé stěně
    const doorP0 = this.isoPt(1.25, 0.8, 2);
    const doorP1 = this.isoPt(1.25, 1.3, 2);
    const doorT1 = this.isoPt(1.25, 1.3, 16);
    const doorT0 = this.isoPt(1.25, 0.8, 16);
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(doorP0.x, doorP0.y);
    ctx.lineTo(doorP1.x, doorP1.y);
    ctx.lineTo(doorT1.x, doorT1.y);
    ctx.lineTo(doorT0.x, doorT0.y);
    ctx.closePath();
    ctx.fill();

    // Cvičiště na pravé straně (terč a stojan na zbraně)
    const targetPt = this.isoPt(1.6, 0.6, 2);
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(targetPt.x, targetPt.y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(targetPt.x, targetPt.y - 8, 4, 0, Math.PI * 2);
    ctx.fill();

    const rackPt = this.isoPt(1.6, 1.4, 2);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rackPt.x - 6, rackPt.y);
    ctx.lineTo(rackPt.x + 6, rackPt.y);
    ctx.moveTo(rackPt.x - 3, rackPt.y);
    ctx.lineTo(rackPt.x - 3, rackPt.y - 12);
    ctx.moveTo(rackPt.x + 3, rackPt.y);
    ctx.lineTo(rackPt.x + 3, rackPt.y - 12);
    ctx.stroke();
  }

  // 3. Dřevorubecký tábor (2×2 bloky)
  drawLumberjackStructure(ctx, bW, bH, workers) {
    // Ušlapaná půda celého pozemku 2×2
    this.drawIsoGround(ctx, 0, 0, bW, bH, 0, '#855128', 'rgba(0,0,0,0.15)');

    // Dřevěný srub v zadní části
    this.drawIsoBox(ctx, 0.15, 0.15, 1.3, 1.3, 0, 20, { top: '#a16207', left: '#78350f', right: '#92400e' });

    // Plátěná markýza / střecha
    const awningTop = this.isoPt(0.7, 0.15, 30);
    const awningFront = this.isoPt(0.7, 1.3, 30);
    const aLeft = this.isoPt(0.1, 1.3, 20);
    const aRight = this.isoPt(1.35, 1.3, 20);

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(awningTop.x, awningTop.y);
    ctx.lineTo(awningFront.x, awningFront.y);
    ctx.lineTo(aRight.x, aRight.y);
    ctx.lineTo(aLeft.x, aLeft.y);
    ctx.closePath();
    ctx.fill();

    // Komín s kouřem
    const chimney = this.isoPt(0.3, 0.3, 20);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(chimney.x - 3, chimney.y - 10, 6, 10);

    if (workers > 0) {
      const smokeY = (this.time * 16) % 20;
      ctx.fillStyle = 'rgba(200, 190, 180, 0.4)';
      ctx.beginPath();
      ctx.arc(chimney.x, chimney.y - 12 - smokeY, 3 + smokeY * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Naskládané dřevo a špalek na předním dvoře
    const logPt = this.isoPt(1.5, 1.3, 0);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(logPt.x - 7, logPt.y - 6, 14, 5);
    ctx.fillRect(logPt.x - 5, logPt.y - 10, 10, 4);

    const stumpPt = this.isoPt(0.7, 1.6, 0);
    ctx.fillStyle = '#713f12';
    ctx.beginPath();
    ctx.arc(stumpPt.x, stumpPt.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Pískovcový kamenolom (2×2 bloky)
  drawQuarryStructure(ctx, bW, bH, workers) {
    // Pevný kamenný okraj celého pozemku 2×2
    this.drawIsoGround(ctx, 0, 0, bW, bH, 0, '#caa05e', 'rgba(0,0,0,0.2)');

    // Vykopaná pískovcová jáma (uvnitř mřížky s odsazením 0.25 dlaždice)
    const p0 = this.isoPt(0.25, 0.25, 0);
    const p1 = this.isoPt(1.75, 0.25, 0);
    const p2 = this.isoPt(1.75, 1.75, 0);
    const p3 = this.isoPt(0.25, 1.75, 0);

    ctx.fillStyle = '#5c4028';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();

    // Hlubší terasové dno lomu
    const f0 = this.isoPt(0.45, 0.45, -12);
    const f1 = this.isoPt(1.55, 0.45, -12);
    const f2 = this.isoPt(1.55, 1.55, -12);
    const f3 = this.isoPt(0.45, 1.55, -12);

    ctx.fillStyle = '#3a2717';
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f2.x, f2.y);
    ctx.lineTo(f3.x, f3.y);
    ctx.closePath();
    ctx.fill();

    // Zadní stěna lomu
    ctx.fillStyle = '#8c6031';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.lineTo(f0.x, f0.y);
    ctx.closePath();
    ctx.fill();

    // Dřevěný těžební jeřáb na pevném skalním okraji
    const craneBase = this.isoPt(1.75, 0.35, 0);
    const craneTop = this.isoPt(1.75, 0.35, 34);
    const craneBoom = this.isoPt(1.0, 1.0, 28);

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(craneBase.x, craneBase.y);
    ctx.lineTo(craneTop.x, craneTop.y);
    ctx.lineTo(craneBoom.x, craneBoom.y);
    ctx.stroke();

    // Lano s kamenným blokem visícím do jámy
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(craneBoom.x, craneBoom.y);
    ctx.lineTo(craneBoom.x, craneBoom.y + 16);
    ctx.stroke();

    ctx.fillStyle = '#deb370';
    ctx.fillRect(craneBoom.x - 4, craneBoom.y + 14, 8, 8);

    // Otesané kvádry pískovce připravené na okraji
    const block1 = this.isoPt(1.4, 1.6, 0);
    this.drawIsoBox(ctx, 1.3, 1.5, 1.6, 1.8, 0, 8, { top: '#deb370', left: '#b8894d', right: '#caa05e' });
  }

  // 5. Jabloňový sad (2×2 bloky) přesně vyplňující 4 dlaždice
  drawOrchardStructure(ctx, bW, bH, workers) {
    // Úrodná půda sadu na všech 4 dlaždicích 2×2
    this.drawIsoGround(ctx, 0, 0, bW, bH, 0, '#2d5e22');

    // Nízká ohradní pískovcová zídka po celém obvodu 2×2
    this.drawIsoBox(ctx, 0, 0, 0.08, bH, 0, 5, { top: '#deb370', left: '#9a703a', right: '#caa05e' }, null); // levá hrana
    this.drawIsoBox(ctx, 0, 0, bW, 0.08, 0, 5, { top: '#deb370', left: '#9a703a', right: '#caa05e' }, null); // horní hrana
    this.drawIsoBox(ctx, bW - 0.08, 0, bW, bH, 0, 5, { top: '#deb370', left: '#9a703a', right: '#caa05e' }, null); // pravá hrana
    this.drawIsoBox(ctx, 0, bH - 0.08, bW, bH, 0, 5, { top: '#deb370', left: '#9a703a', right: '#caa05e' }, null); // dolní hrana

    // Zavlažovací strouha s tyrkysovou vodou uprostřed
    const canalP0 = this.isoPt(0.95, 0.1, 0);
    const canalP1 = this.isoPt(1.05, 0.1, 0);
    const canalP2 = this.isoPt(1.05, 1.9, 0);
    const canalP3 = this.isoPt(0.95, 1.9, 0);

    ctx.fillStyle = '#227b87';
    ctx.beginPath();
    ctx.moveTo(canalP0.x, canalP0.y);
    ctx.lineTo(canalP1.x, canalP1.y);
    ctx.lineTo(canalP2.x, canalP2.y);
    ctx.lineTo(canalP3.x, canalP3.y);
    ctx.closePath();
    ctx.fill();

    // 4 Jablůňky umístěné přesně ve středu každé ze 4 dlaždic!
    const treeCenters = [
      { u: 0.5, v: 0.5 }, // Dlaždice (0, 0)
      { u: 1.5, v: 0.5 }, // Dlaždice (1, 0)
      { u: 0.5, v: 1.5 }, // Dlaždice (0, 1)
      { u: 1.5, v: 1.5 }  // Dlaždice (1, 1)
    ];

    for (const tc of treeCenters) {
      const basePt = this.isoPt(tc.u, tc.v, 0);
      const topPt = this.isoPt(tc.u, tc.v, 14);

      // Stín stromu
      ctx.fillStyle = 'rgba(20, 40, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(basePt.x + 3, basePt.y + 2, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Kmen stromu
      ctx.fillStyle = '#713f12';
      ctx.fillRect(basePt.x - 1.5, topPt.y, 3, basePt.y - topPt.y);

      // Zelená koruna s jablky
      ctx.fillStyle = '#1e7019';
      ctx.beginPath();
      ctx.arc(topPt.x, topPt.y - 6, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Červená zralá jablka
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(topPt.x - 4, topPt.y - 6, 2, 0, Math.PI * 2);
      ctx.arc(topPt.x + 4, topPt.y - 5, 2, 0, Math.PI * 2);
      ctx.arc(topPt.x - 1, topPt.y - 11, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }


  drawUnit(ctx, unit, isSelected) {
    const pos = tileToScreen(unit.x, unit.y);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    if (isSelected) {
      ctx.strokeStyle = '#f0c05a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Stín
    ctx.fillStyle = 'rgba(70, 50, 20, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (unit.type === UNIT_TYPES.SWORDSMAN) {
      // Křižácký pěšák: Kroužková zbroj, bílá varka s červeným křížem, štít a meč
      // Tělo / varka s křížem
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -15, 6, 11);

      // Červený kříž na hrudi
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-3, -12, 6, 2);
      ctx.fillRect(-1, -14, 2, 6);

      // Ocelová přilbice
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, -18, 4, 0, Math.PI * 2);
      ctx.fill();

      // Křižácký štít (mandlový / trojúhelníkový)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-7, -15);
      ctx.lineTo(-3, -15);
      ctx.lineTo(-5, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Ocelový meč
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(3, -9);
      ctx.lineTo(8, -16);
      ctx.stroke();
    } else if (unit.type === UNIT_TYPES.ARCHER) {
      // Evropský lučištník: kožená zbroj, kápička, dlouhý luk
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(-3, -14, 6, 10);

      // Kápě
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(0, -17, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Luk z tisu
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(4, -13, 7, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else {
      // Poddaný
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-3, -12, 6, 9);
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -15, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  renderBuildGhost(ctx, state) {
    if (!state.buildMode) return;
    const config = BUILDING_CONFIG[state.buildMode];
    if (!config) return;

    const tileX = state.hoverTile.x;
    const tileY = state.hoverTile.y;
    const check = state.canPlaceBuilding(state.buildMode, tileX, tileY);

    const pos = tileToScreen(tileX, tileY);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    const bW = config.width || 2;
    const bH = config.height || 2;

    // Vykreslení jednotlivých dlaždic mřížky, které budova zabere
    for (let dy = 0; dy < bH; dy++) {
      for (let dx = 0; dx < bW; dx++) {
        const subX = (dx - dy) * halfW;
        const subY = (dx + dy) * halfH;

        ctx.save();
        ctx.translate(subX, subY);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(halfW, halfH);
        ctx.lineTo(0, TILE_HEIGHT);
        ctx.lineTo(-halfW, halfH);
        ctx.closePath();

        ctx.fillStyle = check.valid ? 'rgba(34, 197, 94, 0.25)' : 'rgba(220, 38, 38, 0.3)';
        ctx.strokeStyle = check.valid ? 'rgba(34, 197, 94, 0.6)' : 'rgba(220, 38, 38, 0.6)';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Celkový 45° izometrický obvod stavby
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bW * halfW, bW * halfH);
    ctx.lineTo((bW - bH) * halfW, (bW + bH) * halfH);
    ctx.lineTo(-bH * halfW, bH * halfH);
    ctx.closePath();

    ctx.strokeStyle = check.valid ? '#22c55e' : '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  renderHoverTile(ctx, hoverTile) {
    const pos = tileToScreen(hoverTile.x, hoverTile.y);
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(halfW, halfH);
    ctx.lineTo(0, TILE_HEIGHT);
    ctx.lineTo(-halfW, halfH);
    ctx.closePath();

    ctx.strokeStyle = 'rgba(255, 230, 150, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  renderFloatingTexts(ctx, texts) {
    ctx.save();
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.textAlign = 'center';

    for (const ft of texts) {
      const pos = tileToScreen(ft.x, ft.y);
      const alpha = Math.min(1, ft.life / 0.5);

      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 5;
      ctx.fillText(ft.text, pos.x, pos.y);
    }

    ctx.restore();
  }

  renderMinimap(camera, map, state) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    // Písečné pozadí minimapy
    ctx.fillStyle = '#b8894d';
    ctx.fillRect(0, 0, w, h);

    const scale = w / map.size;

    // Křižácký rádius 100 bloků na minimapě
    const castleX = CASTLE_START_X * scale;
    const castleY = CASTLE_START_Y * scale;
    const radiusPx = MAX_BUILD_RADIUS * scale;

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(castleX, castleY, radiusPx, 0, Math.PI * 2);
    ctx.stroke();

    // Donjon a budovy
    for (const b of state.buildings) {
      if (b.type === BUILDING_TYPES.CASTLE) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.tileX * scale - 2, b.tileY * scale - 2, 6, 6);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(b.tileX * scale - 1, b.tileY * scale - 1, 4, 4);
      } else {
        ctx.fillStyle = '#f0c05a';
        ctx.fillRect(b.tileX * scale - 1, b.tileY * scale - 1, 3, 3);
      }
    }

    // Jednotky
    ctx.fillStyle = '#ef4444';
    for (const u of state.units) {
      ctx.fillRect(u.x * scale, u.y * scale, 2, 2);
    }

    // Zorné pole kamery
    const centerTileX = camera.x / TILE_WIDTH + camera.y / TILE_HEIGHT;
    const centerTileY = camera.y / TILE_HEIGHT - camera.x / TILE_WIDTH;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const viewW = (this.canvas.width / 50) / camera.zoom;
    const viewH = (this.canvas.height / 50) / camera.zoom;
    ctx.strokeRect(
      centerTileX * scale - viewW / 2,
      centerTileY * scale - viewH / 2,
      viewW,
      viewH
    );
  }
}
