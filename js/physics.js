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

  function update(targetAngle, pipeRadius, dt) {
    // 重力恢复力：将球拉回底部
    var gravityTorque = -Math.sin(angle) * CONFIG.PHYSICS.GRAVITY;

    // 输入扭矩（降低灵敏度，滑动更自然）
    var angleDiff = targetAngle - angle;
    var inputTorque = angleDiff * 10;

    // 阻尼（降低使滑动更流畅）
    var dampingTorque = -angularVelocity * 5;

    // 离心力
    var centrifugalTorque = 0;
    if (window.PipeSystem && window.PipeSystem.getCurvatureAt) {
      var curvature = window.PipeSystem.getCurvatureAt(0);
      centrifugalTorque = -curvature * CONFIG.PHYSICS.CENTRIFUGAL * currentSpeed;
    }

    var angularAccel = gravityTorque + inputTorque + dampingTorque + centrifugalTorque;

    angularVelocity += angularAccel * dt;
    angularVelocity = THREE.MathUtils.clamp(angularVelocity, -8, 8);
    angle += angularVelocity * dt;
    angle = THREE.MathUtils.clamp(angle, -Math.PI * 0.8, Math.PI * 0.8);

    var ballR = CONFIG.BALL.RADIUS;
    var effectiveR = pipeRadius - ballR;
    var x = Math.sin(angle) * effectiveR;
    var y = -Math.cos(angle) * effectiveR;

    return { x: x, y: y, angle: angle, speed: currentSpeed };
  }

  // 车道模式：平滑移动到目标车道角度
  function updateLane(targetLaneAngle, pipeRadius, dt) {
    // 重力拉回中间（targetLaneAngle 由输入控制）
    var diff = targetLaneAngle - angle;
    var speed = 8; // 车道间移动速度
    angle += diff * Math.min(speed * dt, 1);
    // 也应用重力（松开时 targetLaneAngle=0，自然回到中间）
    if (Math.abs(diff) < 0.01) {
      var gravityPull = -Math.sin(angle) * CONFIG.PHYSICS.GRAVITY * dt * 0.5;
      angle += gravityPull;
    }
    return angle;
  }

  function getAngle() { return angle; }
  function setSpeed(s) { currentSpeed = Math.min(s, CONFIG.BALL.MAX_SPEED); }
  function getSpeed() { return currentSpeed; }
  function setAngle(a) { angle = a; angularVelocity = 0; }

  return { init: init, update: update, getAngle: getAngle, setSpeed: setSpeed, getSpeed: getSpeed, setAngle: setAngle, updateLane: updateLane };
})();
