# 02 · Wool network 羊毛算法区域路网

- **输入**：一个区域（`childInput`），`context.parentRoads` = 区域连接道路
- **输出**：level `wool`；`roads` = `primary` / `branch`，`children` = 可进入 Tensor 的局部区域
- **现状 P0**：占位算法（放射主路 + 内环 + 继承区域连接）
- **P3 迁入**：`parcel_wool_solver.js`、`global_warped_weave.js`、`parcel_road_skeleton.js`、`parcel_road_constraints.js` 原样放入 `legacy/`，适配为“区域边界 + 吸引点 + 障碍物 + 连接节点”输入
