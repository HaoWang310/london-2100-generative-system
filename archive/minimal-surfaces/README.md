# 极小曲面目录 · Minimal Surface Catalogue

> **仅作存储。** 这个文件夹不在 `incubator/catalogue.json` 里，也不在 `tools/build-site.mjs` 的部署列表里，
> 所以不会出现在 London 2100 app 的目录中，也不会发布到网站，不影响任何现有功能。

## 分类方式

- **一级：周期性**
  - A · 非周期（有限全曲率，不重复）
  - B · 单周期（沿一个方向重复）
  - C · 双周期（沿一个平面重复）
  - D · 三周期 TPMS（沿空间三个方向重复）
- **二级：端的类型**（与原作者 M. Weber 的单周期分类一致）：环状端（鞍塔翼）、螺旋面端、平面端、悬链面端、周期 Enneper 端、混合端
- **建筑用途标签**：屋面 · 立面 · 结构 · 景观 · 可打印（方便从设计角度筛选，不改变数学分类）

## 文字清单

| 编号 | 名称 | 分类 | 端的类型 | 生成方法 | 来源 | 用途标签 | 收录日期 |
|---|---|---|---|---|---|---|---|
| 001 | Scherk–Enneper（带周期 Enneper 端的 Scherk 鞍塔） | B · 单周期 | 周期 Enneper 端 | Weierstrass 数值积分 | M. Weber · Minimal Surface Repository（Mathematica notebook） | 立面 · 结构 · 可打印 | 2026-11-25 |
| 002 | Helicoidal Karcher–Scherk（螺旋运动不变的 Karcher–Scherk 鞍塔） | B · 单周期 | 螺旋面端 | Weierstrass 数值积分 + 周期条件求解 | H. Karcher 1988 · M. Weber（Mathematica notebook） | 屋面 · 结构 · 可打印 | 2026-11-25 |

## 文件结构

```
archive/minimal-surfaces/
├── README.md              本文件：分类方式 + 文字清单
├── index.html             目录 app（卡片 / 清单视图，点开即三维预览、调参、导出 STL）
├── 001-scherk-enneper/
│   ├── README.md          公式、参数、验证记录
│   ├── preview.jpg        预览图
│   └── source/            原作者文件（.nb / .cdf）
└── 002-helicoidal-karcher-scherk/
    └── …                  同上
```

本地预览：直接用浏览器打开 `index.html`（需要联网加载 three.js）。

## 收录一个新曲面

1. 新建 `NNN-名称/` 文件夹，放入原图、来源文件和 `README.md`（公式、参数、来源）
2. 在上面的文字清单里加一行
3. 在 `index.html` 的 `SURFACES` 列表里加一条（有公式的再加三维生成器）
