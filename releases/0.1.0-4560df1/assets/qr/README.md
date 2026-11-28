# 二维码 · QR code

扫码打开首页 · Opens the home page: <https://haowang310.github.io/london-2100-generative-system/>

| 文件 | 用途 |
|---|---|
| `london-2100-qr-card.png` / `.svg` | 黑底卡片：LONDON 2100、多尺度城市生成系统、网址（PNG 2400 × 3050） |
| `london-2100-qr.png` / `.svg` | 只有二维码，四周留标准白边，方便放进其他排版（PNG 2400 × 2400） |

静态二维码：网址直接编码在图里，不经过第三方，不会过期；修改 app 内容不需要重做。只有网址本身变了（仓库改名、转移、GitHub 用户名改了、关闭 Pages）才需要用 `tools/make-qr.py` 重新生成。纠错等级 Q；印刷时边长不小于 2.5 cm。

A static code: the address is in the picture itself, so it never expires and the app can change freely. Regenerate with `python3 tools/make-qr.py` only if the address changes.
