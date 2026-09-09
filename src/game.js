const { STATE, SIDE, ENERGY, CLOUDS, LEVEL, COMBO, POWER_UP } = require('./constants');
const { Tree } = require('./tree');
const { Renderer } = require('./renderer');
const { ScoreStorage } = require('./storage');
const { AudioManager } = require('./audio');
const progression = require('./progression');
const { Drops } = require('./drops');
const { Leaderboard } = require('./leaderboard');

const CHOP_FRAME_DURATION = 0.1;
const CHOP_ANIMATION_DURATION = CHOP_FRAME_DURATION * 2;
const SHAKE_DURATION = 0.12;
const SHAKE_DISTANCE = 7;

class Game {
  constructor(canvas, platform) {
    this.canvas = canvas;
    this.platform = platform;
    this.context = canvas.getContext('2d');
    this.tree = new Tree();
    this.drops = new Drops();
    this.storage = new ScoreStorage(platform);
    this.audio = new AudioManager(platform);
    this.renderer = new Renderer(canvas, this.context, platform);
    this.state = STATE.READY;
    this.score = 0;
    this.highScore = this.storage.getHighScore();
    this.leaderboard = new Leaderboard(platform);
    this.leaderboard.sync(this.highScore);
    this.energy = ENERGY.max;
    this.level = 1;
    this.levelUpElapsed = LEVEL.levelUpAnimationDuration;
    this.levelUpLevel = null;
    this.combo = 0;
    this.multiplier = 1;
    this.scorePulseElapsed = COMBO.scorePulseDuration;
    this.scorePulseStrength = 0;
    this.playerSide = SIDE.LEFT;
    this.lastFrameAt = 0;
    this.chopFlash = 0;
    this.chopFrame = 0;
    this.chopAnimationElapsed = CHOP_ANIMATION_DURATION;
    this.cloudOffset = 0;
    this.shakeElapsed = null;
    this.shakeX = 0;
    this.shakeY = 0;
    this.powerUpCooldown = 0;
    this.energyFreezeRemaining = 0;
    this.berserkRemaining = 0;
    this.shieldCharges = 0;
    this.powerUpNotice = null;
    this.powerUpNoticeElapsed = 0;
    this.comboRemaining = 0;
    this.debris = [];
    this.shieldBreakRemaining = 0;
    this.paused = false;
  }

  start() {
    this.resize();
    this.loop(Date.now());
  }

  resize() {
    const info = this.platform.getSystemInfoSync();
    const pixelRatio = info.pixelRatio || 1;
    this.canvas.width = info.windowWidth * pixelRatio;
    this.canvas.height = info.windowHeight * pixelRatio;
    this.renderer.setViewport(info.windowWidth, info.windowHeight, pixelRatio);
    this.leaderboard.resize(this.renderer.scale, pixelRatio);
  }

  handleTap(screenX, screenY) {
    if (this.paused) return;
    const uiX = (screenX - this.renderer.offsetX) / this.renderer.scale;
    const uiY = (screenY - this.renderer.offsetY) / this.renderer.scale;
    if (this.leaderboard.open) {
      if (uiX >= 150 && uiX <= 600 && uiY >= 1140 && uiY <= 1230) this.leaderboard.close();
      return;
    }
    if (this.state === STATE.GAME_OVER && uiX >= 150 && uiX <= 600
      && uiY >= 800 && uiY <= 890) {
      this.leaderboard.show(this.highScore);
      return;
    }
    if (uiX >= 540 && uiX <= 730 && uiY >= 1260 && uiY <= 1334) {
      this.audio.toggle();
      return;
    }
    if (this.state === STATE.GAME_OVER) {
      this.reset();
    }
    if (this.state === STATE.READY) this.audio.startMusic();

    this.playerSide = screenX < this.renderer.viewportWidth / 2 ? SIDE.LEFT : SIDE.RIGHT;
    this.state = STATE.PLAYING;

    this.powerUpCooldown = Math.max(0, this.powerUpCooldown - 1);
    const outcome = this.tree.chop(this.getEmptyChance());
    this.chopFlash = 1;
    this.chopFrame = 0;
    this.chopAnimationElapsed = 0;
    this.shakeElapsed = 0;
    this.audio.playChop();
    this.triggerChopHaptic();

    if (outcome.danger === this.playerSide) {
      if (this.berserkRemaining > 0) {
        this.debris.push({ side: outcome.danger, age: 0 });
        this.audio.play('hit');
        this.showPowerUpNotice('狂暴斧击飞树枝！');
      } else if (this.shieldCharges > 0) {
        this.shieldCharges -= 1;
        this.shieldBreakRemaining = 0.5;
        this.audio.play('hit');
        this.showPowerUpNotice('护盾抵挡了一次树枝！');
      } else {
        this.endGame();
        return;
      }
    }

    this.registerSuccessfulChop();
    this.collectDrop(0);
    this.drops.afterChop(this.score, this.tree.rows[0]);
  }

  collectDrop(elapsed) {
    const type = this.drops.update(elapsed, this.playerSide, this.tree.rows[0]);
    if (type !== POWER_UP.NONE) this.activatePowerUp(type);
  }

  registerSuccessfulChop() {
    this.combo += 1;
    this.comboRemaining = COMBO.window;
    const previousMultiplier = this.multiplier;
    const previousLevel = this.level;
    this.multiplier = Math.min(
      COMBO.maxMultiplier,
      Math.floor(this.combo / COMBO.multiplierStep) + 1
    );
    if (this.multiplier > previousMultiplier) this.audio.play('point');
    this.score += this.multiplier;
    this.energy = Math.min(ENERGY.max, this.energy + ENERGY.restorePerChop);
    this.level = this.getLevelForScore(this.score);
    if (this.level > previousLevel) {
      this.levelUpElapsed = 0;
      this.levelUpLevel = this.level;
      this.audio.play('level');
    }
    this.scorePulseElapsed = 0;
    this.scorePulseStrength = this.multiplier > previousMultiplier ? 1.35 : 1;
  }

  endGame() {
    this.drops.reset();
    this.state = STATE.GAME_OVER;
    this.audio.play('hit');
    this.audio.pauseMusic();
    this.energyFreezeRemaining = 0;
    this.berserkRemaining = 0;
    this.shieldCharges = 0;
    this.powerUpNotice = null;
    this.combo = 0;
    this.multiplier = 1;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.storage.saveHighScore(this.highScore);
      this.leaderboard.sync(this.highScore);
    }
  }

  reset() {
    this.drops.reset();
    this.comboRemaining = 0;
    this.debris = [];
    this.shieldBreakRemaining = 0;
    this.tree.reset();
    this.score = 0;
    this.energy = ENERGY.max;
    this.level = 1;
    this.levelUpElapsed = LEVEL.levelUpAnimationDuration;
    this.levelUpLevel = null;
    this.combo = 0;
    this.multiplier = 1;
    this.scorePulseElapsed = COMBO.scorePulseDuration;
    this.scorePulseStrength = 0;
    this.playerSide = SIDE.LEFT;
    this.chopFlash = 0;
    this.chopFrame = 0;
    this.chopAnimationElapsed = CHOP_ANIMATION_DURATION;
    this.shakeElapsed = null;
    this.shakeX = 0;
    this.shakeY = 0;
    this.powerUpCooldown = 0;
    this.energyFreezeRemaining = 0;
    this.berserkRemaining = 0;
    this.shieldCharges = 0;
    this.powerUpNotice = null;
    this.powerUpNoticeElapsed = 0;
    this.state = STATE.READY;
  }

  loop(timestamp) {
    const elapsed = this.paused || !this.lastFrameAt ? 0
      : Math.max(0, Math.min((timestamp - this.lastFrameAt) / 1000, 0.05));
    this.lastFrameAt = timestamp;
    if (this.state === STATE.PLAYING && !this.paused) {
      const drainTime = Math.max(0, elapsed - this.energyFreezeRemaining);
      this.updatePowerUpEffects(elapsed);
      this.energy = Math.max(0, this.energy - this.getEnergyDrainPerSecond() * drainTime);
      this.comboRemaining = Math.max(0, this.comboRemaining - elapsed);
      if (this.comboRemaining === 0) { this.combo = 0; this.multiplier = 1; }
      if (this.energy === 0) this.endGame();
      if (this.state === STATE.PLAYING) this.collectDrop(elapsed);
    }
    this.debris.forEach((piece) => { piece.age += elapsed; });
    this.debris = this.debris.filter((piece) => piece.age < 0.65);
    this.shieldBreakRemaining = Math.max(0, this.shieldBreakRemaining - elapsed);
    this.chopFlash = Math.max(0, this.chopFlash - elapsed * 7);
    this.updateChopAnimation(elapsed);
    this.updateScorePulse(elapsed);
    this.updateLevelUpAnimation(elapsed);
    if (this.shakeElapsed !== null) this.updateScreenShake(elapsed);
    this.cloudOffset = (this.cloudOffset + CLOUDS.speed * elapsed) % CLOUDS.width;
    this.renderer.render({
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      energy: this.energy,
      level: this.level,
      levelUpProgress: this.getLevelUpProgress(),
      levelUpLevel: this.levelUpLevel,
      combo: this.combo,
      multiplier: this.multiplier,
      scorePulse: this.getScorePulse(),
      playerSide: this.playerSide,
      rows: this.tree.rows,
      drop: this.drops.item,
      chopFlash: this.chopFlash,
      chopFrame: this.chopFrame,
      cloudOffset: this.cloudOffset,
      isShaking: this.shakeElapsed !== null,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      energyFreezeRemaining: this.energyFreezeRemaining,
      berserkRemaining: this.berserkRemaining,
      berserkDuration: POWER_UP.berserkDuration,
      debris: this.debris,
      shieldBreakRemaining: this.shieldBreakRemaining,
      audioEnabled: this.audio.enabled,
      leaderboard: this.leaderboard,
      shieldCharges: this.shieldCharges,
      powerUpNotice: this.powerUpNotice,
      powerUpNoticeProgress: this.getPowerUpNoticeProgress()
    });
    this.requestNextFrame();
  }

  updateChopAnimation(elapsed) {
    if (this.chopAnimationElapsed >= CHOP_ANIMATION_DURATION) {
      this.chopFrame = 0;
      return;
    }

    this.chopAnimationElapsed = Math.min(
      CHOP_ANIMATION_DURATION,
      this.chopAnimationElapsed + elapsed
    );
    this.chopFrame = this.chopAnimationElapsed < CHOP_FRAME_DURATION ? 0 : 1;
  }

  updateScorePulse(elapsed) {
    this.scorePulseElapsed = Math.min(
      COMBO.scorePulseDuration,
      this.scorePulseElapsed + elapsed
    );
  }

  getScorePulse() {
    if (this.scorePulseElapsed >= COMBO.scorePulseDuration) return 0;
    const progress = this.scorePulseElapsed / COMBO.scorePulseDuration;
    return Math.sin(progress * Math.PI) * this.scorePulseStrength;
  }

  getLevelForScore(score) {
    return progression.levelForScore(score);
  }

  getEmptyChance() {
    return progression.emptyChance(this.level);
  }

  getEnergyDrainPerSecond() {
    return progression.energyDrain(this.level);
  }

  activatePowerUp(powerUp) {
    if (powerUp === POWER_UP.ENERGY_FRUIT) {
      this.energy = ENERGY.max;
      this.energyFreezeRemaining = POWER_UP.energyFreezeDuration;
      this.audio.play('pickup');
      this.showPowerUpNotice('体力全满！3 秒不消耗');
      return;
    }
    if (powerUp === POWER_UP.SHIELD) {
      this.shieldCharges = 1;
      this.audio.play('pickup');
      this.showPowerUpNotice('获得护盾！');
      return;
    }
    if (powerUp === POWER_UP.BERSERK_AXE) {
      this.berserkRemaining = POWER_UP.berserkDuration;
      this.audio.play('level');
      this.showPowerUpNotice('狂暴斧！3 秒无敌');
    }
  }

  updatePowerUpEffects(elapsed) {
    const previous = this.berserkRemaining;
    this.energyFreezeRemaining = Math.max(0, this.energyFreezeRemaining - elapsed);
    this.berserkRemaining = Math.max(0, this.berserkRemaining - elapsed);
    if (previous > 1 && this.berserkRemaining <= 1) this.audio.play('countdown');
    if (previous > 0 && this.berserkRemaining === 0) this.showPowerUpNotice('狂暴结束，注意躲避！');
    if (this.powerUpNoticeElapsed > 0) {
      this.powerUpNoticeElapsed = Math.max(0, this.powerUpNoticeElapsed - elapsed);
      if (this.powerUpNoticeElapsed === 0) this.powerUpNotice = null;
    }
  }

  showPowerUpNotice(message) {
    this.powerUpNotice = message;
    this.powerUpNoticeElapsed = POWER_UP.noticeDuration;
  }

  getPowerUpNoticeProgress() {
    return this.powerUpNotice ? this.powerUpNoticeElapsed / POWER_UP.noticeDuration : 0;
  }

  updateLevelUpAnimation(elapsed) {
    this.levelUpElapsed = Math.min(
      LEVEL.levelUpAnimationDuration,
      this.levelUpElapsed + elapsed
    );
    if (this.levelUpElapsed >= LEVEL.levelUpAnimationDuration) {
      this.levelUpLevel = null;
    }
  }

  triggerChopHaptic() {
    if (typeof this.platform.vibrateShort !== 'function') return;
    try {
      this.platform.vibrateShort({ type: 'light' });
    } catch (error) {
      // Haptics are optional and are unavailable in some DevTools versions.
    }
  }

  getLevelUpProgress() {
    if (this.levelUpLevel === null) return 0;
    return 1 - this.levelUpElapsed / LEVEL.levelUpAnimationDuration;
  }

  updateScreenShake(elapsed) {
    this.shakeElapsed = Math.min(SHAKE_DURATION, this.shakeElapsed + elapsed);
    const remaining = 1 - this.shakeElapsed / SHAKE_DURATION;
    if (remaining <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeElapsed = null;
      return;
    }

    // A short alternating displacement makes the chop feel weighty without
    // obscuring tree-branch positions or altering game coordinates.
    const phase = this.shakeElapsed / SHAKE_DURATION;
    const strength = this.berserkRemaining > 0 ? 1.5 : 1;
    this.shakeX = Math.sin(phase * Math.PI * 6) * SHAKE_DISTANCE * remaining * strength;
    this.shakeY = Math.cos(phase * Math.PI * 4) * SHAKE_DISTANCE * 0.35 * remaining * strength;
  }

  requestNextFrame() {
    // requestAnimationFrame is a global API in the WeChat mini-game runtime.
    // The timeout fallback also keeps the game runnable in older simulators.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.loop(Date.now()));
      return;
    }
    setTimeout(() => this.loop(Date.now()), 1000 / 60);
  }
}

module.exports = { Game };
