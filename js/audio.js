// audio.js - Web Audio sound effects + MP3 background music
window.AudioFX = (function () {
  'use strict';

  var ctx = null;
  var enabled = true;
  var bgmAudio = null;
  var bgmPausedAt = 0;
  var bgmStarted = false;
  var BGM_SRC = './215775__primeobsession__techno-hook.mp3';

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgmAudio = new Audio(BGM_SRC);
      bgmAudio.loop = true;
      bgmAudio.preload = 'auto';
      bgmAudio.volume = 0.38;
    } catch (e) {
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, duration, type, vol, ramp) {
    if (!enabled || !ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      else gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
    } catch (e) { /* ignore */ }
  }

  function playBGMFrom(time) {
    if (!enabled || !bgmAudio) return;
    try {
      if (time !== undefined) bgmAudio.currentTime = time;
      var p = bgmAudio.play();
      if (p && p.catch) p.catch(function () {});
      bgmStarted = true;
    } catch (e) { /* ignore */ }
  }

  function coinCollect() {
    playTone(880, 0.1, 'sine', 0.1, true);
    setTimeout(function () { playTone(1320, 0.08, 'sine', 0.06, true); }, 50);
  }

  function powerUp() {
    playTone(440, 0.15, 'square', 0.08, false);
    setTimeout(function () { playTone(660, 0.15, 'square', 0.08, false); }, 100);
    setTimeout(function () { playTone(880, 0.2, 'square', 0.1, true); }, 200);
  }

  function hitObstacle() {
    playTone(80, 0.3, 'sawtooth', 0.2, true);
    playTone(60, 0.2, 'triangle', 0.15, true);
  }

  function checkpoint() {
    playTone(523, 0.2, 'sine', 0.08, false);
    setTimeout(function () { playTone(659, 0.2, 'sine', 0.08, false); }, 150);
    setTimeout(function () { playTone(784, 0.3, 'sine', 0.1, true); }, 300);
  }

  function startBGM() {
    if (!enabled) return;
    stopBGM();
    bgmPausedAt = 0;
    playBGMFrom(0);
  }

  function pauseBGM() {
    if (!bgmAudio || bgmAudio.paused) return;
    try {
      bgmPausedAt = bgmAudio.currentTime || 0;
      bgmAudio.pause();
    } catch (e) { /* ignore */ }
  }

  function resumeBGM() {
    if (!bgmStarted) {
      startBGM();
      return;
    }
    playBGMFrom(bgmPausedAt);
  }

  function stopBGM() {
    if (bgmAudio) {
      try {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
      } catch (e) { /* ignore */ }
    }
    bgmPausedAt = 0;
    bgmStarted = false;
  }

  return {
    init: init,
    resume: resume,
    coinCollect: coinCollect,
    powerUp: powerUp,
    hitObstacle: hitObstacle,
    checkpoint: checkpoint,
    startBGM: startBGM,
    pauseBGM: pauseBGM,
    resumeBGM: resumeBGM,
    stopBGM: stopBGM
  };
})();
