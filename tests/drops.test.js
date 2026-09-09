const test = require('node:test');
const assert = require('node:assert/strict');
const { Drops } = require('../src/drops');
const { SIDE, POWER_UP } = require('../src/constants');

test('spawns on safe side, limits active count and unlocks at score threshold', () => {
  const drops = new Drops(() => 0);
  drops.afterChop(0, SIDE.LEFT);
  assert.equal(drops.item, null);
  drops.afterChop(15, SIDE.LEFT);
  assert.equal(drops.item.side, SIDE.RIGHT);
  const item = drops.item;
  for (let i = 0; i < 20; i++) drops.afterChop(100, SIDE.NONE);
  assert.equal(drops.item, item);
});
test('all three types can spawn', () => {
  for (const [index, type] of [POWER_UP.ENERGY_FRUIT, POWER_UP.SHIELD, POWER_UP.BERSERK_AXE].entries()) {
    const values = [0, (index + 0.1) / 3];
    const drops = new Drops(() => values.shift());
    drops.afterChop(15, SIDE.LEFT);
    assert.equal(drops.item.type, type);
  }
});
test('cannot collect in flight; landed reward collected once on same side', () => {
  const drops = new Drops(() => 0);
  drops.afterChop(15, SIDE.LEFT);
  assert.equal(drops.update(1, SIDE.RIGHT, SIDE.NONE), POWER_UP.NONE);
  assert.equal(drops.update(0.81, SIDE.RIGHT, SIDE.NONE), POWER_UP.ENERGY_FRUIT);
  assert.equal(drops.update(0, SIDE.RIGHT, SIDE.NONE), POWER_UP.NONE);
});
test('expires on ground and cancels unsafe crossing without granting reward', () => {
  const drops = new Drops(() => 0);
  drops.afterChop(15, SIDE.LEFT);
  assert.equal(drops.update(3.81, SIDE.LEFT, SIDE.NONE), POWER_UP.NONE);
  assert.equal(drops.item, null);
  drops.reset();
  drops.afterChop(15, SIDE.LEFT);
  assert.equal(drops.update(0, SIDE.LEFT, SIDE.RIGHT), POWER_UP.NONE);
  assert.equal(drops.item, null);
});
