# 星轨穿梭 / Star Tunnel Rush

> 3D 弹球闯关游戏 — 抖音互动空间 Demo | 最后更新: 2026-06-06

## 项目概述

基于 Three.js 的纯离线 3D 游戏。玩家通过陀螺仪/触屏控制球体在星河管道中飞驰，收集金币、躲避障碍。管道动态变化，难度渐进。ZIP ≤ 8MB。

## 技术栈

- Three.js v0.160 (classic script, 本地 `js/lib/three.min.js`)
- 纯 JS (无 TS/框架)，IIFE 模块模式挂载到 `window`
- 物理自研：重力扭矩 + 输入扭矩 + 阻尼 + 离心力
- 视觉：ShaderMaterial 星空着色器 + 程序化几何体（零贴图）
- 音频：Web Audio API 程序化合成

## 关键架构

### 文件结构
```
index.html → 入口（加载顺序决定依赖关系）
js/
├── lib/three.min.js   # Three.js (~656KB)
├── config.js          # CONFIG 全局常量 + getCurrentDifficulty()
├── input.js           # window.Input — 陀螺仪/触屏/键盘
├── ball.js            # window.Ball — 球体渲染
├── pipe.js            # window.PipeSystem — 管道生成/滚动/着色器
├── physics.js         # window.Physics — 球物理（角度运动）
├── world.js           # window.World — 道具/障碍生成（45°车道系统）
├── effects.js         # window.Effects — 粒子尾迹/爆发
├── audio.js           # window.AudioFX — 音效合成
├── hud.js             # window.HUD — DOM HUD
├── screens.js         # window.Screens — 开始/死亡/暂停画面
└── main.js            # 入口 — 场景/摄像机/游戏循环/碰撞处理
css/style.css
shaders/starfield.{vert,frag}
```

### 加载顺序（重要！）
`three.min.js → config.js → input.js → ball.js → pipe.js → physics.js → world.js → effects.js → audio.js → hud.js → screens.js → main.js`

### 状态机
- `start` → 开始画面 → 点击按钮 → `startGame()`
- `playing` → 游戏循环：输入→物理→管道滚动→碰撞→渲染
- `paused` → 点顶部区域暂停，`resumeGame()`
- `dead` → 死亡画面，`startGame()` 重新开始

### 管道旋转机制
- 球在管壁上自由移动（Physics 计算角度 θ）
- 管道绕 Z 轴缓慢旋转（lerp 跟随 -θ，dt*4 速率）
- 视觉：球趋于底部但不锁死，有滑动过渡感

### 45° 车道系统
- 7 条车道：-135°/-90°/-45°/0°/45°/90°/135°
- 道具/障碍生成在车道中心线上
- 尖刺 70% 出现在球当前车道 ±2 范围

### 关键修复记录
- `CylinderGeometry` 需旋转 -π/2 从 Y 轴到 Z 轴
- `startGame()` 顺序：先 `World.reset()` → 再 `PipeSystem.init()`（否则道具被清空）
- 道具需在 `World.update()` 中随管道 Z 坐标递减

## 约束
- ZIP ≤ 8MB | 纯离线 | 无外部 CDN | index.html 入口
- 移动优先，自适应竖屏/横屏
- 抖音 App 扫码体验
