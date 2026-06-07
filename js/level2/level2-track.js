// level2-track.js — 平底三角隧道实时滚动（保留翻滚）
window.Level2Track = (function () {
  'use strict';

  var tunnelGroup = new THREE.Group();
  var scrollGroup = new THREE.Group();
  var ringGroup = new THREE.Group();
  var segments = [];
  var segmentMaterials = [];
  var edgeRings = [];
  var segmentCreateIndex = 0;
  var scrollDistance = 0;

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
    'uniform float uEdgeTint;',
    'uniform vec3 uTintColor;',
    'float random(vec2 st) {',
    '  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);',
    '}',
    'void main() {',
    '  vec3 nebula = mix(uColor1, uColor2, vUv.y);',
    '  float star = step(0.997, random(floor(vUv * 90.0 + uTime * 0.03)));',
    '  vec3 starColor = vec3(0.9, 0.92, 1.0);',
    '  float vertLine = smoothstep(0.93, 1.0, 1.0 - abs(fract(vUv.x * 9.0) - 0.5) * 2.0);',
    '  float horizLine = smoothstep(0.94, 1.0, 1.0 - abs(fract(vUv.y * 0.75) - 0.5) * 2.0);',
    '  float gridLine = max(vertLine, horizLine);',
    '  vec3 gridColor = mix(vec3(0.0, 0.92, 1.0), uTintColor, 0.5) * gridLine;',
    '  vec3 color = mix(nebula, starColor, star);',
    '  color += gridColor * 1.05;',
    '  color += uTintColor * uEdgeTint * 0.3;',
    '  float edge = pow(abs(vUv.y - 0.5) * 2.0, 2.0);',
    '  color += vec3(0.0, 0.7, 1.0) * edge * 0.1;',
    '  float alpha = 0.3 + gridLine * 0.36 + edge * 0.08;',
    '  gl_FragColor = vec4(color, alpha);',
    '}'
  ].join('\n');

  var shaderTemplate = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#040818') },
      uColor2: { value: new THREE.Color('#180838') },
      uEdgeTint: { value: 0 },
      uTintColor: { value: new THREE.Color('#00e5ff') },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  function tintColorFor(id) {
    if (id === 'subway') return new THREE.Color('#00e5ff');
    if (id === 'rolling') return new THREE.Color('#b070ff');
    return new THREE.Color('#ff5ad8');
  }

  function edgeTintFor(id) {
    if (id === 'subway') return 0.2;
    if (id === 'rolling') return 0.5;
    return 0.7;
  }

  // 贴内壁的纵向细条（沿面切线方向铺开，与管壁平行）
  function floorStrip(parent, faceIndex, lat, radial, length, color, opacity, thick) {
    thick = thick || 0.05;
    var f = getLevel2FaceFrame(faceIndex);
    var box = new THREE.Mesh(
      new THREE.BoxGeometry(thick, thick, length),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false })
    );
    var p = getLevel2LocalPos(faceIndex, lat, radial);
    box.position.set(p.x, p.y, 0);
    box.rotation.z = Math.atan2(f.ty, f.tx);
    parent.add(box);
    return box;
  }

  function wallSurfaceRadial(layer) {
    return getLevel2ItemSurfaceRadial(layer || 0, 0.04);
  }

  function addLaneMarkers(parent, faceIndex, length, edgeId) {
    if (edgeId !== 'subway') return;
    var wallR = wallSurfaceRadial(0);
    LEVEL2_CONFIG.SUBWAY.LANE_X.forEach(function (lx) {
      floorStrip(parent, faceIndex, lx, wallR, length * 0.92, 0x00e5ff, 0.3, 0.05);
    });
  }

  // 换轨区：底轨 + 上轨平行贴壁，两侧栅栏
  function addCeilingRail(parent, faceIndex, length, edgeId) {
    if (edgeId !== 'rings') return;
    var halfCeil = LEVEL2_CONFIG.RINGS.LATERAL_HALF_CEIL;
    var ceilR = wallSurfaceRadial(1);
    var floorR = wallSurfaceRadial(0);
    var f = getLevel2FaceFrame(faceIndex);
    var plat = new THREE.Mesh(
      new THREE.BoxGeometry(halfCeil * 2 + 0.5, 0.07, length * 0.95),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })
    );
    var p = getLevel2LocalPos(faceIndex, 0, ceilR);
    plat.position.set(p.x, p.y, 0);
    plat.rotation.z = Math.atan2(f.ty, f.tx);
    parent.add(plat);
    floorStrip(parent, faceIndex, -halfCeil, ceilR, length * 0.95, 0xcf8bff, 0.5, 0.06);
    floorStrip(parent, faceIndex, halfCeil, ceilR, length * 0.95, 0xcf8bff, 0.5, 0.06);
    var edgeHalf = Math.min(LEVEL2_CONFIG.LATERAL_HALF, getLevel2FaceHalfWidth(0));
    floorStrip(parent, faceIndex, -edgeHalf, floorR, length * 0.95, 0x00e5ff, 0.4, 0.06);
    floorStrip(parent, faceIndex, edgeHalf, floorR, length * 0.95, 0x00e5ff, 0.4, 0.06);
  }

  // 区域交界：亮色门横条，贴当前底面内壁
  function addGate(parent, faceIndex, zLocal, color) {
    var wallR = wallSurfaceRadial(0);
    var f = getLevel2FaceFrame(faceIndex);
    var edgeHalf = Math.min(LEVEL2_CONFIG.LATERAL_HALF, getLevel2FaceHalfWidth(0));
    for (var k = 0; k < 3; k++) {
      var width = (edgeHalf + 0.4) * 2 * (1 - k * 0.18);
      var bar = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85 - k * 0.18, depthWrite: false })
      );
      var radial = wallR - k * 0.12;
      var p = getLevel2LocalPos(faceIndex, 0, radial);
      bar.position.set(p.x, p.y, zLocal - k * 0.5);
      bar.rotation.z = Math.atan2(f.ty, f.tx);
      parent.add(bar);
    }
  }

  function createGlowRing(z, radius) {
    var ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.992, radius * 0.992, 0.35, 3, 1, true, LEVEL2_CONFIG.THETA_START),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4, side: THREE.BackSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.z = z;
    return ring;
  }

  function createSegment(zCenter, edgeId, faceIndex, absStart) {
    var len = LEVEL2_CONFIG.PIPE.SEGMENT_LENGTH;
    var radius = LEVEL2_CONFIG.PIPE.RADIUS;
    var group = new THREE.Group();
    group.position.z = zCenter;

    var mat = shaderTemplate.clone();
    mat.uniforms.uEdgeTint.value = edgeTintFor(edgeId);
    mat.uniforms.uTintColor.value = tintColorFor(edgeId);

    var geo = new THREE.CylinderGeometry(radius, radius, len, 3, 1, true, LEVEL2_CONFIG.THETA_START);
    var shell = new THREE.Mesh(geo, mat);
    shell.rotation.x = -Math.PI / 2;
    group.add(shell);

    var wire = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.002, radius * 1.002, len, 3, 1, true, LEVEL2_CONFIG.THETA_START),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.05, depthWrite: false })
    );
    shell.add(wire);

    addLaneMarkers(group, faceIndex, len, edgeId);
    addCeilingRail(group, faceIndex, len, edgeId);

    // 交界门：本段是否跨越区域边界
    var absEnd = (absStart || 0) + len;
    var u0 = Math.floor((absStart || 0) / LEVEL2_CONFIG.EDGE_LENGTH);
    var u1 = Math.floor(absEnd / LEVEL2_CONFIG.EDGE_LENGTH);
    if (u1 > u0) {
      var boundary = u1 * LEVEL2_CONFIG.EDGE_LENGTH;
      var zLocal = boundary - (absStart || 0) - len / 2;
      var nextEdge = getLevel2EdgeAt(boundary + 0.5).edge.id;
      addGate(group, faceIndex, zLocal, tintColorFor(nextEdge));
    }

    segmentMaterials.push({ mat: mat, mesh: shell });
    segmentCreateIndex++;

    var rings = [];
    if (segmentCreateIndex % 4 === 0) {
      var ring = createGlowRing(zCenter, radius * 0.92);
      ringGroup.add(ring);
      edgeRings.push({ ring: ring, zOffset: zCenter });
      rings.push(ring);
    }

    return { group: group, mesh: shell, zOffset: zCenter, length: len, edgeId: edgeId, faceIndex: faceIndex, rings: rings };
  }

  function edgeInfoAtDistance(dist) {
    return getLevel2EdgeAt(dist);
  }

  function init() {
    tunnelGroup.add(scrollGroup);
    tunnelGroup.add(ringGroup);
    if (window.scene) {
      window.scene.add(tunnelGroup);
    }
    if (window.Level2World && Level2World.group.parent !== tunnelGroup) {
      tunnelGroup.add(Level2World.group);
    }
    reset();
  }

  function disposeGroup(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  function reset() {
    for (var s = 0; s < segments.length; s++) {
      disposeGroup(segments[s].group);
    }
    for (var r = 0; r < edgeRings.length; r++) {
      edgeRings[r].ring.geometry.dispose();
      edgeRings[r].ring.material.dispose();
    }
    while (scrollGroup.children.length) scrollGroup.remove(scrollGroup.children[0]);
    while (ringGroup.children.length) ringGroup.remove(ringGroup.children[0]);
    segments = [];
    segmentMaterials = [];
    edgeRings = [];
    segmentCreateIndex = 0;
    scrollDistance = 0;
    tunnelGroup.rotation.z = 0;

    var len = LEVEL2_CONFIG.PIPE.SEGMENT_LENGTH;
    for (var i = 0; i < LEVEL2_CONFIG.PIPE.VISIBLE_SEGMENTS; i++) {
      var zCenter = i * len + len / 2;
      var absStart = zCenter - len / 2;
      var info = edgeInfoAtDistance(absStart);
      var seg = createSegment(zCenter, info.edge.id, info.index, absStart);
      segments.push(seg);
      scrollGroup.add(seg.group);
      if (window.Level2World) {
        Level2World.populateSegment(absStart, zCenter + len / 2, info.edge.id, 0, 0, info.index);
      }
    }
  }

  function update(speed, dt, elapsedTime, distance) {
    scrollDistance = distance || 0;
    var delta = speed * dt;

    for (var s = 0; s < segmentMaterials.length; s++) {
      segmentMaterials[s].mat.uniforms.uTime.value = elapsedTime;
    }

    for (var i = 0; i < segments.length; i++) {
      segments[i].zOffset -= delta;
      segments[i].group.position.z = segments[i].zOffset;
    }
    for (var r = 0; r < edgeRings.length; r++) {
      edgeRings[r].zOffset -= delta;
      edgeRings[r].ring.position.z = edgeRings[r].zOffset;
    }

    while (segments.length > 0 && segments[0].zOffset + segments[0].length / 2 < -12) {
      var old = segments.shift();
      scrollGroup.remove(old.group);
      disposeGroup(old.group);
      for (var j = segmentMaterials.length - 1; j >= 0; j--) {
        if (segmentMaterials[j].mesh === old.mesh) segmentMaterials.splice(j, 1);
      }
      if (old.rings) {
        for (var k = 0; k < old.rings.length; k++) {
          ringGroup.remove(old.rings[k]);
        }
      }
    }
    for (var er = edgeRings.length - 1; er >= 0; er--) {
      if (edgeRings[er].zOffset < -18) {
        ringGroup.remove(edgeRings[er].ring);
        edgeRings.splice(er, 1);
      }
    }

    var len = LEVEL2_CONFIG.PIPE.SEGMENT_LENGTH;
    while (segments.length < LEVEL2_CONFIG.PIPE.VISIBLE_SEGMENTS) {
      var last = segments[segments.length - 1];
      var nextZ = last.zOffset + last.length / 2 + len / 2;
      var absDist = distance + (nextZ - len / 2);
      var info = edgeInfoAtDistance(absDist);
      var seg = createSegment(nextZ, info.edge.id, info.index, absDist);
      segments.push(seg);
      scrollGroup.add(seg.group);
      if (window.Level2World) {
        var diff = window.STATE ? window.STATE.difficultyLevel || 0 : 0;
        Level2World.populateSegment(nextZ - len / 2, nextZ + len / 2, info.edge.id, diff, distance, info.index);
      }
    }
  }

  function setTunnelRotation(rz) {
    tunnelGroup.rotation.z = rz;
  }

  function hide() {
    tunnelGroup.visible = false;
  }

  function show() {
    tunnelGroup.visible = true;
  }

  return {
    init: init,
    reset: reset,
    update: update,
    setTunnelRotation: setTunnelRotation,
    hide: hide,
    show: show,
    tunnelGroup: tunnelGroup,
    getRadius: function () { return LEVEL2_CONFIG.PIPE.RADIUS; },
  };
})();
