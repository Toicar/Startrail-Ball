// world.js — 道具、障碍物生成（45° 车道系统）
window.World = (function () {
  'use strict';

  var group = new THREE.Group();
  var items = [];
  var LANES = CONFIG.LANES.ANGLES;
  var LANE_HALF_ANGLE = Math.PI / 8;
  var boostArrowMaterial;
  var textureLoader;
  var itemTextureCache = {};
  var ITEM_ASSET_ROOT = './image/';
  var spawnSerial = 0;
  var tempParentQuat = new THREE.Quaternion();
  var tempBallLocalPos = new THREE.Vector3();

  var ITEM_DEFS = {
    coin:             { color: 0xffc107, asset: 'item_coin.png',       size: 0.5,  width: 1.18, height: 1.18, spin: 1.0 },
    magnet:           { color: 0xff4081, asset: 'item_magnet.png',     size: 0.58, width: 1.42, height: 1.16, spin: 0.35 },
    shield:           { color: 0xffaa00, asset: 'item_shield.png',     size: 0.62, width: 1.5,  height: 1.5,  spin: 0.25 },
    scoreX2:          { color: 0xea80fc, asset: 'item_double.png',     size: 0.62, width: 1.42, height: 1.42, spin: 0.45 },
    spike:            { color: 0xff00cc, asset: 'item_spike.png',      size: 0.7,  width: 1.5,  height: 1.5,  hazard: true },
    rotatingBarrier:  { color: 0xff6d00, asset: 'item_barrier.png',    size: 0.78, width: 1.55, height: 1.55, hazard: true, spin: 2.4 },
    bonusGate:        { color: 0x00e676, asset: 'item_bonus_gate.png', size: 0.95, width: 1.55, height: 1.55, spin: 0.6 },
  };

  function getBallLane() {
    var ballAngle = window.STATE ? window.STATE.ballAngle : 0;
    var closest = 0, minDist = 999;
    for (var i = 0; i < LANES.length; i++) {
      var d = angleDiff(ballAngle, LANES[i]);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }

  function wrapLaneIndex(idx) {
    return ((idx % LANES.length) + LANES.length) % LANES.length;
  }

  function pickLane(biasToBall, spread) {
    if (!biasToBall || Math.random() > 0.5) {
      return LANES[Math.floor(Math.random() * LANES.length)];
    }
    var ballLane = getBallLane();
    var maxSpread = spread || 3;
    var offset = Math.floor(Math.random() * (maxSpread * 2 + 1)) - maxSpread;
    var idx = wrapLaneIndex(ballLane + offset);
    return LANES[idx];
  }

  function normalizeAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
  }

  function angleDiff(a, b) {
    return Math.abs(normalizeAngle(a - b));
  }

  function getBoostArrowMaterial() {
    if (boostArrowMaterial) return boostArrowMaterial;
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 128);
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
      opacity: 0.88,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
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
    strip.renderOrder = 8;
    return strip;
  }

  function getItemTexture(asset) {
    if (itemTextureCache[asset]) return itemTextureCache[asset];
    if (!textureLoader) textureLoader = new THREE.TextureLoader();
    var src = (window.AssetData && window.AssetData.images && window.AssetData.images[asset]) || (ITEM_ASSET_ROOT + asset);
    var texture = textureLoader.load(src);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    itemTextureCache[asset] = texture;
    return texture;
  }

  function isCachedItemTexture(texture) {
    for (var key in itemTextureCache) {
      if (itemTextureCache[key] === texture) return true;
    }
    return false;
  }

  function disposeItemMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        var map = child.material.map;
        if (map && (!boostArrowMaterial || map !== boostArrowMaterial.map) && !isCachedItemTexture(map)) {
          child.material.map.dispose();
        }
        if (child.material !== boostArrowMaterial) child.material.dispose();
      }
    });
  }

  function createFallbackMesh(def) {
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

  function createItemBillboard(type, def) {
    var geo = new THREE.PlaneGeometry(def.width || 1, def.height || 1);
    var mat = new THREE.MeshBasicMaterial({
      map: getItemTexture(def.asset),
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = def.hazard ? 12 : 10;
    mesh.frustumCulled = false;
    mesh.userData.itemType = type;
    mesh.userData.billboard = true;
    mesh.userData.spin = def.spin || 0;
    return mesh;
  }

  function createItemMesh(type) {
    var def = ITEM_DEFS[type];
    if (!def) return null;
    if (def.asset) return createItemBillboard(type, def);
    return createFallbackMesh(def);
  }

  function getPipeOffset(z) {
    if (window.PipeSystem && PipeSystem.getCurveOffsetAt) return PipeSystem.getCurveOffsetAt(z);
    return { x: 0, y: 0 };
  }

  function setLanePosition(item, z) {
    var r = item.radius - 0.3;
    var offset = getPipeOffset(z);
    item.mesh.position.x = Math.sin(item.angle) * r + offset.x;
    item.mesh.position.y = -Math.cos(item.angle) * r + offset.y;
    item.mesh.position.z = z;
  }

  function faceCamera(mesh, spin) {
    if (!mesh || !mesh.userData || !mesh.userData.billboard || !window.camera) return;
    group.getWorldQuaternion(tempParentQuat).invert();
    mesh.quaternion.copy(tempParentQuat).multiply(window.camera.quaternion);
    if (spin) mesh.rotateZ(spin);
  }

  function placeItem(type, z, angle, pipeRadius) {
    var mesh = createItemMesh(type);
    if (!mesh) return;
    var offset = getPipeOffset(z);
    var r = pipeRadius - 0.3;
    mesh.position.set(Math.sin(angle) * r + offset.x, -Math.cos(angle) * r + offset.y, z);
    if (mesh.userData && mesh.userData.billboard) faceCamera(mesh, 0);
    else mesh.lookAt(0, 0, z + 2);
    group.add(mesh);
    items.push({ mesh: mesh, type: type, z: z, angle: angle, baseAngle: angle, visualSpin: 0, collected: false, radius: pipeRadius });
  }

  function placeSpeedBoostStrip(zCenter, angle, pipeRadius, stripLength) {
    var strip = createSpeedBoostStrip(zCenter, angle, pipeRadius, stripLength);
    var offset = getPipeOffset(zCenter);
    strip.position.x = offset.x;
    strip.position.y = offset.y;
    group.add(strip);
    items.push({
      mesh: strip,
      type: 'speedBoost',
      z: zCenter,
      prevZ: zCenter,
      angle: angle,
      collected: false,
      radius: pipeRadius,
      stripLength: stripLength,
    });
  }

  function spawnCoinArc(zCenter, pipeRadius, laneIdx, count, zSpacing) {
    for (var i = 0; i < count; i++) {
      var angle = LANES[wrapLaneIndex(laneIdx + i - Math.floor(count / 2))];
      placeItem('coin', zCenter + (i - (count - 1) / 2) * zSpacing, angle, pipeRadius);
    }
  }

  function spawnCoinsOnLane(zStart, zEnd, pipeRadius, laneIdx, count) {
    count = count || (2 + Math.floor(Math.random() * 2));
    for (var i = 0; i < count; i++) {
      placeItem('coin', zStart + (zEnd - zStart) * (i + 1) / (count + 1), LANES[laneIdx], pipeRadius);
    }
  }

  function populateSegment(zStart, zEnd, pipeRadius, difficultyLevel) {
    var diffIdx = Math.min(difficultyLevel, CONFIG.DIFFICULTY.length - 1);
    var len = zEnd - zStart;
    var ballLane = getBallLane();
    var segIndex = spawnSerial++;
    var fairLane = Math.floor(Math.random() * LANES.length);
    var primaryLane = (segIndex < 2 || Math.random() < 0.42) ? ballLane : fairLane;

    if (segIndex < 2 || Math.random() < 0.68) {
      var coinPattern = Math.floor(Math.random() * 3);
      switch (coinPattern) {
        case 0:
          spawnCoinsOnLane(zStart, zEnd, pipeRadius, primaryLane);
          break;
        case 1:
          spawnCoinArc(zStart + len * 0.5, pipeRadius, primaryLane, 3, 2.15);
          break;
        case 2:
          spawnCoinsOnLane(zStart, zEnd, pipeRadius, wrapLaneIndex(primaryLane + (Math.random() < 0.5 ? -1 : 1)), 2);
          break;
      }
    }

    if ((difficultyLevel >= 1 || Math.random() < 0.18) && Math.random() < 0.45) {
      var spikeLane = pickLane(true, 2);
      var spikeZ = zStart + len * (0.25 + Math.random() * 0.5);
      placeItem('spike', spikeZ, spikeLane, pipeRadius);
      if (difficultyLevel >= 2 && Math.random() < 0.5) {
        var lane2 = pickLane(true, 3);
        placeItem('spike', zStart + len * (0.6 + Math.random() * 0.3), lane2, pipeRadius);
      }
    }

    if (segIndex % 6 === 2 || Math.random() < 0.2) {
      var boostLane = pickLane(false);
      var stripLen = CONFIG.BUFFS.SPEED_BOOST.stripLength;
      placeSpeedBoostStrip(zStart + len * (0.3 + Math.random() * 0.4), boostLane, pipeRadius, stripLen);
    }

    var buffRoll = Math.random();
    if (segIndex % 10 === 3 || buffRoll < 0.09) placeItem('magnet', zStart + len * (0.3 + Math.random() * 0.4), pickLane(false), pipeRadius);
    else if (segIndex % 12 === 7 || buffRoll > 0.93) placeItem('shield', zStart + len * (0.4 + Math.random() * 0.4), pickLane(false), pipeRadius);
    if (segIndex % 11 === 5 || Math.random() < 0.06) placeItem('scoreX2', zStart + len * Math.random(), pickLane(false), pipeRadius);

    var rotatingBarrierChance = 0;
    if (difficultyLevel >= 3) rotatingBarrierChance = 0.45;
    else if (difficultyLevel >= 2) rotatingBarrierChance = 0.35;
    else if (difficultyLevel >= 1) rotatingBarrierChance = 0.18;

    if (rotatingBarrierChance > 0 && Math.random() < rotatingBarrierChance) {
      placeItem('rotatingBarrier', zStart + len * (0.3 + Math.random() * 0.4), pickLane(true, 1), pipeRadius);
    }

    if (segIndex % 14 === 8 || Math.random() < 0.05) {
      placeItem('bonusGate', zStart + len * (0.3 + Math.random() * 0.4), 0, pipeRadius);
    }

  }

  function checkSpeedBoostCollision(item, ballWorldPos) {
    tempBallLocalPos.copy(ballWorldPos);
    group.worldToLocal(tempBallLocalPos);

    var boostOffset = getPipeOffset(item.z);
    var localX = tempBallLocalPos.x - boostOffset.x;
    var localY = tempBallLocalPos.y - boostOffset.y;
    var laneNormalX = Math.sin(item.angle);
    var laneNormalY = -Math.cos(item.angle);
    var laneTangentX = Math.cos(item.angle);
    var laneTangentY = Math.sin(item.angle);
    var lateral = localX * laneTangentX + localY * laneTangentY;
    var radial = localX * laneNormalX + localY * laneNormalY;

    var ballR = CONFIG.BALL.RADIUS;
    var halfWidth = item.radius * LANE_HALF_ANGLE + ballR;
    if (Math.abs(lateral) > halfWidth) return false;

    var surfaceRadius = item.radius - 0.02;
    var boxHeight = ballR * 2;
    var minRadial = surfaceRadius - boxHeight - ballR * 0.2;
    var maxRadial = surfaceRadius + ballR * 0.35;
    if (radial < minRadial || radial > maxRadial) return false;

    var halfStrip = item.stripLength / 2 + ballR;
    var currentMin = item.z - halfStrip;
    var currentMax = item.z + halfStrip;
    var prevZ = item.prevZ === undefined ? item.z : item.prevZ;
    var sweepMin = Math.min(currentMin, prevZ - halfStrip);
    var sweepMax = Math.max(currentMax, prevZ + halfStrip);
    return tempBallLocalPos.z >= sweepMin && tempBallLocalPos.z <= sweepMax;
  }

  function checkCollisions(ballX, ballY, ballZ) {
    var ballWorldPos = new THREE.Vector3(ballX, ballY, ballZ);
    var results = [];
    var buffs = window.STATE && window.STATE.activeBuffs ? window.STATE.activeBuffs : {};
    var dashMagnetActive = buffs.dashBoost > 0;
    var magnetActive = dashMagnetActive || buffs.magnet > 0;
    var magnetRange = dashMagnetActive ? 999 : (magnetActive ? CONFIG.BUFFS.MAGNET.radius : 0);
    var itemWorldPos = new THREE.Vector3();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.collected) continue;

      if (item.type === 'speedBoost') {
        if (window.STATE && window.STATE.invincible > 0) continue;
        if (checkSpeedBoostCollision(item, ballWorldPos)) {
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
      if (dashMagnetActive && def && def.hazard) continue;
      var baseRadius = (def ? def.size : 0.5) + CONFIG.BALL.RADIUS + CONFIG.BALL.PICKUP_RANGE;
      var effectiveRadius = baseRadius;

      if (item.type === 'coin' && magnetActive && dist < magnetRange) {
        tempBallLocalPos.copy(ballWorldPos);
        group.worldToLocal(tempBallLocalPos);
        var pull = THREE.MathUtils.clamp(0.22 + (1 - dist / magnetRange) * 0.28, 0.22, 0.5);
        item.mesh.position.lerp(tempBallLocalPos, pull);
        item.magnetized = true;
        item.z = item.mesh.position.z;
        item.mesh.getWorldPosition(itemWorldPos);
        dist = ballWorldPos.distanceTo(itemWorldPos);
        effectiveRadius = baseRadius + 0.25;
      }

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
      if (item.type === 'coin' && item.magnetized &&
          (!window.STATE || !window.STATE.activeBuffs ||
            (window.STATE.activeBuffs.magnet <= 0 && window.STATE.activeBuffs.dashBoost <= 0))) {
        item.magnetized = false;
      }

      if (item.type === 'speedBoost') {
        item.prevZ = item.z + delta;
        item.mesh.position.z = item.z;
        var boostOffset = getPipeOffset(item.z);
        item.mesh.position.x = boostOffset.x;
        item.mesh.position.y = boostOffset.y;
        continue;
      }

      if (item.type === 'rotatingBarrier') {
        var t = window.STATE ? window.STATE.elapsedTime : 0;
        var newAngle = item.baseAngle + t * 0.9 + item.z * 0.175;
        item.angle = newAngle;
        setLanePosition(item, item.z);
        if (item.mesh.userData && item.mesh.userData.billboard) {
          item.visualSpin += (ITEM_DEFS[item.type].spin || 2.4) * dt;
          faceCamera(item.mesh, item.visualSpin);
        } else {
          item.mesh.rotation.z += 0.04;
        }
        continue;
      }
      if (item.type === 'coin') {
        if (item.mesh.userData && item.mesh.userData.billboard) {
          item.visualSpin += 3.2 * dt;
        } else {
          item.mesh.rotation.y += 0.05;
          item.mesh.rotation.x += 0.03;
        }
        var t2 = window.STATE ? window.STATE.elapsedTime : 0;
        var coinZ = item.z + Math.sin(t2 * 3 + item.angle * 5) * 0.15;
        if (!item.magnetized) setLanePosition(item, coinZ);
        else item.mesh.position.z = coinZ;
        faceCamera(item.mesh, item.visualSpin);
        continue;
      }
      if (['magnet', 'shield', 'scoreX2', 'bonusGate'].indexOf(item.type) >= 0) {
        var t3 = window.STATE ? window.STATE.elapsedTime : 0;
        setLanePosition(item, item.z + Math.sin(t3 * 2.5 + item.angle * 3) * 0.2);
        if (item.mesh.userData && item.mesh.userData.billboard) {
          item.visualSpin += (ITEM_DEFS[item.type].spin || 0.25) * dt;
          faceCamera(item.mesh, item.visualSpin);
        } else {
          item.mesh.rotation.y += 0.03;
        }
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
    spawnSerial = 0;
  }

  return {
    init: init, reset: reset, placeItem: placeItem,
    populateSegment: populateSegment, checkCollisions: checkCollisions,
    clearBehind: clearBehind, update: update, group: group
  };
})();
