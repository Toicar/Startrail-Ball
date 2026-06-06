// world.js — 道具、障碍物生成（45° 车道系统）
window.World = (function () {
  'use strict';

  var group = new THREE.Group();
  var items = [];
  var LANES = CONFIG.LANES.ANGLES;
  var LANE_HALF_ANGLE = Math.PI / 8;
  var boostArrowMaterial;

  var ITEM_DEFS = {
    coin:             { color: 0xffc107, geo: 'coin',       size: 0.38 },
    magnet:           { color: 0xff4081, geo: 'torus',      size: 0.4 },
    shield:           { color: 0xffaa00, geo: 'sphere',     size: 0.45 },
    scoreX2:          { color: 0xea80fc, geo: 'star',       size: 0.45 },
    spike:            { color: 0xff00cc, geo: 'cone',       size: 0.55, hazard: true },
    rotatingBarrier:  { color: 0xff6d00, geo: 'box',        size: 0.65, hazard: true },
    bonusGate:        { color: 0x00e676, geo: 'torus',      size: 0.75 },
    checkpoint:       { color: 0x448aff, geo: 'ring',       size: 0.65 },
  };

  function getBallLane() {
    var ballAngle = window.STATE ? window.STATE.ballAngle : 0;
    var closest = 0, minDist = 999;
    for (var i = 0; i < LANES.length; i++) {
      var d = Math.abs(ballAngle - LANES[i]);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }

  function pickLane(biasToBall, spread) {
    if (!biasToBall || Math.random() > 0.5) {
      return LANES[Math.floor(Math.random() * LANES.length)];
    }
    var ballLane = getBallLane();
    var offset = Math.floor((Math.random() - 0.5) * (spread || 3));
    var idx = THREE.MathUtils.clamp(ballLane + offset, 0, LANES.length - 1);
    return LANES[idx];
  }

  function angleDiff(a, b) {
    var d = Math.abs(a - b);
    return d > Math.PI ? 2 * Math.PI - d : d;
  }

  function getBoostArrowMaterial() {
    if (boostArrowMaterial) return boostArrowMaterial;
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 20;
    function drawChevron(cy) {
      ctx.beginPath();
      ctx.moveTo(32, cy + 32);
      ctx.lineTo(6, cy - 4);
      ctx.lineTo(18, cy - 4);
      ctx.lineTo(32, cy + 12);
      ctx.lineTo(46, cy - 4);
      ctx.lineTo(58, cy - 4);
      ctx.closePath();
      ctx.fill();
    }
    drawChevron(28);
    drawChevron(100);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
    drawChevron(28);
    drawChevron(100);
    ctx.globalCompositeOperation = 'source-over';
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    boostArrowMaterial = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide,
      depthWrite: false,
    });
    return boostArrowMaterial;
  }

  function createSpeedBoostStrip(zCenter, angle, pipeRadius, stripLength) {
    var baseMat = getBoostArrowMaterial();
    var tex = baseMat.map.clone();
    tex.repeat.set(1, Math.max(1, stripLength / 2.2));
    var mat = baseMat.clone();
    mat.map = tex;

    // 贴合管道内壁：沿车道角宽的圆柱弧面（与管道同轴、同旋转）
    var wallR = pipeRadius - 0.02;
    var thetaStart = Math.PI - angle - LANE_HALF_ANGLE;
    var thetaLength = LANE_HALF_ANGLE * 2;
    var geo = new THREE.CylinderGeometry(
      wallR, wallR, stripLength, 8, 1, true, thetaStart, thetaLength
    );
    var strip = new THREE.Mesh(geo, mat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.z = zCenter;
    return strip;
  }

  function disposeItemMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map && child.material.map !== boostArrowMaterial.map) {
          child.material.map.dispose();
        }
        if (child.material !== boostArrowMaterial) child.material.dispose();
      }
    });
  }

  function createItemMesh(type) {
    var def = ITEM_DEFS[type];
    if (!def) return null;
    var geo;
    switch (def.geo) {
      case 'coin':       geo = new THREE.CylinderGeometry(def.size, def.size, 0.07, 16); break;
      case 'octahedron': geo = new THREE.OctahedronGeometry(def.size, 0); break;
      case 'torus':      geo = new THREE.TorusGeometry(def.size * 0.8, 0.08, 8, 16); break;
      case 'sphere':     geo = new THREE.SphereGeometry(def.size, 8, 8); break;
      case 'star':       geo = new THREE.OctahedronGeometry(def.size, 0); break;
      case 'cone':       geo = new THREE.ConeGeometry(def.size * 0.55, def.size * 1.1, 4); break;
      case 'ring':       geo = new THREE.TorusGeometry(def.size * 0.9, 0.1, 8, 24); break;
      case 'box':        geo = new THREE.BoxGeometry(def.size * 0.4, def.size, def.size * 0.2); break;
      default:           geo = new THREE.SphereGeometry(def.size, 6, 6);
    }
    var mat = new THREE.MeshStandardMaterial({
      color: def.color, roughness: def.geo === 'coin' ? 0.15 : 0.3,
      metalness: def.geo === 'coin' ? 0.85 : 0.5,
      emissive: def.color,
      emissiveIntensity: def.hazard ? 0.65 : (def.geo === 'coin' ? 0.9 : 0.7),
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
    items.push({ mesh: mesh, type: type, z: z, angle: angle, collected: false, radius: pipeRadius });
  }

  function placeSpeedBoostStrip(zCenter, angle, pipeRadius, stripLength) {
    var strip = createSpeedBoostStrip(zCenter, angle, pipeRadius, stripLength);
    group.add(strip);
    items.push({
      mesh: strip,
      type: 'speedBoost',
      z: zCenter,
      angle: angle,
      collected: false,
      radius: pipeRadius,
      stripLength: stripLength,
    });
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
    var len = zEnd - zStart;
    var ballLane = getBallLane();

    var coinPattern = Math.floor(Math.random() * 4);
    switch (coinPattern) {
      case 0:
        spawnCoinsOnLane(zStart, zEnd, pipeRadius, ballLane);
        break;
      case 1:
        spawnCoinArc(zStart + len * 0.5, pipeRadius, ballLane, 3 + Math.floor(Math.random() * 2), 2.0);
        break;
      case 2:
        spawnCoinsOnLane(zStart, zEnd, pipeRadius, THREE.MathUtils.clamp(ballLane - 1, 0, LANES.length - 1));
        spawnCoinsOnLane(zStart + len * 0.1, zEnd, pipeRadius, THREE.MathUtils.clamp(ballLane + 1, 0, LANES.length - 1));
        break;
      case 3:
        break;
    }

    if ((difficultyLevel >= 1 || Math.random() < 0.3) && Math.random() < 0.7) {
      var spikeLane = pickLane(true, 2);
      var spikeZ = zStart + len * (0.25 + Math.random() * 0.5);
      placeItem('spike', spikeZ, spikeLane, pipeRadius);
      if (difficultyLevel >= 2 && Math.random() < 0.5) {
        var lane2 = pickLane(true, 3);
        placeItem('spike', zStart + len * (0.6 + Math.random() * 0.3), lane2, pipeRadius);
      }
    }

    if (Math.random() < 0.35) {
      var boostLane = pickLane(false);
      var stripLen = CONFIG.BUFFS.SPEED_BOOST.stripLength;
      placeSpeedBoostStrip(zStart + len * (0.3 + Math.random() * 0.4), boostLane, pipeRadius, stripLen);
    }

    var buffRoll = Math.random();
    if (buffRoll < 0.15) placeItem('magnet', zStart + len * (0.3 + Math.random() * 0.4), pickLane(false), pipeRadius);
    else if (buffRoll > 0.85) placeItem('shield', zStart + len * (0.4 + Math.random() * 0.4), pickLane(false), pipeRadius);
    if (Math.random() < 0.08) placeItem('scoreX2', zStart + len * Math.random(), pickLane(false), pipeRadius);

    if (difficultyLevel >= 2 && Math.random() < 0.35) {
      placeItem('rotatingBarrier', zStart + len * (0.3 + Math.random() * 0.4), pickLane(true, 1), pipeRadius);
    }

    if (Math.random() < 0.1) {
      placeItem('bonusGate', zStart + len * (0.3 + Math.random() * 0.4), LANES[3], pipeRadius);
    }

    if (window.STATE && !window.STATE._cpPlaced) window.STATE._cpPlaced = {};
    var cpKey = Math.floor((window.STATE ? window.STATE.distance : 0) / (45 * CONFIG.BALL.BASE_SPEED));
    if (window.STATE && window.STATE._cpPlaced && !window.STATE._cpPlaced[cpKey]) {
      placeItem('checkpoint', zStart + len * 0.4, 0, pipeRadius);
      window.STATE._cpPlaced[cpKey] = true;
    }
  }

  function checkSpeedBoostCollision(item, ballAngle, ballZ) {
    if (angleDiff(ballAngle, item.angle) > LANE_HALF_ANGLE) return false;
    var halfStrip = item.stripLength / 2;
    return Math.abs(ballZ - item.z) <= halfStrip + CONFIG.BALL.RADIUS * 0.35;
  }

  function checkCollisions(ballX, ballY, ballZ) {
    var ballWorldPos = new THREE.Vector3(ballX, ballY, ballZ);
    var results = [];
    var magnetActive = window.STATE && window.STATE.activeBuffs && window.STATE.activeBuffs.magnet > 0;
    var magnetRange = magnetActive ? CONFIG.BUFFS.MAGNET.radius : 0;
    var itemWorldPos = new THREE.Vector3();
    var ballAngle = window.STATE ? window.STATE.ballAngle : 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.collected) continue;

      if (item.type === 'speedBoost') {
        if (checkSpeedBoostCollision(item, ballAngle, ballZ)) {
          item.collected = true;
          group.remove(item.mesh);
          disposeItemMesh(item.mesh);
          results.push({ type: item.type, angle: item.angle, z: item.z });
        }
        continue;
      }

      item.mesh.getWorldPosition(itemWorldPos);
      var dist = ballWorldPos.distanceTo(itemWorldPos);
      var def = ITEM_DEFS[item.type];
      var baseRadius = (def ? def.size : 0.5) + CONFIG.BALL.RADIUS + CONFIG.BALL.PICKUP_RANGE;
      var effectiveRadius = (item.type === 'coin' && magnetActive) ? magnetRange : baseRadius;

      if (dist < effectiveRadius) {
        item.collected = true;
        group.remove(item.mesh);
        disposeItemMesh(item.mesh);
        results.push({ type: item.type, angle: item.angle, z: item.z });
      }
    }
    return results;
  }

  function clearBehind(z) {
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].z < z - 15 || items[i].collected) {
        if (items[i].mesh.parent) {
          group.remove(items[i].mesh);
          disposeItemMesh(items[i].mesh);
        }
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

      if (item.type === 'speedBoost') {
        item.mesh.position.z = item.z;
        continue;
      }

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
      if (['magnet', 'shield', 'scoreX2', 'bonusGate', 'checkpoint'].indexOf(item.type) >= 0) {
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
    for (var i = 0; i < items.length; i++) {
      disposeItemMesh(items[i].mesh);
    }
    while (group.children.length > 0) group.remove(group.children[0]);
    items = [];
  }

  return {
    init: init, reset: reset, placeItem: placeItem,
    populateSegment: populateSegment, checkCollisions: checkCollisions,
    clearBehind: clearBehind, update: update, group: group
  };
})();
