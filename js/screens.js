// screens.js - start, pause, death, and settings overlays
window.Screens = (function () {
  'use strict';

  var overlay = document.getElementById('screen-overlay');

  function show(html, className) {
    overlay.innerHTML = html;
    overlay.style.display = 'flex';
    overlay.classList.remove('screen-start-bg');
    overlay.classList.add('screen-visible');
    if (className) overlay.classList.add(className);
  }

  function hide() {
    overlay.style.display = 'none';
    overlay.classList.remove('screen-visible');
    overlay.classList.remove('screen-start-bg');
  }

  function assetSrc(src) {
    return (window.AssetData && window.AssetData.images && window.AssetData.images[src]) || ('./image/' + src);
  }

  function itemPreviewHTML() {
    var items = [
      ['item_coin.png', '金币', '基础得分'],
      ['item_magnet.png', '磁铁', '吸引附近金币'],
      ['item_shield.png', '护盾', '抵挡一次伤害'],
      ['item_double.png', '双倍', '限时分数翻倍'],
      ['item_bonus_gate.png', '宝箱', '触发金币奖励'],
      ['item_spike.png', '地刺', '碰到会扣血'],
      ['item_barrier.png', '旋转障碍', '环绕移动障碍']
    ];
    var html = '<div class="item-preview" aria-label="道具预览">';
    for (var i = 0; i < items.length; i++) {
      html += '<span class="item-preview-cell">' +
        '<img src="' + assetSrc(items[i][0]) + '" alt="' + items[i][1] + '">' +
        '<span><strong>' + items[i][1] + '</strong><em>' + items[i][2] + '</em></span>' +
      '</span>';
    }
    return html + '</div>';
  }

  function rulesHTML() {
    return '' +
      '<div class="rules-panel">' +
        '<div class="rules-section rules-primary">' +
          '<h3>任务目标</h3>' +
          '<p>在星轨管道中尽可能跑得更远，收集金币，躲开地刺和旋转障碍。</p>' +
        '</div>' +
        '<div class="rules-grid">' +
          '<div class="rules-section">' +
            '<h3>操作</h3>' +
            '<p>移动端倾斜设备或滑动控制小球，PC 端使用左右方向键调整位置。</p>' +
          '</div>' +
          '<div class="rules-section">' +
            '<h3>计分</h3>' +
            '<p>金币基础 +10。连续收集触发连击：x2 / x3 / x5；加速状态金币分数再 x2。</p>' +
          '</div>' +
          '<div class="rules-section">' +
            '<h3>加速</h3>' +
            '<p>踩到加速带进入极速状态，左上角显示倒计时，并获得更高金币分数。</p>' +
          '</div>' +
          '<div class="rules-section">' +
            '<h3>生存</h3>' +
            '<p>受到伤害会扣血并短暂无敌，生命耗尽后航线中断。</p>' +
          '</div>' +
        '</div>' +
        '<div class="rules-section rules-items">' +
          '<h3>道具效果</h3>' +
          itemPreviewHTML() +
        '</div>' +
      '</div>';
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
        '<div class="set-label">陀螺仪灵敏度<span id="sens-val">' + curSens.toFixed(1) + '</span></div>' +
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
    try { bestScore = parseInt(localStorage.getItem('star_tunnel_best') || '0'); } catch (e) {}
    var bestHTML = bestScore > 0 ? '<p class="start-best">最高分 ' + bestScore + '</p>' : '<p class="start-best">准备校准航线</p>';

    show(
      '<div class="start-screen">' +
        '<div class="start-grid">' +
          '<div class="start-hero-panel">' +
            '<div class="start-kicker">STAR TUNNEL RUSH</div>' +
            '<h1 class="start-title">星轨穿梭</h1>' +
            '<p class="start-sub">穿越高速星河管道，收集金币，突破更远距离。</p>' +
            '<div class="start-status-row">' +
              '<span>离线运行</span><span>重力模拟</span><span>连击倍率</span>' +
            '</div>' +
            bestHTML +
            '<button class="start-btn" onclick="window.startGame()">开始游戏</button>' +
            '<p class="start-hint">进入后请避开危险障碍，保持连击可以快速提高分数。</p>' +
            '<div class="set-panel">' + buildSettingsHTML() + '</div>' +
          '</div>' +
          rulesHTML() +
        '</div>' +
      '</div>',
      'screen-start-bg'
    );
  }

  function showDeath(score, bestScore, distance, elapsedTime) {
    var isNewBest = score >= bestScore;
    if (isNewBest) {
      try { localStorage.setItem('star_tunnel_best', score); } catch (e) {}
    }
    var newBestHTML = isNewBest ? '<p class="modal-highlight">新纪录</p>' : '';
    show(
      '<div class="modal-card">' +
        '<h2 class="modal-title death">航线中断</h2>' +
        '<div class="modal-score"><img src="' + assetSrc('item_coin.png') + '" alt="金币"><span>' + Math.floor(score) + '</span></div>' +
        newBestHTML +
        '<p class="modal-stat">最高分 ' + Math.max(score, bestScore) + '</p>' +
        '<p class="modal-stat-sub">' + Math.floor(distance) + 'm · ' + Math.floor(elapsedTime) + 's</p>' +
        '<button class="btn-primary" onclick="window.startGame()">再来一次</button>' +
        '<button class="btn-secondary" onclick="window.goToMainMenu()">回到主界面</button>' +
      '</div>'
    );
  }

  function showPause() {
    show(
      '<div class="modal-card">' +
        '<h2 class="modal-title">暂停</h2>' +
        '<button class="btn-primary" onclick="window.resumeGame()">继续</button>' +
        '<button class="btn-secondary" onclick="window.startGame()">重新开始</button>' +
      '</div>'
    );
  }

  return { showStart: showStart, showDeath: showDeath, showPause: showPause, hide: hide,
           _setOrientation: _setOrientation, _setSensitivity: _setSensitivity };
})();
