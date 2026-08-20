const { STATE, SIDE, ENERGY, CLOUDS, COMBO } = require('./constants');
const { Tree } = require('./tree');
const { Renderer } = require('./renderer');
const { ScoreStorage } = require('./storage');
const { AudioManager } = require('./audio');

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
    this.storage = new ScoreStorage(platform);
    this.audio = new AudioManager(platform);
    this.renderer = new Renderer(canvas, this.context, platform);
    this.state = STATE.READY;
    this.score = 0;
    this.highScore = this.storage.getHighScore();
    this.energy = ENERGY.max;
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
  }

  handleTap(screenX) {
    if (this.state === STATE.GAME_OVER) {
      this.reset();
      return;
    }

    this.playerSide = screenX < this.renderer.viewportWidth / 2 ? SIDE.LEFT : SIDE.RIGHT;
    this.state = STATE.PLAYING;

    const fallingBranch = this.tree.chop();
    this.chopFlash = 1;
    this.chopFrame = 0;
    this.chopAnimationElapsed = 0;
    this.shakeElapsed = 0;
    this.audio.playChop();

    if (fallingBranch === this.playerSide) {
      this.endGame();
      return;
    }

    this.registerSuccessfulChop();
  }

  registerSuccessfulChop() {
    this.combo += 1;
    const previousMultiplier = this.multiplier;
    this.multiplier = Math.min(
      COMBO.maxMultiplier,
      Math.floor(this.combo / COMBO.multiplierStep) + 1
    );
    this.score += this.multiplier;
    this.energy = Math.min(ENERGY.max, this.energy + ENERGY.restorePerChop);
    this.scorePulseElapsed = 0;
    this.scorePulseStrength = this.multiplier > previousMultiplier ? 1.35 : 1;
  }

  endGame() {
    this.state = STATE.GAME_OVER;
    this.combo = 0;
    this.multiplier = 1;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.storage.saveHighScore(this.highScore);
    }
  }

  reset() {
    this.tree.reset();
    this.score = 0;
    this.energy = ENERGY.max;
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
    this.state = STATE.READY;
  }

  loop(timestamp) {
    const elapsed = Math.min((timestamp - this.lastFrameAt) / 1000, 0.05);
    this.lastFrameAt = timestamp;
    if (this.state === STATE.PLAYING) {
      this.energy = Math.max(0, this.energy - ENERGY.drainPerSecond * elapsed);
      if (this.energy === 0) this.endGame();
    }
    this.chopFlash = Math.max(0, this.chopFlash - elapsed * 7);
    this.updateChopAnimation(elapsed);
    this.updateScorePulse(elapsed);
    if (this.shakeElapsed !== null) this.updateScreenShake(elapsed);
    this.cloudOffset = (this.cloudOffset + CLOUDS.speed * elapsed) % CLOUDS.width;
    this.renderer.render({
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      energy: this.energy,
      combo: this.combo,
      multiplier: this.multiplier,
      scorePulse: this.getScorePulse(),
      playerSide: this.playerSide,
      rows: this.tree.rows,
      chopFlash: this.chopFlash,
      chopFrame: this.chopFrame,
      cloudOffset: this.cloudOffset,
      isShaking: this.shakeElapsed !== null,
      shakeX: this.shakeX,
      shakeY: this.shakeY
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
    this.shakeX = Math.sin(phase * Math.PI * 6) * SHAKE_DISTANCE * remaining;
    this.shakeY = Math.cos(phase * Math.PI * 4) * SHAKE_DISTANCE * 0.35 * remaining;
  }

  requestNextFrame() {
    // requestAnimationFrame is a global API in the WeChat mini-game runtime.
    // The timeout fallback also keeps the game runnable in older simulators.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame((timestamp) => this.loop(timestamp));
      return;
    }
    setTimeout(() => this.loop(Date.now()), 1000 / 60);
  }
}

module.exports = { Game };
