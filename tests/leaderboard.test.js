const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { Leaderboard } = require('../src/leaderboard');

test('missing open data context is optional; show and close still work', () => {
  const board = new Leaderboard({});
  board.sync(5); board.show(10);
  assert.equal(board.open, true);
  board.close();
  assert.equal(board.open, false);
});

test('shared buffer matches physical panel size while display stays in design coordinates', () => {
  const messages = [];
  const canvas = {};
  const board = new Leaderboard({ getOpenDataContext: () => ({
    canvas, postMessage: (message) => messages.push(message)
  }) });
  board.resize(0.5, 3);
  assert.equal(canvas.width, 1020);
  assert.equal(canvas.height, 1410);
  board.show(10);
  assert.equal(messages.at(-1).width, 1020);
  board.resize(0.6, 2);
  assert.equal(canvas.width, 816);
  assert.equal(canvas.height, 1128);
});

function domain(cloud, fail = false) {
  let handler, timer;
  const writes = [];
  const wx = {
    getSharedCanvas: () => ({ getContext: () => ({}) }),
    onMessage: (fn) => { handler = fn; },
    getUserCloudStorage: ({ success, fail: onFail }) => {
      if (fail) onFail();
      else success({ KVDataList: [{ key: 'rampage-alpaca-season-1', value: String(cloud) }] });
    },
    setUserCloudStorage: ({ KVDataList, success }) => { writes.push(KVDataList[0].value); success(); }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../open-data/index.js'), 'utf8'),
    { wx, setTimeout: (fn) => { timer = fn; return 1; } });
  return { send: (score) => handler({ type: 'sync', score }), writes,
    recover: () => { fail = false; timer(); } };
}
test('cloud maximum is never overwritten with a lower local record', () => {
  const d = domain(100);
  d.send(20);
  assert.deepEqual(d.writes, []);
  d.send(110);
  assert.deepEqual(d.writes, ['110']);
});
test('failed synchronization retries the pending record', () => {
  const d = domain(0, true);
  d.send(90);
  assert.deepEqual(d.writes, []);
  d.recover();
  assert.deepEqual(d.writes, ['90']);
});
