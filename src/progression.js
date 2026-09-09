const { LEVEL, ENERGY } = require('./constants');

const levelForScore = (score) => Math.floor(score / LEVEL.scorePerLevel) + 1;
const emptyChance = (level) => Math.max(
  LEVEL.minimumEmptyChance, LEVEL.initialEmptyChance - (level - 1) * LEVEL.emptyChanceDecrease
);
const energyDrain = (level) => Math.min(
  ENERGY.maxDrainPerSecond, ENERGY.drainPerSecond + (level - 1) * LEVEL.energyDrainIncrease
);

module.exports = { levelForScore, emptyChance, energyDrain };
