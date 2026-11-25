# 003 · Schoen T'–R'

- **分类**：D · 三周期 → 六方棱柱晶胞
- **用途标签**：结构 · 可打印（暂定）
- **来源**：A. Schoen 的混合三周期极小曲面；K. Brakke 用 Surface Evolver 复现，
  页面 kenbrakke.com/evolver/examples/periodic/hybrids.html（Schoen's Hybrid Triply Periodic Minimal Surfaces，第 6 号 T'-R'，亏格 6）
- **参考图**：`reference/原图.png`（你发来的截图）
- **原始文件**：`source/TRadj.fe`（Brakke 的 Surface Evolver 脚本）
- **复现代码**：`solver/tr.py`（Plateau 问题 + 伴随曲面）、`solver/asm.py`（平移与镜像拼接）

## 形态

六方棱柱晶胞里一个中心体，向六个侧面各伸出一条隧道；隧道在晶胞侧面处上下接通，连到相邻晶胞。
原作把曲面背面设成黄色（`setcolor`），正面浅灰，黑线是曲面片的边界（镜面线）。

## 计算方法（没有解析公式）

与 001、002 不同，这个曲面没有 Weierstrass 公式，原作用 Surface Evolver 数值求解：

1. **Plateau 问题**：五条直线边围成的空间五边形
   (0,0,0) → (−½,0,0) → (−½,0,1) → (0,−√3/2,1) → (0,0,1) → 回到起点，求面积最小的曲面
2. **伴随（共轭）曲面**：直线边界变成平面曲线，分别落在 x = rhs1、z = rhs2、½x − (√3/2)y = rhs3、y = rhs4、z = rhs5 五个平面上
3. **平移**：按脚本 `adj` 的步骤平移，使 z = 0、y = 0、斜面过原点
4. **拼接**：镜面 a（z = 0）、b（y = 0）、c（30° 斜面）按 `abcbcbc` 生成 24 片 = 1 个晶胞；
   加 e（x = rhs1）按 `abcbcbcecbcbc` 生成 168 片 = 7 个晶胞；d（z = rhs5）用于竖向叠层

## 复现说明

这边没有 Surface Evolver，用 Python 按同样的步骤实现：
- 五边形先扇形三角化，再细分 4–5 次（与 Evolver 读入非三角面、`r` 细分一致）
- 面积最小化用 Pinkall–Polthier 迭代（每步解余切拉普拉斯方程，边界固定）
- 伴随曲面：对每个坐标解 L·u* = Σ (u_k − u_j)/2（离散的共轭调和函数）

## 验证

- 面积收敛到 0.6687（细分 5 次），继续迭代变化小于 10⁻⁵
- 伴随曲面的五段边界都落在脚本约束的平面上，偏差 ≤ 4×10⁻⁴
- 求得 rhs1 = 1.672（六边形边心距），rhs5 = 0.500（半个晶胞高）
- 没有原作网格可以逐点比对（不同于 001、002），形态与原图和原网页描述一致
