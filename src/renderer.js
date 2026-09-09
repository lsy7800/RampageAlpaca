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
  ENERGY,
  POWER_UP
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
      alpacaFrame2: this.loadImage('assets/characters/alpaca_2.png'),
      alpacaBearFrame1: this.loadImage('assets/characters/alpaca_bear_1.png'),
      alpacaBearFrame2: this.loadImage('assets/characters/alpaca_bear_2.png')
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
    this.drawTree(ctx, model.rows, model.powerUps);
    this.drawClouds(ctx, model.cloudOffset);
    this.drawGround(ctx);
    this.drawDrop(ctx, model.drop);
    this.drawBerserkAtmosphere(ctx, model.berserkRemaining, model.berserkDuration);
    this.drawPlayer(ctx, model.playerSide, model.state, model.chopFrame, model.berserkRemaining);
    this.drawCombatEffects(ctx, model);
    if (isShaking) ctx.restore();
    this.drawHud(ctx, model);
    this.drawLevelUpNotice(ctx, model.levelUpLevel, model.levelUpProgress);
    this.drawPowerUpNotice(
      ctx,
      model.powerUpNotice,
      model.powerUpNoticeProgress,
      model.berserkRemaining
    );

    if (model.state === STATE.READY) this.drawReady(ctx);
    if (model.state === STATE.GAME_OVER) this.drawGameOver(ctx, model);
    ctx.textAlign = 'center';
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#315746';
    ctx.fillText(model.audioEnabled ? '声音：开' : '声音：关', 635, 1305);
    if (model.leaderboard) model.leaderboard.draw(ctx);
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

  drawTree(ctx, rows, powerUps = []) {
    // The trunk is the base layer; branches are drawn afterwards so they sit
    // visibly on top of it at each junction.
    ctx.drawImage(this.images.trunk, TREE.x - TREE.width / 2, 0, TREE.width, TREE.trunkBottom);
    rows.forEach((side, index) => {
      if (side === SIDE.NONE) return;
      // Row 0 is drawn at the collision line; each following row is separated
      // by branchStep so it cannot visually overlap the danger row.
      const y = TREE.playerY - index * TREE.branchStep - TREE.branchOffsetY;
      const width = TREE.branchWidth;
      const height = TREE.branchHeight;
      ctx.save();
      if (side === SIDE.LEFT) {
        ctx.translate(TREE.x + TREE.branchTrunkOverlap, y);
        ctx.scale(-1, 1);
        ctx.drawImage(this.images.branch, 0, 0, width, height);
      } else {
        ctx.drawImage(this.images.branch, TREE.x - TREE.branchTrunkOverlap, y, width, height);
      }
      ctx.restore();
    });
    powerUps.forEach((powerUp, index) => {
      if (powerUp === POWER_UP.NONE) return;
      const y = TREE.playerY - index * TREE.branchStep - TREE.branchOffsetY + 54;
      this.drawPowerUpIcon(ctx, powerUp, TREE.x, y);
    });
  }

  drawPowerUpIcon(ctx, powerUp, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255, 238, 145, 0.75)';
    ctx.beginPath();
    ctx.arc(0, 0, 37, 0, Math.PI * 2);
    ctx.fill();
    if (powerUp === POWER_UP.ENERGY_FRUIT) {
      ctx.fillStyle = '#ef7658';
      ctx.beginPath();
      ctx.arc(0, 6, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f8d47';
      ctx.beginPath();
      ctx.ellipse(10, -18, 12, 6, -0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerUp === POWER_UP.SHIELD) {
      ctx.fillStyle = '#5b9ccd';
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(24, -16);
      ctx.lineTo(18, 22);
      ctx.lineTo(0, 33);
      ctx.lineTo(-18, 22);
      ctx.lineTo(-24, -16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e9f8ff';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#724e34';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-16, 22);
      ctx.lineTo(15, -18);
      ctx.stroke();
      ctx.fillStyle = '#e3edf0';
      ctx.fillRect(8, -30, 28, 18);
    }
    ctx.restore();
  }

  drawDrop(ctx, item) {
    if (!item) return;
    const x = TREE.x + (item.side === SIDE.LEFT ? -1 : 1) * PLAYER.centerOffset;
    const progress = Math.min(1, item.age / POWER_UP.fallDuration);
    const targetY = TREE.playerY - PLAYER.topOffset - 40;
    ctx.save();
    ctx.strokeStyle = '#f5b743';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, targetY + 42, 38, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#76572f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(progress < 1 ? '道具落点' : '同侧拾取', x, targetY + 73);
    if (item.age > POWER_UP.fallDuration + 1.3) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(item.age * 20);
    }
    this.drawPowerUpIcon(ctx, item.type, x, 310 + (targetY - 310) * progress);
    ctx.restore();
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

  drawPlayer(ctx, side, state, chopFrame, berserkRemaining = 0) {
    const isBerserk = berserkRemaining > 0 && state === STATE.PLAYING;
    const image = state === STATE.GAME_OVER || chopFrame === 1
      ? this.images.alpacaFrame2
      : this.images.alpacaFrame1;
    const centerX = side === SIDE.LEFT ? TREE.x - PLAYER.centerOffset : TREE.x + PLAYER.centerOffset;
    const y = TREE.playerY - PLAYER.topOffset;
    ctx.save();
    ctx.translate(centerX, isBerserk ? PLAYER.berserkBottomY : y + PLAYER.height / 2);
    // The two animation frames face left by default. Mirror on the right side
    // so the character's placement matches the intended left/right poses.
    if (side === SIDE.RIGHT) ctx.scale(-1, 1);
    if (state === STATE.GAME_OVER) ctx.rotate(side === SIDE.LEFT ? -0.28 : 0.28);
    if (isBerserk) {
      const berserkImage = chopFrame === 1
        ? this.images.alpacaBearFrame2
        : this.images.alpacaBearFrame1;
      ctx.drawImage(
        berserkImage,
        -PLAYER.berserkAlpacaAnchorX,
        -PLAYER.berserkHeight,
        PLAYER.berserkWidth,
        PLAYER.berserkHeight
      );
      ctx.restore();
      return;
    }
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

  drawBerserkAtmosphere(ctx, remaining = 0, duration = POWER_UP.berserkDuration) {
    if (remaining <= 0) return;
    const progress = Math.max(0, Math.min(1, remaining / duration));
    const pulse = 0.5 + Math.sin(remaining * 18) * 0.5;
    // A light, warm wash makes the whole scene feel dangerous without hiding
    // branches or changing their collision readability.
    ctx.save();
    ctx.fillStyle = `rgba(240, 103, 39, ${0.055 + pulse * 0.035})`;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    ctx.strokeStyle = `rgba(255, 198, 70, ${0.18 + progress * 0.12})`;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, DESIGN_WIDTH - 16, DESIGN_HEIGHT - 16);
    ctx.restore();
  }

  drawHud(ctx, model) {
    this.drawEnergyBar(ctx, model.energy, model.energyFreezeRemaining);
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
    ctx.fillText(`Lv.${model.level}`, 650, 80);
    if (model.combo > 1) {
      ctx.fillStyle = model.multiplier > 1 ? '#d77a40' : '#57713e';
      ctx.font = 'bold 25px sans-serif';
      const multiplierLabel = model.multiplier > 1 ? ` ×${model.multiplier}` : '';
      ctx.fillText(`${model.combo} 连击${multiplierLabel}`, DESIGN_WIDTH / 2, 204);
    }
    this.drawPowerUpStatus(ctx, model);
  }

  drawPowerUpStatus(ctx, model) {
    const labels = [];
    if (model.energyFreezeRemaining > 0) labels.push(`体力冻结 ${model.energyFreezeRemaining.toFixed(1)}s`);
    if (model.shieldCharges > 0) labels.push('护盾 ×1');
    this.drawBerserkTimer(ctx, model.berserkRemaining, model.berserkDuration);
    if (!labels.length) return;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(labels.join('  '), DESIGN_WIDTH - 34, 1230);
  }

  drawBerserkTimer(ctx, remaining = 0, duration = POWER_UP.berserkDuration) {
    if (remaining <= 0) return;
    const ratio = Math.max(0, Math.min(1, remaining / duration));
    const warning = remaining < 1;
    const pulse = 0.5 + Math.sin(remaining * 20) * 0.5;
    const x = 118;
    const y = 350;
    const width = 514;
    const height = 68;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = warning ? `rgba(175, 43, 26, ${0.88 + pulse * 0.12})` : 'rgba(120, 47, 28, 0.9)';
    this.roundRect(ctx, x, y, width, height, 22);
    ctx.fill();
    ctx.fillStyle = '#ffd85c';
    this.roundRect(ctx, x + 6, y + 42, (width - 12) * ratio, 16, 8);
    ctx.fill();
    ctx.strokeStyle = '#fff0ad';
    ctx.lineWidth = 3;
    this.roundRect(ctx, x, y, width, height, 22);
    ctx.stroke();
    const scale = warning ? 1 + pulse * 0.09 : 1;
    ctx.translate(DESIGN_WIDTH / 2, y + 30);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff8dd';
    ctx.font = 'bold 31px sans-serif';
    ctx.fillText(`⚡ 狂暴斧  ${remaining.toFixed(1)} 秒`, 0, 0);
    ctx.restore();
  }

  drawPowerUpNotice(ctx, message, progress, berserkRemaining = 0) {
    if (!message || progress <= 0) return;
    const baseY = berserkRemaining > 0 ? 460 : 350;
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8db';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(message, DESIGN_WIDTH / 2, baseY - (1 - progress) * 16);
    ctx.restore();
  }

  drawEnergyBar(ctx, energy, frozen = 0) {
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
      ctx.fillStyle = frozen > 0 ? '#76d5ee' : color;
      this.roundRect(ctx, x + inset + 4, y + inset + 4, (width - 20) * ratio, height - 20, 7);
      ctx.fill();
    }
    if (frozen > 0) {
      ctx.strokeStyle = '#bbf5ff';
      ctx.lineWidth = 4;
      this.roundRect(ctx, x - 3, y - 3, width + 6, height + 6, 12);
      ctx.stroke();
    }
  }

  drawCombatEffects(ctx, model) {
    const x = TREE.x + (model.playerSide === SIDE.LEFT ? -1 : 1) * PLAYER.centerOffset;
    const y = TREE.playerY - PLAYER.topOffset + PLAYER.height / 2;
    ctx.save();
    if (model.shieldCharges > 0 || model.shieldBreakRemaining > 0) {
      const breaking = model.shieldBreakRemaining > 0;
      const expansion = breaking ? (0.5 - model.shieldBreakRemaining) * 100 : 0;
      ctx.globalAlpha = breaking ? model.shieldBreakRemaining * 2 : 0.65;
      ctx.fillStyle = 'rgba(95, 191, 255, 0.18)';
      ctx.strokeStyle = '#98eaff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(x, y, 112 + expansion, 142 + expansion, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    (model.debris || []).forEach((piece) => {
      const direction = piece.side === SIDE.LEFT ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - piece.age / 0.65);
      ctx.translate(TREE.x + direction * (130 + piece.age * 600),
        TREE.playerY - TREE.branchOffsetY + piece.age * piece.age * 500);
      ctx.rotate(direction * piece.age * 9);
      ctx.scale(direction, 1);
      ctx.drawImage(this.images.branch, -125, -80, 250, 160);
      ctx.restore();
    });
  }

  drawLevelUpNotice(ctx, level, progress) {
    if (!level || progress <= 0 || progress >= 1) return;
    const rise = progress * 42;
    const scale = 0.7 + Math.sin(Math.min(progress, 0.55) / 0.55 * Math.PI / 2) * 0.55;
    const alpha = progress < 0.7 ? 1 : (1 - progress) / 0.3;
    const y = 280 - rise;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(DESIGN_WIDTH / 2, y);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8db';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('等级提升！', 0, 0);
    ctx.fillStyle = '#d77a40';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`Lv.${level}`, 0, 43);
    ctx.restore();
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
    ctx.fillStyle = '#e2eccb';
    ctx.fillRect(150, 800, 450, 90);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#315746';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('好友排行榜', 375, 856);
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
