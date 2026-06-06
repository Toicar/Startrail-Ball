// hud.js — HUD 叠加层
window.HUD = (function () {
  'use strict';

  var overlay = document.getElementById('hud-overlay');
  var speedFill, scoreEl, comboEl, buffsEl, livesEl;

  function init() {
    var best = '0';
    try { best = localStorage.getItem('star_tunnel_best') || '0'; } catch (e) {}
    overlay.innerHTML =
      '<div class="hud-top">' +
        '<div class="hud-stat-group">' +
          '<div id="hud-lives" class="hud-chip">❤️❤️❤️</div>' +
          '<div id="hud-score" class="hud-chip hud-score">🪙 0</div>' +
        '</div>' +
        '<div class="hud-top-right">' +
          '<div id="hud-best" class="hud-best-chip">🏆 ' + best + '</div>' +
          '<button id="hud-pause-btn" class="hud-pause-btn" type="button" aria-label="暂停" onclick="window.pauseGame()">⏸</button>' +
        '</div>' +
      '</div>' +
      '<div class="hud-speed-bar"><div id="hud-speed-fill" class="hud-speed-fill" style="width:0%;"></div></div>' +
      '<div id="hud-buffs" class="hud-buffs"></div>' +
      '<div id="hud-combo"></div>';
    speedFill = document.getElementById('hud-speed-fill');
    scoreEl = document.getElementById('hud-score');
    comboEl = document.getElementById('hud-combo');
    buffsEl = document.getElementById('hud-buffs');
    livesEl = document.getElementById('hud-lives');
    overlay.style.display = 'none';
  }

  function show() { overlay.style.display = 'block'; }
  function hide() { overlay.style.display = 'none'; }

  function update(state) {
    if (!scoreEl) return;
    scoreEl.textContent = '🪙 ' + Math.floor(state.score);

    var hearts = '';
    for (var h = 0; h < state.maxLives; h++) {
      hearts += h < state.lives ? '❤️' : '🖤';
    }
    livesEl.textContent = hearts;

    var speedPct = Math.floor((state.speed / CONFIG.BALL.MAX_SPEED) * 100);
    speedFill.style.width = speedPct + '%';

    if (state.combo >= 15) comboEl.textContent = '🔥 COMBO ×5!';
    else if (state.combo >= 10) comboEl.textContent = '⚡ COMBO ×3!';
    else if (state.combo >= 5) comboEl.textContent = '✨ COMBO ×2';
    else comboEl.textContent = '';

    var buffs = state.activeBuffs;
    var html = '';
    if (buffs.speedBoost > 0) html += '<span class="hud-buff active">⚡ ' + buffs.speedBoost.toFixed(1) + 's</span>';
    if (buffs.magnet > 0) html += '<span class="hud-buff active">🧲 ' + buffs.magnet.toFixed(1) + 's</span>';
    if (state.hasShield) html += '<span class="hud-buff active">🛡️</span>';
    if (buffs.scoreDouble > 0) html += '<span class="hud-buff active">✨ ' + buffs.scoreDouble.toFixed(1) + 's</span>';
    buffsEl.innerHTML = html;
  }

  return { init: init, show: show, hide: hide, update: update };
})();
