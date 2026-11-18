# 素材来源 · Credits

## 开场视频 · Opening footage

全部来自 [Mixkit](https://mixkit.co)，授权为 **Mixkit Stock Video Free License**（个人与商业用途均可，无需署名）。
从每段剪出约 8 秒的循环片段，压缩后放在本仓库的 `assets/intro/`（去掉声音、边下边播）：
`<名字>.mp4` 是 1280 px 宽（每段约 1.5–2.3 MB），`<名字>-480.mp4` 是 854 px 宽，给手机和慢速网络用（每段约 0.7–1 MB），`<名字>.webp` 是封面小图。
原始片段合计约 18.6 MB，现在电脑上合计约 5.6 MB，手机上约 2.4 MB。我们的文件加载失败时，才改用 Mixkit 上的原文件。配置位于 `app/intro.js` 的 `INTRO_PANELS`。

| 画面 | 片段 | 链接 |
|---|---|---|
| 伦敦 2100 | Buildings in the City of London | https://mixkit.co/free-stock-video/buildings-in-the-city-of-london-4265/ |
| 住宅 | Buildings under construction, aerial view | https://mixkit.co/free-stock-video/buildings-under-construction-aerial-view-4010/ |
| 农业 | Top aerial view of a lot of greenhouses | https://mixkit.co/free-stock-video/top-aerial-view-of-a-lot-of-greenhouses-824/ |

**换成自己的视频**：替换 `assets/intro/` 里同名的三个文件（`.mp4`、`-480.mp4`、`.webp`）即可。
建议：横向，8–15 秒循环，H.264，加 `-movflags +faststart`，1280 px 版每段 2–3 MB 以内，以保证首屏加载速度。

注意：Mixkit 上部分片段使用 “Mixkit Restricted License”（仅限个人使用），公开发布的网页不应使用这类片段。

## 地图 · Map

© OpenStreetMap contributors · OpenFreeMap
