const CHOP_SOUND_PATH = 'assets/audio/chop.mp3';

class AudioManager {
  constructor(platform) {
    this.platform = platform;
    this.chopSound = this.createSound(CHOP_SOUND_PATH);
  }

  createSound(source) {
    if (typeof this.platform.createInnerAudioContext !== 'function') return null;
    try {
      const sound = this.platform.createInnerAudioContext();
      sound.src = source;
      sound.obeyMuteSwitch = true;
      return sound;
    } catch (error) {
      return null;
    }
  }

  playChop() {
    if (!this.chopSound) return;
    try {
      this.chopSound.stop();
      this.chopSound.seek(0);
      this.chopSound.play();
    } catch (error) {
      // Audio is optional; unsupported simulators must not interrupt play.
    }
  }
}

module.exports = { AudioManager };
