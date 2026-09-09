const HIGH_SCORE_KEY = 'rampage-alpaca-season-1';

class ScoreStorage {
  constructor(platform) {
    this.platform = platform;
  }

  getHighScore() {
    try {
      return Number(this.platform.getStorageSync(HIGH_SCORE_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  saveHighScore(score) {
    try {
      this.platform.setStorageSync(HIGH_SCORE_KEY, score);
    } catch (error) {
      // Storage failures must never interrupt a game session.
    }
  }
}

module.exports = { ScoreStorage };
