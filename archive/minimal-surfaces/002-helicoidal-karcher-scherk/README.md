# 002 · Helicoidal Karcher–Scherk

- **分类**：B · 单周期 → 螺旋面端
- **用途标签**：屋面 · 结构 · 可打印（暂定）
- **来源**：H. Karcher, *Embedded Minimal Surfaces Derived from Scherk's Examples*, manuscripta math. 62 (1988)；
  M. Weber，Minimal Surface Repository → Singly Periodic → Helicoidal Ends → Helicoidal Karcher-Scherk Surfaces
  （minimalsurfaces.blog/home/repository/singly-periodic/helicoidal-karcher-scherk-surfaces/）
- **参考图**：`reference/原图-16端.png`、`reference/原图-4端.png`（你发来的截图）
- **原始文件**：`source/Helicoidal Karcher-Scherk.nb`、`source/Helicoidal Karcher-Scherk.cdf`、`source/povray/`（原作 POV-Ray 场景、网格和渲染图，按参数分文件夹）

## 构造

把完全对称的 Scherk 鞍塔变形成在螺旋运动下不变的曲面：每升高一个周期，整个曲面绕竖轴转 2πa。
平直的翼因此变成螺旋面形状的端。2k 个翼，k ≥ 2。

## Weierstrass 数据（取自 notebook，上半平面参数 w）

```
phi1(w) =  ½ R² (R² − w)^(a−1) · w^(1−1/k) · (1 + R² w)^(−1−a)      （= G·dh）
phi2(w) = −½ R² (R² − w)^(−1−a) · w^(−1+1/k) · (1 + R² w)^(−1+a)    （= dh/G）
dh(w)   = (i/2) / ( w (1/R² − R² − 1/w + w) )
X(w)    = Re ∫ from i to w of ( −(phi1 − phi2)/2,  i(phi1 + phi2)/2,  dh ) − X(0)
```

- **周期条件**（求 R）：
  `pphi2(R)/sin(aπ + π/k) · (sin aπ − sin π/k) + pphi1(R) = 0`
  - pphi1 = ½ R^(4+2a−2/k) Γ(a) Γ(2−1/k) · ₂F̃₁(1+a, 2−1/k; 2+a−1/k; −R⁴)
  - pphi2 = ½ R^(−2(a+1/k)) Γ(a) Γ(1/k) · ₂F̃₁(1+a, 1/k; a+1/k; −1/R⁴)
  - app 里把 ₂F̃₁ 改写成 Euler 积分计算（Γ 项正好约掉），二分法求根
- **平移周期**：trans = π R² / (1 + R⁴)
- **参数域**：s = x + iy，x ∈ [−xmax, xmax]（在 ±v1 = ∓log R² 处加密），y ∈ (0, π)；w = (eˢ + R²)/(1 − R² eˢ)
- **拼接**：曲面片 ∪ 绕 x 轴转 180° 的副本（翻转朝向）→ 对 i = 1..k、周期 j：绕 z 轴转 **−2aπj − 2πi/k** 并上移 j·trans
  - 旋转方向按 CDF 中全部 18 片网格反推确认（notebook 里写的是 +2aπj，但存下的网格对应 −2aπj）
  - 只有绕 x 轴转过去的那一片要翻转朝向，这样整张曲面正反面连贯（已按共享边逐一检查）

## 原作渲染的参数（POV-Ray 场景 + 网格反推）

全部为 3 个周期；翼长 xmax 由原作网格拟合得到（与原作网格逐点误差 0.0001）。

| 预设 | k（端数 2k） | a | 翼长 xmax | R（求得） | 配色 |
|---|---|---|---|---|---|
| 16 端 · 原图 | 8 | 0.05 | 5 | 0.818123 | 金 / 淡紫，暗色线 |
| 4 端 · 原图 | 2 | 0.10 | 6.3 | 0.931827 | 青 / 深红，金色线 |
| 4 端 a.4 | 2 | 0.40 | 6.3 | 0.656761 | 青 / 深红 |
| 6 端 a.05 / a.1 / a.2 / a.3 | 3 | 0.05 / 0.10 / 0.20 / 0.30 | 6.3 | 0.9396 / 0.8797 / 0.7465 / 0.5219 | 青 / 深红 |
| 8 端 a.05 / a.2 | 4 | 0.05 / 0.20 | 6.3 | 0.9148 / 0.6082 | 青 / 深红 |
| 10 端 a.05 | 5 | 0.05 | 6.3 | 0.8905 | 青 / 深红 |
| 16 端 a.11 | 8 | 0.11 | 5 | 0.5163 | 金 / 淡紫 |

### 原作相机

- POV 场景：物体 `rotate <0,0,20>` 再 `rotate <60,0,0>`，相机 `location <0,0,-4>`、`angle 40`、`look_at 0`；网格先归一化到 |坐标| ≤ 1，再乘 scal（1.0 或 1.1）
- POV-Ray 是左手坐标系，所以原作渲染图是曲面的**镜像**（螺旋方向相反）。app 里"镜像 · 同原图"默认打开以对齐原图；关掉看真实螺旋方向。导出的 STL 始终是真实方向
- 换算到右手坐标系：物体乘 X = F·M·Aᵀ（F = diag(1,1,−1)，M = Rx(−60°)·Rz(−20°)，A 为数学坐标 → 三维视图坐标），相机放在正前方 4L/scal 处

a 的范围是 0 < a < 1/k；两端的极限情况在原 notebook 中也不能正常计算。

## 验证

- 周期条件：k = 8, a = 0.05 求得 R = 0.8181229237，notebook 结果为 0.8181229241
- 网格：按 CDF 的网格（k = 3, a = 0.05）逐点比较，最大误差 0.0001
- POV 网格（k = 2, a = 0.1, 翼长 6.3, 3 个周期）逐点比较，最大误差 0.0001；按原作相机渲染，颜色和轮廓与原作渲染图吻合 99%
- 积分路径与原作相同：每个点沿直线从 w = i 积分（app 用双指数求积处理端点奇异）
