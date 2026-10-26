import { MAP_SIZE, TILE_TYPES, RESOURCE_TYPES } from '../sim/constants.js';
import { GameMap } from '../sim/mapgen.js';

const PREVIEW_SEEDS = { desert: 1337, oasis: 4242, canyon: 9001 };

const MINI_COLORS = {
  [TILE_TYPES.SAND]: [216, 177, 113],
  [TILE_TYPES.DUNE]: [203, 160, 95],
  [TILE_TYPES.CLAY]: [184, 140, 83],
  [TILE_TYPES.GRASS]: [79, 125, 56],
  [TILE_TYPES.WATER_DEEP]: [29, 98, 118],
  [TILE_TYPES.WATER_SHALLOW]: [61, 146, 158],
  [TILE_TYPES.ROCK]: [161, 129, 90]
};


export function drawPreview(canvas, type) {
  try {
    let dataUrl = this.previewCache.get(type);
    if (!dataUrl) {
      const map = new GameMap(PREVIEW_SEEDS[type] || 1234, type, MAP_SIZE);
      const off = document.createElement('canvas');
      off.width = MAP_SIZE;
      off.height = MAP_SIZE;
      const ctx = off.getContext('2d');
      const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
      for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
        const tile = map.tiles[i];
        let rgb = MINI_COLORS[tile] || [216, 177, 113];
        const res = map.resources[i];
        if (res === RESOURCE_TYPES.TREE) rgb = [60, 103, 45];
        else if (res === RESOURCE_TYPES.STONE) rgb = [196, 166, 120];
        else if (res === RESOURCE_TYPES.IRON) rgb = [102, 96, 92];
        const o = i * 4;
        img.data[o] = rgb[0];
        img.data[o + 1] = rgb[1];
        img.data[o + 2] = rgb[2];
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // Startovní pozice.
      for (const [ix, iy] of [[55, 55], [142, 55], [142, 142], [55, 142]]) {
        ctx.fillStyle = 'rgba(255,240,190,0.95)';
        ctx.beginPath();
        ctx.arc(ix + 1.5, iy + 1.5, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,60,20,0.9)';
        ctx.beginPath();
        ctx.arc(ix + 1.5, iy + 1.5, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      dataUrl = off.toDataURL();
      this.previewCache.set(type, dataUrl);
    }
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      const cropH = 118;
      ctx.drawImage(img, 0, 60, MAP_SIZE, cropH, 0, 0, canvas.width, canvas.height);
      const grad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
      grad.addColorStop(0, 'rgba(20,12,6,0)');
      grad.addColorStop(1, 'rgba(20,12,6,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  } catch (err) {
    console.warn('Náhled mapy se nepodařilo vykreslit', err);
  }
}
