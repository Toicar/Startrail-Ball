// hud.js - in-game HUD overlay
window.HUD = (function () {
  'use strict';

  var overlay = document.getElementById('hud-overlay');
  var speedFill, speedValueEl, scoreValueEl, comboEl, buffsEl, livesEl, boostChipEl, boostTimeEl, distanceEl, timeEl;
  var floatLayer, comboFloatEl;
  var coinFloatItems = [];
  var projectedPrompt = new THREE.Vector3();

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
          '<div class="hud-chip hud-speed-chip">' +
            '<span>速度</span><strong id="hud-speed-value">0.0m/s</strong>' +
          '</div>' +
          '<div id="hud-boost-chip" class="hud-chip hud-boost-chip">' +
            '<span class="hud-buff-text">极速 x2</span>' +
            '<strong id="hud-boost-time">0.0s</strong>' +
          '</div>' +
        '</div>' +
        '<div class="hud-top-right">' +
          '<div class="hud-best-chip"><span>BEST</span><strong id="hud-best-value">' + best + '</strong></div>' +
          '<button id="hud-pause-btn" class="hud-pause-btn" type="button" aria-label="暂停" onclick="window.pauseGame()">' +
            '<span></span><span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="hud-metrics">' +
        '<span>距离 <strong id="hud-distance-value">0m</strong></span>' +
        '<span>时间 <strong id="hud-time-value">00:00</strong></span>' +
      '</div>' +
      '<div class="hud-speed-wrap">' +
        '<div class="hud-speed-label">SPEED</div>' +
        '<div class="hud-speed-bar"><div id="hud-speed-fill" class="hud-speed-fill" style="width:0%;"></div></div>' +
      '</div>' +
      '<div id="hud-buffs" class="hud-buffs"></div>' +
      '<div id="hud-combo" class="hud-combo"></div>' +
      '<div id="hud-float-layer" class="hud-float-layer">' +
        '<div id="hud-combo-float" class="hud-combo-float"></div>' +
      '</div>';

    speedFill = document.getElementById('hud-speed-fill');
    speedValueEl = document.getElementById('hud-speed-value');
    scoreValueEl = document.getElementById('hud-score-value');
    comboEl = document.getElementById('hud-combo');
    buffsEl = document.getElementById('hud-buffs');
    livesEl = document.getElementById('hud-lives');
    boostChipEl = document.getElementById('hud-boost-chip');
    boostTimeEl = document.getElementById('hud-boost-time');
    distanceEl = document.getElementById('hud-distance-value');
    timeEl = document.getElementById('hud-time-value');
    floatLayer = document.getElementById('hud-float-layer');
    comboFloatEl = document.getElementById('hud-combo-float');
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

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    var minutes = Math.floor(seconds / 60);
    var remain = seconds % 60;
    return (minutes < 10 ? '0' : '') + minutes + ':' + (remain < 10 ? '0' : '') + remain;
  }

  function update(state) {
    if (!scoreValueEl) return;
    scoreValueEl.textContent = Math.floor(state.score);
    renderLives(state.lives, state.maxLives);

    var speedPct = Math.max(0, Math.min(100, Math.floor((state.speed / CONFIG.BALL.MAX_SPEED) * 100)));
    speedFill.style.width = speedPct + '%';
    if (speedValueEl) speedValueEl.textContent = (state.speed || 0).toFixed(1) + 'm/s';
    if (distanceEl) distanceEl.textContent = Math.floor(state.distance) + 'm';
    if (timeEl) timeEl.textContent = formatTime(state.elapsedTime);

    comboEl.textContent = '';

    var buffs = state.activeBuffs;
    var boostTime = buffs.speedBoost || 0;
    if (boostChipEl) {
      boostChipEl.style.display = boostTime > 0 ? 'inline-flex' : 'none';
      if (boostTimeEl) boostTimeEl.textContent = boostTime.toFixed(1) + 's';
    }
    var html = '';
    if (buffs.magnet > 0) html += buffHTML('magnet', 'item_magnet.png', '磁铁', buffs.magnet.toFixed(1) + 's');
    if (state.hasShield) html += buffHTML('shield', 'item_shield.png', '护盾', '');
    if (buffs.scoreDouble > 0) html += buffHTML('double', 'item_double.png', '双倍', buffs.scoreDouble.toFixed(1) + 's');
    buffsEl.innerHTML = html;
  }

  function projectPromptAnchor() {
    if (!window.camera) return null;
    var z = 8.5;
    var offset = (window.PipeSystem && PipeSystem.getCurveOffsetAt) ? PipeSystem.getCurveOffsetAt(z) : { x: 0, y: 0 };
    projectedPrompt.set(offset.x, offset.y, z).project(window.camera);
    if (projectedPrompt.z < -1 || projectedPrompt.z > 1) {
      return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.48 };
    }
    return {
      x: (projectedPrompt.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projectedPrompt.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  function getComboLabel(combo) {
    if (combo >= 15) return 'COMBO x5';
    if (combo >= 10) return 'COMBO x3';
    if (combo >= 5) return 'COMBO x2';
    return '';
  }

  function spawnCoinText(points) {
    if (!floatLayer) return;
    var el = document.createElement('div');
    el.className = 'hud-coin-float';
    el.textContent = '+' + Math.floor(points);
    floatLayer.appendChild(el);
    var lane = Math.min(coinFloatItems.length, 3);
    coinFloatItems.push({
      el: el,
      age: 0,
      life: 0.92,
      offset: lane * 18,
      xOffset: lane % 2 === 0 ? 0 : (lane === 1 ? -24 : 24)
    });
    while (coinFloatItems.length > 4) {
      var old = coinFloatItems.shift();
      if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  }

  function updateFloating(state, ballPos, dt) {
    if (!floatLayer || !comboFloatEl) return;
    var pos = projectPromptAnchor();
    if (!pos || !state || state.phase !== 'playing') {
      comboFloatEl.classList.remove('visible');
      for (var h = 0; h < coinFloatItems.length; h++) coinFloatItems[h].el.style.opacity = 0;
      return;
    }

    var safeX = Math.max(72, Math.min(window.innerWidth - 72, pos.x));
    var safeY = Math.max(96, Math.min(window.innerHeight - 92, pos.y));
    var comboText = getComboLabel(state.combo);

    if (comboText) {
      comboFloatEl.textContent = comboText;
      comboFloatEl.style.left = safeX + 'px';
      comboFloatEl.style.top = (safeY - 16) + 'px';
      comboFloatEl.classList.add('visible');
    } else {
      comboFloatEl.classList.remove('visible');
    }

    dt = Math.min(dt || 0.016, 0.05);
    for (var i = coinFloatItems.length - 1; i >= 0; i--) {
      var item = coinFloatItems[i];
      item.age += dt;
      var t = Math.min(1, item.age / item.life);
      var y = comboText
        ? safeY + 24 + item.offset * 0.45 - t * 20
        : safeY + 8 + item.offset * 0.45 - t * 28;
      item.el.style.left = (safeX + item.xOffset) + 'px';
      item.el.style.top = y + 'px';
      item.el.style.opacity = Math.max(0, 1 - t);
      item.el.style.transform = 'translate(-50%, -50%) scale(' + (1 + 0.18 * (1 - t)) + ')';
      if (t >= 1) {
        if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
        coinFloatItems.splice(i, 1);
      }
    }
  }

  return { init: init, show: show, hide: hide, update: update, spawnCoinText: spawnCoinText, updateFloating: updateFloating };
})();
