// config.js — 全局游戏常量
const CONFIG = {
  // 管道
  PIPE: {
    BASE_RADIUS: 4,
    SEGMENT_LENGTH: 12,
    VISIBLE_SEGMENTS: 8,
    WALL_THICKNESS: 0.2,
  },
  // 球
  BALL: {
    RADIUS: 0.55,
    BASE_SPEED: 6,
    MAX_SPEED: 22,
    SPEED_RAMP: 0.8,       // 每秒加速量
    TILT_SENSITIVITY: 0.06,
    PICKUP_RANGE: 0.6,     // 额外拾取范围
  },
  // 45° 车道
  LANES: {
    ANGLES: [-2.356, -1.571, -0.785, 0, 0.785, 1.571, 2.356],  // -135° to +135°, step 45°
    COUNT: 7,
  },
  // 物理
  PHYSICS: {
    GRAVITY: 20,
    DAMPING: 8,
    CENTRIFUGAL: 1.2,
  },
  // 难度阶段
  DIFFICULTY: [
    { time: 0,   speedMul: 1.0, obstacleDensity: 0,   coinMul: 1, name: '入门' },
    { time: 30,  speedMul: 1.3, obstacleDensity: 0.2, coinMul: 2, name: '进阶' },
    { time: 90,  speedMul: 1.6, obstacleDensity: 0.45,coinMul: 3, name: '挑战' },
    { time: 180, speedMul: 2.0, obstacleDensity: 0.7, coinMul: 5, name: '极限' },
  ],
  // 道具
  BUFFS: {
    SPEED_BOOST:  { duration: 2.5,  speedMul: 1.5, stripLength: 5.5 },
    MAGNET:       { duration: 5.0,  radius: 9 },
    SHIELD:       { duration: Infinity, hitsBlocked: 1 },
    SCORE_DOUBLE: { duration: 8.0,  multiplier: 2 },
  },
  // 得分
  SCORE: {
    COIN_BASE: 10,
    COMBO_THRESHOLD: 5,
    COMBO_MULTIPLIERS: [2, 3, 5],
  },
  // 音效
  AUDIO: { enabled: true },

  // 陀螺仪
  GYRO: {
    SENSITIVITY_DEFAULT: 0.6,   // 0.3~1.2，1.0=倾斜45°满偏
  },

  // 摄像机（按屏幕比例动态调整）
  CAMERA: {
    PORTRAIT_FOV: 68,
    LANDSCAPE_FOV: 52,
    PORTRAIT_Z: -10,            // 竖屏拉远避免球出画
    LANDSCAPE_Z: -7,
    PORTRAIT_ANGLE_MAX: 0.55,   // ×π ≈ 99°
    LANDSCAPE_ANGLE_MAX: 0.75,  // ×π ≈ 135°
  },
};

// 根据经过时间获取当前难度等级
function getCurrentDifficulty(elapsedTime) {
  const levels = CONFIG.DIFFICULTY;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (elapsedTime >= levels[i].time) {
      return { ...levels[i], index: i };
    }
  }
  return { ...levels[0], index: 0 };
}
