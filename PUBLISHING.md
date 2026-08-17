# 开源发布指南（dsh-ui-archive-manager）

让其他人能**安装**（`dsh plugin add`）并**搜索到**（npm / GitHub）你的归档管理插件。

## 现状与定位

- 归档管理功能（含 `workspace.unarchiveSession` 核心 RPC）**已经是官方 dsh `0.1.0-rc.6` 的一部分**；
  官方 UI 包 `@deepseek-ai/dsh-client-ui-archive-manager` 也已发布。
- 本仓库的独有增量是**视觉美化 + 相对时间**（3 个文件：`ArchiveManagerSection.tsx` / `.module.css` / `locales.ts`）。
- 因此独立发布的是 `plugin/` 目录这个纯 client 插件包，**不发布核心改动**（rc.6 已含）。

## 包结构（`plugin/`）

```
plugin/
├── package.json          # dsh.bundle.patch + dsh.client 声明、exports["./client"]、keywords
├── cordis.patch.yml      # insert 行（id: ui-archive-manager-beautified）
├── tsconfig.json         # node half（src/index.ts、src/invariant.ts → lib/）
├── tsconfig.client.json  # client 类型声明（→ lib/types/client/）
├── tsdown.config.ts      # client bundle（__ModuleLoader__.load 协议 + CSS Modules 内联）
├── src/                  # 源码（美化版）
├── LICENSE               # MIT（保留 DeepSeek 上游版权 + 本项目版权）
└── README.md             # 安装指引
```

关键字段说明：

| 字段 | 作用 |
| --- | --- |
| `dsh.bundle.patch` | `dsh plugin add` 据此识别 bundle 并加入 profile 层列表 |
| `dsh.client` | client manifest，`platform` 必须为 `"web"` |
| `exports["./client"]` | `dsh-client-modules` 扫描浏览器 bundle 的硬要求 |
| `cordis.patch.yml` | 顶层 `- insert:` 追加插件行（`name` 必须等于包名） |
| `peerDependencies` | 全部写死 `^0.1.0-rc.6`（npm 不认 `workspace:` 协议） |
| `keywords` + `description` | npm 搜索索引依据 |

## 发布步骤

前置：本机有 Node.js ≥ 20 与 pnpm；有一个 npm 账号（`npm login`）。

```bash
# 1. 安装依赖（plugin/ 独立于 monorepo，无 pnpm-workspace.yaml 干扰）
cd plugin
pnpm install

# 2. 构建 + 类型检查（产出 lib/index.js、lib/invariant.js、lib/types/**、lib/client.js）
pnpm run build
pnpm run typecheck

# 3. 发布前检查（npm 包内容预览）
pnpm pack --dry-run
#    确认包含：lib/、cordis.patch.yml、README.md、LICENSE

# 4. 发布
npm publish --access public     # 或 pnpm publish --access public
```

发布后自测安装：

```bash
dsh plugin add dsh-ui-archive-manager     # 任意测试 profile
# 重启该 profile → 设置 → 归档管理
```

## 让"搜索到"最大化

npm 侧（已配置在 package.json，发布即生效）：

- 包名 `dsh-ui-archive-manager` 含 `dsh` + `archive` 关键词；
- `description` 首句含 "DeepSeek Harness (dsh)" 与功能词；
- `keywords` 覆盖 `dsh / deepseek-harness / plugin / archive / unarchive / 归档`。

GitHub 侧（仓库 `Neumannzc/dsh-archive-manager`）：

- 仓库 About 写：`A beautified archive manager plugin for DeepSeek Harness (dsh)`；
- Topics 添加：`dsh`、`deepseek-harness`、`plugin`、`archive-manager`、`typescript`；
- README 已含中英双语功能与安装说明（可在根 README 顶部补一句指向 `plugin/README.md`）。

其他渠道（可选）：

- 在 dsh 官方仓库的 Discussion 发帖介绍；
- 如果出现社区插件列表/市场，提交收录（当前 rc.6 无内置插件市场）。

## 维护策略

- **上游同步**：官方 rc.6 → rc.7+ 时，把 `peerDependencies` 的 `^0.1.0-rc.6` 放宽/升级，
  并重新 diff 官方 `dsh-client-ui-archive-manager` 源码，把新的官方修复合入本包源码。
- **版本节奏**：`0.x` 阶段用 `pnpm version patch/minor` 管理，发布后用 `pnpm version` 打 tag。
- **包名冲突**：npm 上已存在 `dsh-archive-manager`（他人同名项目，`latest 1.0.0`）。
  本包名 `dsh-ui-archive-manager` 当前未被占用；若未来被占，可改用 `@<你的scope>/dsh-ui-archive-manager`。

## 备选路线（未采用，可后续做）

- **向上游提 PR**：美化增量只有 3 个文件，向 `deepseek-ai/deepseek-harness` 提 PR 合入后，
  所有人升级 dsh 即得美化，无需维护独立包。可与本包并行推进。
