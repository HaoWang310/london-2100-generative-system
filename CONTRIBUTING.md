# 开发指南 · Contributing

> 2026-11-22 起，本仓库由 HaoWang310 一人设计和维护，不再接受协作者直接修改。孵化器里其他作者的 app 保留原署名。

## 基本原则

1. **模块之间相互独立。** 模块之间只能通过 `shared/` 和标准数据接口 `ScaleBundle` 交流，不允许一个模块直接 import 另一个模块的文件（`tools/check-isolation.mjs` 会在 CI 中自动检查）。
2. **主程序走分支 + Pull Request。** 改 `app/`、`modules/`、`shared/`、`tools/`、`.github/` 时，先建分支、开 PR，CI 测试通过后再合并。孵化器 `incubator/` 里的独立 app 可以直接推送到 `main`。
3. **已有功能先保留再适配。** 从旧项目迁入的算法原样放进模块的 `legacy/` 文件夹，外面写适配器接入，不要删除或简化已有功能。

## 分支命名

```
module/03-wool-network/<简短描述>      修改某个模块
shared/<模块名>/<简短描述>              修改公共模块（可能影响所有模块）
app/<简短描述>                          统一外壳
chore/<简短描述>                        配置、CI、文档
```

## 日常流程

```sh
git checkout main && git pull
git checkout -b module/04-tensor-roads/streamline-step
# … 修改、本地测试 …
node --test
git push -u origin module/04-tensor-roads/streamline-step
# 在 GitHub 上开 Pull Request，CI 通过后合并
```

## 孵化区 `incubator/`

已经做好的独立 app 可以**原样**放进 `incubator/<app 名>/`，保留自己的 `index.html`，部署后可以在
`https://haowang310.github.io/london-2100-generative-system/incubator/<app 名>/` 单独访问。
它不需要遵守模块接口；准备融合时，再为它写一个 `modules/NN-xxx/` 适配模块。

融合有两种方式：把算法原样放进模块的 `legacy/`（与孵化区各自独立）；或者像 `01-growth-simulator` 那样**直连**——
模块运行时读取孵化区 app 自己的文件（`fetch`，不 `import`），孵化区改好主程序就跟着变。直连的孵化区 app 改动接口或数据布局前，
先跑 `node --test modules/01-growth-simulator/tests/`。

**让它出现在开场后的目录里**：在 `incubator/catalogue.json` 的 `items` 中加一条：

```json
{
  "id": "my-app",
  "href": "incubator/my-app/",
  "cover": "assets/catalogue/my-app.webp",
  "status": "incubating",
  "title": { "zh": "中文名称", "en": "English name" },
  "short": { "zh": "短名", "en": "Short name" },
  "desc":  { "zh": "一句话说明。", "en": "One-line description." },
  "tags":  [{ "zh": "标签", "en": "Tag" }],
  "owner": "app 作者的 GitHub 用户名"
}
```

`status` 可选 `ready`（可用）、`incubating`（孵化中）、`planned`（规划中）。封面建议 1200×800、深色，可以不填。
`short` 可以不填：手机上打开 app 时顶栏显示的短名，长度和 “Tensor Studio”“张量场工作室” 差不多；不填就显示 `title`，放不下时末尾是省略号。

手机上（760 像素以下）从目录打开应用时，外壳的中英切换按钮浮在应用画面的右上角，和左上角的「显示」按钮在同一行（离上边、右边各 12 像素，高 44 像素，宽约 100 像素）。外壳会给应用的 `<html>` 加上 `l2-shell-lang` 类：应用在手机上要让出这个角，比如 `@media (max-width:760px) { html.l2-shell-lang .我的右上角按钮 { top:68px; } }`。

## 新建模块

复制 `modules/_template/`（或参考任意现有模块），模块必须导出：

```js
export default {
  id: '03-wool-network', level: 'wool', version: '0.1.0',
  title: { zh: '…', en: '…' },
  params: [ /* 参数定义，右侧面板自动生成 */ ],
  async run(input, params, { onProgress, signal }) { return /* ScaleBundle */ }
}
```

并提供 `preview.html`（独立预览）和 `tests/*.test.mjs`（`node --test` 可运行）。
