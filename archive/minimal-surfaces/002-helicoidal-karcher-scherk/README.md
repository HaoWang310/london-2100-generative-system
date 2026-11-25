# 002 · Helicoidal Karcher–Scherk

- **分类**：B · 单周期 → 螺旋面端
- **用途标签**：屋面 · 结构 · 可打印（暂定）
- **来源**：H. Karcher, *Embedded Minimal Surfaces Derived from Scherk's Examples*, manuscripta math. 62 (1988)；
  M. Weber，Minimal Surface Repository → Singly Periodic → Helicoidal Ends → Helicoidal Karcher-Scherk Surfaces
  （minimalsurfaces.blog/home/repository/singly-periodic/helicoidal-karcher-scherk-surfaces/）
- **原始文件**：`source/Helicoidal Karcher-Scherk.nb`、`source/Helicoidal Karcher-Scherk.cdf`

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
- **拼接**：曲面片 ∪ 绕 x 轴转 180° 的副本 → 对 i = 1..k、周期 j：绕 z 轴转 2aπj − 2πi/k 并上移 j·trans
  （i + j 为奇数时翻转朝向，保证正反面配色连贯）

## notebook / CDF 中的参数组合

| 名称 | k（端数 2k） | a | R（求得） |
|---|---|---|---|
| 原图（16 端） | 8 | 0.05 | 0.818123 |
| 4 端 · 微扭 | 2 | 0.10 | 0.931827 |
| 4 端 · 强扭 | 2 | 0.40 | 0.656761 |
| 6 端 | 3 | 0.10 | 0.879670 |
| 6 端 · 强扭 | 3 | 0.30 | 0.521859 |
| 8 端 | 4 | 0.20 | 0.608242 |
| 10 端 | 5 | 0.05 | 0.890515 |

a 的范围是 0 < a < 1/k；两端的极限情况在原 notebook 中也不能正常计算。

## 验证

- 周期条件：k = 8, a = 0.05 求得 R = 0.8181229237，notebook 结果为 0.8181229241
- 网格：按 CDF 的网格（k = 3, a = 0.05）逐点比较，最大误差 0.0001
- 积分路径与原作相同：每个点沿直线从 w = i 积分（app 用双指数求积处理端点奇异）
