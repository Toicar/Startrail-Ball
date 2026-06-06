# 星轨穿梭 / Star Tunnel Rush — 项目完整文档

> 版本：v0.3 | 更新：2026-06-06 | 3D 弹球闯关游戏

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [文件结构](#3-文件结构)
4. [玩法系统](#4-玩法系统)
   - [4.1 核心玩法](#41-核心玩法)
   - [4.2 控制输入](#42-控制输入)
   - [4.3 球体与物理](#43-球体与物理)
   - [4.4 管道系统](#44-管道系统)
   - [4.5 道具系统](#45-道具系统)
   - [4.6 障碍系统](#46-障碍系统)
   - [4.7 Buff 系统](#47-buff-系统)
   - [4.8 得分与 Combo](#48-得分与-combo)
   - [4.9 生命与死亡](#49-生命与死亡)
   - [4.10 难度曲线](#410-难度曲线)
   - [4.11 检查点](#411-检查点)
5. [视觉特效](#5-视觉特效)
6. [音频系统](#6-音频系统)
7. [UI 系统](#7-ui-系统)
8. [配置常量](#8-配置常量)
9. [游戏状态机](#9-游戏状态机)
10. [游戏循环数据流](#10-游戏循环数据流)
11. [屏幕适配](#11-屏幕适配)
12. [合规约束](#12-合规约束)
13. [历史 Bug 修复记录](#13-历史-bug-修复记录)
14. [部署与访问](#14-部署与访问)
15. [素材清单](#15-素材清单)

---

## 1. 项目概述

**星轨穿梭（Star Tunnel Rush）** 是一款基于 Three.js 的纯离线 3D 弹球闯关游戏 Demo，专为抖音互动空间设计。玩家控制球体在星河管道中飞驰，收集金币、躲避障碍、触发 Buff，管道形态随难度动态变化。包体 ≤ 8MB（当前约 ~220KB + 素材）。

**对标游戏**：滚动的天空 × 超音速隧道 × 重力滚球

### 基本信息

| 属性 | 值 |
|------|-----|
| 引擎 | Three.js v0.160 |
| 语言 | 纯 JavaScript（无 TS/框架），IIFE 模块 |
| 渲染 | WebGL，ShaderMaterial 程序化着色器 |
| 音频 | Web Audio API 程序化合成 |
| 入口 | `index.html` |
| 在线地址 | `https://toicar.github.io/Startrail-Ball/` |
| 仓库 | `https://github.com/Toicar/Startrail-Ball` |
| 包体 | ZIP ≤ 189KB（不含素材） |
| 网络 | 纯离线，零外部请求 |

---

## 2. 技术架构

### 依赖关系

```
three.min.js (THREE 全局)
  ↓
config.js (CONFIG 全局常量)
  ↓
input.js → ball.js → pipe.js → physics.js → world.js
  ↓                                              ↓
effects.js → audio.js → hud.js → screens.js
  ↓
main.js (入口，聚合所有模块)
```

### 全局命名空间

每个 JS 文件通过 IIFE 模式向 `window` 挂载一个模块对象：

| 模块 | 挂载点 | 职责 |
|------|--------|------|
| Three.js | `THREE` | 3D 引擎 |
| config | `CONFIG` | 全局游戏常量 |
| input | `window.Input` | 输入处理（陀螺仪/触屏/键盘） |
| ball | `window.Ball` | 球体渲染（逃生舱造型） |
| pipe | `window.PipeSystem` | 管道生成、滚动、着色器 |
| physics | `window.Physics` | 球角度运动物理 |
| world | `window.World` | 道具/障碍生成与碰撞 |
| effects | `window.Effects` | 粒子尾迹 + 爆发特效 |
| audio | `window.AudioFX` | 程序化音效 + BGM |
| hud | `window.HUD` | DOM HUD 叠加层 |
| screens | `window.Screens` | 开始/死亡/暂停画面 |
| main | — | 场景/摄像机/游戏循环 |

### 全局状态

```javascript
window.STATE = {
  phase: 'start' | 'playing' | 'paused' | 'dead',
  score: 0,
  combo: 0,
  lastCoinTime: 0,
  distance: 0,
  speed: CONFIG.BALL.BASE_SPEED,
  ballAngle: 0,
  activeBuffs: { speedBoost, magnet, scoreDouble },  // 计时器对象
  hasShield: false,          // 护盾（布尔，非计时器）
  checkpointDistance: 0,     // 最近检查点距离（预留）
  elapsedTime: 0,
  difficultyLevel: 0,        // 0-3
  lives: 3,                  // 当前生命
  maxLives: 3,
  invincible: 0,             // 受伤无敌倒计时
  _cpPlaced: {},            // 已放置检查点的 key 集合
  _pipeRotZ: 0              // 管道当前 Z 轴旋转
};
```

---

## 3. 文件结构

```
index.html                     # 入口（WebGL 检测 + 脚本加载）
js/
├── lib/three.min.js           # Three.js v0.160 (~656KB)
├── config.js                  # CONFIG 全局常量
├── input.js                   # 输入模块
├── ball.js                    # 球体渲染（逃生舱）
├── pipe.js                    # 管道系统
├── physics.js                 # 物理引擎
├── world.js                   # 道具/障碍世界
├── effects.js                 # 粒子特效
├── audio.js                   # 音频合成
├── hud.js                     # HUD 界面
├── screens.js                 # 画面（开始/死亡/暂停）
└── main.js                    # 主入口
css/
└── style.css                  # 全局样式
shaders/
├── starfield.vert             # 星空顶点着色器（参考）
└── starfield.frag             # 星空片段着色器（参考，含星云+网格线）
image/                         # 像素道具素材（64×64 PNG）
├── 金币.png
├── 加速.png
├── 磁铁.png
├── 盾.png
├── double.png
├── 地刺.png
├── 旋转障碍.png
├── 检查点.png
└── bonus门.png
qrcode.png                     # 访问二维码
```

---

## 4. 玩法系统

### 4.1 核心玩法

玩家操控球体沿一条无限延伸的星空管道（Z 轴正方向）飞驰。球体在管壁内侧沿截面圆周运动（X-Y 平面），通过改变角向位置来收集金币、触发道具、躲避障碍。游戏速度随时间持续增加，管道形态随机变化，难度分四个阶段递进。

**目标**：存活尽可能久，收集尽可能多金币，冲击最高分。

### 4.2 控制输入

输入模块输出**连续目标角度**（弧度），范围受屏幕比例约束。球体物理系统平滑跟随该角度。**不再使用离散车道**——球可在 -135° 到 +135° 之间任意位置停留（竖屏约 -99° 到 +99°）。

#### 陀螺仪（移动端）

| 参数 | 说明 |
|------|------|
| 竖屏模式 | 读取 `DeviceOrientationEvent.gamma`（左右倾斜） |
| 横屏模式 | 读取 `DeviceOrientationEvent.beta`（左右倾斜） |
| 灵敏度 | 默认 0.6，可调范围 0.3~1.2 |
| 映射公式 | `raw = clamp(tilt / (45/sensitivity), -1, 1)` → `targetAngle = -raw × ANGLE_RANGE` |
| iOS 13+ | 需用户点击触发 `requestPermission()` |
| 降级 | 3 秒内无陀螺仪数据 → Toast 提示"已切换摇杆模式" |

**灵敏度含义**：0.6 表示倾斜 75°（45/0.6）才满偏；1.0 表示倾斜 45° 满偏。

#### 触屏摇杆

| 行为 | 说明 |
|------|------|
| 触摸开始 | 记录初始 X 坐标 |
| 滑动 | 水平偏移量映射到角度：`dx / (屏幕宽×0.45)` → `[-1, 1]` → `targetAngle = -normalized × ANGLE_RANGE` |
| 松手 | `targetAngle` 立即归零（球靠重力回中） |

#### 键盘（桌面端）

| 按键 | 行为 |
|------|------|
| `←` 按住 | 目标角度平滑移向正角度（右） |
| `→` 按住 | 目标角度平滑移向负角度（左） |
| 松手 | 目标角度平滑回零 |
| 键盘 vs 陀螺仪 | 键盘按下时抑制陀螺仪数据，防止桌面端冲突 |

#### 横竖屏选择（开始画面）

| 选项 | 效果 |
|------|------|
| 🔄 自动 | 根据 `window.innerWidth > innerHeight` 自动判断 |
| 📱 竖屏 | 强制竖屏逻辑（陀螺仪用 gamma） |
| 🖥 横屏 | 强制横屏逻辑（陀螺仪用 beta） |

设置持久化到 `localStorage`。

### 4.3 球体与物理

#### 物理模型

球体在管壁截面（X-Y 平面）做角向运动，物理引擎每帧计算三种力矩：

| 力矩 | 公式 | 说明 |
|------|------|------|
| 重力 | `-sin(angle) × GRAVITY × 0.35` | 始终将球拉向底部（角度 0） |
| 输入 | `(targetAngle - angle) × 12` | 推向玩家目标角度 |
| 阻尼 | `-angularVelocity × DAMPING` | 防止振荡，DAMPING=8 |

位置计算：
- `ballX = sin(angle) × (pipeRadius - ballRadius)`
- `ballY = -cos(angle) × (pipeRadius - ballRadius)`

角度约束：`±π × 0.8 ≈ ±144°`（实际受 ANGLE_RANGE 动态限制）

管道绕 Z 轴旋转跟随球角度（lerp，`dt×5` 速率），保持球在玩家视野下方。

#### 球体视觉（逃生舱造型）

| 组件 | 说明 |
|------|------|
| 主舱体 | 深色金属球 `#1a2438`，metalness 0.9 |
| 赤道环 | 青蓝发光 Torus `#00bcd4`，`emissiveIntensity 0.35` |
| 纵轴环 | 金属灰色 Torus |
| 驾驶舱舷窗 | 青蓝发光小球 `#00e5ff`，球面前上方 |
| 尾部推进器 | 4 个半球凸点，等距分布在后方 |
| 引擎光晕 | 半透明球体，周期性脉冲 `opacity 0.4~0.55` |
| 外圈光晕 | 大半径半透明球，护盾时变金色 |
| 无敌状态 | 光晕变红色 `#ff4444`，驾驶舱红闪 |
| 护盾激活 | 光晕变金色 `#ffaa00`，opacity 0.28 |

### 4.4 管道系统

#### 结构

| 参数 | 值 |
|------|-----|
| 基础半径 | 4 单位 |
| 段长 | 12 单位 |
| 同时可见段数 | 8 段（视野 ~96 单位深） |
| 几何体 | `CylinderGeometry` 旋转 `-π/2`（Y 轴→Z 轴），`BackSide` 渲染 |
| 顶点密度 | `radiusSegments=12, heightSegments=1` |

#### 着色器（ShaderMaterial，程序化无贴图）

| 元素 | 算法 |
|------|------|
| 星云底色 | `mix(uColor1, uColor2, vUv.y)` + 紫色正弦波 |
| 星空 | `random(floor(vUv × 90 + uTime×0.03)) > 0.998` |
| 闪烁 | `random(vUv + uTime×0.07) × 0.6 + 0.4` |
| 大星 | `step(0.9995, random(floor(vUv × 24))) × 1.8` |
| 竖网格线 | `smoothstep(0.93, 1.0, 1 - abs(fract(vUv.x×12) - 0.5)×2)` |
| 横网格线 | `smoothstep(0.94, 1.0, 1 - abs(fract(vUv.y×0.8) - 0.5)×2)` |
| 边缘辉光 | `pow(abs(vUv.y-0.5)×2, 2) × cyan` |
| Alpha 混合 | `0.28 + gridLine×0.385 + edge×0.084` |

#### 管道形态

| 形态 | 半径 | 曲率 | 说明 |
|------|------|------|------|
| `straight` | 4.0 | 0 | 直道 |
| `wide` | 5.6 | 0 | 宽道（140%） |
| `narrow` | 2.6 | 0 | 窄道（65%） |
| `curveLeft` | 4.0 | +0.12 (X轴) | 左弯 |
| `curveRight` | 4.0 | -0.12 (X轴) | 右弯 |
| `curveUp` | 4.0 | +0.12 (Y轴) | 上弯 |

#### 形态选择概率

| 难度 | 逻辑 |
|------|------|
| 0（入门） | 100% `straight` |
| 1（进阶） | 50% straight, 25% curveLeft, 25% curveRight |
| 2+（挑战/极限） | 25% straight, 20% curve, 15% narrow, 15% wide, 25% curveUp/Right |

半径过渡：`newRadius = prevRadius + (targetRadius - prevRadius) × 0.3`（平滑渐变）

#### 光环

每 5 段（`RING_EVERY_N_SEGMENTS=5`）在段末尾生成一个 `TorusGeometry` 发光环，颜色 `#00a1b3`，opacity 随距离渐隐（30 单位外递减至 0.08）。

### 4.5 道具系统

道具沿管道 Z 轴分布，在段生成时通过 `World.populateSegment()` 放置。位置固定在管壁内侧（`radius - 0.3`），使用 45° 车道角的子集。

#### 道具列表

| 道具 | 英文 key | 颜色 | 几何体 | 尺寸 | 稀有度 | 效果 |
|------|---------|------|--------|------|--------|------|
| 金币 | `coin` | `#ffd740` 金 | Octahedron | 0.35 | 极高 | +10分，触发 Combo |
| 加速带 | `speedBoost` | `#00e5ff` 青 | Octahedron | 0.55 | 35%/段 | 速度×1.5，持续 2.5s |
| 磁铁 | `magnet` | `#ff4081` 品红 | Torus | 0.4 | 15%/段 | 金币自动吸附，范围 3 单位，持续 5s |
| 护盾 | `shield` | `#ffaa00` 橙 | Sphere | 0.45 | 15%/段 | 抵挡一次伤害 |
| 双倍得分 | `scoreX2` | `#ea80fc` 紫 | Octahedron | 0.45 | 8%/段 | 得分×2，持续 8s |
| Bonus 门 | `bonusGate` | `#00e676` 绿 | Torus | 0.75 | 10%/段 | 触发 15 枚金币涌入 |
| 检查点 | `checkpoint` | `#448aff` 蓝 | Torus | 0.65 | 每 270 距离 | 记录距离（预留复活） |

#### 金币布局模式

| 模式 | 生成逻辑 |
|------|---------|
| 单车道线 | 球当前车道上 3~5 枚 |
| 弧线 | 跨 2~3 车道，中心对齐球车道，3~4 枚 + 2.0 间距 |
| 双车道 | 球车道 -1 和 +1 各一列 |
| 空段 | 不生成金币（难度 0 起始也有 30% 空段） |

### 4.6 障碍系统

| 障碍 | 英文 key | 颜色 | 几何体 | 尺寸 | 生成条件 | 效果 |
|------|---------|------|--------|------|---------|------|
| 尖刺 | `spike` | `#ff1744` 红 | Cone | 0.5 | 难度 1+，70%/段 | 扣 1 命（无护盾时） |
| 旋转障碍 | `rotatingBarrier` | `#ff6d00` 深橙 | Box | 0.65 | 难度 2+，35%/段 | 沿管壁旋转，扣 1 命 |

**尖刺分布**：70% 概率出现在球当前车道 ±2 范围内（`pickLane(true, 2)`）；难度 2+ 有 50% 额外生成第二枚。

**旋转障碍行为**：角度以 `baseAngle + t×1.8 + z×0.35` 持续变化，沿管壁圆周移动，同时自转。

### 4.7 Buff 系统

| Buff | 存储方式 | 计时 | 效果 |
|------|---------|------|------|
| 加速 | `activeBuffs.speedBoost` | 倒计时 2.5s | `speedMultiplier ×= 1.5` |
| 磁铁 | `activeBuffs.magnet` | 倒计时 5.0s | 碰撞检测范围扩大到 3 单位 |
| 护盾 | `STATE.hasShield` (bool) | 不自动过期 | 格挡一次伤害后消失 |
| 双倍得分 | `activeBuffs.scoreDouble` | 倒计时 8.0s | 金币得分 ×2 |

Buff 计时器每帧递减 `dt`，归零时从 `activeBuffs` 对象中 `delete`。

### 4.8 得分与 Combo

| 参数 | 值 |
|------|-----|
| 基础金币分 | 10 分/枚 |
| Combo 阈值 | 连续 5 / 10 / 15 枚 |
| 倍率 | ×2 / ×3 / ×5 |
| Combo 超时 | 1.5 秒内未收集金币则重置 |
| 双倍 Buff | 最终得分 ×2 |

公式：`score += COIN_BASE × comboMultiplier × (scoreDouble ? 2 : 1)`

### 4.9 生命与死亡

| 参数 | 值 |
|------|-----|
| 最大生命 | 3（❤️❤️❤️） |
| 受伤伤害 | -1 命 |
| 无敌时间 | 1.5 秒（受伤后） |
| 死亡条件 | `lives ≤ 0` |
| 护盾 | 抵挡一次伤害，不扣命 |
| 死亡处理 | BGM 停止 → 更新最高分 → 显示死亡画面 |

死亡画面显示：
- 得分（大字）
- 新纪录提示（🏆 最高分对比）
- 距离（m）+ 存活时间（s）
- "再来一次" 按钮

### 4.10 难度曲线

分四个阶段，按 `elapsedTime` 自动切换：

| 阶段 | 时间范围 | 速度倍率 | 障碍密度 | 金币倍率 | 特点 |
|------|---------|---------|---------|---------|------|
| 入门 | 0~30s | 1.0× | 0% | 1× | 纯直道，无任何障碍 |
| 进阶 | 30~90s | 1.3× | 20% | 2× | 弯道出现，尖刺开始生成 |
| 挑战 | 90~180s | 1.6× | 45% | 3× | 窄口/宽道 + 旋转障碍 |
| 极限 | 180s+ | 2.0× | 70% | 5× | 密集组合、高难度 |

**渐进加速**：基础速度 6 + `elapsedTime × 0.8`，上限 22（约 27 秒到达上限）。

速度计算公式：
```
baseSpeed = min(6 + elapsedTime × 0.8, 22) × difficulty.speedMul × buffSpeedMul
```

### 4.11 检查点

每 `45 × BASE_SPEED = 270` 距离单位放置一个检查点（蓝环）。碰撞时记录 `STATE.checkpointDistance`。当前版本**预留了复活功能接口，尚未实现实际复活逻辑**。

---

## 5. 视觉特效

### 5.1 粒子尾迹（Trail）

| 参数 | 值 |
|------|------|
| 最大粒子数 | 60（低画质 30） |
| 粒子颜色 | HSL 随机（蓝~青范围） |
| 混合模式 | `AdditiveBlending` |
| 生命期 | 1.0s，decay 1.5~3.5/s |
| 行为 | 缩小 `×0.97`/帧 + 向后飘 `z-=0.15`/帧 |

### 5.2 爆发粒子（Burst）

| 触发 | 颜色 | 数量 |
|------|------|------|
| 金币收集 | `#ffd740` 金黄 | 20 |
| 碰撞尖刺 | `#ff1744` 红 | 20 |
| 碰撞旋转障碍 | `#ff6d00` 深橙 | 20 |

粒子以随机速度各向飞出，受重力 `vy+=2×dt` 影响，opacity 线性衰减。

### 5.3 深空星云背景

`main.js` 中创建半径 55 的 `SphereGeometry`，`BackSide` 渲染。ShaderMaterial 程序化生成：

| 元素 | 算法 |
|------|------|
| 基色 | `mix(#010208, #1e0a38, dir.y)` |
| 紫色星云带 | `sin(dir.x×3 + t)` 的幂函数 |
| 蓝色星云带 | `cos(dir.z×2.5 - t×0.7)` 的幂函数 |
| 星空 | `step(0.997, random(floor(dir.xy×120 + t)))` |

### 5.4 雾效

`scene.fog = new THREE.FogExp2(0x020818, 0.008)` 实现远处管道渐隐。

### 5.5 光照

| 光源 | 颜色 | 强度 | 位置 |
|------|------|------|------|
| Ambient | `#334466` | 0.5 | 全局 |
| Point | `#00ccff` 青蓝 | 1.8 | 跟随球位置 |

---

## 6. 音频系统

全部使用 Web Audio API 程序化合成（无音频文件）。

### BGM

| 参数 | 值 |
|------|-----|
| 波形 | Sine |
| 基频 | 55Hz + `speed/MAX_SPEED × 30`（随速度升高） |
| 音量 | 0.025 |
| 持续/间隔 | 0.35s / `500 - speed×8` ms（最低 120ms） |

速度越快，BGM 音调越高、节奏越密。

### SFX

| 音效 | 实现 |
|------|------|
| 金币收集 | 880Hz→1320Hz 双音阶，sine，各 0.08~0.1s，exponentialRamp |
| 道具获得 | 440→660→880Hz 三音阶上升，square，各 0.15~0.2s |
| 碰撞障碍 | 80Hz sawtooth + 60Hz triangle，各 ~0.25s |
| 检查点 | 523→659→784Hz 三音阶，sine，各 0.2~0.3s |

### AudioContext 生命周期

| 事件 | 行为 |
|------|------|
| 页面加载 | `init()` 创建 AudioContext |
| 用户首次交互 | `resume()` 解除 `suspended` 状态 |
| 游戏开始 | `startBGM()` 启动脉冲循环 |
| 游戏死亡 | `stopBGM()` 清除定时器 |
| 后台/暂停 | 无自动处理（BGM 依赖 `STATE.phase==='playing'`） |

---

## 7. UI 系统

### 7.1 开始画面

| 元素 | 内容 |
|------|------|
| 标题 | "星轨穿梭"（青紫渐变文字） |
| 副标题 | "Star Tunnel Rush" |
| 最高分 | 🏆 最高分: N（有记录时显示） |
| 设置面板 | 屏幕方向三选一 + 陀螺仪灵敏度滑块 |
| 操作提示 | "倾斜手机控制球体 · 或触摸屏幕移动" |
| 按钮 | "开始游戏"（青紫渐变发光） |

整体为毛玻璃卡片风格：`backdrop-filter: blur(4px)`，半透明深蓝底，霓虹青边框。

### 7.2 HUD（游戏中）

| 位置 | 元素 | 说明 |
|------|------|------|
| 左上 | 生命心 ❤️🖤 | 满血红心、空血灰心 |
| 左上 | 分数 🪙 N | 当前得分 |
| 右上 | 🏆 最高分 | 芯片框（紫边框） |
| 右上 | ⏸ 暂停按钮 | 青色边框小方块 |
| 中部 | 速度条 | 青紫渐变填充，0~100% |
| 下方 | Buff 图标 | 芯片框，显示名称 + 倒计时 |
| 底部中央 | Combo 文字 | ✨ COMBO ×2 / ⚡ ×3 / 🔥 ×5 |

### 7.3 暂停画面

毛玻璃卡片："暂停" 标题 + "继续"（渐变主按钮）+ "重新开始"（次按钮）。

### 7.4 死亡画面

毛玻璃卡片："撞毁！"（红色标题）+ 得分（金色大字）+ 新纪录提示 + 最高分/距离/时间 + "再来一次" 按钮。

### 7.5 Toast 提示

底部浮动半透明提示框，2.6 秒自动消失。用途：陀螺仪不可用降级通知、游戏错误提示。

---

## 8. 配置常量

完整常量见 `js/config.js`：

```javascript
CONFIG = {
  PIPE:    { BASE_RADIUS:4, SEGMENT_LENGTH:12, VISIBLE_SEGMENTS:8, WALL_THICKNESS:0.2 },
  BALL:    { RADIUS:0.55, BASE_SPEED:6, MAX_SPEED:22, SPEED_RAMP:0.8, PICKUP_RANGE:0.6 },
  LANES:   { ANGLES:[-135°~+135°, 步进45°], COUNT:7 },  // 用于道具布局，非球移动
  PHYSICS: { GRAVITY:20, DAMPING:8, CENTRIFUGAL:1.2 },
  DIFFICULTY: [30s入门, 60s进阶, 90s挑战, 极限],
  BUFFS:   { SPEED_BOOST|MAGNET|SHIELD|SCORE_DOUBLE },
  SCORE:   { COIN_BASE:10, COMBO_MULTIPLIERS:[2,3,5] },
  AUDIO:   { enabled:true },
  GYRO:    { SENSITIVITY_DEFAULT:0.6 },
  CAMERA:  { PORTRAIT_FOV:68, LANDSCAPE_FOV:52, PORTRAIT_Z:-10, LANDSCAPE_Z:-7,
             PORTRAIT_ANGLE_MAX:0.55, LANDSCAPE_ANGLE_MAX:0.75 }
};
```

---

## 9. 游戏状态机

```
start ──(点击"开始游戏")──→ playing
                              │
                    (点顶部12%区域)  (visibilitychange: hidden)
                              ↓                ↓
                           paused ←────────────┘
                              │
                    (点击"继续"/"重新开始")
                              │
                    ┌─────────┘
                    ↓
              playing / start
                              
playing ──(lives≤0)──→ dead ──(点击"再来一次")──→ start
```

状态转换函数：

| 函数 | 触发 | 行为 |
|------|------|------|
| `startGame()` | 开始按钮 / 重新开始 | 重置 STATE + World + PipeSystem + Physics |
| `resumeGame()` | 暂停→继续 | 仅改 phase，Screens.hide() |
| `die()` | lives≤0 | 保存最高分 → showDeath → HUD.hide |
| 自动暂停 | `visibilitychange` + hidden | 仅当 playing 时触发 |

---

## 10. 游戏循环数据流

```
requestAnimationFrame
  ↓
dt = min(clock.getDelta(), 0.1)    // 上限 0.1s 防跳帧
  ↓
elapsedTime += dt
  ↓
getCurrentDifficulty(elapsedTime)  → difficultyLevel, speedMul
  ↓
baseSpeed = min(6 + elapsedTime×0.8, 22) × speedMul × buffMul
  ↓
Input.update(dt)                   // 键盘持续输入
targetAngle = Input.getTargetAngle()
  ↓
pipeR = PipeSystem.getPipeRadiusAt(0)
  ↓
smoothAngle = Physics.updateLane(targetAngle, pipeR, dt)
  ↓
ballX = sin(smoothAngle) × (pipeR - ballR)
ballY = -cos(smoothAngle) × (pipeR - ballR)
Ball.setPosition(ballX, ballY, 0)
  ↓
targetRotZ = -smoothAngle
_pipeRotZ += (targetRotZ - _pipeRotZ) × dt×5
→ PipeSystem/ringGroup/World.group.rotation.z = _pipeRotZ
  ↓
PipeSystem.update(speed, dt, elapsedTime, diffLevel, distance)
  ↓
World.checkCollisions(ballX, ballY, 0) → handleCollision()
World.update(dt, speed)            // 道具跟随管道移动
World.clearBehind(-15)             // 清理后方道具
  ↓
无敌计时 / Buff 计时器递减
  ↓
Effects.updateTrail() / updateBursts(dt)
  ↓
HUD.update(STATE)
  ↓
renderer.render(scene, camera)
```

---

## 11. 屏幕适配

| 屏幕类型 | aspect | FOV | 相机 Z | 角度范围 |
|----------|--------|-----|--------|---------|
| 竖屏（手机） | <0.6 | 68° | -10 | ±99° (0.55π) |
| 横屏（手机） | >1.5 | 52° | -7 | ±135° (0.75π) |
| 桌面/平板 | 0.6~1.5 | 55° | -8 | ±117° (0.65π) |

**适配特性**：
- `safe-area-inset` 刘海屏安全区
- `orientationchange` 延迟 200ms 重设尺寸
- `devicePixelRatio` 上限 2（性能保护）
- 禁止缩放/选择/长按菜单

---

## 12. 合规约束

| 约束 | 要求 |
|------|------|
| 包体 | ZIP ≤ 8MB（当前 ~220KB + 素材 ~250KB） |
| 网络 | 纯离线，禁止任何外部请求/CDN/跳转 |
| 入口 | 根目录 `index.html`，所有资源相对路径 |
| 存储 | 仅 localStorage（最高分、设置） |
| 错误 | try-catch + 友好提示（不死白屏） |
| 合规 | 无违法违规/IP 侵权/不利于未成年人内容 |

---

## 13. 历史 Bug 修复记录

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 管道不可见 | `CylinderGeometry` 沿 Y 轴 | `rotation.x = -PI/2` 旋转到 Z 轴 |
| 2 | 道具不出现 | `World.reset()` 在 `PipeSystem.init()` 之后调用 | 调换顺序 |
| 3 | 道具不随管道移动 | `World.update()` 未更新道具 Z 坐标 | `item.z -= speed×dt` |
| 4 | 碰撞判定异常 | `checkCollisions` 用局部坐标比对世界坐标 | `getWorldPosition()` |
| 5 | 开局报错死亡 | 变量重命名后 `ballPos` 未更新 | 变量名修正 + try-catch |
| 6 | 键盘方向反转 | ArrowLeft→-1 与预期相反 | 交换返回值 |
| 7 | 重开旋转残留 | `World.group.rotation.z` 未重置 | 显式置零 |
| 8 | 粒子内存泄漏 | `remove()` 未调 `dispose()` | 添加 `geometry/material.dispose()` |
| 9 | `selectPattern` bug | `rand < 0.5` 在 `[0.25,0.45)` 区间恒 true | 改用 `Math.random() < 0.5` |
| 10 | 球移动卡顿 | 输入输出离散车道索引（7 档） | 改为连续角度系统 |
| 11 | 桌面键盘失效 | `deviceorientation` 事件设置 `useGyro=true` | 键盘与陀螺仪去耦合 |
| 12 | 竖屏球出画 | 竖屏水平 FOV ~29° 过窄 | 动态 FOV + 拉远相机 + 限制角度 |
| 13 | 横屏陀螺仪错误 | 始终用 gamma（竖屏轴） | 横屏切 beta |

---

## 14. 部署与访问

### 本地开发

```bash
git clone https://github.com/Toicar/Startrail-Ball.git
cd Startrail-Ball
python -m http.server 8080
# 访问 http://localhost:8080
```

### GitHub Pages

在线地址：`https://toicar.github.io/Startrail-Ball/`

每次 push `master` 分支自动部署，1~2 分钟生效。

### 访问二维码

根目录 `qrcode.png`，手机扫码直达。

---

## 15. 素材清单

| 文件 | 格式 | 尺寸 | 说明 |
|------|------|------|------|
| `image/金币.png` | PNG | 64×64 | 金币道具像素图 |
| `image/加速.png` | PNG | 64×64 | 加速带道具像素图 |
| `image/磁铁.png` | PNG | 64×64 | 磁铁道具像素图 |
| `image/盾.png` | PNG | 64×64 | 护盾道具像素图 |
| `image/double.png` | PNG | 64×64 | 双倍得分道具像素图 |
| `image/地刺.png` | PNG | 64×64 | 尖刺障碍像素图 |
| `image/旋转障碍.png` | PNG | 64×64 | 旋转障碍像素图 |
| `image/检查点.png` | PNG | 64×64 | 检查点像素图 |
| `image/bonus门.png` | PNG | 64×64 | Bonus 门像素图 |
| `qrcode.png` | PNG | 300×300 | 访问二维码 |

> 注：像素素材已准备完毕，当前游戏仍使用 Three.js 3D 几何体渲染道具，Sprite 替换待实现。

---

## 附录：Git 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v0.1 | — | 初始版本，基础 3D 管道 + 球物理 |
| v0.2 | 2026-06-06 | 星轨穿梭 — 3D 弹球闯关，完整道具/障碍/难度 |
| v0.2.1 | 2026-06-06 | 内存泄漏修复 + selectPattern bug + Physics 死代码清理 |
| v0.2.2 | 2026-06-06 | 连续角度运动 + 竖屏/横屏自适应 + 陀螺仪灵敏度 |
| v0.2.3 | 2026-06-06 | 移除减速道具 + 桌面键盘修复 |
| v0.3 | 2026-06-06 | 合并 Cy 分支（霓虹 UI + 星云背景 + 逃生舱球体）+ 像素素材 |
