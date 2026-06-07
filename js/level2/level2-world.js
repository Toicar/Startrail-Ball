// level2-world.js — 道具沿平底地面放置（faceIndex + 横向 lat + 上下轨 layer）
window.Level2World = (function () {
  'use strict';

  var group = new THREE.Group();
  var items = [];
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

  // layer 0 = 地面轨，layer 1 = 换轨区上轨
  function itemRadial(layer, lift) {
    var apo = getLevel2Apothem();
    var r = apo - (lift || 0.4);
    if (layer === 1) r -= LEVEL2_CONFIG.RINGS.CEIL_RISE;
    return r;
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
      collected: false,
    });
  }

  function refreshItemXY(it) {
    var p = getLevel2LocalPos(it.faceIndex, it.lat, it.radial);
    it.mesh.position.x = p.x;
    it.mesh.position.y = p.y;
  }

  function rndLat(half) {
    return (Math.random() - 0.5) * 2 * half;
  }

  function spawnSubway(z, faceIndex, difficulty) {
    var lanes = LEVEL2_CONFIG.SUBWAY.LANE_X;
    var roll = Math.random();
    var hazardBoost = Math.min((difficulty || 0) * 0.03, 0.1);
    if (roll < 0.5 - hazardBoost) {
      addItem('coin', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { lift: 0.45 });
    } else if (roll < 0.66 + hazardBoost) {
      addItem('spike', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, {});
    } else if (roll < 0.78) {
      addItem('barrier', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { low: true, lift: 0.25 });
    } else if (roll < 0.88) {
      addItem('coin', z, faceIndex, 0, 0, { lift: 0.45 });
    } else if (roll < 0.95) {
      addItem('magnet', z, faceIndex, 0, 0, { lift: 0.45 });
    } else {
      addItem('shield', z, faceIndex, lanes[(Math.random() * 3) | 0], 0, { lift: 0.45 });
    }
  }

  function spawnRolling(z, faceIndex, difficulty) {
    var half = LEVEL2_CONFIG.LATERAL_HALF;
    var roll = Math.random();
    var hazardBoost = Math.min((difficulty || 0) * 0.03, 0.1);
    if (roll < 0.5 - hazardBoost) {
      addItem('coin', z, faceIndex, rndLat(half), 0, { lift: 0.45 });
    } else if (roll < 0.66) {
      addItem('jumpPad', z, faceIndex, 0, 0, {});
      addItem('coin', z + 2, faceIndex, 0, 0, { lift: 1.1 });
    } else if (roll < 0.82 + hazardBoost) {
      addItem('spike', z, faceIndex, rndLat(half), 0, {});
    } else if (roll < 0.9) {
      addItem('scoreX2', z, faceIndex, rndLat(half * 0.6), 0, { lift: 0.45 });
    } else {
      addItem('barrier', z, faceIndex, rndLat(half), 0, {});
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
      addItem('coin', z, faceIndex, rndLat(h), layer, { ring: layer, lift: 0.35 });
    } else if (roll < 0.8 + hazardBoost) {
      // 一条轨放障碍，另一条放金币，逼迫换轨
      var blockLayer = Math.random() < 0.5 ? 0 : 1;
      var coinLayer = 1 - blockLayer;
      var bH = blockLayer === 1 ? halfCeil : half;
      var cH = coinLayer === 1 ? halfCeil : half;
      var lat = rndLat(Math.min(bH, cH) * 0.7);
      addItem('ringBlock', z, faceIndex, lat, blockLayer, { ring: blockLayer });
      addItem('coin', z, faceIndex, lat, coinLayer, { ring: coinLayer, lift: 0.35 });
    } else if (roll < 0.92) {
      addItem('magnet', z, faceIndex, rndLat(half), 0, { ring: 0, lift: 0.35 });
    } else {
      addItem('shield', z, faceIndex, rndLat(half), 0, { ring: 0, lift: 0.35 });
    }
  }

  function populateSegment(zStart, zEnd, edgeId, difficulty, distance, faceIndex) {
    distance = distance || 0;
    faceIndex = faceIndex === undefined ? 0 : faceIndex;
    var z = zStart + 2;
    while (z < zEnd - 1) {
      var absZ = distance + z;
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

      // 换轨区：只在同一条轨上才判定（切换中放宽）
      if (edgeId === 'rings' && it.layer !== undefined) {
        if (it.layer !== ball.ringLayer && ball.ringSwitchT <= 0) continue;
      }
      // 跳跃可越过的障碍
      if (edgeId === 'rolling' && (it.type === 'spike' || it.type === 'barrier') && ball.jumpOffset > 0.75) continue;
      if (edgeId === 'subway' && it.low && ball.jumpOffset > LEVEL2_CONFIG.SUBWAY.LOW_BARRIER_H) continue;

      var itemY = -it.radial;
      var dx = ball.x - it.lat;
      var dy = ball.y - itemY;
      var dist = Math.sqrt(dx * dx + dy * dy + relZ * relZ);
      var pickupRadius = br + (it.def.pickup || 0.55);

      if (it.type === 'coin' && magnetActive && dist < magnetRange) {
        var pull = THREE.MathUtils.clamp(0.25 + (1 - dist / magnetRange) * 0.35, 0.25, 0.6);
        it.lat += (ball.x - it.lat) * pull;
        it.absZ += (distance - it.absZ) * pull;
        refreshItemXY(it);
        it.mesh.position.z = it.absZ - distance;
        relZ = it.absZ - distance;
        dx = ball.x - it.lat;
        dist = Math.sqrt(dx * dx + dy * dy + relZ * relZ);
      }

      if (dist < pickupRadius) {
        it.collected = true;
        group.remove(it.mesh);
        results.push({
          type: it.type, low: it.low, jumpPad: it.def.jumpPad,
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
