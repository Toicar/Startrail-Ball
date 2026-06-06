// main.js — 主入口：场景、摄像机、渲染器、游戏循环
(function () {
  'use strict';

  // --- 全局状态 ---
  const STATE = {
    phase: 'start',
    score: 0,
    combo: 0,
    lastCoinTime: 0,
    distance: 0,
    speed: CONFIG.BALL.BASE_SPEED,
    ballAngle: 0,
    activeBuffs: {},
    hasShield: false,
    checkpointDistance: 0,
    elapsedTime: 0,
    difficultyLevel: 0,
    lives: 3,        // 生命值
    maxLives: 3,
    invincible: 0,   // 受伤后短暂无敌时间
  };
  window.STATE = STATE;

  // --- Three.js 初始化 ---
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000011);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  window.scene = scene;

  // 摄像机：在球正后方，看到管道截面全貌
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 80);
  camera.position.set(0, -1.5, -8);
  camera.lookAt(0, 0, 6);
  window.camera = camera;

  // 光照
  const ambientLight = new THREE.AmbientLight(0x223344, 0.6);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x4488ff, 1.5, 20);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);
  window.pointLight = pointLight;

  // --- 自适应尺寸（竖屏拉远 FOV、横屏收窄）---
  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;

    var aspect = w / h;
    if (aspect < 0.6) {
      // 竖屏：拉大 FOV + 拉远相机，限制角度防出画
      camera.fov = CONFIG.CAMERA.PORTRAIT_FOV;
      camera.position.z = CONFIG.CAMERA.PORTRAIT_Z;
      Input.setAngleRange(CONFIG.CAMERA.PORTRAIT_ANGLE_MAX);
    } else if (aspect > 1.5) {
      // 横屏
      camera.fov = CONFIG.CAMERA.LANDSCAPE_FOV;
      camera.position.z = CONFIG.CAMERA.LANDSCAPE_Z;
      Input.setAngleRange(CONFIG.CAMERA.LANDSCAPE_ANGLE_MAX);
    } else {
      // 中间比例（如桌面浏览器）
      camera.fov = 55;
      camera.position.z = -8;
      Input.setAngleRange(0.65);
    }
    camera.updateProjectionMatrix();
    Input.applyOrientation();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  resize();

  // --- 辅助函数 ---
  function safeGetStorage(key, defaultVal) {
    try { return localStorage.getItem(key) || defaultVal; }
    catch (e) { return defaultVal; }
  }
  function safeSetStorage(key, val) {
    try { localStorage.setItem(key, val); }
    catch (e) { /* 静默降级 */ }
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2600);
  }
  window.showToast = showToast;

  // --- 碰撞处理 ---
  function triggerBonusGold() {
    for (var i = 0; i < 15; i++) {
      World.placeItem('coin', 5 + Math.random() * 8, (Math.random() - 0.5) * 2, CONFIG.PIPE.BASE_RADIUS);
    }
  }

  function takeDamage() {
    if (STATE.invincible > 0) return;
    STATE.lives--;
    STATE.invincible = 1.5; // 1.5 秒无敌时间
    Ball.setInvincible(true);
    if (STATE.lives <= 0) {
      die();
    }
  }

  function die() {
    STATE.phase = 'dead';
    try { if (window.AudioFX) AudioFX.stopBGM(); } catch (e) {}
    var bestScore = parseInt(safeGetStorage('star_tunnel_best', '0'));
    if (STATE.score > bestScore) {
      safeSetStorage('star_tunnel_best', STATE.score);
      bestScore = STATE.score;
    }
    Screens.showDeath(STATE.score, bestScore, STATE.distance, STATE.elapsedTime);
    HUD.hide();
  }

  function handleCollision(col) {
    var ballThreePos = Ball.getPosition();
    switch (col.type) {
      case 'coin':
        STATE.combo++;
        STATE.lastCoinTime = STATE.elapsedTime;
        var multiplier = 1;
        if (STATE.combo >= 15) multiplier = CONFIG.SCORE.COMBO_MULTIPLIERS[2];
        else if (STATE.combo >= 10) multiplier = CONFIG.SCORE.COMBO_MULTIPLIERS[1];
        else if (STATE.combo >= 5) multiplier = CONFIG.SCORE.COMBO_MULTIPLIERS[0];
        var points = CONFIG.SCORE.COIN_BASE * multiplier;
        if (STATE.activeBuffs.scoreDouble > 0) points *= CONFIG.BUFFS.SCORE_DOUBLE.multiplier;
        STATE.score += points;
        if (window.AudioFX) AudioFX.coinCollect();
        if (window.Effects) Effects.spawnBurst(ballThreePos, 0xffd740);
        break;

      case 'speedBoost':
        STATE.activeBuffs.speedBoost = CONFIG.BUFFS.SPEED_BOOST.duration;
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'magnet':
        STATE.activeBuffs.magnet = CONFIG.BUFFS.MAGNET.duration;
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'shield':
        STATE.hasShield = true;
        Ball.setShieldActive(true);
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'scoreX2':
        STATE.activeBuffs.scoreDouble = CONFIG.BUFFS.SCORE_DOUBLE.duration;
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'spike':
        if (STATE.invincible > 0) break;
        if (window.Effects) Effects.spawnBurst(ballThreePos, 0xff1744);
        if (STATE.hasShield) {
          STATE.hasShield = false;
          Ball.setShieldActive(false);
        } else {
          if (window.AudioFX) AudioFX.hitObstacle();
          takeDamage();
        }
        break;

      case 'rotatingBarrier':
        if (STATE.invincible > 0) break;
        if (window.Effects) Effects.spawnBurst(ballThreePos, 0xff6d00);
        if (STATE.hasShield) {
          STATE.hasShield = false;
          Ball.setShieldActive(false);
        } else {
          if (window.AudioFX) AudioFX.hitObstacle();
          takeDamage();
        }
        break;

      case 'bonusGate':
        triggerBonusGold();
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'checkpoint':
        STATE.checkpointDistance = STATE.distance;
        if (window.AudioFX) AudioFX.checkpoint();
        break;
    }
  }

  // --- 游戏开始/恢复 ---
  window.startGame = function () {
    STATE.phase = 'playing';
    STATE.score = 0;
    STATE.combo = 0;
    STATE.lastCoinTime = 0;
    STATE.distance = 0;
    STATE.speed = CONFIG.BALL.BASE_SPEED;
    STATE.ballAngle = 0;
    STATE.activeBuffs = {};
    STATE.hasShield = false;
    STATE.lives = STATE.maxLives;
    STATE.invincible = 0;
    STATE.checkpointDistance = 0;
    STATE.elapsedTime = 0;
    STATE.difficultyLevel = 0;
    STATE._cpPlaced = {};
    STATE._pipeRotZ = 0;
    PipeSystem.group.rotation.z = 0;
    PipeSystem.ringGroup.rotation.z = 0;
    if (World.group) World.group.rotation.z = 0;

    Input.resetAngle();
    Physics.init();
    // ⚠️ 关键顺序：先清空 World，再生成管道（管道生成会调用 World.populateSegment）
    World.reset();
    PipeSystem.reset();
    PipeSystem.init();
    Ball.setShieldActive(false);

    Screens.hide();
    HUD.show();
    if (window.AudioFX) { AudioFX.resume(); AudioFX.startBGM(); }
  };

  window.resumeGame = function () {
    STATE.phase = 'playing';
    Screens.hide();
  };

  // --- 暂停 ---
  canvas.addEventListener('click', function (e) {
    if (STATE.phase !== 'playing' && STATE.phase !== 'paused') return;
    if (e.clientY < window.innerHeight * 0.12) {
      if (STATE.phase === 'playing') {
        STATE.phase = 'paused';
        Screens.showPause();
      }
    }
  });

  // --- 游戏循环 ---
  var clock = new THREE.Clock();
  function gameLoop() {
    requestAnimationFrame(gameLoop);
    var dt = Math.min(clock.getDelta(), 0.1);

    if (STATE.phase === 'playing') {
      STATE.elapsedTime += dt;

      // 渐进加速 + 难度倍率
      var diff = getCurrentDifficulty(STATE.elapsedTime);
      STATE.difficultyLevel = diff.index;
      var rampSpeed = CONFIG.BALL.BASE_SPEED + STATE.elapsedTime * CONFIG.BALL.SPEED_RAMP;
      var baseSpeed = Math.min(rampSpeed * diff.speedMul, CONFIG.BALL.MAX_SPEED);

      // Buff 速度修正
      var speedMultiplier = 1;
      if (STATE.activeBuffs.speedBoost > 0) speedMultiplier *= CONFIG.BUFFS.SPEED_BOOST.speedMul;

      var finalSpeed = baseSpeed * speedMultiplier;
      Physics.setSpeed(finalSpeed);
      STATE.speed = finalSpeed;
      STATE.distance += finalSpeed * dt;

      // 连续角度输入（键盘/触屏持续更新）
      Input.update(dt);
      var targetAngle = Input.getTargetAngle();
      var pipeR = PipeSystem.getPipeRadiusAt(0);

      // 球平滑移动到目标角度（连续角度，无级变速）
      var smoothAngle = Physics.updateLane(targetAngle, pipeR, dt);
      STATE.ballAngle = smoothAngle;
      var ballX = Math.sin(smoothAngle) * (pipeR - CONFIG.BALL.RADIUS);
      var ballY = -Math.cos(smoothAngle) * (pipeR - CONFIG.BALL.RADIUS);
      Ball.setPosition(ballX, ballY, 0);

      // 管道旋转跟随球角度
      var targetRotZ = -smoothAngle;
      if (STATE._pipeRotZ === undefined) STATE._pipeRotZ = 0;
      STATE._pipeRotZ += (targetRotZ - STATE._pipeRotZ) * Math.min(dt * 5, 1);
      PipeSystem.group.rotation.z = STATE._pipeRotZ;
      PipeSystem.ringGroup.rotation.z = STATE._pipeRotZ;
      World.group.rotation.z = STATE._pipeRotZ;
      pointLight.position.set(ballX, ballY, 0);

      // 管道滚动
      PipeSystem.update(finalSpeed, dt, STATE.elapsedTime, STATE.difficultyLevel, STATE.distance);

      // 碰撞检测
      if (window.World) {
        try {
          var collisions = World.checkCollisions(ballX, ballY, 0);
          for (var i = 0; i < collisions.length; i++) {
            handleCollision(collisions[i]);
          }
          World.update(dt, finalSpeed);
          World.clearBehind(-15);
        } catch (e) {
          console.error('Collision error:', e);
        }
      }

      // 无敌计时
      if (STATE.invincible > 0) {
        STATE.invincible -= dt;
        if (STATE.invincible <= 0) {
          STATE.invincible = 0;
          Ball.setInvincible(false);
        }
      }

      // Buff 计时器
      var keys = Object.keys(STATE.activeBuffs);
      for (var k = 0; k < keys.length; k++) {
        STATE.activeBuffs[keys[k]] -= dt;
        if (STATE.activeBuffs[keys[k]] <= 0) {
          delete STATE.activeBuffs[keys[k]];
        }
      }

      // Combo 超时
      if (STATE.elapsedTime - STATE.lastCoinTime > 1.5) {
        STATE.combo = 0;
      }

      // 粒子
      if (window.Effects) {
        Effects.updateTrail(Ball.getPosition());
        Effects.updateBursts(dt);
      }

      // HUD
      if (window.HUD) HUD.update(STATE);
    }

    renderer.render(scene, camera);
  }

  // 后台自动暂停
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && STATE.phase === 'playing') {
      STATE.phase = 'paused';
      Screens.showPause();
    }
  });

  // 全局错误处理
  window.addEventListener('error', function (e) {
    console.error('游戏错误:', e.error);
    showToast('哎呀，出错了，请重启试试吧~');
    if (STATE.phase === 'playing') {
      STATE.phase = 'dead';
      var bestScore = parseInt(safeGetStorage('star_tunnel_best', '0'));
      Screens.showDeath(STATE.score, bestScore, STATE.distance, STATE.elapsedTime);
    }
  });

  // --- 启动 ---
  // 场景初始化（一次性） ⚠️ 顺序重要：World 先于 PipeSystem
  if (window.Ball) Ball.init();
  if (window.World) World.init();
  if (window.PipeSystem) PipeSystem.init();
  if (window.Input) Input.init();
  if (window.Effects) Effects.init();
  if (window.HUD) HUD.init();
  if (window.AudioFX) AudioFX.init();

  gameLoop();
  Screens.showStart();
})();
