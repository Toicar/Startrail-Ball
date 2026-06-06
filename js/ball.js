// ball.js — 球体创建与视觉
window.Ball = (function () {
  'use strict';

  var group = new THREE.Group();
  var mesh, glowMesh;

  function init() {
    // 主体球
    var geo = new THREE.SphereGeometry(CONFIG.BALL.RADIUS, 32, 32);
    var mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0x4488ff,
      emissiveIntensity: 0.6,
    });
    mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // 发光光晕
    var glowGeo = new THREE.SphereGeometry(CONFIG.BALL.RADIUS * 1.8, 16, 16);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    glowMesh = new THREE.Mesh(glowGeo, glowMat);
    group.add(glowMesh);

    window.scene.add(group);
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

  function setShieldActive(active) {
    if (glowMesh) {
      glowMesh.material.opacity = active ? 0.35 : 0.15;
      glowMesh.material.color.setHex(active ? 0xffaa00 : 0x4488ff);
    }
  }

  function setInvincible(active) {
    if (mesh) {
      mesh.material.emissive.setHex(active ? 0xff0000 : 0x4488ff);
      mesh.material.emissiveIntensity = active ? 1.0 : 0.6;
    }
    if (glowMesh) {
      glowMesh.material.color.setHex(active ? 0xff4444 : 0x4488ff);
      glowMesh.material.opacity = active ? 0.4 : 0.15;
    }
  }

  return {
    init: init, setPosition: setPosition, getPosition: getPosition,
    setShieldActive: setShieldActive, setInvincible: setInvincible,
    group: group
  };
})();
