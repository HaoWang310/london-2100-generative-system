# 协作指南 · Contributing

## 基本原则

1. **每个人只改自己负责的文件夹。** 模块之间只能通过 `shared/` 和标准数据接口 `ScaleBundle` 交流，不允许一个模块直接 import 另一个模块的文件（`tools/check-isolation.mjs` 会在 CI 中自动检查）。
2. **不直接推送到 `main`。** 所有修改都通过分支 + Pull Request 合并，CI 测试通过后才能合并。
3. **已有功能先保留再适配。** 从旧项目迁入的算法原样放进模块的 `legacy/` 文件夹，外面写适配器接入，不要未经讨论删除或重写。

## 分支命名

```
module/02-wool-network/<简短描述>      修改某个模块
shared/<模块名>/<简短描述>              修改公共模块（需要双方都审核）
incubator/<app 名>/<简短描述>           孵化区独立 app
app/<简短描述>                          统一外壳
```

## 日常流程

```sh
git checkout main && git pull
git checkout -b module/03-tensor-roads/streamline-step
# … 修改、本地测试 …
node --test
git push -u origin module/03-tensor-roads/streamline-step
# 在 GitHub 上开 Pull Request
```

## 孵化区 `incubator/`

已经做好的独立 app 可以**原样**放进 `incubator/<app 名>/`，保留自己的 `index.html`，部署后可以在
`https://haowang310.github.io/london-2100-generative-system/incubator/<app 名>/` 单独访问。
它不需要遵守模块接口；准备融合时，再为它写一个 `modules/NN-xxx/` 适配模块。

## 新建模块

复制 `modules/_template/`（或参考任意现有模块），模块必须导出：

```js
export default {
  id: '02-wool-network', level: 'wool', version: '0.1.0',
  title: { zh: '…', en: '…' },
  params: [ /* 参数定义，右侧面板自动生成 */ ],
  async run(input, params, { onProgress, signal }) { return /* ScaleBundle */ }
}
```

并提供 `preview.html`（独立预览）和 `tests/*.test.mjs`（`node --test` 可运行）。
