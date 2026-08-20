const {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  STATE,
  SIDE,
  TREE,
  PLAYER,
  GROUND,
  BACKGROUND,
  CLOUDS,
  ENERGY
} = require('./constants');

class Renderer {
  constructor(canvas, context, platform) {
    this.canvas = canvas;
    this.ctx = context;
    this.platform = platform;
    this.images = {
      trees: this.loadImage('assets/backgrounds/bg-trees.png'),
      clouds: this.loadImage('assets/backgrounds/bg_clouds.png'),
      trunk: this.loadImage('assets/tree/trunk.png'),
      branch: this.loadImage('assets/tree/branch.png'),
      groundLeft: this.loadImage('assets/backgrounds/ground-left.png'),
      groundRight: this.loadImage('assets/backgrounds/ground-right.png'),
      stones: this.loadImage('assets/backgrounds/stones.png'),
      alpacaFrame1: this.loadImage('assets/characters/alpaca_1.png'),
      alpacaFrame2: this.loadImage('assets/characters/alpaca_2.png')
    };
  }

  loadImage(path) {
    // In the WeChat mini-game runtime images are created by wx, not by the
    // Canvas instance returned from wx.createCanvas().
    const image = this.platform.createImage();
    image.src = path;
    return image;
  }

  setViewport(width, height, pixelRatio) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.pixelRatio = pixelRatio;
    this.scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    this.offsetX = (width - DESIGN_WIDTH * this.scale) / 2;
    this.offsetY = (height - DESIGN_HEIGHT * this.scale) / 2;
  }

  render(model) {
    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    const isShaking = model.isShaking === true;
    const shakeX = isShaking && typeof model.shakeX === 'number' ? model.shakeX : 0;
    const shakeY = isShaking && typeof model.shakeY === 'number' ? model.shakeY : 0;
    if (isShaking) {
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    this.drawBackground(ctx);
    this.drawTree(ctx, model.rows);
    this.drawClouds(ctx, model.cloudOffset);
    this.drawGround(ctx);
    this.drawPlayer(ctx, model.playerSide, model.state, model.chopFrame);
    this.drawHud(ctx, model);

    if (model.state === STATE.READY) this.drawReady(ctx);
    if (model.state === STATE.GAME_OVER) this.drawGameOver(ctx, model);
    if (isShaking) ctx.restore();
  }

  drawBackground(ctx) {
    // A warm solid sky lets the pale-blue repeating forest sit behind the
    // gameplay tree, matching the supplied layout composition.
    ctx.fillStyle = '#f1e6d7';
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    ctx.globalAlpha = 0.9;
    // Tile the supplied forest only above the grass horizon. The final tile is
    // source-cropped rather than stretched, so background trees never pass
    // through the ground.
    const forestHeight = DESIGN_WIDTH / 3;
    for (let y = -forestHeight + BACKGROUND.forestOffsetY; y < GROUND.topY; y += forestHeight) {
      const drawY = Math.max(0, y);
      const drawBottom = Math.min(GROUND.topY + BACKGROUND.forestOffsetY, y + forestHeight);
      const height = drawBottom - drawY;
      if (height <= 0) continue;
      const sourceY = Math.max(0, -y) * (280 / forestHeight);
      const sourceHeight = height * (280 / forestHeight);
      ctx.drawImage(
        this.images.trees,
        0,
        sourceY,
        840,
        sourceHeight,
        0,
        drawY,
        DESIGN_WIDTH,
        height
      );
    }
    ctx.globalAlpha = 1;
  }

  drawTree(ctx, rows) {
    rows.forEach((side, index) => {
      if (side === SIDE.NONE) return;
      // Row 0 is drawn at the collision line; each following row is separated
      // by branchStep so it cannot visually overlap the danger row.
      const y = TREE.playerY - index * TREE.branchStep - TREE.branchOffsetY;
      const width = TREE.branchWidth;
      const height = TREE.branchHeight;
      ctx.save();
      if (side === SIDE.LEFT) {
        ctx.translate(TREE.x, y);
        ctx.scale(-1, 1);
        ctx.drawImage(this.images.branch, 0, 0, width, height);
      } else {
        ctx.drawImage(this.images.branch, TREE.x, y, width, height);
      }
      ctx.restore();
    });
    // The trunk is the foreground layer at every branch junction, hiding the
    // branch roots and making branches appear to grow out from behind it.
    ctx.drawImage(this.images.trunk, TREE.x - TREE.width / 2, 0, TREE.width, TREE.trunkBottom);
  }

  drawClouds(ctx, offset = 0) {
    // Draw two copies so the cloud strip can loop to the right without a gap.
    const x = offset % CLOUDS.width;
    ctx.drawImage(this.images.clouds, x - CLOUDS.width, CLOUDS.y, CLOUDS.width, CLOUDS.height);
    ctx.drawImage(this.images.clouds, x, CLOUDS.y, CLOUDS.width, CLOUDS.height);
  }

  drawGround(ctx) {
    // Draw the island after the trunk so its grass covers the root, then put
    // the stones on top at the base of the central tree.
    ctx.drawImage(
      this.images.groundLeft,
      GROUND.leftX,
      GROUND.leftY,
      GROUND.leftWidth,
      GROUND.leftHeight
    );
    ctx.drawImage(
      this.images.groundRight,
      GROUND.rightX,
      GROUND.rightY,
      GROUND.rightWidth,
      GROUND.rightHeight
    );
    ctx.drawImage(
      this.images.stones,
      GROUND.stonesX,
      GROUND.stonesY,
      GROUND.stonesWidth,
      GROUND.stonesHeight
    );
  }

  drawPlayer(ctx, side, state, chopFrame) {
    const image = state === STATE.GAME_OVER || chopFrame === 1
      ? this.images.alpacaFrame2
      : this.images.alpacaFrame1;
    const centerX = side === SIDE.LEFT ? TREE.x - PLAYER.centerOffset : TREE.x + PLAYER.centerOffset;
    const y = TREE.playerY - PLAYER.topOffset;
    ctx.save();
    ctx.translate(centerX, y + PLAYER.height / 2);
    // The two animation frames face left by default. Mirror on the right side
    // so the character's placement matches the intended left/right poses.
    if (side === SIDE.RIGHT) ctx.scale(-1, 1);
    if (state === STATE.GAME_OVER) ctx.rotate(side === SIDE.LEFT ? -0.28 : 0.28);
    ctx.drawImage(
      image,
      PLAYER.sourceX,
      PLAYER.sourceY,
      PLAYER.sourceWidth,
      PLAYER.sourceHeight,
      -PLAYER.width / 2,
      -PLAYER.height / 2,
      PLAYER.width,
      PLAYER.height
    );
    ctx.restore();
  }

  drawHud(ctx, model) {
    this.drawEnergyBar(ctx, model.energy);
    ctx.textAlign = 'center';
    const pulse = model.scorePulse || 0;
    const scoreScale = 1 + pulse * 0.22;
    const scoreY = 126 - pulse * 14;
    ctx.save();
    ctx.translate(DESIGN_WIDTH / 2, scoreY);
    ctx.scale(scoreScale, scoreScale);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 86px sans-serif';
    ctx.fillText(String(model.score), 0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(38, 75, 54, 0.7)';
    ctx.font = '28px sans-serif';
    ctx.fillText(`最高分 ${model.highScore}`, DESIGN_WIDTH / 2, 168);
    if (model.combo > 1) {
      ctx.fillStyle = model.multiplier > 1 ? '#d77a40' : '#57713e';
      ctx.font = 'bold 25px sans-serif';
      const multiplierLabel = model.multiplier > 1 ? ` ×${model.multiplier}` : '';
      ctx.fillText(`${model.combo} 连击${multiplierLabel}`, DESIGN_WIDTH / 2, 204);
    }
  }

  drawEnergyBar(ctx, energy) {
    const x = 46;
    const y = 48;
    const width = 232;
    const height = 38;
    const inset = 6;
    const ratio = Math.max(0, Math.min(1, energy / ENERGY.max));
    const color = ratio <= ENERGY.dangerThreshold
      ? '#e6674f'
      : ratio <= ENERGY.warningThreshold
        ? '#efa940'
        : '#82b14a';

    ctx.fillStyle = '#76572f';
    this.roundRect(ctx, x, y, width, height, 10);
    ctx.fill();
    ctx.fillStyle = '#fff9e8';
    this.roundRect(ctx, x + 4, y + 4, width - 8, height - 8, 8);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = color;
      this.roundRect(ctx, x + inset + 4, y + inset + 4, (width - 20) * ratio, height - 20, 7);
      ctx.fill();
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  drawReady(ctx) {
    this.drawPanel(ctx, DESIGN_HEIGHT - 230, '点击左右屏幕', '砍树并躲开落下的树枝');
  }

  drawGameOver(ctx, model) {
    ctx.fillStyle = 'rgba(22, 48, 38, 0.52)';
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.drawPanel(ctx, DESIGN_HEIGHT / 2 - 68, '游戏结束', `本局 ${model.score} 分 · 点击屏幕重新开始`);
  }

  drawPanel(ctx, y, title, subtitle) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(76, y, DESIGN_WIDTH - 152, 158);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#315746';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(title, DESIGN_WIDTH / 2, y + 62);
    ctx.font = '24px sans-serif';
    ctx.fillText(subtitle, DESIGN_WIDTH / 2, y + 109);
  }
}

module.exports = { Renderer };
