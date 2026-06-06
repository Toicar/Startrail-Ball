// physics.js — 简化物理：球在管壁截面上的角度运动
window.Physics = (function () {
  'use strict';

  var angle = 0;
  var angularVelocity = 0;
  var currentSpeed = CONFIG.BALL.BASE_SPEED;

  function init() {
    angle = 0;
    angularVelocity = 0;
    currentSpeed = CONFIG.BALL.BASE_SPEED;
  }

  function normalizeAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }

  // 连续角度运动：重力 + 输入扭矩 + 阻尼，无级变速
  function updateLane(targetAngle, pipeRadius, dt) {
    // 重力：始终将球拉向底部（角度 0）
    var gravityTorque = -Math.sin(angle) * CONFIG.PHYSICS.GRAVITY * 0.35;

    // 输入扭矩：推向目标角度
    var angleDiff = normalizeAngle(targetAngle - angle);
    var inputTorque = angleDiff * 12;

    // 阻尼：防止振荡
    var dampingTorque = -angularVelocity * CONFIG.PHYSICS.DAMPING;

    angularVelocity += (gravityTorque + inputTorque + dampingTorque) * dt;
    angularVelocity = THREE.MathUtils.clamp(angularVelocity, -10, 10);
    angle += angularVelocity * dt;
    angle = normalizeAngle(angle);

    return angle;
  }

  function getAngle() { return angle; }
  function setSpeed(s) { currentSpeed = Math.min(s, CONFIG.BALL.MAX_SPEED); }
  function getSpeed() { return currentSpeed; }
  function setAngle(a) { angle = normalizeAngle(a); angularVelocity = 0; }

  return { init: init, getAngle: getAngle, setSpeed: setSpeed, getSpeed: getSpeed, setAngle: setAngle, updateLane: updateLane };
})();
