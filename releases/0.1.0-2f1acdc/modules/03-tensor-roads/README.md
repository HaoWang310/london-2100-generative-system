# 03 · Tensor roads 张量场局部道路

- **输入**：一个局部区域，`context.parentRoads` = Wool 主路（作为约束）
- **输出**：level `tensor`；`roads` = `secondary` / `local`，端点吸附到上级主路
- **现状 P0**：占位算法（网格 / 环形放射流线 + 吸附）
- **P4 迁入**：`hydro_tensor_field.js`、`hydro_tensor_geometry.js`、`hydro_vector_field.js`、`hydro_tensor_grid.js` 等原样放入 `legacy/`，以 Wool 道路、地形、水系为约束计算张量场并积分流线
