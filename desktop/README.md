# London 2100 桌面版（联网版）

一个 Electron 窗口，打开的就是线上网站
<https://haowang310.github.io/london-2100-generative-system/>。
app 本身的代码不打包在这里，所以每次合并到 main 的更新，桌面版打开时就是最新的。
OSM 地图本来就要联网，所以桌面版也需要网络；没网时会显示一个“需要网络连接 · 重试”页面。

这个文件夹只放外壳，不改动主程序和 incubator。

## 下载

GitHub → **Actions → Desktop app** → 点最新一次成功的运行 → 页面底部 **Artifacts**：

- `London-2100-Windows`：`London-2100-Setup-x.y.z.exe`（安装版）和 `London-2100-Portable-x.y.z.exe`（免安装，双击就能运行）
- `London-2100-Mac`：`…-arm64.dmg`（M 系列芯片）和 `…-x64.dmg`（Intel）

想重新打包：**Actions → Desktop app → Run workflow**。改动 `desktop/` 合并到 main 时也会自动打包。

## 第一次打开

没有付费签名证书，系统会提示一次：

- **Windows**：“Windows 已保护你的电脑” → **更多信息 → 仍要运行**
- **Mac**：先双击一次（会被拦下）→ **系统设置 → 隐私与安全性** → 最下面点 **仍要打开**

## 快捷键

| | Mac | Windows |
|---|---|---|
| 回到主页 | ⇧⌘H | Ctrl+Shift+H |
| 后退 / 前进 | ⌘[ / ⌘] | Alt+← / Alt+→ |
| 刷新 | ⌘R | Ctrl+R |
| 全屏 | ⌃⌘F | F11 |
| 在浏览器中打开当前页 | ⇧⌘O | Ctrl+Shift+O |
| 开发者工具 | ⌥⌘I | Ctrl+Shift+I |

Windows 上菜单栏默认隐藏，按 Alt 显示。

## 行为

- 只有本网站（`/london-2100-generative-system/` 下）的页面在 app 里打开；OSM 版权、数据来源等外部链接用系统浏览器打开。
- app 内部用 `window.open` 打开的页面（例如 Tensor Studio → Structure Studio）会开成新的 app 窗口，`window.opener` 照常可用。
- 开场影片自动播放，不需要先点一下。

## 本地运行（可选）

```bash
cd desktop
npm install
npm start          # 打开窗口
npm run dist:mac   # 在 Mac 上打 .dmg
```

Windows 的 .exe 用 Actions 云端打包即可，不需要 Windows 电脑。
