const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../src/game');
const { Tree } = require('../src/tree');
const { SIDE, STATE, POWER_UP, ENERGY } = require('../src/constants');
const progression = require('../src/progression');

function game() {
  const platform = { createImage: () => ({}), getStorageSync: () => 0,
    setStorageSync: () => {} };
  const instance = new Game({ getContext: () => ({}) }, platform);
  instance.renderer.setViewport(750, 1334, 1);
  instance.renderer.render = () => {};
  instance.requestNextFrame = () => {};
  instance.lastFrameAt = 1000;
  return instance;
}

test('30 points per level with bounded difficulty', () => {
  assert.equal(progression.levelForScore(29), 1);
  assert.equal(progression.levelForScore(30), 2);
  assert.equal(progression.levelForScore(60), 3);
  assert.equal(progression.energyDrain(1000), ENERGY.maxDrainPerSecond);
  assert.ok(progression.emptyChance(1000) > 0);
});

test('queue preserves one hazard per row, no adjacent same-side branches, items only on empty rows', () => {
  let seed = 123;
  const tree = new Tree(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
  for (let i = 0; i < 10000; i++) {
    tree.chop(0.12, () => POWER_UP.SHIELD);
    assert.equal(tree.rows.length, 4);
    tree.rows.forEach((side, index) => {
      assert.ok(Object.values(SIDE).includes(side));
      if (side !== SIDE.NONE) {
        assert.equal(tree.powerUps[index], POWER_UP.NONE);
        if (index > 0) assert.notEqual(side, tree.rows[index - 1]);
      }
    });
  }
});

test('fruit fills energy and freezes exactly three seconds', () => {
  const g = game();
  g.energy = 1;
  g.activatePowerUp(POWER_UP.ENERGY_FRUIT);
  assert.equal(g.energy, ENERGY.max);
  g.state = STATE.PLAYING;
  for (let i = 1; i <= 60; i++) g.loop(1000 + i * 50);
  assert.ok(g.energy > 99.999);
  g.loop(4050);
  assert.ok(g.energy < 100);
});

test('shield absorbs once, berserk takes priority and expiry restores collisions', () => {
  const g = game();
  g.activatePowerUp(POWER_UP.SHIELD);
  g.activatePowerUp(POWER_UP.BERSERK_AXE);
  g.tree.rows[0] = SIDE.LEFT;
  g.handleTap(0);
  assert.equal(g.shieldCharges, 1);
  assert.equal(g.debris.length, 1);
  g.updatePowerUpEffects(3);
  g.tree.rows[0] = SIDE.LEFT;
  g.handleTap(0);
  assert.equal(g.shieldCharges, 0);
  assert.equal(g.state, STATE.PLAYING);
  g.tree.rows[0] = SIDE.LEFT;
  g.handleTap(0);
  assert.equal(g.state, STATE.GAME_OVER);
});

test('one tap restarts, clearing timed effects and scoring the first chop', () => {
  const g = game();
  g.score = 42;
  g.endGame();
  assert.equal(g.highScore, 42);
  g.handleTap(700);
  assert.equal(g.state, STATE.PLAYING);
  assert.equal(g.score, 1);
  assert.equal(g.playerSide, SIDE.RIGHT);
  assert.equal(g.berserkRemaining, 0);
  assert.equal(g.shieldCharges, 0);
  assert.equal(g.debris.length, 0);
});

test('combo expires without ending the round; pause does not drain effects or energy', () => {
  const g = game();
  g.handleTap(0);
  g.activatePowerUp(POWER_UP.BERSERK_AXE);
  g.paused = true;
  g.loop(1050);
  assert.equal(g.berserkRemaining, 3);
  assert.equal(g.energy, 100);
  g.paused = false;
  for (let i = 1; i <= 19; i++) g.loop(1050 + i * 50);
  assert.equal(g.combo, 0);
  assert.equal(g.multiplier, 1);
  assert.equal(g.state, STATE.PLAYING);
});

test('sound control consumes input without chopping', () => {
  const g = game();
  g.handleTap(630, 1300);
  assert.equal(g.audio.enabled, false);
  assert.equal(g.state, STATE.READY);
  assert.equal(g.score, 0);
});
