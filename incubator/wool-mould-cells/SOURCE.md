# 来源 · Source

**Wool on the mould cells v7** (`Wool on the mould cells v7.html`), 2026-11-14. The file is unchanged here, renamed `index.html`. New versions replace it in place.

It is built from:
- the station cells of the Loop City slime mould, final model, seed 42, with the cell edges on the vein centrelines;
- roads, towns and buildings from OS Open Zoomstack (OGL v3);
- soil from the Agricultural Land Classification (Natural England);
- the Loop City railway.

The wool relaxation is the project's wool thread solver, run live in the page, one worker per primary cell. The road hierarchy follows the team's rules (v6–v7):
- the cell edge is M;
- every existing road has a corridor that new roads stay out of;
- A roads go where land is out of reach, never side by side;
- B roads are whole continuous roads, busiest and longest first;
- every loose end is joined;
- the roads are drawn at their real widths, with filleted junctions.

**黏菌单元上的毛线 v7**，2026-11-14，原文件未改动，仅更名为 `index.html`；新版本将在原址替换。

数据来源：
- Loop City 黏菌最终模型（种子 42）的车站单元，单元边界位于菌脉中心线上；
- 道路、城镇与建筑：OS Open Zoomstack（OGL v3）；
- 土壤：农业用地分级（Natural England）；
- Loop City 铁路。

毛线松弛采用项目的毛线求解器，在页面中实时运行，每个一级单元一个线程。道路等级遵循团队规则（v6–v7）：
- 单元边界为 M；
- 每条现有道路设有走廊，新道路不进入；
- A 级道路加在覆盖不到的土地处，且彼此不平行；
- B 级为整条连续道路，最繁忙、最长者优先；
- 每个断头都连接；
- 道路按真实宽度绘制，交叉口倒角。
