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
  var jumpQueued = false;
  var jumpCooldown = 0;
  var float2DMode = false;
  var float2DX = 0;
  var float2DY = 0;
  var floatGyroX = 0;
  var floatGyroY = 0;

  function floatKeysActive() {
    return keysDown['ArrowLeft'] || keysDown['ArrowRight'] ||
      keysDown['ArrowUp'] || keysDown['ArrowDown'];
  }

  // --- 陀螺仪：横竖屏自适应 + 灵敏度 ---
  function onDeviceOrientation(e) {
    gyroAvailable = true;
    if (!useGyro) {
      useGyro = true;
      document.body.classList.add('gyro-mode');
    }
    if (float2DMode) {
      if (floatKeysActive()) return;
      var beta = e.beta || 0;
      var gamma = e.gamma || 0;
      var divisor = 45 / gyroSensitivity;
      var tiltX = isLandscape ? beta : gamma;
      var tiltY = isLandscape ? gamma : beta;
      floatGyroX = THREE.MathUtils.clamp(-tiltX / divisor, -1, 1);
      floatGyroY = THREE.MathUtils.clamp(-tiltY / divisor, -1, 1);
      return;
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    if (e.key === ' ' || (e.key === 'ArrowUp' && !float2DMode)) {
      e.preventDefault();
      triggerJump();
    }
  });
  window.addEventListener('keyup', function (e) {
    keysDown[e.key] = false;
  });

  function update(dt) {
    if (float2DMode) {
      var tx = 0;
      var ty = 0;
      // 与冲刺轨键盘一致：左键 → 正方向（屏幕左移）
      if (keysDown['ArrowLeft']) tx += 1;
      if (keysDown['ArrowRight']) tx -= 1;
      if (keysDown['ArrowUp']) ty += 1;
      if (keysDown['ArrowDown']) ty -= 1;
      if (tx !== 0 || ty !== 0) {
        var len = Math.sqrt(tx * tx + ty * ty);
        tx /= len;
        ty /= len;
        float2DX += (tx - float2DX) * Math.min(KEYBOARD_RESPONSE * dt, 1);
        float2DY += (ty - float2DY) * Math.min(KEYBOARD_RESPONSE * dt, 1);
      } else if (useGyro) {
        float2DX = floatGyroX;
        float2DY = floatGyroY;
      } else {
        float2DX += (0 - float2DX) * Math.min(KEYBOARD_RETURN * dt, 1);
        float2DY += (0 - float2DY) * Math.min(KEYBOARD_RETURN * dt, 1);
      }
      return;
    }
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
    if (window.resizeGame) setTimeout(window.resizeGame, 0);
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
    if (document.body) {
      document.body.classList.toggle('force-landscape', orientationMode === 'landscape');
      document.body.classList.toggle('force-portrait', orientationMode === 'portrait');
      document.body.classList.toggle('auto-orientation', orientationMode === 'auto');
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
  function getAngleRange() { return ANGLE_RANGE; }
  function resetAngle() {
    targetAngle = 0;
    keyboardActive = false;
    jumpQueued = false;
    float2DX = 0;
    float2DY = 0;
    floatGyroX = 0;
    floatGyroY = 0;
  }

  function setFloat2DMode(on) {
    if (float2DMode === on) return;
    float2DMode = !!on;
    float2DX = 0;
    float2DY = 0;
    floatGyroX = 0;
    floatGyroY = 0;
    if (!float2DMode) targetAngle = 0;
  }

  function getFloat2DInput() {
    return { x: float2DX, y: float2DY };
  }

  function triggerJump() {
    if (jumpCooldown > 0) return;
    jumpQueued = true;
    jumpCooldown = 0.08;
  }

  function consumeJump() {
    var j = jumpQueued;
    jumpQueued = false;
    return j;
  }

  function updateJumpCooldown(dt) {
    jumpCooldown = Math.max(0, jumpCooldown - dt);
  }

  return {
    init: init, update: update,
    getTargetAngle: getTargetAngle, getAngleRange: getAngleRange, resetAngle: resetAngle,
    triggerJump: triggerJump, consumeJump: consumeJump, updateJumpCooldown: updateJumpCooldown,
    setGyroSensitivity: setGyroSensitivity, getGyroSensitivity: getGyroSensitivity,
    setOrientation: setOrientation, getOrientation: getOrientation,
    setAngleRange: setAngleRange, applyOrientation: applyOrientation,
    setFloat2DMode: setFloat2DMode, getFloat2DInput: getFloat2DInput,
    isGyroAvailable: function () { return gyroAvailable; }
  };
})();
