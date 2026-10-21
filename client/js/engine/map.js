import { getDistance } from './isometric.js';

export const MAP_SIZE = 250; // Rozměr pouštní mapy v blocích
export const CASTLE_START_X = 125;
export const CASTLE_START_Y = 125;

export const TILE_TYPES = {
  DESERT_SAND_1: 0,   // Základní jemný pouštní písek
  DESERT_SAND_2: 1,   // Písečná duna s větrným zvlněním
  CRACKED_CLAY: 2,    // Vyschlá vyprahlá pouštní hlína
  OASIS_GRASS: 3,     // Úrodná zeleň v oáze (vhodná pro sady)
  OASIS_WATER: 4      // Tyrkysová vodní nádrž / jezírko oázy
};

export const RESOURCE_TYPES = {
  NONE: 0,
  PALM_TREE: 1,       // Palmové a akáciové dřevo pro dřevorubce
  SANDSTONE_ROCK: 2   // Pískovcové a vápencové masivy pro kamenolom
};

export class GameMap {
  constructor(size = MAP_SIZE) {
    this.size = size;
    this.tiles = new Uint8Array(size * size);
    this.resources = new Uint8Array(size * size);
    this.generate();
  }

  getIndex(x, y) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return -1;
    return y * this.size + x;
  }

  getTile(x, y) {
    const idx = this.getIndex(x, y);
    return idx !== -1 ? this.tiles[idx] : null;
  }

  getResource(x, y) {
    const idx = this.getIndex(x, y);
    return idx !== -1 ? this.resources[idx] : RESOURCE_TYPES.NONE;
  }

  setResource(x, y, res) {
    const idx = this.getIndex(x, y);
    if (idx !== -1) {
      this.resources[idx] = res;
    }
  }

  generate() {
    // Generování pouště s centrální a rozptýlenými oázami
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const idx = y * this.size + x;
        const distFromCastle = getDistance(x, y, CASTLE_START_X, CASTLE_START_Y);

        // Pseudonáhodný šum pro duny a terén
        const duneNoise = Math.sin(x * 0.15) * Math.cos(y * 0.15) + Math.sin(x * 0.05 + y * 0.05);
        const rand = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;

        // Centrální oáza kolem hradu (poloměr 18 bloků)
        if (distFromCastle < 18) {
          if (distFromCastle < 12) {
            // Bezprostřední okolí hradu a ohniště je ušlapaný písek a oázová tráva
            this.tiles[idx] = rand > 0.4 ? TILE_TYPES.OASIS_GRASS : TILE_TYPES.DESERT_SAND_1;
          } else {
            this.tiles[idx] = rand > 0.3 ? TILE_TYPES.OASIS_GRASS : TILE_TYPES.DESERT_SAND_1;
          }

          // Malé oázové jezírko kousek od hradu
          const distToPond = getDistance(x, y, CASTLE_START_X + 9, CASTLE_START_Y - 7);
          if (distToPond < 3.2) {
            this.tiles[idx] = TILE_TYPES.OASIS_WATER;
          }

          // V oáze rostou palmy (mimo čisté prostranství hradu s rádiem 7)
          if (distFromCastle > 6 && this.tiles[idx] !== TILE_TYPES.OASIS_WATER) {
            if (rand > 0.72) {
              this.resources[idx] = RESOURCE_TYPES.PALM_TREE;
            }
          }
        } 
        // Vnější poušť
        else {
          // Menší sekundární oázy v poušti
          const secOasis = Math.sin(x * 0.06) * Math.cos(y * 0.06);
          if (secOasis > 0.6) {
            this.tiles[idx] = TILE_TYPES.OASIS_GRASS;
            if (rand > 0.8) {
              this.resources[idx] = RESOURCE_TYPES.PALM_TREE;
            }
          } else if (duneNoise > 0.5) {
            this.tiles[idx] = TILE_TYPES.DESERT_SAND_2; // Větrné duny
          } else if (rand > 0.82) {
            this.tiles[idx] = TILE_TYPES.CRACKED_CLAY;  // Vyprahlá hlína
          } else {
            this.tiles[idx] = TILE_TYPES.DESERT_SAND_1; // Běžný písek
          }

          // Pískovcové masivy v poušti (zdroj pro kamenolom)
          const rockNoise = Math.sin(x * 0.08 + 15) + Math.cos(y * 0.08 + 20);
          if (rockNoise > 1.35 && rand > 0.45 && this.tiles[idx] !== TILE_TYPES.OASIS_WATER) {
            this.resources[idx] = RESOURCE_TYPES.SANDSTONE_ROCK;
          }
        }
      }
    }
  }
}
