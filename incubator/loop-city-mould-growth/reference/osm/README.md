# OpenStreetMap 数据 · OpenStreetMap extract

本应用的生成脚本（`tools/build-intro.py`、`tools/build-radials-reference.py`、`tools/realign-radials.py`）读取的数据，存在本应用自己的文件夹里，不依赖别的应用。页面运行时不读这些文件。

The data this app's build scripts read, kept in the app's own folder so that it depends on no other app. The page itself does not read them.

| 文件 · File | 内容 · What | 来源 · Source |
|---|---|---|
| `stations.geojson` | 车站，1,188 个，覆盖 143 km 方框（70 km 圈外也有）· stations in the 143 km frame | © OpenStreetMap contributors (ODbL)，2026-11-21 |
| `rail.geojson` | 按服务分类的铁路，未裁剪 · rail by service, uncut | © OpenStreetMap contributors (ODbL)，2026-11-21 |
| `highspeed.geojson` | HS1、HS2 全线 · HS1 and HS2, whole | HS1：OpenStreetMap (ODbL)；HS2：HS2 Ltd `HS2_Route_Detailed`，Open Government Licence |
