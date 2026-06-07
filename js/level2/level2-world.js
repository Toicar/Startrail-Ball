// level2-world.js — 道具放置：贴壁段用 lat/radial，浮空段用三角截面本地坐标
window.Level2World = (function () {
  'use strict';

  var group = new THREE.Group();
  var items = [];
  var ringPortalKeys = {};
  var textureLoader;
  var texCache = {};
  var ITEM_ROOT = './image/';

  var DEFS = {
    coin:      { asset: 'item_coin.png',       w: 0.85, h: 0.85, pickup: 0.55 },
    spike:     { asset: 'item_spike.png',      w: 0.9,  h: 0.9,  hazard: true },
    barrier:   { asset: 'item_barrier.png',    w: 0.95, h: 0.95, hazard: true },
    magnet:    { asset: 'item_magnet.png',     w: 0.95, h: 0.95 },
    shield:    { asset: 'item_shield.png',     w: 0.95, h: 0.95 },
    scoreX2:   { asset: 'item_double.png',     w: 0.95, h: 0.95 },
    jumpPad:   { asset: 'item_bonus_gate.png', w: 1.0,  h: 1.0,  jumpPad: true },
    ringBlock: { asset: 'item_barrier.png',    w: 0.9,  h: 0.9,  hazard: true, ringBlock: true },
  };

  function getTex(asset) {
    if (texCache[asset]) return texCache[asset];
    if (!textureLoader) textureLoader = new THREE.TextureLoader();
    var src = (window.AssetData && window.AssetData.images && window.AssetData.images[asset]) || (ITEM_ROOT + asset);
    var t = textureLoader.load(src);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    texCache[asset] = t;
    return t;
  }

  // layer 0 = 底轨，layer 1 = 上轨；默认贴内壁，lift 仅作贴图防穿模微抬
  function itemRadial(layer, lift) {
    return getLevel2ItemSurfaceRadial(layer, lift);
  }

  function addItem(type, absZ, faceIndex, lat, layer, extra) {
    var def = DEFS[type];
    if (!def) return;
    extra = extra || {};
    layer = layer || 0;
    var radial = itemRadial(layer, extra.lift);
    var p = getLevel2LocalPos(faceIndex, lat, radial);
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(def.w, def.h),
      new THREE.MeshBasicMaterial({
        map: getTex(def.asset),
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(p.x, p.y, absZ);
    mesh.renderOrder = def.hazard ? 12 : 10;
    group.add(mesh);
    items.push({
      mesh: mesh, type: type, def: def,
      absZ: absZ, faceIndex: faceIndex,
      lat: lat, radial: radial, layer: layer,
      low: extra.low, ring: extra.ring,
      ringPortal: extra.ringPortal,
      collected: false,
    });
  }

  function addFloatItem(type, absZ, faceIndex, localX, localY, extra) {
    var def = DEFS[type];
    if (!def) return;
    extra = extra || {};
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(def.w, def.h),
      new THREE.MeshBasicMaterial({
        map: getTex(def.asset),
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(localX, localY, absZ);
    mesh.renderOrder = def.hazard ? 12 : 10;
    group.add(mesh);
    items.push({
      mesh: mesh, type: type, def: def,
      absZ: absZ, faceIndex: faceIndex,
      isFloat: true, floatLX: localX, floatLY: localY,
      collected: false,
    });
  }

  function refreshItemXY(it) {
    if (it.isFloat) {
      it.mesh.position.x = it.floatLX;
      it.mesh.position.y = it.floatLY;
      return;
    }
    var p = getLevel2LocalPos(it.faceIndex, it.lat, it.radial);
    it.mesh.position.x = p.x;
    it.mesh.position.y = p.y;
  }

  function itemWorldXY(it) {
    if (it.isFloat) return level2LocalToWorldXY(it.floatLX, it.floatLY);
    return getLevel2WorldPos(it.faceIndex, it.lat, it.radial);
  }

  function rndLat(half) {
    return (Math.random() - 0.5) * 2 * half;
  }

  function spawnSubway(z, faceIndex, difficulty) {
    var lanes = LEVEL2_CONFIG.SUBWAY.LANE_X;
    var roll = Math.random();
    var hazardBoost = Math.min((difficulty || 0) * 0.03, 0.1);
    if (roll < 0.5 - hazardBoost) {
      addItem('coin', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { lift: 0.12 });
    } else if (roll < 0.66 + hazardBoost) {
      addItem('spike', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { lift: 0.08 });
    } else if (roll < 0.78) {
      addItem('barrier', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { low: true, lift: 0.1 });
    } else if (roll < 0.88) {
      addItem('coin', z, faceIndex, 0, 0, { lift: 0.35 });
    } else if (roll < 0.95) {
      addItem('magnet', z, faceIndex, 0, 0, { lift: 0.12 });
    } else {
      addItem('shield', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { lift: 0.12 });
    }
  }

  function spawnRolling(z, faceIndex, difficulty) {
    var roll = Math.random();
    var hazardBoost = Math.min((difficulty || 0) * 0.03, 0.1);
    var pos = randomLevel2TriangleLocal();
    if (roll < 0.54 - hazardBoost) {
      addFloatItem('coin', z, faceIndex, pos.x, pos.y);
    } else if (roll < 0.74 + hazardBoost) {
      addFloatItem('spike', z, faceIndex, pos.x, pos.y);
    } else if (roll < 0.86) {
      pos = randomLevel2TriangleLocal();
      addFloatItem('scoreX2', z, faceIndex, pos.x, pos.y);
    } else if (roll < 0.94) {
      pos = randomLevel2TriangleLocal();
      addFloatItem('magnet', z, faceIndex, pos.x, pos.y);
    } else {
      pos = randomLevel2TriangleLocal();
      addFloatItem('barrier', z, faceIndex, pos.x, pos.y);
    }
  }

  function ringPortalAbsZ(lap, kind) {
    var el = LEVEL2_CONFIG.EDGE_LENGTH;
    var tl = LEVEL2_CONFIG.TOTAL_LAP;
    var inset = LEVEL2_CONFIG.RINGS.PORTAL_INSET;
    var blend = LEVEL2_CONFIG.VERTEX_BLEND;
    var ringsIdx = LEVEL2_CONFIG.RINGS.RINGS_FACE_INDEX;
    var base = lap * tl;
    if (kind === 'in') return base + ringsIdx * el + inset;
    return base + (ringsIdx + 1) * el - blend - inset;
  }

  function isNearRingPortal(absZ) {
    var tl = LEVEL2_CONFIG.TOTAL_LAP;
    var lapMin = Math.max(0, Math.floor((absZ - 6) / tl));
    var lapMax = Math.floor((absZ + 6) / tl) + 1;
    for (var lap = lapMin; lap <= lapMax; lap++) {
      if (Math.abs(absZ - ringPortalAbsZ(lap, 'in')) < 5) return true;
      if (Math.abs(absZ - ringPortalAbsZ(lap, 'out')) < 5) return true;
    }
    return false;
  }

  function tryAddRingPortal(absZ, kind, absStart, absEnd) {
    var key = absZ + ':' + kind;
    if (ringPortalKeys[key]) return;
    if (absZ < absStart || absZ > absEnd) return;
    var edge = getLevel2EdgeAt(absZ);
    if (edge.edge.id !== 'rings' || edge.inTransition) return;
    ringPortalKeys[key] = true;
    addItem('jumpPad', absZ, LEVEL2_CONFIG.RINGS.RINGS_FACE_INDEX, 0, 0, {
      lift: 0.08,
      ringPortal: kind,
    });
  }

  function maybeSpawnRingPortals(zStart, zEnd, distance) {
    var absStart = distance + zStart;
    var absEnd = distance + zEnd;
    var tl = LEVEL2_CONFIG.TOTAL_LAP;
    var lapMin = Math.floor(absStart / tl);
    var lapMax = Math.floor(absEnd / tl) + 1;
    for (var lap = lapMin; lap <= lapMax; lap++) {
      tryAddRingPortal(ringPortalAbsZ(lap, 'in'), 'in', absStart, absEnd);
      tryAddRingPortal(ringPortalAbsZ(lap, 'out'), 'out', absStart, absEnd);
    }
  }

  function spawnRings(z, faceIndex, difficulty) {
    var half = LEVEL2_CONFIG.LATERAL_HALF;
    var halfCeil = LEVEL2_CONFIG.RINGS.LATERAL_HALF_CEIL;
    var roll = Math.random();
    var hazardBoost = Math.min((difficulty || 0) * 0.03, 0.1);
    if (roll < 0.44 - hazardBoost) {
      var layer = Math.random() < 0.62 ? 0 : 1;
      var h = layer === 1 ? halfCeil : half;
      addItem('coin', z, faceIndex, rndLat(h), layer, { ring: layer, lift: 0.12 });
    } else if (roll < 0.8 + hazardBoost) {
      // 一条轨放障碍，另一条放金币，逼迫换轨
      var blockLayer = Math.random() < 0.5 ? 0 : 1;
      var coinLayer = 1 - blockLayer;
      var bH = blockLayer === 1 ? halfCeil : half;
      var cH = coinLayer === 1 ? halfCeil : half;
      var lat = rndLat(Math.min(bH, cH) * 0.7);
      addItem('ringBlock', z, faceIndex, lat, blockLayer, { ring: blockLayer, lift: 0.08 });
      addItem('coin', z, faceIndex, lat, coinLayer, { ring: coinLayer, lift: 0.12 });
    } else if (roll < 0.92) {
      addItem('magnet', z, faceIndex, rndLat(half), 0, { ring: 0, lift: 0.12 });
    } else {
      addItem('shield', z, faceIndex, rndLat(half), 0, { ring: 0, lift: 0.12 });
    }
  }

  function populateSegment(zStart, zEnd, edgeId, difficulty, distance, faceIndex) {
    distance = distance || 0;
    faceIndex = faceIndex === undefined ? 0 : faceIndex;
    maybeSpawnRingPortals(zStart, zEnd, distance);

    var z = zStart + 2;
    while (z < zEnd - 1) {
      var absZ = distance + z;
      if (isNearRingPortal(absZ)) {
        z += 3;
        continue;
      }
      var spawnEdge = getLevel2EdgeAt(absZ);
      if (spawnEdge.index !== faceIndex || spawnEdge.inTransition) {
        z += 3;
        continue;
      }
      if (edgeId === 'subway') spawnSubway(absZ, faceIndex, difficulty);
      else if (edgeId === 'rolling') spawnRolling(absZ, faceIndex, difficulty);
      else spawnRings(absZ, faceIndex, difficulty);
      // 密度恒定：早期与后期一致，不随难度堆叠
      z += 4.2 + Math.random() * 1.8;
    }
  }

  function clearBehind(distance) {
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].absZ < distance - 20 || items[i].collected) {
        group.remove(items[i].mesh);
        items.splice(i, 1);
      }
    }
  }

  function syncPositions(distance) {
    for (var i = 0; i < items.length; i++) {
      if (!items[i].collected) {
        items[i].mesh.position.z = items[i].absZ - distance;
      }
    }
  }

  function reset() {
    while (items.length) {
      group.remove(items[0].mesh);
      items.shift();
    }
    ringPortalKeys = {};
  }

  function init() {}

  function updateVisuals() {
    if (!window.camera) return;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].collected) items[i].mesh.quaternion.copy(window.camera.quaternion);
    }
  }

  function checkCollisions(ball, edgeId, distance, faceIndex) {
    var results = [];
    var br = CONFIG.BALL.RADIUS;
    var magnetActive = window.STATE && window.STATE.activeBuffs && window.STATE.activeBuffs.magnet > 0;
    var magnetRange = magnetActive ? CONFIG.BUFFS.MAGNET.radius : 0;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.collected) continue;
      if (it.faceIndex !== faceIndex) continue;
      var relZ = it.absZ - distance;
      if (Math.abs(relZ) > Math.max(2.5, magnetRange)) continue;

      // 换轨区：只在同一条轨上才判定（切换中放宽）；衔接传送门双轨均可触发
      if (!it.ringPortal && edgeId === 'rings' && it.layer !== undefined) {
        if (it.layer !== ball.ringLayer && ball.ringSwitchT <= 0) continue;
      }
      if (edgeId === 'subway' && it.low && ball.jumpOffset > LEVEL2_CONFIG.SUBWAY.LOW_BARRIER_H) continue;

      var ballW = edgeId === 'rolling'
        ? { x: ball.x, y: ball.y }
        : getLevel2WorldPos(faceIndex, ball.lat, ball.radial);
      var itemW = itemWorldXY(it);
      var dx = ballW.x - itemW.x;
      var dy = ballW.y - itemW.y;
      var dist = Math.sqrt(dx * dx + dy * dy + relZ * relZ);
      var pickupRadius = br + (it.def.pickup || 0.55);

      if (it.type === 'coin' && magnetActive && dist < magnetRange) {
        var pull = THREE.MathUtils.clamp(0.25 + (1 - dist / magnetRange) * 0.35, 0.25, 0.6);
        if (it.isFloat) {
          var ballLoc = level2WorldToLocalXY(ball.x, ball.y);
          it.floatLX += (ballLoc.x - it.floatLX) * pull;
          it.floatLY += (ballLoc.y - it.floatLY) * pull;
        } else {
          var targetLat = getLevel2LatFromWorldX(it.faceIndex, ball.x, it.radial);
          it.lat += (targetLat - it.lat) * pull;
        }
        it.absZ += (distance - it.absZ) * pull;
        refreshItemXY(it);
        it.mesh.position.z = it.absZ - distance;
        relZ = it.absZ - distance;
        itemW = itemWorldXY(it);
        dx = ballW.x - itemW.x;
        dy = ballW.y - itemW.y;
        dist = Math.sqrt(dx * dx + dy * dy + relZ * relZ);
      }

      if (dist < pickupRadius) {
        it.collected = true;
        group.remove(it.mesh);
        results.push({
          type: it.type, low: it.low,
          jumpPad: it.def.jumpPad && !it.ringPortal,
          ringPortal: it.ringPortal,
          hazard: it.def.hazard || it.def.ringBlock,
        });
      }
    }
    return results;
  }

  return {
    init: init, reset: reset, populateSegment: populateSegment,
    clearBehind: clearBehind, syncPositions: syncPositions,
    updateVisuals: updateVisuals, checkCollisions: checkCollisions,
    group: group,
  };
})();
