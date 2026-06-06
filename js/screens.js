// screens.js — 开始/死亡/暂停画面 + 设置面板
window.Screens = (function () {
  'use strict';

  var overlay = document.getElementById('screen-overlay');

  function show(html) {
    overlay.innerHTML = html;
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function buildSettingsHTML() {
    var curOri = (window.Input && Input.getOrientation) ? Input.getOrientation() : 'auto';
    var curSens = (window.Input && Input.getGyroSensitivity) ? Input.getGyroSensitivity() : CONFIG.GYRO.SENSITIVITY_DEFAULT;

    var oriLabels = { auto: '🔄 自动', portrait: '📱 竖屏', landscape: '🖥 横屏' };
    var oriBtns = '';
    ['auto', 'portrait', 'landscape'].forEach(function (m) {
      var active = m === curOri ? ' style="background:rgba(124,77,255,0.6);border-color:#7c4dff;"' : '';
      oriBtns += '<button class="set-ori-btn"' + active + ' onclick="window.Screens._setOrientation(\'' + m + '\')">' + oriLabels[m] + '</button>';
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

  // 设置回调（供 onclick 调用）
  function _setOrientation(mode) {
    if (window.Input) {
      Input.setOrientation(mode);
      // 刷新按钮高亮
      var btns = document.querySelectorAll('.set-ori-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '';
        btns[i].style.borderColor = '';
      }
      var btns2 = document.querySelectorAll('.set-ori-btn');
      for (var j = 0; j < btns2.length; j++) {
        if (btns2[j].getAttribute('onclick') && btns2[j].getAttribute('onclick').indexOf("'" + mode + "'") >= 0) {
          btns2[j].style.background = 'rgba(124,77,255,0.6)';
          btns2[j].style.borderColor = '#7c4dff';
        }
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
    var bestHTML = bestScore > 0 ? '<p style="color:#ffd740;margin-bottom:8px;">🏆 最高分: ' + bestScore + '</p>' : '';

    show(
      '<div class="start-screen">' +
        '<h1 class="start-title">星轨穿梭</h1>' +
        '<p class="start-sub">Star Tunnel Rush</p>' +
        bestHTML +
        '<div class="set-panel">' + buildSettingsHTML() + '</div>' +
        '<p class="start-hint">倾斜手机控制球体 · 或触摸屏幕移动</p>' +
        '<button class="start-btn" onclick="window.startGame()">开始游戏</button>' +
      '</div>'
    );
  }

  function showDeath(score, bestScore, distance, elapsedTime) {
    var isNewBest = score >= bestScore;
    if (isNewBest) {
      try { localStorage.setItem('star_tunnel_best', score); } catch (e) {}
    }
    var newBestHTML = isNewBest ? '<p style="color:#ffd740;margin-bottom:8px;">🎉 新纪录！</p>' : '';
    show(
      '<div style="text-align:center;color:#fff;padding:20px;">' +
        '<h2 style="font-size:28px;color:#ff5252;margin-bottom:16px;">撞毁！</h2>' +
        '<p style="font-size:22px;margin-bottom:4px;">🪙 ' + Math.floor(score) + '</p>' +
        newBestHTML +
        '<p style="color:#8899bb;font-size:14px;">🏆 最高分: ' + Math.max(score, bestScore) + '</p>' +
        '<p style="color:#667788;font-size:13px;margin-bottom:4px;">📏 ' + Math.floor(distance) + 'm | ⏱ ' + Math.floor(elapsedTime) + 's</p>' +
        '<button onclick="window.startGame()" style="margin-top:16px;padding:12px 40px;background:linear-gradient(135deg,#7c4dff,#00bcd4);border:none;border-radius:24px;color:#fff;font-size:16px;cursor:pointer;">再来一次</button>' +
      '</div>'
    );
  }

  function showPause() {
    show(
      '<div style="text-align:center;color:#fff;">' +
        '<h2 style="font-size:28px;margin-bottom:20px;">暂停</h2>' +
        '<button onclick="window.resumeGame()" style="display:block;padding:12px 40px;margin:8px auto;background:linear-gradient(135deg,#7c4dff,#00bcd4);border:none;border-radius:24px;color:#fff;font-size:16px;cursor:pointer;">继续</button>' +
        '<button onclick="window.startGame()" style="display:block;padding:12px 40px;margin:8px auto;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:24px;color:#fff;font-size:16px;cursor:pointer;">重新开始</button>' +
      '</div>'
    );
  }

  return { showStart: showStart, showDeath: showDeath, showPause: showPause, hide: hide,
           _setOrientation: _setOrientation, _setSensitivity: _setSensitivity };
})();
