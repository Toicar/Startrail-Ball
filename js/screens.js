// screens.js - start, pause, death, and settings overlays
window.Screens = (function () {
  'use strict';

  var overlay = document.getElementById('screen-overlay');

  function show(html) {
    overlay.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.classList.add('screen-visible');
  }

  function hide() {
    overlay.style.display = 'none';
    overlay.classList.remove('screen-visible');
  }

  function assetSrc(src) {
    return (window.AssetData && window.AssetData.images && window.AssetData.images[src]) || ('./image/' + src);
  }

  function itemPreviewHTML() {
    var items = [
      ['item_coin.png', '金币'],
      ['item_magnet.png', '磁铁'],
      ['item_shield.png', '护盾'],
      ['item_double.png', '双倍'],
      ['item_spike.png', '地刺'],
      ['item_barrier.png', '旋转障碍'],
      ['item_bonus_gate.png', '奖励门'],
      ['item_checkpoint.png', '检查点']
    ];
    var html = '<div class="item-preview" aria-label="道具预览">';
    for (var i = 0; i < items.length; i++) {
      html += '<span class="item-preview-cell"><img src="' + assetSrc(items[i][0]) + '" alt="' + items[i][1] + '"></span>';
    }
    return html + '</div>';
  }

  function buildSettingsHTML() {
    var curOri = (window.Input && Input.getOrientation) ? Input.getOrientation() : 'auto';
    var curSens = (window.Input && Input.getGyroSensitivity) ? Input.getGyroSensitivity() : CONFIG.GYRO.SENSITIVITY_DEFAULT;

    var oriLabels = { auto: '自动', portrait: '竖屏', landscape: '横屏' };
    var oriBtns = '';
    ['auto', 'portrait', 'landscape'].forEach(function (m) {
      var active = m === curOri ? ' active' : '';
      oriBtns += '<button class="set-ori-btn' + active + '" onclick="window.Screens._setOrientation(\'' + m + '\')">' + oriLabels[m] + '</button>';
    });

    return '' +
      '<div class="set-group">' +
        '<div class="set-label">屏幕方向</div>' +
        '<div class="set-ori-row">' + oriBtns + '</div>' +
      '</div>' +
      '<div class="set-group">' +
        '<div class="set-label">陀螺仪灵敏度 <span id="sens-val">' + curSens.toFixed(1) + '</span></div>' +
        '<input type="range" class="set-slider" min="0.3" max="1.2" step="0.1" value="' + curSens +
          '" oninput="window.Screens._setSensitivity(this.value)">' +
        '<div class="set-range-labels"><span>低</span><span>高</span></div>' +
      '</div>';
  }

  function _setOrientation(mode) {
    if (window.Input) Input.setOrientation(mode);
    var btns = document.querySelectorAll('.set-ori-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('active');
      if (btns[i].getAttribute('onclick') && btns[i].getAttribute('onclick').indexOf("'" + mode + "'") >= 0) {
        btns[i].classList.add('active');
      }
    }
  }

  function _setSensitivity(val) {
    var v = parseFloat(val);
    if (window.Input) Input.setGyroSensitivity(v);
    var label = document.getElementById('sens-val');
    if (label) label.textContent = v.toFixed(1);
  }

  function showStart() {
    var bestScore = 0;
    var bestScoreL2 = 0;
    try {
      bestScore = parseInt(localStorage.getItem('star_tunnel_best') || '0');
      bestScoreL2 = parseInt(localStorage.getItem('star_tunnel_best_l2') || '0');
    } catch (e) {}
    var bestHTML = (bestScore > 0 || bestScoreL2 > 0)
      ? '<p class="start-best">第一关最高 ' + bestScore + ' · 第二关最高 ' + bestScoreL2 + '</p>'
      : '';

    show(
      '<div class="start-screen">' +
        '<h1 class="start-title">星轨穿梭</h1>' +
        '<p class="start-sub">Star Tunnel Rush</p>' +
        itemPreviewHTML() +
        bestHTML +
        '<div class="set-panel">' + buildSettingsHTML() + '</div>' +
        '<p class="start-hint">星河管道已开启。</p>' +
        '<div class="level-select-row">' +
          '<button class="start-btn level-btn" onclick="window.startGame(1)">第一关 · 星轨管道</button>' +
          '<button class="start-btn level-btn level-btn-alt" onclick="window.startGame(2)">第二关 · 三角星轨</button>' +
        '</div>' +
      '</div>'
    );
  }

  function showDeath(score, bestScore, distance, elapsedTime, level) {
    level = level || 1;
    var bestKey = level === 2 ? 'star_tunnel_best_l2' : 'star_tunnel_best';
    try { bestScore = parseInt(localStorage.getItem(bestKey) || '0'); } catch (e) { bestScore = 0; }
    var isNewBest = score > bestScore;
    if (score > bestScore) {
      try { localStorage.setItem(bestKey, score); } catch (e) {}
      bestScore = score;
    }
    var newBestHTML = isNewBest ? '<p class="modal-highlight">新纪录</p>' : '';
    show(
      '<div class="modal-card">' +
        '<h2 class="modal-title death">航线中断</h2>' +
        '<div class="modal-score"><img src="' + assetSrc('item_coin.png') + '" alt="金币"><span>' + Math.floor(score) + '</span></div>' +
        newBestHTML +
        '<p class="modal-stat">最高分 ' + Math.max(score, bestScore) + '</p>' +
        '<p class="modal-stat-sub">' + Math.floor(distance) + 'm · ' + Math.floor(elapsedTime) + 's</p>' +
        '<button class="btn-primary" onclick="window.startGame(' + level + ')">再来一次</button>' +
        '<button class="btn-secondary" onclick="window.Screens.showStart()">选关</button>' +
      '</div>'
    );
  }

  function showPause() {
    show(
      '<div class="modal-card">' +
        '<h2 class="modal-title">暂停</h2>' +
        '<button class="btn-primary" onclick="window.resumeGame()">继续</button>' +
        '<button class="btn-secondary" onclick="window.startGame(window.STATE ? window.STATE.level : 1)">重新开始</button>' +
      '</div>'
    );
  }

  return { showStart: showStart, showDeath: showDeath, showPause: showPause, hide: hide,
           _setOrientation: _setOrientation, _setSensitivity: _setSensitivity };
})();
