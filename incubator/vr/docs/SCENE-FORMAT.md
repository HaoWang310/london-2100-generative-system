# 场景文件格式 · Scene format（v1）

`incubator/vr` 和生成系统（Tensor Studio 等）**只通过这个文件交流**。生成系统负责导出，VR 负责读取，两边谁改内部代码都不会影响对方。只要格式不变，可以同时开发。

```jsonc
{
  "format": "london-2100-vr/scene",   // 必填，固定值
  "version": 1,                        // 必填；不兼容的改动才加 1
  "source": "Tensor Studio v8.6 · station P2 example · …",   // 自由文字，显示在标题里（第二段）
  "crs": "EPSG:27700",                 // 英国国家网格
  "origin": [517181.19, 236904.54],    // 本地坐标 (0,0) 对应的国家网格坐标，米

  "grid": { "nx": 269, "ny": 264, "cell": 10 },   // 栅格：第 r 行第 c 列在本地 (c·cell, r·cell)，第 0 行在最南
  "Z":     [ … nx·ny 个数 ],   // 高程，米（可为 null）
  "land":  [ … nx·ny 个 0/1 ], // 1 = 场地内的陆地（可为 null）
  "flood": [ … nx·ny 个 0–4 ], // EA 洪水风险：0 无 · 1 很低 · 2 低 · 3 中 · 4 高（可为 null）

  "streets": [                 // 生成的道路
    { "level": 1, "pts": [[x, y], …], "w": [宽度米, …] }   // level 1 主路 · 2 次路；w 每个点一个，或一个数，或省略
  ],
  "fixed":   [ [[x, y], …], … ],   // 现有街道（折线，可为空）
  "bridges": [ [[x, y], …], … ]    // 桥（折线，可为空）
}
```

坐标都是**本地米制**：`国家网格 = origin + [x, y]`，x 向东，y 向北。

## 以后可以加的（加字段不加版本号）

| 字段 | 内容 |
|---|---|
| `buildings` | `[{ ring: [[x,y]…], h: 高度米 }]`，现有或生成的体块 |
| `blocks` | 道路围合出的地块 |
| `water` | 河道与水面 |
| `views` | 预设视点，比如 `{ name, at: [x,y], yaw }`，用于 1:1 漫游的起点 |
| `meta` | 指标（道路长度、洪水区占比等），在头显里的说明卡上显示 |

## 导出

- 现在：在 `incubator/vr` 里运行 `node tools/export-from-tensor-studio.mjs`，在无界面浏览器里打开 Tensor Studio、立即生成、导出。
- 以后：在 Tensor Studio 里加一个「导出 VR 场景」按钮（读 `streetWidths()`、`D.env.Z`、`D.landMask`、`D.flood.grid`），生成系统那边开发完再加。
