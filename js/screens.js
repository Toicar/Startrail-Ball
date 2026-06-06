// screens.js — 开始/死亡/暂停画面
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

  function showStart() {
    var bestScore = 0;
    try { bestScore = parseInt(localStorage.getItem('star_tunnel_best') || '0'); } catch (e) {}
    var bestHTML = bestScore > 0 ? '<p style="color:#ffd740;margin-bottom:12px;">🏆 最高分: ' + bestScore + '</p>' : '';
    show(
      '<div style="text-align:center;color:#fff;padding:20px;">' +
        '<h1 style="font-size:36px;background:linear-gradient(135deg,#7c4dff,#00bcd4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;">星轨穿梭</h1>' +
        '<p style="font-size:14px;color:#8899bb;margin-bottom:24px;">Star Tunnel Rush</p>' +
        bestHTML +
        '<p style="font-size:15px;color:#aabbcc;margin-bottom:8px;">倾斜手机控制球体</p>' +
        '<p style="font-size:13px;color:#667788;">或触摸屏幕左右区域移动</p>' +
        '<button onclick="window.startGame()" style="margin-top:24px;padding:14px 48px;background:linear-gradient(135deg,#7c4dff,#00bcd4);border:none;border-radius:28px;color:#fff;font-size:18px;cursor:pointer;">开始游戏</button>' +
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

  return { showStart: showStart, showDeath: showDeath, showPause: showPause, hide: hide };
})();
