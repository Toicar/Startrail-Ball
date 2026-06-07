// level2-controller.js — 平底地面 + 三面 120° 翻滚切换
window.Level2Controller = (function () {
  'use strict';

  var ball = {
    lat: 0,            // 沿地面的世界 X
    latTarget: 0,
    jumpOffset: 0,     // 抬离地面的高度（向管心）
    jumpVel: 0,
    ringLayer: 0,      // 0 = 地面轨，1 = 上方平行轨（仅换轨区）
    ringRise: 0,       // 当前相对地面的抬升量（用于上下轨插值）
    ringFromRise: 0,
    ringToRise: 0,
    ringSwitchT: 0,
    faceIndex: 0,
    x: 0, y: 0,
  };

  var jumpCooldown = 0;
  var lastEdgeIndex = -1;

  function hideLevel1() {
    if (window.PipeSystem) {
      PipeSystem.group.visible = false;
      PipeSystem.ringGroup.visible = false;
    }
    if (window.World) World.group.visible = false;
  }

  function showLevel1() {
    if (window.PipeSystem) {
      PipeSystem.group.visible = true;
      PipeSystem.ringGroup.visible = true;
    }
    if (window.World) World.group.visible = true;
  }

  function resetBall() {
    ball.lat = 0;
    ball.latTarget = 0;
    ball.jumpOffset = 0;
    ball.jumpVel = 0;
    ball.ringLayer = 0;
    ball.ringRise = 0;
    ball.ringFromRise = 0;
    ball.ringToRise = 0;
    ball.ringSwitchT = 0;
    ball.faceIndex = 0;
    applyBallPosition();
  }

  function inputNorm() {
    var range = (Input.getAngleRange && Input.getAngleRange()) || Math.PI * 0.75;
    return THREE.MathUtils.clamp(Input.getTargetAngle() / range, -1, 1);
  }

  function lateralHalf(edgeId) {
    if (edgeId === 'rings' && ball.ringLayer === 1) return LEVEL2_CONFIG.RINGS.LATERAL_HALF_CEIL;
    return LEVEL2_CONFIG.LATERAL_HALF;
  }

  function applyBallPosition() {
    var floorY = getLevel2FloorY();
    ball.x = ball.lat;
    ball.y = floorY + ball.ringRise + ball.jumpOffset;
  }

  function tryJump(edgeId) {
    if (jumpCooldown > 0) return;
    if (edgeId === 'rings') {
      if (ball.ringSwitchT > 0) return;
      ball.ringLayer = ball.ringLayer === 0 ? 1 : 0;
      ball.ringFromRise = ball.ringRise;
      ball.ringToRise = ball.ringLayer === 1 ? LEVEL2_CONFIG.RINGS.CEIL_RISE : 0;
      ball.ringSwitchT = LEVEL2_CONFIG.RINGS.SWITCH_DUR;
      jumpCooldown = LEVEL2_CONFIG.JUMP_COOLDOWN + 0.08;
      if (window.AudioFX) AudioFX.powerUp();
      return;
    }
    if (ball.jumpOffset > 0.05) return;
    var cfg = edgeId === 'subway' ? LEVEL2_CONFIG.SUBWAY : LEVEL2_CONFIG.ROLLING;
    ball.jumpVel = cfg.JUMP_V;
    jumpCooldown = LEVEL2_CONFIG.JUMP_COOLDOWN;
    if (window.AudioFX) AudioFX.powerUp();
  }

  function updateLateral(dt, edgeId) {
    var n = inputNorm();
    var half = lateralHalf(edgeId);
    ball.latTarget = THREE.MathUtils.clamp(n * LEVEL2_CONFIG.LATERAL_HALF, -half, half);
    ball.lat += (ball.latTarget - ball.lat) * Math.min(dt * LEVEL2_CONFIG.LATERAL_LERP, 1);
    if (ball.lat > half) ball.lat = half;
    if (ball.lat < -half) ball.lat = -half;
  }

  function updateRingSwitch(dt) {
    if (ball.ringSwitchT <= 0) return;
    ball.ringSwitchT -= dt;
    var t = 1 - Math.max(0, ball.ringSwitchT) / LEVEL2_CONFIG.RINGS.SWITCH_DUR;
    ball.ringRise = ball.ringFromRise + (ball.ringToRise - ball.ringFromRise) * level2Ease(t);
    if (ball.ringSwitchT <= 0) {
      ball.ringSwitchT = 0;
      ball.ringRise = ball.ringToRise;
    }
  }

  function updateJump(dt, edgeId) {
    if (Input.consumeJump()) tryJump(edgeId);
    if (edgeId === 'rings') {
      updateRingSwitch(dt);
      ball.jumpOffset = 0;
      ball.jumpVel = 0;
      return;
    }
    var g = edgeId === 'subway' ? LEVEL2_CONFIG.SUBWAY.GRAVITY : LEVEL2_CONFIG.ROLLING.GRAVITY;
    ball.jumpVel -= g * dt;
    ball.jumpOffset += ball.jumpVel * dt;
    if (ball.jumpOffset <= 0) {
      ball.jumpOffset = 0;
      ball.jumpVel = 0;
    }
  }

  // 翻滚：依据总距离连续旋转隧道，平段保持稳定、交界处滚动 120°
  function tunnelRotationFor(distance, edgeInfo) {
    var unit = Math.floor(distance / LEVEL2_CONFIG.EDGE_LENGTH);
    var roll = unit + level2Ease(edgeInfo.transT);
    return -roll * LEVEL2_CONFIG.FACE_STEP;
  }

  function updateCamera() {
    if (!window.camera) return;
    // 平底地面在 Y≈-2，抬高视线让地面落在画面下方、球更贴地（接近参考视频）
    var aspect = window.innerWidth / window.innerHeight;
    if (aspect < 0.6) {
      camera.fov = CONFIG.CAMERA.PORTRAIT_FOV;
      camera.position.set(0, -0.2, CONFIG.CAMERA.PORTRAIT_Z);
    } else if (aspect > 1.5) {
      camera.fov = CONFIG.CAMERA.LANDSCAPE_FOV;
      camera.position.set(0, -0.2, CONFIG.CAMERA.LANDSCAPE_Z);
    } else {
      camera.fov = 55;
      camera.position.set(0, -0.2, -8);
    }
    camera.lookAt(0, 1.2, 6);
    camera.updateProjectionMatrix();
  }

  function onEdgeIndexChange(idx) {
    if (idx === lastEdgeIndex) return;
    lastEdgeIndex = idx;
    var edge = LEVEL2_CONFIG.EDGES[idx];
    if (window.showToast) showToast('进入 · ' + edge.name);
  }

  function init() {
    Level2Track.init();
    Level2World.init();
    Level2Track.hide();
  }

  function start() {
    hideLevel1();
    Level2Track.show();
    Level2Track.reset();
    Level2World.reset();
    resetBall();
    lastEdgeIndex = -1;
    jumpCooldown = 0;
    updateCamera();
    if (window.HUD && HUD.setJumpVisible) HUD.setJumpVisible(true);
  }

  function hide() {
    Level2Track.hide();
    showLevel1();
    if (window.HUD && HUD.setJumpVisible) HUD.setJumpVisible(false);
  }

  function triggerFallDamage() {
    // 平地玩法已无坠落坎，保留空实现以兼容旧调用
  }

  function update(dt) {
    if (!window.STATE || STATE.phase !== 'playing') return;

    jumpCooldown = Math.max(0, jumpCooldown - dt);
    Input.update(dt);
    updateCamera();

    var elapsed = STATE.elapsedTime;
    var diff = getCurrentDifficulty(elapsed);
    STATE.difficultyLevel = diff.index;
    var lapBoost = Math.floor(STATE.distance / LEVEL2_CONFIG.TOTAL_LAP) * 0.08;
    var speed = Math.min((LEVEL2_CONFIG.SPEED.BASE + elapsed * LEVEL2_CONFIG.SPEED.RAMP) * (1 + lapBoost), LEVEL2_CONFIG.SPEED.MAX);
    if (STATE.activeBuffs && STATE.activeBuffs.speedBoost > 0) speed *= CONFIG.BUFFS.SPEED_BOOST.speedMul;

    var edgeInfo = getLevel2EdgeAt(STATE.distance);
    var inTrans = edgeInfo.inTransition;
    if (inTrans) speed *= LEVEL2_CONFIG.SPEED.TRANSITION_MUL;

    STATE.speed = speed;
    STATE.distance += speed * dt;
    STATE.level2Edge = edgeInfo.edge.name;
    ball.faceIndex = edgeInfo.index;
    onEdgeIndexChange(edgeInfo.index);

    updateLateral(dt, edgeInfo.edge.id);
    updateJump(dt, edgeInfo.edge.id);
    applyBallPosition();
    STATE.ballAngle = ball.lat;

    if (window.Ball) Ball.setPosition(ball.x, ball.y, 0);
    if (window.pointLight) window.pointLight.position.set(ball.x, ball.y, 0);

    Level2Track.setTunnelRotation(tunnelRotationFor(STATE.distance, edgeInfo));
    Level2Track.update(speed, dt, elapsed, STATE.distance);
    Level2World.syncPositions(STATE.distance);
    Level2World.clearBehind(STATE.distance);
    Level2World.updateVisuals();

    if (!inTrans) {
      var hits = Level2World.checkCollisions(ball, edgeInfo.edge.id, STATE.distance, edgeInfo.index);
      for (var i = 0; i < hits.length; i++) {
        if (window.mainHandleCollision) window.mainHandleCollision(hits[i]);
      }
    }

    if (window.Effects) {
      Effects.updateTrail(Ball.getPosition());
      Effects.updateBursts(dt);
    }
    if (window.HUD) {
      HUD.update(STATE);
      if (HUD.updateComboAnchor && window.Ball) {
        var p = Ball.getPosition().clone();
        p.project(window.camera);
        HUD.updateComboAnchor(
          (p.x * 0.5 + 0.5) * window.innerWidth + 36,
          (-p.y * 0.5 + 0.5) * window.innerHeight - 48
        );
      }
    }
  }

  return {
    init: init, start: start, hide: hide, update: update,
    resetBall: resetBall, triggerFallDamage: triggerFallDamage,
    getBall: function () { return ball; },
  };
})();
