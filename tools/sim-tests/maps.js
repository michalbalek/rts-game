import { GameMap } from '../../client/js/sim/mapgen.js';
import { START_POSITIONS, RESOURCE_TYPES, TILE_TYPES } from '../../client/js/sim/constants.js';
import { assert } from './helpers.js';

export function testMaps() {
  console.log('--- Mapy ---');
  for (const type of ['desert', 'oasis', 'canyon']) {
    const t0 = Date.now();
    const map = new GameMap(12345, type);
    const ms = Date.now() - t0;
    let trees = 0, stone = 0, iron = 0, deep = 0, shallow = 0;
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.tiles[i] === TILE_TYPES.WATER_DEEP) deep++;
      if (map.tiles[i] === TILE_TYPES.WATER_SHALLOW) shallow++;
      if (map.resources[i] === RESOURCE_TYPES.TREE) trees++;
      if (map.resources[i] === RESOURCE_TYPES.STONE) stone++;
      if (map.resources[i] === RESOURCE_TYPES.IRON) iron++;
    }
    console.log(`  ${type}: ${ms} ms, stromy ${trees}, kámen ${stone}, železo ${iron}, hluboká voda ${deep}, brody ${shallow}, ložiska ${map.deposits.length}`);
    assert(map.deposits.filter(d => d.type === 'iron').length >= 2, `${type}: alespoň 2 ložiska železa`);
    assert(stone >= 25, `${type}: dostatek kamene`);

    for (let i = 0; i < START_POSITIONS.length; i++) {
      const p = START_POSITIONS[i];
      const cx = p.x + 1.5, cy = p.y + 1.5;
      let nearTrees = 0, nearStone = 0, nearIron = 0;
      for (let y = 0; y < map.size; y++) {
        for (let x = 0; x < map.size; x++) {
          if (Math.hypot(x - cx, y - cy) > 30) continue;
          const r = map.resources[y * map.size + x];
          if (r === RESOURCE_TYPES.TREE) nearTrees++;
          if (r === RESOURCE_TYPES.STONE) nearStone++;
          if (r === RESOURCE_TYPES.IRON) nearIron++;
        }
      }
      assert(nearTrees > 0 && nearStone > 0 && nearIron > 0,
        `${type} pozice ${i}: stromy ${nearTrees}, kámen ${nearStone}, železo ${nearIron} do 30 dlaždic`);
    }
  }
}
