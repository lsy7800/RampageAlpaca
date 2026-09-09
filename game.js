const { Game } = require('./src/game');

const canvas = wx.createCanvas();
const game = new Game(canvas, wx);
let lastTouchY = null;

wx.onTouchStart((event) => {
  const touch = event.touches[0];
  if (!touch) return;
  lastTouchY = touch.clientY;
  game.handleTap(touch.clientX, touch.clientY);
});

wx.onTouchMove((event) => {
  const touch = event.touches[0];
  if (!touch) return;
  if (game.leaderboard.open && lastTouchY !== null) {
    game.leaderboard.send({ type: 'scroll',
      delta: (lastTouchY - touch.clientY) / game.renderer.scale });
  }
  lastTouchY = touch.clientY;
});
wx.onTouchEnd(() => { lastTouchY = null; });
if (typeof wx.onWindowResize === 'function') wx.onWindowResize(() => game.resize());

wx.onHide(() => { game.paused = true; game.audio.suspend(); });
wx.onShow(() => {
  game.paused = false;
  game.lastFrameAt = 0;
  game.leaderboard.sync(game.highScore);
  if (game.state === 'playing') game.audio.startMusic();
});

game.start();
