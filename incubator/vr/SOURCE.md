# 来源 · Source

2026-11-13 新建，专门用于 London 2100 的 VR / MR 设计（Meta Quest 3S）。
`src/xr_view.js` 是从零写的 WebXR + WebGL2 查看器，不依赖外部库。
`data/station-p2.scene.json` 是用 `tools/export-from-tensor-studio.mjs`，从 Tensor Studio v8.6 车站 P2 示例「立即生成」的结果导出的。
`assets/zaha-bench.glb`（v0.21，展厅里的长凳）：用户从 SketchUp 3D Warehouse 下载的 "Bench by Zaha Hadid" 模型（https://3dwarehouse.sketchup.com/model/e56f4fa0-0737-49ae-a287-7a16e0490c43/Bench-by-Zaha-Hadid ），导出为 .dae 后转换：英寸换算成米、Z 轴朝上改成 Y 轴朝上、按 35° 折角重算法线。使用前请确认该模型在 3D Warehouse 上的授权条款。
