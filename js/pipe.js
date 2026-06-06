// pipe.js — 管道生成与渲染
window.PipeSystem = (function () {
  'use strict';

  var group = new THREE.Group();
  var ringGroup = new THREE.Group();
  var segments = [];
  var segmentMaterials = [];
  var edgeRings = [];

  // 星空着色器（内联）
  var VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var FRAGMENT_SHADER = [
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec3 uColor1;',
    'uniform vec3 uColor2;',
    'float random(vec2 st) {',
    '  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);',
    '}',
    'void main() {',
    '  vec3 bgColor = mix(uColor1, uColor2, vUv.y);',
    '  float star = step(0.998, random(floor(vUv * 80.0 + uTime * 0.03)));',
    '  float twinkle = random(vUv + uTime * 0.07) * 0.6 + 0.4;',
    '  vec3 starColor = vec3(0.9, 0.85, 1.0) * twinkle;',
    '  float bigStar = step(0.9995, random(floor(vUv * 20.0)));',
    '  star = max(star, bigStar * 1.8);',
    '  // 网格线 —— 管壁结构线',
    '  float gridX = abs(fract(vUv.x * 8.0) - 0.5) * 2.0;',
    '  float gridY = abs(fract(vUv.y * 3.0) - 0.5) * 2.0;',
    '  float grid = 1.0 - min(gridX, gridY);',
    '  float line = step(0.96, grid) * 0.08;',
    '  vec3 color = mix(bgColor, starColor, star);',
    '  color += line * vec3(0.3, 0.4, 0.8);',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  var starfieldTemplate = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#080830') },
      uColor2: { value: new THREE.Color('#150840') },
    },
    side: THREE.BackSide,
  });

  // 管道形态
  var PIPE_PATTERNS = {
    straight:    { radius: 4, curvature: 0, bendAxis: null },
    wide:        { radius: 5.6, curvature: 0, bendAxis: null },
    narrow:      { radius: 2.6, curvature: 0, bendAxis: null },
    curveLeft:   { radius: 4, curvature: 0.12, bendAxis: 'x' },
    curveRight:  { radius: 4, curvature: -0.12, bendAxis: 'x' },
    curveUp:     { radius: 4, curvature: 0.12, bendAxis: 'y' },
  };

  function selectPattern(difficultyLevel, distance) {
    if (difficultyLevel === 0) return 'straight';
    var rand = Math.random();
    if (difficultyLevel === 1) {
      if (rand < 0.5) return 'straight';
      if (rand < 0.75) return 'curveLeft';
      return 'curveRight';
    }
    if (rand < 0.25) return 'straight';
    if (rand < 0.45) return Math.random() < 0.5 ? 'curveLeft' : 'curveRight';
    if (rand < 0.6) return 'narrow';
    if (rand < 0.75) return 'wide';
    return rand < 0.9 ? 'curveUp' : 'curveRight';
  }

  // 创建发光环（管道骨架）
  function createGlowRing(zOffset, radius) {
    var ringGeo = new THREE.TorusGeometry(radius, 0.06, 8, 48);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x4466cc,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = zOffset;
    return ring;
  }

  function createPipeSegment(zOffset, radius, length, curvature, bendAxis) {
    var mat = starfieldTemplate.clone();
    var segCount = 64;
    if (Math.abs(zOffset) > 40) segCount = 32;
    var geo = new THREE.CylinderGeometry(radius, radius, length, segCount, 1, true);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = zOffset;
    if (curvature && bendAxis) {
      mesh.rotation[bendAxis] += curvature;
    }

    // 线框叠加（结构线）
    var wireGeo = new THREE.CylinderGeometry(radius * 1.002, radius * 1.002, length, 16, 3, true);
    var wireMat = new THREE.MeshBasicMaterial({
      color: 0x3355aa,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    var wireframe = new THREE.Mesh(wireGeo, wireMat);
    wireframe.rotation.x = -Math.PI / 2;
    wireframe.position.z = zOffset;
    if (curvature && bendAxis) {
      wireframe.rotation[bendAxis] += curvature;
    }
    mesh.add(wireframe);

    segmentMaterials.push({ mat: mat, mesh: mesh });

    // 在段首尾添加发光环
    var frontZ = zOffset;
    var backZ = zOffset - length / 2;
    var frontRing = createGlowRing(frontZ, radius);
    var backRing = createGlowRing(backZ, radius);
    edgeRings.push({ ring: frontRing, zOffset: frontZ });
    edgeRings.push({ ring: backRing, zOffset: backZ });
    ringGroup.add(frontRing);
    ringGroup.add(backRing);

    return {
      mesh: mesh, zOffset: zOffset, radius: radius, length: length,
      curvature: curvature || 0, bendAxis: bendAxis || null,
      rings: [frontRing, backRing]
    };
  }

  function init() {
    var radius = CONFIG.PIPE.BASE_RADIUS;
    for (var i = 0; i < CONFIG.PIPE.VISIBLE_SEGMENTS; i++) {
      var zCenter = i * CONFIG.PIPE.SEGMENT_LENGTH + CONFIG.PIPE.SEGMENT_LENGTH / 2;
      var seg = createPipeSegment(zCenter, radius, CONFIG.PIPE.SEGMENT_LENGTH, 0, null);
      segments.push(seg);
      group.add(seg.mesh);
      if (window.World) {
        World.populateSegment(
          zCenter - CONFIG.PIPE.SEGMENT_LENGTH / 2,
          zCenter + CONFIG.PIPE.SEGMENT_LENGTH / 2,
          radius, 0
        );
      }
    }
    if (group.parent !== window.scene) {
      window.scene.add(group);
      window.scene.add(ringGroup);
    }
  }

  function update(speed, dt, elapsedTime, difficultyLevel, distance) {
    // 着色器时间
    for (var s = 0; s < segmentMaterials.length; s++) {
      segmentMaterials[s].mat.uniforms.uTime.value = elapsedTime;
    }

    // 移动管道段
    var delta = speed * dt;
    for (var i = 0; i < segments.length; i++) {
      segments[i].zOffset -= delta;
      segments[i].mesh.position.z = segments[i].zOffset;
    }

    // 移动光环
    for (var r = 0; r < edgeRings.length; r++) {
      edgeRings[r].zOffset -= delta;
      edgeRings[r].ring.position.z = edgeRings[r].zOffset;
      // 光环渐隐以节省性能
      var dist = Math.abs(edgeRings[r].zOffset);
      edgeRings[r].ring.material.opacity = dist < 30 ? 0.5 : Math.max(0.05, 0.5 - (dist - 30) * 0.01);
    }


    // 移除后方段
    while (segments.length > 0 && segments[0].zOffset + segments[0].length / 2 < -10) {
      var old = segments.shift();
      group.remove(old.mesh);
      for (var j = segmentMaterials.length - 1; j >= 0; j--) {
        if (segmentMaterials[j].mesh === old.mesh) {
          segmentMaterials.splice(j, 1);
          break;
        }
      }
      // 清理该段的 ring
      if (old.rings) {
        for (var k = 0; k < old.rings.length; k++) {
          ringGroup.remove(old.rings[k]);
        }
      }
    }

    // 清理后方光环
    for (var er = edgeRings.length - 1; er >= 0; er--) {
      if (edgeRings[er].zOffset < -15) {
        ringGroup.remove(edgeRings[er].ring);
        edgeRings.splice(er, 1);
      }
    }

    // 生成新段
    while (segments.length < CONFIG.PIPE.VISIBLE_SEGMENTS) {
      var last = segments[segments.length - 1];
      var nextZ = last.zOffset + last.length / 2 + CONFIG.PIPE.SEGMENT_LENGTH / 2;
      var patternName = selectPattern(difficultyLevel, distance);
      var pattern = PIPE_PATTERNS[patternName];

      var prevRadius = last.radius;
      var targetRadius = pattern.radius;
      var radius = prevRadius + (targetRadius - prevRadius) * 0.3;

      var seg = createPipeSegment(
        nextZ, radius, CONFIG.PIPE.SEGMENT_LENGTH,
        pattern.curvature, pattern.bendAxis
      );
      segments.push(seg);
      group.add(seg.mesh);

      if (window.World) {
        World.populateSegment(
          nextZ - CONFIG.PIPE.SEGMENT_LENGTH / 2,
          nextZ + CONFIG.PIPE.SEGMENT_LENGTH / 2,
          radius, difficultyLevel
        );
      }
    }
  }

  function getPipeRadiusAt(z) {
    for (var i = segments.length - 1; i >= 0; i--) {
      var seg = segments[i];
      if (Math.abs(z - seg.zOffset) < seg.length / 2) {
        return seg.radius;
      }
    }
    return CONFIG.PIPE.BASE_RADIUS;
  }

  function getCurvatureAt(z) {
    for (var i = segments.length - 1; i >= 0; i--) {
      var seg = segments[i];
      if (Math.abs(z - seg.zOffset) < seg.length / 2) {
        return seg.curvature;
      }
    }
    return 0;
  }

  return {
    init: init, update: update,
    getPipeRadiusAt: getPipeRadiusAt, getCurvatureAt: getCurvatureAt,
    group: group, ringGroup: ringGroup, segments: segments,
    reset: function () {
      // 释放段资源
      for (var s = 0; s < segments.length; s++) {
        var seg = segments[s];
        seg.mesh.geometry.dispose();
        seg.mesh.material.dispose();
        // 清理子 mesh（线框等）
        for (var c = seg.mesh.children.length - 1; c >= 0; c--) {
          var child = seg.mesh.children[c];
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
        if (seg.rings) {
          for (var k = 0; k < seg.rings.length; k++) {
            seg.rings[k].geometry.dispose();
            seg.rings[k].material.dispose();
          }
        }
      }
      // 清理残留光环
      for (var er = 0; er < edgeRings.length; er++) {
        edgeRings[er].ring.geometry.dispose();
        edgeRings[er].ring.material.dispose();
      }
      while (group.children.length > 0) group.remove(group.children[0]);
      while (ringGroup.children.length > 0) ringGroup.remove(ringGroup.children[0]);
      segments = [];
      segmentMaterials = [];
      edgeRings = [];
    }
  };
})();
