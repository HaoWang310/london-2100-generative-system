# 04 · Road integration 路网整合

- **输入**：当前区域的 Wool 道路 + 其下所有 Tensor 道路（由 App 汇总）
- **输出**：level `integration`；端点合并、断头路修复、拓扑节点/边、检查报告
- **现状 P0**：可用的端点吸附、修复、交叉计数（非占位）
- **P5**：在交叉处拆分道路、道路层级整合、街区（地块）提取；可参考 google-map-live 的 `parcel_road_topology.js`
