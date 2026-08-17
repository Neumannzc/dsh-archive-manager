# 开源发布指南（@tangzai/dsh-ui-archive-manager）

让其他人能**安装**（`dsh plugin --profile web add @tangzai/dsh-ui-archive-manager`）并**搜索到**（npm / GitHub）你的归档管理插件。

## 现状与定位

- **重要背景**：官方 npm 上的 dsh `0.1.0-rc.6` **不含** `unarchiveSession`（该功能曾在 rc.6 短暂发布后被官方回滚；
  本机 8/14 装的缓存里还有，官方 registry 当前 tarball 已无）。官方只有 `archiveSession` + 归档数据 feeds。
- 因此本插件是**双 half**：node half 自带 unarchive 实现（patch `WorkspaceRegistry.unarchiveSession` +
  在官方 `webServer` 载体上注册 HTTP 路由，remote-web-ui 同款通道）；browser half 渲染美化设置页
  （显示用官方 `useSessions` / `archivedSessionIds` feeds，动作走插件自己的路由）。
- 独有增量：**视觉美化 + 相对时间**（3 个 UI 文件）+ **自带 unarchive 能力**（官方缺失，插件补齐）。
- 零核心改动：全部基于官方公开服务（workspaceRegistry / webServer / archived-sessions-changed 帧）。
- 形态对标第三方插件仓库 [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)
  （`@linxin666/dsh-web-ui-all` 全家桶）：scope 包名 + `dsh.bundle.patch` + profile 树解析运行时依赖。

## 包结构（`plugin/`）

```
plugin/
├── package.json          # dsh.bundle.patch + dsh.client 声明、exports["./client"]、keywords
├── .npmrc                # @tangzai scope 发布走官方 registry（见"Registry"小节）
├── cordis.patch.yml      # insert 行（id: ui-archive-manager-beautified）
├── tsconfig.json         # node half（src/index.ts host 实现、src/invariant.ts → lib/）
├── tsconfig.client.json  # client 类型声明（→ lib/types/client/）
├── tsdown.config.ts      # client bundle（__ModuleLoader__.load 协议 + CSS Modules 内联）
├── src/                  # 源码（node half：unarchive patch + HTTP 路由；browser half：美化设置页）
├── LICENSE               # MIT（保留 DeepSeek 上游版权 + 本项目版权）
└── README.md             # 安装指引
```

关键字段说明：

| 字段 | 作用 |
| --- | --- |
| `name: "@tangzai/..."` | scope 包名（scope = npm 用户名 `tangzai`，发布需 `npm login` 此账号） |
| `dsh.bundle.patch` | `dsh plugin add` 据此识别 bundle 并加入 profile 层列表 |
| `dsh.client` | client manifest，`platform` 必须为 `"web"` |
| `exports["./client"]` | `dsh-client-modules` 扫描浏览器 bundle 的硬要求 |
| `cordis.patch.yml` | 顶层 `- insert:` 追加插件行（`name` 必须等于包名） |
| `peerDependencies` | 只声明 `react`；`@deepseek-ai/*` 全在 `devDependencies`（运行时由 profile 树解析，避免 ERESOLVE；同 dsh-web-ui 模式） |
| `scripts.prepare` | git 方式安装（`dsh plugin add link:` / git+https）时自动构建 |
| `keywords` + `description` | npm 搜索索引依据 |

## 发布步骤

前置：本机有 Node.js ≥ 20 与 pnpm；npm 账号 `tangzai` 已 `npm login`。

### Registry：本机镜像源 vs 官方源

本机 `~/.npmrc` 的默认源是 `https://registry.npmmirror.com/`（国内镜像，**只读，不能发布**）。
`plugin/.npmrc` 已加入 scope 级覆盖，**发布 `@tangzai/*` 自动走官方源，日常安装仍走镜像**：

```ini
# plugin/.npmrc
@tangzai:registry=https://registry.npmjs.org/
```

官方源的认证 token（`//registry.npmjs.org/:_authToken=...`）已在你的 `~/.npmrc` 中配置。
发布前先验证（token 可能过期）：

```bash
# 确认 scope 指向官方源
npm config get @tangzai:registry      # 期望 https://registry.npmjs.org/

# 验证官方源连通性与认证（401 = token 过期，需重新登录）
npm ping --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/    # 期望 tangzai
```

若 token 过期：`npm login --registry https://registry.npmjs.org/`（**必须带官方源参数**，
否则 token 会写到镜像源名下，发布时 401）。

### 发布命令

```bash
# 1. 安装依赖（plugin/ 独立于 monorepo，无 pnpm-workspace.yaml 干扰）
cd plugin
pnpm install

# 2. 构建 + 类型检查（产出 lib/index.js、lib/invariant.js、lib/types/**、lib/client.js）
pnpm run build
pnpm run typecheck

# 3. 发布前检查（npm 包内容预览；--dry-run 不真正发布，可用镜像源预览）
pnpm pack --dry-run
#    确认包含：lib/、cordis.patch.yml、README.md、LICENSE

# 4. 发布（scope 包必须 --access public；plugin/.npmrc 已保证走官方源）
npm publish --access public     # 或 pnpm publish --access public

# 5. 发布后核验（官方源上应能查到）
npm view @tangzai/dsh-ui-archive-manager version
```

发布后自测安装（用一个测试 profile，或就在 web profile 上）：

```bash
dsh plugin --profile web add @tangzai/dsh-ui-archive-manager
# 重启该 profile → 设置 → 归档管理
```

> **新发布版本被装到旧版？** pnpm 11+ 的发布年龄门禁（`minimumReleaseAge`）会静默隔离
> 10 天内的新版本。解决办法：在 profile 的 `pnpm-workspace.yaml` 设置 `minimumReleaseAge: 0`，
> 或把 `@tangzai/*` 加进 `minimumReleaseAgeExclude`，再 `dsh plugin --profile web update @tangzai/dsh-ui-archive-manager`。
> （同 dsh-web-ui [issue #71](https://github.com/zhu1090093659/dsh-web-ui/issues/71) 的坑。）

## 让"搜索到"最大化

npm 侧（已配置在 package.json，发布即生效）：

- 包名 `@tangzai/dsh-ui-archive-manager` 含 `dsh` + `archive` 关键词；
- `description` 首句含 "DeepSeek Harness (dsh)" 与功能词；
- `keywords` 覆盖 `dsh / deepseek-harness / plugin / archive / unarchive / 归档`。

GitHub 侧（仓库 `Neumannzc/dsh-archive-manager`）：

- 仓库 About 写：`A beautified archive manager plugin for DeepSeek Harness (dsh)`；
- Topics 添加：`dsh`、`deepseek-harness`、`plugin`、`archive-manager`、`typescript`；
- README 已含中英双语功能与安装说明（可在根 README 顶部补一句指向 `plugin/README.md`）。

其他渠道（可选）：

- 在 dsh 官方仓库的 Discussion 发帖介绍；
- 在 dsh-web-ui 这类第三方生态的插件清单里提交收录（如 `docs/plugins.md`）；
- 如果出现社区插件列表/市场，提交收录（当前 rc.6 无内置插件市场）。

## 维护策略

- **上游同步**：官方 rc.6 → rc.7+ 时，把 `devDependencies` 的 `^0.1.0-rc.6` 放宽/升级，
  并重新 diff 官方 `dsh-client-ui-archive-manager` 源码，把新的官方修复合入本包源码。
- **版本节奏**：`0.x` 阶段用 `pnpm version patch/minor` 管理，发布后用 `pnpm version` 打 tag。
- **scope 名**：`@tangzai` 是你的 npm 账号，天然独占；无需担心无 scope 包名被抢注。

## 如果以后有多个插件：聚合包模式（参考 dsh-web-ui-all）

单个插件不需要聚合包。若以后新增插件（皮肤、面板等），照 dsh-web-ui 的模式：

1. 每个功能插件一个独立 npm 包（`@tangzai/dsh-xxx`），各自带 `cordis.patch.yml` 与 `dsh.bundle.patch`；
2. 建一个聚合包 `@tangzai/dsh-web-ui-all`（或类似名）：`dependencies` 全部用 `workspace:*` 引用
   功能包，`cordis.patch.yml` 里为每个功能包写一条 `- insert:`（行 id 用独立命名空间前缀）；
3. 发布必须用 **`pnpm publish`**（自动把 `workspace:*` 改写为真实版本号；`npm publish` 不改写），
   按依赖顺序发布：功能包 → 聚合包。

## 备选路线（未采用，可后续做）

- **向上游提 PR**：美化增量只有 3 个文件，向 `deepseek-ai/deepseek-harness` 提 PR 合入后，
  所有人升级 dsh 即得美化，无需维护独立包。可与本包并行推进。
