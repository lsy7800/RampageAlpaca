const { SIDE, TREE, POWER_UP } = require('./constants');

class Tree {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.lastGeneratedSide = SIDE.NONE;
    // Reserve the two rows nearest the player as empty at the beginning of a
    // round, so the first hazards enter the screen with readable spacing.
    this.rows = Array.from(
      { length: TREE.visibleRows },
      (_, index) => (index < 2 ? SIDE.NONE : this.generateBranch())
    );
    this.powerUps = Array.from({ length: TREE.visibleRows }, () => POWER_UP.NONE);
  }

  chop(emptyChance, createPowerUp = null) {
    const danger = this.rows.shift();
    const collectedPowerUp = this.powerUps.shift();
    const next = this.generateBranch(emptyChance);
    const incomingPowerUp = next === SIDE.NONE && typeof createPowerUp === 'function'
      ? createPowerUp()
      : POWER_UP.NONE;
    this.rows.push(next);
    this.powerUps.push(incomingPowerUp);
    return { danger, collectedPowerUp };
  }

  generateBranch(emptyChance = 0.4) {
    // Empty rows become rarer at higher levels. Consecutive non-empty rows
    // still alternate sides, so the generator never creates an unfair wall.
    const roll = this.random();
    const branchChance = (1 - emptyChance) / 2;
    let side = roll < branchChance
      ? SIDE.LEFT
      : roll < branchChance * 2
        ? SIDE.RIGHT
        : SIDE.NONE;

    if (side !== SIDE.NONE && side === this.lastGeneratedSide) {
      side = side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
    }
    this.lastGeneratedSide = side;
    return side;
  }
}

module.exports = { Tree };
