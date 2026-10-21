export const UNIT_TYPES = {
  SWORDSMAN: 'swordsman',
  ARCHER: 'archer',
  VILLAGER: 'villager'
};

export const UNIT_CONFIG = {
  [UNIT_TYPES.SWORDSMAN]: {
    name: 'Královský pěšák',
    icon: '⚔️',
    description: 'Statný bojovník s mečem, kroužkovým brněním a velkým štítem.',
    cost: { citizens: 1, food: 30, wood: 15, stone: 0 },
    hp: 140,
    speed: 1.8,
    trainTime: 4.0,
    range: 1.2,
    voice: 'Meče jsou připraveny k boji, pane!'
  },
  [UNIT_TYPES.ARCHER]: {
    name: 'Lučištník',
    icon: '🏹',
    description: 'Hbitý střelec s tisovým dlouhým lukem, schopný zasáhnout nepřítele na velkou vzdálenost.',
    cost: { citizens: 1, food: 40, wood: 35, stone: 0 },
    hp: 80,
    speed: 2.1,
    trainTime: 5.0,
    range: 5.5,
    voice: 'Lukostřelci čekají na vaše rozkazy!'
  },
  [UNIT_TYPES.VILLAGER]: {
    name: 'Poddaný u ohniště',
    icon: '👤',
    description: 'Věrný poddaný království. Odpočívá u hradního ohniště a čeká na přidělení práce v oáze či povolání do zbraně.',
    cost: { citizens: 1, food: 0, wood: 0, stone: 0 },
    hp: 50,
    speed: 1.5,
    range: 1.0,
    voice: 'K vašim službám, můj pane!'
  }
};

export class Unit {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.config = UNIT_CONFIG[type];
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.speed = this.config.speed;
    this.selected = false;
    this.angle = 0;
  }

  moveTo(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
  }

  update(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.05) {
      const step = Math.min(dist, this.speed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.angle = Math.atan2(dy, dx);
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
    }
  }
}
