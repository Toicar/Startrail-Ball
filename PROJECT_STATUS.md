# 星轨穿梭 / Star Tunnel Rush — 项目状态总览

> 更新日期：2026-06-06 | 版本：v0.2 | GitHub: https://github.com/Toicar/Startrail-Ball

---

## 一、项目概述

基于 Three.js 的纯离线 3D 弹球闯关游戏 Demo，用于抖音互动空间（≤8MB ZIP）。玩家通过陀螺仪/触屏摇杆控制球体在星河管道中飞驰，收集金币、躲避障碍、触发 Buff，管道形态动态变化，难度渐进。

**对标感觉**：滚动的天空 × 超音速隧道 × 重力滚球

---

## 二、合规约束（抖音互动空间）

| 约束 | 要求 |
|------|------|
| 包体 | ZIP ≤ 8MB（当前 ~189KB） |
| 网络 | 纯离线，禁止任何网络请求 / CDN / 外部跳转 |
| 入口 | 根目录 `index.html`，所有资源相对路径 |
| 存储 | localStorage（最高分） |
| 屏幕 | 自适应移动屏幕，无横向滚动条 |
| 错误 | try-catch + 页面友好提示 |
| 合规 | 无违法违规 / IP 侵权 / 不利于未成年人内容 |

---

## 三、技术架构

```
index.html
├── js/lib/three.min.js    ← Three.js v0.160, ~656KB
├── js/config.js            ← CONFIG 全局常量 + getCurrentDifficulty()
├── js/input.js             ← window.Input — 车道输入（陀螺仪/触屏/键盘）
├── js/ball.js              ← window.Ball — 球体 + 光晕渲染
├── js/pipe.js              ← window.PipeSystem — 管道生成、滚动、星空着色器、光环
├── js/physics.js           ← window.Physics — 车道平滑移动 + 重力回中
├── js/world.js             ← window.World — 道具/障碍（45° 车道系统）
├── js/effects.js           ← window.Effects — 粒子尾迹、爆炸爆发
├── js/audio.js             ← window.AudioFX — Web Audio 程序化音效 BGM+SFX
├── js/hud.js               ← window.HUD — DOM UI（分数、血量❤️、速度条、Buff）
├── js/screens.js           ← window.Screens — 开始/死亡/暂停画面
├── js/main.js              ← 入口：场景、摄像机、游戏循环、碰撞响应
├── css/style.css           ← 全局样式 + 响应式 + Toast
├── shaders/starfield.vert  ← 星空顶点着色器
└── shaders/starfield.frag  ← 星空片段着色器（含网格线）
```

### 脚本加载顺序（不可改变，后续文件依赖前面的全局变量）

```
three.min.js → config.js → input.js → ball.js → pipe.js
→ physics.js → world.js → effects.js → audio.js → hud.js
→ screens.js → main.js
```

### 全局状态

```javascript
window.STATE = {
  phase: 'start'|'playing'|'paused'|'dead',
  score, combo, lastCoinTime, distance, speed, ballAngle,
  activeBuffs: { speedBoost, magnet, scoreDouble, slow },
  hasShield, checkpointDistance, elapsedTime, difficultyLevel,
  lives: 3, maxLives: 3, invincible, _cpPlaced, _pipeRotZ
};
```

### 游戏循环数据流

```
dt → Input.getTargetLane() → laneAngle
→ Physics.updateLane(laneAngle, pipeR, dt) → smoothAngle
→ Ball.setPosition(ballX, ballY, 0)
→ pipeRotZ lerp: _pipeRotZ += (-laneAngle - _pipeRotZ) * dt*5
→ PipeSystem.group/ringGroup/World.group.rotation.z = _pipeRotZ
→ PipeSystem.update(speed, dt) → World.populateSegment()
→ World.checkCollisions(ballX, ballY, 0) → handleCollision()
→ World.update(dt, speed) → 道具随管道移动
→ HUD.update(STATE)
```

---

## 四、已实现功能清单

### 摄像机与视角
- 后方看管道截面，球在管壁内侧
- 管道缓慢旋转跟随球的角度（lerp），使球在视觉中趋于正下方

### 控制输入（车道模式）
- **陀螺仪**：DeviceOrientation API，gamma 映射到 7 车道（-135° ~ +135°, 每 45° 一档）
- **触屏摇杆**：滑动切换车道，50px 阈值，0.25s 冷却，松手回中
- **键盘**：ArrowLeft/Right 切换车道，有冷却，松手回中
- 陀螺仪不可用时自动降级 + Toast 提示

### 管道系统
- CylinderGeometry 旋转到 Z 轴，BackSide 渲染（从内部看）
- 程序化星空着色器（ShaderMaterial）：星点 + 网格线 + 双色渐变
- 发光光环（TorusGeometry）在段首尾，随距离渐隐
- 线框覆盖层增强结构感
- 每段长度 12 单位，同时可见 8 段
- 动态形态：直道 / 弯道(左/右/上) / 窄口(65%) / 宽道(140%)

### 球体
- 半径 0.55，发光球体 + 光晕（半透明外层）
- 护盾激活 → 光晕变金色
- 受伤无敌 → 球变红色闪烁

### 道具系统（45° 车道）
- **7 条车道**：-135°, -90°, -45°, 0°, 45°, 90°, 135°
- **金币** 4 种布局（单车道线/弧线/双车道/空段），combo ×2/×3/×5
- **加速带** ⚡ 速度×1.5 + 无敌 2.5s
- **磁铁** 🧲 5s 内扩大拾取范围
- **护盾** 🛡️ 抵挡一次伤害
- **双倍得分** ✨ 8s 内分数×2
- **Bonus 门** 🚪 触发金币涌入

### 障碍系统
- **尖刺** 🛑 扣 1 命（70% 出现在球当前车道 ±2 范围内）
- **减速区** 🐌 速度降至 35%，2s
- **旋转障碍** 🔃 沿管壁旋转，扣 1 命

### 生命与死亡
- 3 条命 ❤️❤️❤️，受伤后 1.5s 无敌闪烁
- 护盾可吸收一次伤害
- 0 命 → 死亡画面（显示分数/最高分/距离/时间）
- 检查点 🏁 每 45×BASE_SPEED 距离一个

### 难度曲线
- 入门 (0-30s)：直道，无障碍，速度 1×
- 进阶 (30-90s)：弯道 + 尖刺，速度 1.3×
- 挑战 (90-180s)：窄口 + 旋转障碍，速度 1.6×
- 极限 (180s+)：密集组合，速度 2×
- **渐进加速**：基础速度 6 + 每秒 +0.8，上限 22

### 视觉特效
- 球尾迹粒子（AdditiveBlending 发光拖尾）
- 收集/碰撞爆发粒子
- 金币自旋 + 道具悬浮动画

### UI/HUD
- 开始画面（标题 + 最高分 + 操作提示）
- 游戏 HUD（分数、血量❤️🖤、速度条、Buff 图标+倒计时、Combo 提示）
- 暂停画面（继续/重新开始）
- 死亡画面（分数/记录/再来一次）
- Toast 通知（陀螺仪不可用提示）

### 音频
- Web Audio API 程序化合成
- BGM：低频脉冲音，频率随速度变化
- SFX：金币收集(双音阶)、道具获得(三音阶上升)、碰撞(低频噪音)、检查点(三音阶)

### 适配与合规
- 竖屏/横屏自动切换布局
- 刘海屏 safe-area-inset
- WebGL 兼容检测
- 后台自动暂停 (visibilitychange)
- 全局错误捕获 + 友好提示
- localStorage 安全读写

---

## 五、已知问题与待改进

### 🔴 待修复
1. **球移动手感需调优**：车道切换冷却 0.25s 可能偏快/偏慢，触屏阈值 50px 需实测调整
2. **道具判定仍需验证**：改用 `getWorldPosition()` 后的碰撞判定在极限角度下是否正确
3. **iOS 陀螺仪权限**：iOS 13+ 需用户点击触发 `requestPermission()`，当前实现在首次点击时请求，需验证抖音 WebView 兼容性
4. **死亡后重开**：`World.group.rotation.z` 残留值可能在重开时未完全重置

### 🟡 待优化
5. **管道弯道过渡不平滑**：段间曲率是离散跳变，无插值
6. **金币布局偏少**：前期空段过多可能导致玩家缺乏反馈感
7. **音效 BGM 在桌面端可能不播放**：AudioContext 需要用户手势激活
8. **粒子性能**：低端机 60fps 可能不稳，需加 LOD
9. **线上体验需起服务**：file:// 协议下陀螺仪 API 不可用

### 🟢 计划新增
10. **管道分叉**：二选一分支，不同奖励/风险
11. **重力翻转道具**：短暂颠倒重力方向
12. **黑暗区域**：视野缩小考验记忆
13. **难度曲线可视化**：阶段切换时有视觉/文字提示
14. **排行榜**：localStorage 存储 Top 5

---

## 六、关键 Bug 修复记录

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 管道不可见 | `CylinderGeometry` 沿 Y 轴 | `rotation.x = -PI/2` 旋转到 Z 轴 |
| 2 | 道具不出现 | `startGame` 中 `World.reset()` 在 `PipeSystem.init()` 之后调用 | 调换顺序 |
| 3 | 道具不随管道移动 | `World.update()` 未更新道具 Z 坐标 | `item.z -= speed*dt` |
| 4 | 碰撞判定异常 | `checkCollisions` 用局部坐标比对世界坐标 | `getWorldPosition()` |
| 5 | 开局报错死亡 | 变量重命名后 `ballPos` 未更新为 `ballX`/`ballY` | 变量名修正 + try-catch |
| 6 | 键盘方向反转 | ArrowLeft→return -1 与用户预期相反 | 交换返回值 |
| 7 | 管道不滚动 | `World` 未在 `PipeSystem.init()` 前初始化 | 调整启动顺序 |

---

## 七、文件大小

| 文件 | 大小 |
|------|------|
| `js/lib/three.min.js` | ~656KB |
| 所有游戏 JS 文件 | ~56KB |
| CSS + HTML + Shaders | ~10KB |
| **ZIP 包总计** | **~189KB**（远低于 8MB 限制） |

---

## 八、本地开发

```bash
# 克隆
git clone https://github.com/Toicar/Startrail-Ball.git

# 启动（必须用 HTTP 服务，陀螺仪 API 不支持 file://）
cd Startrail-Ball
python -m http.server 8080

# 访问
http://localhost:8080

# 桌面端用键盘 ← → 控制
# 移动端访问内网 IP:8080（需关防火墙或放行端口）
```

## 九、参考材料

- 竞品参考：滚动的天空 (Rolling Sky)、Boost 2、超音速隧道类游戏
- bilibili 参考视频：`link.txt`
- 参考效果图：`ref1.png`, `ref2.png`
- 比赛指南：`广州站 选手指南.md`
