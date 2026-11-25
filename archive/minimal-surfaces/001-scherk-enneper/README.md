# 001 · Scherk–Enneper

- **分类**：B · 单周期 → 周期 Enneper 端
- **用途标签**：立面 · 结构 · 可打印（暂定）
- **来源**：Matthias Weber，Minimal Surface Repository → Singly Periodic → Scherk-Enneper
  （minimalsurfaces.blog/home/repository/singly-periodic/scherk-enneper/）
- **参考图**：`reference/原图-1.png`、`reference/原图-2.png`、`reference/名称.png`、`reference/原图-3.png`（你发来的截图；原图-3 对应预设「6 端 · 长翼」：k = 3, a = 0.99, rmax = 4.5，侧视）
- **原始文件**：`source/Enneper-Scherk.nb`（Mathematica 10.3）、`source/Enneper-Scherk.cdf`（Mathematica 11.2）

## 构造

把平移不变的 Karcher–Scherk 鞍塔的环状端（平直的翼）换成周期性的 Enneper 端：翼的外端随高度来回摆动，越往外摆得越大。

## Weierstrass 数据（取自 notebook）

```
G(z)  = c · z^(k-1) (z^(2k) − a^(2k)) / (z^(2k) − a^(−2k)),   c = (1 − a^(−2k)) / (1 − a^(2k))
dh(z) = i · z^(k-1) (z^(2k) − a^(2k)) (z^(2k) − a^(−2k)) / (z^(2k) − 1)^3
X(w)  = Re ∫ from e^(iπ/(2k)) to w of ( (1/G − G)/2 · dh,  i(1/G + G)/2 · dh,  dh )
```

- 端在单位根 z^(2k) = 1 处；0 和 ∞ 是法向竖直的高阶点；单位圆位于水平对称面上
- 参数域（楔形）：z = (1 + 2/(−1 + i·e^(u+iv)))^(1/k)，u ∈ [0, rmax]，v ∈ [π/2, π]
- 拼接：绕 y 轴转 180° → 以法向 (cos π/2k, sin π/2k, 0) 的竖直面镜像 → 绕 z 轴旋转 k 份 → 以 z = 端边所在高度的水平面镜像 → 竖向平移（周期 = 4|δ₀z|）

## notebook 中的参数组合

| 名称 | k（端数 2k） | a | rmax |
|---|---|---|---|
| 原图（6 端） | 3 | 0.70 | 1.2 |
| 6 端 · 长翼 | 3 | 0.99 | 4.5 |
| 4 端 | 2 | 0.995 | 4.5 |
| 2 端 | 1 | 0.995 | 6.7 |
| 车轮 | 8 | 0.999 | 5.5 |

## 验证

app 用同一套公式做数值积分（3 点 Gauss–Legendre，沿参数线），与 CDF 中原作者存下的网格
（k = 3, a = 0.99, rmax = 4.5）逐点比较，最大误差约 0.001。
