// pipe.js — 管道生成与渲染
window.PipeSystem = (function () {
  'use strict';

  var group = new THREE.Group();
  var ringGroup = new THREE.Group();
  var segments = [];
  var segmentMaterials = [];
  var edgeRings = [];
  var segmentCreateIndex = 0;
  var RING_EVERY_N_SEGMENTS = 5; // 原每段 2 环 → 约 10% 密度

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
    '  vec3 nebula = mix(uColor1, uColor2, vUv.y);',
    '  nebula += vec3(0.35, 0.08, 0.55) * pow(max(0.0, sin(vUv.x * 6.28 + uTime * 0.15)), 3.0) * 0.25;',
    '  nebula += vec3(0.15, 0.05, 0.35) * pow(max(0.0, cos(vUv.y * 4.0 - uTime * 0.1)), 2.0) * 0.2;',
    '  float star = step(0.998, random(floor(vUv * 90.0 + uTime * 0.03)));',
    '  float twinkle = random(vUv + uTime * 0.07) * 0.6 + 0.4;',
    '  vec3 starColor = vec3(0.9, 0.92, 1.0) * twinkle;',
    '  float bigStar = step(0.9995, random(floor(vUv * 24.0)));',
    '  star = max(star, bigStar * 1.8);',
    '  float vertLine = smoothstep(0.93, 1.0, 1.0 - abs(fract(vUv.x * 12.0) - 0.5) * 2.0);',
    '  float horizLine = smoothstep(0.94, 1.0, 1.0 - abs(fract(vUv.y * 0.8) - 0.5) * 2.0);',
    '  float gridLine = max(vertLine, horizLine);',
    '  vec3 gridColor = vec3(0.0, 0.92, 1.0) * gridLine;',
    '  vec3 trackBase = vec3(0.04, 0.12, 0.35);',
    '  vec3 color = mix(nebula, starColor, star);',
    '  color = mix(color, trackBase, 0.35);',
    '  color += gridColor * 1.26;',
    '  float edge = pow(abs(vUv.y - 0.5) * 2.0, 2.0);',
    '  color += vec3(0.0, 0.7, 1.0) * edge * 0.105;',
    '  float alpha = 0.28 + gridLine * 0.385 + edge * 0.084;',
    '  gl_FragColor = vec4(color, alpha);',
    '}'
  ].join('\n');

  var starfieldTemplate = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#040818') },
      uColor2: { value: new THREE.Color('#180838') },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
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
    var ringGeo = new THREE.TorusGeometry(radius, 0.08, 8, 48);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x00a1b3,
      transparent: true,
      opacity: 0.525,
      depthWrite: false,
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = zOffset;
    return ring;
  }

  function createPipeSegment(zOffset, radius, length, curvature, bendAxis) {
    var mat = starfieldTemplate.clone();
    var geo = new THREE.CylinderGeometry(radius, radius, length, 12, 1, true);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = zOffset;
    if (curvature && bendAxis) {
      mesh.rotation[bendAxis] += curvature;
    }

    // 线框叠加（结构线）
    var wireGeo = new THREE.CylinderGeometry(radius * 1.002, radius * 1.002, length, 12, 1, true);
    var wireMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.126,
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

    segmentCreateIndex++;
    var rings = [];
    if (segmentCreateIndex % RING_EVERY_N_SEGMENTS === 0) {
      var ringZ = zOffset + length / 2;
      var ring = createGlowRing(ringZ, radius);
      edgeRings.push({ ring: ring, zOffset: ringZ });
      ringGroup.add(ring);
      rings.push(ring);
    }

    return {
      mesh: mesh, zOffset: zOffset, radius: radius, length: length,
      curvature: curvature || 0, bendAxis: bendAxis || null,
      rings: rings
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
      edgeRings[r].ring.material.opacity = dist < 30 ? 0.525 : Math.max(0.08, 0.525 - (dist - 30) * 0.01);
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
      segmentCreateIndex = 0;
    }
  };
})();
