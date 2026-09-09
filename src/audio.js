const CHOP_SOUND_PATH = 'assets/audio/chop.mp3';

class AudioManager {
  constructor(platform) {
    this.platform = platform;
    this.chopSound = this.createSound(CHOP_SOUND_PATH);
    this.enabled = true;
    this.musicPlaying = false;
    this.sounds = {
      hit: this.createSound('assets/audio/hit-branch.mp3'),
      level: this.createSound('assets/audio/clear-level.mp3'),
      pickup: this.createSound('assets/audio/button-tap.mp3'),
      countdown: this.createSound('assets/audio/countdown.mp3'),
      point: this.createSound('assets/audio/point.mp3')
    };
    this.music = this.createSound('assets/audio/bgm-forest.mp3');
    if (this.music) { this.music.loop = true; this.music.volume = 0.25; }
  }

  createSound(source) {
    if (typeof this.platform.createInnerAudioContext !== 'function') return null;
    try {
      const sound = this.platform.createInnerAudioContext();
      sound.src = source;
      sound.obeyMuteSwitch = true;
      if (typeof sound.onError === 'function') sound.onError(() => {});
      return sound;
    } catch (error) {
      return null;
    }
  }

  playChop() {
    if (!this.enabled || !this.chopSound) return;
    try {
      this.chopSound.stop();
      this.chopSound.seek(0);
      this.chopSound.play();
    } catch (error) {
      // Audio is optional; unsupported simulators must not interrupt play.
    }
  }

  play(name) {
    const sound = this.sounds[name];
    if (!this.enabled || !sound) return;
    try { sound.stop(); sound.play(); } catch (error) {}
  }

  startMusic() {
    this.musicPlaying = true;
    if (this.enabled && this.music) {
      try { this.music.play(); } catch (error) {}
    }
  }

  pauseMusic() {
    this.musicPlaying = false;
    if (this.music) {
      try { this.music.pause(); } catch (error) {}
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      [this.chopSound, this.music, ...Object.values(this.sounds)].forEach((sound) => {
        try { if (sound) sound.pause(); } catch (error) {}
      });
    } else if (this.musicPlaying) this.startMusic();
  }

  suspend() {
    this.pauseMusic();
    [this.chopSound, ...Object.values(this.sounds)].forEach((sound) => {
      try { if (sound) sound.stop(); } catch (error) {}
    });
  }
}

module.exports = { AudioManager };
