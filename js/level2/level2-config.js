// level2-config.js — 第二关：平底三角隧道 + 三面 120° 翻滚切换 + 三段平地玩法
const LEVEL2_CONFIG = {
  EDGE_LENGTH: 100,
  VERTEX_BLEND: 10,     // 交界翻滚 + 亮色门提示长度
  TOTAL_LAP: 300,
  FACE_STEP: (Math.PI * 2) / 3,

  // 三角朝向：使某个平面正好在底部（地面），对面顶点朝上。
  // 顶点在 θ = 90/210/330，底边中点在屏幕 (0, -0.5R)。
  THETA_START: Math.PI / 2,

  EDGES: [
    { id: 'subway',  name: '冲刺轨', mechanic: 'lane_runner' },
    { id: 'rolling', name: '浮空轨', mechanic: 'flat_runner' },
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
    GRAVITY: 22,
    JUMP_V: 9.5,
    LAUNCH_V: 13,
  },

  RINGS: {
    // 地面上下两条平行轨：layer 0 = 地面轨，layer 1 = 上方平行轨（抬高 CEIL_RISE）
    CEIL_RISE: 2.0,
    LATERAL_HALF_CEIL: 1.5,
    SWITCH_DUR: 0.3,
  },

  ROTATION_LERP: 5,
  TRANSITION_ROT_LERP: 13,
  JUMP_COOLDOWN: 0.12,
  TRANSITION_LIFT: 0.0,
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

// face i 在“隧道本地坐标”中的平面：中点方向角 ψ_i 与切线方向
function getLevel2FaceFrame(index) {
  var psi = -Math.PI / 2 + index * LEVEL2_CONFIG.FACE_STEP; // 底面 face0 朝下
  return {
    psi: psi,
    nx: Math.cos(psi), ny: Math.sin(psi),       // 法线（指向该面）
    tx: -Math.sin(psi), ty: Math.cos(psi),      // 切线（沿平面）
  };
}

// 在隧道本地坐标中，把 (face, 横向 lat, 距管心半径 radial) 映射为本地 XY
function getLevel2LocalPos(index, lat, radial) {
  var f = getLevel2FaceFrame(index);
  return {
    x: radial * f.nx + lat * f.tx,
    y: radial * f.ny + lat * f.ty,
  };
}

function level2Ease(t) {
  return t * t * (3 - 2 * t);
}
