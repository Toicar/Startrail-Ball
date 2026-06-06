// effects.js — 粒子特效（球尾迹 + 碰撞爆发）
window.Effects = (function () {
  'use strict';

  var trailGroup = new THREE.Group();
  var burstGroup = new THREE.Group();
  var trailParticles = [];
  var burstParticles = [];
  var MAX_TRAIL = 60;
  var quality = 'high';

  function init() {
    window.scene.add(trailGroup);
    window.scene.add(burstGroup);
  }

  function setQuality(q) { quality = q; MAX_TRAIL = q === 'low' ? 30 : 60; }

  function updateTrail(ballPos) {
    if (!ballPos) return;

    // 添加新粒子
    var geo = new THREE.SphereGeometry(quality === 'low' ? 0.08 : 0.06, 4, 4);
    var mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 1, 0.5 + Math.random() * 0.5),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    });
    var particle = new THREE.Mesh(geo, mat);
    particle.position.copy(ballPos);
    particle.position.x += (Math.random() - 0.5) * 0.2;
    particle.position.y += (Math.random() - 0.5) * 0.2;
    particle.userData = { life: 1.0, decay: 1.5 + Math.random() * 2 };
    trailGroup.add(particle);
    trailParticles.push(particle);

    // 老化 + 移除
    for (var i = trailParticles.length - 1; i >= 0; i--) {
      var p = trailParticles[i];
      p.userData.life -= p.userData.decay * 0.016;
      p.material.opacity = Math.max(0, p.userData.life * 0.5);
      p.scale.multiplyScalar(0.97);
      p.position.z -= 0.15; // 向后飘
      if (p.userData.life <= 0 || trailParticles.length > MAX_TRAIL) {
        trailGroup.remove(p);
        trailParticles.splice(i, 1);
      }
    }
  }

  function spawnBurst(position, color) {
    var count = quality === 'low' ? 10 : 20;
    for (var i = 0; i < count; i++) {
      var geo = new THREE.SphereGeometry(0.04, 3, 3);
      var mat = new THREE.MeshBasicMaterial({
        color: color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      });
      var p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      var speed = 1 + Math.random() * 3;
      p.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed
        ),
        life: 1.0
      };
      burstGroup.add(p);
      burstParticles.push(p);
    }
  }

  function updateBursts(dt) {
    for (var i = burstParticles.length - 1; i >= 0; i--) {
      var p = burstParticles[i];
      p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
      p.userData.velocity.y += 2 * dt;
      p.userData.life -= dt * 1.5;
      p.material.opacity = Math.max(0, p.userData.life);
      if (p.userData.life <= 0) {
        burstGroup.remove(p);
        burstParticles.splice(i, 1);
      }
    }
  }

  return { init: init, updateTrail: updateTrail, spawnBurst: spawnBurst, updateBursts: updateBursts, setQuality: setQuality };
})();
