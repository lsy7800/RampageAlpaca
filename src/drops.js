const { SIDE, POWER_UP } = require('./constants');

class Drops {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() { this.item = null; this.cooldown = 0; }
  afterChop(score, danger) {
    this.cooldown = Math.max(0, this.cooldown - 1);
    if (this.item || this.cooldown || score < POWER_UP.unlockScore) return;
    if (this.random() >= POWER_UP.spawnChance) return;
    const side = danger === SIDE.LEFT ? SIDE.RIGHT : danger === SIDE.RIGHT ? SIDE.LEFT
      : this.random() < 0.5 ? SIDE.LEFT : SIDE.RIGHT;
    const types = [POWER_UP.ENERGY_FRUIT, POWER_UP.SHIELD, POWER_UP.BERSERK_AXE, POWER_UP.BARK_CHARM];
    this.item = { type: types[Math.floor(this.random() * types.length)], side, age: 0 };
    this.cooldown = POWER_UP.minimumChopsBetweenSpawns;
  }
  update(elapsed, side, danger) {
    if (!this.item) return POWER_UP.NONE;
    this.item.age += elapsed;
    // Recheck safety as the tree changes. Never leave a reward inviting an
    // unprotected switch onto the next collision row.
    if (this.item.side !== side && danger === this.item.side) {
      this.item = null;
      return POWER_UP.NONE;
    }
    if (this.item.age >= POWER_UP.fallDuration + POWER_UP.groundDuration) {
      this.item = null;
      return POWER_UP.NONE;
    }
    if (this.item.age >= POWER_UP.fallDuration && this.item.side === side) {
      const type = this.item.type;
      this.item = null;
      return type;
    }
    return POWER_UP.NONE;
  }
}
module.exports = { Drops };
