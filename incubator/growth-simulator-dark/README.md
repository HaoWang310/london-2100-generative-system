# Growth Simulator, dark · 城市生长模拟（深色）

Loop City's city growth from 2025 to 2100 over the whole 412 km loop, on 50 m parcels. It opens in 2025, at the start of the release run (seed 42). Press Play to watch it grow year by year to the final outcome: 12,222,179 people in 2100, with 837.8 km² of new fabric and 1,909.5 km² farmed. `#year=2100` in the link opens on the final year.

"Variation" changes the rules with sliders and grows the city again to the same targets. The sliders cover the three station magnets, the two noise fields (FIELD and VEIN), the density rings and the farming. The result is compared with the final outcome.

Loop City 的城市生长，2025–2100 年，覆盖整条 412 公里环线，50 米地块。打开时显示 2025 年，即发布版本（种子 42）的起点。点击播放可逐年观看它生长到最终结果：2100 年 12,222,179 人，新建城区 837.8 平方公里，农业用地 1,909.5 平方公里。链接末尾加 `#year=2100` 可直接打开最终年份。“变体”模式可用滑块改变规则（三个车站吸引点、FIELD 与 VEIN 两种噪声场、密度环、农业），并以相同目标重新生长，与最终结果对比。

- Open the page through a web server (GitHub Pages, or `python3 -m http.server` in this folder). The data now sits in `data/` and is fetched, so opening `index.html` straight from the disk will not work. · 请通过网页服务器打开（GitHub Pages，或在本文件夹运行 `python3 -m http.server`）。数据已拆到 `data/` 文件夹按需载入，直接双击 `index.html` 无法打开。
- First load is about 6.5 MB (was 37 MB): the final outcome, the base layers and the font. The variation ground (21 MB) is fetched quietly after the map is on screen, or when you press Run variation. · 首次加载约 6.5 MB（原为 37 MB），只含最终结果、底图与字体；变体所需数据（21 MB）在地图显示后于后台载入，或在点击“运行变体”时载入。
- English | 中文 switch at the top. · 顶部可切换中英文。
