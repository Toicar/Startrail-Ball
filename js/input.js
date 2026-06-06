// input.js — 陀螺仪 + 触屏 + 键盘，输出连续目标角度
window.Input = (function () {
  'use strict';

  var ANGLE_RANGE = Math.PI * 0.75; // ±135°
  var targetAngle = 0;
  var useGyro = false;
  var gyroAvailable = false;
  var touchActive = false;
  var touchStartX = 0;

  // --- 陀螺仪：gamma 连续映射到角度 ---
  function onDeviceOrientation(e) {
    if (e.gamma === null) return;
    gyroAvailable = true;
    if (!useGyro) {
      useGyro = true;
      document.body.classList.add('gyro-mode');
    }
    var raw = THREE.MathUtils.clamp(e.gamma / 45, -1, 1);
    targetAngle = raw * ANGLE_RANGE;
  }

  // --- 触屏：虚拟摇杆，水平偏移 → 连续角度 ---
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
    var halfWidth = window.innerWidth * 0.45;
    var normalized = THREE.MathUtils.clamp(dx / halfWidth, -1, 1);
    targetAngle = -normalized * ANGLE_RANGE;
  }

  function onTouchEnd() {
    touchActive = false;
    targetAngle = 0;
    document.body.classList.remove('touching');
  }

  // --- 键盘：按住连续移动，松手回中 ---
  var keysDown = {};
  window.addEventListener('keydown', function (e) {
    keysDown[e.key] = true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    keysDown[e.key] = false;
  });

  // 每帧调用：键盘持续输入 + 松手回中
  function update(dt) {
    if (useGyro || touchActive) return;
    var desired = 0;
    if (keysDown['ArrowLeft']) desired = ANGLE_RANGE;
    else if (keysDown['ArrowRight']) desired = -ANGLE_RANGE;
    targetAngle += (desired - targetAngle) * Math.min(6 * dt, 1);
  }

  // --- 初始化 ---
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
      if (!gyroAvailable && window.showToast) showToast('倾斜操控不可用，已切换摇杆模式');
    }, 3000);
  }

  function getTargetAngle() { return targetAngle; }
  function resetAngle() { targetAngle = 0; }

  return {
    init: init,
    update: update,
    getTargetAngle: getTargetAngle,
    resetAngle: resetAngle,
    isGyroAvailable: function () { return gyroAvailable; }
  };
})();
