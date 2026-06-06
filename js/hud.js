// hud.js - in-game HUD overlay
window.HUD = (function () {
  'use strict';

  var overlay = document.getElementById('hud-overlay');
  var speedFill, scoreValueEl, comboEl, buffsEl, livesEl;

  function assetSrc(src) {
    return (window.AssetData && window.AssetData.images && window.AssetData.images[src]) || ('./image/' + src);
  }

  function icon(src, label) {
    return '<img class="hud-icon" src="' + assetSrc(src) + '" alt="' + label + '">';
  }

  function renderLives(lives, maxLives) {
    var html = '';
    for (var i = 0; i < maxLives; i++) {
      html += '<span class="life-cell' + (i < lives ? ' active' : '') + '"></span>';
    }
    livesEl.innerHTML = html;
  }

  function init() {
    var best = '0';
    try { best = localStorage.getItem('star_tunnel_best') || '0'; } catch (e) {}

    overlay.innerHTML =
      '<div class="hud-top">' +
        '<div class="hud-stat-group">' +
          '<div id="hud-lives" class="hud-lives" aria-label="生命值"></div>' +
          '<div class="hud-chip hud-score">' +
            icon('item_coin.png', '金币') +
            '<span id="hud-score-value">0</span>' +
          '</div>' +
        '</div>' +
        '<div class="hud-top-right">' +
          '<div class="hud-best-chip"><span>BEST</span><strong id="hud-best-value">' + best + '</strong></div>' +
          '<button id="hud-pause-btn" class="hud-pause-btn" type="button" aria-label="暂停" onclick="window.pauseGame()">' +
            '<span></span><span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="hud-speed-wrap">' +
        '<div class="hud-speed-label">SPEED</div>' +
        '<div class="hud-speed-bar"><div id="hud-speed-fill" class="hud-speed-fill" style="width:0%;"></div></div>' +
      '</div>' +
      '<div id="hud-buffs" class="hud-buffs"></div>' +
      '<div id="hud-combo" class="hud-combo"></div>';

    speedFill = document.getElementById('hud-speed-fill');
    scoreValueEl = document.getElementById('hud-score-value');
    comboEl = document.getElementById('hud-combo');
    buffsEl = document.getElementById('hud-buffs');
    livesEl = document.getElementById('hud-lives');
    renderLives(3, 3);
    overlay.style.display = 'none';
  }

  function show() { overlay.style.display = 'block'; }
  function hide() { overlay.style.display = 'none'; }

  function buffHTML(className, img, label, timeText) {
    return '<span class="hud-buff ' + className + '">' +
      (img ? icon(img, label) : '<span class="hud-buff-text">' + label + '</span>') +
      (timeText ? '<strong>' + timeText + '</strong>' : '') +
    '</span>';
  }

  function update(state) {
    if (!scoreValueEl) return;
    scoreValueEl.textContent = Math.floor(state.score);
    renderLives(state.lives, state.maxLives);

    var speedPct = Math.max(0, Math.min(100, Math.floor((state.speed / CONFIG.BALL.MAX_SPEED) * 100)));
    speedFill.style.width = speedPct + '%';

    if (state.combo >= 15) comboEl.textContent = 'COMBO x5';
    else if (state.combo >= 10) comboEl.textContent = 'COMBO x3';
    else if (state.combo >= 5) comboEl.textContent = 'COMBO x2';
    else comboEl.textContent = '';

    var buffs = state.activeBuffs;
    var html = '';
    if (buffs.speedBoost > 0) html += buffHTML('boost', '', 'BOOST', buffs.speedBoost.toFixed(1) + 's');
    if (buffs.magnet > 0) html += buffHTML('magnet', 'item_magnet.png', '磁铁', buffs.magnet.toFixed(1) + 's');
    if (state.hasShield) html += buffHTML('shield', 'item_shield.png', '护盾', '');
    if (buffs.scoreDouble > 0) html += buffHTML('double', 'item_double.png', '双倍', buffs.scoreDouble.toFixed(1) + 's');
    buffsEl.innerHTML = html;
  }

  return { init: init, show: show, hide: hide, update: update };
})();
