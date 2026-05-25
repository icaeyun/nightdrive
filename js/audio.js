/* audio.js — music player with immediate visual trigger */

var AUDIO_URL =
  'https://qxrrstnreesgmpopzbzm.supabase.co/storage/v1/object/public/nightdrive/KakaoTalk_20260525_104922631.mp4';
var AUDIO_VERSION = '20260525-104922631';

function getAudioUrl() {
  return AUDIO_URL + '?v=' + AUDIO_VERSION;
}

function AudioPlayer(buttonEl) {
  this.button   = buttonEl;
  this.audio    = null;
  this._audioSrc = '';
  this._driving = false;
  this.button.addEventListener('click', this._toggle.bind(this));
  this._setLabel('idle');
}

AudioPlayer.prototype._toggle = function () {
  if (!this._driving) {
    this._drivingOn();
  } else {
    this._drivingOff();
  }
};

/* Clicking always fires musicstart immediately for visuals.
   Audio is a bonus — if it fails the visuals keep running. */
AudioPlayer.prototype._drivingOn = function () {
  this._driving = true;
  this._setLabel('loading');
  document.dispatchEvent(new CustomEvent('nightdrive:musicstart'));

  if (!this.audio) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop   = true;
    this.audio.volume = 0.8;
    var self = this;
    this.audio.addEventListener('error', function () {
      console.error('nightdrive audio failed:', self.audio.error, self.audio.currentSrc);
      self._setLabel('idle');
      self._driving = false;
    });
  }

  var self = this;
  var audioSrc = getAudioUrl();
  if (this._audioSrc !== audioSrc) {
    this._audioSrc = audioSrc;
    this.audio.src = audioSrc;
    this.audio.load();
  }
  this.audio.play()
    .then(function ()  { self._setLabel('on'); })
    .catch(function (err) {
      console.error('nightdrive audio play blocked:', err, self.audio.currentSrc);
      self._setLabel('idle');
      self._driving = false;
    });
};

AudioPlayer.prototype._drivingOff = function () {
  this._driving = false;
  if (this.audio) this.audio.pause();
  this._setLabel('idle');
  document.dispatchEvent(new CustomEvent('nightdrive:musicstop'));
};

AudioPlayer.prototype._setLabel = function (state) {
  var labels = { idle: 'start engine', loading: '·  ·  ·', on: 'engine on' };
  this.button.textContent      = labels[state] || 'start engine';
  this.button.dataset.state    = (state === 'on' || state === 'loading') ? 'playing' : 'idle';
};
