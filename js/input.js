// input.js — 陀螺仪 + 触屏 + 键盘，输出连续目标角度
window.Input = (function () {
  'use strict';

  var ANGLE_RANGE = Math.PI * 0.75;
  var targetAngle = 0;
  var useGyro = false;
  var gyroAvailable = false;
  var touchActive = false;
  var touchStartX = 0;
  var gyroSensitivity = CONFIG.GYRO.SENSITIVITY_DEFAULT;
  var isLandscape = false;
  var orientationMode = 'auto'; // 'auto' | 'portrait' | 'landscape'
  var keyboardActive = false;
  var KEYBOARD_RANGE_MUL = 1.0;
  var KEYBOARD_RESPONSE = 4.2;
  var KEYBOARD_RETURN = 5.0;

  // --- 陀螺仪：横竖屏自适应 + 灵敏度 ---
  function onDeviceOrientation(e) {
    gyroAvailable = true;
    if (!useGyro) {
      useGyro = true;
      document.body.classList.add('gyro-mode');
    }
    // 键盘占用时抑制陀螺仪，避免桌面端冲突
    if (keysDown['ArrowLeft'] || keysDown['ArrowRight']) return;
    // 横屏用 beta（左右倾），竖屏用 gamma
    var tilt = isLandscape ? (e.beta || 0) : (e.gamma || 0);
    if (tilt === null || tilt === undefined) return;
    var divisor = 45 / gyroSensitivity;
    var raw = THREE.MathUtils.clamp(tilt / divisor, -1, 1);
    targetAngle = -raw * ANGLE_RANGE;
  }

  // --- 触屏：虚拟摇杆 ---
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

  // --- 键盘 ---
  var keysDown = {};
  window.addEventListener('keydown', function (e) {
    keysDown[e.key] = true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    keysDown[e.key] = false;
  });

  function update(dt) {
    // 触屏模式下跳过键盘，其余情况键盘始终可用
    if (touchActive) return;
    var desired = null;
    if (keysDown['ArrowLeft']) desired = ANGLE_RANGE * KEYBOARD_RANGE_MUL;
    else if (keysDown['ArrowRight']) desired = -ANGLE_RANGE * KEYBOARD_RANGE_MUL;
    // 有键盘输入时覆盖陀螺仪，无输入时保持陀螺仪角度不变
    if (desired !== null) {
      keyboardActive = true;
      targetAngle += (desired - targetAngle) * Math.min(KEYBOARD_RESPONSE * dt, 1);
    } else if (keyboardActive && !useGyro) {
      targetAngle += (0 - targetAngle) * Math.min(KEYBOARD_RETURN * dt, 1);
      if (Math.abs(targetAngle) < 0.01) {
        targetAngle = 0;
        keyboardActive = false;
      }
    }
  }

  // --- 设置接口 ---
  function setGyroSensitivity(val) {
    gyroSensitivity = THREE.MathUtils.clamp(val, 0.3, 1.2);
    try { localStorage.setItem('star_tunnel_sensitivity', gyroSensitivity); } catch (e) {}
  }

  function getGyroSensitivity() { return gyroSensitivity; }

  function setOrientation(mode) {
    orientationMode = mode;
    applyOrientation();
    try { localStorage.setItem('star_tunnel_orientation', mode); } catch (e) {}
  }

  function getOrientation() { return orientationMode; }

  function setAngleRange(maxFraction) {
    ANGLE_RANGE = Math.PI * THREE.MathUtils.clamp(maxFraction, 0.4, 1.0);
  }

  function applyOrientation() {
    if (orientationMode === 'portrait') {
      isLandscape = false;
    } else if (orientationMode === 'landscape') {
      isLandscape = true;
    } else {
      isLandscape = window.innerWidth > window.innerHeight;
    }
  }

  // 从 localStorage 恢复设置
  function loadSettings() {
    try {
      var savedSens = parseFloat(localStorage.getItem('star_tunnel_sensitivity'));
      if (savedSens > 0) gyroSensitivity = THREE.MathUtils.clamp(savedSens, 0.3, 1.2);
      var savedOri = localStorage.getItem('star_tunnel_orientation');
      if (savedOri === 'portrait' || savedOri === 'landscape' || savedOri === 'auto') {
        orientationMode = savedOri;
      }
    } catch (e) {}
    applyOrientation();
  }

  // --- 初始化 ---
  function init() {
    loadSettings();
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
  function resetAngle() { targetAngle = 0; keyboardActive = false; }

  return {
    init: init, update: update,
    getTargetAngle: getTargetAngle, resetAngle: resetAngle,
    setGyroSensitivity: setGyroSensitivity, getGyroSensitivity: getGyroSensitivity,
    setOrientation: setOrientation, getOrientation: getOrientation,
    setAngleRange: setAngleRange, applyOrientation: applyOrientation,
    isGyroAvailable: function () { return gyroAvailable; }
  };
})();
