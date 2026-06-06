// audio.js — Web Audio API 程序化音效合成
window.AudioFX = (function () {
  'use strict';

  var ctx = null;
  var enabled = true;
  var bgmTimer = null;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    if (!enabled || !ctx) return;
    stopBGM();

    function pulse() {
      if (!ctx || ctx.state === 'closed') return;
      var st = window.STATE;
      if (!st || st.phase !== 'playing') return;

      try {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        // 频率随速度变化
        var pitch = 55 + (st.speed / CONFIG.BALL.MAX_SPEED) * 30;
        osc.frequency.value = pitch;
        g.gain.setValueAtTime(0.025, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) { /* ignore */ }

      var interval = 500 - st.speed * 8;
      bgmTimer = setTimeout(pulse, Math.max(120, interval));
    }
    pulse();
  }

  function stopBGM() {
    if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
  }

  return { init: init, resume: resume, coinCollect: coinCollect, powerUp: powerUp, hitObstacle: hitObstacle, checkpoint: checkpoint, startBGM: startBGM, stopBGM: stopBGM };
})();
