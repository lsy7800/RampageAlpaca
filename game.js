const { Game } = require('./src/game');

const canvas = wx.createCanvas();
const game = new Game(canvas, wx);

wx.onTouchStart((event) => {
  const touch = event.touches[0];
  game.handleTap(touch.clientX, touch.clientY);
});

game.start();
