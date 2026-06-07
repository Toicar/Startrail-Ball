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
    baseSpeed: CONFIG.BALL.BASE_SPEED,
    ballAngle: 0,
    activeBuffs: {},
    speedBoostStacks: 0,
    _boostDashTriggered: false,
    hasShield: false,
    elapsedTime: 0,
    difficultyLevel: 0,
    lives: 3,        // 生命值
    maxLives: 3,
    invincible: 0,   // 受伤后短暂无敌时间
  };
  window.STATE = STATE;

  // --- Three.js 初始化 ---
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x020818, 0);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020818, 0.008);
  window.scene = scene;

  // 摄像机：在球正后方，看到管道截面全貌
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 80);
  camera.position.set(0, -1.5, -8);
  camera.lookAt(0, 0, 6);
  window.camera = camera;

  // 光照
  const ambientLight = new THREE.AmbientLight(0x334466, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x00ccff, 1.8, 25);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);
  window.pointLight = pointLight;

  // 深空星云背景
  var nebulaMesh = (function () {
    var bgVS = [
      'varying vec3 vPos;',
      'void main() {',
      '  vPos = position;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n');
    var bgFS = [
      'varying vec3 vPos;',
      'uniform float uTime;',
      'float random(vec2 st) {',
      '  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);',
      '}',
      'void main() {',
      '  vec3 dir = normalize(vPos);',
      '  float t = uTime * 0.05;',
      '  vec3 col = mix(vec3(0.01, 0.02, 0.08), vec3(0.12, 0.04, 0.22), dir.y * 0.5 + 0.5);',
      '  col += vec3(0.25, 0.08, 0.4) * pow(max(0.0, sin(dir.x * 3.0 + t)), 4.0) * 0.4;',
      '  col += vec3(0.15, 0.05, 0.3) * pow(max(0.0, cos(dir.z * 2.5 - t * 0.7)), 3.0) * 0.35;',
      '  gl_FragColor = vec4(col, 0.34);',
      '}'
    ].join('\n');
    var geo = new THREE.SphereGeometry(55, 32, 32);
    var mat = new THREE.ShaderMaterial({
      vertexShader: bgVS,
      fragmentShader: bgFS,
      uniforms: { uTime: { value: 0 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    scene.add(mesh);
    return mesh;
  })();

  // --- 自适应尺寸（竖屏拉远 FOV、横屏收窄）---
  function resize() {
    var container = document.getElementById('game-container');
    var w = (container && container.clientWidth) ? container.clientWidth : window.innerWidth;
    var h = (container && container.clientHeight) ? container.clientHeight : window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;

    var aspect = w / h;
    if (aspect < 0.6) {
      // 竖屏：拉大 FOV + 拉远相机，限制角度防出画
      camera.fov = CONFIG.CAMERA.PORTRAIT_FOV;
      var safeHalfWidth = CONFIG.PIPE.BASE_RADIUS + CONFIG.BALL.RADIUS + 0.65;
      var fovRad = THREE.MathUtils.degToRad(camera.fov);
      var neededDepth = safeHalfWidth / (Math.tan(fovRad * 0.5) * Math.max(aspect, 0.36));
      camera.position.z = -Math.max(Math.abs(CONFIG.CAMERA.PORTRAIT_Z), neededDepth);
      Input.setAngleRange(CONFIG.CAMERA.PORTRAIT_ANGLE_MAX);
    } else if (aspect > 1.5) {
      // 横屏
      camera.fov = CONFIG.CAMERA.LANDSCAPE_FOV;
      camera.position.z = CONFIG.CAMERA.LANDSCAPE_Z;
      Input.setAngleRange(CONFIG.CAMERA.LANDSCAPE_ANGLE_MAX);
    } else {
      // 中间比例（如桌面浏览器）
      camera.fov = 55;
      camera.position.z = -9.2;
      Input.setAngleRange(1.0);
    }
    camera.updateProjectionMatrix();
    Input.applyOrientation();
  }
  window.resizeGame = resize;
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

  function recordScore(score) {
    score = Math.floor(Number(score) || 0);
    if (score <= 0) return [];
    var board = [];
    try { board = JSON.parse(safeGetStorage('star_tunnel_scoreboard', '[]')); } catch (e) { board = []; }
    if (!Array.isArray(board)) board = [];
    board.push(score);
    board = board
      .map(function (item) { return Math.floor(Number(item) || 0); })
      .filter(function (item) { return item > 0; })
      .sort(function (a, b) { return b - a; })
      .slice(0, 10);
    safeSetStorage('star_tunnel_scoreboard', JSON.stringify(board));
    return board;
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2600);
  }
  window.showToast = showToast;

  var lastHapticAt = 0;
  function haptic(pattern, minGap) {
    if (!window.navigator || !window.navigator.vibrate) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (minGap && now - lastHapticAt < minGap) return;
    lastHapticAt = now;
    try { window.navigator.vibrate(pattern); } catch (e) {}
  }

  var screenShakeTimer = 0;
  function screenShake() {
    var container = document.getElementById('game-container');
    if (!container) return;
    container.classList.remove('damage-shake');
    void container.offsetWidth;
    container.classList.add('damage-shake');
    clearTimeout(screenShakeTimer);
    screenShakeTimer = setTimeout(function () {
      container.classList.remove('damage-shake');
    }, 340);
  }

  function shortestAngleDelta(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  function normalizeAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }

  function smoothStep01(t) {
    t = THREE.MathUtils.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function applyTunnelRotation(rotZ) {
    PipeSystem.group.rotation.z = rotZ;
    PipeSystem.ringGroup.rotation.z = rotZ;
    World.group.rotation.z = rotZ;
  }

  function triggerTunnelFlip(pipeRadius, startAngle) {
    if (STATE._tunnelFlip) return;
    var trackRadius = pipeRadius - CONFIG.BALL.RADIUS;
    var startRot = STATE._pipeRotZ || 0;
    var flipDirection = startAngle < 0 ? 1 : -1;
    var rotDelta = flipDirection * Math.PI;
    var finalRot = startRot + rotDelta;
    STATE._pipeFlipZ = finalRot;
    STATE._lastTunnelFlipAt = STATE.elapsedTime;
    Input.resetAngle();
    STATE._tunnelFlip = {
      time: 0,
      duration: 1.0,
      startAngle: startAngle,
      angleDelta: shortestAngleDelta(startAngle, 0),
      startRot: startRot,
      rotDelta: rotDelta,
      finalRot: finalRot,
      trackRadius: trackRadius
    };
  }

  function updateTunnelFlip(dt) {
    var flip = STATE._tunnelFlip;
    if (!flip) return null;
    flip.time += dt;
    var p = smoothStep01(flip.time / flip.duration);
    var angle = normalizeAngle(flip.startAngle + flip.angleDelta * p);
    var rotZ = flip.startRot + flip.rotDelta * p;
    var ballX = Math.sin(angle) * flip.trackRadius;
    var ballY = -Math.cos(angle) * flip.trackRadius;

    STATE._pipeRotZ = rotZ;
    STATE.ballAngle = angle;
    applyTunnelRotation(rotZ);
    Ball.setPosition(ballX, ballY, 0);
    pointLight.position.set(ballX, ballY, 0);

    if (flip.time >= flip.duration) {
      STATE._tunnelFlip = null;
      STATE._pipeRotZ = flip.finalRot;
      STATE._pipeFlipZ = flip.finalRot;
      STATE.ballAngle = 0;
      Physics.setAngle(0);
      Input.resetAngle();
      applyTunnelRotation(STATE._pipeRotZ);
      ballX = 0;
      ballY = -flip.trackRadius;
      Ball.setPosition(ballX, ballY, 0);
      pointLight.position.set(ballX, ballY, 0);
      angle = 0;
    }

    return { angle: angle, x: ballX, y: ballY };
  }

  // --- 碰撞处理 ---
  function triggerBonusGold() {
    for (var i = 0; i < 15; i++) {
      World.placeItem('coin', 5 + Math.random() * 8, (Math.random() - 0.5) * 2, CONFIG.PIPE.BASE_RADIUS);
    }
  }

  function takeDamage() {
    if (STATE.invincible > 0) return;
    haptic([70, 35, 95], 250);
    screenShake();
    STATE.lives--;
    STATE.invincible = 3.0; // 3s invincible window after damage.
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
    recordScore(STATE.score);
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
        if (STATE.activeBuffs.speedBoost > 0 || STATE.activeBuffs.dashBoost > 0) points *= 2;
        STATE.score += points;
        haptic(10, 55);
        if (window.AudioFX) AudioFX.coinCollect();
        if (window.Effects) Effects.spawnBurst(ballThreePos, 0xffd740);
        if (window.HUD && HUD.spawnCoinText) HUD.spawnCoinText(points);
        break;

      case 'speedBoost':
        if (STATE.invincible > 0) break;
        STATE.speedBoostStacks = Math.min(
          CONFIG.BUFFS.SPEED_BOOST.maxStacks,
          (STATE.speedBoostStacks || 0) + 1
        );
        STATE.activeBuffs.speedBoost = CONFIG.BUFFS.SPEED_BOOST.duration;
        if (STATE.speedBoostStacks >= CONFIG.BUFFS.SPEED_BOOST.maxStacks && !STATE._boostDashTriggered) {
          STATE.activeBuffs.dashBoost = CONFIG.BUFFS.SPEED_BOOST.dashDuration;
          STATE.invincible = Math.max(STATE.invincible || 0, CONFIG.BUFFS.SPEED_BOOST.dashDuration);
          STATE._boostDashTriggered = true;
          Ball.setInvincible(true);
          haptic([18, 18, 35, 18, 65], 160);
        }
        if (STATE.speedBoostStacks < CONFIG.BUFFS.SPEED_BOOST.maxStacks) {
          haptic([22, 18, 35], 120);
        }
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'magnet':
        STATE.activeBuffs.magnet = CONFIG.BUFFS.MAGNET.duration;
        haptic([18, 18, 45], 120);
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'shield':
        STATE.hasShield = true;
        Ball.setShieldActive(true);
        haptic([28, 24, 45], 120);
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'scoreX2':
        STATE.activeBuffs.scoreDouble = CONFIG.BUFFS.SCORE_DOUBLE.duration;
        haptic([18, 18, 30, 18, 42], 120);
        if (window.AudioFX) AudioFX.powerUp();
        break;

      case 'spike':
        if (STATE.invincible > 0) break;
        if (window.Effects) Effects.spawnBurst(ballThreePos, 0xff1744);
        if (STATE.hasShield) {
          STATE.hasShield = false;
          Ball.setShieldActive(false);
          haptic([35, 20, 55], 180);
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
          haptic([35, 20, 55], 180);
        } else {
          if (window.AudioFX) AudioFX.hitObstacle();
          takeDamage();
        }
        break;

      case 'bonusGate':
        triggerBonusGold();
        haptic([24, 20, 24, 20, 55], 150);
        if (window.AudioFX) AudioFX.powerUp();
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
    STATE.baseSpeed = CONFIG.BALL.BASE_SPEED;
    STATE.speedBoostStacks = 0;
    STATE.ballAngle = 0;
    STATE.activeBuffs = {};
    STATE.hasShield = false;
    STATE.lives = STATE.maxLives;
    STATE.invincible = 0;
    STATE.elapsedTime = 0;
    STATE.difficultyLevel = 0;
    STATE._cpPlaced = {};
    STATE._pipeRotZ = 0;
    STATE._pipeFlipZ = 0;
    STATE._lastTunnelFlipAt = -999;
    STATE._tunnelFlip = null;
    STATE._speedCapStartedAt = null;
    STATE._boostDashTriggered = false;
    applyTunnelRotation(0);

    Input.resetAngle();
    Physics.init();
    // ⚠️ 关键顺序：先清空 World，再生成管道（管道生成会调用 World.populateSegment）
    World.reset();
    PipeSystem.reset();
    PipeSystem.init();
    Ball.setInvincible(false);
    Ball.setShieldActive(false);

    Screens.hide();
    HUD.show();
    if (window.AudioFX) { AudioFX.resume(); AudioFX.startBGM(); }
  };

  window.resumeGame = function () {
    STATE.phase = 'playing';
    Screens.hide();
    if (window.AudioFX) { AudioFX.resume(); AudioFX.resumeBGM(); }
  };

  window.goToMainMenu = function () {
    STATE.phase = 'start';
    if (window.AudioFX) AudioFX.pauseBGM();
    if (window.HUD) HUD.hide();
    if (window.Input) Input.resetAngle();
    STATE.activeBuffs = {};
    STATE.speedBoostStacks = 0;
    STATE._boostDashTriggered = false;
    if (window.Ball) {
      Ball.setInvincible(false);
      Ball.setShieldActive(false);
    }
    Screens.showStart();
  };

  window.pauseGame = function () {
    if (STATE.phase !== 'playing') return;
    STATE.phase = 'paused';
    if (window.AudioFX) AudioFX.pauseBGM();
    Screens.showPause();
  };

  // --- 暂停（顶部热区，保留兼容）---
  canvas.addEventListener('click', function (e) {
    if (STATE.phase !== 'playing' && STATE.phase !== 'paused') return;
    if (e.clientY < window.innerHeight * 0.12) {
      window.pauseGame();
    }
  });

  // --- 游戏循环 ---
  var clock = new THREE.Clock();
  function gameLoop() {
    requestAnimationFrame(gameLoop);
    var dt = Math.min(clock.getDelta(), 0.1);

    if (STATE.phase === 'playing') {
      STATE.elapsedTime += dt;
      var diff = getCurrentDifficulty(STATE.elapsedTime);
      STATE.difficultyLevel = diff.index;
      var rampSpeed = CONFIG.BALL.BASE_SPEED + STATE.elapsedTime * CONFIG.BALL.SPEED_RAMP;
      var uncappedBaseSpeed = rampSpeed * diff.speedMul;
      var baseSpeed = Math.min(uncappedBaseSpeed, CONFIG.BALL.MAX_SPEED);
      if (uncappedBaseSpeed >= CONFIG.BALL.MAX_SPEED) {
        if (STATE._speedCapStartedAt === null || STATE._speedCapStartedAt === undefined) {
          STATE._speedCapStartedAt = STATE.elapsedTime;
        }
        var postCapTime = Math.max(0, STATE.elapsedTime - STATE._speedCapStartedAt);
        var postCapGain = (postCapTime / 30) * (CONFIG.BALL.POST_CAP_GAIN_PER_30S || 0.05);
        baseSpeed = CONFIG.BALL.MAX_SPEED * (1 + postCapGain);
      } else {
        STATE._speedCapStartedAt = null;
      }

      // Buff 速度修正
      var speedMultiplier = 1;
      STATE.baseSpeed = baseSpeed;
      var stackMultiplier = 1;
      if (STATE.activeBuffs.speedBoost > 0 && STATE.speedBoostStacks > 0) {
        stackMultiplier = 1 + (CONFIG.BUFFS.SPEED_BOOST.speedMul - 1) * STATE.speedBoostStacks;
      }
      var dashMultiplier = stackMultiplier * (CONFIG.BUFFS.SPEED_BOOST.dashMul || 2);
      if (STATE.activeBuffs.dashBoost > 0) {
        speedMultiplier = dashMultiplier;
      } else if (STATE.activeBuffs.dashDecay > 0) {
        var decayDuration = CONFIG.BUFFS.SPEED_BOOST.dashDecayDuration || 1.5;
        var decayT = THREE.MathUtils.clamp(STATE.activeBuffs.dashDecay / decayDuration, 0, 1);
        var decayEase = decayT * decayT * (3 - 2 * decayT);
        speedMultiplier = stackMultiplier + (dashMultiplier - stackMultiplier) * decayEase;
      } else {
        speedMultiplier = stackMultiplier;
      }

      var finalSpeed = baseSpeed * speedMultiplier;
      Physics.setSpeed(finalSpeed);
      STATE.speed = finalSpeed;
      STATE.distance += finalSpeed * dt;

      // 连续角度输入（键盘/触屏持续更新）
      var pipeR = PipeSystem.getPipeRadiusAt(0);
      var flipFrame = null;
      if (STATE._tunnelFlip) {
        var ballTrackR = pipeR - CONFIG.BALL.RADIUS;
        flipFrame = updateTunnelFlip(dt);
        var smoothAngle = flipFrame.angle;
        var ballX = flipFrame.x;
        var ballY = flipFrame.y;
      } else {
        Input.update(dt);
        var targetAngle = Input.getTargetAngle();

      // 球平滑移动到目标角度（连续角度，无级变速）
      var smoothAngle = Physics.updateLane(targetAngle, pipeR, dt);
      var ballTrackR = pipeR - CONFIG.BALL.RADIUS;
      var ballX = Math.sin(smoothAngle) * ballTrackR;
      var ballY = -Math.cos(smoothAngle) * ballTrackR;
      var heightProgress = (ballY + ballTrackR) / (ballTrackR * 2);
      if (heightProgress > 0.7 && STATE.elapsedTime - (STATE._lastTunnelFlipAt || -999) > 0.35) {
        triggerTunnelFlip(pipeR, smoothAngle);
        flipFrame = updateTunnelFlip(0);
        smoothAngle = flipFrame.angle;
        ballX = flipFrame.x;
        ballY = flipFrame.y;
      }
      if (!STATE._tunnelFlip) {
      STATE.ballAngle = smoothAngle;
      Ball.setPosition(ballX, ballY, 0);

      // 管道旋转跟随球角度
      var targetRotZ = (STATE._pipeFlipZ || 0) - smoothAngle;
      if (STATE._pipeRotZ === undefined) STATE._pipeRotZ = 0;
      STATE._pipeRotZ += shortestAngleDelta(STATE._pipeRotZ, targetRotZ) * Math.min(dt * 5, 1);
      applyTunnelRotation(STATE._pipeRotZ);
      pointLight.position.set(ballX, ballY, 0);

      // 管道滚动
      }
      }
      PipeSystem.update(finalSpeed, dt, STATE.elapsedTime, STATE.difficultyLevel, STATE.distance);

      // 碰撞检测
      if (window.World) {
        try {
          if (!STATE._tunnelFlip) {
            var collisions = World.checkCollisions(ballX, ballY, 0);
            for (var i = 0; i < collisions.length; i++) {
              handleCollision(collisions[i]);
            }
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
          if (STATE.hasShield) Ball.setShieldActive(true);
        }
      }

      // Buff 计时器
      var keys = Object.keys(STATE.activeBuffs);
      for (var k = 0; k < keys.length; k++) {
        var buffKey = keys[k];
        STATE.activeBuffs[buffKey] -= dt;
        if (STATE.activeBuffs[buffKey] <= 0) {
          delete STATE.activeBuffs[buffKey];
          if (buffKey === 'speedBoost') {
            STATE.speedBoostStacks = 0;
            STATE._boostDashTriggered = false;
          } else if (buffKey === 'dashBoost') {
            STATE.activeBuffs.dashDecay = Math.max(
              STATE.activeBuffs.dashDecay || 0,
              CONFIG.BUFFS.SPEED_BOOST.dashDecayDuration || 1.5
            );
          }
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
      if (window.HUD) {
        HUD.update(STATE);
        if (HUD.updateFloating) HUD.updateFloating(STATE, Ball.getPosition(), dt);
      }
    }

    var visTime = STATE.elapsedTime || performance.now() * 0.001;
    if (nebulaMesh) nebulaMesh.material.uniforms.uTime.value = visTime;
    if (window.Ball && Ball.updateVisuals) Ball.updateVisuals(visTime);

    renderer.render(scene, camera);
  }

  // 后台自动暂停
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && STATE.phase === 'playing') {
      STATE.phase = 'paused';
      if (window.AudioFX) AudioFX.pauseBGM();
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
      recordScore(STATE.score);
      Screens.showDeath(STATE.score, bestScore, STATE.distance, STATE.elapsedTime);
    }
  });

  // --- 启动 ---
  // 场景初始化（一次性） ⚠️ 顺序重要：World 先于 PipeSystem
  if (window.Ball) Ball.init();
  if (window.World) World.init();
  if (window.PipeSystem) PipeSystem.init();
  if (window.Input) Input.init();
  resize();
  if (window.Effects) Effects.init();
  if (window.HUD) HUD.init();
  if (window.AudioFX) AudioFX.init();

  gameLoop();
  Screens.showStart();
})();
