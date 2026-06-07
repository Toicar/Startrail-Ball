// ball.js — 球形逃生舱
window.Ball = (function () {
  'use strict';

  var group = new THREE.Group();
  var glowMesh, cockpitMesh, engineGlowMesh;
  var accentMeshes = [];
  var bodyMeshes = [];
  var invincibleActive = false;

  function rememberMesh(mesh) {
    if (mesh) bodyMeshes.push(mesh);
    return mesh;
  }

  function setMaterialOpacity(material, opacity) {
    if (!material) return;
    if (material.userData.baseOpacity === undefined) {
      material.userData.baseOpacity = material.opacity === undefined ? 1 : material.opacity;
      material.userData.baseTransparent = !!material.transparent;
    }
    material.transparent = opacity < 0.99 || material.userData.baseTransparent;
    material.opacity = material.userData.baseOpacity * opacity;
    material.needsUpdate = true;
  }

  function restoreMaterialOpacity(material) {
    if (!material || material.userData.baseOpacity === undefined) return;
    material.opacity = material.userData.baseOpacity;
    material.transparent = material.userData.baseTransparent;
    material.needsUpdate = true;
  }

  function setBodyOpacity(opacity) {
    for (var i = 0; i < bodyMeshes.length; i++) {
      setMaterialOpacity(bodyMeshes[i].material, opacity);
    }
  }

  function restoreBodyOpacity() {
    for (var i = 0; i < bodyMeshes.length; i++) {
      restoreMaterialOpacity(bodyMeshes[i].material);
    }
  }

  function init() {
    var r = CONFIG.BALL.RADIUS;

    var hullMat = new THREE.MeshStandardMaterial({
      color: 0x1a2438,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x0a1525,
      emissiveIntensity: 0.2,
    });

    var trimMat = new THREE.MeshStandardMaterial({
      color: 0x2a3850,
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x004466,
      emissiveIntensity: 0.2,
    });

    var bandMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.95,
      roughness: 0.12,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.35,
    });

    // 球形主舱体
    var hull = rememberMesh(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), hullMat));
    group.add(hull);

    // 赤道结构环
    var equator = rememberMesh(new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.055, 8, 32), bandMat));
    equator.rotation.x = Math.PI / 2;
    group.add(equator);
    accentMeshes.push(equator);

    // 纵向结构环（+Z 为前进方向）
    var meridian = rememberMesh(new THREE.Mesh(new THREE.TorusGeometry(r * 1.015, r * 0.04, 8, 32), trimMat));
    meridian.rotation.y = Math.PI / 2;
    group.add(meridian);

    // 驾驶舱舷窗（球面前上方凸起）
    var cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      metalness: 0.1,
      roughness: 0.05,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    cockpitMesh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 14, 12), cockpitMat);
    cockpitMesh.position.set(0, r * 0.38, r * 0.78);
    group.add(cockpitMesh);

    // 尾部推进器凸点（4 个，半球后方）
    var thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.85,
      roughness: 0.3,
      emissive: 0x006688,
      emissiveIntensity: 0.4,
    });
    var thrusterAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    for (var t = 0; t < thrusterAngles.length; t++) {
      var ta = thrusterAngles[t];
      var thruster = rememberMesh(new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 8, 8), thrusterMat));
      thruster.position.set(
        Math.cos(ta) * r * 0.72,
        Math.sin(ta) * r * 0.72,
        -r * 0.82
      );
      group.add(thruster);
      accentMeshes.push(thruster);
    }

    // 引擎光晕（球体后方）
    engineGlowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.38, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5, depthWrite: false })
    );
    engineGlowMesh.position.z = -r * 1.02;
    group.add(engineGlowMesh);

    // 外圈保护光晕
    glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(r * 2.0, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.1, depthWrite: false })
    );
    group.add(glowMesh);

    window.scene.add(group);
  }

  function updateVisuals(time) {
    if (invincibleActive) {
      var pulse = (Math.sin(time * Math.PI * 2) + 1) * 0.5;
      var dim = pulse < 0.48;
      setBodyOpacity(dim ? 0.52 : 0.82);
      group.scale.setScalar(0.98 + pulse * 0.08);
      if (glowMesh) {
        glowMesh.material.opacity = 0.12 + pulse * 0.26;
        glowMesh.scale.setScalar(1.0 + pulse * 0.22);
      }
      if (cockpitMesh) {
        cockpitMesh.material.opacity = dim ? 0.34 : 0.82;
        cockpitMesh.material.emissiveIntensity = 0.9 + pulse * 0.7;
      }
      if (engineGlowMesh) {
        engineGlowMesh.material.opacity = 0.18 + pulse * 0.42;
        engineGlowMesh.scale.setScalar(0.9 + pulse * 0.22);
      }
      return;
    }

    if (engineGlowMesh) {
      engineGlowMesh.material.opacity = 0.4 + Math.sin(time * 6.0) * 0.15;
      engineGlowMesh.scale.setScalar(0.92 + Math.sin(time * 8.0) * 0.08);
    }
    if (cockpitMesh) {
      cockpitMesh.material.emissiveIntensity = 0.7 + Math.sin(time * 3.0) * 0.15;
    }
  }

  function setPosition(x, y, z) {
    group.position.set(x, y, z);
    if (window.pointLight) {
      window.pointLight.position.copy(group.position);
    }
  }

  function getPosition() {
    return group.position.clone();
  }

  function setAccentColor(hex) {
    if (cockpitMesh) {
      cockpitMesh.material.color.setHex(hex);
      cockpitMesh.material.emissive.setHex(hex);
    }
    if (engineGlowMesh) engineGlowMesh.material.color.setHex(hex);
    if (glowMesh) glowMesh.material.color.setHex(hex);
    for (var i = 0; i < accentMeshes.length; i++) {
      accentMeshes[i].material.emissive.setHex(hex);
    }
  }

  function setShieldActive(active) {
    if (glowMesh) glowMesh.material.opacity = active ? 0.28 : 0.1;
    setAccentColor(active ? 0xffaa00 : 0x00e5ff);
  }

  function setInvincible(active) {
    invincibleActive = active;
    if (glowMesh) {
      glowMesh.material.color.setHex(active ? 0xff4444 : 0x00e5ff);
      glowMesh.material.opacity = active ? 0.3 : 0.1;
      glowMesh.scale.setScalar(1);
    }
    if (!active) {
      restoreBodyOpacity();
      group.scale.setScalar(1);
      if (cockpitMesh) cockpitMesh.material.opacity = 0.9;
      if (engineGlowMesh) engineGlowMesh.material.opacity = 0.5;
    }
    setAccentColor(active ? 0xff4444 : 0x00e5ff);
  }

  return {
    init: init, updateVisuals: updateVisuals,
    setPosition: setPosition, getPosition: getPosition,
    setShieldActive: setShieldActive, setInvincible: setInvincible,
    group: group
  };
})();
