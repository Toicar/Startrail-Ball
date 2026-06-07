// level2-config.js — 第二关：平底三角隧道 + 三面 120° 翻滚切换 + 三段平地玩法
const LEVEL2_CONFIG = {
  EDGE_LENGTH: 150,
  VERTEX_BLEND: 12,     // 交界翻滚 + 亮色门提示长度
  TOTAL_LAP: 450,
  FACE_STEP: (Math.PI * 2) / 3,

  // 与 Three.js CylinderGeometry 一致：rotation.x=-π/2 后截面坐标为 (sinθ·R, cosθ·R)。
  // THETA_START=0 → 顶点在上方、底边水平（θ=120° 与 240° 顶点共线 y=-R/2）。
  THETA_START: 0,

  EDGES: [
    { id: 'subway',  name: '冲刺轨', mechanic: 'lane_runner' },
    { id: 'rolling', name: '浮空轨', mechanic: 'float_2d' },
    { id: 'rings',   name: '换轨区', mechanic: 'floor_ceiling' },
  ],

  PIPE: {
    RADIUS: CONFIG.PIPE.BASE_RADIUS,
    SEGMENT_LENGTH: CONFIG.PIPE.SEGMENT_LENGTH,
    VISIBLE_SEGMENTS: CONFIG.PIPE.VISIBLE_SEGMENTS,
  },

  SPEED: {
    BASE: 7,
    MAX: 20,
    RAMP: 0.6,
    TRANSITION_MUL: 0.5,
  },

  // 横向移动：沿地面（平底）的世界 X 范围
  LATERAL_HALF: 2.5,
  LATERAL_LERP: 12,

  SUBWAY: {
    LANE_X: [-1.8, 0, 1.8],
    GRAVITY: 22,
    JUMP_V: 9.5,
    LOW_BARRIER_H: 0.6,
  },

  ROLLING: {
    FLOAT_SPEED: 5.2,
    FLOAT_LERP: 11,
    FLOAT_MARGIN: CONFIG.BALL.RADIUS * 0.85,
    // 保留供第一关碰撞兼容
    GRAVITY: 22,
    JUMP_V: 9.5,
    LAUNCH_V: 13,
  },

  RINGS: {
    // 地面上下两条平行轨：layer 0 = 地面轨，layer 1 = 上方平行轨（抬高 CEIL_RISE）
    CEIL_RISE: 2.0,
    LATERAL_HALF_CEIL: 1.5,
    SWITCH_DUR: 0.3,
    PORTAL_INSET: 10,   // 换轨区入口/出口传送门距区域边界的距离
    RINGS_FACE_INDEX: 2,
  },

  ROTATION_LERP: 5,
  TRANSITION_ROT_LERP: 13,
  JUMP_COOLDOWN: 0.12,
  TRANSITION_LIFT: 0.0,

  // 第二关专用相机：略抬高机位 + 俯视前方远处，球落在画面下 1/3，便于观察道具分布
  CAMERA: {
    POS_Y: -0.35,
    LANDSCAPE_POS_Y: -0.5,
    SQUARE_POS_Y: -0.4,
    PORTRAIT_Z: -11,
    LANDSCAPE_Z: -8,
    SQUARE_Z: -9,
    LOOK_Y: -2.2,
    LOOK_Z: 14,
  },
};

function getLevel2EdgeAt(distance) {
  var lap = ((distance % LEVEL2_CONFIG.TOTAL_LAP) + LEVEL2_CONFIG.TOTAL_LAP) % LEVEL2_CONFIG.TOTAL_LAP;
  var idx = Math.floor(lap / LEVEL2_CONFIG.EDGE_LENGTH);
  if (idx >= LEVEL2_CONFIG.EDGES.length) idx = LEVEL2_CONFIG.EDGES.length - 1;
  var edgeStart = idx * LEVEL2_CONFIG.EDGE_LENGTH;
  var local = lap - edgeStart;
  var blendStart = LEVEL2_CONFIG.EDGE_LENGTH - LEVEL2_CONFIG.VERTEX_BLEND;
  var transT = local >= blendStart
    ? THREE.MathUtils.clamp((local - blendStart) / LEVEL2_CONFIG.VERTEX_BLEND, 0, 1)
    : 0;
  return {
    index: idx,
    edge: LEVEL2_CONFIG.EDGES[idx],
    nextEdge: LEVEL2_CONFIG.EDGES[(idx + 1) % LEVEL2_CONFIG.EDGES.length],
    localDistance: local,
    lapDistance: lap,
    transT: transT,
    inTransition: transT > 0,
  };
}

// 翻滚：把 face i 转到底部所需的隧道旋转角
function getLevel2FaceCenter(index) {
  return -index * LEVEL2_CONFIG.FACE_STEP;
}

// 三角形内切半径（apothem）：平面到管心的距离
function getLevel2Apothem() {
  return 0.5 * LEVEL2_CONFIG.PIPE.RADIUS;
}

// 地面（球心）Y：底面在 Y = -apothem，球落在其内侧
function getLevel2FloorY() {
  return -(getLevel2Apothem() - CONFIG.BALL.RADIUS);
}

// 各玩法面在 CylinderGeometry 中对应的 apothem 角（与网格完全一致）
function getLevel2FaceApothem(index) {
  var apothems = [Math.PI, Math.PI / 3, (5 * Math.PI) / 3];
  return apothems[index % 3];
}

// face i 贴壁坐标：n 为面法线，t 为沿底边的切线（必须与 n 正交，否则横向会离轨）
function getLevel2FaceFrame(index) {
  var phi = getLevel2FaceApothem(index);
  return {
    phi: phi,
    nx: Math.sin(phi),
    ny: Math.cos(phi),
    tx: -Math.cos(phi),
    ty: Math.sin(phi),
  };
}

// wallNDist：沿法线到管壁的距离（球/道具贴面时恒定）；lat：沿面切线的偏移
function getLevel2LocalPos(index, lat, wallNDist) {
  var f = getLevel2FaceFrame(index);
  return {
    x: wallNDist * f.nx + lat * f.tx,
    y: wallNDist * f.ny + lat * f.ty,
  };
}

// 已知世界 X，反解面内切线偏移（保证各段左右始终沿屏幕水平方向贴轨）
function getLevel2LatFromWorldX(faceIndex, worldX, wallNDist, rz) {
  var f = getLevel2FaceFrame(faceIndex);
  if (rz === undefined && window.Level2Track && Level2Track.tunnelGroup) {
    rz = Level2Track.tunnelGroup.rotation.z;
  } else if (rz === undefined) {
    rz = 0;
  }
  var denom = f.tx * Math.cos(rz) - f.ty * Math.sin(rz);
  if (Math.abs(denom) < 1e-4) return 0;
  return (worldX - wallNDist * Math.sin(f.phi - rz)) / denom;
}

// 球心径向距离：贴内壁滑行，跳跃/上轨向管心偏移
function getLevel2BallRadial(jumpOffset, ringRise) {
  var apo = getLevel2Apothem();
  return apo - CONFIG.BALL.RADIUS - (jumpOffset || 0) - (ringRise || 0);
}

// 道具/栅栏贴壁径向（略向管心抬一点，避免贴图穿模）
function getLevel2ItemSurfaceRadial(layer, lift) {
  var apo = getLevel2Apothem();
  var inset = lift !== undefined ? lift : 0.12;
  var r = apo - inset;
  if (layer === 1) r -= LEVEL2_CONFIG.RINGS.CEIL_RISE;
  return r;
}

// 当前面沿切线方向可移动半宽（贴壁时随径向缩放）
function getLevel2FaceHalfWidth(ringRise) {
  var apo = getLevel2Apothem();
  var radial = getLevel2BallRadial(0, ringRise || 0);
  var scale = Math.max(0.55, radial / apo);
  return apo * Math.tan(Math.PI / 3) * scale - CONFIG.BALL.RADIUS * 0.45;
}

// 隧道本地 → 世界（与第一关管壁坐标一致，经 tunnelGroup.rotation.z 旋转）
function getLevel2WorldPos(faceIndex, lat, radial, rz) {
  var local = getLevel2LocalPos(faceIndex, lat, radial);
  if (rz === undefined && window.Level2Track && Level2Track.tunnelGroup) {
    rz = Level2Track.tunnelGroup.rotation.z;
  } else if (rz === undefined) {
    rz = 0;
  }
  var c = Math.cos(rz);
  var s = Math.sin(rz);
  return {
    x: local.x * c - local.y * s,
    y: local.x * s + local.y * c,
  };
}

function level2Ease(t) {
  return t * t * (3 - 2 * t);
}

// 隧道截面本地坐标 ↔ 世界坐标（仅绕 Z 旋转）
function level2LocalToWorldXY(lx, ly, rz) {
  if (rz === undefined && window.Level2Track && Level2Track.tunnelGroup) {
    rz = Level2Track.tunnelGroup.rotation.z;
  } else if (rz === undefined) {
    rz = 0;
  }
  var c = Math.cos(rz);
  var s = Math.sin(rz);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

function level2WorldToLocalXY(wx, wy, rz) {
  if (rz === undefined && window.Level2Track && Level2Track.tunnelGroup) {
    rz = Level2Track.tunnelGroup.rotation.z;
  } else if (rz === undefined) {
    rz = 0;
  }
  var c = Math.cos(rz);
  var s = Math.sin(rz);
  return { x: wx * c + wy * s, y: -wx * s + wy * c };
}

// 将点约束在三角管道内切区域（本地坐标，不贴壁）
function clampLevel2TriangleLocal(lx, ly, margin) {
  margin = margin !== undefined ? margin : LEVEL2_CONFIG.ROLLING.FLOAT_MARGIN;
  var maxD = getLevel2Apothem() - margin;
  for (var pass = 0; pass < 4; pass++) {
    for (var i = 0; i < 3; i++) {
      var f = getLevel2FaceFrame(i);
      var d = lx * f.nx + ly * f.ny;
      if (d > maxD) {
        var excess = d - maxD;
        lx -= excess * f.nx;
        ly -= excess * f.ny;
      }
    }
  }
  return { x: lx, y: ly };
}

function randomLevel2TriangleLocal(margin) {
  margin = margin !== undefined ? margin : LEVEL2_CONFIG.ROLLING.FLOAT_MARGIN + 0.15;
  var maxR = getLevel2Apothem() - margin;
  for (var i = 0; i < 24; i++) {
    var lx = (Math.random() * 2 - 1) * maxR * 0.92;
    var ly = (Math.random() * 2 - 1) * maxR * 0.92;
    var c = clampLevel2TriangleLocal(lx, ly, margin);
    if (Math.abs(c.x - lx) + Math.abs(c.y - ly) < 0.08) return c;
  }
  return { x: 0, y: -maxR * 0.45 };
}
