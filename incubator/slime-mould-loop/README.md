# Slime mould · station cells, the whole loop · 黏菌模拟 · 整条环线车站单元

The final slime mould model of Loop City over the whole loop: the same model, look and controls as `incubator/slime-mould-quadrant`, run over the whole site. All 17 stations are seeds, with 6,000 agents each. The trails thicken into veins along the orbital corridor and close into cells around the stations. The run pauses at step 900. **Find the cells** outlines them (about 89, with all 17 stations inside a cell). **Save the cells** writes GeoJSON or DXF in British National Grid metres.

Loop City 最终版黏菌模型，覆盖整条环线：与 `incubator/slime-mould-quadrant` 相同的模型、外观与控件，作用于整个场地。全部 17 个车站作为起点（每站 6,000 个智能体），轨迹沿环线走廊加粗成脉络，并在车站周围围合成单元。模拟在第 900 步暂停；“识别单元”勾勒出约 89 个单元（17 个车站全部位于单元内），“保存单元”导出 GeoJSON 或 DXF（英国国家网格坐标，米）。

- Open `index.html`. It is one file (5.3 MB) with no server and no outside files. · 打开 `index.html` 即可，单个文件（5.3 MB），无需服务器。
- English | 中文 switch at the top right of the map. · 地图右上角可切换中英文。
- A grid of 1944 × 1458 cells of 92.6 m. It reaches step 900 in about 1.5–2 minutes on a laptop. · 1944 × 1458 网格，每格 92.6 米；笔记本电脑上约 1.5–2 分钟到达第 900 步。
