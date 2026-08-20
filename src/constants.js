const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;

const STATE = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  GAME_OVER: 'game-over'
});

const SIDE = Object.freeze({
  LEFT: 'left', RIGHT: 'right', NONE: 'none' });

const TREE = Object.freeze({
  x: DESIGN_WIDTH / 2,
  width: 104,
  // The trunk finishes behind the grass island instead of continuing below it.
  trunkBottom: 1090,
  branchWidth: 250,
  branchHeight: 160,
  // Pull each branch root into the trunk so the two assets visually connect.
  branchTrunkOverlap: -23,
  // Row 0 is the only danger row. Its bottom aligns with the player's head;
  // the next row remains separated by a visible gap.
  // Keep the branch rows slightly higher than the character. Row 0 leaves a
  // small gap above the head, while row spacing remains larger than the
  // character's height for an unambiguous visual rhythm.
  branchStep: 220,
  branchOffsetY: 295,
  playerY: 1040,
  // Four rows fit fully in the playfield. A fifth row would start at y=-135,
  // which is why it appeared partly in the black area above the canvas.
  visibleRows: 4
});

const PLAYER = Object.freeze({
  // The source images include transparent margins. Cropping at draw time
  // keeps the visible body aligned with the gameplay position.
  sourceX: 20,
  sourceY: 160,
  sourceWidth: 1010,
  sourceHeight: 1300,
  width: 208,
  height: 267,
  centerOffset: 155,
  topOffset: 120
});

const GROUND = Object.freeze({
  // Each piece keeps its own source aspect ratio. They meet under the trunk
  // with only a small overlap, forming one balanced island.
  topY: 1070,
  leftX: 40,
  leftY: 1080,
  leftWidth: 280,
  leftHeight: 190,
  rightX: 300,
  rightY: 1080,
  rightWidth: 390,
  rightHeight: 190,
  stonesX: 300,
  stonesY: 1055,
  stonesWidth: 150,
  stonesHeight: 72
});

const BACKGROUND = Object.freeze({
  // Shift the forest strip down so its lower edge runs behind the grass
  // island. Ground then cleanly masks the join without a visible seam.
  forestOffsetY: 35
});

const CLOUDS = Object.freeze({
  width: 950,
  height: 256,
  y: 100,
  speed: 32
});

const ENERGY = Object.freeze({
  max: 100,
  drainPerSecond: 9,
  restorePerChop: 15,
  warningThreshold: 0.3,
  dangerThreshold: 0.15
});

const LEVEL = Object.freeze({
  scorePerLevel: 30,
  // Every level removes some breathing room, capped so the player still has
  // readable openings instead of a wall of branches.
  initialEmptyChance: 0.4,
  emptyChanceDecrease: 0.035,
  minimumEmptyChance: 0.12,
  // Energy pressure rises with the level, independently of branch safety.
  energyDrainIncrease: 1.2,
  levelUpAnimationDuration: 0.8
});

const COMBO = Object.freeze({
  multiplierStep: 5,
  maxMultiplier: 4,
  scorePulseDuration: 0.18
});

module.exports = {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  STATE,
  SIDE,
  TREE,
  PLAYER,
  GROUND,
  BACKGROUND,
  CLOUDS,
  ENERGY,
  LEVEL,
  COMBO
};
