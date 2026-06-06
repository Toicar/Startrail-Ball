// world.js — 道具、障碍物生成（45° 车道系统）
window.World = (function () {
  'use strict';

  var group = new THREE.Group();
  var items = [];
  var LANES = CONFIG.LANES.ANGLES; // [-135°, -90°, -45°, 0°, 45°, 90°, 135°]

  var ITEM_DEFS = {
    coin:             { color: 0xffd740, geo: 'octahedron', size: 0.35 },
    speedBoost:       { color: 0x00e5ff, geo: 'diamond',   size: 0.55 },
    magnet:           { color: 0xff4081, geo: 'torus',      size: 0.4 },
    shield:           { color: 0xffaa00, geo: 'sphere',     size: 0.45 },
    scoreX2:          { color: 0xea80fc, geo: 'star',       size: 0.45 },
    spike:            { color: 0xff1744, geo: 'cone',       size: 0.5, hazard: true },
    rotatingBarrier:  { color: 0xff6d00, geo: 'box',        size: 0.65, hazard: true },
    bonusGate:        { color: 0x00e676, geo: 'torus',      size: 0.75 },
    checkpoint:       { color: 0x448aff, geo: 'ring',       size: 0.65 },
  };

  // 获取球当前所在车道索引
  function getBallLane() {
    var ballAngle = window.STATE ? window.STATE.ballAngle : 0;
    var closest = 0, minDist = 999;
    for (var i = 0; i < LANES.length; i++) {
      var d = Math.abs(ballAngle - LANES[i]);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }

  // 选取与球路径相关的车道（球当前车道 ±1 优先）
  function pickLane(biasToBall, spread) {
    if (!biasToBall || Math.random() > 0.5) {
      return LANES[Math.floor(Math.random() * LANES.length)];
    }
    var ballLane = getBallLane();
    var offset = Math.floor((Math.random() - 0.5) * (spread || 3));
    var idx = THREE.MathUtils.clamp(ballLane + offset, 0, LANES.length - 1);
    return LANES[idx];
  }

  function createItemMesh(type) {
    var def = ITEM_DEFS[type];
    if (!def) return null;
    var geo;
    switch (def.geo) {
      case 'octahedron': geo = new THREE.OctahedronGeometry(def.size, 0); break;
      case 'diamond':    geo = new THREE.OctahedronGeometry(def.size, 0); break;
      case 'torus':      geo = new THREE.TorusGeometry(def.size * 0.8, 0.08, 8, 16); break;
      case 'sphere':     geo = new THREE.SphereGeometry(def.size, 8, 8); break;
      case 'star':       geo = new THREE.OctahedronGeometry(def.size, 0); break;
      case 'cone':       geo = new THREE.ConeGeometry(def.size * 0.6, def.size, 6); break;
      case 'ring':       geo = new THREE.TorusGeometry(def.size * 0.9, 0.1, 8, 24); break;
      case 'box':        geo = new THREE.BoxGeometry(def.size * 0.4, def.size, def.size * 0.2); break;
      default:           geo = new THREE.SphereGeometry(def.size, 6, 6);
    }
    var mat = new THREE.MeshStandardMaterial({
      color: def.color, roughness: 0.3, metalness: 0.5,
      emissive: def.color, emissiveIntensity: def.hazard ? 0.5 : 0.7,
    });
    return new THREE.Mesh(geo, mat);
  }

  function placeItem(type, z, angle, pipeRadius) {
    var mesh = createItemMesh(type);
    if (!mesh) return;
    var r = pipeRadius - 0.3;
    mesh.position.set(Math.sin(angle) * r, -Math.cos(angle) * r, z);
    mesh.lookAt(0, 0, z + 2);
    group.add(mesh);
    var itemData = { mesh: mesh, type: type, z: z, angle: angle, collected: false, radius: pipeRadius };
    if (type === 'rotatingBarrier') itemData.baseAngle = angle;
    items.push(itemData);
  }

  function spawnCoinArc(zCenter, pipeRadius, laneIdx, count, zSpacing) {
    for (var i = 0; i < count; i++) {
      var angle = LANES[THREE.MathUtils.clamp(laneIdx + i - Math.floor(count / 2), 0, LANES.length - 1)];
      placeItem('coin', zCenter + (i - (count - 1) / 2) * zSpacing, angle, pipeRadius);
    }
  }

  function spawnCoinsOnLane(zStart, zEnd, pipeRadius, laneIdx) {
    var count = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i++) {
      placeItem('coin', zStart + (zEnd - zStart) * (i + 1) / (count + 1), LANES[laneIdx], pipeRadius);
    }
  }

  function populateSegment(zStart, zEnd, pipeRadius, difficultyLevel) {
    var diffIdx = Math.min(difficultyLevel, CONFIG.DIFFICULTY.length - 1);
    var diff = CONFIG.DIFFICULTY[diffIdx];
    var len = zEnd - zStart;
    var ballLane = getBallLane();

    // 金币：在球附近车道 + 随机相邻车道
    var coinPattern = Math.floor(Math.random() * 4);
    switch (coinPattern) {
      case 0:
        // 球所在车道
        spawnCoinsOnLane(zStart, zEnd, pipeRadius, ballLane);
        break;
      case 1:
        // 球车道 + 偏移 1 车道（形成弧线）
        spawnCoinArc(zStart + len * 0.5, pipeRadius, ballLane, 3 + Math.floor(Math.random() * 2), 2.0);
        break;
      case 2:
        // 两条相邻车道
        spawnCoinsOnLane(zStart, zEnd, pipeRadius, THREE.MathUtils.clamp(ballLane - 1, 0, LANES.length - 1));
        spawnCoinsOnLane(zStart + len * 0.1, zEnd, pipeRadius, THREE.MathUtils.clamp(ballLane + 1, 0, LANES.length - 1));
        break;
      case 3:
        // 空段
        break;
    }

    // 尖刺：高概率出现在球当前车道和相邻车道
    if ((difficultyLevel >= 1 || Math.random() < 0.3) && Math.random() < 0.7) {
      var spikeLane = pickLane(true, 2);
      var spikeZ = zStart + len * (0.25 + Math.random() * 0.5);
      placeItem('spike', spikeZ, spikeLane, pipeRadius);
      // 后期加第二个尖刺
      if (difficultyLevel >= 2 && Math.random() < 0.5) {
        var lane2 = pickLane(true, 3);
        placeItem('spike', zStart + len * (0.6 + Math.random() * 0.3), lane2, pipeRadius);
      }
    }

    // 加速带（车道中心，稀有）
    if (Math.random() < 0.35) {
      var boostLane = pickLane(false);
      placeItem('speedBoost', zStart + len * (0.3 + Math.random() * 0.4), boostLane, pipeRadius);
    }

    // Buff
    var buffRoll = Math.random();
    if (buffRoll < 0.15) placeItem('magnet', zStart + len * (0.3 + Math.random() * 0.4), pickLane(false), pipeRadius);
    else if (buffRoll > 0.85) placeItem('shield', zStart + len * (0.4 + Math.random() * 0.4), pickLane(false), pipeRadius);
    if (Math.random() < 0.08) placeItem('scoreX2', zStart + len * Math.random(), pickLane(false), pipeRadius);

    // 旋转障碍（挑战后）
    if (difficultyLevel >= 2 && Math.random() < 0.35) {
      placeItem('rotatingBarrier', zStart + len * (0.3 + Math.random() * 0.4), pickLane(true, 1), pipeRadius);
    }

    // Bonus 门
    if (Math.random() < 0.1) {
      placeItem('bonusGate', zStart + len * (0.3 + Math.random() * 0.4), LANES[3], pipeRadius);
    }

    // 检查点
    if (window.STATE && !window.STATE._cpPlaced) window.STATE._cpPlaced = {};
    var cpKey = Math.floor((window.STATE ? window.STATE.distance : 0) / (45 * CONFIG.BALL.BASE_SPEED));
    if (window.STATE && window.STATE._cpPlaced && !window.STATE._cpPlaced[cpKey]) {
      placeItem('checkpoint', zStart + len * 0.4, 0, pipeRadius);
      window.STATE._cpPlaced[cpKey] = true;
    }
  }

  function checkCollisions(ballX, ballY, ballZ) {
    var ballWorldPos = new THREE.Vector3(ballX, ballY, ballZ);
    var results = [];
    var magnetActive = window.STATE && window.STATE.activeBuffs && window.STATE.activeBuffs.magnet > 0;
    var magnetRange = magnetActive ? CONFIG.BUFFS.MAGNET.radius : 0;
    var itemWorldPos = new THREE.Vector3();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.collected) continue;
      // 用世界坐标计算距离（考虑 pipe/group 旋转）
      item.mesh.getWorldPosition(itemWorldPos);
      var dist = ballWorldPos.distanceTo(itemWorldPos);
      var def = ITEM_DEFS[item.type];
      var baseRadius = (def ? def.size : 0.5) + CONFIG.BALL.RADIUS + CONFIG.BALL.PICKUP_RANGE;
      var effectiveRadius = (item.type === 'coin' && magnetActive) ? magnetRange : baseRadius;

      if (dist < effectiveRadius) {
        item.collected = true;
        group.remove(item.mesh);
        results.push({ type: item.type, angle: item.angle, z: item.z });
      }
    }
    return results;
  }

  function clearBehind(z) {
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].z < z - 15 || items[i].collected) {
        if (items[i].mesh.parent) group.remove(items[i].mesh);
        items.splice(i, 1);
      }
    }
  }

  function update(dt, speed) {
    var delta = speed * dt;
    for (var i = items.length - 1; i >= 0; i--) {
      var item = items[i];
      if (item.collected) { items.splice(i, 1); continue; }
      item.z -= delta;

      if (item.type === 'rotatingBarrier') {
        var t = window.STATE ? window.STATE.elapsedTime : 0;
        var newAngle = item.baseAngle + t * 1.8 + item.z * 0.35;
        item.angle = newAngle;
        var r = item.radius - 0.3;
        item.mesh.position.x = Math.sin(newAngle) * r;
        item.mesh.position.y = -Math.cos(newAngle) * r;
        item.mesh.position.z = item.z;
        item.mesh.rotation.z += 0.04;
        continue;
      }
      if (item.type === 'coin') {
        item.mesh.rotation.y += 0.05;
        item.mesh.rotation.x += 0.03;
        item.mesh.position.z = item.z;
        var t2 = window.STATE ? window.STATE.elapsedTime : 0;
        item.mesh.position.z += Math.sin(t2 * 3 + item.angle * 5) * 0.15;
        continue;
      }
      if (['speedBoost', 'magnet', 'shield', 'scoreX2', 'bonusGate', 'checkpoint'].indexOf(item.type) >= 0) {
        var t3 = window.STATE ? window.STATE.elapsedTime : 0;
        item.mesh.position.z = item.z + Math.sin(t3 * 2.5 + item.angle * 3) * 0.2;
        item.mesh.rotation.y += 0.03;
        continue;
      }
      item.mesh.position.z = item.z;
    }
  }

  function init() {
    if (group.parent !== window.scene) window.scene.add(group);
  }

  function reset() {
    while (group.children.length > 0) group.remove(group.children[0]);
    items = [];
  }

  return {
    init: init, reset: reset, placeItem: placeItem,
    populateSegment: populateSegment, checkCollisions: checkCollisions,
    clearBehind: clearBehind, update: update, group: group
  };
})();
