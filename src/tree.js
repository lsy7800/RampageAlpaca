const { SIDE, TREE } = require('./constants');

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
  }

  chop() {
    const danger = this.rows.shift();
    const next = this.generateBranch();
    this.rows.push(next);
    return danger;
  }

  generateBranch() {
    // Empty rows give the player time to change sides. Keep the two rows
    // nearest the player from containing branches on both sides at once.
    const roll = this.random();
    let side = roll < 0.3 ? SIDE.LEFT : roll < 0.6 ? SIDE.RIGHT : SIDE.NONE;

    if (side !== SIDE.NONE && side === this.lastGeneratedSide) {
      side = side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
    }
    this.lastGeneratedSide = side;
    return side;
  }
}

module.exports = { Tree };
