// level2-controller.js — 平底地面 + 三面 120° 翻滚切换
window.Level2Controller = (function () {
  'use strict';

  var ball = {
    lat: 0,            // 世界坐标 X（贴壁段：屏幕水平左右）
    latTarget: 0,
    floatLX: 0,        // 浮空段：三角截面本地坐标
    floatLY: 0,
    jumpOffset: 0,     // 抬离管壁（向管心）
    jumpVel: 0,
    ringLayer: 0,      // 0 = 底轨，1 = 上轨（仅换轨区）
    ringRise: 0,
    ringFromRise: 0,
    ringToRise: 0,
    ringSwitchT: 0,
    ringRiseAtTransStart: undefined,
    faceIndex: 0,
    radial: 0,         // 球心距管心径向距离（面内）
    x: 0, y: 0,        // 世界坐标（供渲染/碰撞）
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
    ball.floatLX = 0;
    ball.floatLY = -getLevel2Apothem() * 0.35;
    ball.jumpOffset = 0;
    ball.jumpVel = 0;
    ball.ringLayer = 0;
    ball.ringRise = 0;
    ball.ringFromRise = 0;
    ball.ringToRise = 0;
    ball.ringSwitchT = 0;
    ball.ringRiseAtTransStart = undefined;
    ball.faceIndex = 0;
    applyBallPosition('subway');
  }

  function resetRingState() {
    ball.ringLayer = 0;
    ball.ringRise = 0;
    ball.ringFromRise = 0;
    ball.ringToRise = 0;
    ball.ringSwitchT = 0;
    ball.ringRiseAtTransStart = undefined;
  }

  // 离开换轨区或进入交界翻滚时，将上轨抬升平滑收回到底轨，避免带入下一段
  function syncRingStateForEdge(edgeInfo) {
    if (edgeInfo.edge.id !== 'rings') {
      resetRingState();
      return;
    }
    if (!edgeInfo.inTransition) {
      ball.ringRiseAtTransStart = undefined;
      return;
    }
    if (ball.ringRiseAtTransStart === undefined) {
      ball.ringSwitchT = 0;
      ball.ringRiseAtTransStart = ball.ringRise;
    }
    var t = level2Ease(edgeInfo.transT);
    ball.ringRise = ball.ringRiseAtTransStart * (1 - t);
    if (edgeInfo.transT >= 0.99) {
      resetRingState();
    }
  }

  function inputNorm() {
    var range = (Input.getAngleRange && Input.getAngleRange()) || Math.PI * 0.75;
    return THREE.MathUtils.clamp(Input.getTargetAngle() / range, -1, 1);
  }

  function lateralHalf(edgeId) {
    var rise = (edgeId === 'rings' && ball.ringLayer === 1) ? ball.ringRise : 0;
    var half = getLevel2FaceHalfWidth(rise);
    if (edgeId === 'rings' && ball.ringLayer === 1) {
      return Math.min(LEVEL2_CONFIG.RINGS.LATERAL_HALF_CEIL, half);
    }
    return Math.min(LEVEL2_CONFIG.LATERAL_HALF, half);
  }

  function applyBallPosition(edgeId) {
    if (edgeId === 'rolling') {
      var w = level2LocalToWorldXY(ball.floatLX, ball.floatLY);
      ball.x = w.x;
      ball.y = w.y;
      ball.radial = 0;
      return;
    }
    var wallNDist = getLevel2BallRadial(ball.jumpOffset, ball.ringRise);
    ball.radial = wallNDist;
    var rz = Level2Track.tunnelGroup.rotation.z;
    var latFace = getLevel2LatFromWorldX(ball.faceIndex, ball.lat, wallNDist, rz);
    var world = getLevel2WorldPos(ball.faceIndex, latFace, wallNDist, rz);
    ball.x = world.x;
    ball.y = world.y;
  }

  function syncFloatFromWall() {
    applyBallPosition('subway');
    var loc = level2WorldToLocalXY(ball.x, ball.y);
    var c = clampLevel2TriangleLocal(loc.x, loc.y);
    ball.floatLX = c.x;
    ball.floatLY = c.y;
  }

  function syncLatFromFloat() {
    var w = level2LocalToWorldXY(ball.floatLX, ball.floatLY);
    ball.lat = w.x;
    ball.latTarget = ball.lat;
  }

  function triggerRingPortal(kind) {
    if (kind === 'in') {
      if (ball.ringLayer === 1 && ball.ringRise > LEVEL2_CONFIG.RINGS.CEIL_RISE * 0.85) return;
      ball.ringLayer = 1;
      ball.ringFromRise = ball.ringRise;
      ball.ringToRise = LEVEL2_CONFIG.RINGS.CEIL_RISE;
      ball.ringSwitchT = LEVEL2_CONFIG.RINGS.SWITCH_DUR;
    } else if (kind === 'out') {
      if (ball.ringLayer === 0 && ball.ringRise < 0.08) return;
      ball.ringLayer = 0;
      ball.ringFromRise = ball.ringRise;
      ball.ringToRise = 0;
      ball.ringSwitchT = LEVEL2_CONFIG.RINGS.SWITCH_DUR;
    }
    jumpCooldown = LEVEL2_CONFIG.JUMP_COOLDOWN + 0.08;
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
    ball.latTarget = THREE.MathUtils.clamp(n * half, -half, half);
    ball.lat += (ball.latTarget - ball.lat) * Math.min(dt * LEVEL2_CONFIG.LATERAL_LERP, 1);
    if (ball.lat > half) ball.lat = half;
    if (ball.lat < -half) ball.lat = -half;
  }

  function updateFloat2D(dt) {
    var inp = Input.getFloat2DInput();
    var speed = LEVEL2_CONFIG.ROLLING.FLOAT_SPEED;
    var rz = Level2Track.tunnelGroup.rotation.z;
    var c = Math.cos(rz);
    var s = Math.sin(rz);
    var worldDx = inp.x * speed * dt;
    var worldDy = inp.y * speed * dt;
    var localDx = worldDx * c + worldDy * s;
    var localDy = -worldDx * s + worldDy * c;
    ball.floatLX += localDx;
    ball.floatLY += localDy;
    var clamped = clampLevel2TriangleLocal(ball.floatLX, ball.floatLY);
    ball.floatLX = clamped.x;
    ball.floatLY = clamped.y;
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
    if (edgeId !== 'rolling' && Input.consumeJump()) tryJump(edgeId);
    if (edgeId === 'rolling') {
      ball.jumpOffset = 0;
      ball.jumpVel = 0;
      return;
    }
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
    var camCfg = LEVEL2_CONFIG.CAMERA;
    var aspect = window.innerWidth / window.innerHeight;
    var posY = camCfg.POS_Y;
    var posZ = camCfg.PORTRAIT_Z;
    if (aspect < 0.6) {
      camera.fov = CONFIG.CAMERA.PORTRAIT_FOV;
    } else if (aspect > 1.5) {
      camera.fov = CONFIG.CAMERA.LANDSCAPE_FOV;
      posY = camCfg.LANDSCAPE_POS_Y;
      posZ = camCfg.LANDSCAPE_Z;
    } else {
      camera.fov = 55;
      posY = camCfg.SQUARE_POS_Y;
      posZ = camCfg.SQUARE_Z;
    }
    camera.position.set(0, posY, posZ);
    camera.lookAt(0, camCfg.LOOK_Y, camCfg.LOOK_Z);
    camera.updateProjectionMatrix();
  }

  function onEdgeIndexChange(idx) {
    if (idx === lastEdgeIndex) return;
    if (idx === 1 && lastEdgeIndex !== 1) syncFloatFromWall();
    if (lastEdgeIndex === 1 && idx !== 1) {
      syncLatFromFloat();
      ball.jumpOffset = 0;
      ball.jumpVel = 0;
    }
    if (lastEdgeIndex === 2 && idx !== 2) resetRingState();
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
    syncRingStateForEdge(edgeInfo);

    var edgeId = edgeInfo.edge.id;
    var floatActive = edgeId === 'rolling' && !inTrans;
    if (Input.setFloat2DMode) Input.setFloat2DMode(floatActive);
    if (floatActive) updateFloat2D(dt);
    else updateLateral(dt, edgeId);
    updateJump(dt, edgeId);

    Level2Track.setTunnelRotation(tunnelRotationFor(STATE.distance, edgeInfo));
    applyBallPosition(floatActive ? 'rolling' : edgeId);
    STATE.ballAngle = floatActive ? ball.x : ball.lat;

    if (window.HUD && HUD.setJumpVisible) HUD.setJumpVisible(edgeId !== 'rolling');

    if (window.Ball) Ball.setPosition(ball.x, ball.y, 0);
    if (window.pointLight) window.pointLight.position.set(ball.x, ball.y, 0);
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
    triggerRingPortal: triggerRingPortal,
    getBall: function () { return ball; },
  };
})();
