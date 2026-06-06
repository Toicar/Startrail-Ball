// input.js — 陀螺仪 + 触屏，输出目标车道索引
window.Input = (function () {
  'use strict';

  var LANES = CONFIG.LANES.ANGLES;
  var targetLane = 3;           // 默认车道 = 中间 (索引3 = 0°)
  var useGyro = false;
  var gyroAvailable = false;
  var touchActive = false;
  var touchStartX = 0;
  var lastLaneSwitch = 0;
  var SWITCH_COOLDOWN = 0.25;   // 车道切换冷却（秒）
  var MOVE_THRESHOLD = 50;      // 触屏移动阈值（像素）

  // 陀螺仪映射
  function onDeviceOrientation(e) {
    if (e.gamma === null) return;
    gyroAvailable = true;
    if (!useGyro) {
      useGyro = true;
      document.body.classList.add('gyro-mode');
    }
    var raw = THREE.MathUtils.clamp(e.gamma / 45, -1, 1);
    // 映射到车道：-1→0, 0→3, +1→6
    var idx = Math.round((raw + 1) / 2 * (LANES.length - 1));
    targetLane = THREE.MathUtils.clamp(idx, 0, LANES.length - 1);
  }

  // 触屏：检测方向切换车道
  function onTouchStart(e) {
    if (useGyro) return;
    e.preventDefault();
    touchActive = true;
    touchStartX = e.touches[0].clientX;
    document.body.classList.add('touching');
  }

  function onTouchMove(e) {
    if (!touchActive || useGyro) return;
    e.preventDefault();
    var dx = e.touches[0].clientX - touchStartX;
    var now = performance.now() / 1000;
    if (Math.abs(dx) > MOVE_THRESHOLD && now - lastLaneSwitch > SWITCH_COOLDOWN) {
      if (dx > 0) targetLane = Math.min(targetLane + 1, LANES.length - 1);
      else targetLane = Math.max(targetLane - 1, 0);
      touchStartX = e.touches[0].clientX;
      lastLaneSwitch = now;
    }
  }

  function onTouchEnd() {
    touchActive = false;
    targetLane = 3; // 松手回到中间
    document.body.classList.remove('touching');
  }

  // 键盘
  var keysDown = {};
  var lastKeySwitch = 0;
  window.addEventListener('keydown', function (e) {
    keysDown[e.key] = true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      var now = performance.now() / 1000;
      if (now - lastKeySwitch > SWITCH_COOLDOWN) {
        if (e.key === 'ArrowLeft') targetLane = Math.max(targetLane - 1, 0);
        else targetLane = Math.min(targetLane + 1, LANES.length - 1);
        lastKeySwitch = now;
      }
    }
  });
  window.addEventListener('keyup', function (e) {
    keysDown[e.key] = false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      targetLane = 3; // 松手回中
    }
  });

  function init() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.addEventListener('click', function req() {
        DeviceOrientationEvent.requestPermission()
          .then(function (s) { if (s === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation); })
          .catch(function () {});
        document.removeEventListener('click', req);
      }, { once: true });
    } else {
      window.addEventListener('deviceorientation', onDeviceOrientation);
    }
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    setTimeout(function () {
      if (!gyroAvailable) showToast && showToast('倾斜操控不可用，已切换摇杆模式');
    }, 3000);
  }

  function getTargetLane() { return targetLane; }
  function isGyroAvailable() { return gyroAvailable; }
  function resetLane() { targetLane = 3; }

  return { init: init, getTargetLane: getTargetLane, resetLane: resetLane, isGyroAvailable: isGyroAvailable };
})();
