const AUDIO_URL =
  'https://qxrrstnreesgmpopzbzm.supabase.co/storage/v1/object/public/nightdrive/nightdrivewwwnightdrivewww.mp4';

class AudioPlayer {
  constructor(buttonEl) {
    this.button = buttonEl;
    this.audio = null;
    this.state = 'idle';
    this.button.addEventListener('click', () => this.toggle());
    this._setState('idle');
  }

  toggle() {
    if (this.state === 'idle' || this.state === 'error') {
      this._start();
    } else if (this.state === 'playing') {
      this._pause();
    } else if (this.state === 'paused') {
      this._resume();
    }
  }

  _start() {
    if (!this.audio) {
      this.audio = new Audio(AUDIO_URL);
      this.audio.loop = true;
      this.audio.volume = 0.8;
      this.audio.addEventListener('error', () => {
        this._setState('error');
        document.dispatchEvent(new CustomEvent('nightdrive:musicstop'));
      });
    }
    this._setState('loading');
    this.audio
      .play()
      .then(() => {
        this._setState('playing');
        document.dispatchEvent(new CustomEvent('nightdrive:musicstart'));
      })
      .catch(() => {
        this._setState('error');
      });
  }

  _pause() {
    this.audio.pause();
    this._setState('paused');
    document.dispatchEvent(new CustomEvent('nightdrive:musicstop'));
  }

  _resume() {
    this.audio
      .play()
      .then(() => {
        this._setState('playing');
        document.dispatchEvent(new CustomEvent('nightdrive:musicstart'));
      })
      .catch(() => this._setState('error'));
  }

  _setState(state) {
    this.state = state;
    const labels = {
      idle:    'start engine',
      loading: '·  ·  ·',
      playing: 'music on',
      paused:  'music paused',
      error:   'no signal',
    };
    this.button.textContent = labels[state] || 'start engine';
    this.button.dataset.state = state;
  }
}
