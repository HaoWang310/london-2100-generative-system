# 01 · Region planning 大区域划分

- **输入**：level `london` 的研究范围
- **输出**：level `region`；`children` = 规划区域（边界 + 中心），`roads` = 区域连接（`region-link`），`nodes/edges` = 连接图
- **现状 P0**：占位算法（旋转网格裁剪）
- **P2**：按年均降雨、地形、汇水、洪涝风险、空间连接度加权划分；只替换 `partition()`，输出格式不变
